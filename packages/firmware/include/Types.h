#ifndef TYPES_H
#define TYPES_H

#include <Arduino.h>

// Represents the system's connection state
enum SystemState {
    STATE_BOOTING,
    STATE_WIFI_CONNECTING,
    STATE_WIFI_CONNECTED,
    STATE_MQTT_CONNECTING,
    STATE_ONLINE,
    STATE_AP_FALLBACK,
    STATE_OTA_UPDATING,
    STATE_OFFLINE_LOCAL
};

// Represents a Relay's state
struct RelayState {
    bool isOn;
    unsigned long lastSwitchedTime;
    bool isCompressor; // Requires 3 min protection
};

// Represents Sensor readings
struct SensorData {
    float temperature;
    float humidity;
    float currentAmps;
    unsigned long lastReadTime;
    bool dhtFault;
};

// FreeRTOS Task Handles
extern TaskHandle_t TaskHandle_Network;
extern TaskHandle_t TaskHandle_Control;
extern TaskHandle_t TaskHandle_Sensors;

#endif // TYPES_H
