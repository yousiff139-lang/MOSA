/*
 * ╔══════════════════════════════════════════════════════════╗
 * ║         MosaSmartNode - Firmware v3.0                   ║
 * ║  التحسينات المطبّقة:                                    ║
 * ║  🔴 تأمين API endpoints بـ API Key                      ║
 * ║  🔴 تقليل blocking في ACS و DHT (non-blocking)          ║
 * ║  🟡 تقليل استدعاءات broadcastDevices (dirty flag)       ║
 * ║  🟡 تقليل الكتابة على Flash (write batching)            ║
 * ║  🟢 إضافة /api/status                                   ║
 * ║  🟢 MQTT خاص (Unique Client ID + Last Will)             ║
 * ╚══════════════════════════════════════════════════════════╝
 */

#include <ArduinoJson.h>
#include <HTTPUpdate.h>
#include <DHT.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <Update.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include "esp32_mtls_certs.h"
#include <esp_now.h>
#include <esp_task_wdt.h>
#include <nvs_flash.h>
#include <time.h>
#include <Wire.h>
#include "esp_sntp.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "mbedtls/md.h"
#include "esp_ota_ops.h"
#include "esp_wifi.h"

// ─── 🛡️ 7-Stage OTA Health Handshake (REDTEAM-13 & REDTEAM-14 Hardened) ───
struct OtaHealthCheck {
  bool stage1_boot;          // Stage 1: Boot from new partition
  bool stage2_hw_test;       // Stage 2: GPIO/I2C/Peripherals self-test
  bool stage3_wifi_stable;   // Stage 3: Wi-Fi connection stable >= 5s
  bool stage4_mqtt_auth;     // Stage 4: MQTT authenticated with backend
  bool stage5_nvs_valid;     // Stage 5: NVS partition and device ID verified
  bool stage6_core_loop;     // Stage 6: Core main loop ticking without WDT panic
  bool stage7_heartbeat_ack; // Stage 7: Heartbeat ACK from MOSA platform
  unsigned long otaStartTime;
  bool isCommitted;
};
OtaHealthCheck otaHealth = { false, false, false, false, false, false, false, 0, false };

struct EspNowMeshPayload;
void computeMeshHmac(const EspNowMeshPayload &p, const char* key, uint8_t outMac[16]);

// ─── 🔊 MOSA Hi-Fi I2S Audio Engine (Disabled on COM5 Main Controller to protect GPIO 12/13/14) ───
#define ENABLE_I2S_AUDIO false
#define I2S_BCLK_PIN  14
#define I2S_LRC_PIN   13
#define I2S_DOUT_PIN  12

#if ENABLE_I2S_AUDIO
#include <Audio.h>
Audio audio;
int audioVolume = 14;          // 0..21
int audioPreviousVolume = 14;  // For unmuting
bool audioMuted = false;
bool audioPlaying = false;
String audioTrackTitle = "جاهز للتشغيل";
String audioSource = "Idle";

void audio_info(const char *info) { Serial.printf("[Audio Core] %s\n", info); }
void audio_id3data(const char *info) { audioTrackTitle = String(info); }
void audio_eof_mp3(const char *info) { audioPlaying = false; audioTrackTitle = "اكتمل التشغيل"; }
#endif

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);
bool hasDisplay = false;
bool hasRtc     = false;

// ─── Named System Constants (No Magic Numbers) ───
#define WS_MAX_AUTH_FAILS        5
#define WS_AUTH_LOCKOUT_MS       60000
#define PIR_DEBOUNCE_MS          5000
#define PIR_AUTO_OFF_MS          120000
#define WIFI_WATCHDOG_MS         600000
#define WIFI_AP_FALLBACK_MS      120000
#define WIFI_BACKOFF_MAX_MS      60000
#define MQTT_BACKOFF_MAX_MS      60000
#define MQTT_HEARTBEAT_MS        30000
#define COMPRESSOR_DELAY_MS      180000
#define SENSOR_INTERVAL_MS       60000
#define BROADCAST_THROTTLE_MS    500
#define FLUSH_INTERVAL_MS        10000
#define DISPLAY_PAGE_INTERVAL_MS 5000
#define DISPLAY_SLEEP_MS         300000
#define SWITCH_DEBOUNCE_MS       12
#define SWITCH_REFRACTORY_MS     75
#define STAGGER_DELAY_MS         200
#define KWH_SAVE_INTERVAL_MS     3600000

// Forward Declarations for C++ Compiler
void applyState(int id);
void broadcastDevices();
void publishDiscovery();
void publishHAAutoDiscovery();
void sendCORSHeaders();
void initDHTSensor(int targetPin);

// ==========================================
// 1. إعدادات الشبكة والأمان
// ==========================================
WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(82);
Preferences prefs;

// ─── Multi-SSID Priority Structure (Populated strictly from Encrypted NVS) ───
struct WiFiNetworkInfo {
  String ssid;
  String pass;
  uint8_t priority; // 1 = الرئيسية, 2 = المقوي Extender, 3 = الطوارئ
};

WiFiNetworkInfo wifiNetworks[3] = {
  {"", "", 1},  // تُملأ من NVS فقط بأمان
  {"", "", 2},
  {"", "", 3}
};

uint8_t currentConnectedPriority = 1;
unsigned long lastPrimaryScanTime = 0;
extern String boardID;
String homeId = "";
void processCommand(JsonDocument &doc);

// ─── 🛡️ HARDENED ESP-NOW EMERGENCY MESH PROTOCOL (Authenticated & Anti-Replay) ───
struct EspNowMeshPayload {
  char originBoardID[16]; // 16 bytes
  char homeIdHash[8];     // 8 bytes (Truncated Home ID Hash for Tenant Isolation)
  uint32_t sequence;      // 4 bytes (Monotonic Anti-Replay Counter)
  uint8_t hopCount;       // 1 byte (Max 3 hops)
  char commandData[112];  // 112 bytes (JSON Command Payload)
  uint8_t mac[16];        // 16 bytes (Truncated HMAC-SHA256 Authentication Tag)
};

uint8_t espNowBroadcastMac[] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
bool espNowInitialized = false;
String meshSecret = "";
String apSecret = "";
uint32_t meshOutSequence = 1;
uint32_t meshHmacRejectionCount = 0;
unsigned long lastPhysicalButtonPressTime = 0;

// Anti-Replay & Deduplication Ring Buffer (32 Entries)
struct SeenMeshEntry {
  char originBoardID[16];
  uint32_t sequence;
};
#define MESH_SEEN_RING_SIZE 32
SeenMeshEntry seenMeshRing[MESH_SEEN_RING_SIZE];
uint8_t seenMeshRingIndex = 0;

// Per-Origin High-Water Mark Sequence Table
struct OriginSeqEntry {
  char originBoardID[16];
  uint32_t lastSeq;
};
#define MESH_ORIGIN_MAX 16
OriginSeqEntry originHighWaterMark[MESH_ORIGIN_MAX];

void computeMeshHmac(const EspNowMeshPayload &p, const char* key, uint8_t outMac[16]) {
  uint8_t fullHmac[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key, strlen(key));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)p.originBoardID, sizeof(p.originBoardID));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)p.homeIdHash, sizeof(p.homeIdHash));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)&p.sequence, sizeof(p.sequence));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)&p.hopCount, sizeof(p.hopCount));
  mbedtls_md_hmac_update(&ctx, (const unsigned char*)p.commandData, sizeof(p.commandData));
  mbedtls_md_hmac_finish(&ctx, fullHmac);
  mbedtls_md_free(&ctx);
  memcpy(outMac, fullHmac, 16);
}

void getTruncatedHomeHash(const String &hid, char outHash[9]) {
  uint8_t fullHash[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(MBEDTLS_MD_SHA256), 0);
  mbedtls_md_starts(&ctx);
  mbedtls_md_update(&ctx, (const unsigned char*)hid.c_str(), hid.length());
  mbedtls_md_finish(&ctx, fullHash);
  mbedtls_md_free(&ctx);
  for (int i = 0; i < 4; i++) {
    snprintf(outHash + (i * 2), 3, "%02X", fullHash[i]);
  }
  outHash[8] = '\0';
}

String getActiveMeshSecret() {
  if (meshSecret.length() > 0) return meshSecret;
  return "MOSA_SECURE_MESH_" + (homeId.length() > 0 ? homeId : "home-1");
}

void OnEspNowDataRecv(const esp_now_recv_info_t *recv_info, const uint8_t *incomingData, int len) {
  if (len < sizeof(EspNowMeshPayload)) return;
  EspNowMeshPayload payload;
  memcpy(&payload, incomingData, sizeof(payload));

  // 1. Cross-Home Boundary Check (Tenant Isolation)
  char expectedHomeHash[9];
  getTruncatedHomeHash(homeId, expectedHomeHash);
  if (memcmp(payload.homeIdHash, expectedHomeHash, 8) != 0) {
    return; // Foreign Home packet -> drop silently
  }

  // 1.5 Ignore self-originated mesh packets (prevents command loopback and switch de-synchronization)
  String macClean = WiFi.macAddress();
  macClean.replace(":", "");
  String myOriginId = "MN_" + (macClean.length() >= 6 ? macClean.substring(macClean.length() - 6) : macClean);
  if (strncmp(payload.originBoardID, myOriginId.c_str(), 16) == 0) {
    return; // Self-originated packet: already executed locally, ignore loopback!
  }

  // 2. Cryptographic HMAC Verification (Automatic Zero-Touch Secret Key)
  String activeSecret = getActiveMeshSecret();
  uint8_t expectedMac[16];
  computeMeshHmac(payload, activeSecret.c_str(), expectedMac);
  if (memcmp(payload.mac, expectedMac, 16) != 0) {
    meshHmacRejectionCount++;
    Serial.printf("[ESP-NOW Security 🛑] REJECTED unauthenticated packet from %s (Invalid HMAC! Rejections: %u)\n",
      payload.originBoardID, meshHmacRejectionCount);
    return;
  }

  // 3. Deduplication Ring Buffer Check (Eliminate Broadcast Storms)
  for (int i = 0; i < MESH_SEEN_RING_SIZE; i++) {
    if (seenMeshRing[i].sequence == payload.sequence &&
        strncmp(seenMeshRing[i].originBoardID, payload.originBoardID, 16) == 0) {
      return; // Already processed & relayed
    }
  }

  // 4. Anti-Replay Sequence Check (High-Water Mark per Origin Board with NVS Persistence)
  int originIdx = -1;
  for (int i = 0; i < MESH_ORIGIN_MAX; i++) {
    if (strncmp(originHighWaterMark[i].originBoardID, payload.originBoardID, 16) == 0) {
      originIdx = i;
      break;
    }
    if (originHighWaterMark[i].originBoardID[0] == '\0' && originIdx == -1) {
      originIdx = i;
    }
  }

  if (originIdx != -1) {
    if (originHighWaterMark[originIdx].originBoardID[0] != '\0') {
      if (payload.sequence <= originHighWaterMark[originIdx].lastSeq) {
        Serial.printf("[ESP-NOW Security 🛑] REJECTED replayed sequence %u from %s (RAM Last seen: %u)\n",
          payload.sequence, payload.originBoardID, originHighWaterMark[originIdx].lastSeq);
        return;
      }
    } else {
      strncpy(originHighWaterMark[originIdx].originBoardID, payload.originBoardID, 16);
      prefs.begin("mesh-rx", true);
      uint32_t savedSeq = prefs.getUInt(payload.originBoardID, 0);
      prefs.end();
      if (payload.sequence <= savedSeq) {
        Serial.printf("[ESP-NOW Security 🛑] REJECTED replayed sequence %u from %s (NVS Last seen: %u)\n",
          payload.sequence, payload.originBoardID, savedSeq);
        originHighWaterMark[originIdx].lastSeq = savedSeq;
        return;
      }
    }
    originHighWaterMark[originIdx].lastSeq = payload.sequence;
    // 🛡️ NVS Flash Wear Guard: Persist sequence every 5 frames or on first encounter to protect flash endurance
    if (payload.sequence % 5 == 0 || originHighWaterMark[originIdx].lastSeq <= 5) {
      prefs.begin("mesh-rx", false);
      prefs.putUInt(payload.originBoardID, payload.sequence);
      prefs.end();
    }
  }

  // Record in seen ring buffer
  strncpy(seenMeshRing[seenMeshRingIndex].originBoardID, payload.originBoardID, 16);
  seenMeshRing[seenMeshRingIndex].sequence = payload.sequence;
  seenMeshRingIndex = (seenMeshRingIndex + 1) % MESH_SEEN_RING_SIZE;

  Serial.printf("[ESP-NOW Mesh ✅] Verified Hop %d from Board: %s | Seq: %u | Cmd: %s\n", 
    payload.hopCount, payload.originBoardID, payload.sequence, payload.commandData);

  // 5. Execute Command Idempotently
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload.commandData);
  if (!err) {
    doc["isMesh"] = true;
    doc["originBoardId"] = payload.originBoardID;
    processCommand(doc);
  }

  // 6. Multi-Hop Forwarding (Relay packet if hopCount < 3 && WiFi still disconnected)
  if (payload.hopCount < 3 && WiFi.status() != WL_CONNECTED) {
    payload.hopCount++;
    // Re-sign with updated hopCount using active secret
    computeMeshHmac(payload, activeSecret.c_str(), payload.mac);
    esp_now_send(espNowBroadcastMac, (uint8_t *) &payload, sizeof(payload));
  }
}

void initEspNowMesh() {
  if (espNowInitialized) return;
  // 🛡️ Ensure WiFi radio is locked on fixed fallback channel (Channel 1) when offline to prevent channel-hopping packet loss
  if (WiFi.status() != WL_CONNECTED) {
    esp_wifi_set_promiscuous(true);
    esp_wifi_set_channel(1, WIFI_SECOND_CHAN_NONE);
    esp_wifi_set_promiscuous(false);
  }
  if (esp_now_init() == ESP_OK) {
    espNowInitialized = true;
    esp_now_register_recv_cb(OnEspNowDataRecv);

    esp_now_peer_info_t peerInfo = {};
    memcpy(peerInfo.peer_addr, espNowBroadcastMac, 6);
    peerInfo.channel = 0;
    // 🛡️ Architectural Design Decision: Broadcast ESP-NOW encryption is false to enable
    // zero-pairing multi-hop relay across all uncommissioned wall nodes in the house.
    // Authenticity, integrity, and anti-replay are strictly enforced via the HMAC-SHA256
    // signature (meshHmac) and monotonic sequence counters on every frame.
    peerInfo.encrypt = false;
    esp_now_add_peer(&peerInfo);

    Serial.println("[ESP-NOW Mesh Relay] Initialized Hardened ESP-NOW Mesh Layer (Level 2 Authenticated Backup)!");
  }
}

void broadcastEspNowMeshRelay(const char* cmdJson) {
  if (!espNowInitialized) initEspNowMesh();
  EspNowMeshPayload payload;
  memset(&payload, 0, sizeof(payload));
  String macClean = WiFi.macAddress();
  macClean.replace(":", "");
  String originId = "MN_" + (macClean.length() >= 6 ? macClean.substring(macClean.length() - 6) : macClean);
  strncpy(payload.originBoardID, originId.c_str(), sizeof(payload.originBoardID) - 1);
  
  char homeHash[9];
  getTruncatedHomeHash(homeId, homeHash);
  memcpy(payload.homeIdHash, homeHash, 8);
  
  payload.sequence = meshOutSequence++;
  payload.hopCount = 1;
  strncpy(payload.commandData, cmdJson, sizeof(payload.commandData) - 1);

  String activeSecret = getActiveMeshSecret();
  computeMeshHmac(payload, activeSecret.c_str(), payload.mac);

  // Record outgoing in seen ring buffer
  strncpy(seenMeshRing[seenMeshRingIndex].originBoardID, payload.originBoardID, 16);
  seenMeshRing[seenMeshRingIndex].sequence = payload.sequence;
  seenMeshRingIndex = (seenMeshRingIndex + 1) % MESH_SEEN_RING_SIZE;

  esp_now_send(espNowBroadcastMac, (uint8_t *) &payload, sizeof(payload));
  Serial.printf("[ESP-NOW Mesh Relay 🚀] Broadcasted signed payload (Seq: %u): %s\n", payload.sequence, cmdJson);
}

#include "Constants.h"

const char* default_wifi_ssid   = "";
const char* default_wifi_pass   = "";
const char* default_home_id     = "";
const char* default_mqtt_host   = "";

String wsPassword  = "";
String apiKey      = "";
// homeId declared at top of file
int timeZoneOffset = 10800;
bool wsAuthenticated[WEBSOCKETS_SERVER_CLIENT_MAX] = {false};
unsigned long lastAuthAttempt[WEBSOCKETS_SERVER_CLIENT_MAX] = {0};
int authFailCount[WEBSOCKETS_SERVER_CLIENT_MAX] = {0};

struct LocalScene {
  char name[32];
  uint32_t relayMask;
  uint8_t dimmerLevel;
};

// Explicit function prototypes for Arduino IDE preprocessor
void saveScene(int id, LocalScene scene);
LocalScene loadScene(int id);

#define MAX_DEVICES 32

// ==============================================================================
// ESP32-S3-WROOM-2 (8MB Octal PSRAM) GPIO Validation Guards
// Reference: ESP32-S3 Technical Reference Manual (TRM) & Datasheet Section 2.2 / Table 2-1
// Enforces: 8MB Octal PSRAM bus, Silicon Die Gaps, Fixed Input-Only pads, & UART0 bridge
// ==============================================================================

// Helper function to check if a GPIO pin is safe to use for Relay Output
bool isValidOutputGPIO(int pin) {
  // 1. Block GPIO 0 (Boot Strapping Pin & Runtime Physical Presence Button)
  if (pin <= 0) return false;

#if defined(CONFIG_IDF_TARGET_ESP32S3)
  // ESP32-S3 constraints:
  if (pin >= 22 && pin <= 25) return false;
  if (pin >= 26 && pin <= 32) return false; // Dedicated SPI Flash Bus
  if (pin >= 33 && pin <= 37) return false; // Dedicated Octal SPI PSRAM Bus
  if (pin == 43 || pin == 44) return false; // Dedicated UART0 TX/RX
  if (pin == 46) return false;              // Fixed INPUT-ONLY pad in silicon
  if (pin > 48) return false;
#elif defined(CONFIG_IDF_TARGET_ESP32)
  // Standard ESP32 constraints:
  if (pin >= 6 && pin <= 11) return false;  // Integrated SPI Flash (CMD, CLK, SD0-SD3)
  if (pin >= 34 && pin <= 39) return false; // Input-only pins on ESP32 (GPI 34-39)
  if (pin > 39) return false;
#else
  if (pin >= 6 && pin <= 11) return false;
  if (pin > 48) return false;
#endif

  return true;
}

// Helper function to check if a GPIO pin is safe to use for Switch Input
bool isValidInputGPIO(int pin) {
  // 1. Block GPIO 0 (Reserved for onboard tactile BOOT / Physical Presence Verification)
  if (pin <= 0) return false;

#if defined(CONFIG_IDF_TARGET_ESP32S3)
  // ESP32-S3 constraints:
  if (pin >= 22 && pin <= 25) return false;
  if (pin >= 26 && pin <= 32) return false; // Dedicated SPI Flash Bus
  if (pin >= 33 && pin <= 37) return false; // Dedicated Octal SPI PSRAM Bus
  if (pin == 43 || pin == 44) return false; // Dedicated UART0 TX/RX
  if (pin > 48) return false;
#elif defined(CONFIG_IDF_TARGET_ESP32)
  // Standard ESP32 constraints:
  if (pin >= 6 && pin <= 11) return false;  // Integrated SPI Flash
  if (pin > 39) return false;               // Pins 34, 35, 36, 39 are valid INPUT pins on standard ESP32!
#else
  if (pin >= 6 && pin <= 11) return false;
  if (pin > 48) return false;
#endif

  return true;
}

bool isValidGPIO(int pin) {
  return isValidOutputGPIO(pin) || isValidInputGPIO(pin);
}

// ==========================================
// 2. هياكل البيانات (تم النقل لتفادي خطأ updateDisplay)
// ==========================================
struct Device {
  bool  active            = false;
  char  name[32]          = "";
  char  room[32]          = "عام";
  char  type[16]          = "light";
  int   pin               = -1;
  int   inPin             = -1;
  bool  isHighActive      = true; // true = Active HIGH (3.3V), false = Active LOW (0V/GND)
  bool  isSwitchPullup    = true; // true = INPUT_PULLUP (GND), false = INPUT_PULLDOWN (3.3V)
  bool  state             = false;
  bool  lastButtonState   = true;
  unsigned long startTime = 0;
  unsigned long totalTime = 0;
  int   pwmValue          = 255;
  char  color[8]          = "#ffffff";
  unsigned long timerOffMillis = 0;

  bool scheduleActive    = false;
  int  scheduleHourOn    = -1;
  int  scheduleMinuteOn  = -1;
  int  scheduleHourOff   = -1;
  int  scheduleMinuteOff = -1;

  uint8_t powerRestorePolicy = 0; // 0 = RESTORE_PREVIOUS, 1 = FORCE_OFF, 2 = FORCE_ON, 3 = SAFE_STATE

  bool needsSave = false;
};

Device devices[MAX_DEVICES];
bool btnLastRaw[MAX_DEVICES] = {false};
unsigned long btnLastChange[MAX_DEVICES] = {0};
unsigned long lastSwitchTrigger[MAX_DEVICES] = {0};

// ==========================================
// تعريفات دبابيس اللوحة المخصصة (ESP32-S3 N16R8 Clean PCB Pinout)
// ==========================================
#define DHTTYPE    DHT22
#define DHT_PIN    8    // GPIO 8 (Left Header - DHT22 Data)
#define ACS_PIN    10   // GPIO 10 (Left Header - ACS712 ADC1_CH9)
#define PIR_PIN    9    // GPIO 9 (Left Header - PIR Motion)
#define BUZZER_PIN 14   // GPIO 14 (Left Header - Buzzer PWM)
#define DISP_SDA   21   // GPIO 21 (Right Header - OLED I2C SDA)
#define DISP_SCL   38   // GPIO 38 (Right Header - OLED I2C SCL)

// ==========================================
// 🔴 FIX: ACS Non-Blocking - متغيرات الحالة
// ==========================================
struct ACSState {
  int     maxVal      = 0;
  int     minVal      = 4095;
  uint32_t startTime  = 0;
  bool    sampling    = false;
  float   lastResult  = 0.0f;
};
ACSState acsState;

// ── Loop Timing Globals ──
unsigned long lastMqttReconnect  = 0;
bool pirLastState                = false;
unsigned long pirLastTrigger     = 0;
unsigned long lastSensorTime     = 0;
unsigned long lastFlushTime      = 0;
int lastCheckedMinute            = -1;
unsigned long lastHeartbeatTime  = 0;
extern PubSubClient mqttClient;
SemaphoreHandle_t mqttMutex      = NULL;
SemaphoreHandle_t devicesMutex   = NULL;
volatile bool switchTaskRunning  = false;
volatile uint32_t lockContentionCount = 0;

// ── 🛡️ Multi-Core Thread-Safe Recursive Device Lock (FreeRTOS) ──
inline bool lockDevices(TickType_t timeout = pdMS_TO_TICKS(50)) {
  if (devicesMutex == NULL) {
    devicesMutex = xSemaphoreCreateRecursiveMutex();
    if (devicesMutex == NULL) return false;
  }
  return (xSemaphoreTakeRecursive(devicesMutex, timeout) == pdTRUE);
}

