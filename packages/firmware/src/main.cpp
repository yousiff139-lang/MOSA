/*
 * ╔══════════════════════════════════════════════════════════╗
 * ║         MosaSmartNode - Firmware v4.0 (Enterprise)      ║
 * ║  التحسينات المطبّقة:                                    ║
 * ║  🔥 فصل المعالجة عبر نواتين (Dual-Core FreeRTOS)        ║
 * ║  🔥 حماية الذاكرة بخاصية النواقل الآمنة (Mutex)         ║
 * ║  🔥 مقاطعات الأزرار اللحظية (Hardware Interrupts)       ║
 * ║  🔥 توسيع ذاكرة MQTT للتعامل مع الـ JSON العملاق        ║
 * ╚══════════════════════════════════════════════════════════╝
 */

#include <ArduinoJson.h>
#include <ArduinoOTA.h>
#include <DHT.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include "mosa_setup_ui.h"
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
// FreeRTOS Mutex للحماية بين النواتين
// ==========================================
SemaphoreHandle_t stateMutex;

#include <DNSServer.h>
const byte DNS_PORT = 53;
DNSServer dnsServer;
bool isApFallbackActive = false;
unsigned long apFallbackStartTime = 0;
unsigned long wifiDisconnectedStartTime = 0;

// ==========================================
// إعدادات الشبكة والأمان
// ==========================================
WebServer server(80);
WebSocketsServer webSocket = WebSocketsServer(82);
Preferences prefs;

String wsPassword  = "admin";
String apiKey      = "changeme123";
String homeId      = "home-1";
int timeZoneOffset = 10800;
bool wsAuthenticated[WEBSOCKETS_SERVER_CLIENT_MAX] = {false};
unsigned long lastAuthAttempt[WEBSOCKETS_SERVER_CLIENT_MAX] = {0};
int authFailCount[WEBSOCKETS_SERVER_CLIENT_MAX] = {0};

#define MAX_DEVICES 10

// ==========================================
// هياكل البيانات
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
// Hardware Interrupts Globals
// ==========================================
volatile bool switchChanged[MAX_DEVICES] = {false};

// دالة المقاطعة (ISR) - سريعة جداً ولا تحتوي على دوال معقدة
void IRAM_ATTR handleSwitchInterrupt(void* arg) {
  int id = (int)(uintptr_t)arg;
  switchChanged[id] = true;
}

// ==========================================
// متغيرات النظام والحساسات
// ==========================================
struct ACSState {
  int     maxVal      = 0;
  int     minVal      = 4095;
  uint32_t startTime  = 0;
  bool    sampling    = false;
  float   lastResult  = 0.0f;
};
ACSState acsState;

void acsStartSample() {
  acsState.maxVal    = 0;
  acsState.minVal    = 4095;
  acsState.startTime = millis();
  acsState.sampling  = true;
}

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

DHT *dht           = nullptr;
float currentTemp  = 0.0f;
float currentHum   = 0.0f;
float currentPower = 0.0f;
double totalKWh    = 0.0;
unsigned long lastKWhSave = 0;

enum DHTPhase { DHT_IDLE, DHT_TRIGGERED, DHT_READY };
struct DHTState {
  DHTPhase phase        = DHT_IDLE;
  uint32_t triggerTime  = 0;
};
DHTState dhtState;

const char *mqtt_server = "broker.hivemq.com"; 
WiFiClient  espClient;
PubSubClient mqttClient(espClient);

String boardID   = "";
String boardName = "";

bool stateDirty = false;

unsigned long lastTurnOffTime[MAX_DEVICES] = {0};
int staggerQueue[MAX_DEVICES];
int staggerCount = 0;
unsigned long lastStaggerTime = 0;
int dhtNanCount = 0;

unsigned long lastDisplayUpdate = 0;
unsigned long lastPageChange = 0;
int currentDisplayPage = 0;
unsigned long lastInteractionTime = 0;
bool isDisplayAwake = true;

// ==========================================
// الدوال الرئيسية
// ==========================================

