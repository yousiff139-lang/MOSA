#include <Arduino.h>
#include "Config.h"
#include "BleProvisioner.h"
#include "NetworkManager.h"

// Periodic Telemetry
unsigned long lastTelemetryMillis = 0;
const long telemetryInterval = 60000; // 1 minute

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n--- MOSA Smart Device OS ---");
    
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW); // Default OFF
    
    // Load non-volatile settings
    loadConfig();
    Serial.println("Device ID: " + config.device_id);
    
    if (!config.is_provisioned) {
        // --- للاختبار فقط ---
        config.ssid        = "YOUR_WIFI_SSID";
        config.password    = "YOUR_WIFI_PASS";
        config.mqtt_server = "192.168.1.100"; // قم بتعديل هذا الـ IP إلى جهازك
        config.mqtt_port   = 1883;
        config.mqtt_user   = "mosa_device";
        config.mqtt_password = "mosa_mqtt_secret";
        config.home_id     = "home-1";
        config.device_id   = "dev-0";
        config.is_provisioned = true;
        saveConfig();
        Serial.println("[Config] Test config saved!");
        // ---------------------
        
        Serial.println("Device is NOT provisioned. Starting BLE Provisioning Mode...");
        BleProvisioner::init();
    } else {
        Serial.println("Device is provisioned. Connecting to Network...");
        NetworkManager::init();
    }
}

void loop() {
    if (!config.is_provisioned) {
        // We are in BLE provisioning mode
        if (BleProvisioner::isProvisioningComplete()) {
            Serial.println("Provisioning completed! Rebooting in 3 seconds...");
            BleProvisioner::stop();
            delay(3000);
            ESP.restart();
        }
    } else {
        // We are in Normal Mode
        NetworkManager::loop();
        
        // Optional: Reset mechanism (e.g. holding a button for 10s)
        // If triggered: resetConfig(); ESP.restart();
        
        // Periodic Telemetry Publication
        if (NetworkManager::isConnected()) {
            unsigned long currentMillis = millis();
            if (currentMillis - lastTelemetryMillis >= telemetryInterval) {
                lastTelemetryMillis = currentMillis;
                NetworkManager::publishState(digitalRead(RELAY_PIN) == HIGH);
            }
        }
    }
}
