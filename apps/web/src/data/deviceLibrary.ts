// apps/web/src/data/deviceLibrary.ts

export type DeviceCategory = 
  | 'smart_switch'
  | 'smart_socket'
  | 'sensor_node'
  | 'gateway'
  | 'thermostat'
  | 'irrigation'
  | 'security'
  | 'lighting'
  | 'camera'
  | 'custom';

export type FlashMethod = 
  | 'esptool'     // ESP32/ESP8266
  | 'avrdude'     // Arduino
  | 'dfu'         // STM32/Nordic
  | 'jlink'       // Professional
  | 'serial_cmd'; // Custom protocol

export type Protocol = 
  | 'mqtt'
  | 'http'
  | 'zigbee'
  | 'zwave'
  | 'matter'
  | 'ble'
  | 'wifi'
  | 'espnow';

export interface SetupStep {
  id: string;
  title: string;
  type: 'flash' | 'wifi_config' | 'pin_mapping' | 'pin_scan' | 'hardware_test';
}

export interface DeviceTemplate {
  id: string;
  name: string;
  manufacturer: string;
  category: DeviceCategory;
  chipset: string;
  flashMethod: FlashMethod;
  baudRate: number;
  protocol: Protocol[];
  description?: string;
  
  // Flash configuration
  flashConfig: {
    flashMode: 'dio' | 'dout' | 'qio' | 'qout';
    flashFreq: '40m' | '80m';
    flashSize: '512KB' | '1MB' | '2MB' | '4MB' | '8MB' | '16MB' | '32KB';
    resetMethod: 'nodemcu' | 'ck' | 'wifio' | 'dtr';
  };
  
  // Pin mapping
  defaultPins: {
    relay?: number[];
    dht?: number;
    pir?: number;
    acs712?: number;
    oled_sda?: number;
    oled_scl?: number;
    button?: number[];
    led?: number | number[];
    moisture?: number;
    buzzer?: number;
    tx?: number;
    rx?: number;
  };
  
  // Firmware
  firmwareUrl?: string;
  firmwareVersion?: string;
  
  // Setup wizard
  setupSteps?: SetupStep[];
}

