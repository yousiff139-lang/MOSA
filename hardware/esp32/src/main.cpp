// ==========================================
// MOSA Smart Platform - ESP32-S3 Firmware v3.0
// License: MIT - Copyright (c) 2026 MOSA
// ==========================================

// ─── 2. ALL INCLUDES ───────────────────────
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <Wire.h>
#include <RTClib.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <WiFiManager.h>
#include <esp_task_wdt.h>
#include <ESPmDNS.h>
#include "config.h"

// ─── 3. ALL DEFINES (SYSTEM SPECIFIC) ──────
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1

// ─── 4. ALL GLOBAL VARIABLES ───────────────
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
DHT dht(DHT_PIN, DHT22);
RTC_DS3231 rtc;
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// State tracking variables
String homeId = "home_hq_1";
String boardID = "";
String mqttServer = DEFAULT_MQTT_SERVER;
String localIP = "0.0.0.0";
bool relayStates[RELAY_COUNT] = {false};
unsigned long lastSensorPublish = 0;
bool pirLastState = false;

// FreeRTOS Task Handles
TaskHandle_t MqttTaskHandle = NULL;
TaskHandle_t SensorTaskHandle = NULL;

// ─── 5. FUNCTION PROTOTYPES ────────────────
void runSelfTest();
void initRelays();
void connectWiFi();
void initOLED();
void updateOLED(const char* status);
void initRTC();
void setupMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void reconnectMqtt();
void handlePhysicalButtons();
void readSensors();
float readCurrentFiltered();
float readPower();
void publishDiscovery();
String getDeviceTopic(const char* deviceId);
String getControllerStatusTopic();
String buildDevicePayload(bool isOn);
String buildSensorPayload(float temp, float humi);
String buildMotionPayload(bool detected);
void mqttTask(void* pvParameters);
void sensorTask(void* pvParameters);

// ─── 6. SETUP ──────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println(F("\n[MOSA] Starting Mosa Smart Node v3.0..."));

  // Initialize Watchdog Timer
  esp_task_wdt_init(WDT_TIMEOUT_SECONDS, true);
  esp_task_wdt_add(NULL);

  // Get Unique Board ID based on MAC address
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char buf[20];
  sprintf(buf, "MosaNode_%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  boardID = String(buf);

  // Initialize display first to show diagnostics
  initOLED();
  
  // Run Boot-up Diagnostics
  runSelfTest();

  // Initialize other physical modules
  initRTC();
  initRelays();
  dht.begin();
  pinMode(PIR_PIN, INPUT);

  // Establish Wifi Connection
  connectWiFi();

  // Configure MQTT
  setupMQTT();

  // Create FreeRTOS Tasks
  xTaskCreatePinnedToCore(
    mqttTask,
    "MQTT_Task",
    8192,
    NULL,
    1,
    &MqttTaskHandle,
    1
  );

  xTaskCreatePinnedToCore(
    sensorTask,
    "Sensor_Task",
    8192,
    NULL,
    1,
    &SensorTaskHandle,
    0
  );

  Serial.println(F("[MOSA] System fully initialized. Handover to FreeRTOS."));
}

// ─── 7. LOOP ───────────────────────────────
void loop() {
  // Reset Core 1 Watchdog (running loop)
  esp_task_wdt_reset();

  // Poll physical buttons for manual toggle (Non-blocking)
  handlePhysicalButtons();
  delay(20);
}

