#include "NetworkManager.h"
#include "Config.h"
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long NetworkManager::lastReconnectAttempt = 0;

// ─── Topic Builders ──────────────────────────────
static String cmdTopic() {
    return "mosa/" + config.home_id + 
           "/device/" + config.device_id + "/command";
}

static String stateTopic() {
    return "mosa/" + config.home_id + 
           "/device/" + config.device_id + "/state";
}

static String statusTopic() {
    return "mosa/" + config.home_id + 
           "/device/" + config.device_id + "/status";
}

// ─── Init ────────────────────────────────────────
void NetworkManager::init() {
    WiFi.mode(WIFI_STA);
    connectWiFi();
    mqttClient.setServer(
        config.mqtt_server.c_str(), 
        config.mqtt_port
    );
    mqttClient.setCallback(mqttCallback);
    mqttClient.setBufferSize(512);
}

// ─── WiFi ────────────────────────────────────────
void NetworkManager::connectWiFi() {
    if (WiFi.status() == WL_CONNECTED) return;

    Serial.println("[WiFi] Connecting to: " + config.ssid);
    WiFi.begin(config.ssid.c_str(), 
               config.password.c_str());

    int retries = 0;
    while (WiFi.status() != WL_CONNECTED && 
           retries < 20) {
        delay(500);
        Serial.print(".");
        retries++;
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connected: " + 
            WiFi.localIP().toString());
    } else {
        Serial.println("\n[WiFi] Failed!");
    }
}

// ─── MQTT ────────────────────────────────────────
void NetworkManager::connectMQTT() {
    if (mqttClient.connected()) return;

    Serial.print("[MQTT] Connecting...");
    String clientId = "mosa-" + config.device_id;

    bool connected = mqttClient.connect(
        clientId.c_str(),
        config.mqtt_user.c_str(),
        config.mqtt_password.c_str(),
        statusTopic().c_str(),  // LWT topic
        1,                      // LWT QoS
        true,                   // LWT retain
        "{\"online\":false}"    // LWT payload
    );

    if (connected) {
        Serial.println(" Connected!");
        Serial.println("[MQTT] home_id:   " + config.home_id);
        Serial.println("[MQTT] device_id: " + config.device_id);

        // Subscribe to commands
        mqttClient.subscribe(cmdTopic().c_str(), 1);
        Serial.println("[MQTT] Subscribed: " + cmdTopic());

        // Publish online status (retained)
        mqttClient.publish(
            statusTopic().c_str(),
            "{\"online\":true}",
            true
        );

        // Publish current relay state immediately
        publishState(digitalRead(RELAY_PIN) == HIGH);

    } else {
        Serial.printf(" Failed! rc=%d\n", 
            mqttClient.state());
        Serial.println("[MQTT] home_id:   '" + 
            config.home_id + "'");
        Serial.println("[MQTT] device_id: '" + 
            config.device_id + "'");
    }
}

// ─── MQTT Callback ───────────────────────────────
void NetworkManager::mqttCallback(
    char* topic, 
    byte* payload, 
    unsigned int length
) {
    String message;
    for (unsigned int i = 0; i < length; i++) {
        message += (char)payload[i];
    }

    Serial.println("[MQTT] ← " + String(topic));
    Serial.println("[MQTT]   " + message);

    // Only handle our command topic
    if (String(topic) != cmdTopic()) return;

    StaticJsonDocument<512> doc;
    if (deserializeJson(doc, message) != 
        DeserializationError::Ok) {
        Serial.println("[MQTT] JSON parse error");
        return;
    }

    String type = doc["type"].as<String>();

    if (type == "toggle") {
        bool current = digitalRead(RELAY_PIN) == HIGH;
        bool newState = !current;
        digitalWrite(RELAY_PIN, newState ? HIGH : LOW);
        Serial.printf("[RELAY] Toggle: %s → %s\n",
            current ? "ON" : "OFF",
            newState ? "ON" : "OFF");
        publishState(newState);

    } else if (type == "set") {
        String state = doc["state"].as<String>();
        bool turnOn = (state == "ON");
        digitalWrite(RELAY_PIN, turnOn ? HIGH : LOW);
        Serial.printf("[RELAY] Set: %s\n", 
            turnOn ? "ON" : "OFF");
        publishState(turnOn);
    }
}

// ─── Publish State ───────────────────────────────
void NetworkManager::publishState(bool state) {
    if (!mqttClient.connected()) return;

    StaticJsonDocument<256> doc;
    doc["isOn"]     = state;
    doc["state"]    = state ? "ON" : "OFF";
    doc["deviceId"] = config.device_id;
    doc["homeId"]   = config.home_id;
    doc["timestamp"] = millis();

    String payload;
    serializeJson(doc, payload);

    // retain=true → Dashboard يقرأ الحالة فوراً
    mqttClient.publish(
        stateTopic().c_str(),
        payload.c_str(),
        true
    );

    Serial.println("[MQTT] → " + stateTopic());
    Serial.println("[MQTT]   " + payload);
}

// ─── Loop ────────────────────────────────────────
void NetworkManager::loop() {
    if (WiFi.status() != WL_CONNECTED) {
        connectWiFi();
        return;
    }

    if (!mqttClient.connected()) {
        unsigned long now = millis();
        if (now - lastReconnectAttempt > 5000) {
            lastReconnectAttempt = now;
            connectMQTT();
        }
    } else {
        mqttClient.loop();
    }
}

bool NetworkManager::isConnected() {
    return WiFi.status() == WL_CONNECTED && 
           mqttClient.connected();
}