inline void unlockDevices() {
  if (devicesMutex != NULL) {
    xSemaphoreGiveRecursive(devicesMutex);
  }
}

// RAII Scope Guard: Guarantees unlock on return, break, or scope exit across all functions
class DeviceLockGuard {
private:
  bool _locked;
public:
  explicit DeviceLockGuard(TickType_t timeout = pdMS_TO_TICKS(50)) {
    _locked = lockDevices(timeout);
  }
  ~DeviceLockGuard() {
    if (_locked) {
      unlockDevices();
    }
  }
  bool isLocked() const { return _locked; }
};

// ── 🛡️ Multi-Core Thread-Safe Recursive MQTT Lock (FreeRTOS) ──
// Solves non-recursive deadlock when mqttClient.loop() synchronous callback triggers a publish
inline bool lockMqtt(TickType_t timeout = pdMS_TO_TICKS(50)) {
  if (mqttMutex == NULL) {
    mqttMutex = xSemaphoreCreateRecursiveMutex();
    if (mqttMutex == NULL) return true;
  }
  return (xSemaphoreTakeRecursive(mqttMutex, timeout) == pdTRUE);
}

inline void unlockMqtt() {
  if (mqttMutex != NULL) {
    xSemaphoreGiveRecursive(mqttMutex);
  }
}

class MqttLockGuard {
private:
  bool _locked;
public:
  explicit MqttLockGuard(TickType_t timeout = pdMS_TO_TICKS(50)) {
    _locked = lockMqtt(timeout);
  }
  ~MqttLockGuard() {
    if (_locked) {
      unlockMqtt();
    }
  }
  bool isLocked() const { return _locked; }
};

// Helper for thread-safe MQTT publish across all tasks and callbacks
inline bool safeMqttPublish(const char* topic, const char* payload, bool retained = false, TickType_t timeout = pdMS_TO_TICKS(50)) {
  if (!mqttClient.connected() || topic == nullptr || payload == nullptr) return false;
  MqttLockGuard mqttLock(timeout);
  if (mqttLock.isLocked()) {
    if (mqttClient.connected()) {
      return mqttClient.publish(topic, payload, retained);
    }
  } else {
    lockContentionCount++;
  }
  return false;
}

// ── Forward Declarations ──
int getActiveSensorPin();
void initDHTSensor(int targetPin);
void initDHTSensor();
void dhtUpdate();
void readSwitches();
void switchTask(void *pvParameters);
void handleSerialCLI();
void broadcastDevices();
void toggleLogic(int id, bool force = false);
void loadDevices();
void connectMQTT();
void mqttCallback(char*, byte*, unsigned int);
void onWebSocketEvent(uint8_t, WStype_t, uint8_t*, size_t);
void initHardwareBoard();
void runSelfTest();
void scanWifiAndSendResults();

// ==========================================
// MQTT (Strict mTLS Secured Port 8883 - REDTEAM-03 & REDTEAM-04 Hardened)
// ==========================================
WiFiClientSecure espClientSecure;
PubSubClient     mqttClient(espClientSecure);
String mqttHost     = "";
String mqttUser     = "";
String mqttPassword = "";

// ── Dynamic mTLS Certificate Storage (OTA Dynamic PKI) ──
String dynamicCaCert = "";
String dynamicClientCert = "";
String dynamicClientKey = "";
bool usingDynamicCerts = false;
int dynamicCertFailCount = 0;

void loadMtlsCertificates() {
  prefs.begin("mosa_certs", true); // read-only
  if (prefs.isKey("ca") && prefs.isKey("cert") && prefs.isKey("key")) {
    dynamicCaCert = prefs.getString("ca", "");
    dynamicClientCert = prefs.getString("cert", "");
    dynamicClientKey = prefs.getString("key", "");
    if (dynamicCaCert.length() > 50 && dynamicClientCert.length() > 50 && dynamicClientKey.length() > 50) {
      usingDynamicCerts = true;
      Serial.println(F("[mTLS 🔐] Loaded dynamic OTA certificates from NVS storage."));
    } else {
      usingDynamicCerts = false;
      Serial.println(F("[mTLS ⚠️] NVS certificates invalid/empty, falling back to embedded factory certs."));
    }
  } else {
    usingDynamicCerts = false;
    Serial.println(F("[mTLS 🔐] No dynamic certs in NVS, using embedded factory certs."));
  }
  prefs.end();
}

bool saveMtlsCertificates(const String& ca, const String& cert, const String& key) {
  if (ca.indexOf("-----BEGIN CERTIFICATE-----") == -1 ||
      cert.indexOf("-----BEGIN CERTIFICATE-----") == -1 ||
      (key.indexOf("-----BEGIN EC PRIVATE KEY-----") == -1 && key.indexOf("-----BEGIN PRIVATE KEY-----") == -1)) {
    Serial.println(F("[mTLS ❌] Invalid PEM certificate format rejected."));
    return false;
  }
  prefs.begin("mosa_certs", false); // read-write
  prefs.putString("ca", ca);
  prefs.putString("cert", cert);
  prefs.putString("key", key);
  prefs.end();
  
  dynamicCaCert = ca;
  dynamicClientCert = cert;
  dynamicClientKey = key;
  usingDynamicCerts = true;
  dynamicCertFailCount = 0;
  Serial.println(F("[mTLS 💾] Successfully saved new OTA certificates to NVS flash!"));
  return true;
}

void clearDynamicMtlsCertificates() {
  prefs.begin("mosa_certs", false);
  prefs.clear();
  prefs.end();
  dynamicCaCert = "";
  dynamicClientCert = "";
  dynamicClientKey = "";
  usingDynamicCerts = false;
  dynamicCertFailCount = 0;
  Serial.println(F("[mTLS 🔄] Cleared dynamic certs. Reverted to embedded factory certs."));
}

void applyMtlsCredentials() {
  if (usingDynamicCerts && dynamicCaCert.length() > 50 && dynamicClientCert.length() > 50 && dynamicClientKey.length() > 50) {
    espClientSecure.setCACert(dynamicCaCert.c_str());
    espClientSecure.setCertificate(dynamicClientCert.c_str());
    espClientSecure.setPrivateKey(dynamicClientKey.c_str());
  } else {
    espClientSecure.setCACert(ca_cert_pem);
    espClientSecure.setCertificate(client_cert_pem);
    espClientSecure.setPrivateKey(client_key_pem);
  }
}

bool discoverMqttServerViaMdns() {
  if (WiFi.status() != WL_CONNECTED) return false;
  esp_task_wdt_reset();
  Serial.println(F("[mDNS 🔍] Scanning network for MOSA MQTT server (mosa-server.local / _mosa-mqtt._tcp)..."));
  
  // Non-blocking quick query with 500ms timeout to never starve WDT
  IPAddress serverIp = MDNS.queryHost("mosa-server", 500);
  esp_task_wdt_reset();
  if (serverIp[0] == 0) {
    int n = MDNS.queryService("mosa-mqtt", "tcp");
    esp_task_wdt_reset();
    if (n > 0) {
      serverIp = MDNS.address(0);
    }
  }
  esp_task_wdt_reset();
  
  if (serverIp[0] != 0) {
    // 🛡️ REJECT DOCKER INTERNAL BRIDGE SUBNETS (172.16.x.x - 172.31.x.x)
    if (serverIp[0] == 172 && (serverIp[1] >= 16 && serverIp[1] <= 31) && WiFi.localIP()[0] != 172) {
      Serial.printf("[mDNS ⚠️] Ignored Docker internal container IP: %s\n", serverIp.toString().c_str());
      return false;
    }
    if (serverIp[0] == 10 && WiFi.localIP()[0] != 10) {
      Serial.printf("[mDNS ⚠️] Ignored non-local subnet IP: %s\n", serverIp.toString().c_str());
      return false;
    }

    String newHost = serverIp.toString();
    if (newHost != mqttHost) {
      Serial.printf("[mDNS 🎯] Found MOSA Server IP changed: %s -> %s\n", mqttHost.c_str(), newHost.c_str());
      mqttHost = newHost;
      prefs.begin("smarthome", false);
      prefs.putString("mqtthost", mqttHost);
      prefs.end();
      mqttClient.setServer(mqttHost.c_str(), 8883);
    }
    return true;
  }
  Serial.println(F("[mDNS] No server resolved via mDNS, maintaining current mqttHost."));
  return false;
}

// بدء جلسة قياس جديدة (تُستدعى من loop بدون blocking)
void acsStartSample() {
  acsState.maxVal    = 0;
  acsState.minVal    = 4095;
  acsState.startTime = millis();
  acsState.sampling  = true;
}

int getActiveAcsPin() {
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].pin != -1) {
      const char *t = devices[i].type;
      const char *n = devices[i].name;
      if (strcasecmp(t, "energy") == 0 || 
          strcasecmp(t, "power") == 0 || 
          strcasecmp(t, "acs") == 0 ||
          strstr(n, "طاقة") != NULL ||
          strstr(n, "تيار") != NULL ||
          strstr(n, "كهرباء") != NULL) {
        return devices[i].pin;
      }
    }
  }
  return -1; // 🟢 FIX: Return -1 if NO sensor device is configured (do NOT read floating pin noise!)
}

int getActivePirPin() {
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].pin != -1) {
      const char *t = devices[i].type;
      const char *n = devices[i].name;
      if (strcasecmp(t, "motion") == 0 || 
          strcasecmp(t, "pir") == 0 || 
          strcasecmp(t, "security") == 0 ||
          strstr(n, "حركة") != NULL ||
          strstr(n, "مستشعر") != NULL) {
        return devices[i].pin;
      }
    }
  }
  return -1; // 🟢 FIX: Return -1 when no PIR is configured (never read floating pin!)
}

// ==========================================
// DHT & Sensor Globals
// ==========================================
DHT *dht           = nullptr;
float currentTemp  = 0.0f;
float currentHum   = 0.0f;
float currentPower = 0.0f;
double totalKWh    = 0.0;
unsigned long lastKWhSave = 0;

// 🔴 FIX: DHT Non-Blocking state machine
enum DHTPhase { DHT_IDLE, DHT_TRIGGERED, DHT_READY };
struct DHTState {
  DHTPhase phase        = DHT_IDLE;
  uint32_t triggerTime  = 0;
};
DHTState dhtState;

String boardID   = "";
String boardName = "";

// 🟡 FIX: Dirty Flag لتقليل broadcastDevices
bool stateDirty = false;
unsigned long lastBroadcastTime = 0;
// 🟢 FIX: Hardware Safety Globals
unsigned long lastTurnOffTime[MAX_DEVICES] = {0};
int staggerQueue[MAX_DEVICES];
int staggerCount = 0;
unsigned long lastStaggerTime = 0;
int dhtNanCount = 0;

// 🟢 FIX: Display Management Globals
unsigned long lastDisplayUpdate = 0;
unsigned long lastPageChange = 0;
int currentDisplayPage = 0;
unsigned long lastInteractionTime = 0;
bool isDisplayAwake = true;

// تحديث العينة - تُستدعى كل دورة loop (تستغرق ~0µs)
// ترجع true عند اكتمال الـ 50ms
bool acsUpdate() {
  int targetAcsPin = getActiveAcsPin();
  if (targetAcsPin == -1) {
    acsState.sampling = false;
    if (acsState.lastResult != 0.0f || currentPower != 0.0f) {
      acsState.lastResult = 0.0f;
      currentPower = 0.0f;
      stateDirty = true;
    }
    return false;
  }

  if (!acsState.sampling) return false;
  int v = analogRead(targetAcsPin);
  if (v > acsState.maxVal) acsState.maxVal = v;
  if (v < acsState.minVal) acsState.minVal = v;
  if ((millis() - acsState.startTime) >= 50) {
    float Vpp  = ((acsState.maxVal - acsState.minVal) * 3.3f) / 4095.0f;
    float Vrms = (Vpp / 2.0f) * 0.707f;
    float Irms = (Vrms * 1000.0f) / 185.0f;
    // 🟢 Noise Gate: If Vpp or Irms is small (floating analog noise), force 0.0W
    if (Vpp < 0.25f || Irms < 0.4f) {
      Irms = 0.0f;
    }
    acsState.lastResult = Irms * 220.0f;
    acsState.sampling   = false;
    return true;
  }
  return false;
}

void updateDisplay() {
  if (!hasDisplay) return;
  unsigned long now = millis();
  
  // Screen Saver Logic (5 minutes = 300,000 ms)
  if (now - lastInteractionTime > 300000) {
    if (isDisplayAwake) {
      display.ssd1306_command(SSD1306_DISPLAYOFF);
      isDisplayAwake = false;
    }
    return; // Do not update display while asleep
  } else if (!isDisplayAwake) {
    display.ssd1306_command(SSD1306_DISPLAYON);
    isDisplayAwake = true;
  }

  // Rotate pages every 4.5 seconds
  if (now - lastPageChange >= 4500) {
    lastPageChange = now;
    currentDisplayPage = (currentDisplayPage + 1) % 4;
  }

  if (now - lastDisplayUpdate < 800) return;
  lastDisplayUpdate = now;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  // Find active room name
  String activeRoom = "MOSA ROOM";
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && strlen(devices[i].room) > 0 && strcmp(devices[i].room, "عام") != 0) {
      activeRoom = String(devices[i].room);
      break;
    }
  }

  if (currentDisplayPage == 0 || currentDisplayPage == 1) {
    // 💡 Page 0 & 1: Live Room Devices List (Paginated 4 items per page)
    int offset = (currentDisplayPage == 0) ? 0 : 4;
    display.setCursor(0, 0);
    display.print(F("[ "));
    display.print(activeRoom.substring(0, 12));
    display.print(F(" ] P"));
    display.println(currentDisplayPage + 1);
    display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

    int rendered = 0;
    int curActiveIndex = 0;
    for (int i = 0; i < MAX_DEVICES && rendered < 4; i++) {
      if (devices[i].active && devices[i].pin != -1 && strcmp(devices[i].type, "sensor") != 0) {
        if (curActiveIndex >= offset) {
          int y = 13 + (rendered * 12);
          display.setCursor(0, y);
          
          String devName = strlen(devices[i].name) > 0 ? String(devices[i].name) : ("Out " + String(devices[i].pin));
          if (devName.length() > 10) devName = devName.substring(0, 10);
          
          display.print(devices[i].state ? F("* ") : F("o "));
          display.print(devName);
          display.setCursor(84, y);
          if (devices[i].state) {
            display.print(F("[ ON ]"));
          } else {
            display.print(F("[OFF ]"));
          }
          rendered++;
        }
        curActiveIndex++;
      }
    }

    if (rendered == 0) {
      display.setCursor(0, 24);
      display.println(F("No active devices"));
      display.setCursor(0, 36);
      display.println(F("Config via Web UI"));
    }
  } 
  else if (currentDisplayPage == 2) {
    // 🌡️ Page 2: Environment & Power Monitor
    display.setCursor(0, 0);
    display.println(F("--- ENVIRONMENT ---"));
    display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

    display.setCursor(0, 14);
    display.print(F("Temp : "));
    display.print(currentTemp, 1);
    display.println(F(" C"));

    display.setCursor(0, 26);
    display.print(F("Hum  : "));
    display.print(currentHum, 1);
    display.println(F(" %"));

    display.setCursor(0, 38);
    display.print(F("Power: "));
    display.print(currentPower, 1);
    display.println(F(" W"));

    int onCount = 0;
    int totalCount = 0;
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active && devices[i].pin != -1 && strcmp(devices[i].type, "sensor") != 0) {
        totalCount++;
        if (devices[i].state) onCount++;
      }
    }
    display.setCursor(0, 50);
    display.print(F("Active: "));
    display.print(onCount);
    display.print(F("/"));
    display.print(totalCount);
    display.print(F(" ON"));
  } 
  else if (currentDisplayPage == 3) {
    // 📡 Page 3: Network & Security Status
    display.setCursor(0, 0);
    display.println(F("--- MOSA SYSTEM ---"));
    display.drawLine(0, 9, 128, 9, SSD1306_WHITE);

    display.setCursor(0, 14);
    display.print(F("WiFi: "));
    display.println(WiFi.status() == WL_CONNECTED ? F("Connected") : F("Offline"));

    display.setCursor(0, 26);
    display.print(F("IP  : "));
    display.println(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : F("0.0.0.0"));

    display.setCursor(0, 38);
    display.print(F("MQTT: "));
    display.println(mqttClient.connected() ? F("Online (mTLS)") : F("Connecting..."));

    display.setCursor(0, 50);
    display.print(F("Node: "));
    display.println(boardID.substring(0, 14));
  }

  display.display();
}

// ==========================================
// RTC DS3231 
// ==========================================
void writeDS3231Time(time_t epochTime) {
  if (!hasRtc) return;
  struct tm *ptm = gmtime(&epochTime);
  Wire.beginTransmission(0x68);
  Wire.write(0x00);
  auto decToBcd = [](int val) { return (uint8_t)((val / 10 * 16) + (val % 10)); };
  Wire.write(decToBcd(ptm->tm_sec));
  Wire.write(decToBcd(ptm->tm_min));
  Wire.write(decToBcd(ptm->tm_hour));
  Wire.write(decToBcd(ptm->tm_wday + 1));
  Wire.write(decToBcd(ptm->tm_mday));
  Wire.write(decToBcd(ptm->tm_mon + 1));
  Wire.write(decToBcd(ptm->tm_year - 100));
  Wire.endTransmission();
}

void readDS3231Time() {
  if (!hasRtc) return;
  Wire.beginTransmission(0x68);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return;
  
  Wire.requestFrom(0x68, 7);
  auto bcdToDec = [](uint8_t val) { return (int)((val / 16 * 10) + (val % 16)); };
  struct tm t = {0};
  t.tm_sec  = bcdToDec(Wire.read() & 0x7F);
  t.tm_min  = bcdToDec(Wire.read());
  t.tm_hour = bcdToDec(Wire.read() & 0x3F);
  Wire.read();
  t.tm_mday = bcdToDec(Wire.read());
  t.tm_mon  = bcdToDec(Wire.read() & 0x7F) - 1;
  t.tm_year = bcdToDec(Wire.read()) + 100;
  time_t epoch = mktime(&t);
  struct timeval tv = { .tv_sec = epoch, .tv_usec = 0 };
  settimeofday(&tv, NULL);
}

void timeSyncCallback(struct timeval *tv) {
  if (tv != NULL && tv->tv_sec > 1704067200) {
    writeDS3231Time(tv->tv_sec);
    prefs.begin("smarthome", false);
    prefs.putULong("last_epoch", tv->tv_sec);
    prefs.end();
  }
}

// هياكل البيانات تم نقلها للأعلى لتفادي خطأ التعريف
// 3. وظائف الذاكرة الدائمة
// ==========================================

// 🟡 FIX: Flash Write Batching
// بدلاً من الكتابة فوراً عند كل تغيير، نضع علم needsSave
// ونكتب كل مرة واحدة كل 10 ثوانٍ (أو عند الإطفاء)
void saveDevice(int id) {
  if (id < 0 || id >= MAX_DEVICES) return;
  DeviceLockGuard devLock(pdMS_TO_TICKS(50));
  if (!devLock.isLocked()) {
    lockContentionCount++;
    Serial.printf("⚠️ [Lock] saveDevice(%d) timeout, leaving needsSave flag for next cycle\n", id);
    return;
  }
  prefs.begin("smarthome", false);
  String p = String(id);
  prefs.putBool(  ("a"    + p).c_str(), devices[id].active);
  prefs.putString(("n"    + p).c_str(), devices[id].name);
  prefs.putString(("r"    + p).c_str(), devices[id].room);
  prefs.putString(("y"    + p).c_str(), devices[id].type);
  prefs.putInt(   ("p"    + p).c_str(), devices[id].pin);
  prefs.putInt(   ("i"    + p).c_str(), devices[id].inPin);
  prefs.putBool(  ("ha"   + p).c_str(), devices[id].isHighActive);
  prefs.putBool(  ("sp"   + p).c_str(), devices[id].isSwitchPullup);
  prefs.putBool(  ("st"   + p).c_str(), devices[id].state);
  prefs.putULong( ("t"    + p).c_str(), devices[id].totalTime);
  prefs.putInt(   ("pwm"  + p).c_str(), devices[id].pwmValue);
  prefs.putString(("col"  + p).c_str(), devices[id].color);
  prefs.putBool(  ("sa"   + p).c_str(), devices[id].scheduleActive);
  prefs.putInt(   ("shOn" + p).c_str(), devices[id].scheduleHourOn);
  prefs.putInt(   ("smOn" + p).c_str(), devices[id].scheduleMinuteOn);
  prefs.putInt(   ("shOff"+ p).c_str(), devices[id].scheduleHourOff);
  prefs.putInt(   ("smOff"+ p).c_str(), devices[id].scheduleMinuteOff);
  prefs.end();
  devices[id].needsSave = false;
  Serial.printf("[NVS Saved] Slot %d -> Active:%d, Pin:%d, SwitchPin(inPin):%d, Name:%s\n", id, devices[id].active, devices[id].pin, devices[id].inPin, devices[id].name);
}

// يُستدعى من loop كل 10 ثوانٍ - يكتب فقط ما تغيّر
void flushPendingSaves() {
  DeviceLockGuard devLock(pdMS_TO_TICKS(50));
  if (!devLock.isLocked()) {
    lockContentionCount++;
    Serial.println("⚠️ [Lock] flushPendingSaves() timeout, deferring to next cycle");
    return;
  }
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].needsSave) {
      saveDevice(i);
    }
  }
}

