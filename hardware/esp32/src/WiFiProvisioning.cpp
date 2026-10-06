#include "WiFiProvisioning.h"
#include <WiFiManager.h>
#include <ArduinoJson.h>

WiFiManager wm;

// Custom Parameters to save MOSA specific configs
WiFiManagerParameter custom_home_id("home_id", "Home ID", "", 64);
WiFiManagerParameter custom_device_id("device_id", "Device ID", "", 64);
WiFiManagerParameter custom_mqtt_broker("mqtt_broker", "MQTT Broker IP", "", 128);

void WiFiProvisioning::startProvisioningMode() {
    Serial.println("Starting AP Provisioning Mode...");
    
    wm.addParameter(&custom_home_id);
    wm.addParameter(&custom_device_id);
    wm.addParameter(&custom_mqtt_broker);

    // Create AP Name based on MAC address
    String mac = WiFi.macAddress();
    mac.replace(":", "");
    String apName = "MOSA_SETUP_" + mac.substring(6);

    // This blocks until the user connects to the AP and provides credentials
    if (!wm.autoConnect(apName.c_str(), "mosa1234")) {
        Serial.println("Failed to connect and hit timeout");
        delay(3000);
        ESP.restart(); // Reset and try again
    }

    // If we get here, WiFi was connected!
    Serial.println("WiFi Connected!");

    // Save MOSA specific configs
    MosaConfig config;
    ConfigManager::loadConfig(config); // Load existing if any

    if (String(custom_home_id.getValue()).length() > 0) {
        strlcpy(config.homeId, custom_home_id.getValue(), sizeof(config.homeId));
    }
    if (String(custom_device_id.getValue()).length() > 0) {
        strlcpy(config.deviceId, custom_device_id.getValue(), sizeof(config.deviceId));
    }
    if (String(custom_mqtt_broker.getValue()).length() > 0) {
        strlcpy(config.mqttBroker, custom_mqtt_broker.getValue(), sizeof(config.mqttBroker));
    }

    ConfigManager::saveConfig(config);
    Serial.println("Provisioning Complete. Configuration Saved.");
}

bool WiFiProvisioning::isProvisioned() {
    MosaConfig config;
    if (ConfigManager::loadConfig(config)) {
        return (String(config.homeId).length() > 0 && String(config.mqttBroker).length() > 0);
    }
    return false;
}

void WiFiProvisioning::connectToWiFi() {
    // If not provisioned, force into AP mode
    if (!isProvisioned()) {
        startProvisioningMode();
    } else {
        // WiFiManager will automatically connect to saved credentials
        if (!wm.autoConnect()) {
            Serial.println("Failed to connect, spinning up AP again...");
            startProvisioningMode();
        }
    }
}
