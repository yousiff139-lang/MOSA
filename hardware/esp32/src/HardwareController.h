#pragma once
#include <Arduino.h>

class HardwareController {
public:
    static void init();
    static void turnOn();
    static void turnOff();
    static bool isOn();
};