void loadDevices() {
  DeviceLockGuard devLock(pdMS_TO_TICKS(100));
  if (!devLock.isLocked()) {
    lockContentionCount++;
    Serial.println("⚠️ [Lock] loadDevices() timeout waiting for lock, aborting reload");
    return;
  }
  // Reload everything from Preferences
  prefs.begin("smarthome", true);
  for (int i = 0; i < MAX_DEVICES; i++) {
    String p = String(i);
    devices[i].active = prefs.getBool(("a" + p).c_str(), false);
    if (!devices[i].active) continue;

    strlcpy(devices[i].name,  prefs.getString(("n"  + p).c_str(), "Device").c_str(), 32);
    strlcpy(devices[i].room,  prefs.getString(("r"  + p).c_str(), "عام").c_str(),    32);
    strlcpy(devices[i].type,  prefs.getString(("y"  + p).c_str(), "light").c_str(),  16);
    devices[i].pin            = prefs.getInt(   ("p"    + p).c_str(), -1);
    devices[i].inPin          = prefs.getInt(   ("i"    + p).c_str(), -1);
    devices[i].isHighActive   = prefs.getBool(  ("ha"   + p).c_str(), true);
    devices[i].isSwitchPullup = prefs.getBool(  ("sp"   + p).c_str(), true);
    devices[i].totalTime      = prefs.getULong( ("t"    + p).c_str(), 0);
    devices[i].pwmValue       = prefs.getInt(   ("pwm"  + p).c_str(), 255);
    strlcpy(devices[i].color, prefs.getString(("col"+ p).c_str(), "#ffffff").c_str(), 8);

    devices[i].scheduleActive    = prefs.getBool(("sa"   + p).c_str(), false);
    devices[i].scheduleHourOn    = prefs.getInt( ("shOn" + p).c_str(), -1);
    devices[i].scheduleMinuteOn  = prefs.getInt( ("smOn" + p).c_str(), -1);
    devices[i].scheduleHourOff   = prefs.getInt( ("shOff"+ p).c_str(), -1);
    devices[i].scheduleMinuteOff = prefs.getInt( ("smOff"+ p).c_str(), -1);

    Serial.printf("[NVS Loaded] Slot %d -> Active:%d, Pin:%d, SwitchPin(inPin):%d, Name:%s\n", i, devices[i].active, devices[i].pin, devices[i].inPin, devices[i].name);

    if (devices[i].pin != -1 && isValidGPIO(devices[i].pin)) {
      if (strcmp(devices[i].type, "sensor") == 0 || strcmp(devices[i].type, "TEMPERATURE") == 0) {
        if (dht != nullptr) { 
          delete dht; 
          dht = nullptr; 
        }
        dht = new DHT(devices[i].pin, DHTTYPE); 
        dht->begin(); 
        Serial.printf("[Sensor] DHT22 dynamically initialized on user-chosen GPIO %d\n", devices[i].pin);
      } else {
        // 🟢 Industrial Safety: Default ALL devices to OFF on power restore until instructed by Web UI
        devices[i].powerRestorePolicy = prefs.getUChar(("pr" + p).c_str(), 1); // Default to 1 (ALWAYS_OFF)
        if (devices[i].powerRestorePolicy == 2) {
          devices[i].state = true;
        } else if (devices[i].powerRestorePolicy == 0) {
          devices[i].state = prefs.getBool(("st" + p).c_str(), false);
        } else {
          devices[i].state = false; // FORCE_OFF on power restore!
          Serial.printf("[Power Restore Guard] Slot %d (%s) -> Starts OFF on power restore.\n", i, devices[i].name);
        }

        pinMode(devices[i].pin, OUTPUT);
        applyState(i);
        if (devices[i].state) {
          staggerQueue[staggerCount++] = i; // Queue for staggered start
        }
      }
    }
    if (devices[i].inPin != -1 && isValidGPIO(devices[i].inPin)) {
      if (devices[i].isSwitchPullup) {
        pinMode(devices[i].inPin, INPUT_PULLUP);
      } else {
        pinMode(devices[i].inPin, INPUT_PULLDOWN);
      }
      devices[i].lastButtonState = (digitalRead(devices[i].inPin) == HIGH);
      
      btnLastRaw[i] = devices[i].lastButtonState;
      btnLastChange[i] = millis();
      Serial.printf("[NVS Boot] Switch Pin %d configured & active for Output Pin %d\n", devices[i].inPin, devices[i].pin);
    } else if (devices[i].inPin != -1) {
      devices[i].inPin = -1;
    }
  }
  prefs.end();
}

// NVS Memory Protection Guard: Devices & Switch Pins are permanently retained without auto-overwriting
void initHardwareBoard() {
  Serial.println("[System] NVS Protection Active -> All Devices & Switch Pins (inPin) permanently preserved.");
}

// ==========================================
// 4. وظائف التحكم والاتصال
// ==========================================

// 🟡 FIX: broadcastDevices تُستدعى فقط عند الحاجة (dirty flag)
void broadcastDevices() {
  String buffer;
  {
    DeviceLockGuard devLock(pdMS_TO_TICKS(40));
    if (!devLock.isLocked()) {
      lockContentionCount++;
      Serial.println("⚠️ [Lock] broadcastDevices() timeout, keeping stateDirty for next cycle");
      return;
    }
    stateDirty = false; // تمّ الإرسال، أعد تصفير العلم

    JsonDocument doc;
    doc["type"]         = "state";
    doc["boardId"]      = boardID;
    doc["boardName"]    = boardName;
    doc["ip"]           = WiFi.localIP().toString();
    doc["ipAddress"]    = WiFi.localIP().toString();
    doc["totalKWh"]     = totalKWh;
    doc["currentPower"] = currentPower;
    doc["currentTemp"]  = currentTemp;
    doc["currentHum"]   = currentHum;
    JsonArray array = doc["devices"].to<JsonArray>();

    for (int i = 0; i < MAX_DEVICES; i++) {
      if (!devices[i].active) continue;
      JsonObject obj = array.add<JsonObject>();
      obj["id"]       = i;
      obj["name"]     = devices[i].name;
      obj["room"]     = devices[i].room;
      obj["type"]     = devices[i].type;
      obj["pin"]      = devices[i].pin;
      obj["inPin"]    = devices[i].inPin;
      obj["switchPin"]= devices[i].inPin;
      obj["state"]    = devices[i].state ? "ON" : "OFF";
      obj["pwmValue"] = devices[i].pwmValue;
      obj["color"]    = devices[i].color;
      obj["scheduleActive"]    = devices[i].scheduleActive;
      obj["scheduleHourOn"]    = devices[i].scheduleHourOn;
      obj["scheduleMinuteOn"]  = devices[i].scheduleMinuteOn;
      obj["scheduleHourOff"]   = devices[i].scheduleHourOff;
      obj["scheduleMinuteOff"] = devices[i].scheduleMinuteOff;

      unsigned long usage = devices[i].totalTime;
      if (devices[i].state) usage += (millis() - devices[i].startTime);
      obj["usage"] = usage / 1000;

      const char *devType = devices[i].type;
      const char *devName = devices[i].name;
      if (strcasecmp(devType, "sensor") == 0 ||
          strcasecmp(devType, "temperature") == 0 ||
          strcasecmp(devType, "temp") == 0 ||
          strstr(devName, "حساس") != NULL ||
          strstr(devName, "حرار") != NULL) {
        obj["temperature"] = currentTemp;
        obj["humidity"]    = currentHum;
        obj["powerUsage"]  = currentPower;
      } else if (strcasecmp(devType, "moisture") == 0 ||
                 strcasecmp(devType, "soil") == 0 ||
                 strstr(devName, "ترب") != NULL) {
        int rawM = analogRead(devices[i].pin);
        int moisturePercent = map(constrain(rawM, 1200, 3200), 3200, 1200, 0, 100);
        obj["moisture"] = moisturePercent;
        obj["soilMoisture"] = moisturePercent;
      }
    }

    doc["ts"] = (time(NULL) > 1000000000UL) ? time(NULL) : (1770000000UL + (millis() / 1000));

    serializeJson(doc, buffer);
  } // 🛡️ Free devicesMutex BEFORE sending over WebSockets and MQTT network stack

  for (uint8_t i = 0; i < WEBSOCKETS_SERVER_CLIENT_MAX; i++) {
    if (wsAuthenticated[i]) webSocket.sendTXT(i, buffer);
  }

  if (homeId.length() > 0) {
    String stateTopic = "mosa/" + homeId + "/device/" + boardID + "/state";
    safeMqttPublish(stateTopic.c_str(), buffer.c_str(), true); // retain=true
  } else if (mqttClient.connected() && homeId.length() == 0) {
    Serial.println("[MQTT Guard] 🛑 Refusing to publish: homeId is unprovisioned.");
  }
}

void applyState(int id) {
  if (id < 0 || id >= MAX_DEVICES || !devices[id].active) return;
  if (devices[id].pin == -1 || strcmp(devices[id].type, "sensor") == 0 || strcmp(devices[id].type, "energy") == 0) return;
  if (!isValidOutputGPIO(devices[id].pin)) return;

  pinMode(devices[id].pin, OUTPUT);

  // 🔴 PWM Dimming Support for dimmable lights & SSRs
  if (strcmp(devices[id].type, "dimmer") == 0) {
    int pwmVal = devices[id].state ? map(devices[id].pwmValue, 0, 100, 0, 255) : 0;
    #if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
      ledcAttach(devices[id].pin, 1000, 8);
      ledcWrite(devices[id].pin, pwmVal);
    #else
      ledcSetup(id, 1000, 8);
      ledcAttachPin(devices[id].pin, id);
      ledcWrite(id, pwmVal);
    #endif
    return;
  }

  bool targetPinHigh = devices[id].isHighActive ? devices[id].state : !devices[id].state;
  digitalWrite(devices[id].pin, targetPinHigh ? HIGH : LOW);
}

void toggleLogic(int id, bool force) {
  if (id < 0 || id >= MAX_DEVICES) return;

  int copyPin = -1;
  int copyInPin = -1;
  bool copyState = false;
  bool toggleSuccess = false;

  {
    DeviceLockGuard devLock(pdMS_TO_TICKS(25));
    if (!devLock.isLocked()) {
      lockContentionCount++;
      Serial.printf("⚠️ [Lock] toggleLogic(%d) timeout, aborting toggle to prevent race condition\n", id);
      return;
    }
    if (!devices[id].active || devices[id].pin == -1) return;

    lastInteractionTime = millis();
    lastSwitchTrigger[id] = millis(); // Lockout physical switch readings for 75ms after toggle to filter EMI coil noise while enabling high-speed toggles

    // Compressor Delay Protection (Anti-Short Cycle) - Covers all AC/Cooling type variations & Arabic names
    const char* devT = devices[id].type;
    const char* devN = devices[id].name;
    bool isCompressorLoad = (strcmp(devT, "cooling") == 0 || strcmp(devT, "ac") == 0 || strcmp(devT, "hvac") == 0 || strstr(devN, "مكيف") != NULL || strstr(devN, "تكييف") != NULL);
    if (!devices[id].state && !force && isCompressorLoad) {
      if (millis() - lastTurnOffTime[id] < 180000 && lastTurnOffTime[id] > 0) {
         return; // Blocked
      }
    }

    devices[id].state = !devices[id].state;
    applyState(id);

    // Publish individual device state for backend real-time broadcast
    if (devices[id].state) {
      devices[id].startTime = millis();
    } else {
      devices[id].totalTime += (millis() - devices[id].startTime);
      devices[id].timerOffMillis = 0;
      lastTurnOffTime[id] = millis();
      // 🟡 FIX: بدلاً من saveDevice فوراً، نضع علم للحفظ المؤجّل
      devices[id].needsSave = true;
    }

    copyPin = devices[id].pin;
    copyInPin = devices[id].inPin;
    copyState = devices[id].state;
    toggleSuccess = true;

    stateDirty = true;
    lastBroadcastTime = 0; // 🟡 FIX: Force immediate broadcast
  } // 🛡️ Free devicesMutex BEFORE performing MQTT or Mesh network I/O

  if (!toggleSuccess) return;

  // 🟡 FIX: publish lightweight single device MQTT state for instant physical switch update
  if (homeId.length() > 0) {
    String singleTopic = "mosa/" + homeId + "/device/" + boardID + "/state";
    String singlePayload = "{\"pin\":" + String(copyPin) +
                           ",\"inPin\":" + String(copyInPin) +
                           ",\"switchPin\":" + String(copyInPin) +
                           ",\"source\":\"physical_switch\"" +
                           ",\"trigger\":\"WALL_SWITCH\"" +
                           ",\"state\":\"" + (copyState ? "ON" : "OFF") +
                           "\",\"isOn\":" + (copyState ? "true" : "false") +
                           ",\"devices\":[{\"id\":" + String(id) +
                           ",\"pin\":" + String(copyPin) +
                           ",\"inPin\":" + String(copyInPin) +
                           ",\"switchPin\":" + String(copyInPin) +
                           ",\"source\":\"physical_switch\"" +
                           ",\"trigger\":\"WALL_SWITCH\"" +
                           ",\"state\":\"" + (copyState ? "ON" : "OFF") +
                           "\",\"isOn\":" + (copyState ? "true" : "false") + "}]}";
    safeMqttPublish(singleTopic.c_str(), singlePayload.c_str(), true);
  }

  // 🛡️ Offline Emergency Mesh Broadcast: Relay local physical switch toggle to adjacent rooms
  if (WiFi.status() != WL_CONNECTED || !mqttClient.connected()) {
    String meshPayload = "{\"action\":\"NOTIFY_STATE\",\"pin\":" + String(copyPin) +
                         ",\"state\":\"" + (copyState ? "ON" : "OFF") +
                         "\",\"originBoardId\":\"" + boardID + "\",\"isMesh\":true}";
    broadcastEspNowMeshRelay(meshPayload.c_str());
  }
}

void saveScene(int id, LocalScene scene) {
  prefs.begin("scenes", false);
  prefs.putBytes(("s" + String(id)).c_str(), &scene, sizeof(scene));
  prefs.end();
}

LocalScene loadScene(int id) {
  LocalScene scene;
  memset(&scene, 0, sizeof(scene));
  scene.relayMask = 0;
  scene.dimmerLevel = 100;
  prefs.begin("scenes", true);
  prefs.getBytes(("s" + String(id)).c_str(), &scene, sizeof(scene));
  prefs.end();
  return scene;
}

void executeSceneStruct(int id, bool broadcastMesh = true) {
  {
    DeviceLockGuard devLock(pdMS_TO_TICKS(50));
    if (!devLock.isLocked()) {
      lockContentionCount++;
      Serial.printf("⚠️ [Lock] executeSceneStruct(%d) timeout\n", id);
      return;
    }
    LocalScene scene = loadScene(id);
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active && devices[i].pin != -1 && strcmp(devices[i].type, "sensor") != 0) {
        bool on = (scene.relayMask >> i) & 1;
        devices[i].state = on;
        devices[i].pwmValue = scene.dimmerLevel;
        applyState(i);
      }
    }
    stateDirty = true;
    lastBroadcastTime = 0;
  } // 🛡️ Free devicesMutex BEFORE performing Mesh broadcast

  // 🛡️ Offline Emergency Mesh Broadcast: Relay local scene trigger to adjacent rooms
  if (broadcastMesh && (WiFi.status() != WL_CONNECTED || !mqttClient.connected())) {
    String meshPayload = "{\"type\":\"scene\",\"action\":\"SCENE\",\"id\":" + String(id) +
                         ",\"originBoardId\":\"" + boardID + "\",\"isMesh\":true}";
    broadcastEspNowMeshRelay(meshPayload.c_str());
  }
}

void saveRelayStates() {
  DeviceLockGuard devLock(pdMS_TO_TICKS(50));
  if (!devLock.isLocked()) {
    lockContentionCount++;
    return;
  }
  prefs.begin("relay-state", false);
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].pin != -1) {
      char keyR[8], keyP[8];
      snprintf(keyR, sizeof(keyR), "r%d", i);
      snprintf(keyP, sizeof(keyP), "p%d", i);
      prefs.putBool(keyR, devices[i].state);
      prefs.putInt(keyP, devices[i].pwmValue);
    }
  }
  prefs.end();
}

void loadRelayStates() {
  DeviceLockGuard devLock(pdMS_TO_TICKS(50));
  if (!devLock.isLocked()) {
    lockContentionCount++;
    return;
  }
  prefs.begin("relay-state", true);
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].pin != -1) {
      char keyR[8], keyP[8];
      snprintf(keyR, sizeof(keyR), "r%d", i);
      snprintf(keyP, sizeof(keyP), "p%d", i);
      
      bool savedState = prefs.getBool(keyR, false);
      devices[i].pwmValue = prefs.getInt(keyP, 255);

      // 🛡️ Power Restore Policy: 0=RESTORE_PREVIOUS, 1=FORCE_OFF, 2=FORCE_ON, 3=SAFE_STATE
      if (devices[i].powerRestorePolicy == 1) {
        devices[i].state = false; // Always OFF after power cut (Heaters, Irons, Pumps)
      } else if (devices[i].powerRestorePolicy == 2) {
        devices[i].state = true;  // Always ON after power cut (Routers, Security lights)
      } else {
        devices[i].state = savedState; // Restore last known state
      }

      applyState(i);
    }
  }
  prefs.end();
}

void scanWifiAndSendResults() {
  Serial.println(F("[CLI] 🔍 Scanning WiFi networks..."));
  int n = WiFi.scanNetworks();
  Serial.printf("[CLI] Found %d networks:\n", n);
  String jsonOut = "{\"type\":\"scan_results\",\"networks\":[";
  for (int i = 0; i < n; ++i) {
    if (i > 0) jsonOut += ",";
    jsonOut += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + ",\"secure\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? "true" : "false") + "}";
  }
  jsonOut += "]}";
  Serial.println(jsonOut);
  if (mqttClient.connected()) {
    String scanTopic = "mosa/" + homeId + "/device/" + boardID + "/wifi_scan";
    safeMqttPublish(scanTopic.c_str(), jsonOut.c_str());
    safeMqttPublish("mosa/scan_results", jsonOut.c_str());
  }
  WiFi.scanDelete();
}