void updateDisplay() {
  unsigned long now = millis();
  
  if (now - lastInteractionTime > 300000) {
    if (isDisplayAwake) {
      display.ssd1306_command(SSD1306_DISPLAYOFF);
      isDisplayAwake = false;
    }
    return;
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

  xSemaphoreTake(stateMutex, portMAX_DELAY); // حماية القراءة
  float temp = currentTemp;
  float hum = currentHum;
  float pwr = currentPower;
  
  int onCount = 0;
  int totalCount = 0;
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active) {
      totalCount++;
      if (devices[i].state) onCount++;
    }
  }
  xSemaphoreGive(stateMutex);

  if (currentDisplayPage == 0) {
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
    display.setCursor(0, 0);
    display.println(F("--- ENVIRONMENT ---"));
    display.println();
    display.print(F("Temp: "));
    display.print(temp, 1);
    display.println(F(" C"));
    display.print(F("Hum:  "));
    display.print(hum, 1);
    display.println(F(" %"));
    display.println();
    display.print(F("Power: "));
    display.print(pwr, 1);
    display.println(F(" W"));
  } 
  else if (currentDisplayPage == 2) {
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

void flushPendingSaves() {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].needsSave) {
      saveDevice(i);
    }
  }
  xSemaphoreGive(stateMutex);
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
        pinMode(devices[i].pin, INPUT); 
        if (devices[i].state) {
          staggerQueue[staggerCount++] = i; 
        }
      }
    }
    if (devices[i].inPin != -1) {
      pinMode(devices[i].inPin, INPUT_PULLUP);
      devices[i].lastButtonState = (digitalRead(devices[i].inPin) == HIGH);
      // ربط المقاطعة
      attachInterruptArg(digitalPinToInterrupt(devices[i].inPin), handleSwitchInterrupt, (void*)(uintptr_t)i, CHANGE);
    }
  }
  prefs.end();
}

void initHardwareBoard() {
  prefs.begin("smarthome", false);
  if (prefs.getBool("board_configured", false)) { prefs.end(); return; }
  Serial.println("[System] First boot! No auto-devices added.");
  prefs.putBool("board_configured", true);
  prefs.end();
}

void broadcastDevices() {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  stateDirty = false; 

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
  xSemaphoreGive(stateMutex);

  String buffer;
  serializeJson(doc, buffer);

  for (uint8_t i = 0; i < WEBSOCKETS_SERVER_CLIENT_MAX; i++) {
    if (wsAuthenticated[i]) webSocket.sendTXT(i, buffer);
  }

  if (mqttClient.connected()) {
    String stateTopic = "mosa/" + homeId + "/device/" + boardID + "/state";
    mqttClient.publish(stateTopic.c_str(), buffer.c_str(), true); 
  }
}

// NOTE: Should be called with stateMutex locked!
void applyState(int id) {
  if (devices[id].pin == -1 || strcmp(devices[id].type, "sensor") == 0) return;

  if (devices[id].state) {
    pinMode(devices[id].pin, OUTPUT);
    digitalWrite(devices[id].pin, LOW);
  } else {
    pinMode(devices[id].pin, INPUT);
  }
}

void broadcastESPNOWCommand(int deviceId, bool state); // Forward declaration

// NOTE: Should be called with stateMutex locked!
void toggleLogic(int id, bool force = false) {
  if (!devices[id].active || devices[id].pin == -1) return;
  lastInteractionTime = millis();

  if (!devices[id].state && !force && strcmp(devices[id].type, "cooling") == 0) {
    if (millis() - lastTurnOffTime[id] < 180000 && lastTurnOffTime[id] > 0) {
       return; 
    }
  }

  devices[id].state = !devices[id].state;
  applyState(id);

  if (!force) {
    // Broadcast physical button press to the P2P Mesh
    broadcastESPNOWCommand(id, devices[id].state);
  }

  if (devices[id].state) {
    devices[id].startTime = millis();
  } else {
    devices[id].totalTime += (millis() - devices[id].startTime);
    devices[id].timerOffMillis = 0;
    lastTurnOffTime[id] = millis();
    devices[id].needsSave = true;
  }
  stateDirty = true;
}

void processCommand(JsonDocument &doc) {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  
  if (doc.containsKey("action") && doc.containsKey("pin")) {
    int targetPin = doc["pin"];
    const char *stateVal = doc["state"];
    bool targetState = (stateVal && strcmp(stateVal, "ON") == 0);
    
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active && devices[i].pin == targetPin) {
        if (devices[i].state != targetState) {
          toggleLogic(i, true);
        }
        break;
      }
    }
    xSemaphoreGive(stateMutex);
    return;
  }

  const char *type = doc["type"];
  if (!type) {
    xSemaphoreGive(stateMutex);
    return;
  }
  
  lastInteractionTime = millis();

  if (strcmp(type, "toggle") == 0 && doc.containsKey("id")) {
    bool force = doc.containsKey("force") ? doc["force"].as<bool>() : false;
    toggleLogic((int)doc["id"], force);

  } else if (strcmp(type, "refresh") == 0) {
    stateDirty = true; // Will trigger broadcast in NetworkTask

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
      devices[id].needsSave = true;
      stateDirty = true;
    }

  } else if (strcmp(type, "reset") == 0) {
    for (int i = 0; i < MAX_DEVICES; i++) {
      if (devices[i].active) {
        devices[i].active = false;
        if (devices[i].pin != -1 && strcmp(devices[i].type, "sensor") != 0) {
          pinMode(devices[i].pin, INPUT);
        }
        devices[i].needsSave = true;
      }
    }
    stateDirty = true;
  }
  
  xSemaphoreGive(stateMutex);
}

