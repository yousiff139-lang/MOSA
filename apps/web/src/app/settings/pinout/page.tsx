'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Zap,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  Sliders,
  Radio,
  Search,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Layers,
  Thermometer,
  Activity,
  Sparkles,
  Copy,
  Check,
  Volume2,
  Mic,
  Monitor,
  ToggleLeft,
  LayoutGrid,
  FileCode,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GpioPinInfo {
  pin: number;
  name: string;
  category: 'safe_out' | 'input_only' | 'strapping' | 'forbidden' | 'protocol';
  safetyLevel: 'SAFE' | 'WARNING' | 'FORBIDDEN';
  description: string;
  pullup: boolean;
  adc: string | null;
  touch: boolean;
  dac: boolean;
  bestFor: string;
  bootBehavior: string;
  hardwareNote: string;
  headerSide?: 'left' | 'right';
  targetComponent?: string;
  colorType?: 'relay' | 'switch' | 'sensor' | 'audio' | 'screen' | 'power' | 'forbidden' | 'serial';
}

// ----------------------------------------------------
// 1. بيانات منافذ ESP32-S3 (N16R8) - 44 Pins
// ----------------------------------------------------
const ESP32_S3_PINS_DATA: GpioPinInfo[] = [
  {
    pin: 0,
    name: 'GPIO 0 (BOOT)',
    category: 'strapping',
    safetyLevel: 'FORBIDDEN',
    description: 'منفذ زر الإقلاع (Boot Strapping Pin). يجب أن يكون HIGH عند التشغيل.',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'زر الـ Boot اليدوي فقط (لا توصله بأي حمل خارجي)',
    bootBehavior: 'إذا سُحب للـ GND أثناء الإقلاع يدخل وضع الـ Download/Flash.',
    hardwareNote: '⚠️ ممنوع ربطه بريليهات أو مفاتيح جدارية لتجنب فشل الإقلاع.',
    colorType: 'forbidden'
  },
  {
    pin: 1,
    name: 'GPIO 1',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن 100% (ADC1_CH0).',
    pullup: true,
    adc: 'ADC1_CH0',
    touch: true,
    dac: false,
    bestFor: 'مخرج ريليه 1 (Relay 1)',
    bootBehavior: 'مستقر تماماً في وضع High-Z عند الإقلاع.',
    hardwareNote: 'الخيار الأول المعتمد لمخارج الإنارة والريليهات على الطرف الأيمن.',
    headerSide: 'right',
    targetComponent: 'Relay 1 (مخرج 1)',
    colorType: 'relay'
  },
  {
    pin: 2,
    name: 'GPIO 2',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن 100% (ADC1_CH1).',
    pullup: true,
    adc: 'ADC1_CH1',
    touch: true,
    dac: false,
    bestFor: 'مخرج ريليه 2 (Relay 2)',
    bootBehavior: 'مستقر وخالٍ من النويز عند الإقلاع.',
    hardwareNote: 'آمن ومناسب لدوائر القيادة المباشرة عبر ULN2803.',
    headerSide: 'right',
    targetComponent: 'Relay 2 (مخرج 2)',
    colorType: 'relay'
  },
  {
    pin: 3,
    name: 'GPIO 3 (JTAG)',
    category: 'strapping',
    safetyLevel: 'FORBIDDEN',
    description: 'دبوس برمجة وتصحيح JTAG داخلي.',
    pullup: true,
    adc: 'ADC1_CH2',
    touch: true,
    dac: false,
    bestFor: 'تصحيح الأخطاء JTAG فقط',
    bootBehavior: 'مرتبط بحالة الـ Bootstrapping.',
    hardwareNote: '⚠️ تجنب استخدامه كطرف ريليه لمنع التداخل مع المعالج.',
    colorType: 'forbidden'
  },
  {
    pin: 4,
    name: 'GPIO 4',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ عام عالي السرعة يدعم المقاومات الداخلية (ADC1_CH3).',
    pullup: true,
    adc: 'ADC1_CH3',
    touch: true,
    dac: false,
    bestFor: 'مفتاح جداري 1 (Wall Switch 1)',
    bootBehavior: 'مستقر ولا يؤثر على الإقلاع.',
    hardwareNote: 'ممتاز جداً لربط المفاتيح الجدارية مع INPUT_PULLUP.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 1',
    colorType: 'switch'
  },
  {
    pin: 5,
    name: 'GPIO 5',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن 100% (ADC1_CH4).',
    pullup: true,
    adc: 'ADC1_CH4',
    touch: true,
    dac: false,
    bestFor: 'مفتاح جداري 2 (Wall Switch 2)',
    bootBehavior: 'مستقر وخالٍ من أي نبضات خاطئة.',
    hardwareNote: 'استجابة فائقة السرعة مع المقاطعات الخارجية.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 2',
    colorType: 'switch'
  },
  {
    pin: 6,
    name: 'GPIO 6',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن (ADC1_CH5).',
    pullup: true,
    adc: 'ADC1_CH5',
    touch: true,
    dac: false,
    bestFor: 'مفتاح جداري 3 (Wall Switch 3)',
    bootBehavior: 'مستقر تماماً في وضع High-Z.',
    hardwareNote: 'آمن ومناسب لجميع لوحات التوزيع.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 3',
    colorType: 'switch'
  },
  {
    pin: 7,
    name: 'GPIO 7',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن (ADC1_CH6).',
    pullup: true,
    adc: 'ADC1_CH6',
    touch: true,
    dac: false,
    bestFor: 'مفتاح جداري 4 (Wall Switch 4)',
    bootBehavior: 'مستقر تماماً في جميع الأوقات.',
    hardwareNote: 'خيار ممتاز لمفاتيح الإضاءة السريعة.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 4',
    colorType: 'switch'
  },
  {
    pin: 8,
    name: 'GPIO 8',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (ADC1_CH7).',
    pullup: true,
    adc: 'ADC1_CH7',
    touch: true,
    dac: false,
    bestFor: 'حساس الحرارة والرطوبة DHT22 / DHT11',
    bootBehavior: 'مستقر ولا يتعارض مع الاتصال اللاسلكي.',
    hardwareNote: 'المنفذ القياسي المعتمد لحساس المناخ DHT22 في MOSA.',
    headerSide: 'left',
    targetComponent: 'حساس حرارة DHT22',
    colorType: 'sensor'
  },
  {
    pin: 9,
    name: 'GPIO 9',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (ADC1_CH8).',
    pullup: true,
    adc: 'ADC1_CH8',
    touch: true,
    dac: false,
    bestFor: 'حساس كاشف الحركة PIR / Microwave',
    bootBehavior: 'مستقر ويوفر قراءات رقمية دقيقة.',
    hardwareNote: 'ممتاز لربط حساسات الحركة والأمان.',
    headerSide: 'left',
    targetComponent: 'حساس حركة PIR',
    colorType: 'sensor'
  },
  {
    pin: 10,
    name: 'GPIO 10',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ تناظري عالي الدقة ADC1 (يعمل بكفاءة مع الواي فاي).',
    pullup: true,
    adc: 'ADC1_CH9',
    touch: true,
    dac: false,
    bestFor: 'حساس قياس التيار والواط ACS712 / CT Clamp',
    bootBehavior: 'مستقر تماماً في القراءة التناظرية.',
    hardwareNote: 'منفذ ADC1 لا يتعطل عند إرسال حزم الـ WiFi.',
    headerSide: 'left',
    targetComponent: 'حساس تيار ACS712 (ADC1)',
    colorType: 'sensor'
  },
  {
    pin: 11,
    name: 'GPIO 11',
    category: 'protocol',
    safetyLevel: 'SAFE',
    description: 'منفذ صوتي ورقمي عالي التردد I2S.',
    pullup: true,
    adc: 'ADC2_CH0',
    touch: true,
    dac: false,
    bestFor: 'ميكروفون INMP441 (خط الساعة SCK / BCLK)',
    bootBehavior: 'مستقر لنقل الإشارات الصوتية.',
    hardwareNote: 'مخصص لنقل نبضات الصوت الرقمي النقي للمايك.',
    headerSide: 'left',
    targetComponent: 'I2S Mic SCK',
    colorType: 'audio'
  },
  {
    pin: 12,
    name: 'GPIO 12',
    category: 'protocol',
    safetyLevel: 'SAFE',
    description: 'منفذ مزامنة القنوات الصوتية I2S Word Select.',
    pullup: true,
    adc: 'ADC2_CH1',
    touch: true,
    dac: false,
    bestFor: 'ميكروفون INMP441 (خط المزامنة WS / LRCK)',
    bootBehavior: 'مستقر وخالٍ من التشويش.',
    hardwareNote: 'مخصص لمزامنة القناة الصوتية للميكروفون.',
    headerSide: 'left',
    targetComponent: 'I2S Mic WS',
    colorType: 'audio'
  },
  {
    pin: 13,
    name: 'GPIO 13',
    category: 'protocol',
    safetyLevel: 'SAFE',
    description: 'منفذ استقبال بيانات الصوت الرقمية للميكروفون (I2S Data In).',
    pullup: true,
    adc: 'ADC2_CH2',
    touch: true,
    dac: false,
    bestFor: 'ميكروفون INMP441 (خط البيانات SD / Serial Data)',
    bootBehavior: 'مستقر لنقل عينات الصوت بدقة 24-bit.',
    hardwareNote: 'يستقبل الأوامر الصوتية بدقة نقاوة استوديو للمايك الصوتي.',
    headerSide: 'left',
    targetComponent: 'I2S Mic (SD Data)',
    colorType: 'audio'
  },
  {
    pin: 14,
    name: 'GPIO 14',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إخراج نغمات وإشارات جرس التنبيه (Buzzer PWM Driver).',
    pullup: true,
    adc: 'ADC2_CH3',
    touch: true,
    dac: false,
    bestFor: 'جرس التنبيه والإنذار (Buzzer)',
    bootBehavior: 'مستقر تماماً في وضع High-Z عند الإقلاع.',
    hardwareNote: 'يدعم نغمات PWM الترددية للإنذار والأصوات على الطرف الأيسر.',
    headerSide: 'left',
    targetComponent: 'Buzzer (جرس الإنذار)',
    colorType: 'relay'
  },
  {
    pin: 15,
    name: 'GPIO 15',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (RTC_GPIO15).',
    pullup: true,
    adc: 'ADC2_CH4',
    touch: false,
    dac: false,
    bestFor: 'مفتاح جداري 5 (Wall Switch 5)',
    bootBehavior: 'مستقر في وضع الإدخال.',
    hardwareNote: 'آمن ومناسب لمفاتيح الحائط.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 5',
    colorType: 'switch'
  },
  {
    pin: 16,
    name: 'GPIO 16',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (RTC_GPIO16).',
    pullup: true,
    adc: 'ADC2_CH5',
    touch: false,
    dac: false,
    bestFor: 'مفتاح جداري 6 (Wall Switch 6)',
    bootBehavior: 'مستقر تماماً في وضع High-Z.',
    hardwareNote: 'خالٍ من أي تعارضات إقلاع.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 6',
    colorType: 'switch'
  },
  {
    pin: 17,
    name: 'GPIO 17',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (RTC_GPIO17).',
    pullup: true,
    adc: 'ADC2_CH6',
    touch: false,
    dac: false,
    bestFor: 'مفتاح جداري 7 (Wall Switch 7)',
    bootBehavior: 'مستقر تماماً.',
    hardwareNote: 'آمن لمفاتيح الإنارة.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 7',
    colorType: 'switch'
  },
  {
    pin: 18,
    name: 'GPIO 18',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (RTC_GPIO18).',
    pullup: true,
    adc: 'ADC2_CH7',
    touch: false,
    dac: false,
    bestFor: 'مفتاح جداري 8 (Wall Switch 8)',
    bootBehavior: 'مستقر ولا يؤثر على الإقلاع.',
    hardwareNote: 'يدعم الـ Interrupts السريعة.',
    headerSide: 'left',
    targetComponent: 'Wall Switch 8',
    colorType: 'switch'
  },
  {
    pin: 19,
    name: 'GPIO 19 (USB D-)',
    category: 'forbidden',
    safetyLevel: 'FORBIDDEN',
    description: 'منفذ بيانات الـ USB السالب الداخلي (USB JTAG D-).',
    pullup: false,
    adc: 'ADC2_CH8',
    touch: false,
    dac: false,
    bestFor: 'منفذ USB Type-C الداخلي فقط',
    bootBehavior: 'نقل بيانات الـ USB.',
    hardwareNote: '⚠️ ممنوع لمسه أو ربطه لتفادي انقطاع اتصال الـ USB بالكمبيوتر.',
    colorType: 'forbidden'
  },
  {
    pin: 20,
    name: 'GPIO 20 (USB D+)',
    category: 'forbidden',
    safetyLevel: 'FORBIDDEN',
    description: 'منفذ بيانات الـ USB الموجب الداخلي (USB JTAG D+).',
    pullup: false,
    adc: 'ADC2_CH9',
    touch: false,
    dac: false,
    bestFor: 'منفذ USB Type-C الداخلي فقط',
    bootBehavior: 'نقل بيانات الـ USB.',
    hardwareNote: '⚠️ ممنوع لمسه أو ربطه بالأحمال.',
    colorType: 'forbidden'
  },
  {
    pin: 21,
    name: 'GPIO 21',
    category: 'protocol',
    safetyLevel: 'SAFE',
    description: 'المنفذ القياسي لخط بيانات الـ I2C (SDA) لشاشة العرض OLED.',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'شاشة OLED SSD1306 (خط البيانات I2C SDA)',
    bootBehavior: 'مستقر ومثالي لبروتوكول I2C.',
    hardwareNote: 'المنفذ المعتمد لخط بيانات الشاشة على الطرف الأيمن.',
    headerSide: 'right',
    targetComponent: 'I2C SDA (شاشة OLED)',
    colorType: 'screen'
  },
  {
    pin: 33,
    name: 'GPIO 33 (PSRAM)',
    category: 'forbidden',
    safetyLevel: 'FORBIDDEN',
    description: '❌ محجوز داخلياً لذاكرة الـ 8MB Octal PSRAM.',
    pullup: false,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'الذاكرة الداخلية فقط (محظور استخدامه)',
    bootBehavior: 'نقل بيانات الـ PSRAM السريعة.',
    hardwareNote: '🚨 لمس هذا المنفذ يسبب انهيار فوري للمعالج (Kernel Crash)!',
    colorType: 'forbidden'
  },
  {
    pin: 34,
    name: 'GPIO 34 (PSRAM)',
    category: 'forbidden',
    safetyLevel: 'FORBIDDEN',
    description: '❌ محجوز داخلياً لذاكرة الـ 8MB Octal PSRAM.',
    pullup: false,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'الذاكرة الداخلية فقط (محظور استخدامه)',
    bootBehavior: 'نقل بيانات الـ PSRAM.',
    hardwareNote: '🚨 لمس هذا المنفذ يسبب انهيار فوري للمعالج (Kernel Crash)!',
    colorType: 'forbidden'
  },
  {
    pin: 35,
    name: 'GPIO 35 (PSRAM)',
    category: 'forbidden',
    safetyLevel: 'FORBIDDEN',
    description: '❌ محجوز داخلياً لذاكرة الـ 8MB Octal PSRAM.',
    pullup: false,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'الذاكرة الداخلية فقط (محظور استخدامه)',
    bootBehavior: 'نقل بيانات الـ PSRAM.',
    hardwareNote: '🚨 لمس هذا المنفذ يسبب انهيار فوري للمعالج (Kernel Crash)!',
    colorType: 'forbidden'
  },
  {
    pin: 36,
    name: 'GPIO 36 (PSRAM)',
    category: 'forbidden',
    safetyLevel: 'FORBIDDEN',
    description: '❌ محجوز داخلياً لذاكرة الـ 8MB Octal PSRAM.',
    pullup: false,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'الذاكرة الداخلية فقط (محظور استخدامه)',
    bootBehavior: 'نقل بيانات الـ PSRAM.',
    hardwareNote: '🚨 لمس هذا المنفذ يسبب انهيار فوري للمعالج (Kernel Crash)!',
    colorType: 'forbidden'
  },
  {
    pin: 37,
    name: 'GPIO 37 (PSRAM)',
    category: 'forbidden',
    safetyLevel: 'FORBIDDEN',
    description: '❌ محجوز داخلياً لذاكرة الـ 8MB Octal PSRAM.',
    pullup: false,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'الذاكرة الداخلية فقط (محظور استخدامه)',
    bootBehavior: 'نقل بيانات الـ PSRAM.',
    hardwareNote: '🚨 لمس هذا المنفذ يسبب انهيار فوري للمعالج (Kernel Crash)!',
    colorType: 'forbidden'
  },
  {
    pin: 38,
    name: 'GPIO 38',
    category: 'protocol',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام حر / بروتوكول I2C SCL للشاشة.',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'شاشة OLED (خط الساعة I2C SCL)',
    bootBehavior: 'مستقر ومثالي لبروتوكول I2C.',
    hardwareNote: 'آمن ومناسب لربط خط الساعة لشاشة العرض.',
    headerSide: 'right',
    targetComponent: 'I2C SCL (شاشة OLED)',
    colorType: 'screen'
  },
  {
    pin: 39,
    name: 'GPIO 39',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام حر وآمن 100% (MTCK).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخرج ريليه 6 (Relay 6)',
    bootBehavior: 'مستقر تماماً في وضع High-Z عند الإقلاع.',
    hardwareNote: 'خيار قياسي لمخارج الإنارة والريليهات عبر ULN2803.',
    headerSide: 'right',
    targetComponent: 'Relay 6 (مخرج 6)',
    colorType: 'relay'
  },
  {
    pin: 40,
    name: 'GPIO 40',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن 100% (MTDO).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخرج ريليه 5 (Relay 5)',
    bootBehavior: 'مستقر تماماً عند الإقلاع.',
    hardwareNote: 'استجابة فائقة السرعة مع درايفر ULN2803.',
    headerSide: 'right',
    targetComponent: 'Relay 5 (مخرج 5)',
    colorType: 'relay'
  },
  {
    pin: 41,
    name: 'GPIO 41',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن 100% (MTDI).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخرج ريليه 4 (Relay 4)',
    bootBehavior: 'مستقر ولا يرمش عند تشغيل البوردة.',
    hardwareNote: 'خيار قياسي في بوردة الـ PCB.',
    headerSide: 'right',
    targetComponent: 'Relay 4 (مخرج 4)',
    colorType: 'relay'
  },
  {
    pin: 42,
    name: 'GPIO 42',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن 100% (MTMS).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخرج ريليه 3 (Relay 3)',
    bootBehavior: 'مستقر تماماً في جميع الأوقات.',
    hardwareNote: 'آمن لمخارج الريليهات المستقلة.',
    headerSide: 'right',
    targetComponent: 'Relay 3 (مخرج 3)',
    colorType: 'relay'
  },
  {
    pin: 43,
    name: 'GPIO 43 (U0TXD)',
    category: 'protocol',
    safetyLevel: 'WARNING',
    description: 'منفذ إرسال السيريال البرمجي الرئيسي (UART0 TX).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'اتصال الـ Serial Monitor والبرمجة',
    bootBehavior: 'يرسل نصوص الإقلاع (Boot logs).',
    hardwareNote: 'يُفضل إبقاؤه حراً لقراءة السيريال أثناء التطوير.',
    headerSide: 'right',
    targetComponent: 'Serial TX43',
    colorType: 'serial'
  },
  {
    pin: 44,
    name: 'GPIO 44 (U0RXD)',
    category: 'protocol',
    safetyLevel: 'WARNING',
    description: 'منفذ استقبال السيريال البرمجي الرئيسي (UART0 RX).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'استقبال أوامر السيريال والبرمجة',
    bootBehavior: 'إدخال سيريال.',
    hardwareNote: 'يُفضل إبقاؤه حراً لبرمجة اللوحة.',
    headerSide: 'right',
    targetComponent: 'Serial RX44',
    colorType: 'serial'
  },
  {
    pin: 45,
    name: 'GPIO 45 (VDD_SPI)',
    category: 'strapping',
    safetyLevel: 'FORBIDDEN',
    description: 'دبوس ضبط جهد الفلاش الداخلي (Strapping Pin).',
    pullup: false,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'غير مسموح بربطه خارجياً',
    bootBehavior: 'يحدد جهد فلاش الـ ESP32-S3 عند البوت.',
    hardwareNote: '⚠️ سحبه للخارج قد يتلف شريحة الفلاش.',
    colorType: 'forbidden'
  },
  {
    pin: 46,
    name: 'GPIO 46 (LOG)',
    category: 'strapping',
    safetyLevel: 'FORBIDDEN',
    description: 'دبوس تحكم بسجلات الإقلاع الداخلية (Boot Strapping).',
    pullup: false,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'التحكم باللوج فقط (اتركه عائماً)',
    bootBehavior: 'يحدد طباعة الـ Boot Logs.',
    hardwareNote: '⚠️ تجنب ربطه بريليهات أو مفاتيح.',
    colorType: 'forbidden'
  },
  {
    pin: 47,
    name: 'GPIO 47',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام عالي الاستقرار (SPICLK_P).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخرج ريليه 8 (Relay 8)',
    bootBehavior: 'مستقر ولا يتعارض مع الإقلاع.',
    hardwareNote: 'آمن لقيادة الريليهات عبر ULN2803.',
    headerSide: 'right',
    targetComponent: 'Relay 8 (مخرج 8)',
    colorType: 'relay'
  },
  {
    pin: 48,
    name: 'GPIO 48',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (SPICLK_N).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخرج ريليه 7 (Relay 7)',
    bootBehavior: 'مستقر في وضع الخرج.',
    hardwareNote: 'خيار قياسي لقيادة مخرج الريليه 7.',
    headerSide: 'right',
    targetComponent: 'Relay 7 (مخرج 7)',
    colorType: 'relay'
  }
];