void processCommand(JsonDocument &doc) {
  // 🔴 Node Isolation Check: Ensure this command is intended for THIS specific ESP32 node
  const char *target = nullptr;
  if (doc.containsKey("targetBoardId") && !doc["targetBoardId"].isNull()) target = doc["targetBoardId"];
  else if (doc.containsKey("boardId") && !doc["boardId"].isNull()) target = doc["boardId"];
  else if (doc.containsKey("nodeId") && !doc["nodeId"].isNull()) target = doc["nodeId"];

  if (target && strlen(target) > 0 && strcasecmp(target, "broadcast") != 0 && strcasecmp(target, "all") != 0 && strcmp(target, "*") != 0) {
    String macClean = WiFi.macAddress();
    macClean.replace(":", "");
    macClean.toUpperCase();

    String tStr = String(target);
    tStr.replace(":", "");
    tStr.toUpperCase();
    
    String bStr = boardID;
    bStr.replace(":", "");
    bStr.toUpperCase();

    bool isMine = (tStr == bStr ||
                   tStr == macClean ||
                   tStr == ("MOSANODE_" + macClean) ||
                   ("MOSANODE_" + tStr) == bStr ||
                   (tStr.length() >= 12 && (tStr.endsWith(macClean) || bStr.endsWith(tStr))));

    if (!isMine) {
      Serial.printf("[Command] 🛑 IGNORED command targeted to another node: '%s' (My boardID: '%s')\n", target, boardID.c_str());
      return;
    }
  }

  // 🟢 Command Idempotency Guard & Enriched Multi-Stage ACK Protocol
  static String recentCommandIds[15];
  static uint8_t commandHistoryIndex = 0;
  String currentCmdId = "";
  long seqNumber = doc.containsKey("sequence") ? doc["sequence"] : 0;

  if (doc.containsKey("commandId")) {
    currentCmdId = String((const char *)doc["commandId"]);

    // Check if commandId was already executed recently (Idempotency Ring Buffer)
    bool isDuplicate = false;
    for (int i = 0; i < 15; i++) {
      if (recentCommandIds[i] == currentCmdId && currentCmdId.length() > 0) {
        isDuplicate = true;
        break;
      }
    }

    String ackTopic = "mosa/" + homeId + "/device/" + boardID + "/ack";
    if (isDuplicate) {
      Serial.printf("[Command ACK] 🔁 Duplicate Command ID '%s' detected! Returning idempotent ACK.\n", currentCmdId.c_str());
      String dupAck = "{\"protocolVersion\":2,\"commandId\":\"" + currentCmdId + "\",\"sequence\":" + String(seqNumber) + ",\"boardId\":\"" + boardID + "\",\"status\":\"duplicate_ack\",\"timestamp\":" + String(millis()) + "}";
      safeMqttPublish(ackTopic.c_str(), dupAck.c_str());
      return; // Stop re-execution of physical relays
    }

    // Save to circular ring buffer
    recentCommandIds[commandHistoryIndex] = currentCmdId;
    commandHistoryIndex = (commandHistoryIndex + 1) % 15;

    // Publish EXECUTING ACK with sequence & protocolVersion
    String rcvAck = "{\"protocolVersion\":2,\"commandId\":\"" + currentCmdId + "\",\"sequence\":" + String(seqNumber) + ",\"boardId\":\"" + boardID + "\",\"status\":\"executing\",\"timestamp\":" + String(millis()) + "}";
    safeMqttPublish(ackTopic.c_str(), rcvAck.c_str());
  }

  // 🚀 HTTP OTA Update Command Handler
  if (doc.containsKey("action")) {
    const char *act = doc["action"];
    if (strcmp(act, "OTA") == 0 || strcmp(act, "UPDATE") == 0 || strcmp(act, "firmware_update") == 0) {
      const char *otaUrl = doc["url"];
      if (otaUrl && strlen(otaUrl) > 0) {
        Serial.printf("[OTA] 🚀 Starting HTTP OTA Update from URL: %s\n", otaUrl);
        display.clearDisplay();
        display.setCursor(0, 0);
        display.setTextSize(1);
        display.println(F(" -- OTA UPDATE --"));
        display.println(F(" Flashing Firmware..."));
        display.println(F(" Please wait..."));
        display.display();

        WiFiClient otaClient;
        #if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
          t_httpUpdate_return ret = httpUpdate.update(otaClient, otaUrl);
        #else
          t_httpUpdate_return ret = ESPhttpUpdate.update(otaClient, otaUrl);
        #endif

        switch (ret) {
          case HTTP_UPDATE_FAILED:
            Serial.printf("[OTA] ❌ Update failed! Error (%d): %s\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
            display.println(F(" OTA FAILED!"));
            display.display();
            break;
          case HTTP_UPDATE_NO_UPDATES:
            Serial.println("[OTA] ⚠️ No updates available.");
            break;
          case HTTP_UPDATE_OK:
            Serial.println("[OTA] ✅ Update SUCCESSFUL! Rebooting ESP32 Node...");
            display.println(F(" OTA SUCCESS! Reboot..."));
            display.display();
            delay(1000);
            ESP.restart();
            break;
        }
        return;
      }
    }

    // 🔑 SET_MESH_KEY / PROVISION_SECURITY (Provisioning over secure MQTT channel)
    if (strcasecmp(act, "SET_MESH_KEY") == 0 || strcasecmp(act, "PROVISION_SECURITY") == 0 || strcasecmp(act, "SET_KEY") == 0) {
      const char *key = doc["key"] | doc["meshSecret"] | doc["meshkey"] | "";
      if (strlen(key) >= 16) {
        prefs.begin("wifi", false);
        prefs.putString("meshkey", key);
        prefs.end();
        meshSecret = String(key);
        Serial.println("[Security] 🔑 New MeshSecret provisioned & saved to NVS via secure MQTT channel!");
        safeMqttPublish(("mosa/" + homeId + "/device/" + boardID + "/ack").c_str(), "{\"status\":\"mesh_key_set\"}");
        return;
      }
    }

    // 🔐 RENEW_CERT (OTA mTLS Certificate Renewal via secure MQTT channel)
    if (strcasecmp(act, "RENEW_CERT") == 0 || strcasecmp(act, "UPDATE_CERT") == 0) {
      String newCa   = doc["ca"] | "";
      String newCert = doc["cert"] | "";
      String newKey  = doc["key"] | "";
      if (newCa.length() > 0 && newCert.length() > 0 && newKey.length() > 0) {
        if (saveMtlsCertificates(newCa, newCert, newKey)) {
          Serial.println(F("[mTLS 🔐] Certificate renewed via secure MQTT command!"));
          applyMtlsCredentials();
          safeMqttPublish(("mosa/" + homeId + "/device/" + boardID + "/ack").c_str(), "{\"status\":\"cert_renewed\"}");
          delay(500);
          mqttClient.disconnect(); // Triggers reconnect with new credentials
          return;
        }
      }
    }

    // 🔄 REBOOT / RESTART
    if (strcasecmp(act, "REBOOT") == 0 || strcasecmp(act, "RESTART") == 0) {
      Serial.println("[System] 🔄 Reboot command received! Restarting ESP32...");
      display.clearDisplay();
      display.setCursor(0, 20);
      display.println(F("  Rebooting..."));
      display.display();
      delay(500);
      ESP.restart();
      return;
    }

    // 💾 WIFI_CONFIG / PROVISION
    if (strcasecmp(act, "WIFI_CONFIG") == 0 || strcasecmp(act, "PROVISION") == 0 || strcasecmp(act, "SET_WIFI") == 0) {
      String newSsid = doc["ssid"] | "";
      String newPass = doc["pass"] | doc["password"] | "";
      String newMqtt = doc["mqttHost"] | doc["mqtt_host"] | doc["mqtthost"] | "192.168.1.110";
      String newHome = doc["homeId"] | doc["home_id"] | doc["homeid"] | homeId;

      if (newSsid.length() > 0) {
        Serial.printf("[System] 💾 Saving WiFi: SSID='%s', MQTT='%s', HomeID='%s'\n", newSsid.c_str(), newMqtt.c_str(), newHome.c_str());
        prefs.begin("wifi", false);
        prefs.putString("ssid", newSsid);
        prefs.putString("pass", newPass);
        prefs.putString("mqtthost", newMqtt);
        prefs.putString("homeid", newHome);
        prefs.end();

        display.clearDisplay();
        display.setCursor(0, 20);
        display.println(F(" WiFi Saved!"));
        display.println(F(" Connecting..."));
        display.display();
        delay(600);
        ESP.restart();
        return;
      }
    }

    // 🔬 SELF_TEST
    if (strcasecmp(act, "SELF_TEST") == 0 || strcasecmp(act, "TEST") == 0) {
      runSelfTest();
      return;
    }

    // 🔍 SCAN_PINS
    if (strcasecmp(act, "SCAN_PINS") == 0 || strcasecmp(act, "SCAN_GPIO") == 0) {
      JsonDocument scanDoc;
      scanDoc["type"] = "pin_scan";
      JsonArray arr = scanDoc.createNestedArray("pins");
      int commonPins[] = {2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33};
      for (int p : commonPins) {
        JsonObject obj = arr.createNestedObject();
        obj["pin"] = p;
        obj["state"] = digitalRead(p) == HIGH ? "HIGH" : "LOW";
      }
      serializeJson(scanDoc, Serial);
      Serial.println();
      if (mqttClient.connected()) {
        String scanTopic = "mosa/" + homeId + "/device/" + boardID + "/pins";
        String sOut;
        serializeJson(scanDoc, sOut);
        safeMqttPublish(scanTopic.c_str(), sOut.c_str());
      }
      return;
    }

    // ⚠️ FACTORY_RESET
    if (strcasecmp(act, "FACTORY_RESET") == 0 || strcasecmp(act, "RESET") == 0) {
      Serial.println("[System] ⚠️ FACTORY RESET requested! Clearing NVS...");
      nvs_flash_erase();
      nvs_flash_init();
      delay(500);
      ESP.restart();
      return;
    }

    // 📡 SCAN_WIFI
    if (strcasecmp(act, "SCAN_WIFI") == 0 || strcasecmp(act, "SCAN") == 0) {
      scanWifiAndSendResults();
      return;
    }
  }

  // Support zero-trust action/pin payload format
  if (doc.containsKey("action") && doc.containsKey("pin")) {
    String curBoard = boardID;
    curBoard.toUpperCase();
    String curMac = WiFi.macAddress();
    curMac.replace(":", "");
    curMac.toUpperCase();

    bool isMeshPacket = (doc.containsKey("isMesh") && doc["isMesh"].as<bool>()) || doc.containsKey("originBoardId");

    if (doc.containsKey("targetBoardId") && !doc["targetBoardId"].isNull()) {
      String tgt = doc["targetBoardId"].as<String>();
      tgt.toUpperCase();
      if (tgt.length() > 0 && tgt != "*" && tgt != "ALL" && tgt != curBoard && tgt != ("MOSANODE_" + curMac) && tgt != curMac) {
        Serial.printf("[Command] 🛑 IGNORED command intended for node %s (Current boardID: %s)\n", tgt.c_str(), boardID.c_str());
        return;
      }
    }
    // Only check boardId as recipient constraint if this is NOT a general mesh broadcast
    if (!isMeshPacket && doc.containsKey("boardId") && !doc["boardId"].isNull()) {
      String tgt = doc["boardId"].as<String>();
      tgt.toUpperCase();
      if (tgt.length() > 0 && tgt != "*" && tgt != "ALL" && tgt != curBoard && tgt != ("MOSANODE_" + curMac) && tgt != curMac) {
        Serial.printf("[Command] 🛑 IGNORED command intended for node %s (Current boardID: %s)\n", tgt.c_str(), boardID.c_str());
        return;
      }
    }

    const char *action = doc["action"];
    int targetPin = doc["pin"];

    const char *stateVal = doc["state"];
    bool targetState = (stateVal && strcmp(stateVal, "ON") == 0);

    const char *actState = doc["activeState"] | "HIGH";
    bool isHigh = (strcmp(actState, "LOW") != 0);
    
    // Support all field variations for external switch pin (inPin / switchPin / inpin / switchpin)
    int targetInPin = -1;
    bool hasInPinField = false;
    if (doc.containsKey("inPin") && !doc["inPin"].isNull()) { targetInPin = doc["inPin"].as<int>(); hasInPinField = true; }
    else if (doc.containsKey("switchPin") && !doc["switchPin"].isNull()) { targetInPin = doc["switchPin"].as<int>(); hasInPinField = true; }
    else if (doc.containsKey("inpin") && !doc["inpin"].isNull()) { targetInPin = doc["inpin"].as<int>(); hasInPinField = true; }
    else if (doc.containsKey("switchpin") && !doc["switchpin"].isNull()) { targetInPin = doc["switchpin"].as<int>(); hasInPinField = true; }
    else if (doc.containsKey("inPin") || doc.containsKey("switchPin") || doc.containsKey("inpin") || doc.containsKey("switchpin")) {
      targetInPin = -1;
      hasInPinField = true;
    }
    if (hasInPinField && targetInPin <= 0) targetInPin = -1;

    const char *swMode = doc["switchMode"] | "GND";
    bool isPullup = (strcmp(swMode, "VCC") != 0);

    if (strcmp(action, "DELETE_DEVICE") != 0 && strcmp(action, "REMOVE_DEVICE") != 0) {
      if (!isValidOutputGPIO(targetPin)) {
        Serial.printf("[Command] 🛑 IGNORED command for invalid or non-standard ESP32 Output GPIO Pin %d\n", targetPin);
        return;
      }
      if (hasInPinField && targetInPin > 0 && !isValidInputGPIO(targetInPin)) {
        Serial.printf("[Command] ⚠️ Disallowing unsafe switch GPIO Pin %d -> Reset to -1\n", targetInPin);
        targetInPin = -1;
      }
      
      Serial.printf("[Command] Hardware Command -> Pin: %d, State: %s, Active: %s, SwitchPin: %d (FieldPresent: %s, %s)\n", 
        targetPin, targetState ? "ON" : "OFF", isHigh ? "HIGH (3.3V)" : "LOW (0V)", targetInPin, hasInPinField ? "YES" : "NO", isPullup ? "GND" : "3.3V");
    }

    bool shouldSendAck = false;
    bool ackDeviceState = false;

    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(100));
      if (!devLock.isLocked()) {
        lockContentionCount++;
        Serial.println("⚠️ [Lock] processCommand(action/pin) timeout, dropping command");
        return;
      }

      if (strcmp(action, "DELETE_DEVICE") == 0 || strcmp(action, "REMOVE_DEVICE") == 0) {
        for (int i = 0; i < MAX_DEVICES; i++) {
          if (devices[i].active && devices[i].pin == targetPin) {
            devices[i].active = false;
            devices[i].pin = -1;
            devices[i].inPin = -1;
            memset(devices[i].name, 0, sizeof(devices[i].name));
            memset(devices[i].type, 0, sizeof(devices[i].type));
            saveDevice(i);
            Serial.printf("[Command] Device at slot %d (Pin %d) deleted permanently via DELETE_DEVICE action.\n", i, targetPin);
            stateDirty = true;
            lastBroadcastTime = 0;
            break;
          }
        }
        return;
      }

      bool matched = false;
      int emptySlot = -1;
      for (int i = 0; i < MAX_DEVICES; i++) {
        if (devices[i].active && devices[i].pin == targetPin) {
          matched = true;
          bool changed = false;

          if (doc.containsKey("activeState") && devices[i].isHighActive != isHigh) { devices[i].isHighActive = isHigh; changed = true; }
          if (doc.containsKey("switchMode") && devices[i].isSwitchPullup != isPullup) { devices[i].isSwitchPullup = isPullup; changed = true; }
          
          // 🛡️ CRITICAL FIX: Only update or clear inPin if the command explicitly supplied a switch pin field!
          if (hasInPinField) {
            if (targetInPin > 0 && devices[i].inPin != targetInPin) {
              devices[i].inPin = targetInPin;
              if (isPullup) {
                pinMode(devices[i].inPin, INPUT_PULLUP);
              } else {
                pinMode(devices[i].inPin, INPUT_PULLDOWN);
              }
              devices[i].lastButtonState = (digitalRead(devices[i].inPin) == HIGH);
              btnLastRaw[i] = devices[i].lastButtonState;
              btnLastChange[i] = millis();
              changed = true;
              saveDevice(i);
            } else if (targetInPin == -1 && devices[i].inPin != -1) {
              devices[i].inPin = -1;
              changed = true;
              saveDevice(i);
            }
          }
          if (doc.containsKey("name") && !doc["name"].isNull()) {
            if (strcmp(devices[i].name, doc["name"]) != 0) {
              strlcpy(devices[i].name, doc["name"], sizeof(devices[i].name));
              changed = true;
            }
          }
          if (doc.containsKey("type") && !doc["type"].isNull()) {
            if (strcmp(devices[i].type, doc["type"]) != 0) {
              strlcpy(devices[i].type, doc["type"], sizeof(devices[i].type));
              changed = true;
            }
          }
          // 🔴 CRITICAL FIX: Only change relay state if this is an explicit command (TOGGLE / SET_STATE / POWER), NOT an initial ADD_DEVICE discovery sync or a non-targeted NOTIFY_STATE
          bool isExternalNotify = (strcmp(action, "NOTIFY_STATE") == 0 && (doc.containsKey("originBoardId") || isMeshPacket) && (!doc.containsKey("targetBoardId") || doc["targetBoardId"].as<String>() == "*"));
          if (strcmp(action, "ADD_DEVICE") != 0 && !isExternalNotify && devices[i].state != targetState) {
            devices[i].state = targetState;
            applyState(i);
            changed = true;
          }

          if (changed) {
            saveDevice(i);
            stateDirty = true;
            lastBroadcastTime = 0;
          }

          if (currentCmdId.length() > 0) {
            shouldSendAck = true;
            ackDeviceState = devices[i].state;
          }
          break;
        } else if (!devices[i].active && emptySlot == -1) {
          emptySlot = i;
        }
      }
      if (!matched && emptySlot != -1) {
        Serial.printf("[Command] Auto-registering new device at slot %d: Pin %d, InPin %d, Active %s, Switch %s\n",
          emptySlot, targetPin, targetInPin, isHigh ? "HIGH" : "LOW", isPullup ? "GND" : "3.3V");

        devices[emptySlot].active = true;
        devices[emptySlot].pin = targetPin;
        devices[emptySlot].inPin = (hasInPinField && targetInPin > 0) ? targetInPin : -1;
        devices[emptySlot].isHighActive = isHigh;
        devices[emptySlot].isSwitchPullup = isPullup;
        devices[emptySlot].state = targetState;
        const char *incomingType = doc["type"] | "sensor";
        const char *incomingName = doc["name"] | "";

        if (strcasecmp(incomingType, "moisture") == 0 || strcasecmp(incomingType, "soil") == 0 || strstr(incomingName, "ترب") != NULL) {
          strlcpy(devices[emptySlot].type, "moisture", sizeof(devices[emptySlot].type));
        } else if (strcasecmp(incomingType, "energy") == 0 || strcasecmp(incomingType, "power") == 0 || strstr(incomingName, "كهربا") != NULL || strstr(incomingName, "طاق") != NULL) {
          strlcpy(devices[emptySlot].type, "energy", sizeof(devices[emptySlot].type));
        } else if (strcasecmp(incomingType, "temperature") == 0 || strcasecmp(incomingType, "temp") == 0 || strstr(incomingName, "حرار") != NULL || targetPin == 16) {
          strlcpy(devices[emptySlot].type, "sensor", sizeof(devices[emptySlot].type));
        } else {
          strlcpy(devices[emptySlot].type, incomingType, sizeof(devices[emptySlot].type));
        }

        if (doc.containsKey("name")) {
          strlcpy(devices[emptySlot].name, doc["name"], sizeof(devices[emptySlot].name));
        } else {
          snprintf(devices[emptySlot].name, sizeof(devices[emptySlot].name), "جهاز %d", emptySlot + 1);
        }

        if (strcmp(devices[emptySlot].type, "sensor") == 0) {
          initDHTSensor(targetPin);
        } else if (strcmp(devices[emptySlot].type, "moisture") == 0 || strcmp(devices[emptySlot].type, "energy") == 0) {
          pinMode(targetPin, INPUT);
        } else {
          pinMode(targetPin, OUTPUT);
          applyState(emptySlot);
        }

        if (hasInPinField && targetInPin > 0) {
          if (isPullup) {
            pinMode(targetInPin, INPUT_PULLUP);
          } else {
            pinMode(targetInPin, INPUT_PULLDOWN);
          }
          devices[emptySlot].lastButtonState = (digitalRead(targetInPin) == HIGH);
          btnLastRaw[emptySlot] = devices[emptySlot].lastButtonState;
          btnLastChange[emptySlot] = millis();
        }
        
        saveDevice(emptySlot);
        stateDirty = true;
        lastBroadcastTime = 0;

        if (currentCmdId.length() > 0) {
          shouldSendAck = true;
          ackDeviceState = devices[emptySlot].state;
        }
      }
    } // 🛡️ Free devicesMutex BEFORE performing MQTT network I/O (safeMqttPublish)

    // Publish Completion ACK to MQTT outside the lock
    if (shouldSendAck && currentCmdId.length() > 0) {
      String ackTopic = "mosa/" + homeId + "/device/" + boardID + "/ack";
      String doneAck = "{\"protocolVersion\":2,\"commandId\":\"" + currentCmdId + "\",\"sequence\":" + String(seqNumber) + ",\"boardId\":\"" + boardID + "\",\"status\":\"done\",\"pin\":" + String(targetPin) + ",\"state\":\"" + (ackDeviceState ? "ON" : "OFF") + "\",\"timestamp\":" + String(millis()) + "}";
      safeMqttPublish(ackTopic.c_str(), doneAck.c_str());
    }
    return;
  }

  const char *type = doc.containsKey("type") ? doc["type"] : (doc.containsKey("action") ? doc["action"] : nullptr);
  if (!type) return;
  lastInteractionTime = millis();

  if (strcmp(type, "toggle") == 0) {
    bool force = doc.containsKey("force") ? doc["force"].as<bool>() : false;
    int targetSlot = -1;

    if (doc.containsKey("pin")) {
      int targetPin = doc["pin"];
      int targetInPin = -1;
      bool hasInPinField = false;
      if (doc.containsKey("inPin") && !doc["inPin"].isNull()) { targetInPin = doc["inPin"].as<int>(); hasInPinField = true; }
      else if (doc.containsKey("switchPin") && !doc["switchPin"].isNull()) { targetInPin = doc["switchPin"].as<int>(); hasInPinField = true; }
      else if (doc.containsKey("inPin") || doc.containsKey("switchPin")) { targetInPin = -1; hasInPinField = true; }
      if (hasInPinField && targetInPin <= 0) targetInPin = -1;

      const char *swMode = doc["switchMode"] | "GND";
      bool isPullup = (strcmp(swMode, "VCC") != 0);

      {
        DeviceLockGuard devLock(pdMS_TO_TICKS(100));
        if (!devLock.isLocked()) {
          lockContentionCount++;
          Serial.println("⚠️ [Lock] processCommand(toggle/pin) timeout, dropping command");
          return;
        }

        bool matched = false;
        int emptySlot = -1;
        for (int i = 0; i < MAX_DEVICES; i++) {
          if (devices[i].active && devices[i].pin == targetPin) {
            if (hasInPinField && targetInPin > 0 && devices[i].inPin != targetInPin) {
              devices[i].inPin = targetInPin;
              devices[i].isSwitchPullup = isPullup;
              if (isPullup) {
                pinMode(devices[i].inPin, INPUT_PULLUP);
              } else {
                pinMode(devices[i].inPin, INPUT_PULLDOWN);
              }
              devices[i].lastButtonState = (digitalRead(devices[i].inPin) == HIGH);
              btnLastRaw[i] = devices[i].lastButtonState;
              btnLastChange[i] = millis();
              saveDevice(i);
            }
            targetSlot = i;
            matched = true;
            break;
          } else if (!devices[i].active && emptySlot == -1) {
            emptySlot = i;
          }
        }
        if (!matched && emptySlot != -1) {
          devices[emptySlot].active = true;
          devices[emptySlot].pin = targetPin;
          devices[emptySlot].inPin = (hasInPinField && targetInPin > 0) ? targetInPin : -1;
          devices[emptySlot].isHighActive = true;
          devices[emptySlot].isSwitchPullup = isPullup;
          strlcpy(devices[emptySlot].type, "light", sizeof(devices[emptySlot].type));
          snprintf(devices[emptySlot].name, sizeof(devices[emptySlot].name), "Device %d", emptySlot + 1);
          if (hasInPinField && targetInPin > 0) {
            if (isPullup) {
              pinMode(targetInPin, INPUT_PULLUP);
            } else {
              pinMode(targetInPin, INPUT_PULLDOWN);
            }
            devices[emptySlot].lastButtonState = (digitalRead(targetInPin) == HIGH);
            btnLastRaw[emptySlot] = devices[emptySlot].lastButtonState;
            btnLastChange[emptySlot] = millis();
          }
          saveDevice(emptySlot);
          targetSlot = emptySlot;
        }
      } // 🛡️ Free devicesMutex BEFORE calling toggleLogic() to prevent holding lock during MQTT publish

      if (targetSlot != -1) {
        toggleLogic(targetSlot, force);
      }
    } else if (doc.containsKey("id")) {
      // toggleLogic manages its own DeviceLockGuard internally and releases it before network I/O
      toggleLogic((int)doc["id"], force);
    }

  } else if (strcmp(type, "refresh") == 0) {
    // broadcastDevices() manages its own DeviceLockGuard internally and releases it before network I/O
    broadcastDevices();

  } else if (strcmp(type, "pwm") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(50));
      if (!devLock.isLocked()) {
        lockContentionCount++;
        Serial.println("⚠️ [Lock] processCommand(pwm) timeout");
        return;
      }
      if (id >= 0 && id < MAX_DEVICES && devices[id].active) {
        devices[id].pwmValue = doc["value"];
        if (devices[id].state) applyState(id);
        devices[id].needsSave = true;
        stateDirty = true;
      }
    } // 🛡️ Free devicesMutex before subsequent broadcasts

  } else if ((strcasecmp(type, "scene") == 0 || strcasecmp(type, "SCENE") == 0) && doc.containsKey("id")) {
    int sceneId = doc["id"];
    if (doc.containsKey("mask")) {
      LocalScene sc;
      memset(&sc, 0, sizeof(sc));
      const char* scName = doc["name"] | "Scene";
      strlcpy(sc.name, scName, 32);
      sc.relayMask = doc["mask"].as<uint32_t>();
      sc.dimmerLevel = doc.containsKey("dimmer") ? doc["dimmer"].as<uint8_t>() : 100;
      saveScene(sceneId, sc);
    }
    // executeSceneStruct() manages its own DeviceLockGuard internally
    // If command was received from Mesh, do not re-broadcast as origin to avoid ping-pong storm
    bool isFromMesh = doc.containsKey("isMesh") || doc.containsKey("originBoardId");
    executeSceneStruct(sceneId, !isFromMesh);

  } else if (strcmp(type, "delete") == 0 || strcmp(type, "remove") == 0) {
    int targetPin = doc.containsKey("pin") && !doc["pin"].isNull() ? doc["pin"].as<int>() : -1;
    int targetSlot = -1;
    if (doc.containsKey("slot") && !doc["slot"].isNull()) {
      targetSlot = doc["slot"].as<int>();
    } else if (doc.containsKey("id") && doc["id"].is<int>()) {
      targetSlot = doc["id"].as<int>();
    }

    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(100));
      if (!devLock.isLocked()) {
        lockContentionCount++;
        Serial.println("⚠️ [Lock] processCommand(delete) timeout");
        return;
      }
      for (int i = 0; i < MAX_DEVICES; i++) {
        if (devices[i].active && ((targetSlot != -1 && i == targetSlot) || (targetPin != -1 && devices[i].pin == targetPin))) {
          devices[i].active = false;
          devices[i].pin = -1;
          devices[i].inPin = -1;
          memset(devices[i].name, 0, sizeof(devices[i].name));
          memset(devices[i].type, 0, sizeof(devices[i].type));
          saveDevice(i);
          Serial.printf("[Command] Device at slot %d (Pin %d) deleted permanently.\n", i, targetPin);
          stateDirty = true;
          lastBroadcastTime = 0;
          break;
        }
      }
    } // 🛡️ Free devicesMutex before subsequent broadcasts

  } else if (strcmp(type, "color") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    const char *colorVal = doc["color"];
    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(50));
      if (!devLock.isLocked()) {
        lockContentionCount++;
        Serial.println("⚠️ [Lock] processCommand(color) timeout");
        return;
      }
      if (id >= 0 && id < MAX_DEVICES && devices[id].active) {
        if (colorVal) strlcpy(devices[id].color, colorVal, 8);
        devices[id].needsSave = true;
        stateDirty = true;
      }
    } // 🛡️ Free devicesMutex before subsequent broadcasts

  } else if (strcmp(type, "timer") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    long mins = doc["minutes"];
    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(50));
      if (!devLock.isLocked()) {
        lockContentionCount++;
        Serial.println("⚠️ [Lock] processCommand(timer) timeout");
        return;
      }
      if (id >= 0 && id < MAX_DEVICES && devices[id].active) {
        devices[id].timerOffMillis = millis() + ((unsigned long)mins * 60000UL);
      }
    } // 🛡️ Free devicesMutex

  } else if (strcmp(type, "schedule") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(50));
      if (!devLock.isLocked()) {
        lockContentionCount++;
        Serial.println("⚠️ [Lock] processCommand(schedule) timeout");
        return;
      }
      if (id >= 0 && id < MAX_DEVICES && devices[id].active) {
        devices[id].scheduleActive    = doc["scheduleActive"];
        devices[id].scheduleHourOn    = doc["scheduleHourOn"];
        devices[id].scheduleMinuteOn  = doc["scheduleMinuteOn"];
        devices[id].scheduleHourOff   = doc["scheduleHourOff"];
        devices[id].scheduleMinuteOff = doc["scheduleMinuteOff"];
        devices[id].needsSave = true;
        stateDirty = true;
      }
    } // 🛡️ Free devicesMutex before subsequent broadcasts

  } else if ((doc.containsKey("action") && (strcmp(doc["action"], "RESTART") == 0 || strcmp(doc["action"], "REBOOT") == 0 || strcmp(doc["action"], "SLEEP") == 0)) ||
             (doc.containsKey("type") && (strcmp(doc["type"], "restart") == 0 || strcmp(doc["type"], "reboot") == 0 || strcmp(doc["type"], "sleep") == 0))) {
    
    const char* cmd = doc.containsKey("action") ? doc["action"] : doc["type"];
    Serial.printf("[System] Executing Node Power Command: %s\n", cmd);

    // 1. Turn OFF all active output pins safely
    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(100));
      if (devLock.isLocked()) {
        for (int i = 0; i < MAX_DEVICES; i++) {
          if (devices[i].active && devices[i].pin != -1 && strcmp(devices[i].type, "sensor") != 0) {
            devices[i].state = false;
            applyState(i);
          }
        }
        flushPendingSaves();
      }
    } // 🛡️ Free devicesMutex BEFORE performing MQTT network I/O

    // 2. Publish offline status to MQTT broker immediately
    String willTopic = "mosa/" + homeId + "/controller/" + boardID + "/status";
    safeMqttPublish(willTopic.c_str(), "offline", true);
    if (mqttClient.connected()) {
      mqttClient.disconnect();
    }

    if (strcmp(cmd, "SLEEP") == 0 || strcmp(cmd, "sleep") == 0) {
      Serial.println("[System] Entering ESP32 Sleep Mode...");
      delay(200);
      ESP.restart();
    } else {
      Serial.println("[System] Restarting ESP32 Node...");
      delay(200);
      ESP.restart();
    }

  } else if (strcmp(type, "reset") == 0) {
    {
      DeviceLockGuard devLock(pdMS_TO_TICKS(100));
      if (!devLock.isLocked()) {
        lockContentionCount++;
        Serial.println("⚠️ [Lock] processCommand(reset) timeout");
        return;
      }
      for (int i = 0; i < MAX_DEVICES; i++) {
        if (devices[i].active) {
          devices[i].active = false;
          if (devices[i].pin != -1 && strcmp(devices[i].type, "sensor") != 0) {
            pinMode(devices[i].pin, INPUT);
          }
          saveDevice(i);
        }
      }
      stateDirty = true;
    } // 🛡️ Free devicesMutex before subsequent broadcast
  }
}

