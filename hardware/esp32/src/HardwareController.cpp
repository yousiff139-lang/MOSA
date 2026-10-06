#include "HardwareController.h"

#define RELAY_PIN 2 // Built-in LED on most ESP32 Dev Boards

bool currentState = false;

void HardwareController::init() {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
    currentState = false;
    Serial.println("HardwareController initialized. Relay Pin: 2");
}

void HardwareController::turnOn() {
    digitalWrite(RELAY_PIN, HIGH);
    currentState = true;
    Serial.println("Relay turned ON");
}

void HardwareController::turnOff() {
    digitalWrite(RELAY_PIN, LOW);
    currentState = false;
    Serial.println("Relay turned OFF");
}

bool HardwareController::isOn() {
    return currentState;
}