// ----------------------------------------------------
// 2. بيانات منافذ ESP32 Classic (WROOM-32) - 30 Pins
// ----------------------------------------------------
const ESP32_CLASSIC_PINS_DATA: GpioPinInfo[] = [
  {
    pin: 0,
    name: 'GPIO 0',
    category: 'strapping',
    safetyLevel: 'WARNING',
    description: 'منفذ زر الإقلاع والبرمجة (Boot Strapping Pin). يجب أن يكون HIGH أثناء الإقلاع الطبيعي.',
    pullup: true,
    adc: 'ADC2_CH1',
    touch: true,
    dac: false,
    bestFor: 'زر الـ BOOT اليدوي / إدخال حساس مع الحذر',
    bootBehavior: 'إذا سُحب للـ GND أثناء الإقلاع يدخل وضع البرمجة (Flash Mode).',
    hardwareNote: 'تجنب ربطه بريليهات Active-LOW حتى لا تمنع الشريحة من الإقلاع.',
    colorType: 'forbidden'
  },
  {
    pin: 2,
    name: 'GPIO 2',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ متعدد الاستخدام ومربوط بالليد الأزرق المدمج (Onboard LED).',
    pullup: true,
    adc: 'ADC2_CH2',
    touch: true,
    dac: false,
    bestFor: 'ريليهات عادية، ليد تنبيه، ومفاتيح جدارية',
    bootBehavior: 'يجب أن يكون LOW أو غير مسحوب بقوة لـ HIGH أثناء البرمجة.',
    hardwareNote: 'آمن جداً بعد إقلاع النظام، ويومض عند بث الـ ESP-NOW.',
    colorType: 'relay'
  },
  {
    pin: 4,
    name: 'GPIO 4',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن 100% بدون أي تداخلات إقلاع.',
    pullup: true,
    adc: 'ADC2_CH0',
    touch: true,
    dac: false,
    bestFor: 'مخارج الريليه الرئيسية (Relay 7) ومفاتيح الحائط',
    bootBehavior: 'مستقر تماماً في وضع High-Z عند الإقلاع.',
    hardwareNote: 'من أفضل وأأمن المنافذ لربط دوائر التحكم المنزلي.',
    colorType: 'relay'
  },
  {
    pin: 5,
    name: 'GPIO 5',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (VSPI CS).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخارج الريليهات (Relay 4) ومفاتيح الإضاءة',
    bootBehavior: 'يرسل نبضة خفيفة أثناء الإقلاع.',
    hardwareNote: 'آمن وقياسي في جميع لوحات MOSA.',
    colorType: 'relay'
  },
  {
    pin: 12,
    name: 'GPIO 12',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام ممتاز لمخارج الريليه (MTDI).',
    pullup: true,
    adc: 'ADC2_CH5',
    touch: true,
    dac: false,
    bestFor: 'ريليهات الإضاءة والمفاتيح الجدارية',
    bootBehavior: 'يجب ألا يُسحب لـ HIGH أثناء الإقلاع إذا تم تفعيل فلاش 1.8V.',
    hardwareNote: 'آمن جداً مع ريليهات العزل الضوئي القياسية.',
    colorType: 'relay'
  },
  {
    pin: 13,
    name: 'GPIO 13',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ آمن 100% ومتوافق تماماً مع جميع أنواع الأحمال.',
    pullup: true,
    adc: 'ADC2_CH4',
    touch: true,
    dac: false,
    bestFor: 'مخارج الريليه، حساسات الحركة PIR، ومفاتيح الجدار',
    bootBehavior: 'مستقر ولا يؤثر على وضع الإقلاع.',
    hardwareNote: 'الخيار الأول الموصى به لمخارج الريليه 2.',
    colorType: 'relay'
  },
  {
    pin: 14,
    name: 'GPIO 14',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عالي الاستقرار لمخارج الريليهات.',
    pullup: true,
    adc: 'ADC2_CH6',
    touch: true,
    dac: false,
    bestFor: 'مخارج الريليه 3، مفاتيح الجدار، والسخانات',
    bootBehavior: 'يرسل نبضات خفيفة جداً أثناء البوت ثم يستقر.',
    hardwareNote: 'مناسب جداً للربط مع مفاتيح الإضاءة السريعة.',
    colorType: 'relay'
  },
  {
    pin: 15,
    name: 'GPIO 15',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام (MTDO).',
    pullup: true,
    adc: 'ADC2_CH3',
    touch: true,
    dac: false,
    bestFor: 'مخارج الريليه 8، الإضاءة، والمفاتيح',
    bootBehavior: 'يجب أن يكون HIGH عند البوت لطباعة سجلات الإقلاع.',
    hardwareNote: 'آمن ومناسب لجميع لوحات التوزيع.',
    colorType: 'relay'
  },
  {
    pin: 16,
    name: 'GPIO 16',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ عام خالي تماماً من قيود الإقلاع (UART2 RX).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'حساس الحرارة والرطوبة DHT22 / مخارج الريليه 6',
    bootBehavior: 'مستقر تماماً في جميع الأوقات.',
    hardwareNote: 'المنفذ المعتمد في المنصة لحساسات المناخ والحرارة.',
    colorType: 'relay'
  },
  {
    pin: 17,
    name: 'GPIO 17',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ عام آمن ومستقر 100% (UART2 TX).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخارج الريليه 5، الستائر الذكية، ومضخات الري',
    bootBehavior: 'مستقر وخالي من أي ضجيج كهربائي عند الإقلاع.',
    hardwareNote: 'خيار مثالي للأحمال الحساسة مثل المكيفات والستائر.',
    colorType: 'relay'
  },
  {
    pin: 18,
    name: 'GPIO 18',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ SPI Clock آمن للاستخدام العام.',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخارج الريليه 3، الصمامات، والمفاتيح الجدارية',
    bootBehavior: 'مستقر في وضع High-Z.',
    hardwareNote: 'آمن للتحكم بالأحمال المختلفة.',
    colorType: 'relay'
  },
  {
    pin: 19,
    name: 'GPIO 19',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام ممتاز (VSPI MISO).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخارج الريليه 2 والمفاتيح',
    bootBehavior: 'مستقر ولا يسبب تذبذباً أثناء التشغيل.',
    hardwareNote: 'خيار ممتاز لمخارج الإنارة المباشرة.',
    colorType: 'relay'
  },
  {
    pin: 21,
    name: 'GPIO 21 (SDA)',
    category: 'protocol',
    safetyLevel: 'SAFE',
    description: 'المنفذ القياسي لخط بيانات الـ I2C (SDA).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'شاشات OLED SSD1306، ساعة DS3231 RTC، وموسعات MCP23017',
    bootBehavior: 'مستقر ومثالي لبروتوكول I2C.',
    hardwareNote: 'يحتاج مقاومة سحب 4.7kΩ إذا لم تكن مدمجة بالوحدة.',
    colorType: 'screen'
  },
  {
    pin: 22,
    name: 'GPIO 22 (SCL)',
    category: 'protocol',
    safetyLevel: 'SAFE',
    description: 'المنفذ القياسي لخط ساعة الـ I2C (SCL).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'شاشات OLED، وساعة التوقيت، وحساسات I2C',
    bootBehavior: 'مستقر ومثالي لبروتوكول I2C.',
    hardwareNote: 'مشترك لجميع أجهزة الـ I2C على نفس الناقل.',
    colorType: 'screen'
  },
  {
    pin: 23,
    name: 'GPIO 23',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام آمن ومستقر (VSPI MOSI).',
    pullup: true,
    adc: null,
    touch: false,
    dac: false,
    bestFor: 'مخارج الريليه 1 والمفاتيح',
    bootBehavior: 'مستقر تماماً في وضع High-Z.',
    hardwareNote: 'الخيار الموصى به لمخرج الريليه 1 في المخطط المتوازي.',
    colorType: 'relay'
  },
  {
    pin: 25,
    name: 'GPIO 25',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ متعدد الاستخدام يحتوي على محول تماثلي رقمي مدمج (DAC1).',
    pullup: true,
    adc: 'ADC2_CH8',
    touch: false,
    dac: true,
    bestFor: 'مفتاح جداري 5 أو مخرج صوت',
    bootBehavior: 'مستقر وخالٍ من النبضات العشوائية.',
    hardwareNote: 'مناسب أيضاً لإنشاء إشارات صوتية نقية.',
    colorType: 'switch'
  },
  {
    pin: 26,
    name: 'GPIO 26',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام مع محول صوتي (DAC2).',
    pullup: true,
    adc: 'ADC2_CH9',
    touch: false,
    dac: true,
    bestFor: 'مفتاح جداري 6 أو مخرج صوت',
    bootBehavior: 'مستقر تماماً.',
    hardwareNote: 'آمن ومناسب لجميع لوحات التوزيع.',
    colorType: 'switch'
  },
  {
    pin: 27,
    name: 'GPIO 27',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام ممتاز (Touch 7).',
    pullup: true,
    adc: 'ADC2_CH7',
    touch: true,
    dac: false,
    bestFor: 'حساس الحرارة والرطوبة DHT22',
    bootBehavior: 'مستقر بدون أي تذبذب.',
    hardwareNote: 'آمن لجميع الاستخدامات المنزلية.',
    colorType: 'sensor'
  },
  {
    pin: 32,
    name: 'GPIO 32',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ متعدد الاستخدام من مجموعة ADC1 (Touch 9).',
    pullup: true,
    adc: 'ADC1_CH4',
    touch: true,
    dac: false,
    bestFor: 'مفتاح جداري 3',
    bootBehavior: 'مستقر ويعمل حتى مع تشغيل الواي فاي.',
    hardwareNote: 'من أفضل المنافذ للمستشعرات والمخارج معاً.',
    colorType: 'switch'
  },
  {
    pin: 33,
    name: 'GPIO 33',
    category: 'safe_out',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال وإخراج عام من مجموعة ADC1 (Touch 8).',
    pullup: true,
    adc: 'ADC1_CH5',
    touch: true,
    dac: false,
    bestFor: 'مفتاح جداري 4',
    bootBehavior: 'مستقر وآمن تماماً عند الإقلاع.',
    hardwareNote: 'مناسب لدوائر التحكم الحساسة.',
    colorType: 'switch'
  },
  {
    pin: 34,
    name: 'GPIO 34',
    category: 'input_only',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال فقط (Input-Only) من مجموعة ADC1.',
    pullup: false,
    adc: 'ADC1_CH6',
    touch: false,
    dac: false,
    bestFor: 'مفتاح جداري 1 (مع مقاومة خارجية 10k)',
    bootBehavior: 'إدخال فقط، لا يؤثر على وضع البوت.',
    hardwareNote: '⚠️ لا يحتوي مقاومة سحب داخلية، يجب إضافة مقاومة 10k خارجية.',
    colorType: 'switch'
  },
  {
    pin: 35,
    name: 'GPIO 35',
    category: 'input_only',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال فقط (Input-Only) من مجموعة ADC1.',
    pullup: false,
    adc: 'ADC1_CH7',
    touch: false,
    dac: false,
    bestFor: 'مفتاح جداري 2 (مع مقاومة خارجية 10k)',
    bootBehavior: 'إدخال فقط.',
    hardwareNote: '⚠️ لا يحتوي Pull-up داخلي، يحتاج مقاومة خارجية.',
    colorType: 'switch'
  },
  {
    pin: 36,
    name: 'GPIO 36 (VP)',
    category: 'input_only',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال تماثلي فائق الدقة (Sensor VP).',
    pullup: false,
    adc: 'ADC1_CH0',
    touch: false,
    dac: false,
    bestFor: 'حساس قياس التيار والواط ACS712',
    bootBehavior: 'إدخال تماثلي فائق الحساسية.',
    hardwareNote: '⚠️ إدخال فقط بدون مقاومات سحب داخلية.',
    colorType: 'sensor'
  },
  {
    pin: 39,
    name: 'GPIO 39 (VN)',
    category: 'input_only',
    safetyLevel: 'SAFE',
    description: 'منفذ إدخال تماثلي دقيق (Sensor VN).',
    pullup: false,
    adc: 'ADC1_CH3',
    touch: false,
    dac: false,
    bestFor: 'حساس كاشف الحركة PIR',
    bootBehavior: 'إدخال فقط.',
    hardwareNote: '⚠️ إدخال فقط بدون مقاومات سحب داخلية.',
    colorType: 'sensor'
  }
];

