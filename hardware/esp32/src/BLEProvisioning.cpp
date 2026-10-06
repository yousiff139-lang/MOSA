#include "BLEProvisioning.h"
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include "ConfigManager.h"
#include <ArduinoJson.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

bool bleProvisioned = false;
BLEServer* pServer = NULL;

class ProvisioningCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
        std::string value = pCharacteristic->getValue();
        if (value.length() > 0) {
            Serial.println("[BLE] Received Provisioning Payload");
            
            StaticJsonDocument<512> doc;
            DeserializationError err = deserializeJson(doc, value.c_str());
            
            if (!err) {
                const char* ssid = doc["ssid"];
                const char* pass = doc["pass"];
                const char* pin = doc["pin"];
                const char* homeId = doc["homeId"];
                const char* deviceId = doc["deviceId"];
                
                if (ssid && pass && pin && homeId && deviceId) {
                    // HARDCODED PIN FOR THIS SPECIFIC PCB (Printed on the QR Code)
                    const char* EXPECTED_PIN = "839201";

                    if (strcmp(pin, EXPECTED_PIN) == 0) {
                        Serial.println("[SECURITY] Matter-Style Setup PIN Verified Successfully! 🔓");
                        
                        MosaConfig config;
                        strlcpy(config.wifiSSID, ssid, sizeof(config.wifiSSID));
                        strlcpy(config.wifiPass, pass, sizeof(config.wifiPass));
                        strlcpy(config.homeId, homeId, sizeof(config.homeId));
                        strlcpy(config.deviceId, deviceId, sizeof(config.deviceId));
                        
                        ConfigManager::saveConfig(config);
                        Serial.println("[BLE] Provisioning Complete! Saving config...");
                        bleProvisioned = true;
                    } else {
                        Serial.println("[SECURITY] 🚨 UNAUTHORIZED! Invalid Setup PIN. Rejecting connection.");
                    }
                }
            } else {
                Serial.println("[BLE] Failed to parse JSON payload");
            }
        }
    }
};

void BLEProvisioning::init() {
    Serial.println("[BLE] Starting BLE Provisioning Engine...");
    
    BLEDevice::init("MOSA-ESP32-SmartNode");
    pServer = BLEDevice::createServer();
    BLEService *pService = pServer->createService(SERVICE_UUID);
    
    BLECharacteristic *pCharacteristic = pService->createCharacteristic(
        CHARACTERISTIC_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_WRITE
    );
    
    pCharacteristic->setCallbacks(new ProvisioningCallbacks());
    pCharacteristic->setValue("Awaiting WiFi Credentials...");
    pService->start();
    
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    
    Serial.println("[BLE] Broadcasting MOSA UUID. Ready for Mobile App pairing.");
}

void BLEProvisioning::stop() {
    if (pServer != NULL) {
        BLEDevice::deinit();
        Serial.println("[BLE] Bluetooth turned off to save power.");
    }
}

bool BLEProvisioning::isProvisioned() {
    return bleProvisioned;
}
