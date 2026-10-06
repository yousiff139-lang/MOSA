#include "ConfigManager.h"
#include <Preferences.h>

Preferences preferences;

void ConfigManager::init() {
    // Basic init if required
}

bool ConfigManager::loadConfig(MosaConfig& config) {
    preferences.begin("mosa_cfg", true); // true = read-only
    
    String homeId = preferences.getString("homeId", "");
    String deviceId = preferences.getString("deviceId", "");
    String mqttBroker = preferences.getString("mqttBroker", "");
    String mqttUser = preferences.getString("mqttUser", "");
    String mqttPass = preferences.getString("mqttPass", "");
    
    preferences.end();

    if (homeId.length() == 0 || deviceId.length() == 0) {
        return false;
    }

    strlcpy(config.homeId, homeId.c_str(), sizeof(config.homeId));
    strlcpy(config.deviceId, deviceId.c_str(), sizeof(config.deviceId));
    strlcpy(config.mqttBroker, mqttBroker.c_str(), sizeof(config.mqttBroker));
    strlcpy(config.mqttUser, mqttUser.c_str(), sizeof(config.mqttUser));
    strlcpy(config.mqttPass, mqttPass.c_str(), sizeof(config.mqttPass));

    return true;
}

bool ConfigManager::saveConfig(const MosaConfig& config) {
    preferences.begin("mosa_cfg", false); // false = read/write
    
    preferences.putString("homeId", String(config.homeId));
    preferences.putString("deviceId", String(config.deviceId));
    preferences.putString("mqttBroker", String(config.mqttBroker));
    preferences.putString("mqttUser", String(config.mqttUser));
    preferences.putString("mqttPass", String(config.mqttPass));
    
    preferences.end();
    return true;
}

void ConfigManager::clearConfig() {
    preferences.begin("mosa_cfg", false);
    preferences.clear();
    preferences.end();
}
