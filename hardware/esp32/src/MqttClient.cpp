#include "MqttClient.h"
#include <WiFi.h>
#include <ArduinoJson.h>
#include "ConfigManager.h"
#include "HardwareController.h"

WiFiClient espClient;
PubSubClient mqttClient(espClient);

MosaConfig currentConfig;
char commandTopic[128];
char statusTopic[128];
char stateTopic[128];

void MosaMqttClient::init() {
    if (!ConfigManager::loadConfig(currentConfig)) {
        Serial.println("Cannot init MQTT, configuration is missing.");
        return;
    }

    // Build topics
    sprintf(commandTopic, "mosa/%s/device/%s/command", currentConfig.homeId, currentConfig.deviceId);
    sprintf(statusTopic, "mosa/%s/device/%s/status", currentConfig.homeId, currentConfig.deviceId);
    sprintf(stateTopic, "mosa/%s/device/%s/state", currentConfig.homeId, currentConfig.deviceId);

    // Setup MQTT Client
    // We assume the broker IP is passed without 'mqtt://'
    String broker = String(currentConfig.mqttBroker);
    if (broker.startsWith("mqtt://")) broker = broker.substring(7);
    
    mqttClient.setServer(broker.c_str(), 1883);
    mqttClient.setCallback(MosaMqttClient::callback);
}

void MosaMqttClient::callback(char* topic, byte* payload, unsigned int length) {
    String msg = "";
    for (unsigned int i = 0; i < length; i++) {
        msg += (char)payload[i];
    }
    Serial.printf("MQTT Message received [%s]: %s\n", topic, msg.c_str());

    if (String(topic) == String(commandTopic)) {
        // Parse JSON Command
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, msg);
        
        if (error) {
            Serial.println("Failed to parse command JSON");
            return;
        }

        const char* action = doc["action"];
        const char* state = doc["state"];
        int pin = doc["pin"] | -1;

        if (action && String(action) == "TOGGLE" && pin != -1) {
            // Set GPIO mode if not already set (in a real app, do this in init)
            pinMode(pin, OUTPUT);
            
            if (String(state) == "ON") {
                digitalWrite(pin, HIGH); // Or LOW if relay is active-low
                publishState("{\"isOn\": true, \"pin\": " + String(pin) + "}");
            } else if (String(state) == "OFF") {
                digitalWrite(pin, LOW);
                publishState("{\"isOn\": false, \"pin\": " + String(pin) + "}");
            }
        }
    }
}

void MosaMqttClient::reconnect() {
    while (!mqttClient.connected()) {
        Serial.print("Attempting MQTT connection...");
        // Create a random client ID
        String clientId = "MOSA-ESP32-" + String(random(0xffff), HEX);
        
        // Attempt to connect with LWT (Last Will and Testament)
        if (mqttClient.connect(clientId.c_str(), currentConfig.mqttUser, currentConfig.mqttPass, statusTopic, 0, true, "OFFLINE")) {
            Serial.println("connected");
            
            // Publish online status
            mqttClient.publish(statusTopic, "ONLINE", true);
            
            // Subscribe to commands
            mqttClient.subscribe(commandTopic);
        } else {
            Serial.print("failed, rc=");
            Serial.print(mqttClient.state());
            Serial.println(" try again in 5 seconds");
            delay(5000);
        }
    }
}

void MosaMqttClient::loop() {
    if (!mqttClient.connected()) {
        reconnect();
    }
    mqttClient.loop();
}

void MosaMqttClient::publishState(const char* statePayload) {
    if (mqttClient.connected()) {
        mqttClient.publish(stateTopic, statePayload, true);
    }
}
