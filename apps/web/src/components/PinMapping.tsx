"use client";
/* eslint-disable */
// @ts-nocheck
import React from 'react';
import { Cpu, MapPin } from 'lucide-react';

export function PinMapping() {
  const relays = [
    { name: "RELAY_1", pin: 4 }, { name: "RELAY_2", pin: 5 }, { name: "RELAY_3", pin: 6 },
    { name: "RELAY_4", pin: 7 }, { name: "RELAY_5", pin: 15 }, { name: "RELAY_6", pin: 16 },
    { name: "RELAY_7", pin: 17 }, { name: "RELAY_8", pin: 18 }, { name: "RELAY_9", pin: 8 },
    { name: "RELAY_10", pin: 9 }
  ];

  const switches = [
    { name: "SW_1", pin: 13 }, { name: "SW_2", pin: 14 }, { name: "SW_3", pin: 42 },
    { name: "SW_4", pin: 41 }, { name: "SW_5", pin: 40 }, { name: "SW_6", pin: 39 },
    { name: "SW_7", pin: 38 }, { name: "SW_8", pin: 48 }, { name: "SW_9", pin: 47 },
    { name: "SW_10", pin: 21 }
  ];

  const sensors = [
    { name: "ACS_PIN (حساس التيار)", pin: 10 },
    { name: "DHT_PIN (الحرارة والرطوبة)", pin: 11 },
    { name: "PIR_PIN (حساس الحركة)", pin: 12 },
    { name: "SCREEN_RX (الشاشة)", pin: 1 },
    { name: "SCREEN_TX (الشاشة)", pin: 2 }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-up">
      <header className="flex justify-between items-end border-b border-gray-200 dark:border-[#1a2235] pb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <MapPin className="text-primary" />
            خريطة المنافذ (Pinout)
          </h2>
          <p className="text-sm text-gray-500 mt-1">توزيع الدبابيس (Pins) المعتمد في اللوحة</p>
        </div>
      </header>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Relays */}
        <div className="bg-white dark:bg-[#101728] p-6 rounded-3xl border border-gray-200 dark:border-[#1a2235] shadow-sm">
          <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-[#1a2235] pb-4">
            <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Cpu size={20} />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">مرحلات (Relays)</h3>
          </div>
          <div className="space-y-2">
            {relays.map((item, i) => (
              <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-[#15203a] rounded-lg transition-colors">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-[#1a2235] text-gray-600 dark:text-gray-400 rounded-md">IO {item.pin}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Switches */}
        <div className="bg-white dark:bg-[#101728] p-6 rounded-3xl border border-gray-200 dark:border-[#1a2235] shadow-sm">
          <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-[#1a2235] pb-4">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Cpu size={20} />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">مفاتيح (Switches)</h3>
          </div>
          <div className="space-y-2">
            {switches.map((item, i) => (
              <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-[#15203a] rounded-lg transition-colors">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-[#1a2235] text-gray-600 dark:text-gray-400 rounded-md">IO {item.pin}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sensors & Screen */}
        <div className="bg-white dark:bg-[#101728] p-6 rounded-3xl border border-gray-200 dark:border-[#1a2235] shadow-sm">
          <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-[#1a2235] pb-4">
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Cpu size={20} />
            </div>
            <h3 className="font-bold text-gray-900 dark:text-white">الحساسات والشاشة</h3>
          </div>
          <div className="space-y-2">
            {sensors.map((item, i) => (
              <div key={i} className="flex justify-between items-center p-2 hover:bg-gray-50 dark:hover:bg-[#15203a] rounded-lg transition-colors">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                <span className="text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-[#1a2235] text-gray-600 dark:text-gray-400 rounded-md">IO {item.pin}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Guide Section */}
      <div className="glass-panel p-8 rounded-3xl mt-8">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Cpu className="text-primary" />
          كيف يتعامل الموقع مع هذه المنافذ لأول مرة؟
        </h3>
        
        <div className="grid md:grid-cols-2 gap-6 relative">
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">تخصيص المنفذ (Assigning PINs)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">عندما تقوم بـ "إضافة جهاز" من واجهة الموقع، ستختار رقم المنفذ (Relay) لتشغيل الجهاز، ويمكنك اختيار منفذ إضافي (Switch) لربطه بمفتاح الجدار العادي.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">الإرسال والحفظ (Save to ESP32)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">الموقع يقوم بإرسال هذه الأرقام إلى لوحة الـ ESP32. اللوحة تقوم ببرمجة هذه المنافذ فوراً وحفظها في ذاكرتها الدائمة (Flash Memory) حتى لا تُفقد عند انقطاع الكهرباء.</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">التحكم المزدوج (Dual Control)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">بعد الإضافة، يصبح المنفذ جاهزاً. يمكنك الآن تشغيل الجهاز من الموقع (عبر الأزرار)، أو من مفتاح الجدار الفعلي. كلا الطريقتين ستحدث حالة الجهاز في الموقع في نفس اللحظة.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-500 flex items-center justify-center font-bold flex-shrink-0">4</div>
              <div>
                <h4 className="font-bold text-gray-900 dark:text-white">الحساسات الأساسية (Sensors)</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">منافذ الحساسات (مثل مستشعر الحرارة والتيار) تعمل بشكل تلقائي ولا تحتاج لإضافتها كأجهزة منفصلة؛ اللوحة تقرأها وترسل بياناتها للموقع ليتم رسمها في المخططات البيانية.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