// Physical Row Mappings for Visual ESP32-S3 Board Layout
const ESP32_S3_LEFT_HEADER = [
  { pinLabel: '3V3', functionLabel: 'تغذية 3.3V', type: 'power', gpio: null },
  { pinLabel: '3V3', functionLabel: 'تغذية 3.3V', type: 'power', gpio: null },
  { pinLabel: 'RST', functionLabel: 'زر ريسيت (Reset)', type: 'power', gpio: null },
  { pinLabel: 'GPIO 4', functionLabel: 'مفتاح حائط 1 (SW1)', type: 'switch', gpio: 4 },
  { pinLabel: 'GPIO 5', functionLabel: 'مفتاح حائط 2 (SW2)', type: 'switch', gpio: 5 },
  { pinLabel: 'GPIO 6', functionLabel: 'مفتاح حائط 3 (SW3)', type: 'switch', gpio: 6 },
  { pinLabel: 'GPIO 7', functionLabel: 'مفتاح حائط 4 (SW4)', type: 'switch', gpio: 7 },
  { pinLabel: 'GPIO 15', functionLabel: 'مفتاح حائط 5 (SW5)', type: 'switch', gpio: 15 },
  { pinLabel: 'GPIO 16', functionLabel: 'مفتاح حائط 6 (SW6)', type: 'switch', gpio: 16 },
  { pinLabel: 'GPIO 17', functionLabel: 'مفتاح حائط 7 (SW7)', type: 'switch', gpio: 17 },
  { pinLabel: 'GPIO 18', functionLabel: 'مفتاح حائط 8 (SW8)', type: 'switch', gpio: 18 },
  { pinLabel: 'GPIO 8', functionLabel: 'حساس حرارة DHT22', type: 'sensor', gpio: 8 },
  { pinLabel: 'GPIO 9', functionLabel: 'حساس حركة PIR', type: 'sensor', gpio: 9 },
  { pinLabel: 'GPIO 10', functionLabel: 'حساس تيار ACS712 (ADC1)', type: 'sensor', gpio: 10 },
  { pinLabel: 'GPIO 11', functionLabel: 'I2S Mic (SCK/BCLK)', type: 'audio', gpio: 11 },
  { pinLabel: 'GPIO 12', functionLabel: 'I2S Mic (WS/LRCK)', type: 'audio', gpio: 12 },
  { pinLabel: 'GPIO 13', functionLabel: 'I2S Mic (SD Data)', type: 'audio', gpio: 13 },
  { pinLabel: 'GPIO 14', functionLabel: 'Buzzer (جرس الإنذار)', type: 'relay', gpio: 14 },
  { pinLabel: 'GND', functionLabel: 'أرضي مشترك (GND)', type: 'power', gpio: null },
  { pinLabel: 'GND', functionLabel: 'أرضي مشترك (GND)', type: 'power', gpio: null },
  { pinLabel: '5Vin', functionLabel: 'دخل 5V منظم (5Vin / VBUS)', type: 'power', gpio: null },
  { pinLabel: 'GND', functionLabel: 'أرضي مشترك (GND)', type: 'power', gpio: null },
];

