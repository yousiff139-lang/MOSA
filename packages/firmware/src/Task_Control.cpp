#include <Arduino.h>
#include "Config.h"
#include "Types.h"
#include <ArduinoJson.h>

extern QueueHandle_t relayCommandQueue;
extern QueueHandle_t mqttPublishQueue;

extern char homeId[32];
extern char nodeId[32];

// Physical switch tracking for debouncing
struct SwitchState {
    uint8_t pin;
    uint8_t relayPin;
    bool lastReading;
    bool currentState;
    unsigned long lastDebounceTime;
};

SwitchState switches[] = {
    {PIN_SWITCH_1, PIN_RELAY_1, HIGH, HIGH, 0},
    {PIN_SWITCH_2, PIN_RELAY_2, HIGH, HIGH, 0},
    {PIN_SWITCH_3, PIN_RELAY_3, HIGH, HIGH, 0}
};

void publishRelayState(uint8_t relayPin, bool isOn) {
    MqttMessage msg;
    snprintf(msg.topic, sizeof(msg.topic), "mosa/%s/device/%s/state", homeId, nodeId);
    
    StaticJsonDocument<128> doc;
    JsonArray devices = doc.createNestedArray("devices");
    JsonObject dev = devices.createNestedObject();
    dev["pin"] = relayPin;
    dev["state"] = isOn ? "ON" : "OFF";
    
    serializeJson(doc, msg.payload, sizeof(msg.payload));
    
    // Send to Network Task Queue
    xQueueSend(mqttPublishQueue, &msg, 0);
}

void toggleRelay(uint8_t relayPin, bool forceState = false, bool isForced = false) {
    bool newState = isForced ? forceState : !digitalRead(relayPin);
    digitalWrite(relayPin, newState ? HIGH : LOW);
    
    // Notify Server
    publishRelayState(relayPin, newState);
}

void TaskControl(void *pvParameters) {
    Serial.println("[Task_Control] Started on Core 1 (High Priority)");

    // Initialize Switch Pins (assuming pull-ups)
    for (int i = 0; i < 3; i++) {
        pinMode(switches[i].pin, INPUT_PULLUP);
    }

    for (;;) {
        // 1. Process Network Commands
        RelayCommand cmd;
        if (xQueueReceive(relayCommandQueue, &cmd, 0) == pdPASS) {
            uint8_t targetPin = 0;
            if (cmd.relayId == 1) targetPin = PIN_RELAY_1;
            else if (cmd.relayId == 2) targetPin = PIN_RELAY_2;
            else if (cmd.relayId == 3) targetPin = PIN_RELAY_3;
            else if (cmd.relayId == 4) targetPin = PIN_RELAY_AC; // Could add Compressor logic here
            
            if (targetPin > 0) {
                toggleRelay(targetPin, cmd.state, true);
            }
        }

        // 2. Process Physical Switches
        unsigned long currentMillis = millis();
        for (int i = 0; i < 3; i++) {
            bool reading = digitalRead(switches[i].pin);
            
            if (reading != switches[i].lastReading) {
                switches[i].lastDebounceTime = currentMillis;
            }
            
            if ((currentMillis - switches[i].lastDebounceTime) > DEBOUNCE_DELAY_MS) {
                if (reading != switches[i].currentState) {
                    switches[i].currentState = reading;
                    
                    // Button Pressed (Active LOW)
                    if (switches[i].currentState == LOW) {
                        Serial.printf("[Control] Switch %d pressed. Toggling Relay.\n", i+1);
                        toggleRelay(switches[i].relayPin);
                    }
                }
            }
            switches[i].lastReading = reading;
        }

        // Extremely fast polling (zero-lag feel)
        vTaskDelay(10 / portTICK_PERIOD_MS);
    }
}
