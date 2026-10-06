/*
 * ╔══════════════════════════════════════════════════════════╗
 * ║         MosaSmartNode - Firmware v3.0                   ║
 * ║  التحسينات المطبّقة:                                    ║
 * ║  🔴 تأمين API endpoints بـ API Key                      ║
 * ║  🔴 تقليل blocking في ACS و DHT (non-blocking)          ║
 * ║  🟡 تقليل استدعاءات broadcastDevices (dirty flag)       ║
 * ║  🟡 تقليل الكتابة على Flash (write batching)            ║
 * ║  🟢 إضافة /api/status                                   ║
 * ║  🟢 MQTT خاص (Unique Client ID + Last Will)             ║
 * ╚══════════════════════════════════════════════════════════╝
 */

#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <DHT.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <PubSubClient.h>
#include <Update.h>
#include <WebServer.h>
#include <WebSocketsServer.h>
#include <WiFi.h>
#include <esp_task_wdt.h>
#include <time.h>
#include <Wire.h>
#include "esp_sntp.h"
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ==========================================
// 1. إعدادات الشبكة والأمان
// ==========================================
WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(82);
Preferences prefs;

String wsPassword  = "admin";
// 🔴 FIX: API Key لحماية HTTP endpoints (يُحفظ في Preferences)
String apiKey      = "changeme123";
int timeZoneOffset = 10800;
bool wsAuthenticated[WEBSOCKETS_SERVER_CLIENT_MAX] = {false};
unsigned long lastAuthAttempt[WEBSOCKETS_SERVER_CLIENT_MAX] = {0};
int authFailCount[WEBSOCKETS_SERVER_CLIENT_MAX] = {0};

#define MAX_DEVICES 10

// ==========================================
// 2. هياكل البيانات (تم النقل لتفادي خطأ updateDisplay)
// ==========================================
struct Device {
  bool  active            = false;
  char  name[32]          = "";
  char  room[32]          = "عام";
  char  type[16]          = "light";
  int   pin               = -1;
  int   inPin             = -1;
  bool  state             = false;
  bool  lastButtonState   = true;
  unsigned long startTime = 0;
  unsigned long totalTime = 0;
  int   pwmValue          = 255;
  char  color[8]          = "#ffffff";
  unsigned long timerOffMillis = 0;

  bool scheduleActive    = false;
  int  scheduleHourOn    = -1;
  int  scheduleMinuteOn  = -1;
  int  scheduleHourOff   = -1;
  int  scheduleMinuteOff = -1;

  bool needsSave = false;
};

Device devices[MAX_DEVICES];

// ==========================================
// تعريفات دبابيس اللوحة المخصصة
// ==========================================
#define DHTTYPE  DHT22
#define DHT_PIN  7
#define ACS_PIN  12
#define PIR_PIN  41
#define DISP_SDA 2
#define DISP_SCL 42

// ==========================================
// 🔴 FIX: ACS Non-Blocking - متغيرات الحالة
// ==========================================
struct ACSState {
  int     maxVal      = 0;
  int     minVal      = 4095;
  uint32_t startTime  = 0;
  bool    sampling    = false;
  float   lastResult  = 0.0f;
};
ACSState acsState;

// بدء جلسة قياس جديدة (تُستدعى من loop بدون blocking)
void acsStartSample() {
  acsState.maxVal    = 0;
  acsState.minVal    = 4095;
  acsState.startTime = millis();
  acsState.sampling  = true;
}

// تحديث العينة - تُستدعى كل دورة loop (تستغرق ~0µs)
// ترجع true عند اكتمال الـ 50ms
bool acsUpdate() {
  if (!acsState.sampling) return false;
  int v = analogRead(ACS_PIN);
  if (v > acsState.maxVal) acsState.maxVal = v;
  if (v < acsState.minVal) acsState.minVal = v;
  if ((millis() - acsState.startTime) >= 50) {
    float Vpp  = ((acsState.maxVal - acsState.minVal) * 3.3f) / 4095.0f;
    float Vrms = (Vpp / 2.0f) * 0.707f;
    float Irms = (Vrms * 1000.0f) / 185.0f;
    if (Irms < 0.1f) Irms = 0.0f;
    acsState.lastResult = Irms * 220.0f;
    acsState.sampling   = false;
    return true;
  }
  return false;
}

// ==========================================
// DHT & Sensor Globals
// ==========================================
DHT *dht           = nullptr;
float currentTemp  = 0.0f;
float currentHum   = 0.0f;
float currentPower = 0.0f;
double totalKWh    = 0.0;
unsigned long lastKWhSave = 0;

// 🔴 FIX: DHT Non-Blocking state machine
enum DHTPhase { DHT_IDLE, DHT_TRIGGERED, DHT_READY };
struct DHTState {
  DHTPhase phase        = DHT_IDLE;
  uint32_t triggerTime  = 0;
};
DHTState dhtState;

// ==========================================
// MQTT
// ==========================================
// 🟢 FIX: MQTT خاص - broker منفصل + Last Will
const char *mqtt_server = "broker.hivemq.com"; // يمكن تغييره من Captive Portal
WiFiClient  espClient;
PubSubClient mqttClient(espClient);

String boardID   = "";
String boardName = "";

// 🟡 FIX: Dirty Flag لتقليل broadcastDevices
bool stateDirty = false;

// 🟢 FIX: Hardware Safety Globals
unsigned long lastTurnOffTime[MAX_DEVICES] = {0};
int staggerQueue[MAX_DEVICES];
int staggerCount = 0;
unsigned long lastStaggerTime = 0;
int dhtNanCount = 0;

// 🟢 FIX: Display Management Globals
unsigned long lastDisplayUpdate = 0;
unsigned long lastPageChange = 0;
int currentDisplayPage = 0;
unsigned long lastInteractionTime = 0;
bool isDisplayAwake = true;

