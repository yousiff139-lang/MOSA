#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

#define RELAY_PIN 23

struct DeviceConfig {
    String ssid;
    String password;
    String mqtt_server;
    uint16_t mqtt_port;
    String mqtt_user;
    String mqtt_password;
    String home_id; // Maps to homeId in backend
    String device_id; // e.g. "MOSA-DEV-A1B2"
    bool is_provisioned;
};

// Global Config Instance
extern DeviceConfig config;

// Functions to load/save from Preferences (NVS)
void loadConfig();
void saveConfig();
void resetConfig();

#endif // CONFIG_H
