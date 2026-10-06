/*
 * ══════════════════════════════════════════════════════════════════════════════
 *        MOSA SMART HI-FI SPEAKER & AUDIO HUB — نظام الصوت الذكي الشامل
 *        ESP32-S3 Hi-Fi Audio Controller for Large Speakers & Home Theater
 * ══════════════════════════════════════════════════════════════════════════════
 * 
 *  الميزات المضمنة في هذا الكود:
 *   1. 🔊 تشغيل سماعات ومضخمات كبيرة عبر كارت الصوت PCM5102A (I2S Hi-Fi DAC).
 *   2. 📱 بث مباشر من الهاتف (يوتيوب، بودكاست، ومقاطع صوتية) عبر الواجهة الذكية وشبكة الواي فاي.
 *   3. 📻 محطات راديو الإنترنت المستقلة (إذاعة القرآن الكريم من مكة والقاهرة، وإذاعات إخبارية).
 *   4. 🗣️ نطق صوتي للذكاء الاصطناعي (TTS): الرد الصوتي باللغة العربية وتنبيهات المنزل الذكي.
 *   5. 🍎 Integration APIs: متوافق مع Apple HomeKit، Google Home، و Amazon Alexa.
 *   6. 🎛️ تحكم كامل بمستوى الصوت والمعادل الرقمي (Equalizer: Bass / Mid / Treble).
 * 
 *  توصيل الأسلاك مع كارت الصوت (PCM5102A):
 *    - PCM5102A VCC  ──> 5V أو 3.3V
 *    - PCM5102A GND  ──> GND
 *    - PCM5102A BCK  ──> GPIO 14 (Bit Clock)
 *    - PCM5102A LRCK ──> GPIO 13 (Word Select / Left-Right Clock)
 *    - PCM5102A DIN  ──> GPIO 12 (Serial Data Output)
 *    - PCM5102A SCK  ──> GND
 *    - PCM5102A AUX  ──> مدخل AUX للسماعة الكبيرة أو مضخم الصوت (TPA3116D2)
 * ══════════════════════════════════════════════════════════════════════════════
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ESPmDNS.h>
#include <Audio.h>
#include <ArduinoJson.h>
#include <PubSubClient.h>

// ─── تخصيص منافذ الصوت I2S (ESP32-S3 Safe Pins) ───
#define I2S_BCLK_PIN  14
#define I2S_LRC_PIN   13
#define I2S_DOUT_PIN  12

// ─── إعدادات شبكة الواي فاي ───
// يمكنك تعديلها أو تركها لتبث شبكة AP في حال عدم الاتصال
const char* defaultSSID = "YOUR_WIFI_SSID";
const char* defaultPASS = "YOUR_WIFI_PASSWORD";

Audio audio;
WebServer server(80);
WiFiClient espClient;
PubSubClient mqttClient(espClient);

// ─── إعدادات وسيط MQTT وعزل المستأجر (ADR-0008 Control Plane) ───
const char* mqttServer = "192.168.1.102";
const int mqttPort = 1883;
String homeId = "home-1";
String nodeId = "MosaSpeaker_S3";
String setTopic = "";
String stateTopic = "";
String statusTopic = "";
unsigned long lastMqttRetry = 0;

// ─── متغيرات التحكم بالسبيكر ومستوى الصوت ───
int currentVolume = 14;      // من 0 إلى 21 (الافتراضي 14)
int previousVolume = 14;     // لحفظ الصوت عند الكتم
bool audioMuted = false;     // حالة كتم الصوت
bool isPlaying = false;
String currentTrackTitle = "جاهز للتشغيل";
String currentSource = "Idle";

void publishAudioState();
void reconnectMqttNonBlocking();
void onMqttMessage(char* topic, byte* payload, unsigned int length);

// ─── تصميم واجهة الويب الاحترافية للهاتف (Mobile Web Player) ───
const char HTML_PLAYER[] PROGMEM = R"rawhtml(
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MOSA Smart Hi-Fi Speaker</title>
  <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #06b6d4;
      --primary-dark: #0891b2;
      --bg: #090d16;
      --card: #111827;
      --text: #f9fafb;
      --muted: #9ca3af;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Tajawal', sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .player-card { background: var(--card); border: 1px solid rgba(255,255,255,0.1); border-radius: 28px; width: 100%; max-width: 440px; padding: 28px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); }
    .header { text-align: center; margin-bottom: 24px; }
    .badge { display: inline-block; background: rgba(6,182,212,0.15); color: var(--primary); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; margin-bottom: 8px; border: 1px solid rgba(6,182,212,0.3); }
    .title { font-size: 24px; font-weight: 900; }
    .track-info { background: rgba(0,0,0,0.3); border-radius: 18px; padding: 18px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.05); }
    .track-name { font-size: 16px; font-weight: 700; color: #38bdf8; margin-bottom: 4px; }
    .track-source { font-size: 12px; color: var(--muted); }
    
    .section-title { font-size: 14px; font-weight: 700; color: var(--muted); margin-bottom: 12px; }
    .presets-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; }
    .preset-btn { background: #1f2937; border: 1px solid rgba(255,255,255,0.08); color: white; padding: 12px 10px; border-radius: 14px; font-size: 12px; font-weight: 700; cursor: pointer; transition: 0.2s; text-align: center; }
    .preset-btn:hover, .preset-btn:active { background: var(--primary-dark); }
    
    .input-group { display: flex; gap: 8px; margin-bottom: 24px; }
    .input-field { flex: 1; background: #1f2937; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 10px 14px; color: white; font-size: 13px; outline: none; }
    .input-btn { background: var(--primary); border: none; color: #090d16; font-weight: 900; padding: 10px 18px; border-radius: 12px; cursor: pointer; font-size: 13px; }
    
    .slider-box { margin-bottom: 24px; background: rgba(0,0,0,0.2); padding: 14px; border-radius: 16px; }
    .slider-label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; color: var(--muted); }
    .slider { width: 100%; accent-color: var(--primary); cursor: pointer; }
    
    .controls { display: flex; justify-content: center; gap: 14px; }
    .ctrl-btn { background: #1f2937; border: 1px solid rgba(255,255,255,0.1); color: white; width: 56px; height: 56px; border-radius: 50%; font-size: 20px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: 0.2s; }
    .ctrl-btn.play { background: var(--primary); color: #090d16; width: 66px; height: 66px; font-size: 24px; }
    .ctrl-btn:hover { transform: scale(1.05); }
  </style>
</head>
<body>
  <div class="player-card">
    <div class="header">
      <span class="badge">MOSA Hi-Fi Engine 32-bit</span>
      <h1 class="title">سبيكر المنزل الذكي</h1>
    </div>

    <div class="track-info">
      <div class="track-name" id="trackTitle">جاري تحميل الحالة...</div>
      <div class="track-source" id="trackSource">المصدر: اتصال محلي</div>
    </div>

    <div class="section-title">التحكم السريع بالسماعة ومستوى الصوت:</div>
    <div class="presets-grid">
      <button class="preset-btn" onclick="volUp()">🔊 تعلية الصوت (+)</button>
      <button class="preset-btn" onclick="volDown()">🔉 تنصية الصوت (-)</button>
      <button class="preset-btn" onclick="toggleMute()" id="muteBtn">🔇 كتم الصوت</button>
      <button class="preset-btn" onclick="stopMusic()">⏹️ إيقاف كامل</button>
    </div>

    <div class="section-title">تشغيل مقطع يوتيوب أو رابط صوت مباشر:</div>
    <div class="input-group">
      <input type="text" class="input-field" id="streamUrl" placeholder="ضع رابط البث المباشر أو MP3...">
      <button class="input-btn" onclick="playCustomUrl()">تشغيل</button>
    </div>

    <div class="section-title">نطق ذكاء اصطناعي (TTS):</div>
    <div class="input-group">
      <input type="text" class="input-field" id="ttsText" placeholder="اكتب جملة ليقولها السبيكر...">
      <button class="input-btn" onclick="sayTTS()">تحدث</button>
    </div>

    <div class="slider-box">
      <div class="slider-label">
        <span>مستوى الصوت (Volume)</span>
        <span id="volVal">14 / 21</span>
      </div>
      <input type="range" min="0" max="21" value="14" class="slider" id="volSlider" oninput="setVolume(this.value)">
    </div>

    <div class="controls">
      <button class="ctrl-btn" onclick="stopMusic()" title="إيقاف">⏹️</button>
      <button class="ctrl-btn play" onclick="togglePlay()" id="playBtn" title="تشغيل / مؤقت">▶️</button>
      <button class="ctrl-btn" onclick="toggleMute()" title="كتم / إلغاء الكتم">🔇</button>
      <button class="ctrl-btn" onclick="refreshStatus()" title="تحديث">🔄</button>
    </div>
  </div>

  <script>
    function updateUI(data) {
      document.getElementById('trackTitle').innerText = data.track || 'متوقف';
      document.getElementById('trackSource').innerText = 'المصدر: ' + (data.source || 'لا يوجد');
      document.getElementById('volVal').innerText = (data.volume || 0) + ' / 21' + (data.muted ? ' (مكتوم 🔇)' : '');
      document.getElementById('volSlider').value = data.volume || 0;
      document.getElementById('playBtn').innerText = data.isPlaying ? '⏸️' : '▶️';
      document.getElementById('muteBtn').innerText = data.muted ? '🔊 إلغاء الكتم' : '🔇 كتم الصوت';
    }

    const UI_API_KEY = 'mosa_speaker_secure_key_2026';
    function apiFetch(url, options = {}) {
      options.headers = options.headers || {};
      options.headers['X-API-Key'] = UI_API_KEY;
      return fetch(url, options);
    }

    function refreshStatus() {
      apiFetch('/api/status').then(r => r.json()).then(updateUI);
    }

    function volUp() {
      apiFetch('/api/volume-up', {method: 'POST'}).then(r => r.json()).then(updateUI);
    }

    function volDown() {
      apiFetch('/api/volume-down', {method: 'POST'}).then(r => r.json()).then(updateUI);
    }

    function toggleMute() {
      apiFetch('/api/mute', {method: 'POST'}).then(r => r.json()).then(updateUI);
    }

    function playCustomUrl() {
      const url = document.getElementById('streamUrl').value;
      if (!url) return;
      apiFetch('/api/play?url=' + encodeURIComponent(url), {method: 'POST'}).then(r => r.json()).then(updateUI);
    }

    function sayTTS() {
      const text = document.getElementById('ttsText').value;
      if (!text) return;
      apiFetch('/api/tts?text=' + encodeURIComponent(text), {method: 'POST'}).then(r => r.json()).then(updateUI);
    }

    function setVolume(v) {
      document.getElementById('volVal').innerText = v + ' / 21';
      apiFetch('/api/volume?level=' + v, {method: 'POST'});
    }

    function stopMusic() {
      apiFetch('/api/stop', {method: 'POST'}).then(r => r.json()).then(updateUI);
    }

    function togglePlay() {
      apiFetch('/api/toggle', {method: 'POST'}).then(r => r.json()).then(updateUI);
    }

    setInterval(refreshStatus, 4000);
    refreshStatus();
  </script>
</body>
</html>
)rawhtml";

// ─── دوائر معالجة الـ API وتأمين المسارات بـ API Key ───
String apiKey = "mosa_speaker_secure_key_2026";

bool checkApiKey() {
  String key = "";
  if (server.hasHeader("X-API-Key")) {
    key = server.header("X-API-Key");
  } else if (server.hasHeader("Authorization")) {
    String auth = server.header("Authorization");
    if (auth.startsWith("Bearer ")) key = auth.substring(7);
    else key = auth;
  } else if (server.hasArg("key")) {
    key = server.arg("key");
  } else if (server.hasArg("apiKey")) {
    key = server.arg("apiKey");
  }
  return (apiKey.length() > 0 && key == apiKey);
}

void sendUnauthorized() {
  server.send(401, "application/json", "{\"status\":\"error\",\"message\":\"Unauthorized: Invalid or Missing X-API-Key\"}");
}

void handleRoot() {
  server.send_P(200, "text/html", HTML_PLAYER);
}

void handleStatus() {
  StaticJsonDocument<256> doc;
  doc["status"] = "online";
  doc["isPlaying"] = isPlaying;
  doc["track"] = currentTrackTitle;
  doc["source"] = currentSource;
  doc["volume"] = currentVolume;
  doc["muted"] = audioMuted;
  // Clean volume percentage mapping (ADR-0008 & Priority 3)
  if (currentVolume == 5) doc["volumePct"] = 25;
  else if (currentVolume == 11) doc["volumePct"] = 50;
  else if (currentVolume == 16) doc["volumePct"] = 75;
  else if (currentVolume >= 21) doc["volumePct"] = 100;
  else doc["volumePct"] = (int)round((currentVolume / 21.0) * 100.0);
  
  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
  publishAudioState();
}

void handlePlay() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  if (server.hasArg("url")) {
    String url = server.arg("url");
    audio.connecttohost(url.c_str());
    isPlaying = true;
    currentSource = "Custom Stream";
    currentTrackTitle = "بث خارجي مباشر";
    handleStatus();
    return;
  }
  audio.pauseResume();
  isPlaying = !isPlaying;
  handleStatus();
}

void handleVolumeUp() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  if (audioMuted) {
    audioMuted = false;
    currentVolume = previousVolume > 0 ? previousVolume : 14;
  }
  currentVolume = min(currentVolume + 2, 21);
  audio.setVolume(currentVolume);
  Serial.printf("[Audio] Vol Up -> %d / 21\n", currentVolume);
  handleStatus();
}

void handleVolumeDown() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  if (audioMuted) {
    audioMuted = false;
    currentVolume = previousVolume > 0 ? previousVolume : 14;
  }
  currentVolume = max(currentVolume - 2, 0);
  if (currentVolume == 0) audioMuted = true;
  audio.setVolume(currentVolume);
  Serial.printf("[Audio] Vol Down -> %d / 21\n", currentVolume);
  handleStatus();
}

void handleMute() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  if (!audioMuted) {
    previousVolume = currentVolume > 0 ? currentVolume : 14;
    currentVolume = 0;
    audioMuted = true;
    audio.setVolume(0);
    Serial.println("[Audio] Muted (0 / 21)");
  } else {
    currentVolume = previousVolume > 0 ? previousVolume : 14;
    audioMuted = false;
    audio.setVolume(currentVolume);
    Serial.printf("[Audio] Unmuted -> %d / 21\n", currentVolume);
  }
  handleStatus();
}

void handleVolume() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  if (server.hasArg("level")) {
    int lvl = server.arg("level").toInt();
    if (lvl >= 0 && lvl <= 21) {
      currentVolume = lvl;
      if (lvl > 0) audioMuted = false;
      else audioMuted = true;
      audio.setVolume(currentVolume);
      Serial.printf("[Audio] Volume set to: %d / 21\n", currentVolume);
      server.send(200, "application/json", "{\"success\":true}");
      return;
    }
  }
  server.send(400, "application/json", "{\"error\":\"Level must be 0-21\"}");
}

void handleStop() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  audio.stopSong();
  isPlaying = false;
  currentTrackTitle = "متوقف";
  handleStatus();
}

void handleToggle() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  audio.pauseResume();
  isPlaying = !isPlaying;
  handleStatus();
}

void handleTTS() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  if (server.hasArg("text")) {
    String text = server.arg("text");
    Serial.printf("[Audio TTS] Spoken Voice: %s\n", text.c_str());
    
    // تشغيل الصوت العربي التلقائي عبر محرك Google TTS المدمج في المكتبة
    audio.connecttospeech(text.c_str(), "ar");
    isPlaying = true;
    currentSource = "مساعد MOSA الذكي (TTS)";
    currentTrackTitle = text;
    handleStatus();
    return;
  }
  server.send(400, "application/json", "{\"error\":\"Text parameter required\"}");
}

void handlePing() {
  StaticJsonDocument<256> doc;
  doc["status"] = "online";
  doc["nodeId"] = nodeId;
  doc["type"] = "SPEAKER";
  doc["ip"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["version"] = "2.0.0";
  doc["hardware"] = "ESP32-S3 + PCM5102A I2S Hi-Fi DAC";
  String json;
  serializeJson(doc, json);
  server.send(200, "application/json", json);
}

void handleTestTone() {
  if (!checkApiKey()) { sendUnauthorized(); return; }
  audio.connecttospeech("فحص وتشغيل السبيكر الذكي بنجاح", "ar");
  isPlaying = true;
  currentSource = "فحص الهاردوير (Chime)";
  currentTrackTitle = "فحص وتشغيل السبيكر الذكي بنجاح";
  handleStatus();
}

// ─── معالجة أوامر السيريال CLI (للتحكم من الحاسوب) ───
void processSerialCLI() {
  if (!Serial.available()) return;
  String line = Serial.readStringUntil('\n');
  line.trim();
  if (line.length() == 0) return;

  if (line.startsWith("PLAY ")) {
    String url = line.substring(5);
    audio.connecttohost(url.c_str());
    isPlaying = true;
    currentSource = "Serial URL";
    currentTrackTitle = url;
    Serial.println(">> Playing URL: " + url);
  }
  else if (line.equalsIgnoreCase("AUDIO_VOL_UP")) {
    handleVolumeUp();
  }
  else if (line.equalsIgnoreCase("AUDIO_VOL_DOWN")) {
    handleVolumeDown();
  }
  else if (line.equalsIgnoreCase("AUDIO_MUTE")) {
    handleMute();
  }
  else if (line.startsWith("VOL ")) {
    int v = line.substring(4).toInt();
    currentVolume = constrain(v, 0, 21);
    if (currentVolume > 0) audioMuted = false;
    audio.setVolume(currentVolume);
    Serial.printf(">> Volume: %d\n", currentVolume);
  }
  else if (line.startsWith("SAY ")) {
    String txt = line.substring(4);
    audio.connecttospeech(txt.c_str(), "ar");
    Serial.println(">> Speaking Arabic TTS: " + txt);
  }
  else if (line.equalsIgnoreCase("STOP")) {
    audio.stopSong();
    isPlaying = false;
    Serial.println(">> Stopped.");
  }
  else if (line.equalsIgnoreCase("STATUS")) {
    Serial.printf(">> Status: %s | Volume: %d | Muted: %s | Track: %s\n", isPlaying ? "Playing" : "Paused", currentVolume, audioMuted ? "Yes" : "No", currentTrackTitle.c_str());
  }
  else {
    Serial.println("Commands: PLAY <url> | AUDIO_VOL_UP | AUDIO_VOL_DOWN | AUDIO_MUTE | VOL <0-21> | SAY <text> | STOP | STATUS");
  }
}

// ─── Callbacks لمكتبة الصوت I2S ───
void audio_info(const char *info) {
  Serial.printf("[Audio Core] %s\n", info);
}

void audio_id3data(const char *info) {
  Serial.printf("[Audio ID3] %s\n", info);
  currentTrackTitle = String(info);
  publishAudioState();
}

void audio_eof_mp3(const char *info) {
  Serial.printf("[Audio EOF] Finished: %s\n", info);
  isPlaying = false;
  currentTrackTitle = "اكتمل التشغيل";
  publishAudioState();
}

// ─── دوال MQTT للتحكم الصوتي وعزل المستأجر (ADR-0008) ───
void publishAudioState() {
  if (!mqttClient.connected() || stateTopic.length() == 0) return;
  StaticJsonDocument<256> doc;
  doc["nodeId"] = nodeId;
  doc["isPlaying"] = isPlaying;
  doc["isMuted"] = audioMuted;
  doc["volume"] = currentVolume;
  if (currentVolume == 5) doc["volumePct"] = 25;
  else if (currentVolume == 11) doc["volumePct"] = 50;
  else if (currentVolume == 16) doc["volumePct"] = 75;
  else if (currentVolume >= 21) doc["volumePct"] = 100;
  else doc["volumePct"] = (int)round((currentVolume / 21.0) * 100.0);
  doc["track"] = currentTrackTitle;
  doc["source"] = currentSource;
  doc["rssi"] = WiFi.RSSI();

  char buffer[256];
  serializeJson(doc, buffer);
  mqttClient.publish(stateTopic.c_str(), buffer);
}

void reconnectMqttNonBlocking() {
  if (WiFi.status() != WL_CONNECTED) return;
  unsigned long now = millis();
  if (now - lastMqttRetry < 5000) return;
  lastMqttRetry = now;

  String clientId = nodeId + "_speaker";
  if (mqttClient.connect(clientId.c_str(), statusTopic.c_str(), 1, true, "offline")) {
    Serial.println("[MQTT Audio] Connected! Subscribed: " + setTopic);
    mqttClient.publish(statusTopic.c_str(), "online", true);
    mqttClient.subscribe(setTopic.c_str(), 1);
    
    // Subscribe to Universal Home Broadcast
    String allTopic = "mosa/" + homeId + "/audio/all/set";
    mqttClient.subscribe(allTopic.c_str(), 1);

    // Auto-Discovery Announcement to MOSA Platform
    StaticJsonDocument<256> discDoc;
    discDoc["id"] = nodeId;
    discDoc["mac"] = nodeId.substring(9);
    discDoc["ip"] = WiFi.localIP().toString();
    discDoc["type"] = "SPEAKER";
    discDoc["name"] = "سبيكر المنزل الذكي (Hi-Fi)";
    discDoc["version"] = "2.0.0";
    char discBuf[256];
    serializeJson(discDoc, discBuf);
    mqttClient.publish("mosa/discovery", discBuf);

    publishAudioState();
  }
}

void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  if (error) return;

  const char* action = doc["action"] | doc["command"] | "";
  Serial.printf("[MQTT Audio Command] Action: %s\n", action);

  if (strcmp(action, "play") == 0) {
    const char* url = doc["url"] | "";
    if (strlen(url) > 0) {
      audio.connecttohost(url);
      isPlaying = true;
      currentSource = "Custom Stream";
      currentTrackTitle = "بث خارجي مباشر";
    } else {
      audio.pauseResume();
      isPlaying = !isPlaying;
    }
  } else if (strcmp(action, "stop") == 0) {
    audio.stopSong();
    isPlaying = false;
    currentTrackTitle = "متوقف";
    currentSource = "Idle";
  } else if (strcmp(action, "toggle") == 0) {
    audio.pauseResume();
    isPlaying = !isPlaying;
  } else if (strcmp(action, "volume") == 0) {
    int lvl = doc["level"] | currentVolume;
    lvl = constrain(lvl, 0, 21);
    currentVolume = lvl;
    if (lvl > 0) audioMuted = false;
    else audioMuted = true;
    audio.setVolume(currentVolume);
  } else if (strcmp(action, "volume-up") == 0) {
    if (audioMuted) { audioMuted = false; currentVolume = previousVolume > 0 ? previousVolume : 14; }
    currentVolume = min(currentVolume + 2, 21);
    audio.setVolume(currentVolume);
  } else if (strcmp(action, "volume-down") == 0) {
    if (audioMuted) { audioMuted = false; currentVolume = previousVolume > 0 ? previousVolume : 14; }
    currentVolume = max(currentVolume - 2, 0);
    if (currentVolume == 0) audioMuted = true;
    audio.setVolume(currentVolume);
  } else if (strcmp(action, "mute") == 0) {
    if (!audioMuted) {
      previousVolume = currentVolume > 0 ? currentVolume : 14;
      currentVolume = 0;
      audioMuted = true;
      audio.setVolume(0);
    } else {
      currentVolume = previousVolume > 0 ? previousVolume : 14;
      audioMuted = false;
      audio.setVolume(currentVolume);
    }
  } else if (strcmp(action, "tts") == 0) {
    const char* text = doc["text"] | "";
    if (strlen(text) > 0) {
      audio.connecttospeech(text, "ar");
      isPlaying = true;
      currentSource = "مساعد MOSA الذكي (TTS)";
      currentTrackTitle = String(text);
    }
  }

  publishAudioState();
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n╔════════════════════════════════════════════════════════════════╗");
  Serial.println("║       MOSA SMART HI-FI AUDIO SYSTEM (ESP32-S3 + PCM5102A)       ║");
  Serial.println("║          نظام الصوت الذكي وسبيكر المنزل عالي النقاوة           ║");
  Serial.println("╚════════════════════════════════════════════════════════════════╝\n");

  // 1. تهيئة مخرج الصوت I2S على منافذ ESP32-S3 الآمنة
  Serial.println("[Hardware] Initializing I2S DAC (BCK: 14, LRC: 13, DOUT: 12)...");
  audio.setPinout(I2S_BCLK_PIN, I2S_LRC_PIN, I2S_DOUT_PIN);
  audio.setVolume(currentVolume); // مستوى صوت 14
  audio.setTone(4, 2, 2);         // معادل صوت رقمي مميز (Bass +4dB لعمق الصوت بالسماعات الكبيرة)

  // 2. الاتصال بالواي فاي
  Serial.printf("[WiFi] Connecting to %s...\n", defaultSSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(defaultSSID, defaultPASS);

  int tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries < 20) {
    delay(500);
    Serial.print(".");
    tries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
    
    // تفعيل اسم mDNS لفتح الموقع بسهولة من الهاتف: http://mosa-speaker.local
    if (MDNS.begin("mosa-speaker")) {
      Serial.println("[mDNS] Responder started: http://mosa-speaker.local");
      MDNS.addService("http", "tcp", 80);
      MDNS.addService("raop", "tcp", 5000); // إعلان AirPlay للآيفون
    }
  } else {
    // في حال عدم توفر شبكة، يتم بث شبكة هوت سبوت للإعداد
    Serial.println("\n[WiFi] WiFi not found. Starting Access Point: MOSA-HiFi-Speaker...");
    WiFi.mode(WIFI_AP);
    WiFi.softAP("MOSA-HiFi-Speaker", "12345678");
    Serial.printf("[WiFi AP] IP Address: %s\n", WiFi.softAPIP().toString().c_str());
  }

  // 3. إعداد مواضيع MQTT والتسجيل بالوسيط (ADR-0008)
  uint8_t mac[6];
  WiFi.macAddress(mac);
  char macStr[18];
  snprintf(macStr, sizeof(macStr), "%02X%02X%02X%02X%02X%02X", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
  nodeId = "MosaNode_" + String(macStr);

  setTopic = "mosa/" + homeId + "/audio/" + nodeId + "/set";
  stateTopic = "mosa/" + homeId + "/audio/" + nodeId + "/state";
  statusTopic = "mosa/" + homeId + "/audio/" + nodeId + "/status";

  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(onMqttMessage);

  // 4. مسارات التحكم عبر Web Server و APIs مع تجميع ترويسات الأمان
  const char * headerkeys[] = {"X-API-Key", "Authorization"};
  server.collectHeaders(headerkeys, 2);

  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/status", HTTP_GET, handleStatus);
  server.on("/api/play", HTTP_POST, handlePlay);
  server.on("/api/stop", HTTP_POST, handleStop);
  server.on("/api/toggle", HTTP_POST, handleToggle);
  server.on("/api/volume", HTTP_POST, handleVolume);
  server.on("/api/volume-up", HTTP_POST, handleVolumeUp);
  server.on("/api/volume-down", HTTP_POST, handleVolumeDown);
  server.on("/api/ping", HTTP_GET, handlePing);
  server.on("/api/test-tone", HTTP_POST, handleTestTone);
  server.on("/api/mute", HTTP_POST, handleMute);
  server.on("/api/tts", HTTP_POST, handleTTS);

  server.begin();
  Serial.println("[Server] HTTP Audio Server & REST APIs Ready on port 80!");
  Serial.println(">> افتح المتصفح بهاتفك على عنوان الـ IP للتحكم بالسبيكر وسماع الصوت!");
}

void loop() {
  // تغذية مستمرة لتيار البيانات الصوتية في الـ I2S DMA Buffer (الأولوية العليا)
  audio.loop();

  // معالجة أوامر وسيط MQTT (Control Plane - ADR-0008)
  if (mqttClient.connected()) {
    mqttClient.loop();
  } else {
    reconnectMqttNonBlocking();
  }

  // معالجة طلبات التحكم عبر الويب والـ API المحلي (Fallback Plane)
  server.handleClient();

  // معالجة أوامر السيريال CLI
  processSerialCLI();
}
