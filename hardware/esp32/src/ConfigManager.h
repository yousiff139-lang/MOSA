#pragma once
#include <Arduino.h>

struct MosaConfig {
    char homeId[64];
    char deviceId[64];
    char mqttBroker[128];
    char mqttUser[64];
    char mqttPass[64];
};

class ConfigManager {
public:
    static void init();
    static bool loadConfig(MosaConfig& config);
    static bool saveConfig(const MosaConfig& config);
    static void clearConfig();
};
