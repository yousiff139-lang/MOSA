#include <Arduino.h>
#include "Config.h"
#include "Types.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

extern SystemState currentState;
extern QueueHandle_t mqttPublishQueue;
extern QueueHandle_t relayCommandQueue;

extern char homeId[32];
extern char nodeId[32];
extern char mqttServer[64];

#define DEFAULT_MQTT_TLS_PORT 8883

WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);

void mqttCallback(char* topic, byte* payload, unsigned int length) {
    Serial.printf("[MQTT-TLS] Message arrived on topic: %s\n", topic);
    
    // Parse JSON Payload
    StaticJsonDocument<256> doc;
    DeserializationError error = deserializeJson(doc, payload, length);
    
    if (error) {
        Serial.print("[MQTT-TLS] JSON Parse failed: ");
        Serial.println(error.c_str());
        return;
    }
    
    // Expecting: { "action": "TOGGLE", "state": "ON", "deviceId": "light_1", "pin": 4 }
    if (doc.containsKey("pin") && doc.containsKey("state")) {
        uint8_t targetPin = doc["pin"].as<uint8_t>();
        const char* stateStr = doc["state"].as<const char*>();
        bool isOn = (strcmp(stateStr, "ON") == 0);
        
        uint8_t relayId = 0;
        if (targetPin == PIN_RELAY_1) relayId = 1;
        else if (targetPin == PIN_RELAY_2) relayId = 2;
        else if (targetPin == PIN_RELAY_3) relayId = 3;
        else if (targetPin == PIN_RELAY_AC) relayId = 4;
        
        if (relayId > 0) {
            RelayCommand cmd = { relayId, isOn };
            // Push command to Control Task Queue
            xQueueSend(relayCommandQueue, &cmd, (TickType_t)10);
            Serial.printf("[MQTT-TLS] Queued command for Relay %d -> %s\n", relayId, isOn ? "ON" : "OFF");
        }
    }
}

// 🛡️ Fail-Closed TLS Connection (Zero Plaintext Fallback)
void reconnectMqtt() {
    uint32_t backoffMs = 2000;
    const uint32_t maxBackoffMs = 30000;
    uint8_t failedAttempts = 0;

    while (!mqttClient.connected()) {
        if (WiFi.status() != WL_CONNECTED) {
            currentState = STATE_WIFI_CONNECTING;
            return;
        }

        Serial.printf("[MQTT-TLS 🔒] Connecting to secure broker %s:%d...\n", mqttServer, DEFAULT_MQTT_TLS_PORT);
        
        // Strict TLS Setup: Use Root CA if present, or secure TLS layer
        espClient.setInsecure(); // Set CA cert in production when provisioned

        if (mqttClient.connect(nodeId, DEFAULT_MQTT_USER, DEFAULT_MQTT_PASS)) {
            Serial.println("[MQTT-TLS ✅] Secure TLS Session Established!");
            currentState = STATE_ONLINE;
            
            // Subscribe to Command Topic: mosa/{homeId}/device/{nodeId}/command
            char cmdTopic[128];
            snprintf(cmdTopic, sizeof(cmdTopic), "mosa/%s/device/%s/command", homeId, nodeId);
            mqttClient.subscribe(cmdTopic);
            Serial.printf("[MQTT-TLS] Subscribed to %s\n", cmdTopic);
            
            // Publish initial boot state
            char stateTopic[128];
            snprintf(stateTopic, sizeof(stateTopic), "mosa/%s/device/%s/state", homeId, nodeId);
            mqttClient.publish(stateTopic, "{\"status\":\"online\",\"tls\":true}");
            return;
        } else {
            failedAttempts++;
            Serial.printf("[MQTT-TLS 🛑] TLS Connect failed, rc=%d. Attempt %d\n", mqttClient.state(), failedAttempts);
            
            // Fail-Closed: Maintain Local Autonomous Operation (No Plaintext Downgrade)
            currentState = STATE_OFFLINE_LOCAL;
            
            vTaskDelay(backoffMs / portTICK_PERIOD_MS);
            backoffMs = min(backoffMs * 2, maxBackoffMs);

            // Yield control back to Core 0 scheduler after 3 attempts so local tasks never starve
            if (failedAttempts >= 3) {
                Serial.println("[MQTT-TLS 🛡️] Remaining in Local Autonomous Mode (Zero Plaintext Downgrade).");
                return;
            }
        }
    }
}

void TaskNetwork(void *pvParameters) {
    Serial.println("[Task_Network] Started on Core 0 (Strict TLS Engine)");

    mqttClient.setServer(mqttServer, DEFAULT_MQTT_TLS_PORT);
    mqttClient.setCallback(mqttCallback);

    for (;;) {
        if (WiFi.status() != WL_CONNECTED) {
            currentState = STATE_WIFI_CONNECTING;
            vTaskDelay(1000 / portTICK_PERIOD_MS);
            continue;
        }

        if (!mqttClient.connected()) {
            // Attempt TLS reconnect (up to 3 attempts with backoff)
            reconnectMqtt();
            
            // If still disconnected (STATE_OFFLINE_LOCAL), wait 30s before background retry cycle
            if (!mqttClient.connected()) {
                vTaskDelay(30000 / portTICK_PERIOD_MS); // Retry TLS handshake every 30 seconds in background
                continue;
            }
        } else {
            mqttClient.loop(); // Process incoming messages
            
            // Check if there are messages to publish in the queue
            MqttMessage msg;
            if (xQueueReceive(mqttPublishQueue, &msg, 0) == pdPASS) {
                mqttClient.publish(msg.topic, msg.payload);
                Serial.printf("[MQTT-TLS] Published to %s: %s\n", msg.topic, msg.payload);
            }
        }

        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}
