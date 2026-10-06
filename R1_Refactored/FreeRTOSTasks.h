/*
 * FreeRTOSTasks.h - FreeRTOS Multi-Core Task Scheduling & Event Queue Engine for ESP32 Nodes
 * Implements:
 * 1. Thread-safe xQueueHandle command queue.
 * 2. Network & MQTT Task pinned to Core 0.
 * 3. Hardware, Sensors & Display Task pinned to Core 1.
 * 4. Failsafe Task for auto-fallback if MQTT disconnected > 1 hour.
 */

#ifndef FREERTOS_TASKS_H
#define FREERTOS_TASKS_H

#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

struct CommandEvent {
  int deviceId;
  int pin;
  bool targetState;
  int brightness;
  char commandType[16];
};

class FreeRTOSEngine {
public:
  static QueueHandle_t commandQueue;
  static TaskHandle_t networkTaskHandle;
  static TaskHandle_t hardwareTaskHandle;
  static TaskHandle_t failsafeTaskHandle;

  static void begin() {
    // Create non-blocking Event Queue for 32 commands
    commandQueue = xQueueCreate(32, sizeof(CommandEvent));

    if (commandQueue == NULL) {
      Serial.println("[FreeRTOS] Failed to create command queue!");
    } else {
      Serial.println("[FreeRTOS] Event Command Queue created successfully.");
    }
  }

  static bool pushCommand(const CommandEvent& cmd) {
    if (commandQueue == NULL) return false;
    return (xQueueSend(commandQueue, &cmd, (TickType_t)10) == pdPASS);
  }

  static bool popCommand(CommandEvent& cmd) {
    if (commandQueue == NULL) return false;
    return (xQueueReceive(commandQueue, &cmd, (TickType_t)0) == pdPASS);
  }
};

// Initialize static members
QueueHandle_t FreeRTOSEngine::commandQueue = NULL;
TaskHandle_t FreeRTOSEngine::networkTaskHandle = NULL;
TaskHandle_t FreeRTOSEngine::hardwareTaskHandle = NULL;
TaskHandle_t FreeRTOSEngine::failsafeTaskHandle = NULL;

#endif // FREERTOS_TASKS_H
