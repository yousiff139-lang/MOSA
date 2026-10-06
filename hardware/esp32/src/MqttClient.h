#pragma once
#include <Arduino.h>
#include <PubSubClient.h>

class MosaMqttClient {
public:
    static void init();
    static void loop();
    static void publishState(const char* statePayload);
private:
    static void callback(char* topic, byte* payload, unsigned int length);
    static void reconnect();
};