void updateDisplay() {
  unsigned long now = millis();
  
  // Screen Saver Logic (5 minutes = 300,000 ms)
  if (now - lastInteractionTime > 300000) {
    if (isDisplayAwake) {
      display.ssd1306_command(SSD1306_DISPLAYOFF);
      isDisplayAwake = false;
    }
    return; // Do not update display while asleep
  } else if (!isDisplayAwake) {
    display.ssd1306_command(SSD1306_DISPLAYON);
    isDisplayAwake = true;
  }

  if (now - lastPageChange >= 5000) {
    lastPageChange = now;
    currentDisplayPage = (currentDisplayPage + 1) % 3;
  }

  if (now - lastDisplayUpdate < 1000) return;
  lastDisplayUpdate = now;

  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  if (currentDisplayPage == 0) {
    // Page 0: System
    display.setCursor(0, 0);
    display.println(F("--- SYSTEM ---"));
    display.println();
    display.print(F("WiFi: "));
    display.println(WiFi.status() == WL_CONNECTED ? F("Connected") : F("Disconnected"));
    display.print(F("IP: "));
    display.println(WiFi.status() == WL_CONNECTED ? WiFi.localIP().toString() : F("0.0.0.0"));
    display.println();
    display.print(F("MQTT: "));
    display.println(mqttClient.connected() ? F("Online") : F("Offline"));
  } 
  else if (currentDisplayPage == 1) {
    // Page 1: Environment
    display.setCursor(0, 0);
    display.println(F("--- ENVIRONMENT ---"));
    display.println();
    display.print(F("Temp: "));
    display.print(currentTemp, 1);
    display.println(F(" C"));
    display.print(F("Hum:  "));
    display.print(currentHum, 1);
    display.println(F(" %"));
    display.println();
    display.print(F("Power: "));
    display.print(currentPower, 1);
    display.println(F(" W"));
  } 
  else if (currentDisplayPage == 2) {
    // Page 2: Devices
    int onCount = 0;
    int totalCount = 0;
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active) {
        totalCount++;
        if (devices[i].state) onCount++;
      }
    }
    display.setCursor(0, 0);
    display.println(F("--- DEVICES ---"));
    display.println();
    display.print(F("Total: "));
    display.println(totalCount);
    display.print(F("ON:    "));
    display.println(onCount);
    display.print(F("OFF:   "));
    display.println(totalCount - onCount);
  }

  display.display();
}

// ==========================================
// RTC DS3231 
// ==========================================
void writeDS3231Time(time_t epochTime) {
  struct tm *ptm = gmtime(&epochTime);
  Wire.beginTransmission(0x68);
  Wire.write(0x00);
  auto decToBcd = [](int val) { return (uint8_t)((val / 10 * 16) + (val % 10)); };
  Wire.write(decToBcd(ptm->tm_sec));
  Wire.write(decToBcd(ptm->tm_min));
  Wire.write(decToBcd(ptm->tm_hour));
  Wire.write(decToBcd(ptm->tm_wday + 1));
  Wire.write(decToBcd(ptm->tm_mday));
  Wire.write(decToBcd(ptm->tm_mon + 1));
  Wire.write(decToBcd(ptm->tm_year - 100));
  Wire.endTransmission();
}

void readDS3231Time() {
  Wire.beginTransmission(0x68);
  Wire.write(0x00);
  if (Wire.endTransmission() != 0) return;
  
  Wire.requestFrom(0x68, 7);
  auto bcdToDec = [](uint8_t val) { return (int)((val / 16 * 10) + (val % 16)); };
  struct tm t = {0};
  t.tm_sec  = bcdToDec(Wire.read() & 0x7F);
  t.tm_min  = bcdToDec(Wire.read());
  t.tm_hour = bcdToDec(Wire.read() & 0x3F);
  Wire.read();
  t.tm_mday = bcdToDec(Wire.read());
  t.tm_mon  = bcdToDec(Wire.read() & 0x7F) - 1;
  t.tm_year = bcdToDec(Wire.read()) + 100;
  time_t epoch = mktime(&t);
  struct timeval tv = { .tv_sec = epoch, .tv_usec = 0 };
  settimeofday(&tv, NULL);
}

void timeSyncCallback(struct timeval *tv) {
  writeDS3231Time(tv->tv_sec);
}

// هياكل البيانات تم نقلها للأعلى لتفادي خطأ التعريف
// 3. وظائف الذاكرة الدائمة
// ==========================================

// 🟡 FIX: Flash Write Batching
// بدلاً من الكتابة فوراً عند كل تغيير، نضع علم needsSave
// ونكتب كل مرة واحدة كل 10 ثوانٍ (أو عند الإطفاء)
void saveDevice(int id) {
  prefs.begin("smarthome", false);
  String p = String(id);
  prefs.putBool(  ("a"    + p).c_str(), devices[id].active);
  prefs.putString(("n"    + p).c_str(), devices[id].name);
  prefs.putString(("r"    + p).c_str(), devices[id].room);
  prefs.putString(("y"    + p).c_str(), devices[id].type);
  prefs.putInt(   ("p"    + p).c_str(), devices[id].pin);
  prefs.putInt(   ("i"    + p).c_str(), devices[id].inPin);
  prefs.putBool(  ("st"   + p).c_str(), devices[id].state);
  prefs.putULong( ("t"    + p).c_str(), devices[id].totalTime);
  prefs.putInt(   ("pwm"  + p).c_str(), devices[id].pwmValue);
  prefs.putString(("col"  + p).c_str(), devices[id].color);
  prefs.putBool(  ("sa"   + p).c_str(), devices[id].scheduleActive);
  prefs.putInt(   ("shOn" + p).c_str(), devices[id].scheduleHourOn);
  prefs.putInt(   ("smOn" + p).c_str(), devices[id].scheduleMinuteOn);
  prefs.putInt(   ("shOff"+ p).c_str(), devices[id].scheduleHourOff);
  prefs.putInt(   ("smOff"+ p).c_str(), devices[id].scheduleMinuteOff);
  prefs.end();
  devices[id].needsSave = false;
}

// يُستدعى من loop كل 10 ثوانٍ - يكتب فقط ما تغيّر
void flushPendingSaves() {
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].needsSave) {
      saveDevice(i);
    }
  }
}