bool checkApiKey() {
  String key = "";
  if (server.hasHeader("X-API-Key")) {
    key = server.header("X-API-Key");
  } else if (server.hasArg("key")) {
    key = server.arg("key");
  }
  return (key == apiKey);
}

void sendUnauthorized() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.send(401, "application/json", "{\"status\":\"error\",\"message\":\"Unauthorized\"}");
}

void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
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
          xSemaphoreTake(stateMutex, portMAX_DELAY);
          stateDirty = true; // Trigger broadcast safely
          xSemaphoreGive(stateMutex);
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
  
  if (t.indexOf("system/security/command") != -1) {
    JsonDocument doc;
    if (!deserializeJson(doc, msg)) {
       String state = doc["state"].as<String>();
       if (state == "ARMED" || state == "ARMED_AWAY" || state == "ARMED_HOME") {
          digitalWrite(BUILTIN_LED, HIGH); // Example: Siren ON
          Serial.println("[MOSA] Security ARMED");
       } else {
          digitalWrite(BUILTIN_LED, LOW); // Siren OFF
          Serial.println("[MOSA] Security DISARMED");
       }
    }
    return;
  }
  
  if (msg == "ON" || msg == "OFF") {
    int cmdIndex = t.lastIndexOf("/command");
    if (cmdIndex != -1) {
      int idStart = t.lastIndexOf('/', cmdIndex - 1);
      if (idStart != -1) {
        String devIdStr = t.substring(idStart + 1, cmdIndex);
        int id = -1;
        if (devIdStr.startsWith("dev-")) id = devIdStr.substring(4).toInt();
        else id = devIdStr.toInt();
        
        if (id >= 0 && id < MAX_DEVICES) {
          xSemaphoreTake(stateMutex, portMAX_DELAY);
          if (devices[id].active) {
            bool targetState = (msg == "ON");
            if (devices[id].state != targetState) {
              toggleLogic(id, true);
            }
          }
          xSemaphoreGive(stateMutex);
          return;
        }
      }
    }
  }

  JsonDocument doc;
  if (!deserializeJson(doc, msg)) processCommand(doc);
}

void publishHAAutoDiscovery() {
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (!devices[i].active || devices[i].pin == -1 || strcmp(devices[i].type, "sensor") == 0) continue;
    String safeName = boardID + "_" + String(i);
    String typeStr = (strcmp(devices[i].type, "cooling") == 0) ? "switch" : "light";
    String topic = "homeassistant/" + typeStr + "/" + safeName + "/config";
    
    JsonDocument doc;
    doc["name"] = String(boardName) + " " + devices[i].name;
    doc["unique_id"] = safeName;
    doc["state_topic"] = "mosa/" + homeId + "/device/" + boardID + "/state";
    doc["value_template"] = "{{ 'ON' if (value_json.devices | selectattr('id','equalto'," + String(i) + ") | first).state == 'ON' else 'OFF' }}";
    doc["command_topic"] = "mosa/" + homeId + "/device/" + boardID + "/command";
    
    String payload;
    serializeJson(doc, payload);
    mqttClient.publish(topic.c_str(), payload.c_str(), true);
  }
  xSemaphoreGive(stateMutex);
}

// ==========================================
// Setup
// ==========================================
String mqttHost     = "broker.hivemq.com";
String mqttUser     = "";
String mqttPassword = "";
bool otaAuthorized = false;

#include "mosa_espnow.h"

