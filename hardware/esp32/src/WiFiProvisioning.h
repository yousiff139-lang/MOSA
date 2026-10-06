#pragma once
#include <Arduino.h>
#include "ConfigManager.h"

class WiFiProvisioning {
public:
    static void startProvisioningMode();
    static bool isProvisioned();
    static void connectToWiFi();
};