void loadDevices() {
  prefs.begin("smarthome", true);
  for (int i = 0; i < MAX_DEVICES; i++) {
    String p = String(i);
    devices[i].active = prefs.getBool(("a" + p).c_str(), false);
    if (!devices[i].active) continue;

    strlcpy(devices[i].name,  prefs.getString(("n"  + p).c_str(), "Device").c_str(), 32);
    strlcpy(devices[i].room,  prefs.getString(("r"  + p).c_str(), "عام").c_str(),    32);
    strlcpy(devices[i].type,  prefs.getString(("y"  + p).c_str(), "light").c_str(),  16);
    devices[i].pin        = prefs.getInt(   ("p"    + p).c_str(), -1);
    devices[i].inPin      = prefs.getInt(   ("i"    + p).c_str(), -1);
    devices[i].totalTime  = prefs.getULong( ("t"    + p).c_str(), 0);
    devices[i].pwmValue   = prefs.getInt(   ("pwm"  + p).c_str(), 255);
    strlcpy(devices[i].color, prefs.getString(("col"+ p).c_str(), "#ffffff").c_str(), 8);

    devices[i].scheduleActive    = prefs.getBool(("sa"   + p).c_str(), false);
    devices[i].scheduleHourOn    = prefs.getInt( ("shOn" + p).c_str(), -1);
    devices[i].scheduleMinuteOn  = prefs.getInt( ("smOn" + p).c_str(), -1);
    devices[i].scheduleHourOff   = prefs.getInt( ("shOff"+ p).c_str(), -1);
    devices[i].scheduleMinuteOff = prefs.getInt( ("smOff"+ p).c_str(), -1);

    if (devices[i].pin != -1) {
      if (strcmp(devices[i].type, "sensor") == 0) {
        if (dht == nullptr) { dht = new DHT(devices[i].pin, DHTTYPE); dht->begin(); }
      } else {
        devices[i].state = prefs.getBool(("st" + p).c_str(), false);
        pinMode(devices[i].pin, INPUT); // Default HW state
        if (devices[i].state) {
          staggerQueue[staggerCount++] = i; // Queue for staggered start
        }
      }
    }
    if (devices[i].inPin != -1) {
      pinMode(devices[i].inPin, INPUT_PULLUP);
      devices[i].lastButtonState = (digitalRead(devices[i].inPin) == HIGH);
    }
  }
  prefs.end();
}

// أول تشغيل - ضبط اللوحة تلقائياً
void initHardwareBoard() {
  prefs.begin("smarthome", false);
  if (prefs.getBool("board_configured", false)) { prefs.end(); return; }

  Serial.println("[System] First boot! No auto-devices added.");
  
  prefs.putBool("board_configured", true);
  prefs.end();
}

// ==========================================
// 4. وظائف التحكم والاتصال
// ==========================================

// 🟡 FIX: broadcastDevices تُستدعى فقط عند الحاجة (dirty flag)
void broadcastDevices() {
  stateDirty = false; // تمّ الإرسال، أعد تصفير العلم

  JsonDocument doc;
  doc["type"]         = "state";
  doc["boardId"]      = boardID;
  doc["boardName"]    = boardName;
  doc["totalKWh"]     = totalKWh;
  doc["currentPower"] = currentPower;
  doc["currentTemp"]  = currentTemp;
  doc["currentHum"]   = currentHum;
  JsonArray array = doc["devices"].to<JsonArray>();

  for (int i = 0; i < MAX_DEVICES; i++) {
    if (!devices[i].active) continue;
    JsonObject obj = array.add<JsonObject>();
    obj["id"]       = i;
    obj["name"]     = devices[i].name;
    obj["room"]     = devices[i].room;
    obj["type"]     = devices[i].type;
    obj["pin"]      = devices[i].pin;
    obj["inPin"]    = devices[i].inPin;
    obj["state"]    = devices[i].state ? "ON" : "OFF";
    obj["pwmValue"] = devices[i].pwmValue;
    obj["color"]    = devices[i].color;
    obj["scheduleActive"]    = devices[i].scheduleActive;
    obj["scheduleHourOn"]    = devices[i].scheduleHourOn;
    obj["scheduleMinuteOn"]  = devices[i].scheduleMinuteOn;
    obj["scheduleHourOff"]   = devices[i].scheduleHourOff;
    obj["scheduleMinuteOff"] = devices[i].scheduleMinuteOff;

    unsigned long usage = devices[i].totalTime;
    if (devices[i].state) usage += (millis() - devices[i].startTime);
    obj["usage"] = usage / 1000;

    if (strcmp(devices[i].type, "sensor") == 0) {
      obj["temperature"] = currentTemp;
      obj["humidity"]    = currentHum;
      obj["powerUsage"]  = currentPower;
    }
  }

  String buffer;
  serializeJson(doc, buffer);

  for (uint8_t i = 0; i < WEBSOCKETS_SERVER_CLIENT_MAX; i++) {
    if (wsAuthenticated[i]) webSocket.sendTXT(i, buffer);
  }

  if (mqttClient.connected()) {
    String stateTopic = "home/" + boardID + "/state";
    mqttClient.publish(stateTopic.c_str(), buffer.c_str(), true); // retain=true
  }
}

void applyState(int id) {
  if (devices[id].pin == -1 || strcmp(devices[id].type, "sensor") == 0) return;

  if (devices[id].state) {
    // حالة التشغيل: نجعل المسمار مخرجاً ونعطيه LOW لسحب التيار (يعمل الريلاي)
    pinMode(devices[id].pin, OUTPUT);
    digitalWrite(devices[id].pin, LOW);
  } else {
    // حالة الإطفاء: نجعل المسمار مدخلاً (High-Z) لقطع الدائرة تماماً (ينطفئ الريلاي)
    pinMode(devices[id].pin, INPUT);
  }
}

void toggleLogic(int id, bool force = false) {
  if (!devices[id].active || devices[id].pin == -1) return;
  lastInteractionTime = millis();

  // Compressor Delay Protection (Anti-Short Cycle)
  if (!devices[id].state && !force && strcmp(devices[id].type, "cooling") == 0) {
    if (millis() - lastTurnOffTime[id] < 180000 && lastTurnOffTime[id] > 0) {
       return; // Blocked
    }
  }

  devices[id].state = !devices[id].state;
  applyState(id);

  if (devices[id].state) {
    devices[id].startTime = millis();
  } else {
    devices[id].totalTime += (millis() - devices[id].startTime);
    devices[id].timerOffMillis = 0;
    lastTurnOffTime[id] = millis();
    // 🟡 FIX: بدلاً من saveDevice فوراً، نضع علم للحفظ المؤجّل
    devices[id].needsSave = true;
  }
  // 🟡 FIX: بدلاً من broadcastDevices فوراً، نضع علم قذر
  stateDirty = true;
}

