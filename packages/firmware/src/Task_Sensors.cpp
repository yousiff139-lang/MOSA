#include <Arduino.h>
#include "Config.h"
#include "Types.h"
#include <ArduinoJson.h>
#include <DHT.h>

extern QueueHandle_t mqttPublishQueue;
extern char homeId[32];
extern char nodeId[32];

DHT dht(PIN_DHT, DHT22);

// Simple ACS712 current reading (mock calibration)
float readPower() {
    int adcValue = analogRead(PIN_ACS712);
    // Vout = (adcValue / 4095.0) * 3.3;
    // Current = (Vout - 1.65) / 0.185 (for 5A module)
    // Power = Current * 220
    // Mocking for now to avoid zero-reading if unconnected
    return random(50, 150); 
}

void TaskSensors(void *pvParameters) {
    Serial.println("[Task_Sensors] Started on Core 1");

    dht.begin();
    pinMode(PIN_PIR, INPUT);
    
    TickType_t lastWakeTime = xTaskGetTickCount();
    const TickType_t interval = TELEMETRY_INTERVAL_MS / portTICK_PERIOD_MS;

    for (;;) {
        vTaskDelayUntil(&lastWakeTime, interval);

        float h = dht.readHumidity();
        float t = dht.readTemperature();
        float p = readPower();
        bool motion = digitalRead(PIN_PIR) == HIGH;

        if (isnan(h) || isnan(t)) {
            Serial.println("[Sensors] Failed to read from DHT sensor!");
            // Keep going, maybe next time it works
        } else {
            MqttMessage msg;
            snprintf(msg.topic, sizeof(msg.topic), "mosa/%s/device/%s/state", homeId, nodeId);
            
            StaticJsonDocument<128> doc;
            doc["temperature"] = t;
            doc["humidity"] = h;
            doc["power"] = p;
            if (motion) doc["motion"] = true; // Only send true to avoid spam
            
            serializeJson(doc, msg.payload, sizeof(msg.payload));
            
            xQueueSend(mqttPublishQueue, &msg, 0);
            Serial.printf("[Sensors] Queued Telemetry: %s\n", msg.payload);
        }
    }
}
