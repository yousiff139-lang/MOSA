#ifndef CONFIG_H
#define CONFIG_H

// ==========================================
// 1. WiFi & Portal Settings
// ==========================================
#define PORTAL_SSID "MOSA-Setup"
#define PORTAL_PASS "mosa1234"
#define CONFIG_PORTAL_TIMEOUT 180

// ==========================================
// 2. MQTT Gateway Settings
// ==========================================
#define DEFAULT_MQTT_SERVER "192.168.1.101"
#define DEFAULT_MQTT_PORT 1883
#define DEFAULT_MQTT_USER "mosa_device"
#define DEFAULT_MQTT_PASS "mosa_mqtt_secret"

// ==========================================
// 3. Hardware Pin Mapping (ESP32-S3)
// ==========================================
#define OLED_SDA 2
#define OLED_SCL 42
#define DHT_PIN 7
#define ACS712_PIN 4
#define PIR_PIN 41

// Relay & Button Slots
#define RELAY_COUNT 6
const int relayPins[RELAY_COUNT] = {15, 16, 17, 18, 19, 20};
const int buttonPins[RELAY_COUNT] = {33, 34, 35, 36, 37, 38};

// Relay Active Logic Config
#define RELAY_ACTIVE_LOW

// ==========================================
// 4. Calibration Offsets
// ==========================================
#define TEMP_CALIBRATION_OFFSET 0.0
#define HUMIDITY_CALIBRATION_OFFSET 0.0

// ==========================================
// 5. System Config
// ==========================================
#define WDT_TIMEOUT_SECONDS 30
#define SENSOR_READ_INTERVAL 10000 // 10 seconds

#endif // CONFIG_H