const ESP32_S3_RIGHT_HEADER = [
  { pinLabel: 'GND', functionLabel: 'أرضي عام (GND)', type: 'power', gpio: null },
  { pinLabel: 'GND', functionLabel: 'أرضي عام (GND)', type: 'power', gpio: null },
  { pinLabel: '5Vin', functionLabel: 'دخل تغذية 5V', type: 'power', gpio: null },
  { pinLabel: 'TX 43', functionLabel: 'سيريال Serial TX', type: 'serial', gpio: 43 },
  { pinLabel: 'RX 44', functionLabel: 'سيريال Serial RX', type: 'serial', gpio: 44 },
  { pinLabel: 'GPIO 1', functionLabel: 'Relay 1 (مخرج 1)', type: 'relay', gpio: 1 },
  { pinLabel: 'GPIO 2', functionLabel: 'Relay 2 (مخرج 2)', type: 'relay', gpio: 2 },
  { pinLabel: 'GPIO 42', functionLabel: 'Relay 3 (مخرج 3)', type: 'relay', gpio: 42 },
  { pinLabel: 'GPIO 41', functionLabel: 'Relay 4 (مخرج 4)', type: 'relay', gpio: 41 },
  { pinLabel: 'GPIO 40', functionLabel: 'Relay 5 (مخرج 5)', type: 'relay', gpio: 40 },
  { pinLabel: 'GPIO 39', functionLabel: 'Relay 6 (مخرج 6)', type: 'relay', gpio: 39 },
  { pinLabel: 'GPIO 48', functionLabel: 'Relay 7 (مخرج 7)', type: 'relay', gpio: 48 },
  { pinLabel: 'GPIO 47', functionLabel: 'Relay 8 (مخرج 8)', type: 'relay', gpio: 47 },
  { pinLabel: 'GPIO 21', functionLabel: 'I2C SDA (شاشة OLED)', type: 'screen', gpio: 21 },
  { pinLabel: 'GPIO 38', functionLabel: 'I2C SCL (شاشة OLED)', type: 'screen', gpio: 38 },
  { pinLabel: 'GPIO 37', functionLabel: 'محجوز (PSRAM D7 - NC)', type: 'forbidden', gpio: 37 },
  { pinLabel: 'GPIO 36', functionLabel: 'محجوز (PSRAM D6 - NC)', type: 'forbidden', gpio: 36 },
  { pinLabel: 'GPIO 35', functionLabel: 'محجوز (PSRAM D5 - NC)', type: 'forbidden', gpio: 35 },
  { pinLabel: 'GPIO 34', functionLabel: 'محجوز (PSRAM D4 - NC)', type: 'forbidden', gpio: 34 },
  { pinLabel: 'GPIO 33', functionLabel: 'محجوز (PSRAM DQS - NC)', type: 'forbidden', gpio: 33 },
  { pinLabel: 'GPIO 0', functionLabel: 'إقلاع (Boot Strapping - NC)', type: 'forbidden', gpio: 0 },
  { pinLabel: 'GND', functionLabel: 'أرضي عام (GND)', type: 'power', gpio: null },
];

