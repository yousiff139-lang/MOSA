// packages/firmware/include/config.h
#pragma once

// ═══════════════════════════════════════════
// MOSA Smart Home - Node Configuration
// Change these values per installation
// ═══════════════════════════════════════════

// Home & Device Identity
#define HOME_ID          "home_hq_1"
#define CONTROLLER_MAC   "AA:BB:CC:DD:EE:FF"
#define FIRMWARE_VERSION "1.0.0"

// Network
#define WIFI_AP_NAME     "MOSA-Setup"
#define WIFI_AP_PASS     "mosa1234"

// MQTT
#define MQTT_PORT        1883
#define MQTT_USER        "mosa_backend"
#define MQTT_PASS        "mosa_secure_mqtt_2024"
#define MQTT_KEEPALIVE   60
#define MQTT_QOS_STATE   1
#define MQTT_QOS_SENSOR  0

// Pins - adjust per board revision
#define PIN_RELAY_1    1
#define PIN_RELAY_2    2
#define PIN_RELAY_3    3
#define PIN_RELAY_4    4
#define PIN_RELAY_5    5
#define PIN_RELAY_6    6
#define PIN_RELAY_7    7
#define PIN_RELAY_8    8
#define PIN_DHT22      19
#define PIN_PIR        21
#define PIN_ACS712     35  // ADC1 only
#define PIN_BUTTON_1   14
#define PIN_BUTTON_2   15
#define PIN_SDA        21
#define PIN_SCL        22

// Timing
#define SENSOR_INTERVAL_MS    10000
#define MOTION_DEBOUNCE_MS    3000
#define WIFI_TIMEOUT_MS       30000
#define WATCHDOG_TIMEOUT_S    30

// Calibration
#define TEMP_OFFSET       0.0f
#define HUMIDITY_OFFSET   0.0f
#define ACS712_SENSITIVITY 0.1f  // 100mV/A for 20A
#define VOLTAGE_MAINS     220.0f // Iraqi grid

// Feature flags
#define FEATURE_OLED      true
#define FEATURE_RTC       true
#define FEATURE_ACS712    true
#define FEATURE_WIFI_MGR  true  // WiFiManager portal

// IPC (Inter-Process Communication) STRUCTURES
struct MqttMessage {
    char topic[128];
    char payload[256];
};

struct RelayCommand {
    uint8_t relayId; // 1 to 8
    bool state;      // true = ON, false = OFF
};