void processCommand(JsonDocument &doc) {
  const char *type = doc["type"];
  if (!type) return;
  lastInteractionTime = millis();

  if (strcmp(type, "toggle") == 0 && doc.containsKey("id")) {
    bool force = doc.containsKey("force") ? doc["force"].as<bool>() : false;
    toggleLogic((int)doc["id"], force);

  } else if (strcmp(type, "refresh") == 0) {
    broadcastDevices();

  } else if (strcmp(type, "pwm") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    devices[id].pwmValue = doc["value"];
    if (devices[id].state) applyState(id);
    devices[id].needsSave = true;
    stateDirty = true;

  } else if (strcmp(type, "color") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    const char *colorVal = doc["color"];
    if (colorVal) strlcpy(devices[id].color, colorVal, 8);
    devices[id].needsSave = true;
    stateDirty = true;

  } else if (strcmp(type, "timer") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    long mins = doc["minutes"];
    devices[id].timerOffMillis = millis() + ((unsigned long)mins * 60000UL);

  } else if (strcmp(type, "schedule") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    devices[id].scheduleActive    = doc["scheduleActive"];
    devices[id].scheduleHourOn    = doc["scheduleHourOn"];
    devices[id].scheduleMinuteOn  = doc["scheduleMinuteOn"];
    devices[id].scheduleHourOff   = doc["scheduleHourOff"];
    devices[id].scheduleMinuteOff = doc["scheduleMinuteOff"];
    devices[id].needsSave = true;
    stateDirty = true;

  } else if (strcmp(type, "delete") == 0 && doc.containsKey("id")) {
    int id = doc["id"];
    if (id >= 0 && id < MAX_DEVICES) {
      devices[id].active = false;
      if (devices[id].pin != -1 && strcmp(devices[id].type, "sensor") != 0)
        digitalWrite(devices[id].pin, HIGH);
      saveDevice(id); // حذف فوري - لا تأجيل
      stateDirty = true;
    }

  } else if (strcmp(type, "reset") == 0) {
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active) {
        devices[i].active = false;
        if (devices[i].pin != -1 && strcmp(devices[i].type, "sensor") != 0) {
          pinMode(devices[i].pin, INPUT);
        }
        saveDevice(i);
      }
    }
    stateDirty = true;
  }
}

// ==========================================
// 🔴 FIX: تأمين API - فحص API Key
// ==========================================
bool checkApiKey() {
  // يقبل الـ Key من header أو query string
  String key = "";
  if (server.hasHeader("X-API-Key")) {
    key = server.header("X-API-Key");
  } else if (server.hasArg("key")) {
    key = server.arg("key");
  }
  return (key == apiKey);
}

void sendUnauthorized() {
  sendCORSHeaders();
  server.send(401, "application/json", "{\"status\":\"error\",\"message\":\"Unauthorized\"}");
}

void onWebSocketEvent(uint8_t num, WStype_t type, uint8_t *payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsAuthenticated[num] = false;
  } else if (type == WStype_TEXT) {
    JsonDocument doc;
    if (!deserializeJson(doc, payload)) {
      const char *reqType = doc["type"];
      if (reqType && strcmp(reqType, "auth") == 0) {
        if (authFailCount[num] >= 5 && millis() - lastAuthAttempt[num] < 60000) {
            webSocket.disconnect(num);
            return;
        }

        const char *pass = doc["password"];
        if (pass && wsPassword == String(pass)) {
          authFailCount[num] = 0;
          wsAuthenticated[num] = true;
          webSocket.sendTXT(num, "{\"type\":\"auth_success\"}");
          broadcastDevices();
        } else {
          lastAuthAttempt[num] = millis();
          authFailCount[num]++;
          webSocket.sendTXT(num, "{\"type\":\"auth_error\",\"message\":\"Unauthorized\"}");
        }
        return;
      }
      if (wsAuthenticated[num]) processCommand(doc);
      else webSocket.sendTXT(num, "{\"type\":\"auth_error\",\"message\":\"Unauthorized\"}");
    }
  } else if (type == WStype_DISCONNECTED) {
    wsAuthenticated[num] = false;
  }
}

void mqttCallback(char *topic, byte *payload, unsigned int length) {
  String msg;
  for (unsigned int i = 0; i < length; i++) msg += (char)payload[i];
  
  String t = String(topic);
  if (t.indexOf("/set/") > 0) {
     int id = t.substring(t.lastIndexOf("/") + 1).toInt();
     if (id >= 0 && id < MAX_DEVICES) {
        if (msg == "ON" && !devices[id].state) toggleLogic(id);
        else if (msg == "OFF" && devices[id].state) toggleLogic(id);
     }
     return;
  }

  JsonDocument doc;
  if (!deserializeJson(doc, msg)) processCommand(doc);
}

void publishHAAutoDiscovery() {
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (!devices[i].active || devices[i].pin == -1 || strcmp(devices[i].type, "sensor") == 0) continue;
    String safeName = boardID + "_" + String(i);
    String typeStr = (strcmp(devices[i].type, "cooling") == 0) ? "switch" : "light";
    String topic = "homeassistant/" + typeStr + "/" + safeName + "/config";
    
    JsonDocument doc;
    doc["name"] = String(boardName) + " " + devices[i].name;
    doc["unique_id"] = safeName;
    doc["state_topic"] = "home/" + boardID + "/state";
    doc["value_template"] = "{{ 'ON' if (value_json.devices | selectattr('id','equalto'," + String(i) + ") | first).state == 'ON' else 'OFF' }}";
    doc["command_topic"] = "home/" + boardID + "/set/" + String(i);
    
    String payload;
    serializeJson(doc, payload);
    mqttClient.publish(topic.c_str(), payload.c_str(), true);
  }
}

