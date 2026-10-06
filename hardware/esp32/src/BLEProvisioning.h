#ifndef BLE_PROVISIONING_H
#define BLE_PROVISIONING_H

#include <Arduino.h>

class BLEProvisioning {
public:
    static void init();
    static void stop();
    static bool isProvisioned();
};

#endif