void startAPFallback() {
  String macStr = WiFi.macAddress();
  macStr.replace(":", "");
  String ssid = "MOSA_Setup_" + macStr.substring(macStr.length() - 4);
  WiFi.mode(WIFI_AP);
  WiFi.softAP(ssid.c_str());
  dnsServer.start(DNS_PORT, "*", WiFi.softAPIP());
  isApFallbackActive = true;
  apFallbackStartTime = millis();
  Serial.println("Started AP Fallback: " + ssid);
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  stateMutex = xSemaphoreCreateMutex();
  
  Wire.begin(DISP_SDA, DISP_SCL);
  if(display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 20);
    display.println(F("  MosaSmart Node v4"));
    display.display();
  }

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

  prefs.begin("wifi", true);
  homeId         = prefs.getString("homeid",   "home-1");
  boardName      = prefs.getString("nodename", "غرفة غير مسماة");
  String savedSsid = prefs.getString("ssid",   "");
  String savedPass = prefs.getString("pass",   "");
  wsPassword     = prefs.getString("wspass",   "admin");
  apiKey         = prefs.getString("apikey",   "changeme123");
  timeZoneOffset = prefs.getInt(   "tz",        10800);
  mqttHost       = prefs.getString("mqtthost",  "broker.hivemq.com");
  mqttUser       = prefs.getString("mqttuser",  "");
  mqttPassword   = prefs.getString("mqttpass",  "");
  prefs.end();

  boardID = "MosaNode_" + WiFi.macAddress();
  boardID.replace(":", "");

  if (savedSsid == "") { 
    startAPFallback();
  } else {
    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(savedSsid.c_str(), savedPass.c_str());
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      delay(500); esp_task_wdt_reset(); attempts++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      if (MDNS.begin(boardID.c_str())) {
        MDNS.addService("mosasmart", "tcp", 80);
      }

      readDS3231Time();
      sntp_set_time_sync_notification_cb(timeSyncCallback);
      configTime(timeZoneOffset, 0, "pool.ntp.org", "time.nist.gov");
    } else {
      startAPFallback();
      readDS3231Time();
    }
  }

  // Initialize ESP-NOW
  initESPNOW();

  // API Routes
  server.on("/api/status", HTTP_GET, []() {
    sendCORSHeaders();
    JsonDocument doc;
    doc["boardId"]    = boardID;
    
    xSemaphoreTake(stateMutex, portMAX_DELAY);
    doc["totalKWh"]   = totalKWh;
    int activeCount = 0;
    for (int i = 0; i < MAX_DEVICES; i++) if (devices[i].active) activeCount++;
    doc["activeDevices"] = activeCount;
    xSemaphoreGive(stateMutex);

    String out;
    serializeJson(doc, out);
    server.send(200, "application/json", out);
  });

  server.onNotFound([]() {
    if (server.method() == HTTP_OPTIONS) { sendCORSHeaders(); server.send(204); return; }
    if (isApFallbackActive) {
      server.sendHeader("Location", String("http://") + WiFi.softAPIP().toString(), true);
      server.send(302, "text/plain", "");
      return;
    }
    server.send(404, "text/plain", "Not found");
  });

  server.on("/", HTTP_GET, []() {
    if (isApFallbackActive) {
      server.send_P(200, "text/html", CAPTIVE_PORTAL_HTML);
    } else {
      server.send(200, "text/plain", "Mosa Node Active");
    }
  });

  server.on("/save", HTTP_POST, []() {
    if (server.hasArg("ssid")) {
      prefs.begin("wifi", false);
      prefs.putString("ssid", server.arg("ssid"));
      prefs.putString("pass", server.arg("pass"));
      
      if (server.hasArg("homeid")) prefs.putString("homeid", server.arg("homeid"));
      if (server.hasArg("nodename")) prefs.putString("nodename", server.arg("nodename"));
      if (server.hasArg("mqtthost")) prefs.putString("mqtthost", server.arg("mqtthost"));
      if (server.hasArg("mqttuser")) prefs.putString("mqttuser", server.arg("mqttuser"));
      if (server.hasArg("mqttpass")) prefs.putString("mqttpass", server.arg("mqttpass"));
      
      prefs.end();
      server.send(200, "text/html", "<html><head><meta charset='utf-8'></head><body style='background:#0b0e14;color:#10b981;text-align:center;margin-top:50px;'><h1>تم الحفظ! جاري إعادة التشغيل...</h1></body></html>");
      delay(1000);
      ESP.restart();
    } else {
      server.send(400, "text/plain", "SSID Required");
    }
  });

  server.begin();
  webSocket.begin();
  webSocket.onEvent(onWebSocketEvent);

  // 🔥 إصلاح مشكلة ذاكرة الـ MQTT
  mqttClient.setBufferSize(4096); 
  mqttClient.setServer(mqttHost.c_str(), 1883);
  mqttClient.setCallback(mqttCallback);

  ArduinoOTA.setHostname("MosaSmartNode");
  ArduinoOTA.begin();

  if (dht == nullptr) { dht = new DHT(DHT_PIN, DHTTYPE); dht->begin(); }
  pinMode(PIR_PIN, INPUT);

  acsStartSample();

  // 🔥 تشغيل النواة 0 (Network Core)
  xTaskCreatePinnedToCore(
    [](void *pvParameters) {
      unsigned long lastMqttReconnect = 0;
      for (;;) {
        server.handleClient();
        webSocket.loop();
        ArduinoOTA.handle();

        bool dirty = false;
        xSemaphoreTake(stateMutex, portMAX_DELAY);
        dirty = stateDirty;
        xSemaphoreGive(stateMutex);

        static unsigned long lastBroadcastTime = 0;
        if (dirty && (millis() - lastBroadcastTime >= 500)) {
          lastBroadcastTime = millis();
          broadcastDevices();
        }

        static unsigned long reconnectDelay = 5000;
        static unsigned long lastReconnectAttempt = 0;

        if (WiFi.status() == WL_CONNECTED) {
          reconnectDelay = 5000; // Reset backoff delay on successful connection
          wifiDisconnectedStartTime = 0;
          if (isApFallbackActive) {
            ESP.restart(); // Restart to disable AP cleanly once connected
          }

          if (!mqttClient.connected() && (lastMqttReconnect == 0 || millis() - lastMqttReconnect > 30000)) {
            lastMqttReconnect = millis();
            String clientID  = boardID + "_" + String(millis());
            String willTopic = "mosa/" + homeId + "/device/" + boardID + "/status";
            bool connected = (mqttUser.length() > 0) 
                ? mqttClient.connect(clientID.c_str(), mqttUser.c_str(), mqttPassword.c_str(), willTopic.c_str(), 1, true, "{\"online\":false}")
                : mqttClient.connect(clientID.c_str(), nullptr, nullptr, willTopic.c_str(), 1, true, "{\"online\":false}");
            
            if (connected) {
              mqttClient.subscribe(("mosa/" + homeId + "/device/+/command").c_str());
              mqttClient.subscribe(("mosa/" + homeId + "/system/security/command").c_str());
              mqttClient.publish(willTopic.c_str(), "{\"online\":true}", true);
              publishHAAutoDiscovery();
            }
          }
          if (mqttClient.connected()) mqttClient.loop();
        } else {
          if (wifiDisconnectedStartTime == 0) {
            wifiDisconnectedStartTime = millis();
            // Disconnect to stop auto-scanning and stabilize channel 1 for ESP-NOW Mesh
            WiFi.disconnect();
            forceWiFiChannel(1);
          } else if (!isApFallbackActive && millis() - wifiDisconnectedStartTime > 180000) { // 3 mins
            startAPFallback();
          }

          // Try to reconnect using exponential backoff + jitter
          if (!isApFallbackActive && (lastReconnectAttempt == 0 || millis() - lastReconnectAttempt > (reconnectDelay + random(0, 5000)))) {
            lastReconnectAttempt = millis();
            Serial.printf("[WiFi] Reconnecting with backoff delay: %lu ms\n", reconnectDelay);
            WiFi.begin(); // Attempt to connect with saved credentials
            
            // Double reconnect delay for next attempt, capped at 120s (2 minutes)
            reconnectDelay = min(reconnectDelay * 2, 120000UL);
          }
        }

        if (isApFallbackActive) {
          dnsServer.processNextRequest();
          if (millis() - apFallbackStartTime > 900000) { // 15 mins
            ESP.restart();
          }
        }
        vTaskDelay(10 / portTICK_PERIOD_MS); // إعطاء النواة راحة للتنفس
      }
    },
    "NetworkTask",
    8192,
    NULL,
    1,
    NULL,
    0 // تخصيص المهمة للنواة 0
  );
}