// ─── 8. WIFI FUNCTIONS ─────────────────────
void connectWiFi() {
  updateOLED("SSID: MOSA-Setup");
  WiFiManager wm;
  
  WiFiManagerParameter mqtt_host("mqtt", "MQTT Server IP", DEFAULT_MQTT_SERVER, 40);
  wm.addParameter(&mqtt_host);
  
  wm.setConfigPortalTimeout(CONFIG_PORTAL_TIMEOUT);
  
  if (!wm.autoConnect(PORTAL_SSID, PORTAL_PASS)) {
    Serial.println(F("[MOSA] Connection timeout, running with fallback portal..."));
  }
  
  String customMqttHost = String(mqtt_host.getValue());
  if (customMqttHost.length() > 0) {
    mqttServer = customMqttHost;
  }
  
  localIP = WiFi.localIP().toString();
  Serial.println("[MOSA] WiFi Connected. IP: " + localIP);
  
  // Register local mDNS responder
  if (MDNS.begin(boardID.c_str())) {
    Serial.println("[mDNS] http://" + boardID + ".local");
  }
}

// ─── 9. MQTT FUNCTIONS ─────────────────────
void setupMQTT() {
  mqttClient.setServer(mqttServer.c_str(), DEFAULT_MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String msg = "";
  for (unsigned int i = 0; i < length; i++) {
    msg += (char)payload[i];
  }
  
  String t = String(topic);
  Serial.println("[MQTT] Received message on: " + t + " Payload: " + msg);

  StaticJsonDocument<1024> incomingDoc;
  DeserializationError error = deserializeJson(incomingDoc, payload, length);
  if (error) {
    Serial.println(F("[MQTT] JSON parse failed"));
    return;
  }

  // Parse commands e.g. {"state": "ON"}
  for (int i = 0; i < RELAY_COUNT; i++) {
    String deviceId = "dev_relay_" + String(i + 1);
    if (t.indexOf(deviceId) != -1) {
      if (incomingDoc.containsKey("state")) {
        String stateVal = incomingDoc["state"].as<String>();
        bool targetState = (stateVal == "ON");
        
        #ifdef RELAY_ACTIVE_LOW
          digitalWrite(relayPins[i], targetState ? LOW : HIGH);
        #else
          digitalWrite(relayPins[i], targetState ? HIGH : LOW);
        #endif
        
        relayStates[i] = targetState;
        
        // Publish state confirmation
        mqttClient.publish(getDeviceTopic(deviceId.c_str()).c_str(), buildDevicePayload(targetState).c_str(), true);
        Serial.printf("[Relay] Toggled %s: %s\n", deviceId.c_str(), targetState ? "ON" : "OFF");
      }
    }
  }
}

void reconnectMqtt() {
  String willTopic = getControllerStatusTopic();
  String clientID = boardID + "_" + String(millis());
  
  Serial.println("[MQTT] Attempting connection to broker " + mqttServer);
  
  bool connected = mqttClient.connect(
    clientID.c_str(),
    DEFAULT_MQTT_USER,
    DEFAULT_MQTT_PASS,
    willTopic.c_str(), 1, true,
    "{\"online\":false}"
  );

  if (connected) {
    Serial.println(F("[MQTT] Connected successfully"));
    // Subscribe to all relays control topics
    for (int i = 0; i < RELAY_COUNT; i++) {
      String subTopic = "mosa/" + homeId + "/device/dev_relay_" + String(i + 1) + "/command";
      mqttClient.subscribe(subTopic.c_str());
    }
    
    // Publish online state
    mqttClient.publish(willTopic.c_str(), "{\"online\":true}", true);
    
    // Publish auto-discovery configuration
    publishDiscovery();
  } else {
    Serial.print(F("[MQTT] Failed, rc="));
    Serial.println(mqttClient.state());
  }
}

void publishDiscovery() {
  String topic = "mosa/discovery";
  StaticJsonDocument<512> doc;
  doc["mac"] = boardID;
  doc["ip"] = localIP;
  doc["type"] = "ESP32";
  doc["id"] = boardID;
  
  JsonArray comps = doc.createNestedArray("components");
  for (int i = 0; i < RELAY_COUNT; i++) {
    JsonObject relay = comps.createNestedObject();
    relay["type"] = "RELAY";
    relay["pin"] = relayPins[i];
  }
  
  String payload;
  serializeJson(doc, payload);
  mqttClient.publish(topic.c_str(), payload.c_str(), true);
  Serial.println(F("[MQTT] Published discovery payload."));
}

String getDeviceTopic(const char* deviceId) {
  return "mosa/" + homeId + "/device/" + String(deviceId) + "/state";
}

String getControllerStatusTopic() {
  return "mosa/" + homeId + "/controller/" + boardID + "/status";
}

String buildDevicePayload(bool isOn) {
  StaticJsonDocument<512> doc;
  doc["isOn"] = isOn;
  doc["state"] = isOn ? "ON" : "OFF";
  doc["timestamp"] = rtc.now().unixtime();
  doc["mac"] = boardID;
  
  String payload;
  serializeJson(doc, payload);
  return payload;
}

String buildSensorPayload(float temp, float humi) {
  StaticJsonDocument<512> doc;
  doc["temperature"] = round(temp * 10) / 10.0;
  doc["humidity"] = round(humi * 10) / 10.0;
  doc["timestamp"] = rtc.now().unixtime();
  doc["unit"] = "celsius";
  
  String payload;
  serializeJson(doc, payload);
  return payload;
}

String buildMotionPayload(bool detected) {
  StaticJsonDocument<512> doc;
  doc["motion"] = detected;
  doc["detected"] = detected;
  doc["timestamp"] = rtc.now().unixtime();
  
  String payload;
  serializeJson(doc, payload);
  return payload;
}

// ─── 10. RELAY FUNCTIONS ───────────────────
void initRelays() {
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(relayPins[i], OUTPUT);
    #ifdef RELAY_ACTIVE_LOW
      digitalWrite(relayPins[i], HIGH);
    #else
      digitalWrite(relayPins[i], LOW);
    #endif
    relayStates[i] = false;
  }
  
  // Set physical button pins
  for (int i = 0; i < RELAY_COUNT; i++) {
    pinMode(buttonPins[i], INPUT_PULLUP);
  }
  Serial.println(F("[MOSA] Relays and Buttons initialized - all OFF"));
}

