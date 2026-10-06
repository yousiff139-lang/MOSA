/*
 * DeviceHierarchy.h - Object-Oriented Device Polymorphism for ESP32 Nodes
 * Extends base device class into Relay, Dimmer, Sensor, Curtain, AC, and Fan devices.
 */

#ifndef DEVICE_HIERARCHY_H
#define DEVICE_HIERARCHY_H

#include <Arduino.h>
#include <ArduinoJson.h>

enum DeviceType {
  DEVICE_TYPE_RELAY,
  DEVICE_TYPE_DIMMER,
  DEVICE_TYPE_SENSOR,
  DEVICE_TYPE_CURTAIN,
  DEVICE_TYPE_AC,
  DEVICE_TYPE_FAN
};

class BaseDevice {
public:
  int id;
  String name;
  DeviceType type;
  int pin;
  bool state;
  bool isDirty;

  BaseDevice(int devId, const String& devName, DeviceType devType, int devPin)
    : id(devId), name(devName), type(devType), pin(devPin), state(false), isDirty(false) {}

  virtual ~BaseDevice() {}

  virtual void begin() {
    if (pin >= 0) {
      pinMode(pin, OUTPUT);
      digitalWrite(pin, LOW);
    }
  }

  virtual void update() {}

  virtual void setState(bool newState) {
    if (state != newState) {
      state = newState;
      isDirty = true;
      if (pin >= 0) {
        digitalWrite(pin, state ? HIGH : LOW);
      }
    }
  }

  virtual void toggle() {
    setState(!state);
  }

  virtual void toJSON(JsonObject& doc) {
    doc["id"] = id;
    doc["name"] = name;
    doc["pin"] = pin;
    doc["state"] = state;
    doc["isDirty"] = isDirty;
  }
};

class RelayDevice : public BaseDevice {
public:
  RelayDevice(int devId, const String& devName, int devPin)
    : BaseDevice(devId, devName, DEVICE_TYPE_RELAY, devPin) {}
};

class DimmerDevice : public BaseDevice {
public:
  int brightness;

  DimmerDevice(int devId, const String& devName, int devPin)
    : BaseDevice(devId, devName, DEVICE_TYPE_DIMMER, devPin), brightness(100) {}

  void setBrightness(int level) {
    brightness = constrain(level, 0, 100);
    isDirty = true;
    if (pin >= 0) {
      int pwmValue = map(brightness, 0, 100, 0, 255);
      analogWrite(pin, state ? pwmValue : 0);
    }
  }

  void toJSON(JsonObject& doc) override {
    BaseDevice::toJSON(doc);
    doc["type"] = "dimmer";
    doc["brightness"] = brightness;
  }
};

class SensorDevice : public BaseDevice {
public:
  float temperature;
  float humidity;

  SensorDevice(int devId, const String& devName, int devPin)
    : BaseDevice(devId, devName, DEVICE_TYPE_SENSOR, devPin), temperature(0.0), humidity(0.0) {}

  void setReadings(float temp, float hum) {
    if (abs(temperature - temp) > 0.1 || abs(humidity - hum) > 0.1) {
      temperature = temp;
      humidity = hum;
      isDirty = true;
    }
  }

  void toJSON(JsonObject& doc) override {
    BaseDevice::toJSON(doc);
    doc["type"] = "sensor";
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;
  }
};

class ACDevice : public BaseDevice {
public:
  int targetTemp;
  String mode; // COOL, HEAT, FAN, AUTO

  ACDevice(int devId, const String& devName, int devPin)
    : BaseDevice(devId, devName, DEVICE_TYPE_AC, devPin), targetTemp(24), mode("COOL") {}

  void setAcState(bool on, int temp, const String& acMode) {
    setState(on);
    targetTemp = temp;
    mode = acMode;
    isDirty = true;
  }

  void toJSON(JsonObject& doc) override {
    BaseDevice::toJSON(doc);
    doc["type"] = "ac";
    doc["targetTemp"] = targetTemp;
    doc["mode"] = mode;
  }
};

#endif // DEVICE_HIERARCHY_H