// Complete Device Templates Library
export const DEVICE_LIBRARY: DeviceTemplate[] = [
  
  // ── 1. MOSA Native Devices ──────────────────
  {
    id: 'mosa-node-v3',
    name: 'MOSA Smart Node v3 (Dual Core Enterprise)',
    manufacturer: 'MOSA Systems',
    category: 'smart_switch',
    chipset: 'ESP32-S3',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi', 'ble', 'espnow'],
    description: 'المتحكم الذكي الرسمي لمنظومة MOSA يدعم 4 ريليهات وحساسات حرارة وطاقة مع شبكة Mesh ذاتية',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '80m',
      flashSize: '16MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [2, 4, 5, 18],
      dht: 16,
      pir: 27,
      acs712: 12,
      moisture: 15,
      oled_sda: 21,
      oled_scl: 22,
      button: [5, 13, 14, 19],
      led: 2
    },
    firmwareUrl: '/api/firmware/mosa-node-v3-latest.bin',
    firmwareVersion: '3.0.0',
    setupSteps: [
      { id: 'wifi', title: 'إعداد الشبكة', type: 'wifi_config' },
      { id: 'pins', title: 'تعريف المخارج', type: 'pin_mapping' },
      { id: 'test', title: 'اختبار الأجهزة', type: 'hardware_test' }
    ]
  },

  {
    id: 'mosa-node-r1',
    name: 'MOSA Modular R1 ESP32 (4CH Relay)',
    manufacturer: 'MOSA Systems',
    category: 'smart_switch',
    chipset: 'ESP32-WROOM-32',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi', 'espnow'],
    description: 'شريحة MOSA الكلاسيكية مع دعم كامل لذاكرة NVS وتزامن لحظي مع السيرفر المحلي',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '4MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [2, 4, 5, 18],
      dht: 16,
      acs712: 12,
      moisture: 15,
      button: [5, 13, 14, 19]
    },
    firmwareUrl: '/api/firmware/mosa-r1-modular.bin',
    firmwareVersion: '3.0.0',
    setupSteps: [
      { id: 'wifi', title: 'إعداد الشبكة', type: 'wifi_config' },
      { id: 'pins', title: 'تعريف المخارج', type: 'pin_mapping' },
      { id: 'test', title: 'اختبار الأجهزة', type: 'hardware_test' }
    ]
  },
  
  // ── 2. Sonoff Devices ────────────────────────
  {
    id: 'sonoff-basic-r2',
    name: 'Sonoff Basic R2 / R3',
    manufacturer: 'ITEAD',
    category: 'smart_switch',
    chipset: 'ESP8266',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi'],
    description: 'مفتاح ذكي أحادي القناة شائع الاستخدام للإنارة والأجهزة الصغيرة',
    flashConfig: {
      flashMode: 'dout',
      flashFreq: '40m',
      flashSize: '1MB',
      resetMethod: 'ck'
    },
    defaultPins: {
      relay: [12],
      button: [0],
      led: [13]
    },
    setupSteps: [
      { id: 'flash', title: 'Flash Tasmota/MOSA', type: 'flash' },
      { id: 'wifi', title: 'WiFi Setup', type: 'wifi_config' }
    ]
  },
  
  {
    id: 'sonoff-4ch',
    name: 'Sonoff 4CH Pro R3',
    manufacturer: 'ITEAD',
    category: 'smart_switch',
    chipset: 'ESP8285',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi'],
    description: 'لوحة تحكم صناعية 4 قنوات مع مفاتيح مادية ودعم DIN Rail',
    flashConfig: {
      flashMode: 'dout',
      flashFreq: '40m',
      flashSize: '1MB',
      resetMethod: 'ck'
    },
    defaultPins: {
      relay: [12, 5, 4, 15],
      button: [0, 9, 10, 14],
      led: [13]
    }
  },
  
  {
    id: 'sonoff-th16',
    name: 'Sonoff TH10 / TH16 Temperature & Humidity',
    manufacturer: 'ITEAD',
    category: 'thermostat',
    chipset: 'ESP8266',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi'],
    description: 'متحكم حراري ومكيفات مزود بحساس Si7021 / AM2301 / DS18B20',
    flashConfig: {
      flashMode: 'dout',
      flashFreq: '40m',
      flashSize: '1MB',
      resetMethod: 'ck'
    },
    defaultPins: {
      relay: [12],
      dht: 14,
      button: [0],
      led: [13]
    }
  },

  {
    id: 'sonoff-pow-r2',
    name: 'Sonoff POW R2 (Power Monitoring)',
    manufacturer: 'ITEAD',
    category: 'smart_socket',
    chipset: 'ESP8266',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi'],
    description: 'قاطع كهربائي مع قارئ دقيق لاستهلاك الفولتية والأمبير والطاقة بالواط',
    flashConfig: {
      flashMode: 'dout',
      flashFreq: '40m',
      flashSize: '4MB',
      resetMethod: 'dout' as any
    },
    defaultPins: {
      relay: [12],
      button: [0],
      led: [13]
    }
  },
  
  // ── 3. Shelly Devices ────────────────────────
  {
    id: 'shelly-1',
    name: 'Shelly 1 Gen1 / Plus 1',
    manufacturer: 'Allterco Robotics',
    category: 'smart_switch',
    chipset: 'ESP8266 / ESP32',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'http', 'wifi'],
    description: 'ريليه مدمج صغير للغاية يركب خلف مفاتيح الحائط العادية مع مخرج جاف (Dry Contact)',
    flashConfig: {
      flashMode: 'qio',
      flashFreq: '40m',
      flashSize: '2MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [4],
      button: [5]
    }
  },
  
  {
    id: 'shelly-2-5',
    name: 'Shelly 2.5 Dual Switch & Roller Shutter',
    manufacturer: 'Allterco Robotics',
    category: 'smart_switch',
    chipset: 'ESP8266',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'http', 'wifi'],
    description: 'مزدوج القناة للتحكم بالستائر الكهربائية وأبواب الكراجات مع مراقبة استهلاك الطاقة',
    flashConfig: {
      flashMode: 'qio',
      flashFreq: '40m',
      flashSize: '2MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [4, 15],
      button: [5, 14]
    }
  },

  {
    id: 'shelly-plus-rgbw',
    name: 'Shelly Plus RGBW Controller',
    manufacturer: 'Allterco Robotics',
    category: 'lighting',
    chipset: 'ESP32',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'http', 'wifi', 'ble'],
    description: 'متحكم أشرطة الليد الملونة RGBW بـ 4 قنوات PWM فائقة الدقة والنعومة',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '4MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [12, 13, 14, 15],
      button: [5]
    }
  },
  
  // ── 4. Tuya / Smart Life Devices ───────────────
  {
    id: 'tuya-esp8266-1ch',
    name: 'Tuya Smart Switch 1CH (TYWE3S / ESP8266)',
    manufacturer: 'Tuya',
    category: 'smart_switch',
    chipset: 'ESP8266',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi'],
    description: 'مفتاح تويا الذكي قابل للتحويل إلى برمجيات MOSA المفتوحة بدون سحابة خارجية',
    flashConfig: {
      flashMode: 'dout',
      flashFreq: '40m',
      flashSize: '1MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [14],
      button: [1],
      led: [13]
    }
  },

  {
    id: 'tuya-smart-plug-16a',
    name: 'Tuya Smart Plug 16A with Energy Monitor',
    manufacturer: 'Tuya',
    category: 'smart_socket',
    chipset: 'ESP8266 / BK7231',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi'],
    description: 'فيش جداري ذكي يتحمل أحمال تصل إلى 16 أمبير مع حساس لقياس استهلاك التيار',
    flashConfig: {
      flashMode: 'dout',
      flashFreq: '40m',
      flashSize: '2MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [15],
      button: [13],
      led: [4]
    }
  },
  
  // ── 5. Arduino & Atmega Devices ────────────────
  {
    id: 'arduino-uno-eth',
    name: 'Arduino Uno + W5100 Ethernet Shield',
    manufacturer: 'Arduino',
    category: 'custom',
    chipset: 'ATmega328P',
    flashMethod: 'avrdude',
    baudRate: 115200,
    protocol: ['mqtt', 'http'],
    description: 'لوحة أردوينو كلاسيكية مع بطاقة إيثرنت سلكية للمشاريع التعليمية والصناعية المستقرة',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '32KB',
      resetMethod: 'dtr'
    },
    defaultPins: {
      relay: [7, 8, 9, 10],
      button: [2, 3]
    }
  },

  {
    id: 'arduino-mega-2560',
    name: 'Arduino Mega 2560 (16-Relay Controller)',
    manufacturer: 'Arduino',
    category: 'smart_switch',
    chipset: 'ATmega2560',
    flashMethod: 'avrdude',
    baudRate: 115200,
    protocol: ['mqtt', 'http'],
    description: 'لوحة عملاقة تدعم حتى 16 إلى 32 ريليه جداري ومتحكمات أزرار ميكانيكية متعددة',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '512KB' as any,
      resetMethod: 'dtr'
    },
    defaultPins: {
      relay: [22, 23, 24, 25, 26, 27, 28, 29]
    }
  },
  
  // ── 6. Custom ESP32 & NodeMCU Boards ───────────
  {
    id: 'custom-esp32',
    name: 'Generic ESP32 DevKit V1 (30 / 38 Pins)',
    manufacturer: 'Espressif / Generic',
    category: 'custom',
    chipset: 'ESP32-WROOM-32D',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi', 'ble', 'espnow'],
    description: 'لوحة تطوير ESP32 قياسية لتوصيل أي دوائر مخصصة أو ريليهات خارجية أو حساسات خاصة',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '4MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [2, 4, 5, 18],
      dht: 16,
      button: [13, 14, 19, 21]
    },
    setupSteps: [
      { id: 'detect', title: 'Auto-Detect Pins', type: 'pin_scan' },
      { id: 'config', title: 'Manual Config', type: 'pin_mapping' },
      { id: 'test', title: 'Hardware Test', type: 'hardware_test' }
    ]
  },

  {
    id: 'esp32-c3-supermini',
    name: 'ESP32-C3 SuperMini (RISC-V Ultra Compact)',
    manufacturer: 'Generic',
    category: 'sensor_node',
    chipset: 'ESP32-C3',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi', 'ble'],
    description: 'شريحة معمارية RISC-V صغيرة جداً مخصصة لحساسات الأبواب والحركة والحرارة ببطاريات',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '80m',
      flashSize: '4MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [0, 1],
      dht: 2,
      pir: 3,
      led: 8
    }
  },

  {
    id: 'esp32-cam',
    name: 'AI-Thinker ESP32-CAM (Video & Security)',
    manufacturer: 'AI-Thinker',
    category: 'security',
    chipset: 'ESP32 (OV2640)',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['http', 'wifi', 'mqtt'],
    description: 'كاميرا أمان مدمجة مع فلاش LED وبث فيديو مباشر MJPEG عبر الشبكة المحلية',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '4MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      led: 4,
      relay: [12]
    }
  },

  {
    id: 'nodemcu-esp8266',
    name: 'NodeMCU V3 (ESP8266 Lolin / Amica)',
    manufacturer: 'NodeMCU',
    category: 'custom',
    chipset: 'ESP8266-12E',
    flashMethod: 'esptool',
    baudRate: 115200,
    protocol: ['mqtt', 'wifi'],
    description: 'لوحة NodeMCU الشعبية تدعم الميكرو كنترولر مع مخارج D1 إلى D8',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '4MB',
      resetMethod: 'nodemcu'
    },
    defaultPins: {
      relay: [5, 4, 0, 2], // D1, D2, D3, D4
      dht: 14,             // D5
      button: [12]         // D6
    }
  },
  
  // ── 7. Zigbee Coordinators & Gateways ─────────
  {
    id: 'cc2652-coordinator',
    name: 'CC2652P USB Zigbee 3.0 Coordinator (Z-Stack)',
    manufacturer: 'Texas Instruments / Sonoff',
    category: 'gateway',
    chipset: 'CC2652P',
    flashMethod: 'serial_cmd',
    baudRate: 115200,
    protocol: ['zigbee'],
    description: 'دونجل Zigbee 3.0 عالي التغطية مع مضخم إشارة +20dBm للربط مع Zigbee2MQTT',
    flashConfig: {
      flashMode: 'dio',
      flashFreq: '40m',
      flashSize: '512KB' as any,
      resetMethod: 'dtr'
    },
    defaultPins: {}
  }
];
