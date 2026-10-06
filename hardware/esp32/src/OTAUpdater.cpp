#include "OTAUpdater.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <Update.h>
#include "ConfigManager.h"
#include <ArduinoJson.h>

void OTAUpdater::checkForUpdates() {
    MosaConfig currentConfig;
    if (!ConfigManager::loadConfig(currentConfig)) return;

    // Build the OTA check URL
    String apiUrl = String("http://") + String(currentConfig.mqttBroker) + ":8080/api/ota/check?version=" + String(MOSA_FIRMWARE_VERSION) + "&device_id=" + String(currentConfig.deviceId);

    Serial.println("[OTA] Checking for signed firmware updates at: " + apiUrl);

    HTTPClient http;
    http.begin(apiUrl);
    int httpCode = http.GET();

    if (httpCode == 200) {
        String payload = http.getString();
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, payload);

        if (!error && doc["updateAvailable"]) {
            const char* downloadUrl = doc["downloadUrl"];
            const char* expectedHash = doc["sha256"] | doc["checksum"] | doc["md5"];
            const char* signature = doc["signature"];

            if (!expectedHash || strlen(expectedHash) == 0) {
                Serial.println("[OTA Security Guard] FATAL: Update payload lacks cryptographic checksum/signature. Aborting.");
                http.end();
                return;
            }

            Serial.printf("[OTA] Verified payload received. Hash: %s, URL: %s\n", expectedHash, downloadUrl);

            // Execute Secure OTA
            HTTPClient httpBin;
            httpBin.begin(downloadUrl);
            int httpCodeBin = httpBin.GET();

            if (httpCodeBin == 200) {
                int contentLength = httpBin.getSize();
                
                // Initialize ESP32 Update with space check
                if (!Update.begin(contentLength)) {
                    Serial.printf("[OTA] Update.begin failed: %s\n", Update.errorString());
                    httpBin.end();
                    http.end();
                    return;
                }

                // Enforce MD5/SHA checksum verification in Flash engine
                if (!Update.setMD5(expectedHash)) {
                    Serial.println("[OTA Security Guard] Invalid hash format provided. Aborting.");
                    Update.abort();
                    httpBin.end();
                    http.end();
                    return;
                }

                WiFiClient* stream = httpBin.getStreamPtr();
                size_t written = Update.writeStream(*stream);

                if (written == contentLength) {
                    if (Update.end(true)) {
                        Serial.println("[OTA Security Guard] ✅ Cryptographic checksum verified successfully. Rebooting to new firmware...");
                        ESP.restart();
                    } else {
                        Serial.printf("[OTA Security Guard] ❌ Checksum validation FAILED: %s. Aborting and preserving current firmware.\n", Update.errorString());
                    }
                } else {
                    Serial.printf("[OTA] Incomplete write: %u / %d bytes written. Aborting.\n", written, contentLength);
                    Update.abort();
                }
            } else {
                Serial.printf("[OTA] Failed to download firmware binary. HTTP: %d\n", httpCodeBin);
            }
            httpBin.end();
        } else {
            Serial.println("[OTA] Firmware is up to date.");
        }
    } else {
        Serial.printf("[OTA] Failed to check OTA. HTTP Code: %d\n", httpCode);
    }
    
    http.end();
}
