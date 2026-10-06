#ifndef MOSA_SETUP_UI_H
#define MOSA_SETUP_UI_H
#include <Arduino.h>

const char CAPTIVE_PORTAL_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mosa Smart Setup</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0e14; color: #fff; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        .container { background-color: #11151c; border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 30px; width: 90%; max-width: 400px; box-shadow: 0 0 30px rgba(16, 185, 129, 0.1); margin: 20px; }
        h1 { color: #10b981; text-align: center; margin-bottom: 5px; font-size: 24px; }
        p { text-align: center; color: #9ca3af; margin-bottom: 25px; font-size: 14px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-size: 12px; font-weight: bold; color: #d1d5db; }
        input { background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px; color: #fff; width: 100%; box-sizing: border-box; outline: none; transition: border-color 0.3s; }
        input:focus { border-color: #10b981; }
        button { background: linear-gradient(90deg, #10b981 0%, #059669 100%); color: #fff; border: none; border-radius: 10px; padding: 14px; width: 100%; font-size: 16px; font-weight: bold; cursor: pointer; transition: transform 0.2s; margin-top: 10px; }
        button:hover { transform: scale(1.02); }
    </style>
</head>
<body>
    <div class="container">
        <h1>إعداد شبكة Mosa</h1>
        <p>يرجى إدخال بيانات الاتصال لتفعيل العقدة الذكية</p>
        <form action="/save" method="POST">
            <div class="form-group"><label>اسم الشبكة (SSID)</label><input type="text" name="ssid" placeholder="WiFi SSID" required></div>
            <div class="form-group"><label>كلمة المرور (Password)</label><input type="password" name="pass" placeholder="WiFi Password"></div>
            <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.05); margin: 20px 0;">
            <div class="form-group"><label>معرف المنزل (Home ID)</label><input type="text" name="homeid" placeholder="مثال: home-1" required></div>
            <div class="form-group"><label>اسم العقدة (Node Name)</label><input type="text" name="nodename" placeholder="مثال: غرفة المعيشة" required></div>
            <div class="form-group"><label>خادم MQTT (Broker IP)</label><input type="text" name="mqtthost" placeholder="192.168.1.100" required></div>
            <div class="form-group"><label>مستخدم MQTT (اختياري)</label><input type="text" name="mqttuser" placeholder="Username"></div>
            <div class="form-group"><label>رمز MQTT (اختياري)</label><input type="password" name="mqttpass" placeholder="Password"></div>
            <button type="submit">حفظ وإعادة تشغيل</button>
        </form>
    </div>
</body>
</html>
)rawliteral";

#endif