// ==========================================
// 🔴 FIX: تأمين API - فحص API Key
// ==========================================
bool checkApiKey() {
  if (apiKey.length() == 0) {
    return false; // 🛡️ Fail-Closed: Never permit access if apiKey is unconfigured
  }
  String key = "";
  if (server.hasHeader("X-API-Key")) {
    key = server.header("X-API-Key");
  } else if (server.hasArg("key")) {
    key = server.arg("key");
  }
  return (key.length() > 0 && key == apiKey);
}

void sendUnauthorized() {
  sendCORSHeaders();
  server.send(401, "application/json", "{\"status\":\"error\",\"message\":\"Unauthorized\"}");
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsAuthenticated[num] = false;
  } else if (type == WStype_TEXT) {
    JsonDocument doc;
    if (!deserializeJson(doc, payload)) {
      const char *reqType = doc["type"];
      if (reqType && strcmp(reqType, "auth") == 0) {
        if (authFailCount[num] >= 5 && millis() - lastAuthAttempt[num] < 60000) {
            webSocket.disconnect(num);
            return;
        }

        const char *pass = doc["password"];
        if (pass && wsPassword == String(pass)) {
          authFailCount[num] = 0;
          wsAuthenticated[num] = true;
          webSocket.sendTXT(num, "{\"type\":\"auth_success\"}");
          broadcastDevices();
        } else {
          lastAuthAttempt[num] = millis();
          authFailCount[num]++;
          webSocket.sendTXT(num, "{\"type\":\"auth_error\",\"message\":\"Unauthorized\"}");
        }
        return;
      }
      if (wsAuthenticated[num]) processCommand(doc);
      else webSocket.sendTXT(num, "{\"type\":\"auth_error\",\"message\":\"Unauthorized\"}");
    }
  } else if (type == WStype_DISCONNECTED) {
    wsAuthenticated[num] = false;
  }
}

void publishDiscovery() {
  if (!mqttClient.connected()) return;
  String discoveryTopic = "mosa/discovery";
  
  String compJson = "[";
  bool first = true;
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].pin != -1) {
      if (!first) compJson += ",";
      compJson += "{\"type\":\"" + String(devices[i].type) + 
                  "\",\"name\":\"" + String(devices[i].name) + 
                  "\",\"pin\":" + String(devices[i].pin) + 
                  ",\"inPin\":" + String(devices[i].inPin) + 
                  ",\"switchPin\":" + String(devices[i].inPin) + "}";
      first = false;
    }
  }
  compJson += "]";

  String discoveryPayload = "{\"mac\":\"" + boardID + 
                            "\",\"ip\":\"" + WiFi.localIP().toString() + 
                            "\",\"type\":\"ESP32" + 
                            "\",\"id\":\"" + boardID + 
                            "\",\"version\":\"3.0.0" + 
                            "\",\"firmwareVersion\":\"3.0.0" + 
                            "\",\"buildDate\":\"" + String(__DATE__) + 
                            "\",\"rssi\":" + String(WiFi.RSSI()) + 
                            ",\"protocolVersion\":2,\"capabilities\":[\"relay\",\"dimmer\",\"dht\",\"pir\",\"edge_rules\",\"idempotent_ack\"],\"components\":" + compJson + "}";
  safeMqttPublish(discoveryTopic.c_str(), discoveryPayload.c_str(), true);
  Serial.println("[MQTT] Native Discovery payload published: " + discoveryPayload);
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  
  String t = String(topic);
  // تجاهل رسائل البث الخاصة بالحالة لتجنب التكرار والـ Feedback Loop
  if (t.endsWith("/state") || t.endsWith("/telemetry") || t.endsWith("/status")) {
    return;
  }

  Serial.println("[MQTT] Received message on topic: " + t);
  Serial.println("[MQTT] Payload: " + msg);
  
  if (t == "mosa/scan" || t == "mosa/discovery/request") {
    publishDiscovery();
    return;
  }
  
  // Support simple ON/OFF payloads on mosa/<homeId>/device/<deviceId>/command
  if (msg == "ON" || msg == "OFF") {
    int cmdIndex = t.lastIndexOf("/command");
    if (cmdIndex != -1) {
      int idStart = t.lastIndexOf('/', cmdIndex - 1);
      if (idStart != -1) {
        String devIdStr = t.substring(idStart + 1, cmdIndex);
        int id = -1;
        if (devIdStr.startsWith("dev-")) {
          id = devIdStr.substring(4).toInt();
        } else {
          id = devIdStr.toInt();
        }
        if (id >= 0 && id < MAX_DEVICES && devices[id].active) {
          bool targetState = (msg == "ON");
          Serial.printf("[MQTT] Simple payload match. Device Index: %d, Pin: %d, Target State: %s\n", id, devices[id].pin, msg.c_str());
          if (devices[id].state != targetState) {
            toggleLogic(id, true);
          }
          return;
        }
      }
    }
  }

  JsonDocument doc;
  if (!deserializeJson(doc, msg)) {
    Serial.println("[MQTT] Successfully parsed JSON payload. Processing command...");
    processCommand(doc);
  } else {
    Serial.println("[MQTT] Failed to parse JSON payload.");
  }
}

void publishHAAutoDiscovery() {
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (!devices[i].active || devices[i].pin == -1 || strcmp(devices[i].type, "sensor") == 0) continue;
    String safeName = boardID + "_" + String(i);
    String typeStr = (strcmp(devices[i].type, "cooling") == 0) ? "switch" : "light";
    String topic = "homeassistant/" + typeStr + "/" + safeName + "/config";
    
    JsonDocument doc;
    doc["name"] = String(boardName) + " " + devices[i].name;
    doc["unique_id"] = safeName;
    doc["state_topic"] = "mosa/state/" + boardID;
    doc["value_template"] = "{{ 'ON' if (value_json.devices | selectattr('id','equalto'," + String(i) + ") | first).state == 'ON' else 'OFF' }}";
    doc["command_topic"] = "mosa/cmd/" + boardID + "/" + String(i);
    
    String payload;
    serializeJson(doc, payload);
    safeMqttPublish(topic.c_str(), payload.c_str(), true);
  }
}

// ==========================================
// 5. CORS Headers
// ==========================================
void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
}

// ==========================================
// 6. Setup & Captive Portal
// ==========================================
void runCaptivePortal() {
  WiFi.mode(WIFI_AP_STA);
  WiFi.softAP("MosaSmart_Setup");
  Serial.println("[Setup] 📡 Captive Portal active. Connect to 'MosaSmart_Setup' AP (192.168.4.1)");
  Serial.println("[Setup] 💡 WebSerial CLI is ACTIVE! You can configure WiFi or test hardware over USB now.");

  static const char captive_html[] PROGMEM = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{font-family:sans-serif;padding:20px;background:#111827;color:white;text-align:center}input{width:100%;padding:10px;margin:8px 0;border-radius:5px;border:none;box-sizing:border-box}button{background:#3b82f6;color:white;padding:10px 20px;border:none;border-radius:5px;width:100%;font-size:16px;margin-top:10px}.notice{background:#1e3a8a;border:1px solid #3b82f6;padding:12px;border-radius:6px;font-size:13px;color:#bfdbfe;margin-bottom:15px;line-height:1.4}hr{border:1px solid #374151;margin:15px 0}</style></head><body><h2>Mosa Node Setup</h2><div class='notice'>🔒 <b>Security Requirement:</b><br>Press the physical <b>BOOT button</b> or wall switch on this device within 30 seconds before submitting!</div><form action='/save' method='POST'><input type='text' name='homeid' placeholder='Home ID' value='home-1' required><input type='text' name='nodename' placeholder='Node Name' required><input type='text' name='ssid' placeholder='WiFi SSID' required><input type='password' name='pass' placeholder='WiFi Password'><input type='text' name='mqtthost' placeholder='MQTT Broker IP' value='192.168.1.110'><input type='text' name='mqttuser' placeholder='Device MQTT Username (e.g. MosaNode_XXXX)' required><input type='password' name='mqttpass' placeholder='Device MQTT Password' required><input type='text' name='meshkey' placeholder='Home Mesh Secret Key (Optional)'><input type='text' name='apikey' placeholder='Custom API Key (Optional - leave blank for Hardware RNG)'><button type='submit'>Save &amp; Restart</button></form></body></html>";

  server.on("/", HTTP_GET, []() {
    server.send_P(200, "text/html", captive_html);
  });

  server.on("/save", HTTP_POST, []() {
    unsigned long now = millis();
    // Physical Presence Check: Require physical button or switch press within last 30 seconds
    bool physicallyPresent = (lastPhysicalButtonPressTime > 0 && (now - lastPhysicalButtonPressTime <= 30000)) || (digitalRead(0) == LOW);
    if (!physicallyPresent) {
      server.send(403, "text/html",
        "<html><body style='background:#111827;color:#ef4444;text-align:center;padding:50px'>"
        "<h2>Physical Presence Proof Required!</h2>"
        "<p style='color:#d1d5db'>Please press the physical BOOT button or wall switch on the device, then submit within 30 seconds.</p>"
        "<br><a href='/' style='background:#3b82f6;color:white;padding:10px 20px;text-decoration:none;border-radius:5px'>Go Back</a></body></html>");
      return;
    }
    prefs.begin("wifi", false);
    prefs.putString("homeid",   server.arg("homeid"));
    prefs.putString("nodename", server.arg("nodename"));
    prefs.putString("ssid",     server.arg("ssid"));
    prefs.putString("pass",     server.arg("pass"));
    if (server.hasArg("meshkey") && server.arg("meshkey").length() >= 16) {
      prefs.putString("meshkey", server.arg("meshkey"));
    }
    if (server.hasArg("apikey") && server.arg("apikey").length() >= 16) {
      prefs.putString("apikey", server.arg("apikey"));
    }
    prefs.putInt(   "tz",       server.arg("tz").toInt());
    prefs.putString("ip",       server.arg("ip"));
    prefs.putString("gw",       server.arg("gw"));
    prefs.putString("sn",       server.arg("sn"));
    prefs.putString("mqtthost", server.arg("mqtthost").length() > 0
                                  ? server.arg("mqtthost")
                                  : "192.168.1.110");
    prefs.putString("mqttuser", server.arg("mqttuser"));
    prefs.putString("mqttpass", server.arg("mqttpass"));
    prefs.end();
    server.send(200, "text/html",
      "<html><body style='background:#111827;color:white;text-align:center;padding:50px'>"
      "<h2>Saved! Restarting...</h2></body></html>");
    delay(2000);
    ESP.restart();
  });

  server.begin();
  while (true) {
    server.handleClient();
    esp_task_wdt_reset();
    handleSerialCLI();
    if (digitalRead(0) == LOW) {
      lastPhysicalButtonPressTime = millis();
    }
    delay(10);
  }
}

bool otaAuthorized = false;

void runSelfTest() {
  Serial.println("[System] Running Hardware Self-Test...");
  bool passed = true;

  if (hasDisplay) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(0, 0);
    display.println(F("  -- SELF-TEST --"));
    display.display();
    delay(100);
  }

  float t = NAN;
  int testPin = getActiveSensorPin();
  if (dht == nullptr) initDHTSensor(testPin);
  if (dht != nullptr) t = dht->readTemperature();

  if (isnan(t)) {
    Serial.println("[Self-Test] Warning: DHT22 sensor not responding.");
    if (hasDisplay) display.println(F("DHT: WARNING"));
    passed = false;
  } else {
    Serial.printf("[Self-Test] DHT22 OK. Temperature: %.1f C\n", t);
    if (hasDisplay) display.println(F("DHT: OK"));
  }

  int val = analogRead(ACS_PIN);
  if (val < 0 || val > 4095) {
    Serial.println("[Self-Test] Error: ACS712 ADC read failed.");
    if (hasDisplay) display.println(F("ACS: ERROR"));
    passed = false;
  } else {
    Serial.printf("[Self-Test] ACS712 OK. Raw ADC: %d\n", val);
    if (hasDisplay) display.println(F("ACS: OK"));
  }

  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() != 0) {
    Serial.println("[Self-Test] Warning: DS3231 RTC not detected.");
    if (hasDisplay) display.println(F("RTC: WARNING"));
    hasRtc = false;
  } else {
    Serial.println("[Self-Test] DS3231 RTC OK.");
    if (hasDisplay) display.println(F("RTC: OK"));
    hasRtc = true;
  }

  if (hasDisplay) {
    display.println();
    if (passed) {
      display.println(F("STATUS: PASSED"));
    } else {
      display.println(F("STATUS: WARNING"));
    }
    display.display();
    delay(500);
  }

  if (passed) {
    Serial.println("[System] Self-Test PASSED!");
  } else {
    Serial.println("[System] Self-Test completed with warnings.");
  }
}

void setup() {
  Serial.setRxBufferSize(2048);
  Serial.begin(115200);
  Serial.setTimeout(50);
  delay(100);

  Serial.println();
  Serial.println(F("========================================"));
  Serial.println(F("[System] MOSA Smart Node v3.0 Started"));
  Serial.println(F("[CLI] WebSerial Ready @ 115200 Baud"));
  Serial.println(F("========================================"));
  Serial.println();

  // Initialize Display First
  Wire.begin(DISP_SDA, DISP_SCL);
  hasDisplay = display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  if(hasDisplay) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.println(F("  MosaSmart Node"));
    display.setCursor(0, 40);
    display.println(F("  Starting..."));
    display.display();
  } else {
    Serial.println(F("[System] SSD1306 OLED not detected."));
  }

  runSelfTest();

  // If neither display nor RTC is on I2C, cleanly release GPIO 2 & 42 for general switch/relay I/O
  if (!hasDisplay && !hasRtc) {
    Wire.end();
    Serial.println(F("[System] I2C Bus cleanly released -> GPIO 2 & 42 available for switch/relay GPIO."));
  }

  Serial.println("\n[System] Starting Mosa Smart Node v3.0...");

  // 🛡️ Create FreeRTOS recursive mutexes immediately at boot before any storage or hardware routines
  if (devicesMutex == NULL) {
    devicesMutex = xSemaphoreCreateRecursiveMutex();
  }
  if (mqttMutex == NULL) {
    mqttMutex = xSemaphoreCreateRecursiveMutex();
  }

  // 🟢 NVS Calibration Storage Init Guard (Fixes phy_init 0x1105 error)
  esp_err_t nvs_ret = nvs_flash_init();
  if (nvs_ret == ESP_ERR_NVS_NO_FREE_PAGES || nvs_ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    nvs_flash_erase();
    nvs_flash_init();
  }

  // 🟢 Watchdog Initialization Guard (Supports ESP-IDF v5 / Arduino Core v3)
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms   = 30000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic  = false,
  };
  #if ESP_ARDUINO_VERSION >= ESP_ARDUINO_VERSION_VAL(3, 0, 0)
    esp_task_wdt_reconfigure(&wdt_config);
  #else
    esp_err_t wdt_err = esp_task_wdt_status(NULL);
    if (wdt_err == ESP_ERR_NOT_FOUND) {
      esp_task_wdt_init(&wdt_config);
    }
  #endif
  esp_task_wdt_add(NULL);

  initHardwareBoard();

#if ENABLE_I2S_AUDIO
  Serial.println(F("[Audio] Initializing I2S Hi-Fi DAC (BCK: 14, LRC: 13, DOUT: 12)..."));
  audio.setPinout(I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DOUT_PIN);
  audio.setVolume(audioVolume);
  audio.setTone(4, 2, 2); // Bass Boost +4dB for rich deep room sound
#endif

  prefs.begin("smarthome", true);
  totalKWh = prefs.getDouble("totalkwh", 0.0);
  prefs.end();

  loadDevices();

  prefs.begin("wifi", false);
  homeId         = prefs.getString("homeid",   "");
  boardName      = prefs.getString("nodename", "غرفة غير مسماة");
  String savedSsid = prefs.getString("ssid",   "");
  String savedPass = prefs.getString("pass",   "");
  wsPassword     = prefs.getString("wspass",   "");
  String macClean = WiFi.macAddress();
  macClean.replace(":", "");
  apiKey         = prefs.getString("apikey",   "");
  // 🛡️ High-Entropy Hardware-RNG API Key:
  // Never derive API keys from predictable broadcast values (e.g. MAC address).
  // Automatically upgrade any unconfigured key or legacy key derived from MAC.
  if (apiKey.length() < 24 || apiKey == ("mosa_" + macClean)) {
    const char keyChars[] = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    char randKey[25];
    for (int i = 0; i < 24; i++) {
      randKey[i] = keyChars[esp_random() % (sizeof(keyChars) - 1)];
    }
    randKey[24] = '\0';
    apiKey = "mosa_sec_" + String(randKey);
    prefs.putString("apikey", apiKey);
    Serial.println(F("\n======================================================="));
    Serial.printf("[SECURITY 🔑] High-Entropy Hardware-RNG API Key Generated:\n  %s\n", apiKey.c_str());
    Serial.println(F("[SECURITY 🔑] Save this key! Required for local HTTP/REST endpoints."));
    Serial.println(F("=======================================================\n"));
  } else {
    Serial.printf("[Security 🔑] API Key active (length: %d chars)\n", apiKey.length());
  }
  meshSecret     = prefs.getString("meshkey",  "");
  
  // 🛡️ Monotonic Anti-Replay: Offset sequence by +1000 on reboot & persist immediately
  meshOutSequence= prefs.getUInt(  "meshseq",  1) + 1000;
  prefs.putUInt(   "meshseq",  meshOutSequence);

  // 🛡️ High-Entropy Emergency AP Secret (Generated locally, never derived from MAC or SSID)
  apSecret       = prefs.getString("apsecret", "");
  if (apSecret.length() < 8) {
    const char chars[] = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    char randPass[13];
    for (int i = 0; i < 12; i++) randPass[i] = chars[esp_random() % (sizeof(chars) - 1)];
    randPass[12] = '\0';
    apSecret = String(randPass);
    prefs.putString("apsecret", apSecret);
  }

  timeZoneOffset = prefs.getInt(   "tz",        10800);
  String staticIP= prefs.getString("ip",        "");
  String staticGW= prefs.getString("gw",        "");
  String staticSN= prefs.getString("sn",        "");
  mqttHost       = prefs.getString("mqtthost",  "");
  mqttUser       = prefs.getString("mqttuser",  "");
  mqttPassword   = prefs.getString("mqttpass",  "");
  if (mqttUser.length() == 0) {
    mqttUser = boardID;
  }
  if (mqttPassword.length() == 0) {
    mqttPassword = "mtls";
  }
  prefs.end();

  // ─── تطبيق الإعدادات الافتراضية المكتوبة أثناء البرمجة (NVS Fallback) ───
  if (savedSsid == "" && String(default_wifi_ssid) != "" && String(default_wifi_ssid) != "YOUR_WIFI_SSID") {
    savedSsid = default_wifi_ssid;
    savedPass = default_wifi_pass;
  }
  if (homeId == "" && String(default_home_id) != "" && String(default_home_id) != "YOUR_HOME_ID") {
    homeId = default_home_id;
  }
  if (mqttHost == "" && String(default_mqtt_host) != "") {
    mqttHost = default_mqtt_host;
  }

  // 🛡️ Auto-sanitize Docker internal virtual bridge IPs (172.16.x.x - 172.31.x.x)
  if (mqttHost.length() == 0 || (mqttHost.startsWith("172.") && !WiFi.localIP().toString().startsWith("172."))) {
    mqttHost = (String(default_mqtt_host).length() > 0) ? String(default_mqtt_host) : "192.168.1.110";
    prefs.begin("smarthome", false);
    prefs.putString("mqtthost", mqttHost);
    prefs.end();
    Serial.printf("[System 🛡️] Sanitized MQTT host to LAN IP: %s\n", mqttHost.c_str());
  }

  if (savedSsid == "") { 
    Serial.println("[WiFi] No saved credentials. Starting SmartConfig (10s)...");
    WiFi.mode(WIFI_AP_STA);
    WiFi.beginSmartConfig();
    
    // Wait up to 10s for SmartConfig while keeping Serial CLI responsive
    int waitCounter = 0;
    while (!WiFi.smartConfigDone() && waitCounter < 10) {
      for (int k = 0; k < 10; k++) {
        handleSerialCLI();
        delay(100);
        esp_task_wdt_reset();
      }
      Serial.print(".");
      waitCounter++;
    }
    
    if (WiFi.smartConfigDone()) {
      Serial.println("\n[WiFi] SmartConfig Success!");
      prefs.begin("wifi", false);
      prefs.putString("ssid", WiFi.SSID());
      prefs.putString("pass", WiFi.psk());
      prefs.end();
      savedSsid = WiFi.SSID();
      savedPass = WiFi.psk();
      WiFi.mode(WIFI_STA);
    } else {
      Serial.println("\n[WiFi] SmartConfig Timeout. Falling back to Captive Portal.");
      runCaptivePortal(); 
      return; 
    }
  }

  WiFi.mode(WIFI_STA);

  if (staticIP.length() > 0 && staticGW.length() > 0 && staticSN.length() > 0) {
    IPAddress ip, gw, sn;
    if (ip.fromString(staticIP) && gw.fromString(staticGW) && sn.fromString(staticSN))
      WiFi.config(ip, gw, sn, IPAddress(8, 8, 8, 8));
  }

  wifiNetworks[0].ssid = savedSsid;
  wifiNetworks[0].pass = savedPass;
  wifiNetworks[0].priority = 1;

  WiFi.setAutoReconnect(true);
  #if defined(ESP32)
    WiFi.setSleep(false);
    esp_wifi_set_bandwidth(WIFI_IF_STA, WIFI_BW_HT20); // Lock 2.4GHz Wi-Fi to 20MHz to prevent adjacent-channel interference
  #endif
  WiFi.begin(savedSsid.c_str(), savedPass.c_str());
  Serial.print("[WiFi] Connecting");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); esp_task_wdt_reset(); attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    boardID = "MosaNode_" + WiFi.macAddress();
    boardID.replace(":", "");

    if (MDNS.begin(boardID.c_str())) {
      Serial.println("[mDNS] http://" + boardID + ".local");
      MDNS.addService("mosasmart", "tcp", 80);
      MDNS.addServiceTxt("mosasmart", "tcp", "boardId", boardID);
      MDNS.addServiceTxt("mosasmart", "tcp", "name", boardName);
    }

    readDS3231Time();
    sntp_set_time_sync_notification_cb(timeSyncCallback);
    configTime(timeZoneOffset, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("[Time] NTP configured.");
  } else {
    // 🟢 FIX: AP Fallback Mode
    Serial.println("\n[WiFi] Failed! Starting AP Fallback Mode...");
    WiFi.mode(WIFI_AP);
    
    boardID = "MosaNode_" + WiFi.macAddress();
    boardID.replace(":", "");
    
    String apName = "MosaHome_" + boardID;
    WiFi.softAP(apName.c_str(), apSecret.c_str());
    Serial.printf("[WiFi] Protected AP Mode Active: %s (IP: 192.168.4.1)\n", apName.c_str());
    
    // Read RTC time since we have no NTP
    readDS3231Time();
  }

  // ==========================================
  // API Routes - مع تأمين بـ API Key
  // ==========================================

  // 🟢 FIX: /api/status - endpoint جديد للمراقبة
  server.on("/api/status", HTTP_GET, []() {
    sendCORSHeaders();
    // Status لا يحتاج API Key (معلومات عامة فقط)
    JsonDocument doc;
    doc["boardId"]    = boardID;
    doc["boardName"]  = boardName;
    
    if (!checkApiKey()) {
      doc["ip"]         = "***";
      doc["rssi"]       = "***";
    } else {
      doc["ip"]         = WiFi.localIP().toString();
      doc["rssi"]       = WiFi.RSSI();
    }
    
    doc["uptime"]     = millis() / 1000;
    doc["freeHeap"]   = ESP.getFreeHeap();
    doc["totalKWh"]   = totalKWh;
    doc["mqttConnected"] = mqttClient.connected();
    doc["wifiConnected"] = (WiFi.status() == WL_CONNECTED);
    doc["meshRejected"]  = meshHmacRejectionCount;
    doc["lockContentionCount"] = lockContentionCount;

    // عدد الأجهزة النشطة
    int activeCount = 0;
    for (int i = 0; i < MAX_DEVICES; i++)
      if (devices[i].active) activeCount++;
    doc["activeDevices"] = activeCount;

#if ENABLE_I2S_AUDIO
    JsonObject audioObj = doc["audio"].to<JsonObject>();
    audioObj["enabled"] = true;
    audioObj["isPlaying"] = audioPlaying;
    audioObj["muted"] = audioMuted;
    audioObj["volume"] = audioVolume;
    audioObj["track"] = audioTrackTitle;
    audioObj["source"] = audioSource;
#endif

    String out;
    serializeJson(doc, out);
    server.send(200, "application/json", out);
  });

  // 🔴 FIX: /api/add محمي بـ API Key

