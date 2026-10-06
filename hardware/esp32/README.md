# MOSA Smart Platform - ESP32-S3 Firmware Configuration & Assembly

This directory contains the production-ready firmware for the ESP32-S3 microcontroller node compiled using PlatformIO.

---

## 🔌 1. Wiring & Schematic Diagram (ASCII Art)

```
                     +---------------------------------------+
                     |              ESP32-S3                 |
                     +---------------------------------------+
                       |   |   |   |   |   |   |   |   |   |  
    [I2C Bus]          |   |   |   |   |   |   |   |   |   |  
    SDA (GPIO 2)  <----+   |   |   |   |   |   |   |   |   |  
    SCL (GPIO 42) <--------+   |   |   |   |   |   |   |   |  
                               |   |   |   |   |   |   |   |  
    [Sensors]                  |   |   |   |   |   |   |   |  
    DHT22 (GPIO 7)  <----------+   |   |   |   |   |   |   |  
    ACS712 (GPIO 12)<--------------+   |   |   |   |   |   |  
    PIR (GPIO 41)   <------------------+   |   |   |   |   |  
                                           |   |   |   |   |  
    [Relay Control Pins]                   |   |   |   |   |  
    Relay 1 (GPIO 15) <--------------------+   |   |   |   |  
    Relay 2 (GPIO 16) <------------------------+   |   |   |  
    Relay 3 (GPIO 17) <----------------------------+   |   |  
    Relay 4 (GPIO 18) <--------------------------------+   |  
    Relay 5 (GPIO 19) <------------------------------------+  
    Relay 6 (GPIO 20) <---------------------------------------+  
```

---

## 📚 2. Required Libraries

Make sure the following libraries are installed in your compilation environment:
- **WiFiManager** (by tzapu) - version `2.0.16-rc.2` or newer
- **PubSubClient** (by Nick O'Leary) - version `2.8.0`
- **ArduinoJson** (by Benoit Blanchon) - version `6.21.3`
- **DHT sensor library** (by Adafruit) - version `1.4.6`
- **RTClib** (by Adafruit) - version `2.1.3`
- **Adafruit SSD1306** (by Adafruit) - version `2.5.9`
- **Adafruit GFX Library** (by Adafruit) - version `1.11.9`

---

## ⚙️ 3. How to Configure

1. Open `esp32/include/config.h`.
2. Adjust your hardware pin mappings if your PCB tracks deviate from the default layout.
3. Configure your default calibration offsets:
   - `#define TEMP_CALIBRATION_OFFSET -1.2` (Adjust if DHT22 reads high near internal power regulators).
4. Save the file.

---

## ⚡ 4. How to Flash

### Using PlatformIO (Recommended)
1. Open the folder `hardware/esp32` in Visual Studio Code with the PlatformIO extension installed.
2. Connect your ESP32-S3 board to your PC via a USB cable.
3. Click the **Upload** icon on the PlatformIO bottom toolbar, or run:
   ```bash
   pio run --target upload
   ```

### Using Arduino IDE
1. Rename `main.cpp` to `esp32.ino` and open it in Arduino IDE.
2. Install all required libraries via **Library Manager**.
3. Select board **ESP32S3 Dev Module** from tools.
4. Select correct COM port and click **Upload**.

---

## 🔍 5. Verification & Testing

1. **Self-Test Check:** On boot, the OLED display should show `Running Diagnostics...`. The Serial Monitor output should confirm the successful discovery of DS3231 RTC and DHT22.
2. **Wi-Fi Portal Setup:** If no network is stored, search on your phone/PC for SSID `MOSA-Setup` and connect. Navigate to `http://192.168.4.1` to enter your Home ID, MQTT Broker IP, and local Wi-Fi credentials.
3. **MQTT Mapped Status:** The OLED display will show `MQTT: Online` and the board will broadcast an auto-discovery packet to `mosa/discovery`.
4. **Relay Toggle verification:** Toggle switches from the web platform dashboard. The relays should switch states instantly.
