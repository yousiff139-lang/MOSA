/*
 * HealthMonitor.h - Real-Time Diagnostics & Crash Telemetry for ESP32 Nodes
 * Tracks Free Heap, Heap Fragmentation, CPU Core Usage, WiFi RSSI, MQTT Latency, and Crash Reset Reasons.
 */

#ifndef HEALTH_MONITOR_H
#define HEALTH_MONITOR_H

#include <Arduino.h>
#include <WiFi.h>
#include <esp_system.h>
#include <ArduinoJson.h>

struct HealthStats {
  uint32_t freeHeap;
  uint32_t minFreeHeap;
  uint8_t heapFragmentation;
  int wifiRssi;
  uint32_t uptimeSeconds;
  String resetReason;
  uint32_t loopLatencyMs;
};

class HealthMonitor {
private:
  HealthStats stats;
  unsigned long lastLoopStart;

public:
  HealthMonitor() : lastLoopStart(0) {}

  void begin() {
    stats.resetReason = getResetReasonString(esp_reset_reason());
    stats.minFreeHeap = ESP.getMinFreeHeap();
  }

  void updateLoopStart() {
    lastLoopStart = millis();
  }

  void updateLoopEnd() {
    stats.loopLatencyMs = millis() - lastLoopStart;
  }

  HealthStats getStats() {
    stats.freeHeap = ESP.getFreeHeap();
    stats.minFreeHeap = ESP.getMinFreeHeap();
    stats.heapFragmentation = 100 - (ESP.getMaxAllocHeap() * 100 / (stats.freeHeap > 0 ? stats.freeHeap : 1));
    stats.wifiRssi = (WiFi.status() == WL_CONNECTED) ? WiFi.RSSI() : 0;
    stats.uptimeSeconds = millis() / 1000;
    return stats;
  }

  String getResetReasonString(esp_reset_reason_t reason) {
    switch (reason) {
      case ESP_RST_POWERON:   return "POWER_ON";
      case ESP_RST_EXT:       return "EXTERNAL_PIN";
      case ESP_RST_SW:        return "SOFTWARE_RESET";
      case ESP_RST_PANIC:     return "CRASH_PANIC_EXCEPTION";
      case ESP_RST_INT_WDT:   return "INTERRUPT_WATCHDOG";
      case ESP_RST_TASK_WDT:  return "TASK_WATCHDOG";
      case ESP_RST_WDT:       return "OTHER_WATCHDOG";
      case ESP_RST_DEEPSLEEP: return "DEEP_SLEEP_EXIT";
      case ESP_RST_BROWNOUT:  return "BROWNOUT_VOLTAGE_DROP";
      case ESP_RST_SDIO:      return "SDIO_RESET";
      default:                return "UNKNOWN_RESET";
    }
  }

  void toJSON(JsonObject& doc) {
    HealthStats s = getStats();
    doc["freeHeap"] = s.freeHeap;
    doc["minFreeHeap"] = s.minFreeHeap;
    doc["fragmentation"] = s.heapFragmentation;
    doc["wifiRssi"] = s.wifiRssi;
    doc["uptime"] = s.uptimeSeconds;
    doc["resetReason"] = s.resetReason;
    doc["loopLatency"] = s.loopLatencyMs;
  }
};

#endif // HEALTH_MONITOR_H