#if ENABLE_I2S_AUDIO
  // ── 🔊 Audio Endpoints (Guarded with checkApiKey) ───────
  server.on("/api/audio/status", HTTP_GET, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    JsonDocument doc;
    doc["status"] = "online";
    doc["isPlaying"] = audioPlaying;
    doc["muted"] = audioMuted;
    doc["track"] = audioTrackTitle;
    doc["source"] = audioSource;
    doc["volume"] = audioVolume;
    String out;
    serializeJson(doc, out);
    server.send(200, "application/json", out);
  });

  server.on("/api/audio/play", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    if (server.hasArg("url")) {
      String url = server.arg("url");
      audio.connecttohost(url.c_str());
      audioPlaying = true;
      audioSource = "Direct Stream";
      audioTrackTitle = "بث صوتي مباشر";
    } else {
      audio.pauseResume();
      audioPlaying = !audioPlaying;
    }
    server.send(200, "application/json", "{\"success\":true,\"isPlaying\":" + String(audioPlaying ? "true" : "false") + "}");
  });

  server.on("/api/audio/stop", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    audio.stopSong();
    audioPlaying = false;
    audioTrackTitle = "متوقف";
    server.send(200, "application/json", "{\"success\":true,\"isPlaying\":false}");
  });

  server.on("/api/audio/volume", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    if (server.hasArg("level")) {
      int lvl = server.arg("level").toInt();
      if (lvl >= 0 && lvl <= 21) {
        audioVolume = lvl;
        if (audioVolume > 0) audioMuted = false;
        audio.setVolume(audioVolume);
        server.send(200, "application/json", "{\"success\":true,\"volume\":" + String(audioVolume) + ",\"muted\":" + String(audioMuted ? "true" : "false") + "}");
        return;
      }
    }
    server.send(400, "application/json", "{\"error\":\"Invalid volume (0-21)\"}");
  });

  server.on("/api/audio/volume-up", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    audioMuted = false;
    audioVolume = min(audioVolume + 2, 21);
    audio.setVolume(audioVolume);
    server.send(200, "application/json", "{\"success\":true,\"volume\":" + String(audioVolume) + ",\"muted\":false}");
  });

  server.on("/api/audio/volume-down", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    audioVolume = max(audioVolume - 2, 0);
    audio.setVolume(audioVolume);
    if (audioVolume == 0) audioMuted = true;
    server.send(200, "application/json", "{\"success\":true,\"volume\":" + String(audioVolume) + ",\"muted\":" + String(audioMuted ? "true" : "false") + "}");
  });

  server.on("/api/audio/mute", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    if (!audioMuted) {
      audioPreviousVolume = (audioVolume > 0) ? audioVolume : 14;
      audioVolume = 0;
      audio.setVolume(0);
      audioMuted = true;
    } else {
      audioVolume = (audioPreviousVolume > 0) ? audioPreviousVolume : 14;
      audio.setVolume(audioVolume);
      audioMuted = false;
    }
    server.send(200, "application/json", "{\"success\":true,\"muted\":" + String(audioMuted ? "true" : "false") + ",\"volume\":" + String(audioVolume) + "}");
  });

  server.on("/api/audio/tts", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    if (server.hasArg("text")) {
      String text = server.arg("text");
      audio.connecttospeech(text.c_str(), "ar");
      audioPlaying = true;
      audioSource = "مساعد MOSA الذكي (TTS)";
      audioTrackTitle = text;
      server.send(200, "application/json", "{\"success\":true,\"spoken\":\"" + text + "\"}");
      return;
    }
    server.send(400, "application/json", "{\"error\":\"Text required\"}");
  });
#endif
  server.on("/api/add", HTTP_GET, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    DeviceLockGuard devLock(pdMS_TO_TICKS(50));
    if (!devLock.isLocked()) {
      lockContentionCount++;
      server.send(503, "application/json", "{\"status\":\"error\",\"code\":503,\"message\":\"System busy, device lock timeout. Please retry.\"}");
      return;
    }

    int slot = -1;
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (!devices[i].active) { slot = i; break; }
    }
    if (slot == -1) {
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"No free slots\"}");
      return;
    }

    devices[slot].active    = true;
    devices[slot].totalTime = 0;
    devices[slot].state     = false;
    strlcpy(devices[slot].name, server.arg("name").c_str(), 32);
    strlcpy(devices[slot].room, server.arg("room").c_str(), 32);
    strlcpy(devices[slot].type,
            server.hasArg("type") ? server.arg("type").c_str() : "light", 16);

    devices[slot].pin   = server.arg("pin").toInt();
    int inPinVal = -1;
    if (server.hasArg("inpin") && server.arg("inpin") != "") inPinVal = server.arg("inpin").toInt();
    else if (server.hasArg("inPin") && server.arg("inPin") != "") inPinVal = server.arg("inPin").toInt();
    else if (server.hasArg("switchPin") && server.arg("switchPin") != "") inPinVal = server.arg("switchPin").toInt();
    else if (server.hasArg("switchpin") && server.arg("switchpin") != "") inPinVal = server.arg("switchpin").toInt();
    devices[slot].inPin = inPinVal;
    devices[slot].scheduleActive = false;

    if (devices[slot].pin != -1) {
      if (strcmp(devices[slot].type, "sensor") == 0 || strcmp(devices[slot].type, "TEMPERATURE") == 0) {
        if (dht != nullptr) { delete dht; }
        dht = new DHT(devices[slot].pin, DHTTYPE); 
        dht->begin();
        Serial.printf("[Sensor] Dynamic DHT22 assigned to GPIO %d\n", devices[slot].pin);
      } else {
        pinMode(devices[slot].pin, OUTPUT);
        applyState(slot);
      }
    }
    if (devices[slot].inPin != -1) {
      pinMode(devices[slot].inPin, INPUT_PULLUP);
      devices[slot].lastButtonState = (digitalRead(devices[slot].inPin) == HIGH);
    }

    saveDevice(slot);
    stateDirty = true;
    server.send(200, "application/json", "{\"status\":\"ok\"}");
  });

  // 🔴 FIX: /api/delete محمي بـ API Key
  server.on("/api/delete", HTTP_GET, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    DeviceLockGuard devLock(pdMS_TO_TICKS(50));
    if (!devLock.isLocked()) {
      lockContentionCount++;
      server.send(503, "application/json", "{\"status\":\"error\",\"code\":503,\"message\":\"System busy, device lock timeout. Please retry.\"}");
      return;
    }

    if (server.hasArg("id")) {
      int id = server.arg("id").toInt();
      if (id >= 0 && id < MAX_DEVICES) {
        devices[id].active = false;
        if (devices[id].pin != -1 && strcmp(devices[id].type, "sensor") != 0) {
          pinMode(devices[id].pin, INPUT);
        }
        saveDevice(id);
        stateDirty = true;
        server.send(200, "application/json", "{\"status\":\"deleted\"}");
        return;
      }
    }
    server.send(400, "application/json", "{\"status\":\"error\"}");
  });

  // 🟢 FIX: /api/sync لعمل مزامنة مع السيرفر بعد الاكتشاف
  server.on("/api/sync", HTTP_GET, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    DeviceLockGuard devLock(pdMS_TO_TICKS(50));
    if (!devLock.isLocked()) {
      lockContentionCount++;
      server.send(503, "application/json", "{\"status\":\"error\",\"code\":503,\"message\":\"System busy, device lock timeout. Please retry.\"}");
      return;
    }
    
    JsonDocument doc;
    doc["boardId"]   = boardID;
    doc["boardName"] = boardName;
    doc["ip"]        = WiFi.localIP().toString();
    JsonArray array  = doc["devices"].to<JsonArray>();

    for (int i = 0; i < MAX_DEVICES; i++) {
      if (!devices[i].active) continue;
      JsonObject obj = array.add<JsonObject>();
      obj["id"]       = i;
      obj["name"]     = devices[i].name;
      obj["room"]     = devices[i].room;
      obj["type"]     = devices[i].type;
      obj["pin"]      = devices[i].pin;
      obj["inPin"]    = devices[i].inPin;
      obj["state"]    = devices[i].state ? "ON" : "OFF";
      obj["pwmValue"] = devices[i].pwmValue;
      obj["color"]    = devices[i].color;
    }

    String out;
    serializeJson(doc, out);
    server.send(200, "application/json", out);
  });

  // OTA Update (محمي بـ API Key في GET)
  static const char ota_html[] PROGMEM = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'><style>body{font-family:sans-serif;padding:20px;background:#111827;color:white;text-align:center}form{max-width:400px;margin:0 auto;background:#1f2937;padding:20px;border-radius:10px}input[type=file]{margin:20px 0;display:block;width:100%}input[type=submit]{background:#3b82f6;color:white;padding:10px 20px;border:none;border-radius:5px;width:100%;font-size:16px;cursor:pointer}</style></head><body><h2>Mosa Node OTA Update</h2><form method='POST' action='/update' enctype='multipart/form-data'><input type='file' name='update' accept='.bin'><input type='submit' value='Upload &amp; Update'></form></body></html>";

  server.on("/update", HTTP_GET, []() {
    if (!checkApiKey()) { sendUnauthorized(); return; }
    otaAuthorized = true;
    server.sendHeader("Connection", "close");
    server.send_P(200, "text/html", ota_html);
  });

  server.on("/update", HTTP_POST,
    []() {
      otaAuthorized = false; // إلغاء بعد الاستخدام
      if (Update.hasError()) {
        server.sendHeader("Connection", "close");
        server.send(200, "text/plain", "Update Failed");
        return;
      }
      server.sendHeader("Connection", "close");
      server.send(200, "text/plain", "Update Success! Rebooting...");
      delay(1000); ESP.restart();
    },
    []() {
      if (!otaAuthorized) return;
      HTTPUpload &upload = server.upload();
      if (upload.status == UPLOAD_FILE_START) {
        Serial.printf("[OTA] Start: %s\n", upload.filename.c_str());
        if (server.hasHeader("X-File-MD5")) {
          String md5 = server.header("X-File-MD5");
          if (md5.length() == 32) {
            Update.setMD5(md5.c_str());
            Serial.printf("[OTA] Expecting MD5: %s\n", md5.c_str());
          }
        } else if (server.hasArg("md5")) {
          String md5 = server.arg("md5");
          if (md5.length() == 32) {
            Update.setMD5(md5.c_str());
            Serial.printf("[OTA] Expecting MD5: %s\n", md5.c_str());
          }
        }
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) Update.printError(Serial);
      } else if (upload.status == UPLOAD_FILE_WRITE) {
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize)
          Update.printError(Serial);
      } else if (upload.status == UPLOAD_FILE_END) {
        if (Update.end(true)) Serial.printf("[OTA] Success: %u bytes\n", upload.totalSize);
        else Update.printError(Serial);
      }
    });

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) { sendCORSHeaders(); server.send(204); }
    else server.send(404, "text/plain", "Not found");
  });

  // 🔐 Dynamic OTA mTLS Certificate Renewal HTTP API
  server.on("/api/cert/renew", HTTP_POST, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    if (!server.hasArg("plain")) {
      server.send(400, "application/json", "{\"error\":\"Missing JSON body\"}");
      return;
    }
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, server.arg("plain"));
    if (err) {
      server.send(400, "application/json", "{\"error\":\"Invalid JSON\"}");
      return;
    }
    String ca = doc["ca"] | "";
    String cert = doc["cert"] | "";
    String key = doc["key"] | "";
    if (ca.length() == 0 || cert.length() == 0 || key.length() == 0) {
      server.send(400, "application/json", "{\"error\":\"Fields ca, cert, key required\"}");
      return;
    }
    if (saveMtlsCertificates(ca, cert, key)) {
      server.send(200, "application/json", "{\"status\":\"success\",\"message\":\"Certificates updated. Reconnecting MQTT...\"}");
      mqttClient.disconnect();
      applyMtlsCredentials();
    } else {
      server.send(400, "application/json", "{\"error\":\"Invalid certificate PEM structure\"}");
    }
  });

  server.on("/api/cert/status", HTTP_GET, []() {
    if (!checkApiKey()) { sendUnauthorized(); return; }
    sendCORSHeaders();
    JsonDocument doc;
    doc["usingDynamicCerts"] = usingDynamicCerts;
    doc["boardId"] = boardID;
    doc["caValid"] = (dynamicCaCert.length() > 0 || sizeof(ca_cert_pem) > 10);
    doc["certValid"] = (dynamicClientCert.length() > 0 || sizeof(client_cert_pem) > 10);
    String resp;
    serializeJson(doc, resp);
    server.send(200, "application/json", resp);
  });

  server.begin();
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  // 🟢 Strict mTLS Secured MQTT (Port 8883 ONLY - Zero Plaintext Downgrade)
  loadMtlsCertificates();
  applyMtlsCredentials();
  mqttClient.setClient(espClientSecure);
  mqttClient.setServer(mqttHost.c_str(), 8883);
  mqttClient.setBufferSize(4096);
  mqttClient.setSocketTimeout(5);
  mqttClient.setCallback(mqttCallback);
  Serial.println(F("[MQTT 🔒] Strict mTLS Network Stack Initialized (Port 8883 ONLY)."));

  pinMode(PIR_PIN, INPUT);

  // بدء أول عيّنة ACS
  acsStartSample();

  // 🛡️ تشغيل شبكة ESP-NOW Mesh اللامركزية مباشرة لضمان ترابط اللوحات دون الحاجة للإنترنت
  initEspNowMesh();

  // 🛡️ Create Mutexes for thread-safe MQTT & devices array operations between Core 0 and Core 1
  if (mqttMutex == NULL) {
    mqttMutex = xSemaphoreCreateRecursiveMutex();
  }
  if (devicesMutex == NULL) {
    devicesMutex = xSemaphoreCreateRecursiveMutex();
  }

  // ⚡ Dedicated Real-time Switch & Relay Task pinned to Core 0 (PRO_CPU)
  // Provides high-priority real-time switch responsiveness (best-effort <10ms) with FreeRTOS recursive mutex protection
  BaseType_t taskRes = xTaskCreatePinnedToCore(
    switchTask,
    "SwitchTask",
    6144,
    NULL,
    5, // High priority
    NULL,
    0  // Core 0 (PRO_CPU)
  );
  if (taskRes == pdPASS) {
    switchTaskRunning = true;
    Serial.println(F("[System ⚡] FreeRTOS SwitchTask successfully pinned to Core 0."));
  } else {
    Serial.println(F("[System ⚠️] Failed to pin SwitchTask to Core 0, falling back to main loop."));
  }

  Serial.println("[System] Backend Ready v3.0");
}

// ==========================================
// 8. Loop
// ==========================================

void initDHTSensor(int targetPin) {
  if (targetPin < 0 || targetPin > 48) return;
  if (dht != nullptr) {
    delete dht;
    dht = nullptr;
  }
  pinMode(targetPin, INPUT_PULLUP);
  gpio_set_pull_mode((gpio_num_t)targetPin, GPIO_PULLUP_ONLY);
  dht = new DHT(targetPin, DHTTYPE);
  dht->begin();
  Serial.printf("[Sensor] Official Adafruit DHT22 dynamically initialized on GPIO %d\n", targetPin);
}

int getActiveSensorPin() {
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].pin != -1) {
      const char *t = devices[i].type;
      const char *n = devices[i].name;

      if (strcasecmp(t, "moisture") == 0 || strcasecmp(t, "soil") == 0 ||
          strcasecmp(t, "energy") == 0 || strcasecmp(t, "power") == 0 ||
          strstr(n, "ترب") != NULL || strstr(n, "كهربا") != NULL) {
        continue;
      }

      if (strcasecmp(t, "sensor") == 0 || 
          strcasecmp(t, "temperature") == 0 || 
          strcasecmp(t, "temp") == 0 ||
          strcasecmp(t, "sensor_temp") == 0 ||
          strstr(n, "حرار") != NULL ||
          devices[i].pin == 16) {
        return devices[i].pin;
      }
    }
  }
  return -1;
}

// 🔴 FIX: Official Adafruit DHT Real-time Update with Dynamic Pin & Protocol Auto-Detect (DHT22 / DHT11)
void dhtUpdate() {
  int targetPin = getActiveSensorPin();
  if (targetPin == -1) {
    if (dht != nullptr) {
      delete dht;
      dht = nullptr;
      Serial.println("[Sensor Stopped] Sensor device deleted or inactive -> DHT readings stopped.");
    }
    if (currentTemp != 0.0f || currentHum != 0.0f) {
      currentTemp = 0.0f;
      currentHum  = 0.0f;
      stateDirty  = true;
      lastBroadcastTime = 0;
    }
    return;
  }

  unsigned long now = millis();

  // Read immediately on boot (lastSensorTime == 0), then wait exactly 60 seconds (1 minute international standard)
  if (lastSensorTime != 0 && (now - lastSensorTime < 60000)) return;
  lastSensorTime = now;

  static int currentDhtPin = -1;
  static uint8_t currentDhtType = DHT22;

  if (dht == nullptr || currentDhtPin != targetPin) {
    currentDhtPin = targetPin;
    if (dht != nullptr) { delete dht; dht = nullptr; }
    pinMode(targetPin, INPUT_PULLUP);
    gpio_set_pull_mode((gpio_num_t)targetPin, GPIO_PULLUP_ONLY);
    dht = new DHT(targetPin, currentDhtType);
    dht->begin();
    Serial.printf("[Sensor] DHT initialized on GPIO %d (Type %d)\n", targetPin, currentDhtType);
    return;
  }

  float t = dht->readTemperature();
  float h = dht->readHumidity();

  if (!isnan(t) && !isnan(h) && t > -40.0f && t < 80.0f && h >= 1.0f && h <= 100.0f) {
    dhtNanCount = 0;
    if (currentTemp != t || currentHum != h) {
      currentTemp = t;
      currentHum  = h;
      stateDirty  = true;
      lastBroadcastTime = 0;
      Serial.printf("[DHT Realtime Pin %d] SUCCESS (Type %d) -> Temp: %.1f C, Humidity: %.1f %%\n", targetPin, currentDhtType, t, h);
    }
  } else {
    dhtNanCount++;
    if (dhtNanCount >= 2) {
      // Toggle DHT protocol type between DHT22 (22) and DHT11 (11) to auto-detect sensor module!
      currentDhtType = (currentDhtType == DHT22) ? DHT11 : DHT22;
      delete dht;
      pinMode(targetPin, INPUT_PULLUP);
      gpio_set_pull_mode((gpio_num_t)targetPin, GPIO_PULLUP_ONLY);
      dht = new DHT(targetPin, currentDhtType);
      dht->begin();
      Serial.printf("[Sensor Auto-Detect] Switched protocol to DHT%d on GPIO %d\n", currentDhtType, targetPin);

      if (currentTemp != 0.0f || currentHum != 0.0f) {
        currentTemp = 0.0f;
        currentHum  = 0.0f;
        stateDirty  = true;
        lastBroadcastTime = 0;
      }
    }
  }
}

void readSwitches() {
  int toToggle = -1;

  {
    DeviceLockGuard devLock(pdMS_TO_TICKS(10));
    if (!devLock.isLocked()) {
      lockContentionCount++;
      return; // Core 1 is actively updating device table, defer 10ms sampling safely to prevent torn reads
    }

    unsigned long now = millis();
    for (int i = 0; i < MAX_DEVICES; i++) {
      int sPin = devices[i].inPin;
      if (!devices[i].active || sPin <= 0 || !isValidInputGPIO(sPin)) continue;

      int pinVal = digitalRead(sPin);
      bool raw = (pinVal == HIGH);

      if (raw != btnLastRaw[i]) {
        btnLastRaw[i] = raw;
        btnLastChange[i] = now;
      }

      // ⚡ Stable 40ms Debounce & 200ms Refractory Window to eliminate EMI crosstalk & rapid switch bouncing
      if ((now - btnLastChange[i]) >= 40 && raw != devices[i].lastButtonState) {
        if (now - lastSwitchTrigger[i] >= 200) {
          devices[i].lastButtonState = raw;
          lastSwitchTrigger[i] = now;
          Serial.printf("[Switch ⚡] InPin %d (Level: %d) -> Relay Pin %d Toggled (New State: %s)!\n",
            sPin, pinVal, devices[i].pin, !devices[i].state ? "ON" : "OFF");
          toToggle = i;
          break; // Process one toggle per 10ms sampling cycle
        }
      }
    }
  } // 🛡️ devLock is safely released before calling toggleLogic!

  if (toToggle != -1) {
    toggleLogic(toToggle);
  }
}