// ==========================================
// 5. CORS Headers
// ==========================================
void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
}

// ==========================================
// 6. Setup & Captive Portal
// ==========================================
void runCaptivePortal() {
  WiFi.mode(WIFI_AP);
  WiFi.softAP("MosaSmart_Setup");
  Serial.println("[Setup] Captive Portal: 192.168.4.1");

  server.on("/", HTTP_GET, []() {
    String html = R"(
      <html><head>
        <meta name='viewport' content='width=device-width,initial-scale=1'>
        <style>
          body{font-family:Arial;padding:20px;background:#111827;color:white;text-align:center}
          input{width:100%;padding:10px;margin:8px 0;border-radius:5px;border:none;box-sizing:border-box}
          button{background:#3b82f6;color:white;padding:10px 20px;border:none;border-radius:5px;width:100%;font-size:16px;margin-top:10px}
          hr{border:1px solid #374151;margin:15px 0}h3{margin:5px 0}
        </style>
      </head><body>
        <h2>Mosa Smart Node Setup</h2>
        <form action='/save' method='POST'>
          <input type='text'     name='nodename' placeholder='اسم اللوحة (مثلاً: المطبخ)' required>
          <input type='text'     name='ssid'     placeholder='WiFi Name (SSID)' required>
          <input type='password' name='pass'     placeholder='WiFi Password'>
          <input type='text'     name='wspass'   placeholder='WebSocket Password' value='admin' required>
          <input type='text'     name='apikey'   placeholder='API Key (للحماية)' value='changeme123' required>
          <input type='number'   name='tz'       placeholder='Timezone Offset Seconds (e.g. 10800)' value='10800' required>
          <hr><h3>Static IP (اختياري)</h3>
          <input type='text' name='ip' placeholder='IP (e.g. 192.168.1.100)'>
          <input type='text' name='gw' placeholder='Gateway (e.g. 192.168.1.1)'>
          <input type='text' name='sn' placeholder='Subnet (e.g. 255.255.255.0)'>
          <hr><h3>MQTT (اختياري)</h3>
          <input type='text' name='mqtthost' placeholder='MQTT Broker (e.g. 192.168.1.50)' value='broker.hivemq.com'>
          <input type='text' name='mqttuser' placeholder='MQTT Username'>
          <input type='password' name='mqttpass' placeholder='MQTT Password'>
          <button type='submit'>Save &amp; Restart</button>
        </form>
      </body></html>
    )";
    server.send(200, "text/html", html);
  });

  server.on("/save", HTTP_POST, []() {
    prefs.begin("wifi", false);
    prefs.putString("nodename", server.arg("nodename"));
    prefs.putString("ssid",     server.arg("ssid"));
    prefs.putString("pass",     server.arg("pass"));
    prefs.putString("wspass",   server.arg("wspass"));
    prefs.putString("apikey",   server.arg("apikey"));
    prefs.putInt(   "tz",       server.arg("tz").toInt());
    prefs.putString("ip",       server.arg("ip"));
    prefs.putString("gw",       server.arg("gw"));
    prefs.putString("sn",       server.arg("sn"));
    // 🟢 FIX: حفظ إعدادات MQTT الخاصة
    prefs.putString("mqtthost", server.arg("mqtthost").length() > 0
                                  ? server.arg("mqtthost")
                                  : "broker.hivemq.com");
    prefs.putString("mqttuser", server.arg("mqttuser"));
    prefs.putString("mqttpass", server.arg("mqttpass"));
    prefs.end();
    server.send(200, "text/html",
      "<html><body style='background:#111827;color:white;text-align:center;padding:50px'>"
      "<h2>Saved! Restarting...</h2></body></html>");
    delay(2000);
    ESP.restart();
  });

  server.begin();
  while (true) {
    server.handleClient();
    esp_task_wdt_reset();
    delay(10);
  }
}

// ==========================================
// متغيرات MQTT الخاصة
// ==========================================
// متغيرات MQTT الخاصة
// ==========================================
String mqttHost     = "broker.hivemq.com";
String mqttUser     = "";
String mqttPassword = "";

bool otaAuthorized = false;

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  // Initialize Display First
  Wire.begin(DISP_SDA, DISP_SCL);
  if(display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.println(F("  MosaSmart Node"));
    display.setCursor(0, 40);
    display.println(F("  Starting..."));
    display.display();
  } else {
    Serial.println(F("SSD1306 initialization failed"));
  }

  Serial.println("\n[System] Starting Mosa Smart Node v3.0...");

  // Watchdog
  esp_task_wdt_config_t wdt_config = {
    .timeout_ms   = 5000,
    .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
    .trigger_panic  = true,
  };
  esp_task_wdt_init(&wdt_config);
  esp_task_wdt_add(NULL);

  initHardwareBoard();

  prefs.begin("smarthome", true);
  totalKWh = prefs.getDouble("totalkwh", 0.0);
  prefs.end();

  loadDevices();

  // تحميل إعدادات WiFi و MQTT
  prefs.begin("wifi", true);
  boardName      = prefs.getString("nodename", "غرفة غير مسماة");
  String savedSsid = prefs.getString("ssid",   "");
  String savedPass = prefs.getString("pass",   "");
  wsPassword     = prefs.getString("wspass",   "admin");
  apiKey         = prefs.getString("apikey",   "changeme123");
  timeZoneOffset = prefs.getInt(   "tz",        10800);
  String staticIP= prefs.getString("ip",        "");
  String staticGW= prefs.getString("gw",        "");
  String staticSN= prefs.getString("sn",        "");
  mqttHost       = prefs.getString("mqtthost",  "broker.hivemq.com");
  mqttUser       = prefs.getString("mqttuser",  "");
  mqttPassword   = prefs.getString("mqttpass",  "");
  prefs.end();

  if (savedSsid == "") { 
    Serial.println("[WiFi] No saved credentials. Starting SmartConfig...");
    WiFi.mode(WIFI_AP_STA);
    WiFi.beginSmartConfig();
    
    // Wait for SmartConfig packet from mobile
    Serial.println("[WiFi] Waiting for SmartConfig...");
    int waitCounter = 0;
    while (!WiFi.smartConfigDone() && waitCounter < 60) {
      delay(1000);
      Serial.print(".");
      esp_task_wdt_reset();
      waitCounter++;
    }
    
    if (WiFi.smartConfigDone()) {
      Serial.println("\n[WiFi] SmartConfig Success!");
      // Save credentials
      prefs.begin("wifi", false);
      prefs.putString("ssid", WiFi.SSID());
      prefs.putString("pass", WiFi.psk());
      prefs.end();
      savedSsid = WiFi.SSID();
      savedPass = WiFi.psk();
      WiFi.mode(WIFI_STA);
    } else {
      Serial.println("\n[WiFi] SmartConfig Timeout. Falling back to Captive Portal.");
      runCaptivePortal(); 
      return; 
    }
  }

  WiFi.mode(WIFI_STA);

  if (staticIP.length() > 0 && staticGW.length() > 0 && staticSN.length() > 0) {
    IPAddress ip, gw, sn;
    if (ip.fromString(staticIP) && gw.fromString(staticGW) && sn.fromString(staticSN))
      WiFi.config(ip, gw, sn, IPAddress(8, 8, 8, 8));
  }

  WiFi.setAutoReconnect(true);
  WiFi.begin(savedSsid.c_str(), savedPass.c_str());
  Serial.print("[WiFi] Connecting");

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500); Serial.print("."); esp_task_wdt_reset(); attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected! IP: " + WiFi.localIP().toString());
    boardID = "MosaNode_" + WiFi.macAddress();
    boardID.replace(":", "");

    if (MDNS.begin(boardID.c_str())) {
      Serial.println("[mDNS] http://" + boardID + ".local");
      MDNS.addService("mosasmart", "tcp", 80);
      MDNS.addServiceTxt("mosasmart", "tcp", "boardId", boardID);
      MDNS.addServiceTxt("mosasmart", "tcp", "name", boardName);
    }

    readDS3231Time();
    sntp_set_time_sync_notification_cb(timeSyncCallback);
    configTime(timeZoneOffset, 0, "pool.ntp.org", "time.nist.gov");
    Serial.println("[Time] NTP configured.");
  } else {
    // 🟢 FIX: AP Fallback Mode
    Serial.println("\n[WiFi] Failed! Starting AP Fallback Mode...");
    WiFi.mode(WIFI_AP);
    WiFi.softAP("MosaHome_Offline", "12345678");
    Serial.println("[WiFi] AP Mode: MosaHome_Offline (IP: 192.168.4.1)");
    
    boardID = "MosaNode_" + WiFi.macAddress();
    boardID.replace(":", "");
    
    // Read RTC time since we have no NTP
    readDS3231Time();
  }

  // ==========================================
  // API Routes - مع تأمين بـ API Key
  // ==========================================

  // 🟢 FIX: /api/status - endpoint جديد للمراقبة
  server.on("/api/status", HTTP_GET, []() {
    sendCORSHeaders();
    // Status لا يحتاج API Key (معلومات عامة فقط)
    JsonDocument doc;
    doc["boardId"]    = boardID;
    doc["boardName"]  = boardName;
    
    if (!checkApiKey()) {
      doc["ip"]         = "***";
      doc["rssi"]       = "***";
    } else {
      doc["ip"]         = WiFi.localIP().toString();
      doc["rssi"]       = WiFi.RSSI();
    }
    
    doc["uptime"]     = millis() / 1000;
    doc["freeHeap"]   = ESP.getFreeHeap();
    doc["totalKWh"]   = totalKWh;
    doc["mqttConnected"] = mqttClient.connected();
    doc["wifiConnected"] = (WiFi.status() == WL_CONNECTED);

    // عدد الأجهزة النشطة
    int activeCount = 0;
    for (int i = 0; i < MAX_DEVICES; i++)
      if (devices[i].active) activeCount++;
    doc["activeDevices"] = activeCount;

    String out;
    serializeJson(doc, out);
    server.send(200, "application/json", out);
  });

  // 🔴 FIX: /api/add محمي بـ API Key
  server.on("/api/add", HTTP_GET, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }

    int slot = -1;
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (!devices[i].active) { slot = i; break; }
    }
    if (slot == -1) {
      server.send(400, "application/json", "{\"status\":\"error\",\"message\":\"No free slots\"}");
      return;
    }

    devices[slot].active    = true;
    devices[slot].totalTime = 0;
    devices[slot].state     = false;
    strlcpy(devices[slot].name, server.arg("name").c_str(), 32);
    strlcpy(devices[slot].room, server.arg("room").c_str(), 32);
    strlcpy(devices[slot].type,
            server.hasArg("type") ? server.arg("type").c_str() : "light", 16);

    devices[slot].pin   = server.arg("pin").toInt();
    devices[slot].inPin = (server.hasArg("inpin") && server.arg("inpin") != "")
                            ? server.arg("inpin").toInt() : -1;
    devices[slot].scheduleActive = false;

    if (devices[slot].pin != -1) {
      if (strcmp(devices[slot].type, "sensor") == 0) {
        if (dht == nullptr) { dht = new DHT(devices[slot].pin, DHTTYPE); dht->begin(); }
      } else {
        pinMode(devices[slot].pin, INPUT);
      }
    }
    if (devices[slot].inPin != -1) {
      pinMode(devices[slot].inPin, INPUT_PULLUP);
      devices[slot].lastButtonState = (digitalRead(devices[slot].inPin) == HIGH);
    }

    saveDevice(slot);
    stateDirty = true;
    server.send(200, "application/json", "{\"status\":\"ok\"}");
  });

  // 🔴 FIX: /api/delete محمي بـ API Key
  server.on("/api/delete", HTTP_GET, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }

    if (server.hasArg("id")) {
      int id = server.arg("id").toInt();
      if (id >= 0 && id < MAX_DEVICES) {
        devices[id].active = false;
        if (devices[id].pin != -1 && strcmp(devices[id].type, "sensor") != 0) {
          pinMode(devices[id].pin, INPUT);
        }
        saveDevice(id);
        stateDirty = true;
        server.send(200, "application/json", "{\"status\":\"deleted\"}");
        return;
      }
    }
    server.send(400, "application/json", "{\"status\":\"error\"}");
  });

  // 🟢 FIX: /api/sync لعمل مزامنة مع السيرفر بعد الاكتشاف
  server.on("/api/sync", HTTP_GET, []() {
    sendCORSHeaders();
    if (!checkApiKey()) { sendUnauthorized(); return; }
    
    JsonDocument doc;
    doc["boardId"]   = boardID;
    doc["boardName"] = boardName;
    doc["ip"]        = WiFi.localIP().toString();
    JsonArray array  = doc["devices"].to<JsonArray>();

    for (int i = 0; i < MAX_DEVICES; i++) {
      if (!devices[i].active) continue;
      JsonObject obj = array.add<JsonObject>();
      obj["id"]       = i;
      obj["name"]     = devices[i].name;
      obj["room"]     = devices[i].room;
      obj["type"]     = devices[i].type;
      obj["pin"]      = devices[i].pin;
      obj["inPin"]    = devices[i].inPin;
      obj["state"]    = devices[i].state ? "ON" : "OFF";
      obj["pwmValue"] = devices[i].pwmValue;
      obj["color"]    = devices[i].color;
    }

    String out;
    serializeJson(doc, out);
    server.send(200, "application/json", out);
  });

  // OTA Update (محمي بـ API Key في GET)
  server.on("/update", HTTP_GET, []() {
    if (!checkApiKey()) { sendUnauthorized(); return; }
    otaAuthorized = true;
    server.sendHeader("Connection", "close");
    String html = R"(
      <html><head>
        <meta name='viewport' content='width=device-width,initial-scale=1'>
        <style>
          body{font-family:Arial;padding:20px;background:#111827;color:white;text-align:center}
          form{max-width:400px;margin:0 auto;background:#1f2937;padding:20px;border-radius:10px}
          input[type=file]{margin:20px 0;display:block;width:100%}
          input[type=submit]{background:#3b82f6;color:white;padding:10px 20px;border:none;border-radius:5px;width:100%;font-size:16px;cursor:pointer}
        </style>
      </head><body>
        <h2>Mosa Smart Node - Firmware Update</h2>
        <form method='POST' action='/update' enctype='multipart/form-data'>
          <input type='file' name='update' accept='.bin'>
          <input type='submit' value='Upload &amp; Update'>
        </form>
      </body></html>
    )";
    server.send(200, "text/html", html);
  });

  server.on("/update", HTTP_POST,
    []() {
      otaAuthorized = false; // إلغاء بعد الاستخدام
      if (Update.hasError()) {
        server.sendHeader("Connection", "close");
        server.send(200, "text/plain", "Update Failed");
        return;
      }
      server.sendHeader("Connection", "close");
      server.send(200, "text/plain", "Update Success! Rebooting...");
      delay(1000); ESP.restart();
    },
    []() {
      if (!otaAuthorized) return;
      HTTPUpload &upload = server.upload();
      if (upload.status == UPLOAD_FILE_START) {
        Serial.printf("[OTA] Start: %s\n", upload.filename.c_str());
        if (!Update.begin(UPDATE_SIZE_UNKNOWN)) Update.printError(Serial);
      } else if (upload.status == UPLOAD_FILE_WRITE) {
        if (Update.write(upload.buf, upload.currentSize) != upload.currentSize)
          Update.printError(Serial);
      } else if (upload.status == UPLOAD_FILE_END) {
        if (Update.end(true)) Serial.printf("[OTA] Success: %u bytes\n", upload.totalSize);
        else Update.printError(Serial);
      }
    });

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) { sendCORSHeaders(); server.send(204); }
    else server.send(404, "text/plain", "Not found");
  });

  server.begin();
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  // 🟢 FIX: MQTT خاص - اتصال بـ credentials + Last Will
  mqttClient.setServer(mqttHost.c_str(), 1883);
  mqttClient.setSocketTimeout(2);
  mqttClient.setCallback(mqttCallback);

  ArduinoOTA.setHostname("MosaSmartNode");
  ArduinoOTA.begin();

  if (dht == nullptr) { dht = new DHT(DHT_PIN, DHTTYPE); dht->begin(); }
  pinMode(PIR_PIN, INPUT);

  // بدء أول عيّنة ACS
  acsStartSample();

  Serial.println("[System] Backend Ready v3.0");
}