void handlePhysicalButtons() {
  static bool lastBtnState[RELAY_COUNT] = {HIGH};
  static unsigned long lastDebounce[RELAY_COUNT] = {0};
  
  for (int i = 0; i < RELAY_COUNT; i++) {
    bool rawReading = digitalRead(buttonPins[i]);
    if (rawReading != lastBtnState[i]) {
      if (millis() - lastDebounce[i] > 150) { // Debounce filter
        lastDebounce[i] = millis();
        lastBtnState[i] = rawReading;
        
        if (rawReading == LOW) { // Button Pressed
          bool targetState = !relayStates[i];
          #ifdef RELAY_ACTIVE_LOW
            digitalWrite(relayPins[i], targetState ? LOW : HIGH);
          #else
            digitalWrite(relayPins[i], targetState ? HIGH : LOW);
          #endif
          relayStates[i] = targetState;
          
          String deviceId = "dev_relay_" + String(i + 1);
          if (mqttClient.connected()) {
            mqttClient.publish(getDeviceTopic(deviceId.c_str()).c_str(), buildDevicePayload(targetState).c_str(), true);
          }
          Serial.printf("[Button] Manual Toggle %s: %s\n", deviceId.c_str(), targetState ? "ON" : "OFF");
        }
      }
    }
  }
}

// ─── 11. SENSOR FUNCTIONS ──────────────────
void readSensors() {
  float temp = dht.readTemperature() + TEMP_CALIBRATION_OFFSET;
  float humi = dht.readHumidity() + HUMIDITY_CALIBRATION_OFFSET;
  
  if (isnan(temp) || isnan(humi)) {
    Serial.println(F("[Sensors] Error: DHT22 returned invalid metrics"));
    return;
  }
  
  // Publish metrics
  if (mqttClient.connected()) {
    String sensorTopic = "mosa/" + homeId + "/sensor/temperature/main";
    mqttClient.publish(sensorTopic.c_str(), buildSensorPayload(temp, humi).c_str(), true);
    Serial.printf("[Sensors] Published Temp: %.1f C, Humi: %.1f%%\n", temp, humi);
  }
}