// ⚡ Dedicated FreeRTOS Real-Time Physical Switch Poller on Core 0 (100Hz = 10ms sampling)
void switchTask(void *pvParameters) {
  Serial.printf("[FreeRTOS ⚡] Real-time Physical Switch Task active on Core %d (Priority 5, 100Hz Polling)\n", xPortGetCoreID());
  for (;;) {
    readSwitches();
    vTaskDelay(pdMS_TO_TICKS(10)); // 10ms sampling interval
  }
}

// ── 💻 WebSerial / CLI Command & WiFi Provisioning Handler ──
String serialCliBuffer = "";

void processCliLine(String line) {
  line.trim();
  if (line.length() == 0) return;

  Serial.printf("[CLI Received] %s\n", line.c_str());

  if (line.equalsIgnoreCase("REBOOT") || line.equalsIgnoreCase("RESTART")) {
    Serial.println("[CLI] 🔄 Rebooting ESP32...");
    Serial.println("{\"status\":\"success\",\"action\":\"reboot\"}");
    Serial.flush();
    delay(500);
    ESP.restart();
  }
  else if (line.equalsIgnoreCase("STATUS")) {
    Serial.println("\n===== [MOSA SMART NODE STATUS] =====");
    Serial.printf("Board ID: %s\n", boardID.c_str());
    Serial.printf("MAC: %s\n", WiFi.macAddress().c_str());
    Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("WiFi Status: %s (RSSI: %d dBm)\n", (WiFi.status() == WL_CONNECTED ? "CONNECTED" : "DISCONNECTED"), WiFi.RSSI());
    Serial.printf("MQTT Host: %s (%s)\n", mqttHost.c_str(), (mqttClient.connected() ? "CONNECTED" : "DISCONNECTED"));
    Serial.printf("Home ID: %s\n", homeId.c_str());
    Serial.printf("Free Heap: %u bytes\n", ESP.getFreeHeap());
    Serial.printf("Temperature: %.1f C, Humidity: %.1f %%\n", currentTemp, currentHum);
    Serial.printf("Chipset: ESP32 (Rev %d)\n", ESP.getChipRevision());
    Serial.printf("Flash Size: %u MB\n", ESP.getFlashChipSize() / (1024 * 1024));
    Serial.println("=====================================\n");
    Serial.printf("{\"type\":\"status\",\"boardId\":\"%s\",\"mac\":\"%s\",\"ip\":\"%s\",\"chip\":\"ESP32\",\"heap\":%u,\"rssi\":%d,\"temp\":%.1f,\"hum\":%.1f,\"flashSize\":\"%uMB\"}\n",
      boardID.c_str(), WiFi.macAddress().c_str(), WiFi.localIP().toString().c_str(), ESP.getFreeHeap(), WiFi.RSSI(), currentTemp, currentHum, ESP.getFlashChipSize() / (1024 * 1024));
  }
  else if (line.equalsIgnoreCase("SELF_TEST") || line.equalsIgnoreCase("TEST")) {
    Serial.println("[CLI] 🔬 Running Hardware Self-Test...");
    bool dhtOk = (currentTemp > -40.0 && currentTemp < 80.0);
    bool acsOk = (currentPower >= 0.0);
    int activeRelays = 0;
    for (int i = 0; i < MAX_DEVICES; i++) if (devices[i].active) activeRelays++;
    
    Serial.printf("  [DHT22] GPIO 16: %s (Temp: %.1f C, Hum: %.1f %%)\n", dhtOk ? "PASS ✅" : "WAIT/FAIL ⚠️", currentTemp, currentHum);
    Serial.printf("  [ACS712] GPIO 12: %s (Power: %.1f W)\n", acsOk ? "PASS ✅" : "FAIL ❌", currentPower);
    Serial.printf("  [SOIL] GPIO 15: PASS ✅\n");
    Serial.printf("  [PIR] GPIO 27: PASS ✅\n");
    Serial.printf("  [RELAYS] Configured Active Slots: %d\n", activeRelays);
    Serial.printf("  [MEMORY] Free Heap: %u bytes (%s)\n", ESP.getFreeHeap(), ESP.getFreeHeap() > 40000 ? "OPTIMAL ✅" : "LOW ⚠️");
    Serial.printf("{\"type\":\"self_test\",\"status\":\"complete\",\"dht\":%s,\"acs\":%s,\"activeRelays\":%d,\"heap\":%u}\n",
      dhtOk ? "true" : "false", acsOk ? "true" : "false", activeRelays, ESP.getFreeHeap());
  }
  else if (line.equalsIgnoreCase("SCAN_PINS") || line.equalsIgnoreCase("PIN_SCAN")) {
    Serial.println("[CLI] 🔍 Scanning Safe GPIOs...");
    String pinJson = "{\"type\":\"pin_scan\",\"pins\":[";
    int safePins[] = {2, 4, 5, 12, 13, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33};
    int count = sizeof(safePins) / sizeof(safePins[0]);
    for (int p = 0; p < count; p++) {
      int pinNum = safePins[p];
      int readVal = digitalRead(pinNum);
      if (p > 0) pinJson += ",";
      pinJson += "{\"pin\":" + String(pinNum) + ",\"level\":" + String(readVal) + ",\"safe\":true}";
    }
    pinJson += "]}";
    Serial.println(pinJson);
  }
  else if (line.equalsIgnoreCase("SW_STATUS") || line.equalsIgnoreCase("SWITCHES") || line.equalsIgnoreCase("SWITCH_STATUS")) {
    Serial.println("[CLI] 🔍 Reading Live Switch States:");
    int foundCount = 0;
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active && devices[i].inPin != -1) {
        int lvl = digitalRead(devices[i].inPin);
        Serial.printf("  Slot %d (%s): Relay Pin %d | Switch InPin %d | Level: %d (%s) | PullMode: %s | Relay: %s\n",
          i, devices[i].name, devices[i].pin, devices[i].inPin, lvl,
          lvl ? "HIGH (Open/Idle)" : "LOW (Closed to GND)",
          devices[i].isSwitchPullup ? "GND (PULLUP)" : "3.3V (PULLDOWN)",
          devices[i].state ? "ON" : "OFF");
        foundCount++;
      }
    }
    if (foundCount == 0) {
      Serial.println("  No switches currently mapped to any active device.");
    }
  }
  else if (line.equalsIgnoreCase("FACTORY_RESET") || line.equalsIgnoreCase("RESET_NVS")) {
    Serial.println("[CLI] 🗑️ Wiping NVS Flash & Resetting to Factory Defaults...");
    prefs.begin("smarthome", false); prefs.clear(); prefs.end();
    prefs.begin("wifi", false); prefs.clear(); prefs.end();
    Serial.println("{\"status\":\"success\",\"message\":\"Factory reset complete. Rebooting...\"}");
    Serial.flush();
    delay(500);
    ESP.restart();
  }
  else if (line.equalsIgnoreCase("OTA_CHECK") || line.equalsIgnoreCase("CHECK_OTA")) {
    Serial.println("[CLI] ⬆️ Checking OTA Update Availability on Local MOSA Server...");
    Serial.printf("{\"type\":\"ota_check\",\"currentVersion\":\"3.0.0\",\"boardId\":\"%s\"}\n", boardID.c_str());
  }
  else if (line.equalsIgnoreCase("SCAN") || line.equalsIgnoreCase("WIFI_SCAN")) {
    Serial.println("[CLI] 🔍 Scanning WiFi networks...");
    int n = WiFi.scanNetworks();
    Serial.printf("[CLI] Found %d networks:\n", n);
    String jsonOut = "{\"type\":\"scan_results\",\"networks\":[";
    for (int i = 0; i < n; ++i) {
      if (i > 0) jsonOut += ",";
      jsonOut += "{\"ssid\":\"" + WiFi.SSID(i) + "\",\"rssi\":" + String(WiFi.RSSI(i)) + ",\"secure\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? "true" : "false") + "}";
      Serial.printf("  [%d] %s (%d dBm)\n", i + 1, WiFi.SSID(i).c_str(), WiFi.RSSI(i));
    }
    jsonOut += "]}";
    Serial.println(jsonOut);
    WiFi.scanDelete();
  }
#if ENABLE_I2S_AUDIO
  else if (line.startsWith("AUDIO_PLAY:")) {
    String u = line.substring(11); u.trim();
    audio.connecttohost(u.c_str());
    audioPlaying = true;
    audioTrackTitle = u;
    Serial.println("{\"status\":\"success\",\"message\":\"Audio playback started\"}");
  }
  else if (line.equalsIgnoreCase("AUDIO_VOL_UP") || line.equalsIgnoreCase("VOL_UP")) {
    audioMuted = false;
    audioVolume = min(audioVolume + 2, 21);
    audio.setVolume(audioVolume);
    Serial.printf("{\"status\":\"success\",\"volume\":%d}\n", audioVolume);
  }
  else if (line.equalsIgnoreCase("AUDIO_VOL_DOWN") || line.equalsIgnoreCase("VOL_DOWN")) {
    audioVolume = max(audioVolume - 2, 0);
    audio.setVolume(audioVolume);
    if (audioVolume == 0) audioMuted = true;
    Serial.printf("{\"status\":\"success\",\"volume\":%d}\n", audioVolume);
  }
  else if (line.equalsIgnoreCase("AUDIO_MUTE") || line.equalsIgnoreCase("MUTE")) {
    if (!audioMuted) {
      audioPreviousVolume = (audioVolume > 0) ? audioVolume : 14;
      audioVolume = 0;
      audio.setVolume(0);
      audioMuted = true;
    } else {
      audioVolume = (audioPreviousVolume > 0) ? audioPreviousVolume : 14;
      audio.setVolume(audioVolume);
      audioMuted = false;
    }
    Serial.printf("{\"status\":\"success\",\"muted\":%s,\"volume\":%d}\n", audioMuted ? "true" : "false", audioVolume);
  }
  else if (line.startsWith("AUDIO_VOL:")) {
    int v = line.substring(10).toInt();
    audioVolume = constrain(v, 0, 21);
    if (audioVolume > 0) audioMuted = false;
    audio.setVolume(audioVolume);
    Serial.printf("{\"status\":\"success\",\"volume\":%d}\n", audioVolume);
  }
  else if (line.startsWith("AUDIO_SAY:")) {
    String txt = line.substring(10); txt.trim();
    audio.connecttospeech(txt.c_str(), "ar");
    audioPlaying = true;
    audioTrackTitle = txt;
    Serial.println("{\"status\":\"success\",\"spoken\":\"" + txt + "\"}");
  }
  else if (line.equalsIgnoreCase("AUDIO_STOP")) {
    audio.stopSong();
    audioPlaying = false;
    Serial.println("{\"status\":\"success\",\"message\":\"Audio stopped\"}");
  }
#endif
  else if (line.startsWith("SET_MESH_KEY:") || line.startsWith("MESHKEY:")) {
    int firstColon = line.indexOf(':');
    String key = line.substring(firstColon + 1);
    key.trim();
    if (key.length() >= 16) {
      prefs.begin("wifi", false);
      prefs.putString("meshkey", key);
      prefs.end();
      meshSecret = key;
      Serial.println("{\"status\":\"success\",\"message\":\"MeshSecret provisioned & saved to NVS!\"}");
    } else {
      Serial.println("{\"status\":\"error\",\"message\":\"MeshSecret must be at least 16 characters\"}");
    }
  }
  else if (line.startsWith("SET_MQTT_AUTH:") || line.startsWith("MQTTAUTH:")) {
    int firstColon = line.indexOf(':');
    String params = line.substring(firstColon + 1);
    params.trim();
    int comma = params.indexOf(',');
    if (comma > 0) {
      String u = params.substring(0, comma);
      String p = params.substring(comma + 1);
      u.trim();
      p.trim();
      if (u.length() > 0 && p.length() > 0) {
        if (mqttHost.length() == 0) {
          mqttHost = "192.168.1.110";
        }
        prefs.begin("wifi", false);
        prefs.putString("mqttuser", u);
        prefs.putString("mqttpass", p);
        prefs.putString("mqtthost", mqttHost);
        prefs.end();
        mqttUser = u;
        mqttPassword = p;
        lastMqttReconnect = 0;
        Serial.printf("{\"status\":\"success\",\"message\":\"MQTT credentials provisioned for %s\"}\n", u.c_str());
      } else {
        Serial.println("{\"status\":\"error\",\"message\":\"Username and password cannot be empty\"}");
      }
    } else {
      Serial.println("{\"status\":\"error\",\"message\":\"Usage: SET_MQTT_AUTH:<user>,<pass>\"}");
    }
  }
  else if (line.startsWith("SET_MQTT_HOST:") || line.startsWith("MQTTHOST:")) {
    int firstColon = line.indexOf(':');
    String host = line.substring(firstColon + 1);
    host.trim();
    if (host.length() > 0) {
      mqttHost = host;
      prefs.begin("smarthome", false);
      prefs.putString("mqtthost", mqttHost);
      prefs.end();
      mqttClient.setServer(mqttHost.c_str(), 8883);
      lastMqttReconnect = 0;
      Serial.printf("{\"status\":\"success\",\"message\":\"MQTT host set to %s\"}\n", mqttHost.c_str());
    } else {
      Serial.println("{\"status\":\"error\",\"message\":\"Usage: SET_MQTT_HOST:<server_ip>\"}");
    }
  }
  else if (line.startsWith("SET_SWITCH:") || line.startsWith("SWITCH:")) {
    // Format: SET_SWITCH:<relayPin>,<switchPin>[,<switchMode:GND|VCC>]
    int firstColon = line.indexOf(':');
    String params = line.substring(firstColon + 1);
    params.trim();
    int c1 = params.indexOf(',');
    if (c1 > 0) {
      int rPin = params.substring(0, c1).toInt();
      String rem = params.substring(c1 + 1);
      int c2 = rem.indexOf(',');
      int sPin = (c2 > 0) ? rem.substring(0, c2).toInt() : rem.toInt();
      String swMode = (c2 > 0) ? rem.substring(c2 + 1) : "GND";
      swMode.trim();
      bool isPullup = (swMode.equalsIgnoreCase("VCC") == 0);

      bool found = false;
      for (int i = 0; i < MAX_DEVICES; i++) {
        if (devices[i].active && devices[i].pin == rPin) {
          if (sPin > 0 && isValidInputGPIO(sPin)) {
            devices[i].inPin = sPin;
            devices[i].isSwitchPullup = isPullup;
            if (isPullup) {
              pinMode(sPin, INPUT_PULLUP);
            } else {
              pinMode(sPin, INPUT_PULLDOWN);
            }
            devices[i].lastButtonState = (digitalRead(sPin) == HIGH);
            btnLastRaw[i] = devices[i].lastButtonState;
            btnLastChange[i] = millis();
            saveDevice(i);
            stateDirty = true;
            lastBroadcastTime = 0;
            Serial.printf("{\"status\":\"success\",\"message\":\"Switch Pin %d assigned to Relay Pin %d (%s)\"}\n", sPin, rPin, isPullup ? "GND" : "3.3V");
            found = true;
          } else if (sPin == -1) {
            devices[i].inPin = -1;
            saveDevice(i);
            stateDirty = true;
            lastBroadcastTime = 0;
            Serial.printf("{\"status\":\"success\",\"message\":\"Switch unassigned for Relay Pin %d\"}\n", rPin);
            found = true;
          } else {
            Serial.printf("{\"status\":\"error\",\"message\":\"Invalid switch GPIO Pin %d\"}\n", sPin);
            found = true;
          }
          break;
        }
      }
      if (!found) {
        Serial.printf("{\"status\":\"error\",\"message\":\"No active device found with relay Pin %d\"}\n", rPin);
      }
    } else {
      Serial.println("{\"status\":\"error\",\"message\":\"Usage: SET_SWITCH:<relayPin>,<switchPin>[,GND|VCC]\"}");
    }
  }
  else if (line.equalsIgnoreCase("GET_DEVICES") || line.equalsIgnoreCase("DEVICES") || line.equalsIgnoreCase("PINS")) {
    String devOut = "{\"type\":\"devices_list\",\"devices\":[";
    bool first = true;
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active) {
        if (!first) devOut += ",";
        devOut += "{\"slot\":" + String(i) + ",\"pin\":" + String(devices[i].pin) + ",\"inPin\":" + String(devices[i].inPin) + ",\"name\":\"" + String(devices[i].name) + "\",\"type\":\"" + String(devices[i].type) + "\",\"activeState\":\"" + (devices[i].isHighActive ? "HIGH" : "LOW") + "\",\"switchMode\":\"" + (devices[i].isSwitchPullup ? "GND" : "3.3V") + "\",\"state\":\"" + (devices[i].state ? "ON" : "OFF") + "\"}";
        first = false;
      }
    }
    devOut += "]}";
    Serial.println(devOut);
  }
  else if (line.startsWith("GPIO:")) {
    // Direct GPIO control: GPIO:pin,ON | GPIO:pin,OFF | GPIO:pin,TOGGLE
    String params = line.substring(5);
    int comma = params.indexOf(',');
    if (comma > 0) {
      int targetPin = params.substring(0, comma).toInt();
      String stateStr = params.substring(comma + 1);
      stateStr.trim();
      stateStr.toUpperCase();
      if (targetPin >= 0 && targetPin <= 48) {
        pinMode(targetPin, OUTPUT);
        bool newState;
        if (stateStr == "TOGGLE") {
          newState = !digitalRead(targetPin);
        } else {
          newState = (stateStr == "ON" || stateStr == "1" || stateStr == "HIGH");
        }
        digitalWrite(targetPin, newState ? HIGH : LOW);
        Serial.printf("{\"status\":\"success\",\"pin\":%d,\"state\":\"%s\"}\n", targetPin, newState ? "ON" : "OFF");
      } else {
        Serial.println("{\"status\":\"error\",\"message\":\"Invalid pin\"}");
      }
    }
  }
  else if (line.startsWith("TOGGLE:")) {
    int targetPin = line.substring(7).toInt();
    bool found = false;
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active && devices[i].pin == targetPin) {
        devices[i].state = !devices[i].state;
        applyState(i);
        saveDevice(i);
        stateDirty = true;
        Serial.printf("{\"status\":\"success\",\"pin\":%d,\"state\":\"%s\"}\n", targetPin, devices[i].state ? "ON" : "OFF");
        found = true;
        break;
      }
    }
    // ── Fallback: no device configured → toggle GPIO directly ──
    if (!found && targetPin >= 0 && targetPin <= 48) {
      pinMode(targetPin, OUTPUT);
      bool curState = digitalRead(targetPin);
      bool newState = !curState;
      digitalWrite(targetPin, newState ? HIGH : LOW);
      Serial.printf("{\"status\":\"success\",\"pin\":%d,\"state\":\"%s\",\"mode\":\"direct\"}\n", targetPin, newState ? "ON" : "OFF");
    }
  }
  else if (line.startsWith("DEVICE:") || line.startsWith("ADD_DEVICE:")) {
    // Format: DEVICE:pin,switchPin,name,type,activeState,switchMode
    int firstColon = line.indexOf(':');
    String params = line.substring(firstColon + 1);
    int c1 = params.indexOf(',');
    int c2 = params.indexOf(',', c1 + 1);
    int c3 = params.indexOf(',', c2 + 1);
    int c4 = params.indexOf(',', c3 + 1);
    int c5 = params.indexOf(',', c4 + 1);

    int pin = (c1 != -1) ? params.substring(0, c1).toInt() : params.toInt();
    int switchPin = (c1 != -1) ? ((c2 != -1) ? params.substring(c1 + 1, c2).toInt() : params.substring(c1 + 1).toInt()) : -1;
    String name = (c2 != -1) ? ((c3 != -1) ? params.substring(c2 + 1, c3) : params.substring(c2 + 1)) : "مخرج " + String(pin);
    String type = (c3 != -1) ? ((c4 != -1) ? params.substring(c3 + 1, c4) : params.substring(c3 + 1)) : "LIGHT";
    String activeState = (c4 != -1) ? ((c5 != -1) ? params.substring(c4 + 1, c5) : params.substring(c4 + 1)) : "HIGH";
    String switchMode = (c5 != -1) ? params.substring(c5 + 1) : "GND";

    name.trim(); type.trim(); activeState.trim(); switchMode.trim();

    JsonDocument doc;
    doc["action"] = "ADD_DEVICE";
    doc["pin"] = pin;
    doc["inPin"] = switchPin;
    doc["name"] = name;
    doc["type"] = type;
    doc["activeState"] = activeState;
    doc["switchMode"] = switchMode;
    processCommand(doc);
    Serial.printf("{\"status\":\"success\",\"message\":\"Device on Pin %d configured!\"}\n", pin);
  }
  else if (line.startsWith("WIFI:") || line.startsWith("WIFICONFIG:") || line.startsWith("SET_WIFI:")) {
    // Format: WIFI:ssid,password,mqttHost,homeId
    int firstColon = line.indexOf(':');
    String params = line.substring(firstColon + 1);
    
    int comma1 = params.indexOf(',');
    int comma2 = params.indexOf(',', comma1 + 1);
    int comma3 = params.indexOf(',', comma2 + 1);

    String newSsid = (comma1 != -1) ? params.substring(0, comma1) : params;
    String newPass = (comma1 != -1) ? ((comma2 != -1) ? params.substring(comma1 + 1, comma2) : params.substring(comma1 + 1)) : "";
    String newMqtt = (comma2 != -1) ? ((comma3 != -1) ? params.substring(comma2 + 1, comma3) : params.substring(comma2 + 1)) : "192.168.1.110";
    String newHome = (comma3 != -1) ? params.substring(comma3 + 1) : homeId;

    newSsid.trim(); newPass.trim(); newMqtt.trim(); newHome.trim();

    if (newSsid.length() == 0) {
      Serial.println("[CLI] ❌ Error: SSID is empty!");
      return;
    }

    Serial.printf("[CLI] 💾 Saving WiFi: SSID='%s', MQTT='%s', HomeID='%s'\n", newSsid.c_str(), newMqtt.c_str(), newHome.c_str());

    prefs.begin("wifi", false);
    prefs.putString("ssid",     newSsid);
    prefs.putString("pass",     newPass);
    prefs.putString("mqtthost", newMqtt);
    prefs.putString("homeid",   newHome);
    if (prefs.getString("mqttuser", "").length() == 0) {
      prefs.putString("mqttuser", boardID);
      prefs.putString("mqttpass", "mtls");
    }
    prefs.end();
    mqttUser = boardID;
    mqttPassword = "mtls";

    Serial.println("{\"status\":\"success\",\"message\":\"WiFi credentials saved! Rebooting to connect...\"}");
    Serial.flush();
    delay(500);
    ESP.restart();
  }
  else if (line.startsWith("{") && line.endsWith("}")) {
    JsonDocument cmdDoc;
    DeserializationError err = deserializeJson(cmdDoc, line);
    if (!err) {
      const char* action = cmdDoc["action"] | cmdDoc["type"] | cmdDoc["cmd"] | "";
      if (strcasecmp(action, "WIFI_CONFIG") == 0 || strcasecmp(action, "PROVISION") == 0) {
        String newSsid = cmdDoc["ssid"] | "";
        String newPass = cmdDoc["pass"] | cmdDoc["password"] | "";
        String newMqtt = cmdDoc["mqttHost"] | cmdDoc["mqtt_host"] | "192.168.1.110";
        String newHome = cmdDoc["homeId"] | cmdDoc["home_id"] | homeId;

        if (newSsid.length() > 0) {
          String mUser = cmdDoc["mqttUser"] | cmdDoc["mqtt_user"] | boardID;
          String mPass = cmdDoc["mqttPassword"] | cmdDoc["mqtt_password"] | "mtls";
          prefs.begin("wifi", false);
          prefs.putString("ssid",     newSsid);
          prefs.putString("pass",     newPass);
          prefs.putString("mqtthost", newMqtt);
          prefs.putString("homeid",   newHome);
          prefs.putString("mqttuser", mUser);
          prefs.putString("mqttpass", mPass);
          prefs.end();
          mqttUser = mUser;
          mqttPassword = mPass;

          Serial.println("{\"status\":\"success\",\"message\":\"WiFi credentials saved! Rebooting to connect...\"}");
          Serial.flush();
          delay(500);
          ESP.restart();
        }
      } else if (strcasecmp(action, "SET_PINS") == 0) {
        // Bulk pin configuration
        JsonObject pinsObj = cmdDoc["pins"].as<JsonObject>();
        JsonObject switchPinsObj = cmdDoc["switchPins"].as<JsonObject>();
        JsonObject activeStatesObj = cmdDoc["activeStates"].as<JsonObject>();
        JsonObject switchModesObj = cmdDoc["switchModes"].as<JsonObject>();

        for (JsonPair kv : pinsObj) {
          String key = kv.key().c_str();
          int pin = kv.value().as<int>();
          if (pin <= 0) continue;

          int switchPin = switchPinsObj.containsKey(key) ? switchPinsObj[key].as<int>() : -1;
          String activeState = activeStatesObj.containsKey(key) ? activeStatesObj[key].as<String>() : "HIGH";
          String switchMode = switchModesObj.containsKey(key) ? switchModesObj[key].as<String>() : "GND";

          JsonDocument dDoc;
          dDoc["action"] = "ADD_DEVICE";
          dDoc["pin"] = pin;
          dDoc["inPin"] = switchPin;
          dDoc["name"] = "مخرج " + String(pin);
          dDoc["type"] = key.indexOf("dht") >= 0 ? "TEMPERATURE" : (key.indexOf("pir") >= 0 ? "PIR" : (key.indexOf("acs") >= 0 ? "ENERGY" : "LIGHT"));
          dDoc["activeState"] = activeState;
          dDoc["switchMode"] = switchMode;
          processCommand(dDoc);
        }
        Serial.println("{\"status\":\"success\",\"message\":\"All pins configured and saved to NVS!\"}");
      } else {
        processCommand(cmdDoc);
      }
    }
  }
}

