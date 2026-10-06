# نظام MOSA - البرمجية الثابتة للمتحكمات (ESP32 Firmware) ⚡

هذا المجلد يحتوي على الكود البرمجي الكامل بلغة `C++` الخاص بالمتحكم الفعلي `ESP32` الذي يتصل بنظام MOSA الخاص بك.

## 1. المكتبات المطلوبة (Required Libraries)
لتشغيل هذا الكود على بيئة Arduino IDE، يرجى فتح `Sketch -> Include Library -> Manage Libraries` وتثبيت الحزم التالية بأحدث إصداراتها:
1. **PubSubClient** (بواسطة Nick O'Leary) - للاتصال بـ MQTT.
2. **DHT sensor library** (بواسطة Adafruit) - لحساس الحرارة.
3. **ArduinoJson** (بواسطة Benoit Blanchon) - لمعالجة بيانات JSON.
4. مكتبات (WiFi.h, ArduinoOTA.h, HTTPClient.h, Update.h) تأتي مدمجة تلقائياً عند اختيار لوحة ESP32.

## 2. الإعداد والتهيئة (Configuration)
قبل رفع الكود إلى المتحكم، يجب عليك فتح ملف `main.ino` وتعديل المتغيرات في أعلى الملف لتتطابق مع شبكتك:
```cpp
const char* WIFI_SSID     = "اسم شبكة الواي فاي";
const char* WIFI_PASSWORD = "كلمة مرور الشبكة";
const char* MQTT_SERVER   = "عنوان IP الخاص بخادم MOSA (مثال: 192.168.1.100)";
const char* MAC_ADDRESS   = "أدخل الـ MAC Address الخاص بهذا المتحكم (مهم لتعرفه المنصة)";
```

## 3. مخطط التوصيل (Wiring Diagram)

```text
 [ ESP32 38-Pin ]
       3V3  | 1    38 | GND   --> (تأريض مشترك لجميع القطع)
       ...  |             | 
 (PIR)  21  |             | 
 (DHT)  19  |             | 
 (LED4) 18  |             | 
 (LED3)  5  |             | 
 (LED2)  4  |             | 
 (LED1)  2  |             | 
       ...  |             |
```
- قم بتوصيل `GPIO 2` إلى ريلاي المصباح الأول (المعيشة 1).
- قم بتوصيل `GPIO 4` إلى ريلاي المصباح الثاني (المعيشة 2).
- قم بتوصيل `GPIO 5` إلى ريلاي مصباح غرفة النوم.
- قم بتوصيل `GPIO 18` إلى ريلاي مصباح المطبخ.
- حساس الحرارة DHT22: `GPIO 19`.
- حساس الحركة PIR: `GPIO 21`.

## 4. الرفع والتحقق (Flashing & Verification)
1. قم بتوصيل الـ ESP32 عبر كابل USB.
2. اختر لوحة "DOIT ESP32 DEVKIT V1" أو الموازية لها من Arduino IDE.
3. اضغط على Upload.
4. افتح **Serial Monitor** على سرعة `115200` baud.
5. يجب أن ترى رسائل نجاح الاتصال:
```text
[MOSA] Connecting to YOUR_WIFI
[MOSA] WiFi Connected: 192.168.1.x
[MOSA] Attempting MQTT connection...connected
[MOSA] Temperature: 24.5°C Humidity: 60.2%
```

بعد هذا الإعداد الأول، يمكنك استخدام لوحة تحكم MOSA وتمرير التحديثات المستقبلية عبر الهواء (OTA) دون الحاجة للكابل!
