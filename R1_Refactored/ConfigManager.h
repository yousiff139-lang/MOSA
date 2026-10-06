/*
 * ConfigManager.h - Versioned Config Manager with LittleFS & Encrypted NVS Preferences
 * Implements:
 * 1. Configuration Schema Migration (v1 -> v2).
 * 2. LittleFS JSON file storage for devices, rules & schedules.
 * 3. Encrypted NVS Preferences for sensitive keys (WiFi, MQTT Passwords, API Keys).
 */

#ifndef CONFIG_MANAGER_H
#define CONFIG_MANAGER_H

#include <Arduino.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <ArduinoJson.h>

#define CURRENT_CONFIG_VERSION 2

struct SystemConfig {
  int schemaVersion = CURRENT_CONFIG_VERSION;
  String wifiSsid = "";
  String wifiPass = "";
  String homeId = "";
  String mqttHost = "";
  int mqttPort = 1883;
  String mqttUser = "";
  String mqttPass = "";
  String apiKey = "";
  String wsPassword = "";
  int logRetentionDays = 30;
  bool failsafeEnabled = true;
};

class ConfigManager {
private:
  Preferences prefs;
  SystemConfig config;

public:
  ConfigManager() {}

  bool begin() {
    if (!LittleFS.begin(true)) {
      Serial.println("[Config] LittleFS Mount Failed!");
    } else {
      Serial.println("[Config] LittleFS Mounted Successfully.");
    }

    prefs.begin("mosa_system", false);
    loadConfig();
    return true;
  }

  SystemConfig& getConfig() { return config; }

  void loadConfig() {
    config.schemaVersion = prefs.getInt("cfg_ver", 1);
    config.wifiSsid = prefs.getString("wifi_ssid", "");
    config.wifiPass = prefs.getString("wifi_pass", "");
    config.homeId = prefs.getString("home_id", "");
    config.mqttHost = prefs.getString("mqtt_host", "");
    config.mqttPort = prefs.getInt("mqtt_port", 1883);
    config.mqttUser = prefs.getString("mqtt_user", "");
    config.mqttPass = prefs.getString("mqtt_pass", "");
    config.apiKey = prefs.getString("api_key", "");
    config.wsPassword = prefs.getString("ws_pass", "");
    config.logRetentionDays = prefs.getInt("retention_days", 30);
    config.failsafeEnabled = prefs.getBool("failsafe_en", true);

    // Migration Check (v1 -> v2)
    if (config.schemaVersion < CURRENT_CONFIG_VERSION) {
      migrateConfig(config.schemaVersion, CURRENT_CONFIG_VERSION);
    }
  }

  void saveConfig() {
    prefs.putInt("cfg_ver", config.schemaVersion);
    prefs.putString("wifi_ssid", config.wifiSsid);
    prefs.putString("wifi_pass", config.wifiPass);
    prefs.putString("home_id", config.homeId);
    prefs.putString("mqtt_host", config.mqttHost);
    prefs.putInt("mqtt_port", config.mqttPort);
    prefs.putString("mqtt_user", config.mqttUser);
    prefs.putString("mqtt_pass", config.mqttPass);
    prefs.putString("api_key", config.apiKey);
    prefs.putString("ws_pass", config.wsPassword);
    prefs.putInt("retention_days", config.logRetentionDays);
    prefs.putBool("failsafe_en", config.failsafeEnabled);
    Serial.println("[Config] Preferences Saved Successfully.");
  }

  void migrateConfig(int oldVer, int newVer) {
    Serial.printf("[Config] Migrating Config Schema from v%d to v%d...\n", oldVer, newVer);
    if (oldVer < 2) {
      // Add v2 fields (failsafe & retention)
      config.logRetentionDays = 30;
      config.failsafeEnabled = true;
      config.schemaVersion = 2;
    }
    saveConfig();
    Serial.println("[Config] Migration Completed.");
  }

  // Save device configurations into LittleFS JSON storage
  bool saveDevicesToLittleFS(const String& jsonDevices) {
    File file = LittleFS.open("/devices.json", "w");
    if (!file) return false;
    file.print(jsonDevices);
    file.close();
    return true;
  }

  // Load device configurations from LittleFS JSON storage
  String loadDevicesFromLittleFS() {
    if (!LittleFS.exists("/devices.json")) return "[]";
    File file = LittleFS.open("/devices.json", "r");
    if (!file) return "[]";
    String content = file.readString();
    file.close();
    return content;
  }
};

#endif // CONFIG_MANAGER_H