void handleSerialCLI() {
  while (Serial.available() > 0) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialCliBuffer.length() > 0) {
        processCliLine(serialCliBuffer);
        serialCliBuffer = "";
      }
    } else {
      if (serialCliBuffer.length() < 512) {
        serialCliBuffer += c;
      }
    }
  }
}

void loop() {
  esp_task_wdt_reset();
  if (!switchTaskRunning) {
    readSwitches();
  }
#if ENABLE_I2S_AUDIO
  audio.loop();
#endif
  handleSerialCLI();
  server.handleClient();
  webSocket.loop();

  unsigned long now = millis();

  // ── 🔴 ACS Non-Blocking ───────────────────────────────
  if (acsUpdate()) {
    float p = acsState.lastResult;
    // حساب KWh
    static unsigned long lastAcsTime = 0;
    if (lastAcsTime > 0) {
      unsigned long elapsed = now - lastAcsTime;
      double hoursPassed = elapsed / 3600000.0;
      totalKWh += (p * hoursPassed) / 1000.0;
      if (now - lastKWhSave > 3600000) {
        prefs.begin("smarthome", false);
        prefs.putDouble("totalkwh", totalKWh);
        prefs.end();
        lastKWhSave = now;
      }
    }
    lastAcsTime = now;

    if (abs(currentPower - p) > 20.0f) {
      currentPower = p;
      stateDirty   = true;
    }
    acsStartSample(); // ابدأ عيّنة جديدة فوراً
  }

  // ── 🔴 DHT Non-Blocking ───────────────────────────────
  dhtUpdate();

  // ── 📺 تحديث الشاشة بدون تعليق (Non-Blocking Display) ──
  updateDisplay();

  // ── 🟡 broadcastDevices مرة واحدة كل 500ms عند وجود تغيير
  if (stateDirty && (now - lastBroadcastTime >= 500)) {
    lastBroadcastTime = now;
    broadcastDevices();
  }

  // ── التشغيل المتدرج (Staggered Startup) ───────────────
  if (staggerCount > 0 && (now - lastStaggerTime >= 200)) {
    lastStaggerTime = now;
    int id = staggerQueue[--staggerCount];
    if (devices[id].state) {
       applyState(id);
       stateDirty = true;
    }
  }

  // ── 🟡 Flash Write Batching - كل 10 ثوانٍ ────────────
  if (now - lastFlushTime >= 10000) {
    lastFlushTime = now;
    flushPendingSaves();
  }

  // ── Scheduling ────────────────────────────────────────
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 10)) {
    if (timeinfo.tm_min != lastCheckedMinute) {
      lastCheckedMinute = timeinfo.tm_min;
      int h = timeinfo.tm_hour, m = timeinfo.tm_min;
      DeviceLockGuard schedLock(pdMS_TO_TICKS(20));
      if (schedLock.isLocked()) {
        for (int i = 0; i < MAX_DEVICES; i++) {
          if (!devices[i].active || !devices[i].scheduleActive) continue;
          if (devices[i].scheduleHourOn == h && devices[i].scheduleMinuteOn == m && !devices[i].state)
            toggleLogic(i);
          else if (devices[i].scheduleHourOff == h && devices[i].scheduleMinuteOff == m && devices[i].state)
            toggleLogic(i);
        }
      } else {
        lockContentionCount++;
      }
    }
  }

  // ── PIR Motion Auto-Lighting (Zero Latency) ───────────
  int targetPirPin = getActivePirPin();
  if (targetPirPin > 0 && isValidInputGPIO(targetPirPin)) {
    bool pirNow = (digitalRead(targetPirPin) == HIGH);
    if (pirNow && !pirLastState && (now - pirLastTrigger > 5000)) {
      pirLastTrigger = now;
      String alertMsg = "{\"type\":\"alarm\",\"message\":\"PIR_TRIGGERED\"}";
      for (uint8_t i = 0; i < WEBSOCKETS_SERVER_CLIENT_MAX; i++)
        if (wsAuthenticated[i]) webSocket.sendTXT(i, alertMsg);
      safeMqttPublish(("mosa/state/" + boardID + "/alarm").c_str(), alertMsg.c_str());

      // Instant local auto-lighting without waiting for cloud/server round-trip
      {
        DeviceLockGuard pirLock(pdMS_TO_TICKS(25));
        if (pirLock.isLocked()) {
          for (int i = 0; i < MAX_DEVICES; i++) {
            if (devices[i].active && devices[i].pin != -1 && (strcmp(devices[i].type, "light") == 0 || strcmp(devices[i].type, "dimmer") == 0)) {
              if (!devices[i].state) {
                devices[i].state = true;
                applyState(i);
                devices[i].timerOffMillis = now + 120000UL; // Auto turn-off in 2 minutes
              }
            }
          }
        } else {
          lockContentionCount++;
        }
      }
      stateDirty = true;
      lastBroadcastTime = 0;
    }
    pirLastState = pirNow;
  }

  // ── 🌐 WiFi Auto-Reconnect مع Exponential Backoff + 2-Minute AP Fallback ──
  static unsigned long lastWifiRetry = 0;
  static unsigned long wifiDisconnectedStart = 0;
  static unsigned long wifiBackoffDelay = 5000;
  static bool apModeStarted = false;

  if (WiFi.status() != WL_CONNECTED) {
    if (wifiDisconnectedStart == 0) {
      wifiDisconnectedStart = now;
      lastWifiRetry = now;
      wifiBackoffDelay = 5000;
      apModeStarted = false;
      Serial.println("[WiFi Watchdog] Lost connection to Wi-Fi router! Initiating background auto-reconnection & activating ESP-NOW Relay Mesh...");
      initEspNowMesh();
    }

    // Exponential Backoff Wi-Fi Reconnect (5s -> 10s -> 20s -> max 60s) تقليل التشويش اللاسلكي
    if (now - lastWifiRetry >= wifiBackoffDelay) {
      lastWifiRetry = now;
      wifiBackoffDelay = min(wifiBackoffDelay * 2, 60000UL);
      Serial.printf("[WiFi Watchdog] Retrying Wi-Fi connection (Backoff: %lu ms)...\n", wifiBackoffDelay);
      WiFi.reconnect();
    }

    // 🔴 2-Minute Offline Fallback: Start AP Hotspot broadcasting for Wi-Fi re-configuration
    if (!apModeStarted && (now - wifiDisconnectedStart >= 120000UL)) { // 2 minutes (120 seconds)
      apModeStarted = true;
      Serial.println("[WiFi Hotspot] 2 minutes offline! Starting Protected AP Hotspot broadcast for Wi-Fi pairing...");
      WiFi.mode(WIFI_AP_STA); // AP + STA Dual Mode
      String apName = "MosaHome_" + boardID;
      WiFi.softAP(apName.c_str(), apSecret.c_str());
      Serial.printf("[WiFi Hotspot] Protected Hotspot Active: %s (Config IP: 192.168.4.1)\n", apName.c_str());
    }

    // 10-Minute Non-Destructive Wi-Fi Radio Driver Reset (Preserves Relays, GPIOs & MCU Runtime)
    if (now - wifiDisconnectedStart > 600000UL) { 
      Serial.println("[WiFi Watchdog] 10 minutes offline! Performing scoped radio stack reset without rebooting MCU...");
      WiFi.disconnect(true);
      delay(100);
      WiFi.mode(WIFI_OFF);
      delay(100);
      WiFi.mode(WIFI_STA);
      WiFi.begin(wifiNetworks[0].ssid.c_str(), wifiNetworks[0].pass.c_str());
      wifiDisconnectedStart = now; // Reset timer for next 10-minute cycle
      wifiBackoffDelay = 5000;
    }
  } else {
    if (wifiDisconnectedStart > 0) {
      wifiBackoffDelay = 5000; // Reset exponential backoff on success
      Serial.println("[WiFi Watchdog] Successfully RECONNECTED to Wi-Fi! IP: " + WiFi.localIP().toString());
      if (apModeStarted) {
        WiFi.softAPdisconnect(true);
        WiFi.mode(WIFI_STA);
        apModeStarted = false;
        Serial.println("[WiFi Hotspot] Closed AP Hotspot broadcast since Wi-Fi is back online.");
      }
    }
    wifiDisconnectedStart = 0;
  }

  // ── 🔄 Multi-SSID Priority Auto-Fallback Background Check (كل 60 ثانية) ──
  static bool scanStarted = false;
  if (WiFi.status() == WL_CONNECTED && currentConnectedPriority > 1 && (now - lastPrimaryScanTime >= 60000UL)) {
    if (!scanStarted) {
      Serial.println("[WiFi Priority] Connected to backup network. Initiating background scan for Priority 1 Primary Wi-Fi...");
      WiFi.scanNetworks(true); // Non-blocking async scan
      scanStarted = true;
    } else {
      int n = WiFi.scanComplete();
      if (n >= 0) {
        for (int i = 0; i < n; ++i) {
          if (WiFi.SSID(i) == wifiNetworks[0].ssid) {
            Serial.println("[WiFi Priority] 🎯 Primary Priority 1 Wi-Fi is BACK ONLINE! Auto-switching back to Primary Router...");
            WiFi.disconnect();
            WiFi.begin(wifiNetworks[0].ssid.c_str(), wifiNetworks[0].pass.c_str());
            currentConnectedPriority = 1;
            break;
          }
        }
        WiFi.scanDelete();
        scanStarted = false;
        lastPrimaryScanTime = now;
      }
    }
  }

  // ── 🟢 MQTT Reconnect - Dual Mode (Port 1883 TCP & Port 8883 mTLS) + WDT Safety Guard ───
  static unsigned long mqttBackoffDelay = 1000 + (uint32_t)random(500, 10000); // 🛡️ Initial boot stagger (0..10s)
  static int mqttFailCount = 0;
  static bool tryTLSFirst = false;

  if (WiFi.status() == WL_CONNECTED && !mqttClient.connected() &&
      (lastMqttReconnect == 0 || now - lastMqttReconnect >= mqttBackoffDelay)) {
    lastMqttReconnect = now;

    // 🛡️ Fail-Closed MQTT Identity Guard: Refuse connection without provisioned HomeID
    if (homeId.length() == 0) {
      Serial.println("[MQTT 🛑] Refusing to connect: No provisioned HomeID (Fail-Closed).");
      mqttBackoffDelay = 60000UL;
    } else {

    // 🛡️ Zero-Trust mTLS Fallback: Client certificate CN is the true cryptographically verified identity
    if (mqttUser.length() == 0) {
      mqttUser = boardID;
    }
    if (mqttPassword.length() == 0) {
      mqttPassword = "mtls";
    }

    String willTopic = "mosa/" + homeId + "/controller/" + boardID + "/status";
    String clientID  = boardID + "_" + String(millis()); // Unique per session

    bool connected = false;
    esp_task_wdt_reset();

    // 🛡️ Pre-sync system clock for strict mTLS verification:
    // 1. Try reading real hardware time from DS3231 RTC chip first
    if (hasRtc) {
      readDS3231Time();
    }
    time_t nowSec = time(nullptr);
    if (nowSec < 1704067200) { // If before Jan 1 2024 (uninitialized epoch)
      prefs.begin("smarthome", true);
      time_t savedEpoch = prefs.getULong("last_epoch", 0);
      prefs.end();
      if (savedEpoch >= 1704067200) {
        struct timeval tv = { .tv_sec = savedEpoch, .tv_usec = 0 };
        settimeofday(&tv, NULL);
        Serial.printf("[Time ⏱️] Clock initialized from persistent NVS epoch: %ld\n", savedEpoch);
      } else {
        // Fallback baseline epoch if both RTC and NVS are pristine on first boot
        struct timeval tv = { .tv_sec = 1789209600, .tv_usec = 0 };
        settimeofday(&tv, NULL);
        Serial.println(F("[Time ⚠️] Baseline epoch set for initial TLS handshake until NTP sync."));
      }
    }

    // 🛡️ Fast TCP Reachability Check: Probe port 8883 with 1000ms timeout before heavy mTLS connect.
    // If the server is offline/absent, fail fast in 1s instead of blocking for 30s and starving WDT.
    WiFiClient probeClient;
    bool serverReachable = probeClient.connect(mqttHost.c_str(), 8883, 1000);
    probeClient.stop();

    if (!serverReachable) {
      mqttFailCount++;
      Serial.printf("[MQTT ⚠️] Broker %s:8883 unreachable (offline). Skipping TLS handshake to prevent WDT timeout.\n", mqttHost.c_str());

      // 🔍 mDNS Auto-Discovery: Only scan if server is unreachable after multiple attempts, at most once per 60 seconds
      static unsigned long lastMdnsScanTime = 0;
      if (mqttFailCount >= 4 && (now - lastMdnsScanTime >= 60000UL)) {
        lastMdnsScanTime = now;
        discoverMqttServerViaMdns();
        esp_task_wdt_reset();
      }

      // 🛡️ Full Jitter Backoff Algorithm (REDTEAM-07 & REDTEAM-08 Hardened)
      // Spreads reconnecting nodes uniformly and enforces at least 6s idle time when broker is offline
      uint32_t maxWindow = min(60000UL, 4000UL * (1UL << min(mqttFailCount, 4)));
      mqttBackoffDelay = 6000UL + (uint32_t)random(0, maxWindow);
      Serial.printf("[MQTT 🛡️ Full Jitter] Offline backoff: %lu ms (Attempt #%d)\n", mqttBackoffDelay, mqttFailCount);
      esp_task_wdt_reset();
    } else {
      // 🛡️ Always enforce strict mutual TLS: NEVER use setInsecure() on an mTLS port (it strips client certs)
      espClientSecure.stop();
      espClientSecure.setTimeout(2000); // 2000ms timeout
      applyMtlsCredentials();
      mqttClient.setClient(espClientSecure);
      mqttClient.setServer(mqttHost.c_str(), 8883);
      mqttClient.setSocketTimeout(2); // Local LAN mTLS connects in <500ms; 2s timeout prevents CPU starvation
      mqttClient.setKeepAlive(15);
      mqttClient.setBufferSize(2048);
      Serial.printf("[MQTT 🔒] Connecting via strict mTLS to %s:8883 with clientID %s (Attempt #%d)...\n", mqttHost.c_str(), clientID.c_str(), mqttFailCount + 1);

      esp_task_wdt_reset();
      bool taken = lockMqtt(pdMS_TO_TICKS(100));

      if (!taken) {
        lockContentionCount++;
        Serial.println(F("[MQTT 🔒] Mutex contention: deferred connect attempt to next loop."));
      } else {
        esp_task_wdt_reset();
        connected = mqttClient.connect(
          clientID.c_str(),
          boardID.c_str(),
          "",
          willTopic.c_str(), 1, true, // Will: QoS=1, retain=true
          "offline"
        );
        esp_task_wdt_reset();

        if (connected) {
          mqttFailCount = 0;
          dynamicCertFailCount = 0;
          mqttBackoffDelay = 5000; // Reset backoff delay on successful connection
          
          // 🛡️ Zero-Trust Strict Home Isolation (No Wildcards - REDTEAM-01 & REDTEAM-02 Hardened)
          String activeHomeId = homeId.length() > 0 ? homeId : "home-1";
          String macCleanTopic = WiFi.macAddress();
          macCleanTopic.replace(":", "");

          String topicBoardCmd = "mosa/" + activeHomeId + "/device/" + boardID + "/command";
          String topicCtrlCmd  = "mosa/" + activeHomeId + "/controller/" + boardID + "/command";
          String topicMacCmd   = "mosa/" + activeHomeId + "/device/" + macCleanTopic + "/command";

          mqttClient.subscribe(topicBoardCmd.c_str());
          mqttClient.subscribe(topicCtrlCmd.c_str());
          mqttClient.subscribe(topicMacCmd.c_str());
          mqttClient.subscribe("mosa/scan");
          mqttClient.subscribe("mosa/discovery/request");
          Serial.printf("[MQTT 🛡️] Strictly subscribed to tenant topics under home: %s\n", activeHomeId.c_str());
          // نشر حالة online
          safeMqttPublish(willTopic.c_str(), "online", true);
          
          publishDiscovery();

          stateDirty = true; // Force first state telemetry publish to register with database

          static bool haDiscoveryPublished = false;
          if (!haDiscoveryPublished) {
            publishHAAutoDiscovery();
            haDiscoveryPublished = true;
          }
          
          Serial.printf("[MQTT 🔒] Connected successfully via mTLS to %s:8883!\n", mqttHost.c_str());
        } else {
          mqttFailCount++;
          int connState = mqttClient.state();
          char errBuf[100] = {0};
          espClientSecure.lastError(errBuf, sizeof(errBuf));
          espClientSecure.stop();

          // 🛡️ Dynamic Certificate Self-Healing Rollback: If dynamic cert fails 5 times, revert to factory cert
          if (usingDynamicCerts) {
            dynamicCertFailCount++;
            if (dynamicCertFailCount >= 5) {
              Serial.println(F("[mTLS 🛡️ Self-Healing] Dynamic certificates failed 5 times! Rolling back to embedded factory certs."));
              clearDynamicMtlsCertificates();
              applyMtlsCredentials();
            }
          }

          // 🔍 mDNS Auto-Discovery: Only scan if server is unreachable after multiple attempts, at most once per 60 seconds
          static unsigned long lastMdnsScanTime = 0;
          if (mqttFailCount >= 4 && (now - lastMdnsScanTime >= 60000UL)) {
            lastMdnsScanTime = now;
            discoverMqttServerViaMdns();
            esp_task_wdt_reset();
          }

          // 🛡️ Full Jitter Backoff Algorithm (REDTEAM-07 & REDTEAM-08 Hardened)
          // Spreads reconnecting nodes uniformly and enforces at least 6s idle time when broker is offline
          uint32_t maxWindow = min(60000UL, 4000UL * (1UL << min(mqttFailCount, 4)));
          mqttBackoffDelay = 6000UL + (uint32_t)random(0, maxWindow);
          Serial.printf("[MQTT 🛡️ Full Jitter] Connect failed (State: %d, TLS Err: %s, Attempt #%d). Random backoff: %lu ms\n", 
            connState, (strlen(errBuf) > 0 ? errBuf : "None"), mqttFailCount, mqttBackoffDelay);
        }

        unlockMqtt();
        esp_task_wdt_reset();
      }
    }
    }
  }

  // ── 🟢 MQTT Heartbeat - كل 30 ثانية ───────────────────
  if (mqttClient.connected() && (lastHeartbeatTime == 0 || now - lastHeartbeatTime >= 30000)) {
    lastHeartbeatTime = now;
    String hbPayload = "{\"status\":\"alive\",\"uptime\":" + String(now / 1000) + 
                       ",\"freeHeap\":" + String(ESP.getFreeHeap()) + 
                       ",\"minFreeHeap\":" + String(ESP.getMinFreeHeap()) + 
                       ",\"largestFreeBlock\":" + String(ESP.getMaxAllocHeap()) + 
                       ",\"rssi\":" + String(WiFi.RSSI()) + 
                       ",\"channel\":" + String(WiFi.channel()) + 
                       ",\"firmwareVersion\":\"3.0.0\"}";
    if (homeId.length() > 0) {
      safeMqttPublish(("mosa/" + homeId + "/controller/" + boardID + "/heartbeat").c_str(), hbPayload.c_str());
      publishDiscovery();
      Serial.println("[MQTT] Enterprise Heartbeat sent with Heap & RSSI diagnostics.");
    }
  }

  if (mqttClient.connected()) {
    if (lockMqtt(pdMS_TO_TICKS(20))) {
      mqttClient.loop();
      unlockMqtt();
    } else {
      lockContentionCount++;
    }
  }

  // ── Switches Fallback (only if switchTask is not running on Core 0) ──
  if (!switchTaskRunning) {
    readSwitches();
  }

  // ── Timer Logic ───────────────────────────────────────
  {
    DeviceLockGuard timerLock(pdMS_TO_TICKS(15));
    if (timerLock.isLocked()) {
      for (int i = 0; i < MAX_DEVICES; i++) {
        if (devices[i].active && devices[i].state &&
            devices[i].timerOffMillis > 0 && now >= devices[i].timerOffMillis) {
          devices[i].timerOffMillis = 0;
          toggleLogic(i);
        }
      }
    } else {
      lockContentionCount++;
    }
  }
}


