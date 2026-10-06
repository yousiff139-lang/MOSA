#ifndef MOSA_ESPNOW_H
#define MOSA_ESPNOW_H

#include <Arduino.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <Preferences.h>
#include <mbedtls/md.h>

// Maximum ESP-NOW Peers tracked per Hub
#define MOSA_ESPNOW_MAX_PEERS 32
#define MOSA_NVS_SEQ_BLOCK_SIZE 500

// 🛡️ Cryptographically Hardened ESP-NOW Payload Structure
typedef struct __attribute__((packed)) {
    char home[16];          // Home ID Tenant Isolation
    char sender[20];        // Board / Node ID
    uint32_t boot_epoch;    // Monotonic Epoch from NVS (Defeats Reboot/Pairing Replay)
    uint64_t sequence_id;   // Monotonic Packet Sequence ID
    uint8_t cmd_type;       // Command Type (1 = Toggle Relay)
    uint8_t device_id;      // Device Index
    uint8_t state;          // State: 0 = OFF, 1 = ON
    uint8_t hmac[32];       // SHA-256 HMAC Auth Tag
} MosaESPNOWPayload;

// Peer Replay Tracking Entry in RAM
typedef struct {
    char sender[20];
    uint32_t last_boot_epoch;
    uint64_t last_sequence_id;
    bool active;
} MosaPeerReplayEntry;

static MosaPeerReplayEntry peerReplayTable[MOSA_ESPNOW_MAX_PEERS];
static Preferences nvsPrefs;

// Local Node Monotonic Counters
static uint32_t currentBootEpoch = 1;
static uint64_t currentSendSequence = 0;
static uint64_t nvsSequenceCheckpoint = 0;

static uint8_t broadcastAddress[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};

// 🛡️ Compute HMAC-SHA256 over packet body
static void calculatePayloadHMAC(const MosaESPNOWPayload *p, const char *pskKey, uint8_t *outHmac) {
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
    mbedtls_md_hmac_starts(&ctx, (const unsigned char *)pskKey, strlen(pskKey));
    
    // Authenticate all fields except the trailing HMAC tag
    size_t authenticatedLength = sizeof(MosaESPNOWPayload) - 32;
    mbedtls_md_hmac_update(&ctx, (const unsigned char *)p, authenticatedLength);
    mbedtls_md_hmac_finish(&ctx, outHmac);
    mbedtls_md_free(&ctx);
}

// 🛡️ Constant-Time Buffer Comparison (Timing Attack Defense)
static bool verifyConstantTime(const uint8_t *a, const uint8_t *b, size_t len) {
    uint8_t result = 0;
    for (size_t i = 0; i < len; i++) {
        result |= (a[i] ^ b[i]);
    }
    return (result == 0);
}

void onESPNOWReceive(const uint8_t *mac, const uint8_t *incomingData, int len) {
    if (len != sizeof(MosaESPNOWPayload)) return;
    
    MosaESPNOWPayload payload;
    memcpy(&payload, incomingData, sizeof(payload));

    // 1. Verify Home ID (Strict Tenant Isolation)
    if (String(payload.home) != homeId) {
        return;
    }

    // 2. Cryptographic HMAC Authentication Verification
    extern String homePskKey; // Shared home PSK loaded from secure NVS or config
    String psk = (homePskKey.length() > 0) ? homePskKey : "MOSA_DEFAULT_SECURE_PSK_2026";
    
    uint8_t expectedHmac[32];
    calculatePayloadHMAC(&payload, psk.c_str(), expectedHmac);

    if (!verifyConstantTime(payload.hmac, expectedHmac, 32)) {
        Serial.printf("[ESP-NOW 🛑] HMAC Authentication Failed from sender %s! Packet dropped.\n", payload.sender);
        return;
    }

    // 3. Monotonic Sequence & Epoch Replay Defense
    int peerIndex = -1;
    for (int i = 0; i < MOSA_ESPNOW_MAX_PEERS; i++) {
        if (peerReplayTable[i].active && strcmp(peerReplayTable[i].sender, payload.sender) == 0) {
            peerIndex = i;
            break;
        }
    }

    if (peerIndex != -1) {
        MosaPeerReplayEntry *peer = &peerReplayTable[peerIndex];
        
        // Stale or strictly lower epoch -> REJECT
        if (payload.boot_epoch < peer->last_boot_epoch) {
            Serial.printf("[ESP-NOW 🛡️] Dropped Stale Epoch Replay from %s (Epoch %u < %u)\n", 
                          payload.sender, payload.boot_epoch, peer->last_boot_epoch);
            return;
        }
        
        // Same epoch, but sequence number is less than or equal to last seen -> REJECT
        if (payload.boot_epoch == peer->last_boot_epoch && payload.sequence_id <= peer->last_sequence_id) {
            Serial.printf("[ESP-NOW 🛡️] Dropped Packet Replay from %s (Seq %llu <= %llu)\n", 
                          payload.sender, payload.sequence_id, peer->last_sequence_id);
            return;
        }

        // Valid forward packet: Update tracked sequence in RAM
        peer->last_boot_epoch = payload.boot_epoch;
        peer->last_sequence_id = payload.sequence_id;
    } else {
        // Register new peer in RAM table
        for (int i = 0; i < MOSA_ESPNOW_MAX_PEERS; i++) {
            if (!peerReplayTable[i].active) {
                strncpy(peerReplayTable[i].sender, payload.sender, sizeof(peerReplayTable[i].sender) - 1);
                peerReplayTable[i].last_boot_epoch = payload.boot_epoch;
                peerReplayTable[i].last_sequence_id = payload.sequence_id;
                peerReplayTable[i].active = true;
                break;
            }
        }
    }

    Serial.printf("[ESP-NOW ⚡] Accepted Verified P2P Cmd from %s [Epoch:%u|Seq:%llu]: Dev %d -> %d\n", 
                  payload.sender, payload.boot_epoch, payload.sequence_id, payload.device_id, payload.state);

    // 4. Safe State Dispatching
    int id = payload.device_id;
    if (id >= 0 && id < MAX_DEVICES) {
        xSemaphoreTake(stateMutex, portMAX_DELAY);
        if (devices[id].active) {
            bool targetState = (payload.state == 1);
            if (devices[id].state != targetState) {
                toggleLogic(id, true);
                stateDirty = true;
            }
        }
        xSemaphoreGive(stateMutex);
    }
}