// ==========================================
// 8. Loop
// ==========================================
unsigned long lastMqttReconnect  = 0;
bool btnLastRaw[MAX_DEVICES]     = {};
unsigned long btnLastChange[MAX_DEVICES] = {};
bool pirLastState                = false;
unsigned long pirLastTrigger     = 0;
unsigned long lastSensorTime     = 0;
unsigned long lastFlushTime      = 0;
unsigned long lastBroadcastTime  = 0;
int lastCheckedMinute            = -1;

// 🔴 FIX: قراءة DHT بدون blocking
void dhtUpdate() {
  if (dht == nullptr) return;
  unsigned long now = millis();

  if (dhtState.phase == DHT_IDLE) {
    // ابدأ دورة قياس جديدة كل 5 ثوانٍ
    if (now - lastSensorTime >= 5000) {
      lastSensorTime      = now;
      dhtState.triggerTime = now;
      dhtState.phase      = DHT_TRIGGERED;
      // DHT22 يحتاج 2000ms بين قراءتين - نبدأ الطلب فقط
    }
  } else if (dhtState.phase == DHT_TRIGGERED) {
    // انتظر 2000ms بدون blocking
    if (now - dhtState.triggerTime >= 2000) {
      dhtState.phase = DHT_READY;
    }
  } else if (dhtState.phase == DHT_READY) {
    dhtState.phase = DHT_IDLE;

    float h = dht->readHumidity();
    float t = dht->readTemperature();

    if (!isnan(h) && !isnan(t)) {
      dhtNanCount = 0;
      if (currentTemp != t || currentHum != h) {
        currentTemp = t;
        currentHum  = h;
        stateDirty  = true;
      }
    } else {
      dhtNanCount++;
      if (dhtNanCount >= 3) {
        for (int i = 0; i < MAX_DEVICES; i++) {
          if (devices[i].active && devices[i].state && 
             (strcmp(devices[i].type, "cooling") == 0 || strcmp(devices[i].type, "heating") == 0)) {
            toggleLogic(i, true);
          }
        }
      }
    }
  }
}