float readCurrentFiltered() {
  long sum = 0;
  for (int i = 0; i < 200; i++) {
    sum += analogRead(ACS712_PIN);
    delayMicroseconds(50);
  }
  float avgADC = sum / 200.0;
  float voltage = (avgADC / 4095.0) * 3300.0;
  float current = (voltage - 2500.0) / 100.0;
  current = abs(current);
  if (current < 0.05) current = 0.0; // Filter noise floor
  return current;
}

float readPower() {
  float current = readCurrentFiltered();
  float power = current * 220.0; // 220V grid
  return round(power * 10) / 10.0;
}

// ─── 13. OLED FUNCTIONS ────────────────────
void initOLED() {
  Wire.begin(OLED_SDA, OLED_SCL);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    display.println(F("MOSA OS Booting..."));
    display.display();
  } else {
    Serial.println(F("[OLED] SSD1306 allocation failed"));
  }
}

void updateOLED(const char* status) {
  display.clearDisplay();
  display.setCursor(0, 0);
  display.setTextSize(1);
  display.println(F("  -- MOSA NODE --"));
  display.println();
  display.print(F("IP: ")); display.println(localIP);
  display.print(F("ID: ")); display.println(boardID.substring(9));
  display.print(F("Broker: ")); display.println(mqttServer);
  display.println();
  display.print(F("Status: ")); display.println(status);
  display.display();
}

// ─── 14. RTC FUNCTIONS ─────────────────────
void initRTC() {
  if (!rtc.begin()) {
    Serial.println(F("[RTC] Warning: DS3231 module not detected"));
  } else if (rtc.lostPower()) {
    rtc.adjust(DateTime(F(__DATE__), F(__TIME__)));
    Serial.println(F("[RTC] Clock adjusted to build timestamp."));
  }
}

// ─── 15. UTILITY & DIAGNOSTIC FUNCTIONS ────
void runSelfTest() {
  Serial.println(F("[Diagnostics] Executing board self-test..."));
  display.clearDisplay();
  display.setCursor(0, 0);
  display.println(F("Running Diagnostics..."));
  display.display();
  delay(500);
}

// ─── FreeRTOS Async Network Task ───────────
void mqttTask(void* pvParameters) {
  esp_task_wdt_add(NULL);
  for (;;) {
    esp_task_wdt_reset();
    
    if (WiFi.status() == WL_CONNECTED) {
      if (!mqttClient.connected()) {
        updateOLED("MQTT: Connecting");
        reconnectMqtt();
      } else {
        mqttClient.loop();
        updateOLED("MQTT: Online");
      }
    } else {
      updateOLED("WiFi: Offline");
    }
    
    vTaskDelay(pdMS_TO_TICKS(100));
  }
}

// ─── FreeRTOS Async Telemetry Task ─────────
void sensorTask(void* pvParameters) {
  esp_task_wdt_add(NULL);
  for (;;) {
    esp_task_wdt_reset();
    
    // Poll DHT Sensor
    readSensors();
    
    // Poll PIR Sensor
    bool pirNow = (digitalRead(PIR_PIN) == HIGH);
    if (pirNow && !pirLastState) {
      if (mqttClient.connected()) {
        String motionTopic = "mosa/" + homeId + "/sensor/motion/entrance";
        mqttClient.publish(motionTopic.c_str(), buildMotionPayload(true).c_str());
        Serial.println(F("[PIR] Motion detected! Published to MQTT."));
      }
    }
    pirLastState = pirNow;

    vTaskDelay(pdMS_TO_TICKS(SENSOR_READ_INTERVAL));
  }
}