void initESPNOW() {
    // 🛡️ Initialize Monotonic Checkpoint Sequence from NVS
    nvsPrefs.begin("mosa_seq", false);
    
    // Strictly monotonic Boot Epoch (Increments on every boot, never random)
    currentBootEpoch = nvsPrefs.getUInt("boot_epoch", 0) + 1;
    nvsPrefs.putUInt("boot_epoch", currentBootEpoch);
    
    // Checkpoint Jump: Reserve block of 500 sequences to eliminate flash wear
    uint64_t lastNvsSeq = nvsPrefs.getULong64("seq_checkpoint", 0);
    currentSendSequence = lastNvsSeq;
    nvsSequenceCheckpoint = lastNvsSeq + MOSA_NVS_SEQ_BLOCK_SIZE;
    nvsPrefs.putULong64("seq_checkpoint", nvsSequenceCheckpoint);
    
    Serial.printf("[ESP-NOW 🛡️] Monotonic Init -> Boot Epoch: %u | Initial Seq: %llu | Checkpoint: %llu\n",
                  currentBootEpoch, currentSendSequence, nvsSequenceCheckpoint);

    // Reset RAM peer table
    for (int i = 0; i < MOSA_ESPNOW_MAX_PEERS; i++) {
        peerReplayTable[i].active = false;
    }

    if (esp_now_init() != ESP_OK) {
        Serial.println("[ESP-NOW 🛑] Initialization failed");
        return;
    }
    
    esp_now_register_recv_cb(onESPNOWReceive);
    
    esp_now_peer_info_t peerInfo;
    memset(&peerInfo, 0, sizeof(peerInfo));
    memcpy(peerInfo.peer_addr, broadcastAddress, 6);
    peerInfo.channel = 0;
    peerInfo.encrypt = false;
    
    if (esp_now_add_peer(&peerInfo) != ESP_OK) {
        Serial.println("[ESP-NOW 🛑] Failed to add broadcast peer");
        return;
    }
    Serial.println("[ESP-NOW ✅] Initialized Successfully with Hardened Replay Defense!");
}

void broadcastESPNOWCommand(int deviceId, bool state) {
    MosaESPNOWPayload payload;
    memset(&payload, 0, sizeof(payload));
    strncpy(payload.home, homeId.c_str(), sizeof(payload.home)-1);
    strncpy(payload.sender, boardID.c_str(), sizeof(payload.sender)-1);
    
    // Monotonic Counter Increment in RAM
    currentSendSequence++;
    
    // Checkpoint Boundary Crossing: Advance NVS checkpoint by 500
    if (currentSendSequence >= nvsSequenceCheckpoint) {
        nvsSequenceCheckpoint += MOSA_NVS_SEQ_BLOCK_SIZE;
        nvsPrefs.putULong64("seq_checkpoint", nvsSequenceCheckpoint);
        Serial.printf("[ESP-NOW 💾] Advanced NVS Checkpoint to: %llu\n", nvsSequenceCheckpoint);
    }

    payload.boot_epoch = currentBootEpoch;
    payload.sequence_id = currentSendSequence;
    payload.cmd_type = 1;
    payload.device_id = deviceId;
    payload.state = state ? 1 : 0;

    // Sign payload with HMAC-SHA256
    extern String homePskKey;
    String psk = (homePskKey.length() > 0) ? homePskKey : "MOSA_DEFAULT_SECURE_PSK_2026";
    calculatePayloadHMAC(&payload, psk.c_str(), payload.hmac);

    esp_err_t result = esp_now_send(broadcastAddress, (uint8_t *)&payload, sizeof(payload));
    if (result == ESP_OK) {
        Serial.printf("[ESP-NOW 📡] Broadcasted State [Epoch:%u|Seq:%llu] successfully\n",
                      payload.boot_epoch, payload.sequence_id);
    } else {
        Serial.println("[ESP-NOW 🛑] Broadcast failed");
    }
}

// Ensure WiFi is on a fixed channel when disconnected to prevent Channel Hopping trap
void forceWiFiChannel(uint8_t channel) {
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(channel, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);
    Serial.printf("[ESP-NOW] Forced WiFi Channel to %d for P2P Fallback\n", channel);
}

#endif
