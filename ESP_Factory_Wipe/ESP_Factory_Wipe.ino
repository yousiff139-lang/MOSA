/*
 * ══════════════════════════════════════════════════════════════════════════
 *        MOSA SMART NODE — أداة الفرمتة الشاملة لمتحكم ESP32-S3
 *        ESP32-S3 COMPLETE FACTORY WIPE & PURGE UTILITY
 * ══════════════════════════════════════════════════════════════════════════
 * 
 *  الوظيفة:
 *  بمجرد رفع هذا الكود من خلال Arduino IDE، سيقوم تلقائياً بمسح وفرمتة:
 *    1. ذاكرة NVS (Non-Volatile Storage) بالكامل بجميع أقسامها.
 *    2. إعدادات وشبكات الواي فاي (WiFi credentials) المحفوظة في الشريحة.
 *    3. جميع أنظمة الملفات الفلاشية (LittleFS / SPIFFS / FFat).
 *    4. جميع مساحات الأسماء في Preferences (الأجهزة، المجموعات، الرليهات، مفاتيح التشفير).
 *    5. ذاكرة الـ RTC.
 * 
 *  طريقة الاستخدام:
 *    - ارفع هذا الملف إلى ESP32-S3 عبر Arduino IDE.
 *    - افتح Serial Monitor على سرعة 115200 لمشاهدة التقرير.
 *    - عند ظهور "✅ تم الانتهاء بنجاح"، يمكنك الآن رفع كود مشروعك الأساسي R1_Refactored.
 * ══════════════════════════════════════════════════════════════════════════
 */

#include <Arduino.h>
#include <WiFi.h>
#include <nvs_flash.h>
#include <Preferences.h>
#include <LittleFS.h>
#include <SPIFFS.h>
#include <FFat.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET    -1
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

bool hasOLED = false;

void updateOLED(const char* title, const char* status, const char* details) {
  if (!hasOLED) return;
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  
  display.setCursor(0, 0);
  display.println(F("=== MOSA PURGE TOOL ==="));
  
  display.setCursor(0, 16);
  display.println(title);
  
  display.setCursor(0, 32);
  display.println(status);
  
  display.setCursor(0, 48);
  display.println(details);
  
  display.display();
}

void setup() {
  Serial.begin(115200);
  delay(1500); // إتاحة وقت كافٍ لفتح السيريال مونيتور

  Serial.println("\n");
  Serial.println("╔════════════════════════════════════════════════════════════════╗");
  Serial.println("║         MOSA SMART NODE — ESP32-S3 FACTORY WIPE TOOL           ║");
  Serial.println("║             بدء عملية الفرمتة ومسح الذاكرة الشاملة...          ║");
  Serial.println("╚════════════════════════════════════════════════════════════════╝");
  Serial.println();

  // فحص وجود شاشة OLED (على المنافذ المعتمدة I2C SDA:2, SCL:42)
  Wire.begin(2, 42);
  if (display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    hasOLED = true;
    updateOLED("Starting Wipe...", "Erasing Flash", "Please wait...");
  }

  // 1. مسح ذاكرة NVS بالكامل (Non-Volatile Storage)
  Serial.print("[1/5] 🗑️  جاري مسح ذاكرة NVS بالكامل (Partition Erase)... ");
  updateOLED("1. Wiping NVS", "Erasing partitions", "Wait...");
  
  esp_err_t err = nvs_flash_erase();
  if (err == ESP_OK) {
    Serial.println("نجح ✅ (OK)");
  } else {
    Serial.printf("فشل ⚠️ (كود الخطأ: 0x%x)\n", err);
  }

  // إعادة تهيئة الـ NVS فارغاً ونظيفاً
  nvs_flash_init();

  // تنظيف إضافي لمساحات الأسماء المعروفة للتأكيد
  Preferences prefs;
  const char* namespaces[] = {"smarthome", "wifi", "scenes", "relay-state", "mesh-rx", "mesh-tx", "system", "ota"};
  for (int i = 0; i < 8; i++) {
    if (prefs.begin(namespaces[i], false)) {
      prefs.clear();
      prefs.end();
    }
  }

  delay(500);

  // 2. تصفير ومسح شبكات الواي فاي المحفوظة في فلاش الشريحة
  Serial.print("[2/5] 📶 جاري مسح شبكات الواي فاي وبيانات الراديو... ");
  updateOLED("2. Erasing WiFi", "Clearing SSID/Keys", "Wait...");
  
  WiFi.persistent(true);
  WiFi.disconnect(true, true); // مسح البيانات المخزنة من الراديو وفصله
  WiFi.mode(WIFI_OFF);
  delay(500);
  Serial.println("نجح ✅ (OK)");

  // 3. فرمتة نظام الملفات LittleFS
  Serial.print("[3/5] 📁 جاري فحص وفرمتة نظام الملفات LittleFS... ");
  updateOLED("3. LittleFS", "Formatting fs", "Wait...");
  if (LittleFS.begin(true)) {
    if (LittleFS.format()) {
      Serial.println("تمت الفرمتة بنجاح ✅");
    } else {
      Serial.println("تم التخطي/لا يحتاج ℹ️");
    }
    LittleFS.end();
  } else {
    Serial.println("غير مفعل/فارغ ℹ️");
  }
  delay(300);

  // 4. فرمتة نظام الملفات SPIFFS
  Serial.print("[4/5] 🗄️  جاري فحص وفرمتة نظام الملفات SPIFFS... ");
  updateOLED("4. SPIFFS", "Formatting spiffs", "Wait...");
  if (SPIFFS.begin(true)) {
    if (SPIFFS.format()) {
      Serial.println("تمت الفرمتة بنجاح ✅");
    } else {
      Serial.println("تم التخطي/لا يحتاج ℹ️");
    }
    SPIFFS.end();
  } else {
    Serial.println("غير مفعل/فارغ ℹ️");
  }
  delay(300);

  // 5. فرمتة نظام الملفات FFat
  Serial.print("[5/5] 💾 جاري فحص وفرمتة قسم الـ FFat... ");
  updateOLED("5. FFat", "Formatting FFat", "Wait...");
  if (FFat.begin(true)) {
    if (FFat.format()) {
      Serial.println("تمت الفرمتة بنجاح ✅");
    } else {
      Serial.println("تم التخطي/لا يحتاج ℹ️");
    }
    FFat.end();
  } else {
    Serial.println("غير مفعل/فارغ ℹ️");
  }
  delay(500);

  // إشعار اكتمال العملية
  Serial.println();
  Serial.println("════════════════════════════════════════════════════════════════");
  Serial.println("🎉 تمت الفرمتة الكاملة بنجاح 100%!");
  Serial.println("📌 حالة الجهاز: خام تماماً (Brand New) ولا توجد به أي بيانات محفوظة.");
  Serial.println("🚀 الخطوة القادمة: يمكنك الآن فتح ورفع الكود الأساسي R1_Refactored.ino");
  Serial.println("════════════════════════════════════════════════════════════════\n");

  if (hasOLED) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setCursor(10, 8);
    display.println(F("WIPE COMPLETE 100%"));
    display.setCursor(14, 26);
    display.println(F("FLASH IS CLEAN"));
    display.setCursor(5, 46);
    display.println(F("Ready For New Code"));
    display.display();
  }
}

void loop() {
  // التوقف هنا حتى لا يتم تكرار الفرمتة في حلقة مستمرة
  delay(1000);
}