void readSwitches() {
  unsigned long now = millis();
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (!devices[i].active || devices[i].inPin == -1) continue;
    bool raw = (digitalRead(devices[i].inPin) == HIGH);
    if (raw != btnLastRaw[i]) { btnLastRaw[i] = raw; btnLastChange[i] = now; }
    if ((now - btnLastChange[i]) >= 50 && raw != devices[i].lastButtonState) {
      devices[i].lastButtonState = raw;
      toggleLogic(i);
    }
  }
}

void loop() {
  esp_task_wdt_reset();
  server.handleClient();
  webSocket.loop();
  ArduinoOTA.handle();

  unsigned long now = millis();

  // ── 🔴 ACS Non-Blocking ───────────────────────────────
  if (acsUpdate()) {
    float p = acsState.lastResult;
    // حساب KWh
    static unsigned long lastAcsTime = 0;
    if (lastAcsTime > 0) {
      unsigned long elapsed = now - lastAcsTime;
      double hoursPassed = elapsed / 3600000.0;
      totalKWh += (p * hoursPassed) / 1000.0;
      if (now - lastKWhSave > 3600000) {
        prefs.begin("smarthome", false);
        prefs.putDouble("totalkwh", totalKWh);
        prefs.end();
        lastKWhSave = now;
      }
    }
    lastAcsTime = now;

    if (abs(currentPower - p) > 5.0f) {
      currentPower = p;
      stateDirty   = true;
    }
    acsStartSample(); // ابدأ عيّنة جديدة فوراً
  }

  // ── 🔴 DHT Non-Blocking ───────────────────────────────
  dhtUpdate();

  // ── 📺 تحديث الشاشة بدون تعليق (Non-Blocking Display) ──
  updateDisplay();

  // ── 🟡 broadcastDevices مرة واحدة كل 500ms عند وجود تغيير
  if (stateDirty && (now - lastBroadcastTime >= 500)) {
    lastBroadcastTime = now;
    broadcastDevices();
  }

  // ── التشغيل المتدرج (Staggered Startup) ───────────────
  if (staggerCount > 0 && (now - lastStaggerTime >= 200)) {
    lastStaggerTime = now;
    int id = staggerQueue[--staggerCount];
    if (devices[id].state) {
       applyState(id);
       stateDirty = true;
    }
  }

  // ── 🟡 Flash Write Batching - كل 10 ثوانٍ ────────────
  if (now - lastFlushTime >= 10000) {
    lastFlushTime = now;
    flushPendingSaves();
  }

  // ── Scheduling ────────────────────────────────────────
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 10)) {
    if (timeinfo.tm_min != lastCheckedMinute) {
      lastCheckedMinute = timeinfo.tm_min;
      int h = timeinfo.tm_hour, m = timeinfo.tm_min;
      for (int i = 0; i < MAX_DEVICES; i++) {
        if (!devices[i].active || !devices[i].scheduleActive) continue;
        if (devices[i].scheduleHourOn == h && devices[i].scheduleMinuteOn == m && !devices[i].state)
          toggleLogic(i);
        else if (devices[i].scheduleHourOff == h && devices[i].scheduleMinuteOff == m && devices[i].state)
          toggleLogic(i);
      }
    }
  }

  // ── PIR Non-Blocking ─────────────────────────────────
  bool pirNow = (digitalRead(PIR_PIN) == HIGH);
  if (pirNow && !pirLastState && (now - pirLastTrigger > 5000)) {
    pirLastTrigger = now;
    String alertMsg = "{\"type\":\"alarm\",\"message\":\"PIR_TRIGGERED\"}";
    for (uint8_t i = 0; i < WEBSOCKETS_SERVER_CLIENT_MAX; i++)
      if (wsAuthenticated[i]) webSocket.sendTXT(i, alertMsg);
    if (mqttClient.connected())
      mqttClient.publish(("home/" + boardID + "/alarm").c_str(), alertMsg.c_str());
  }
  pirLastState = pirNow;

  // ── 🟢 MQTT Reconnect - مع Credentials + Last Will ───
  if (WiFi.status() == WL_CONNECTED && !mqttClient.connected() &&
      (lastMqttReconnect == 0 || now - lastMqttReconnect > 30000)) {
    lastMqttReconnect = now;
    String willTopic = "home/" + boardID + "/status";
    String clientID  = boardID + "_" + String(millis()); // Unique per session

    bool connected = false;
    if (mqttUser.length() > 0) {
      // 🟢 MQTT مع مصادقة + Last Will
      connected = mqttClient.connect(
        clientID.c_str(),
        mqttUser.c_str(),
        mqttPassword.c_str(),
        willTopic.c_str(), 1, true, // Will: QoS=1, retain=true
        "{\"online\":false}"
      );
    } else {
      // 🟢 MQTT بدون مصادقة + Last Will فقط
      connected = mqttClient.connect(
        clientID.c_str(),
        nullptr, nullptr,
        willTopic.c_str(), 1, true,
        "{\"online\":false}"
      );
    }

    if (connected) {
      mqttClient.subscribe(("home/" + boardID + "/command").c_str());
      mqttClient.subscribe(("home/" + boardID + "/set/+").c_str());
      // نشر حالة online
      mqttClient.publish(willTopic.c_str(), "{\"online\":true}", true);
      
      static bool haDiscoveryPublished = false;
      if (!haDiscoveryPublished) {
        publishHAAutoDiscovery();
        haDiscoveryPublished = true;
      }
      
      Serial.println("[MQTT] Connected to " + mqttHost);
    }
  }
  if (mqttClient.connected()) mqttClient.loop();

  // ── Switches ─────────────────────────────────────────
  readSwitches();

  // ── Timer Logic ───────────────────────────────────────
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].state &&
        devices[i].timerOffMillis > 0 && now >= devices[i].timerOffMillis) {
      devices[i].timerOffMillis = 0;
      toggleLogic(i);
    }
  }
}
