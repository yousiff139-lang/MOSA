#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <mbedtls/sha256.h>
#include <ArduinoJson.h>
#include <FS.h>
#include <SPIFFS.h>

extern void displayOTAProgress(const char* msg, int percent);
extern bool publishMQTT(const String& topic, const String& payload, bool retain);

bool verifyFirmwareSHA256(const String& filePath, const String& expectedHash) {
  File file = SPIFFS.open(filePath, "r");
  if (!file) return false;
  
  mbedtls_sha256_context ctx;
  mbedtls_sha256_init(&ctx);
  mbedtls_sha256_starts_ret(&ctx, 0);
  
  uint8_t buffer[512];
  while (file.available()) {
    size_t read = file.read(buffer, sizeof(buffer));
    mbedtls_sha256_update_ret(&ctx, buffer, read);
  }
  file.close();
  
  uint8_t hash[32];
  mbedtls_sha256_finish_ret(&ctx, hash);
  mbedtls_sha256_free(&ctx);
  
  String computedHash = "";
  for (int i = 0; i < 32; i++) {
    char hex[3];
    sprintf(hex, "%02x", hash[i]);
    computedHash += hex;
  }
  
  return computedHash.equalsIgnoreCase(expectedHash);
}

void handleOTAUpdate(
  const String& url,
  const String& version,
  const String& sha256,
  const String& rollbackVersion,
  const String& homeId,
  const String& boardID,
  const String& macAddress
) {
  Serial.println("[OTA] Update received: v" + version);
  displayOTAProgress("جاري التحديث...", 0);
  
  String statusTopic = "mosa/" + homeId + "/device/" + boardID + "/state";
  publishMQTT(statusTopic, "{\"status\":\"DOWNLOADING\"}", false);
  
  HTTPClient http;
  http.begin(url);
  http.setTimeout(60000); // 60s timeout
  
  Update.onProgress([](size_t done, size_t total) {
    int percent = (done * 100) / total;
    displayOTAProgress("تحميل الإصدار", percent);
    Serial.printf("[OTA] Progress: %d%%\n", percent);
  });
  
  displayOTAProgress("جاري التثبيت...", 50);
  
  t_httpUpdate_return ret = httpUpdate.update(
    http.getStream(),
    http.getSize(),
    "application/octet-stream"
  );
  
  switch (ret) {
    case HTTP_UPDATE_OK:
      Serial.println("[OTA] Update successful!");
      displayOTAProgress("اكتمل التحديث ✓", 100);
      
      publishMQTT(statusTopic, "{\"status\":\"SUCCESS\",\"version\":\"" + version + "\"}", false);
      
      delay(2000);
      ESP.restart();
      break;
      
    case HTTP_UPDATE_FAILED:
      Serial.printf("[OTA] Failed: %s\n", httpUpdate.getLastErrorString().c_str());
      displayOTAProgress("فشل التحديث ✗", 0);
      
      publishMQTT(statusTopic, "{\"status\":\"FAILED\",\"error\":\"" + httpUpdate.getLastErrorString() + "\"}", false);
      break;
      
    case HTTP_UPDATE_NO_UPDATES:
      Serial.println("[OTA] No update needed");
      break;
  }
}