// ==========================================
// Core 1 (Hardware Core) - Loop()
// ==========================================
unsigned long lastSensorTime     = 0;
unsigned long lastFlushTime      = 0;
int lastCheckedMinute            = -1;
bool pirLastState                = false;
unsigned long pirLastTrigger     = 0;

void dhtUpdate() {
  if (dht == nullptr) return;
  unsigned long now = millis();

  if (dhtState.phase == DHT_IDLE) {
    if (now - lastSensorTime >= 5000) {
      lastSensorTime      = now;
      dhtState.triggerTime = now;
      dhtState.phase      = DHT_TRIGGERED;
    }
  } else if (dhtState.phase == DHT_TRIGGERED) {
    if (now - dhtState.triggerTime >= 2000) {
      dhtState.phase = DHT_READY;
    }
  } else if (dhtState.phase == DHT_READY) {
    dhtState.phase = DHT_IDLE;
    float h = dht->readHumidity();
    float t = dht->readTemperature();

    xSemaphoreTake(stateMutex, portMAX_DELAY);
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
    xSemaphoreGive(stateMutex);
  }
}

void loop() {
  esp_task_wdt_reset(); // نواة 1 تحت مراقبة الواتش دوج

  unsigned long now = millis();

  // ── قراءة الأزرار عبر المقاطعات الفورية (Interrupts) ──
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (switchChanged[i]) {
      switchChanged[i] = false;
      xSemaphoreTake(stateMutex, portMAX_DELAY);
      if (devices[i].active && devices[i].inPin != -1) {
        bool raw = (digitalRead(devices[i].inPin) == HIGH);
        if (raw != devices[i].lastButtonState) {
          devices[i].lastButtonState = raw;
          toggleLogic(i);
        }
      }
      xSemaphoreGive(stateMutex);
    }
  }

  // ── ACS Sensor ──
  if (acsUpdate()) {
    float p = acsState.lastResult;
    static unsigned long lastAcsTime = 0;
    
    xSemaphoreTake(stateMutex, portMAX_DELAY);
    if (lastAcsTime > 0) {
      unsigned long elapsed = now - lastAcsTime;
      totalKWh += (p * (elapsed / 3600000.0)) / 1000.0;
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
    xSemaphoreGive(stateMutex);
    acsStartSample(); 
  }

  dhtUpdate();
  updateDisplay();

  // ── التشغيل المتدرج ──
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  if (staggerCount > 0 && (now - lastStaggerTime >= 200)) {
    lastStaggerTime = now;
    int id = staggerQueue[--staggerCount];
    if (devices[id].state) {
       applyState(id);
       stateDirty = true;
    }
  }
  xSemaphoreGive(stateMutex);

  // ── حفظ الفلاش المؤجل ──
  if (now - lastFlushTime >= 10000) {
    lastFlushTime = now;
    flushPendingSaves();
  }

  // ── الجدولة الزمنية ──
  struct tm timeinfo;
  if (getLocalTime(&timeinfo, 10)) {
    if (timeinfo.tm_min != lastCheckedMinute) {
      lastCheckedMinute = timeinfo.tm_min;
      int h = timeinfo.tm_hour, m = timeinfo.tm_min;
      
      xSemaphoreTake(stateMutex, portMAX_DELAY);
      for (int i = 0; i < MAX_DEVICES; i++) {
        if (!devices[i].active || !devices[i].scheduleActive) continue;
        if (devices[i].scheduleHourOn == h && devices[i].scheduleMinuteOn == m && !devices[i].state)
          toggleLogic(i);
        else if (devices[i].scheduleHourOff == h && devices[i].scheduleMinuteOff == m && devices[i].state)
          toggleLogic(i);
      }
      xSemaphoreGive(stateMutex);
    }
  }

  // ── PIR Sensor ──
  bool pirNow = (digitalRead(PIR_PIN) == HIGH);
  if (pirNow && !pirLastState && (now - pirLastTrigger > 5000)) {
    pirLastTrigger = now;
    String alertMsg = "{\"type\":\"alarm\",\"message\":\"PIR_TRIGGERED\"}";
    for (uint8_t i = 0; i < WEBSOCKETS_SERVER_CLIENT_MAX; i++)
      if (wsAuthenticated[i]) webSocket.sendTXT(i, alertMsg);
    if (mqttClient.connected())
      mqttClient.publish(("mosa/" + homeId + "/sensor/motion/" + boardID).c_str(), alertMsg.c_str());
  }
  pirLastState = pirNow;

  // ── Timer Logic ──
  xSemaphoreTake(stateMutex, portMAX_DELAY);
  for (int i = 0; i < MAX_DEVICES; i++) {
    if (devices[i].active && devices[i].state &&
        devices[i].timerOffMillis > 0 && now >= devices[i].timerOffMillis) {
      devices[i].timerOffMillis = 0;
      toggleLogic(i);
    }
  }
  xSemaphoreGive(stateMutex);

  vTaskDelay(10 / portTICK_PERIOD_MS); // Yield in loop
}
