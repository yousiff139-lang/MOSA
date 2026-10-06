#ifndef NETWORK_MANAGER_H
#define NETWORK_MANAGER_H

#include <Arduino.h>

class NetworkManager {
public:
    static void init();
    static void loop();
    static bool isConnected();
    static void publishState(bool state);
    
private:
    static void connectWiFi();
    static void connectMQTT();
    static void mqttCallback(char* topic, byte* payload, unsigned int length);
    static unsigned long lastReconnectAttempt;
};

#endif // NETWORK_MANAGER_H
