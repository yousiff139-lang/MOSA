#include "Config.h"
#include <Preferences.h>
#include <WiFi.h>

Preferences preferences;
DeviceConfig config;

void loadConfig() {
    preferences.begin("mosa-config", true); // true = Read Only
    
    config.ssid = preferences.getString("ssid", "");
    config.password = preferences.getString("password", "");
    config.mqtt_server = preferences.getString("mqtt_server", "");
    config.mqtt_port = preferences.getUShort("mqtt_port", 1883);
    config.mqtt_user = preferences.getString("mqtt_user", "");
    config.mqtt_password = preferences.getString("mqtt_pass", "");
    config.home_id = preferences.getString("home_id", "");
    config.device_id = preferences.getString("device_id", "");
    
    // Auto-generate device ID if empty
    if (config.device_id == "") {
        String mac = WiFi.macAddress();
        mac.replace(":", "");
        config.device_id = "MosaNode_" + mac;
    }
    
    config.is_provisioned = (config.ssid.length() > 0 && config.mqtt_server.length() > 0);
    
    preferences.end();
}

void saveConfig() {
    preferences.begin("mosa-config", false); // false = Read/Write
    
    preferences.putString("ssid", config.ssid);
    preferences.putString("password", config.password);
    preferences.putString("mqtt_server", config.mqtt_server);
    preferences.putUShort("mqtt_port", config.mqtt_port);
    preferences.putString("mqtt_user", config.mqtt_user);
    preferences.putString("mqtt_pass", config.mqtt_password);
    preferences.putString("home_id", config.home_id);
    preferences.putString("device_id", config.device_id);
    
    preferences.end();
}

void resetConfig() {
    preferences.begin("mosa-config", false);
    preferences.clear();
    preferences.end();
}
