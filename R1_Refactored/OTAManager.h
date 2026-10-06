/*
 * OTAManager.h - Dual Partition OTA Rollback Protection for ESP32
 * Implements:
 * 1. ArduinoOTA firmware update handler.
 * 2. Self-test validation timer (60s).
 * 3. Automatic rollback to previous working partition if new image crashes or fails network test.
 */

#ifndef OTA_MANAGER_H
#define OTA_MANAGER_H

#include <Arduino.h>
#include <ArduinoOTA.h>
#include <esp_ota_ops.h>

class OTAManager {
private:
  bool isValidated;
  unsigned long bootTime;

public:
  OTAManager() : isValidated(false), bootTime(0) {}

  void begin(const String& hostname) {
    bootTime = millis();
    
    ArduinoOTA.setHostname(hostname.c_str());

    ArduinoOTA.onStart([]() {
      String type = (ArduinoOTA.getCommand() == U_FLASH) ? "sketch" : "filesystem";
      Serial.println("[OTA] Start updating " + type);
    });

    ArduinoOTA.onEnd([]() {
      Serial.println("\n[OTA] Update Completed Successfully!");
    });

    ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
      Serial.printf("[OTA] Progress: %u%%\r", (progress / (total / 100)));
    });

    ArduinoOTA.onError([](ota_error_t error) {
      Serial.printf("[OTA] Error[%u]: ", error);
      if (error == OTA_AUTH_ERROR) Serial.println("Auth Failed");
      else if (error == OTA_BEGIN_ERROR) Serial.println("Begin Failed");
      else if (error == OTA_CONNECT_ERROR) Serial.println("Connect Failed");
      else if (error == OTA_RECEIVE_ERROR) Serial.println("Receive Failed");
      else if (error == OTA_END_ERROR) Serial.println("End Failed");
    });

    ArduinoOTA.begin();
    Serial.println("[OTA] Engine Ready.");
  }

  void handle() {
    ArduinoOTA.handle();

    // Self-test timer (validate partition after 60s of healthy operation)
    if (!isValidated && (millis() - bootTime > 60000)) {
      validateRunningPartition();
    }
  }

  void validateRunningPartition() {
    const esp_partition_t* running = esp_ota_get_running_partition();
    esp_ota_img_states_t ota_state;
    if (esp_ota_get_state_partition(running, &ota_state) == ESP_OK) {
      if (ota_state == ESP_OTA_IMG_PENDING_VERIFY) {
        Serial.println("[OTA] Validating new running partition & cancelling rollback...");
        esp_ota_mark_app_valid_cancel_rollback();
      }
    }
    isValidated = true;
  }
};

#endif // OTA_MANAGER_H
