export interface FirmwareConfig {
  boardType: string; // 'ESP32' | 'ESP8266'
  deviceId: string;
  devicePassword?: string;
  mqttHost: string;
  mqttPort?: number;
  components: Array<{
    type: 'RELAY' | 'DHT22' | 'PIR' | 'PWM';
    pin: number;
    id: string; // unique internal identifier
  }>;
}

export class FirmwareBuilderService {
  
  static generateCppCode(config: FirmwareConfig): string {
    const isESP32 = config.boardType === 'ESP32';
    const mqttHost = config.mqttHost || "192.168.1.100";
    const mqttPort = config.mqttPort || 1883;
    const deviceId = config.deviceId || "ESP_" + Math.random().toString(36).substr(2, 6).toUpperCase();
    const devicePassword = config.devicePassword || "";

    const includes = `
#include <Arduino.h>
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266httpUpdate.h>
#else
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <HTTPUpdate.h>
#endif
#include <WiFiManager.h>
#include <PubSubClient.h>
${config.components.some(c => c.type === 'DHT22') ? '#include <DHT.h>' : ''}
`;

    const definitions = config.components.map(c => {
      if (c.type === 'RELAY') return `#define PIN_${c.id.toUpperCase()} ${c.pin}`;
      if (c.type === 'DHT22') return `#define PIN_${c.id.toUpperCase()} ${c.pin}\nDHT dht_${c.id}(PIN_${c.id.toUpperCase()}, DHT22);`;
      if (c.type === 'PIR') return `#define PIN_${c.id.toUpperCase()} ${c.pin}`;
      if (c.type === 'PWM') return `#define PIN_${c.id.toUpperCase()} ${c.pin}\nconst int pwmChannel_${c.id} = ${Math.floor(Math.random() * 16)};`;
      return '';
    }).join('\n');

    const setupCode = config.components.map(c => {
      if (c.type === 'RELAY') return `  pinMode(PIN_${c.id.toUpperCase()}, OUTPUT);\n  digitalWrite(PIN_${c.id.toUpperCase()}, LOW);`;
      if (c.type === 'DHT22') return `  dht_${c.id}.begin();`;
      if (c.type === 'PIR') return `  pinMode(PIN_${c.id.toUpperCase()}, INPUT);`;
      if (c.type === 'PWM') {
        return isESP32 ? 
          `  ledcSetup(pwmChannel_${c.id}, 5000, 8);\n  ledcAttachPin(PIN_${c.id.toUpperCase()}, pwmChannel_${c.id});` :
          `  pinMode(PIN_${c.id.toUpperCase()}, OUTPUT);`;
      }
      return '';
    }).join('\n');

    const mainCode = `
${includes}

${definitions}

// MQTT Configuration
const char* mqtt_server = "${mqttHost}";
const int mqtt_port = ${mqttPort};
const char* mqtt_user = "device_${deviceId}";
const char* mqtt_password = "${devicePassword}";
const char* device_id = "${deviceId}";

WiFiClient espClient;
PubSubClient client(espClient);

unsigned long lastMsg = 0;

void callback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  
  // Check if topic is OTA Update
  String topicStr = String(topic);
  if (topicStr.endsWith("/update")) {
    int urlStart = message.indexOf("\\"url\\":\\"") + 7;
    int urlEnd = message.indexOf("\\"", urlStart);
    if (urlStart > 6 && urlEnd > urlStart) {
      String fwUrl = message.substring(urlStart, urlEnd);
      Serial.println("Starting OTA from: " + fwUrl);
      
#if defined(ESP8266)
      t_httpUpdate_return ret = ESPhttpUpdate.update(espClient, fwUrl);
#else
      WiFiClient client;
      t_httpUpdate_return ret = httpUpdate.update(client, fwUrl);
#endif

      switch (ret) {
        case HTTP_UPDATE_FAILED:
          Serial.printf("HTTP_UPDATE_FAILD Error (%d): %s\\n", httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
          break;
        case HTTP_UPDATE_NO_UPDATES:
          Serial.println("HTTP_UPDATE_NO_UPDATES");
          break;
        case HTTP_UPDATE_OK:
          Serial.println("HTTP_UPDATE_OK");
          break;
      }
    }
    return;
  }

  // Basic payload handling
  // Expected JSON: {"state":{"isOn":true}}
  if (message.indexOf("\\"isOn\\":true") > 0 || message.indexOf("\\"action\\":\\"TOGGLE\\",\\"state\\":\\"ON\\"") > 0) {
    // Turn on first relay as default fallback
    ${config.components.filter(c => c.type === 'RELAY').map(c => `digitalWrite(PIN_${c.id.toUpperCase()}, HIGH);`).join('\n    ')}
  } else if (message.indexOf("\\"isOn\\":false") > 0 || message.indexOf("\\"action\\":\\"TOGGLE\\",\\"state\\":\\"OFF\\"") > 0) {
    // Turn off
    ${config.components.filter(c => c.type === 'RELAY').map(c => `digitalWrite(PIN_${c.id.toUpperCase()}, LOW);`).join('\n    ')}
  }
}

void reconnect() {
  while (!client.connected()) {
    if (client.connect(device_id, mqtt_user, mqtt_password)) {
      String topicStr = String("mosa/devices/") + device_id + "/set";
      client.subscribe(topicStr.c_str());
      
      String otaTopic = String("mosa/ota/") + device_id + "/update";
      client.subscribe(otaTopic.c_str());

      // Auto-Discovery Broadcast
      String ipAddress = WiFi.localIP().toString();
      String macAddress = WiFi.macAddress();
      String discoveryPayload = "{\\"id\\":\\"" + String(device_id) + "\\", \\"ip\\":\\"" + ipAddress + "\\", \\"mac\\":\\"" + macAddress + "\\", \\"type\\":\\"ESP32\\"}";
      client.publish("mosa/discovery", discoveryPayload.c_str(), true); // Retained message
      
    } else {
      delay(5000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  
${setupCode}

  // WiFiManager
  WiFiManager wm;
  bool res = wm.autoConnect("MOSA-DEVICE-SETUP");
  if(!res) {
    Serial.println("Failed to connect to WiFi");
    ESP.restart();
  }

  // MQTT Setup
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  
  // Read PIR Sensors
  ${config.components.filter(c => c.type === 'PIR').map(c => `
  int motion_${c.id} = digitalRead(PIN_${c.id.toUpperCase()});
  if (motion_${c.id} == HIGH) {
    // Send motion event if triggered
    String motionTopic = String("mosa/devices/") + device_id + "/state";
    String motionPayload = "{\\"motion\\": true, \\"pin\\": " + String(PIN_${c.id.toUpperCase()}) + "}";
    client.publish(motionTopic.c_str(), motionPayload.c_str());
    delay(2000); // Debounce
  }
  `).join('\n')}

  // Telemetry loop every 10 seconds
  if (now - lastMsg > 10000) {
    lastMsg = now;
    String telemetry = "{\\"online\\":true";
    
    ${config.components.filter(c => c.type === 'DHT22').map(c => `
    float t_${c.id} = dht_${c.id}.readTemperature();
    float h_${c.id} = dht_${c.id}.readHumidity();
    if (!isnan(t_${c.id})) {
      telemetry += ", \\"temperature\\":" + String(t_${c.id});
      telemetry += ", \\"humidity\\":" + String(h_${c.id});
    }
    `).join('\n')}
    
    telemetry += "}";
    
    String topicStr = String("mosa/devices/") + device_id + "/telemetry";
    client.publish(topicStr.c_str(), telemetry.c_str());
  }
}
`;

    return mainCode.trim();
  }
}