export default function PinoutGuidePage() {
  const [selectedChip, setSelectedChip] = useState<'ESP32_S3' | 'ESP32_CLASSIC'>('ESP32_S3');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePin, setActivePin] = useState<GpioPinInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual_board' | 'matrix' | 'pcb_guide' | 'kicad_nets'>('visual_board');

  const pinsData = selectedChip === 'ESP32_S3' ? ESP32_S3_PINS_DATA : ESP32_CLASSIC_PINS_DATA;

  const filteredPins = pinsData.filter(p => {
    const matchesCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.bestFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(p.pin).includes(searchQuery);
    return matchesCat && matchesSearch;
  });

  const safeCount = pinsData.filter(p => p.safetyLevel === 'SAFE' && p.category === 'safe_out').length;
  const inputOnlyCount = pinsData.filter(p => p.category === 'input_only').length;
  const forbiddenCount = pinsData.filter(p => p.safetyLevel === 'FORBIDDEN').length;
  const protocolCount = pinsData.filter(p => p.category === 'protocol').length;

  const currentActivePin = activePin || filteredPins[0] || pinsData[0];

  const handleCopyWiring = () => {
    const text = selectedChip === 'ESP32_S3' 
      ? `=== MOSA ESP32-S3 (N16R8) PINOUT MAPPING (CRASH-FREE) ===
Outputs & Relays (Right Header):
- Relay 1: GPIO 1
- Relay 2: GPIO 2
- Relay 3: GPIO 42
- Relay 4: GPIO 41
- Relay 5: GPIO 40
- Relay 6: GPIO 47
- Relay 7: GPIO 48
- Relay 8: GPIO 21
- Buzzer: GPIO 14
- OLED Screen (I2C): SDA=GPIO 21, SCL=GPIO 13 (or GPIO 14)

Inputs & Sensors (Left Header):
- Wall Switches (1..8): GPIO 4, 5, 6, 7, 15, 16, 17, 18
- DHT22 Temp/Hum: GPIO 8
- PIR Motion: GPIO 9
- ACS712 Current/Watt (ADC1): GPIO 10
- INMP441 I2S Mic: SCK=GPIO 11, WS=GPIO 12, SD=GPIO 13

FORBIDDEN PINS (PSRAM Collision - NEVER TOUCH):
- GPIO 33, 34, 35, 36, 37, 38`
      : `=== MOSA ESP32 Classic (WROOM-32) PINOUT ===
Relays (1..8): GPIO 23, 19, 18, 5, 17, 16, 4, 15
Buzzer: GPIO 2
OLED Screen (I2C): SDA=GPIO 21, SCL=GPIO 22
Sensors: DHT22=GPIO 27, PIR=GPIO 39(VN), ACS712=GPIO 36(VP)
Wall Switches (1..6): GPIO 34, 35, 32, 33, 25, 26`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPinColorBadge = (type?: string) => {
    switch(type) {
      case 'relay': return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'switch': return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'sensor': return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'audio': return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'screen': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
      case 'serial': return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
      case 'power': return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
      case 'forbidden': return 'bg-red-500/20 text-red-300 border-red-500/40';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 p-4 sm:p-6 md:p-8 space-y-6" dir="rtl">
      
      {/* 🌟 Header Section with Chip Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2.5 text-xs text-cyan-400 font-bold mb-1.5 bg-cyan-950/40 border border-cyan-500/30 px-3 py-1 rounded-full w-fit">
            <Cpu size={14} className="animate-spin" />
            <span>الدليل الهندسي الشامل لمتحكمات ESP32 و ESP32-S3</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-3">
            مخطط المنافذ والتوصيل الآمن <span className="text-cyan-400 text-lg font-mono">({selectedChip === 'ESP32_S3' ? 'ESP32-S3 N16R8' : 'ESP32 WROOM-32'})</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-3xl leading-relaxed">
            مرجعك الهندسي التفاعلي المعتمد لمعرفة المنافذ الآمنة للريليهات والمفاتيح، والمنافذ المحظورة الخاصة بالـ PSRAM والإقلاع لضمان استقرار شبكة MOSA Smart ومنع أي Crash.
          </p>
        </div>

        {/* 🎛️ Chipset Selector Toggle */}
        <div className="flex items-center gap-2 bg-slate-900/90 border border-white/10 p-1.5 rounded-2xl shadow-xl shrink-0">
          <button
            onClick={() => { setSelectedChip('ESP32_S3'); setActivePin(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              selectedChip === 'ESP32_S3'
                ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Sparkles size={14} />
            <span>ESP32-S3 (N16R8)</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md">44 Pin</span>
          </button>

          <button
            onClick={() => { setSelectedChip('ESP32_CLASSIC'); setActivePin(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              selectedChip === 'ESP32_CLASSIC'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Cpu size={14} />
            <span>ESP32 Classic</span>
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-md">30/38 Pin</span>
          </button>
        </div>
      </div>

      {/* 📊 Summary Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-emerald-400 font-bold">منافذ آمنة للمخارج والريليهات</div>
            <div className="text-2xl font-black text-white mt-0.5">{safeCount} <span className="text-xs text-slate-400">منفذ</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={20} />
          </div>
        </div>

        <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-amber-400 font-bold">بروتوكولات (I2C / I2S صوت)</div>
            <div className="text-2xl font-black text-white mt-0.5">{protocolCount} <span className="text-xs text-slate-400">منافذ</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400">
            <Radio size={20} />
          </div>
        </div>

        <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-blue-400 font-bold">مداخل حساسات وسويتشات</div>
            <div className="text-2xl font-black text-white mt-0.5">{selectedChip === 'ESP32_S3' ? 8 : inputOnlyCount} <span className="text-xs text-slate-400">مداخل</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <Sliders size={20} />
          </div>
        </div>

        <div className="bg-red-950/30 border border-red-500/30 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-red-400 font-bold">منافذ محظورة (تسبب Crash)</div>
            <div className="text-2xl font-black text-white mt-0.5">{forbiddenCount} <span className="text-xs text-slate-400">منفذ</span></div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-400">
            <XCircle size={20} />
          </div>
        </div>
      </div>

      {/* 🔀 Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/[0.03] border border-white/10 p-2 rounded-2xl">
        <div className="flex items-center flex-wrap gap-1.5">
          <button
            onClick={() => setActiveTab('visual_board')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'visual_board' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutGrid size={14} />
            <span>المخطط البصري للشريحة (Visual Board View)</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'matrix' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={14} />
            <span>المصفوفة التفاعلية الفاحصة (Pin Inspector)</span>
          </button>

          <button
            onClick={() => setActiveTab('pcb_guide')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'pcb_guide' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor size={14} />
            <span>مخطط بوردة الـ PCB والروزتات (KiCad Ready)</span>
          </button>
        </div>

        <button
          onClick={handleCopyWiring}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition border border-white/10"
        >
          {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          <span>{copied ? 'تم نسخ التوصيلات!' : 'نسخ جدول التوصيل للـ PCB'}</span>
        </button>
      </div>

      {/* 🌟 TAB 1: VISUAL BOARD VIEW (Graphic representation like ASCII chart) */}
      {activeTab === 'visual_board' && (
        <div className="space-y-6">
          {/* Main Board Visual Card */}
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-white/10 pb-4 mb-6 gap-4">
              <div>
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest">
                  {selectedChip === 'ESP32_S3' ? 'ESP32-S3 Dual Type-C N16R8 (16MB Flash + 8MB Octal PSRAM)' : 'ESP32 Classic NodeMCU / DevKit V1'}
                </span>
                <h2 className="text-2xl font-black text-white mt-1">
                  المخطط الهندسي للبوردة وتوزيع الأطراف الحقيقية (Crash-Free Pinout)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  انقر على أي منفذ لعرض تفاصيله التقنية وحالة الحماية ومقاومات السحب
                </p>
              </div>

              {/* Color Legends */}
              <div className="flex flex-wrap gap-2 text-[10px] font-bold">
                <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> مخارج ريليه
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> مفاتيح جدارية
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> مستشعرات
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400" /> مايك I2S
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> شاشة I2C
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/30 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> محظورة (PSRAM)
                </span>
              </div>
            </div>

            {selectedChip === 'ESP32_S3' ? (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* 🔌 Left Header Column (Inputs & Sensors) */}
                <div className="lg:col-span-4 space-y-1.5">
                  <div className="text-center font-bold text-xs text-blue-400 bg-blue-950/40 border border-blue-500/30 py-2 rounded-xl mb-3">
                    ◄ الجانب الأيسر (المفاتيح والمستشعرات والمايك)
                  </div>
                  {ESP32_S3_LEFT_HEADER.map((item, idx) => {
                    const matchedPin = item.gpio !== null ? pinsData.find(p => p.pin === item.gpio) : null;
                    const isSelected = matchedPin && currentActivePin.pin === matchedPin.pin;

                    return (
                      <div
                        key={idx}
                        onClick={() => matchedPin && setActivePin(matchedPin)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg'
                            : 'bg-black/40 hover:bg-slate-800/60 border-white/5'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-mono font-black text-slate-200">
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-[10px] flex items-center justify-center text-slate-400 font-mono">
                            {idx + 1}
                          </span>
                          <span>{item.pinLabel}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getPinColorBadge(item.type)}`}>
                          {item.functionLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* 🔲 Microcontroller Graphic Mockup (Center 4 Cols) */}
                <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-950 border-2 border-cyan-500/40 rounded-3xl shadow-2xl relative">
                  <div className="w-full flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                    <div className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-bold">
                      [ Type-C USB ]
                    </div>
                    <div className="px-3 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-400 font-bold">
                      [ Type-C UART ]
                    </div>
                  </div>

                  <div className="w-32 h-40 bg-gradient-to-b from-slate-900 to-black border border-cyan-500/50 rounded-2xl flex flex-col items-center justify-center p-3 shadow-inner text-center space-y-2 relative">
                    <div className="absolute top-2 w-16 h-1 bg-amber-500/40 rounded-full" />
                    <Cpu size={32} className="text-cyan-400 animate-pulse mt-2" />
                    <span className="text-xs font-black text-white font-mono">ESP32-S3</span>
                    <span className="text-[9px] text-cyan-400 font-bold">N16R8 16MB/8MB</span>
                    <span className="text-[8px] text-emerald-400 font-mono">240MHz Dual-Core</span>
                  </div>

                  <div className="mt-6 text-center space-y-2">
                    <div className="text-[11px] font-black text-slate-300">
                      ⚡ نظام التحمل العالي بدون كراش
                    </div>
                    <p className="text-[10px] text-slate-400 max-w-[220px] leading-relaxed">
                      تم استبعاد GPIO 33..38 بالكامل لمنع أي تعارض مع خطوط نقل الـ Octal PSRAM.
                    </p>
                  </div>

                  <div className="w-full mt-6 pt-4 border-t border-white/10 flex justify-between text-[10px] font-mono text-slate-500">
                    <span>LEFT: INPUTS</span>
                    <span>RIGHT: OUTPUTS</span>
                  </div>
                </div>

                {/* 💡 Right Header Column (Outputs & Relays) */}
                <div className="lg:col-span-4 space-y-1.5">
                  <div className="text-center font-bold text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 py-2 rounded-xl mb-3">
                    الجانب الأيمن (مخارج الريليهات والشاشة والبازر) ►
                  </div>
                  {ESP32_S3_RIGHT_HEADER.map((item, idx) => {
                    const matchedPin = item.gpio !== null ? pinsData.find(p => p.pin === item.gpio) : null;
                    const isSelected = matchedPin && currentActivePin.pin === matchedPin.pin;

                    return (
                      <div
                        key={idx}
                        onClick={() => matchedPin && setActivePin(matchedPin)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/80 border-cyan-400 ring-2 ring-cyan-400/40 shadow-lg'
                            : 'bg-black/40 hover:bg-slate-800/60 border-white/5'
                        }`}
                      >
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${getPinColorBadge(item.type)}`}>
                          {item.functionLabel}
                        </span>
                        <div className="flex items-center gap-2 font-mono font-black text-slate-200">
                          <span>{item.pinLabel}</span>
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-[10px] flex items-center justify-center text-slate-400 font-mono">
                            {idx + 1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Classic ESP32 View */
              <div className="p-6 bg-black/40 border border-white/10 rounded-2xl text-center space-y-4">
                <h3 className="text-lg font-bold text-cyan-400">مخطط ESP32 Classic (WROOM-32) 30-Pin</h3>
                <p className="text-xs text-slate-400">
                  المخطط الكلاسيكي القياسي المعتمد مع 8 مخارج ريليه ومداخل تناظرية ورقمية كاملة.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-right">
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-2">
                    <div className="font-bold text-emerald-400 text-sm border-b border-emerald-500/20 pb-1">مخارج الريليهات (Relays 1..8):</div>
                    <div>Relay 1: GPIO 23 | Relay 2: GPIO 19</div>
                    <div>Relay 3: GPIO 18 | Relay 4: GPIO 5</div>
                    <div>Relay 5: GPIO 17 | Relay 6: GPIO 16</div>
                    <div>Relay 7: GPIO 4  | Relay 8: GPIO 15</div>
                  </div>
                  <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 space-y-2">
                    <div className="font-bold text-blue-400 text-sm border-b border-blue-500/20 pb-1">المستشعرات والمفاتيح (Sensors & Switches):</div>
                    <div>DHT22: GPIO 27 | Buzzer: GPIO 2</div>
                    <div>ACS712: GPIO 36 (VP) | PIR: GPIO 39 (VN)</div>
                    <div>OLED I2C: SDA=21, SCL=22</div>
                    <div>Switches (1..6): GPIO 34, 35, 32, 33, 25, 26</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📋 TAB 2: INTERACTIVE PIN INSPECTOR MATRIX */}
      {activeTab === 'matrix' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Inspector Panel (5 Cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-3xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div>
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">فاحص المنفذ الحي (PIN INSPECTOR)</span>
                  <h2 className="text-2xl font-black text-white mt-0.5 flex items-center gap-2">
                    {currentActivePin.name}
                  </h2>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  currentActivePin.safetyLevel === 'SAFE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                  currentActivePin.safetyLevel === 'WARNING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                  'bg-red-500/10 text-red-400 border-red-500/30'
                }`}>
                  {currentActivePin.safetyLevel === 'SAFE' ? 'آمن وموصى به' :
                   currentActivePin.safetyLevel === 'WARNING' ? 'تحذير / مشروط' : 'محظور استخدامه'}
                </span>
              </div>

              {/* Pin Details */}
              <div className="space-y-4 text-xs">
                <div className="bg-white/[0.02] border border-white/5 p-3.5 rounded-2xl space-y-1">
                  <span className="text-slate-400 text-[11px] font-bold">الوصف والوظيفة:</span>
                  <p className="text-slate-200 leading-relaxed font-medium">{currentActivePin.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">السحب الداخلي (Pull-Up):</span>
                    <span className="font-bold text-white mt-0.5 block">
                      {currentActivePin.pullup ? 'يدعم INPUT_PULLUP ✅' : 'لا يدعم (يحتاج مقاومة خارجية) ⚠️'}
                    </span>
                  </div>
                  <div className="bg-white/[0.02] border border-white/5 p-3 rounded-xl">
                    <span className="text-slate-400 text-[10px] block">المنفذ التماثلي (ADC):</span>
                    <span className="font-bold text-white mt-0.5 block font-mono">
                      {currentActivePin.adc || 'رقمي فقط (Digital)'}
                    </span>
                  </div>
                </div>

                <div className="bg-emerald-500/5 border border-emerald-500/20 p-3.5 rounded-2xl">
                  <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1.5 mb-1">
                    <Zap size={14} />
                    الاستخدام الأفضل (Recommended):
                  </span>
                  <p className="text-slate-200 font-bold">{currentActivePin.bestFor}</p>
                </div>

                <div className="bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-2xl">
                  <span className="text-amber-400 text-[11px] font-bold flex items-center gap-1.5 mb-1">
                    <AlertTriangle size={14} />
                    حالة المنفذ أثناء الإقلاع (Boot State):
                  </span>
                  <p className="text-slate-300">{currentActivePin.bootBehavior}</p>
                </div>

                <div className="bg-slate-950/60 border border-white/10 p-3.5 rounded-2xl">
                  <span className="text-cyan-400 text-[11px] font-bold flex items-center gap-1.5 mb-1">
                    <Info size={14} />
                    ملاحظة هندسية وتدابير:
                  </span>
                  <p className="text-slate-300 leading-relaxed">{currentActivePin.hardwareNote}</p>
                </div>
              </div>
            </div>

            {/* Warning Alert for PSRAM */}
            {selectedChip === 'ESP32_S3' && (
              <div className="bg-red-950/40 border border-red-500/40 rounded-3xl p-5 text-xs text-red-200 leading-relaxed shadow-xl space-y-2">
                <div className="flex items-center gap-2 font-black text-red-400 text-sm">
                  <ShieldAlert size={18} />
                  <span>تنبيه خطير جداً لشريحة ESP32-S3 (N16R8):</span>
                </div>
                <p>
                  الدبابيس <b>GPIO 33 إلى GPIO 38</b> متصلة داخلياً بذاكرة الـ <b>8MB Octal PSRAM</b>. محاولة ربطها بأي سلك أو ريليه ستؤدي إلى تجميد المعالج الفوري (Kernel Crash).
                </p>
              </div>
            )}
          </div>

          {/* Right Pins Grid Area (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* Search and Filters */}
            <div className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 space-y-3 shadow-xl">
              <div className="relative">
                <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث برقم المنفذ (مثلاً 14 أو 21) أو اسمه أو وظيفته..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: `الكل (${pinsData.length} منفذ)` },
                  { id: 'safe_out', label: 'مخارج ريليه آمنة' },
                  { id: 'protocol', label: 'شاشة ومايك (I2C/I2S)' },
                  { id: 'input_only', label: 'مداخل فقط (Sensors)' },
                  { id: 'strapping', label: 'إقلاع (Boot)' },
                  { id: 'forbidden', label: 'محظورة (Flash/PSRAM)' }
                ].map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      selectedCategory === cat.id
                        ? 'bg-cyan-500 text-black shadow-md shadow-cyan-500/20'
                        : 'bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Pins Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[750px] overflow-y-auto p-1 custom-scrollbar">
              {filteredPins.map(pin => {
                const isCurrent = currentActivePin.pin === pin.pin;
                const isSafe = pin.safetyLevel === 'SAFE';
                const isWarn = pin.safetyLevel === 'WARNING';

                return (
                  <div
                    key={pin.pin}
                    onClick={() => setActivePin(pin)}
                    className={`cursor-pointer rounded-2xl p-4 transition-all duration-200 border text-right relative overflow-hidden ${
                      isCurrent
                        ? 'bg-cyan-950/60 border-cyan-400 ring-2 ring-cyan-500/40 shadow-xl scale-[1.02]'
                        : isSafe
                        ? 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5 hover:border-emerald-500/40'
                        : isWarn
                        ? 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5 hover:border-amber-500/40'
                        : 'bg-red-950/20 hover:bg-red-950/40 border-red-500/20'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-sm text-white font-mono">{pin.name}</span>
                      <span className={`w-2.5 h-2.5 rounded-full ${
                        isSafe ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' :
                        isWarn ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]' :
                        'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'
                      }`} />
                    </div>

                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed mb-2">
                      {pin.bestFor}
                    </p>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-white/5 pt-2 mt-auto">
                      <span>{pin.adc ? 'Analog ADC' : 'Digital'}</span>
                      <span className={isSafe ? 'text-emerald-400 font-bold' : isWarn ? 'text-amber-400 font-bold' : 'text-red-400 font-bold'}>
                        {isSafe ? 'آمن' : isWarn ? 'مشروط' : 'محظور'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 📐 TAB 3: PCB & KiCad Terminal View */}
      {activeTab === 'pcb_guide' && (
        <div className="bg-slate-900/90 border border-white/10 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="border-b border-white/10 pb-4">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Monitor className="text-cyan-400" size={22} />
              مخطط توصيل روزتات الـ PCB لـ {selectedChip === 'ESP32_S3' ? 'ESP32-S3 (N16R8)' : 'ESP32 Classic'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">توزيع جغرافي متوازي يمنع تداخل المسارات في KiCad (Zero Crossover Routing)</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Right Side Header (Relays & High Voltage) */}
            <div className="bg-black/40 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-emerald-400 font-bold text-sm border-b border-emerald-500/20 pb-2">
                <span>الجانب الأيمن (مخارج الريليهات والشاشة)</span>
                <span className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded-full font-mono">Right Header</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {selectedChip === 'ESP32_S3' ? (
                  <>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 1</span><span className="text-emerald-400 font-bold">Relay 1 (مخرج إضاءة 1)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 2</span><span className="text-emerald-400 font-bold">Relay 2 (مخرج إضاءة 2)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 42</span><span className="text-emerald-400 font-bold">Relay 3 (مخرج إضاءة 3)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 41</span><span className="text-emerald-400 font-bold">Relay 4 (مخرج إضاءة 4)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 40</span><span className="text-emerald-400 font-bold">Relay 5 (مخرج إضاءة 5)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 47</span><span className="text-emerald-400 font-bold">Relay 6 (مخرج إضاءة 6)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 48</span><span className="text-emerald-400 font-bold">Relay 7 (مخرج إضاءة 7)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 21</span><span className="text-emerald-400 font-bold">Relay 8 (مخرج إضاءة 8)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-amber-950/40 border border-amber-500/30"><span>GPIO 14</span><span className="text-amber-300 font-bold">Buzzer (جرس التنبيه)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30"><span>GPIO 21, 13</span><span className="text-cyan-300 font-bold">I2C (SDA=21, SCL=13)</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 23</span><span className="text-emerald-400 font-bold">Relay 1</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 19</span><span className="text-emerald-400 font-bold">Relay 2</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 18</span><span className="text-emerald-400 font-bold">Relay 3</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 5</span><span className="text-emerald-400 font-bold">Relay 4</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 17</span><span className="text-emerald-400 font-bold">Relay 5</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 16</span><span className="text-emerald-400 font-bold">Relay 6</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 4</span><span className="text-emerald-400 font-bold">Relay 7</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 15</span><span className="text-emerald-400 font-bold">Relay 8</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30"><span>GPIO 21, 22</span><span className="text-cyan-300 font-bold">I2C (SDA, SCL)</span></div>
                  </>
                )}
              </div>
            </div>

            {/* Left Side Header (Switches & Sensors) */}
            <div className="bg-black/40 border border-blue-500/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between text-blue-400 font-bold text-sm border-b border-blue-500/20 pb-2">
                <span>الجانب الأيسر (المفاتيح والمستشعرات والمايك)</span>
                <span className="text-[10px] bg-blue-500/20 px-2 py-0.5 rounded-full font-mono">Left Header</span>
              </div>
              <div className="space-y-2 text-xs font-mono">
                {selectedChip === 'ESP32_S3' ? (
                  <>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 4..7</span><span className="text-blue-300 font-bold">مفاتيح حائط (SW1 .. SW4)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 15..18</span><span className="text-blue-300 font-bold">مفاتيح حائط (SW5 .. SW8)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 8</span><span className="text-amber-300 font-bold">DHT22 (حرارة ورطوبة)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 9</span><span className="text-purple-300 font-bold">PIR (كاشف الحركة)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 10</span><span className="text-yellow-300 font-bold">ACS712 (تيار وواط ADC1)</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30"><span>GPIO 11, 12, 13</span><span className="text-cyan-300 font-bold">INMP441 I2S Mic (SCK, WS, SD)</span></div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 34, 35</span><span className="text-blue-300 font-bold">مفاتيح حائط SW1, SW2</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 32, 33</span><span className="text-blue-300 font-bold">مفاتيح حائط SW3, SW4</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 25, 26</span><span className="text-blue-300 font-bold">مفاتيح حائط SW5, SW6</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 27</span><span className="text-amber-300 font-bold">DHT22</span></div>
                    <div className="flex justify-between p-2 rounded-lg bg-white/[0.02]"><span>GPIO 36, 39</span><span className="text-yellow-300 font-bold">ACS712 (VP) & PIR (VN)</span></div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
