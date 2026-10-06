#include "BleProvisioner.h"
#include "Config.h"
#include <WiFi.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <ArduinoJson.h>

#define SERVICE_UUID           "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID_RX "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CHARACTERISTIC_UUID_TX "beb5483e-36e1-4688-b7f5-ea07361b26a9"

BLEServer *pServer = NULL;
BLECharacteristic *pTxCharacteristic;
bool deviceConnected = false;
bool BleProvisioner::provisioningComplete = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("BLE Device Connected.");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("BLE Device Disconnected.");
      // Restart advertising
      pServer->getAdvertising()->start();
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();

      if (rxValue.length() > 0) {
        Serial.println("Received Provisioning Data via BLE.");
        
        StaticJsonDocument<512> doc;
        DeserializationError error = deserializeJson(doc, rxValue);
        
        if (error) {
            Serial.print(F("deserializeJson() failed: "));
            Serial.println(error.f_str());
            pTxCharacteristic->setValue("ERROR: Invalid JSON");
            pTxCharacteristic->notify();
            return;
        }

        // Apply config
        config.ssid = doc["ssid"].as<String>();
        config.password = doc["password"].as<String>();
        config.mqtt_server = doc["mqtt_server"].as<String>();
        config.mqtt_user = doc["mqtt_user"].as<String>();
        config.mqtt_password = doc["mqtt_pass"].as<String>();
        config.home_id = doc["home_id"].as<String>();
        if (doc.containsKey("device_id") && doc["device_id"].as<String>().length() > 0) {
            config.device_id = doc["device_id"].as<String>();
        } else {
            String mac = WiFi.macAddress();
            mac.replace(":", "");
            config.device_id = "MosaNode_" + mac;
        }
        
        saveConfig();
        
        Serial.println("Credentials saved successfully!");
        pTxCharacteristic->setValue("SUCCESS");
        pTxCharacteristic->notify();
        
        delay(1000); // Give time for notification to send
        BleProvisioner::provisioningComplete = true;
      }
    }
};

void BleProvisioner::init() {
    Serial.println("Starting BLE Provisioning Server...");
    
    BLEDevice::init(config.device_id.c_str());
    pServer = BLEDevice::createServer();
    pServer->setCallbacks(new MyServerCallbacks());

    BLEService *pService = pServer->createService(SERVICE_UUID);

    pTxCharacteristic = pService->createCharacteristic(
                                        CHARACTERISTIC_UUID_TX,
                                        BLECharacteristic::PROPERTY_NOTIFY
                                    );
    pTxCharacteristic->addDescriptor(new BLE2902());

    BLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                             CHARACTERISTIC_UUID_RX,
                                             BLECharacteristic::PROPERTY_WRITE
                                         );
    pRxCharacteristic->setCallbacks(new MyCallbacks());

    pService->start();
    BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06);  
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    
    Serial.println("BLE Advertising Started. Waiting for setup app...");
}

void BleProvisioner::stop() {
    if (pServer != NULL) {
        pServer->getAdvertising()->stop();
        BLEDevice::deinit(true);
        Serial.println("BLE Stopped to save power/memory.");
    }
}

bool BleProvisioner::isProvisioningComplete() {
    return provisioningComplete;
}
