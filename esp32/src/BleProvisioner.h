#ifndef BLE_PROVISIONER_H
#define BLE_PROVISIONER_H

#include <Arduino.h>

class BleProvisioner {
public:
    static void init();
    static void stop();
    static bool isProvisioningComplete();
    
private:
    static bool provisioningComplete;
};

#endif // BLE_PROVISIONER_H
