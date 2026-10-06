'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Cpu, 
  Wifi, 
  Sliders, 
  Zap, 
  Terminal, 
  FlaskConical, 
  Search, 
  Usb, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Trash2, 
  Upload, 
  Send, 
  Power, 
  Layers, 
  ShieldCheck, 
  Activity, 
  Check, 
  Radio, 
  Eye, 
  EyeOff, 
  Download,
  Info,
  Server,
  KeyRound,
  ExternalLink,
  Copy,
  FileCode,
  Sparkles,
  Database,
  Network,
  Code2,
  Home
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { DEVICE_LIBRARY, DeviceTemplate, DeviceCategory } from '@/data/deviceLibrary';

type FlasherTab = 
  | 'detect'      // Auto-detect device
  | 'library'     // Browse device library
  | 'wifi'        // WiFi configuration
  | 'pins'        // Pin mapping
  | 'flash'       // Flash firmware
  | 'otes'        // OTES & mTLS Provisioning
  | 'monitor'     // Serial monitor
  | 'test';       // Hardware test

type ConnectionStatus = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'flashing'
  | 'error';

interface DetectedDevice {
  chipName: string;
  chipRevision?: string;
  flashSize?: string;
  macAddress?: string;
  ipAddress?: string;
  rssi?: number;
  heap?: number;
  features?: string[];
  currentFirmware?: string;
}

export default function FlasherPage() {
  // ── Connection & Serial State ──────────────────────────────
  const [tab, setTab] = useState<FlasherTab>('detect');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [port, setPort] = useState<any | null>(null);
  const [reader, setReader] = useState<ReadableStreamDefaultReader<string> | null>(null);
  const [writer, setWriter] = useState<WritableStreamDefaultWriter<string> | null>(null);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [serialLog, setSerialLog] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceTemplate | null>(DEVICE_LIBRARY[0]);
  const [detectedDevice, setDetectedDevice] = useState<DetectedDevice | null>(null);
  
  // ── OTES Provisioning & mTLS State ─────────────────────────
  const [otesToken, setOtesToken] = useState('');
  const [otesMacInput, setOtesMacInput] = useState('');
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [csrInput, setCsrInput] = useState('');
  const [signedCert, setSignedCert] = useState('');
  const [isSigningCsr, setIsSigningCsr] = useState(false);
  const [otesStatusMsg, setOtesStatusMsg] = useState('');
  
  // ── Library & Filtering State ──────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // ── Flashing State ─────────────────────────────────────────
  const [flashProgress, setFlashProgress] = useState(0);
  const [isFlashing, setIsFlashing] = useState(false);
  const [uploadedFirmwareName, setUploadedFirmwareName] = useState<string>('');
  const [customFileBuffer, setCustomFileBuffer] = useState<ArrayBuffer | null>(null);
  const [flashAddress, setFlashAddress] = useState<string>('0x0');
  const [flashBaudRate, setFlashBaudRate] = useState<number>(460800);
  const [eraseBeforeFlash, setEraseBeforeFlash] = useState<boolean>(false);
  const [flashModeType, setFlashModeType] = useState<'app' | 'full' | 'custom'>('full');
  const [autoMergeBootloader, setAutoMergeBootloader] = useState<boolean>(true);
  const [flashStatusText, setFlashStatusText] = useState<string>('');
  const [flashBytesTotal, setFlashBytesTotal] = useState<number>(0);
  const [flashBytesWritten, setFlashBytesWritten] = useState<number>(0);
  
  // ── WiFi & Server Config State ─────────────────────────────
  const [wifiSSID, setWifiSSID] = useState('TP-Link_1C4F');
  const [wifiPass, setWifiPass] = useState('72778777');
  const [showWifiPass, setShowWifiPass] = useState(false);
  const [mqttIP, setMqttIP] = useState<string>('192.168.1.110');
  const [homeId, setHomeId] = useState('home-1');
  const [discoveredNetworks, setDiscoveredNetworks] = useState<Array<{ ssid: string; rssi: number; secure: boolean }>>([]);
  const [isScanningWifi, setIsScanningWifi] = useState(false);
  const [wifiSaveSuccess, setWifiSaveSuccess] = useState(false);

  // ── Realtime System & Firmware Telemetry State ───────────
  const [systemHomes, setSystemHomes] = useState<Array<{ id: string; name: string; isActive?: boolean }>>([]);
  const [detectedServerIps, setDetectedServerIps] = useState<string[]>(['192.168.1.110', 'mosa-home.tail01b9ef.ts.net']);
  const [primaryServerIp, setPrimaryServerIp] = useState('192.168.1.110');
  const [serverDetails, setServerDetails] = useState<any>(null);
  const [projectConstants, setProjectConstants] = useState<{ default_wifi_ssid: string; default_wifi_pass: string; default_home_id: string; default_mqtt_host: string } | null>(null);
  const [isInjectingFirmware, setIsInjectingFirmware] = useState(false);
  const [injectSuccessMsg, setInjectSuccessMsg] = useState('');
  const [copiedCpp, setCopiedCpp] = useState(false);
  const [isQueryingLiveBoard, setIsQueryingLiveBoard] = useState(false);
  const [liveBoardData, setLiveBoardData] = useState<any>(null);

  // Load saved credentials from localStorage or fetch real system config
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSSID = localStorage.getItem('mosa_flasher_ssid');
      const savedPass = localStorage.getItem('mosa_flasher_pass');
      const savedMqtt = localStorage.getItem('mosa_flasher_mqtt');
      const savedHome = localStorage.getItem('mosa_flasher_home');
      if (savedSSID) setWifiSSID(savedSSID);
      if (savedPass) setWifiPass(savedPass);
      if (savedMqtt && savedMqtt !== '192.168.1.103') {
        setMqttIP(savedMqtt);
      } else if (savedMqtt === '192.168.1.103') {
        localStorage.removeItem('mosa_flasher_mqtt');
      }
      if (savedHome) setHomeId(savedHome);
    }

    // Fetch real system homes, server IPs and project firmware constants
    fetchAuth('/api/flasher/system-config')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          if (Array.isArray(data.homes) && data.homes.length > 0) {
            setSystemHomes(data.homes);
            const active = data.homes.find((h: any) => h.isActive) || data.homes[0];
            if (active && (!localStorage.getItem('mosa_flasher_home') || localStorage.getItem('mosa_flasher_home') === 'home-1')) {
              setHomeId(active.id);
            }
          }
          if (Array.isArray(data.serverIps) && data.serverIps.length > 0) {
            const filteredIps = data.serverIps.filter((ip: string) => ip !== '192.168.1.103');
            setDetectedServerIps(filteredIps);
          }
          if (data.serverDetails) {
            setServerDetails(data.serverDetails);
          }
          if (data.primaryServerIp && data.primaryServerIp !== '192.168.1.103') {
            setPrimaryServerIp(data.primaryServerIp);
            const saved = localStorage.getItem('mosa_flasher_mqtt');
            if (!saved || saved === '192.168.1.103') {
              setMqttIP(data.primaryServerIp);
            }
          }
          if (data.firmware?.constants) {
            setProjectConstants(data.firmware.constants);
            if (data.firmware.constants.default_wifi_ssid && !localStorage.getItem('mosa_flasher_ssid')) {
              setWifiSSID(data.firmware.constants.default_wifi_ssid);
            }
            if (data.firmware.constants.default_wifi_pass && !localStorage.getItem('mosa_flasher_pass')) {
              setWifiPass(data.firmware.constants.default_wifi_pass);
            }
          }
        }
      })
      .catch(() => {
        // Fallback: try homes endpoint
        fetchAuth('/api/users/me/homes')
          .then(res => res.json())
          .then(homes => {
            if (Array.isArray(homes)) {
              setSystemHomes(homes);
              const active = homes.find((h: any) => h.isActive) || homes[0];
              if (active) setHomeId(active.id);
            }
          })
          .catch(() => {});
      });
  }, []);

  // Sync to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (wifiSSID) localStorage.setItem('mosa_flasher_ssid', wifiSSID);
      if (wifiPass) localStorage.setItem('mosa_flasher_pass', wifiPass);
      if (mqttIP) localStorage.setItem('mosa_flasher_mqtt', mqttIP);
      if (homeId) localStorage.setItem('mosa_flasher_home', homeId);
    }
  }, [wifiSSID, wifiPass, mqttIP, homeId]);

  // ── Pin Mapping State ──────────────────────────────────────
  const [pinMap, setPinMap] = useState<Record<string, number>>({});
  const [customSwitchPins, setCustomSwitchPins] = useState<Record<string, number>>({});
  const [activeStates, setActiveStates] = useState<Record<string, 'HIGH' | 'LOW'>>({});
  const [switchModes, setSwitchModes] = useState<Record<string, 'GND' | '3.3V'>>({});

  // ── Hardware Test State ────────────────────────────────────
  const [gpioStates, setGpioStates] = useState<Record<number, boolean>>({});
  const [cliInput, setCliInput] = useState('');

  const logRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
  const writerRef = useRef<WritableStreamDefaultWriter<string> | null>(null);
  const isConnectedRef = useRef<boolean>(false);

  // Keep refs in sync for stream management
  useEffect(() => {
    readerRef.current = reader;
  }, [reader]);

  useEffect(() => {
    writerRef.current = writer;
  }, [writer]);

  // Auto-scroll serial log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [serialLog]);

  // Load defaults from selected device template
  useEffect(() => {
    if (selectedDevice) {
      const initialMap: Record<string, number> = {};
      const initialSwitches: Record<string, number> = {};
      const initialActives: Record<string, 'HIGH' | 'LOW'> = {};
      const initialModes: Record<string, 'GND' | '3.3V'> = {};

      Object.entries(selectedDevice.defaultPins).forEach(([name, value]) => {
        if (Array.isArray(value)) {
          value.forEach((pin, i) => {
            const key = `${name}_${i + 1}`;
            initialMap[key] = pin;
            initialSwitches[key] = -1;
            initialActives[key] = 'HIGH';
            initialModes[key] = 'GND';
          });
        } else if (typeof value === 'number') {
          initialMap[name] = value;
          initialSwitches[name] = -1;
          initialActives[name] = 'HIGH';
          initialModes[name] = 'GND';
        }
      });

      // Special preset mappings for MOSA Node
      if (selectedDevice.id === 'mosa-node-v3' || selectedDevice.id === 'mosa-node-r1') {
        initialSwitches['relay_1'] = 5;
        initialSwitches['relay_2'] = 13;
        initialSwitches['relay_3'] = 14;
        initialSwitches['relay_4'] = 19;
      }

      setPinMap(initialMap);
      setCustomSwitchPins(initialSwitches);
      setActiveStates(initialActives);
      setSwitchModes(initialModes);
    }
  }, [selectedDevice]);

  const portRef = useRef<any>(null);
  useEffect(() => {
    portRef.current = port;
  }, [port]);

  // ── Logging helper ────────────────────────────────────────
  const addLog = useCallback((msg: string) => {
    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour12: false });
    setSerialLog(prev => [...prev.slice(-500), `[${timeStr}] ${msg}`]);
  }, []);

  // ── Send CLI Command (Dual Channel: USB Serial + MQTT API) ──
  const sendCommand = useCallback(async (cmd: string) => {
    const activePort = portRef.current || port;
    let usbSuccess = false;

    if (activePort && activePort.writable) {
      try {
        let waitCount = 0;
        while (activePort.writable.locked && waitCount < 8) {
          await new Promise(r => setTimeout(r, 40));
          waitCount++;
        }
        if (!activePort.writable.locked) {
          const encoder = new TextEncoder();
          const data = encoder.encode(cmd + '\r\n');
          const w = activePort.writable.getWriter();
          try {
            await w.write(data);
            usbSuccess = true;
          } finally {
            w.releaseLock();
          }
          addLog(`>> Sent (USB): ${cmd}`);
        } else {
          addLog(`⚠️ المنفذ التسلسلي مشغول حالياً بأمر آخر.`);
        }
      } catch (err: any) {
        addLog(`⚠️ تعذر الإرسال عبر USB: ${err.message}`);
      }
    }

    // 🟢 DUAL CHANNEL: Also dispatch command through Backend MQTT Gateway
    try {
      const cleanTarget = detectedDevice?.macAddress || 'broadcast';
      let parsedPayload: any;
      if (cmd.startsWith('{') && cmd.endsWith('}')) {
        try { parsedPayload = JSON.parse(cmd); } catch { parsedPayload = { action: cmd }; }
      } else {
        parsedPayload = { action: cmd, cmd: cmd };
      }

      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: cleanTarget,
          payload: parsedPayload
        })
      });
      if (!usbSuccess) {
        addLog(`>> Sent (MQTT): ${cmd}`);
      }
    } catch (e) {
      // Ignore network fallback error if USB was used
    }
  }, [port, detectedDevice, addLog]);

  // ── WebSerial Connection ──────────────────────────────────
  const connectDevice = async () => {
    if (typeof window === 'undefined' || !('serial' in navigator)) {
      alert('عذراً، متصفحك لا يدعم WebSerial API. يرجى استخدام Google Chrome أو Microsoft Edge أو Brave على جهاز الكمبيوتر.');
      return;
    }

    try {
      setStatus('connecting');
      addLog('⏳ جاري طلب منفذ الـ USB Serial من المتصفح...');
      
      const selectedPort = await (navigator as any).serial.requestPort();
      const targetBaud = baudRate || selectedDevice?.baudRate || 115200;
      
      // If port is not yet open, open it
      try {
        await selectedPort.open({ 
          baudRate: targetBaud,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none'
        });
      } catch (openErr: any) {
        if (openErr.message && openErr.message.includes('already open')) {
          addLog('ℹ️ المنفذ مفتوح مسبقاً، جاري الاستئناف المباشر...');
        } else {
          throw openErr;
        }
      }

      // Ensure DTR and RTS are NOT holding ESP32 in reset!
      try {
        await selectedPort.setSignals({ dataTerminalReady: false, requestToSend: false });
      } catch (sigErr) {}

      setPort(selectedPort);
      portRef.current = selectedPort;
      setStatus('connected');
      
      // Immediately initialize detected device card so Auto Detect tab shows connected state
      setDetectedDevice({
        chipName: selectedDevice?.chipset || 'ESP32 (Universal)',
        macAddress: 'جاري القراءة...',
        flashSize: (selectedDevice as any)?.flashSize || '4MB / 16MB',
        ipAddress: 'جاري الاستعلام...'
      });

      addLog(`✅ تم الاتصال بالمنفذ التسلسلي بنجاح بمعدل نقل (${targetBaud} Baud)!`);

      // Start direct Non-Blocking Read Loop
      readLoop(selectedPort);

      // Auto-detect node info
      setTimeout(async () => {
        await autoDetectDevice();
      }, 500);

    } catch (err: any) {
      if (err.name === 'NotFoundError') {
        setStatus('disconnected');
        addLog('⚠️ تم إلغاء اختيار المنفذ.');
      } else {
        setStatus('error');
        addLog(`❌ فشل الاتصال بالمنفذ: ${err.message}`);
        addLog('💡 تنبيه: تأكد من إغلاق Serial Monitor في Arduino IDE أو أي برنامج آخر يستخدم المنفذ.');
      }
    }
  };

  const disconnectDevice = async () => {
    try {
      addLog('🔌 جاري إغلاق الاتصال وتحرير المنفذ...');
      // Signal the readLoop to stop
      isConnectedRef.current = false;
      // Cancel reader first to unblock readLoop
      if (readerRef.current) {
        await readerRef.current.cancel().catch(() => {});
        readerRef.current = null;
      }
      // Small delay to let readLoop exit
      await new Promise(r => setTimeout(r, 150));
      // Now safe to close port
      if (portRef.current) {
        await portRef.current.close().catch(() => {});
      }
    } catch (err: any) {
      console.warn('Disconnect err:', err);
    } finally {
      portRef.current = null;
      setPort(null);
      setReader(null);
      setWriter(null);
      setDetectedDevice(null);
      setStatus('disconnected');
      addLog('🔌 تم قطع الاتصال باللوحة بنجاح.');
    }
  };

  // ── Direct Read Stream Loop with Smart Parser ─────────────
  const readLoop = async (activePort: any) => {
    let buffer = '';
    const decoder = new TextDecoder();
    isConnectedRef.current = true;
    try {
      while (isConnectedRef.current && activePort && activePort.readable) {
        let r: ReadableStreamDefaultReader<Uint8Array>;
        try {
          r = activePort.readable.getReader();
        } catch {
          break;
        }
        readerRef.current = r as any;
        setReader(r as any);
        try {
          while (isConnectedRef.current) {
            const { value, done } = await r.read();
            if (done || !isConnectedRef.current) break;
            if (value) {
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() || '';

              for (const rawLine of lines) {
                const line = rawLine.trim();
                if (!line) continue;
                addLog(line);

                // Parse JSON telemetry / responses
                if (line.startsWith('{') && line.endsWith('}')) {
                  try {
                    const data = JSON.parse(line);
                    
                    // Handle WiFi Scan Results
                    if ((data.type === 'scan_results' || data.networks) && Array.isArray(data.networks)) {
                      setDiscoveredNetworks(data.networks);
                      setIsScanningWifi(false);
                      addLog(`📡 تم استلام ${data.networks.length} شبكة واي فاي متاحة`);
                    }

                    // Handle Status Response
                    if (data.type === 'status' || data.mac || data.boardId || data.chip) {
                      setDetectedDevice(prev => ({
                        ...prev,
                        chipName: data.chip || prev?.chipName || 'ESP32',
                        macAddress: data.mac || data.boardId || prev?.macAddress,
                        ipAddress: data.ip || prev?.ipAddress,
                        rssi: data.rssi || prev?.rssi,
                        heap: data.heap || prev?.heap,
                        flashSize: data.flashSize || prev?.flashSize || '4MB'
                      }));
                    }

                    // Handle Pin Toggle Success
                    if (data.status === 'success' && data.pin !== undefined) {
                      const isNowOn = data.state === 'ON' || data.state === true;
                      setGpioStates(prev => ({ ...prev, [Number(data.pin)]: isNowOn }));
                    }

                  } catch (e) {}
                }

                // Plain text parsing for MAC / Chip / IP
                if (line.includes('MAC:') || line.includes('Board ID:')) {
                  const macMatch = line.match(/([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})/) || line.match(/MosaNode_[0-9A-Fa-f]+/);
                  if (macMatch) {
                    setDetectedDevice(prev => ({
                      chipName: prev?.chipName || 'ESP32',
                      macAddress: macMatch[0],
                      flashSize: prev?.flashSize || '4MB'
                    }));
                  }
                }

                if (line.includes('IP:') || line.includes('Connected! IP:') || line.includes('Connected, IP:')) {
                  const ipMatch = line.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
                  if (ipMatch) {
                    setDetectedDevice(prev => ({
                      chipName: prev?.chipName || 'ESP32',
                      macAddress: prev?.macAddress || 'ESP32-Node',
                      ipAddress: ipMatch[0]
                    }));
                  }
                }
              }
            }
          }
        } catch (e) {
          // reader cancelled / port closed - expected on disconnect
        } finally {
          try { r.releaseLock(); } catch {}
        }
        // If not still connected, don't loop again
        if (!isConnectedRef.current) break;
      }
    } catch (err: any) {
      if (isConnectedRef.current) {
        console.warn('Read loop ended unexpectedly:', err);
      }
    }
  };

  // ── Auto Device Detection ─────────────────────────────────
  const autoDetectDevice = async () => {
    addLog('🔍 جاري استعلام حالة ومعلومات الشريحة من الـ Firmware...');
    await sendCommand('STATUS');
    setTimeout(() => {
      sendCommand('DEVICES');
    }, 400);
  };

  // ── WiFi & Server Configuration ───────────────────────────
  const scanWifiNetworks = async () => {
    setIsScanningWifi(true);
    addLog('📡 جاري فحص شبكات الواي فاي المحيطة باللوحة...');
    await sendCommand('SCAN');

    setTimeout(() => {
      setIsScanningWifi(false);
    }, 5000);
  };

  const sendWifiConfig = async () => {
    if (!wifiSSID.trim()) {
      alert('يرجى كتابة أو اختيار اسم شبكة الواي فاي (SSID)');
      return;
    }

    addLog('💾 جاري إرسال وحقن إعدادات الشبكة والسيرفر في ذاكرة NVS للوحة...');
    
    // 1. Send standard CLI string command: WIFI:ssid,pass,mqtt,homeId
    const cliWifi = `WIFI:${wifiSSID.trim()},${wifiPass.trim()},${mqttIP.trim()},${homeId.trim()}`;
    await sendCommand(cliWifi);
    
    const rawMac = detectedDevice?.macAddress || '';
    const cleanMac = rawMac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    const targetNodeId = (cleanMac.length === 12)
      ? `MosaNode_${cleanMac}`
      : 'MosaNode_3030F96A1F5C';
    const jsonPayload = JSON.stringify({
      cmd: 'WIFI_CONFIG',
      action: 'WIFI_CONFIG',
      ssid: wifiSSID.trim(),
      pass: wifiPass.trim(),
      password: wifiPass.trim(),
      mqttHost: mqttIP.trim(),
      homeId: homeId.trim(),
      mqttUser: targetNodeId,
      mqttPassword: 'mtls'
    });
    await sendCommand(jsonPayload);

    // 3. Proactively ensure MQTT Auth credentials are saved into NVS
    await sendCommand(`SET_MQTT_AUTH:${targetNodeId},mtls`);

    // 3. Send via MQTT / API directly
    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: detectedDevice?.macAddress || 'broadcast',
          payload: {
            action: 'WIFI_CONFIG',
            ssid: wifiSSID.trim(),
            pass: wifiPass.trim(),
            mqttHost: mqttIP.trim(),
            homeId: homeId.trim()
          }
        })
      });
    } catch (e) {}

    // Note: Direct HTTP save to device IP is omitted here to prevent HTTPS Mixed Content browser blocks;
    // configuration is already injected reliably via USB WebSerial and MQTT.

    addLog('✅ تم إرسال حزمة التكوين بنجاح! اللوحة ستحفظ الإعدادات وتعيد التشغيل للاتصال بالشبكة.');
  };

  // ── Auto Firmware Code Injection into Source File ─────────
  const injectIntoFirmwareSource = async () => {
    setIsInjectingFirmware(true);
    setInjectSuccessMsg('');
    try {
      addLog(`⚡ جاري حقن الثوابت الجديدة في ملف الفيرموير R1_Refactored.ino (Home: ${homeId}, MQTT: ${mqttIP})...`);
      const res = await fetchAuth('/api/flasher/inject-firmware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wifiSSID: wifiSSID.trim(),
          wifiPass: wifiPass.trim(),
          homeId: homeId.trim(),
          mqttHost: mqttIP.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInjectSuccessMsg('✅ تم تحديث وحقن الثوابت بنجاح داخل كود المشروع R1_Refactored.ino!');
        setProjectConstants(data.updatedConstants);
        addLog('🎉 اكتمل حقن الإعدادات في الكود المصدري للمشروع بنجاح!');
        setTimeout(() => setInjectSuccessMsg(''), 6000);
      } else {
        alert(data.error || 'فشل حقن الإعدادات في ملف الفيرموير');
        addLog(`❌ خطأ أثناء الحقن: ${data.error}`);
      }
    } catch (err: any) {
      alert('حدث خطأ في الاتصال بالسيرفر أثناء الحقن');
      addLog(`❌ خطأ اتصال: ${err.message}`);
    } finally {
      setIsInjectingFirmware(false);
    }
  };

  // ── Copy C++ Code Snippet ─────────────────────────────────
  const generatedCppSnippet = `// ==========================================
// 🟢 إعدادات التكوين المجهزة تلقائياً من المنصة
// ==========================================
const char* default_wifi_ssid   = "${wifiSSID.trim()}";
const char* default_wifi_pass   = "${wifiPass.trim()}";
const char* default_home_id     = "${homeId.trim()}";
const char* default_mqtt_host   = "${mqttIP.trim()}";`;

  const copyCppSnippet = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(generatedCppSnippet);
      setCopiedCpp(true);
      addLog('📋 تم نسخ كود التكوين C++ للحافظة بنجاح!');
      setTimeout(() => setCopiedCpp(false), 2500);
    }
  };

  // ── Download Constants.h Header ───────────────────────────
  const downloadHeaderFile = () => {
    const params = new URLSearchParams({
      ssid: wifiSSID.trim(),
      pass: wifiPass.trim(),
      homeId: homeId.trim(),
      mqttHost: mqttIP.trim()
    });
    window.open(`/api/flasher/download-header?${params.toString()}`, '_blank');
    addLog('📥 جاري تحميل ملف Constants.h المخصص...');
  };

  // ── Fetch Live Telemetry From Board ───────────────────────
  const fetchLiveBoardStatus = async (targetIp?: string) => {
    setIsQueryingLiveBoard(true);
    const ipToQuery = targetIp || detectedDevice?.ipAddress || '192.168.1.102';
    addLog(`🔍 جاري استعلام حالة الشريحة الحية من ${ipToQuery}...`);
    try {
      const res = await fetch(`http://${ipToQuery}/api/status`, {
        signal: AbortSignal.timeout(3500)
      });
      if (res.ok) {
        const data = await res.json();
        setLiveBoardData(data);
        setDetectedDevice(prev => ({
          ...prev,
          chipName: prev?.chipName || 'ESP32 Node',
          macAddress: data.boardId || prev?.macAddress,
          ipAddress: data.ip === '***' ? ipToQuery : (data.ip || ipToQuery),
          rssi: data.rssi === '***' ? -45 : Number(data.rssi) || -45,
          heap: data.freeHeap
        }));
        addLog(`✅ تم جلب حالة الشريحة الحية: ${data.boardId || 'ESP32'} | MQTT: ${data.mqttConnected ? 'متصل 🟢' : 'غير متصل 🔴'} | الأجهزة: ${data.activeDevices}`);
      }
    } catch (e: any) {
      addLog(`⚠️ تعذر الوصول المباشر للشريحة عبر HTTP (${e.message}) - جاري الاستعلام عبر السيريال...`);
      if (status === 'connected') {
        sendCommand('STATUS');
      }
    } finally {
      setIsQueryingLiveBoard(false);
    }
  };

  // ── Pin Mapping & Batch Configuration ─────────────────────
  const applyPinSettings = async () => {
    addLog('📌 جاري تطبيق وحفظ تكوين المخارج والمفاتيح الجدارية في ذاكرة اللوحة...');

    // 1. Send modern JSON SET_PINS
    const payload = JSON.stringify({
      cmd: 'SET_PINS',
      action: 'SET_PINS',
      pins: pinMap,
      switchPins: customSwitchPins,
      activeStates: activeStates,
      switchModes: switchModes
    });
    await sendCommand(payload);

    // 2. Configure individual slots via DEVICE: CLI for maximum reliability
    let delayMs = 500;
    Object.entries(pinMap).forEach(([name, pin]) => {
      const switchPin = customSwitchPins[name] ?? -1;
      const activeState = activeStates[name] || 'HIGH';
      const switchMode = switchModes[name] || 'GND';
      const cleanType = name.toLowerCase().includes('dht') ? 'TEMPERATURE' : (name.toLowerCase().includes('pir') ? 'PIR' : (name.toLowerCase().includes('acs') ? 'ENERGY' : 'LIGHT'));
      const cleanName = `مخرج ${pin}`;

      setTimeout(() => {
        sendCommand(`DEVICE:${pin},${switchPin},${cleanName},${cleanType},${activeState},${switchMode}`);
      }, delayMs);
      delayMs += 500;
    });

    setTimeout(() => {
      addLog('✅ تم حفظ وتفعيل كافة المخارج على الشريحة بنجاح!');
    }, delayMs + 100);
  };

  // ── OTES & mTLS Provisioning Engine ───────────────────────
  const generateOtesToken = async () => {
    setIsGeneratingToken(true);
    setOtesStatusMsg('');
    try {
      const targetMac = otesMacInput.trim() || detectedDevice?.macAddress || '30:30:F9:6A:1F:5C';
      addLog(`🔐 طلب رمز تسجيل أمان جديد (OTES Token) للماك: ${targetMac}...`);
      
      const res = await fetchAuth('/api/provisioning/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mac: targetMac,
          deviceName: selectedDevice?.name || 'MOSA Node',
          homeId: homeId
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.token) {
        setOtesToken(data.data.token);
        setOtesStatusMsg(`✅ تم توليد رمز التسجيل بنجاح! الصلاحية: 5 دقائق (ينتهي: ${new Date(data.data.expiresAt).toLocaleTimeString('ar-EG')})`);
        addLog(`✅ رمز OTES: ${data.data.token} (صالح لمرة واحدة لمدة 5 دقائق)`);
      } else {
        const errMsg = data.error || 'فشل توليد رمز التسجيل';
        setOtesStatusMsg(`❌ ${errMsg}`);
        addLog(`❌ خطأ OTES: ${errMsg}`);
      }
    } catch (e: any) {
      setOtesStatusMsg(`❌ خطأ اتصال: ${e.message}`);
      addLog(`❌ خطأ توليد OTES: ${e.message}`);
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const sendOtesTokenToBoard = async () => {
    if (!otesToken) {
      alert('يرجى توليد رمز التسجيل OTES أولاً');
      return;
    }
    addLog(`🚀 إرسال أمر التسجيل OTES:${otesToken} إلى اللوحة عبر USB Serial...`);
    await sendCommand(`OTES:${otesToken}`);
    setOtesStatusMsg('⚡ تم إرسال رمز OTES للوحة! ستقوم اللوحة بتوليد زوج المفاتيح وطلب شهادة mTLS وتخزينها.');
  };

  const submitManualCsr = async () => {
    if (!otesToken || !csrInput.trim()) {
      alert('يرجى إدخال رمز OTES وطلب التوقيع (CSR PEM)');
      return;
    }
    setIsSigningCsr(true);
    setOtesStatusMsg('');
    try {
      const targetMac = otesMacInput.trim() || detectedDevice?.macAddress || '30:30:F9:6A:1F:5C';
      addLog('📝 إرسال طلب التوقيع CSR إلى Intermediate CA...');
      const res = await fetch('/api/provisioning/sign-csr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: otesToken,
          mac: targetMac,
          csr: csrInput.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success && data.data?.clientCertificate) {
        setSignedCert(data.data.clientCertificate);
        setOtesStatusMsg('🎉 تم توقيع الشهادة وإصدار هوية mTLS بنجاح من Intermediate CA!');
        addLog(`🎉 تم إصدار شهادة العميل mTLS بنجاح! CN=${data.data.commonName}`);
      } else {
        const errMsg = data.error || 'فشل توقيع الشهادة';
        setOtesStatusMsg(`❌ ${errMsg}`);
        addLog(`❌ خطأ توقيع الشهادة: ${errMsg}`);
      }
    } catch (e: any) {
      setOtesStatusMsg(`❌ خطأ اتصال: ${e.message}`);
      addLog(`❌ خطأ: ${e.message}`);
    } finally {
      setIsSigningCsr(false);
    }
  };

  const downloadCaChain = () => {
    window.open('/api/provisioning/ca-chain', '_blank');
    addLog('📥 جاري تنزيل حزمة شهادات الثقة (CA Chain Bundle)...');
  };

  // ── Firmware Flashing Engine ──────────────────────────────
  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFirmwareName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) {
          setCustomFileBuffer(reader.result);
          addLog(`📁 تم تحميل ملف الـ Firmware المخصص: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
          // Intelligent address default: if merged/full factory bin (>=4MB) set 0x0, else 0x10000
          if (file.size >= 4000000 || file.name.toLowerCase().includes('merged') || file.name.toLowerCase().includes('factory')) {
            setFlashAddress('0x0');
            setFlashModeType('full');
            setAutoMergeBootloader(false);
            addLog(`ℹ️ تم تحديد العنوان تلقائياً إلى 0x0 لكامل الصورة المدمجة (Merged Image).`);
          } else {
            setFlashAddress('0x10000');
            setFlashModeType('custom');
            setAutoMergeBootloader(true);
            addLog(`ℹ️ تم تحديد العنوان إلى 0x10000 مع تفعيل الدمج التلقائي مع Bootloader المصنع.`);
          }
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const createMergedImage = async (appData: ArrayBuffer): Promise<Uint8Array> => {
    addLog('📥 جاري جلب ملفات الإقلاع المصنعية (Bootloader, Partitions, BootApp0)...');
    const [bRes, pRes, oRes] = await Promise.all([
      fetch('/api/firmware/bootloader.bin'),
      fetch('/api/firmware/partitions.bin'),
      fetch('/api/firmware/boot_app0.bin')
    ]);
    if (!bRes.ok || !pRes.ok || !oRes.ok) {
      throw new Error('لم يتم العثور على ملفات الإقلاع (Bootloader / Partitions) على السيرفر. يرجى تجميع المشروع (Compile) من Arduino IDE أو PlatformIO أولاً ووضع الملفات في مجلد uploads/firmware.');
    }
    const [bootBuf, partBuf, otaBuf] = await Promise.all([
      bRes.arrayBuffer(),
      pRes.arrayBuffer(),
      oRes.arrayBuffer()
    ]);

    const totalSize = 0x10000 + appData.byteLength;
    const merged = new Uint8Array(totalSize);
    merged.fill(0xff);

    merged.set(new Uint8Array(bootBuf), 0x0);
    merged.set(new Uint8Array(partBuf), 0x8000);
    merged.set(new Uint8Array(otaBuf), 0xe000);
    merged.set(new Uint8Array(appData), 0x10000);

    return merged;
  };

  const flashFirmware = async () => {
    let activePort = portRef.current || port;
    if (!activePort) {
      try {
        addLog('⏳ يرجى اختيار منفذ USB Serial من المتصفح للبدء...');
        activePort = await (navigator as any).serial.requestPort();
        setPort(activePort);
        portRef.current = activePort;
      } catch (e: any) {
        alert('لم يتم اختيار منفذ USB Serial');
        return;
      }
    }

    setIsFlashing(true);
    setFlashProgress(0);
    setFlashStatusText('جاري التحضير وتهيئة ملفات النظام...');
    let transport: any = null;
    let esploader: any = null;

    try {
      addLog(`🚀 بدء عملية برمجة وتثبيت الـ Firmware الحقيقي عبر WebSerial & esptool-js...`);

      // 1. Determine target flash offset
      let targetAddress = parseInt(flashAddress, 16);
      if (isNaN(targetAddress)) targetAddress = (flashModeType === 'full' ? 0x0 : 0x10000);

      // 2. Fetch or prepare binary data
      let firmwareData: Uint8Array;

      if (flashModeType === 'custom' && customFileBuffer) {
        if (autoMergeBootloader && targetAddress === 0x10000) {
          addLog('🧩 دمج كود الـ App المرفوع مع Bootloader المصنع وقسم Partitions في صورة موحدة 0x0...');
          setFlashStatusText('جاري دمج ملفات الإقلاع المصنعية مع السوفتوير المرفوع...');
          firmwareData = await createMergedImage(customFileBuffer);
          targetAddress = 0x0;
          addLog(`✅ تم إنشاء صورة المصنع المدمجة بنجاح (${(firmwareData.byteLength / 1024).toFixed(1)} KB) على العنوان 0x0`);
        } else {
          firmwareData = new Uint8Array(customFileBuffer);
          addLog(`📁 استخدام ملف الفيرموير المرفوع (${(firmwareData.byteLength / 1024).toFixed(1)} KB) على العنوان 0x${targetAddress.toString(16).toUpperCase()}`);
        }
      } else if (flashModeType === 'full' || eraseBeforeFlash) {
        targetAddress = 0x0;
        addLog(`📥 جاري جلب صورة النظام الكاملة المدمجة للمصنع (Factory Merged Image 0x0)...`);
        const res = await fetch('/api/firmware/mosa-node-v3-factory-merged.bin');
        if (!res.ok) {
          throw new Error(`لم يتم العثور على ملف الفيرموير المدمج (mosa-node-v3-factory-merged.bin). يرجى التأكد من تجميع المشروع ورفع الملف إلى السيرفر.`);
        }
        const buf = await res.arrayBuffer();
        firmwareData = new Uint8Array(buf);
        addLog(`✅ تم استلام صورة الفيرموير المدمجة بنجاح (${(firmwareData.byteLength / 1024).toFixed(1)} KB) تشمل Bootloader وPartitions`);
      } else {
        targetAddress = 0x10000;
        const firmwareFileUrl = selectedDevice?.firmwareUrl || '/api/firmware/mosa-node-v3-latest.bin';
        addLog(`📥 جاري جلب أحدث سوفتوير رسمي (${firmwareFileUrl})...`);
        const res = await fetch(firmwareFileUrl);
        if (!res.ok) throw new Error(`فشل تحميل السوفتوير من السيرفر (HTTP ${res.status})`);
        const buf = await res.arrayBuffer();
        firmwareData = new Uint8Array(buf);
        addLog(`✅ تم استلام السوفتوير بنجاح (${(firmwareData.byteLength / 1024).toFixed(1)} KB) لقسم التطبيق 0x10000`);
      }

      setFlashBytesTotal(firmwareData.byteLength);
      setFlashBytesWritten(0);
      setFlashProgress(5);
      setFlashStatusText('تحرير المنفذ التسلسلي ونقل السيطرة إلى محرك ESP Bootloader...');
      addLog('🔌 إيقاف قراءة السيريال النصية مؤقتاً لتحرير المنفذ لـ ESPLoader...');

      // 3. Stop CLI readLoop and safely release reader lock
      isConnectedRef.current = false;
      if (readerRef.current) {
        const r = readerRef.current;
        readerRef.current = null;
        setReader(null);
        try {
          await r.cancel();
        } catch {}
      }

      // Wait for any remaining readable lock to release
      for (let i = 0; i < 30; i++) {
        if (!activePort?.readable?.locked) break;
        await new Promise(r => setTimeout(r, 50));
      }

      // Close the port cleanly so Transport can open it fresh
      for (let i = 0; i < 5; i++) {
        try {
          await activePort.close();
          break;
        } catch (e: any) {
          const msg = e?.message || '';
          if (msg.includes('already closed')) break;
          await new Promise(r => setTimeout(r, 100));
        }
      }
      await new Promise(r => setTimeout(r, 150));

      // 4. Import esptool-js dynamically (client-only)
      addLog('⚡ تحميل محرك البرمجة (esptool-js) والاتصال بروم الإقلاع (ROM Bootloader)...');
      setFlashStatusText('جاري مزامنة الإشارات (DTR/RTS) مع شريحة ESP...');
      const { ESPLoader, Transport } = await import('esptool-js');

      transport = new Transport(activePort, false);

      // 🛡️ Bulletproof wrapper on transport.connect: always ensure SLIP reader is active
      const rawConnect = transport.connect.bind(transport);
      transport.connect = async (baud: number = 115200, serialOptions: any = {}) => {
        try {
          await rawConnect(baud, serialOptions);
        } catch (err: any) {
          const msg = err?.message || String(err);
          if (msg.includes('already open') || msg.includes('already in use')) {
            addLog(`ℹ️ المنفذ مفتوح مسبقاً - تفعيل قارئ الحزم التسلسلية المباشر...`);
            transport.baudrate = baud;
            if (transport.slipReaderEnabled) {
              transport.startSlipReader();
            } else {
              transport.readLoop();
            }
            return;
          }
          throw err;
        }
      };

      const terminal = {
        clean() {},
        writeLine(str: string) {
          if (str && str.trim()) addLog(`[ESP-Flash] ${str.trim()}`);
        },
        write(str: string) {
          if (str && str.trim()) addLog(`[ESP-Flash] ${str.trim()}`);
        }
      };

      esploader = new ESPLoader({
        transport,
        baudrate: flashBaudRate || 460800,
        terminal,
        romBaudrate: 115200
      } as any);

      setFlashProgress(15);
      setFlashStatusText('جاري مزامنة Bootloader (إذا لم يستجب، اضغط زر BOOT)...');
      addLog('⏳ جاري التفاوض مع Bootloader الشريحة... (نصيحة: إذا تأخر الاتصال، اضغط زر BOOT في اللوحة باستمرار)');

      let chipName = '';
      try {
        chipName = await esploader.main();
      } catch (connErr: any) {
        throw new Error(`فشل الاتصال بـ Bootloader الشريحة: ${connErr.message}. يرجى الضغط على زر EN/RST لإعادة ضبط اللوحة ثم ضغط زر BOOT أثناء المحاولة.`);
      }

      addLog(`✨ تم الاتصال بنجاح بالشريحة: ${chipName}`);
      
      const PARTITION_SIZES: Record<string, number> = {
        'default': 1_310_720,      // 1.25 MB (old scheme)
        'huge_app': 3_145_728,     // 3 MB (new scheme)
        'minimal': 819_200,        // 800 KB
      };

      const validateBinarySize = (fileSize: number, partitionScheme: string) => {
        const maxSize = PARTITION_SIZES[partitionScheme] || PARTITION_SIZES.default;
        if (fileSize > maxSize) {
          throw new Error(
            `Binary size (${(fileSize/1024).toFixed(0)} KB) exceeds ${partitionScheme} ` +
            `partition (${(maxSize/1024).toFixed(0)} KB). ` +
            `Recompile with "Huge APP" scheme.`
          );
        }
      };

      if (chipName.includes('ESP32-S3') && firmwareData.byteLength > 1_300_000) {
        addLog('⚠️ Large firmware detected on ESP32-S3');
        addLog('✅ Ensure partition scheme is "Huge APP (3MB)"');
      }

      if (targetAddress === 0x10000) {
        validateBinarySize(firmwareData.byteLength, firmwareData.byteLength > PARTITION_SIZES.default ? 'huge_app' : 'default');
      }

      setFlashStatusText(`تم التعرف على الشريحة: ${chipName} - بدء البرمجة...`);
      setFlashProgress(25);

      setDetectedDevice(prev => ({
        ...prev,
        chipName: chipName || prev?.chipName || 'ESP32',
        flashSize: prev?.flashSize || '16MB'
      }));

      // 5. Write Flash
      // 🛡️ Safety Guard: NEVER allow eraseAll unless writing full factory image starting at 0x0!
      // Doing full erase while flashing only to 0x10000 destroys the bootloader at 0x0.
      const safeEraseAll = Boolean(eraseBeforeFlash && targetAddress === 0x0);
      if (eraseBeforeFlash && targetAddress !== 0x0) {
        addLog('⚠️ تم تعطيل المسح الكامل تلقائياً لحماية Bootloader الشريحة في 0x0.');
      }

      addLog(`📝 كتابة القطاعات البرمجية (${firmwareData.byteLength} بايت) في العنوان 0x${targetAddress.toString(16).toUpperCase()}...`);
      setFlashStatusText('جاري مسح وكتابة البيانات في ذاكرة الـ Flash...');

      let lastReportTime = 0;
      await esploader.writeFlash({
        fileArray: [{
          data: (firmwareData instanceof Uint8Array) ? firmwareData : new Uint8Array(firmwareData),
          address: targetAddress
        }],
        flashMode: (selectedDevice?.flashConfig as any)?.flashMode || 'dio',
        flashFreq: (selectedDevice?.flashConfig as any)?.flashFreq || '40m',
        flashSize: (selectedDevice?.flashConfig as any)?.flashSize || '4MB',
        eraseAll: safeEraseAll,
        compress: true,
        reportProgress: (fileIndex: number, written: number, total: number) => {
          setFlashBytesWritten(written);
          const pct = Math.min(100, Math.round((written / total) * 100));
          setFlashProgress(pct);
          const now = Date.now();
          if (now - lastReportTime > 600 || pct === 100) {
            lastReportTime = now;
            setFlashStatusText(`جاري الكتابة: ${pct}% (${(written / 1024).toFixed(0)} / ${(total / 1024).toFixed(0)} KB)...`);
          }
        }
      });

      setFlashProgress(100);
      setFlashStatusText('🎉 تمت البرمجة بنجاح! جاري إعادة تشغيل الشريحة...');
      addLog('🎉 تمت برمجة وتثبيت الـ Firmware في ذاكرة الشريحة بنجاح 100%!');
      addLog('🔄 جاري إعادة تشغيل الشريحة وتفعيل النظام الجديد...');

      // 6. Reset device out of bootloader
      try {
        await esploader.after('hard_reset');
      } catch {}
      try {
        await transport.disconnect();
      } catch {}

      // 7. Wait 1.2s then reconnect normal serial CLI monitor
      await new Promise(r => setTimeout(r, 1200));

      addLog('🔌 استئناف الاتصال التسلسلي (WebSerial CLI) للاستماع لرسائل الإقلاع...');
      try {
        await activePort.open({
          baudRate: 115200,
          dataBits: 8,
          stopBits: 1,
          parity: 'none',
          flowControl: 'none'
        });
        try {
          await activePort.setSignals({ dataTerminalReady: false, requestToSend: false });
        } catch {}
        readLoop(activePort);
        setStatus('connected');
        addLog('✅ تم الاتصال التسلسلي بنجاح! الشريحة تعمل الآن بالنظام الجديد.');
        setTimeout(() => {
          setTab('monitor');
        }, 1500);
      } catch (reopenErr: any) {
        addLog(`ℹ️ اكتملت البرمجة بنجاح. لاستئناف الشاشة التسلسلية اضغط "اتصال باللوحة".`);
      }

    } catch (err: any) {
      addLog(`❌ فشل في عملية البرمجة: ${err.message}`);
      setFlashStatusText(`خطأ: ${err.message}`);
      // 🛡️ Ensure hardware reset and release if transport was active
      try {
        if (transport) {
          await transport.disconnect().catch(() => {});
        }
      } catch {}
      try {
        if (activePort && !activePort.readable) {
          await activePort.open({ baudRate: 115200 }).catch(() => {});
          readLoop(activePort);
          setStatus('connected');
        }
      } catch {}
    } finally {
      setIsFlashing(false);
    }
  };

  // ── Hardware Test Actions (Dual-Channel: USB + MQTT/API) ───
  const toggleGPIO = async (pin: number) => {
    const nextState = !gpioStates[pin];
    setGpioStates(prev => ({ ...prev, [pin]: nextState }));

    // 1. Send via USB WebSerial (Standard Clean Commands)
    await sendCommand(`GPIO:${pin},${nextState ? 'ON' : 'OFF'}`);
    await sendCommand(`AT+PIN=${pin},${nextState ? 1 : 0}`);

    // 2. Send via Backend MQTT API directly
    try {
      await fetch('/api/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          boardId: detectedDevice?.macAddress || 'broadcast',
          payload: {
            action: nextState ? 'ON' : 'OFF',
            pin: pin,
            state: nextState ? 'ON' : 'OFF'
          }
        })
      });
    } catch (e) {}

    addLog(`💡 GPIO ${pin} → ${nextState ? 'ON (تشغيل) ✅' : 'OFF (إطفاء) ⛔'}`);
  };

  const pulseGPIO = async (pin: number) => {
    addLog(`⚡ اختبار نبضات GPIO ${pin} (3 مرات متتالية)...`);
    for (let i = 0; i < 3; i++) {
      setGpioStates(prev => ({ ...prev, [pin]: true }));
      await sendCommand(`GPIO:${pin},ON`);
      await new Promise(r => setTimeout(r, 220));
      setGpioStates(prev => ({ ...prev, [pin]: false }));
      await sendCommand(`GPIO:${pin},OFF`);
      await new Promise(r => setTimeout(r, 220));
    }
    addLog(`✅ اكتمل اختبار نبضات GPIO ${pin} بنجاح.`);
  };

  const setAllGPIO = async (state: boolean) => {
    const testPins = [2, 4, 5, 18, 12, 14, 15, 16];
    const newStates: Record<number, boolean> = {};
    for (const p of testPins) {
      newStates[p] = state;
      await sendCommand(`GPIO:${p},${state ? 'ON' : 'OFF'}`);
    }
    setGpioStates(prev => ({ ...prev, ...newStates }));
    addLog(`💡 تم تعيين كافة مخارج الريليهات إلى: ${state ? 'تشغيل الكل (ALL ON) ✅' : 'إطفاء الكل (ALL OFF) ⛔'}`);
  };

  const runSelfTest = async () => {
    addLog('🔬 تشغيل الفحص الذاتي الشامل لكافة الحساسات والمكونات...');
    await sendCommand('SELF_TEST');
    await sendCommand('AT+TEST');
  };

  const scanPins = async () => {
    addLog('🔍 فحص حالات جميع أطراف الـ GPIO على الشريحة...');
    await sendCommand('SCAN_PINS');
    await sendCommand('AT+PINS');
  };

  // ── Filtering Device Library ──────────────────────────────
  const filteredDevices = DEVICE_LIBRARY.filter(d => {
    const matchSearch = d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.manufacturer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.chipset.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = filterCategory === 'all' || d.category === filterCategory;
    return matchSearch && matchCategory;
  });

  const isValidGPIO = (pin: number) => {
    if (pin < 0 || pin > 48) return false;
    if ([6, 7, 8, 9, 10, 11, 20, 24, 28, 29, 30, 31, 37, 38].includes(pin)) return false;
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 p-4 lg:p-6" dir="rtl">
      
      {/* ── Top Header Bar ───────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 bg-white/5 border border-white/10 backdrop-blur-xl p-5 rounded-3xl shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-blue-600 to-cyan-500 rounded-2xl shadow-lg shadow-blue-500/20 text-white">
            <Cpu size={28} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-white">
                برمجة وإعداد أجهزة IoT والشريحة (Universal Device Programmer)
              </h1>
              <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold">
                WebSerial Pro v3.0
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-1">
              برمجة، حقن الواي فاي، تخصيص المفاتيح الجدارية واختبار كافة لوحات ومتحكمات إنترنت الأشياء عبر USB مباشرة
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={baudRate} 
            onChange={e => setBaudRate(Number(e.target.value))}
            disabled={status === 'connected'}
            className="bg-slate-800/80 border border-white/10 rounded-2xl px-3 py-2.5 text-xs font-mono font-bold text-slate-300 focus:outline-none focus:border-cyan-500 transition"
          >
            <option value={921600}>921,600 Baud (High Speed)</option>
            <option value={115200}>115,200 Baud (Standard ESP32)</option>
            <option value={57600}>57,600 Baud</option>
            <option value={9600}>9,600 Baud (Arduino)</option>
          </select>

          <button
            onClick={status === 'disconnected' ? connectDevice : disconnectDevice}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl font-bold text-sm shadow-xl transition-all duration-300 ${
              status === 'connected'
                ? 'bg-rose-600/90 hover:bg-rose-700 text-white shadow-rose-600/30 border border-rose-500/30'
                : status === 'connecting'
                ? 'bg-amber-600 text-white shadow-amber-600/30 animate-pulse'
                : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-blue-600/30'
            }`}
          >
            <Usb size={18} />
            {status === 'disconnected' && 'توصيل اللوحة (Connect USB)'}
            {status === 'connecting' && 'جاري الاتصال...'}
            {status === 'connected' && 'قطع الاتصال (Disconnect)'}
            {status === 'error' && 'إعادة المحاولة'}
          </button>
        </div>
      </div>

      {/* ── Realtime Hardware Status Bar ─────────────────── */}
      <div className={`mb-6 p-4 rounded-2xl border backdrop-blur-xl flex flex-wrap items-center justify-between gap-3 text-xs font-medium transition-all ${
        status === 'connected'
          ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-lg shadow-emerald-950/20'
          : status === 'error'
          ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          : 'bg-slate-900/60 border-white/5 text-slate-400'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            status === 'connected' ? 'bg-emerald-400 animate-ping' :
            status === 'error' ? 'bg-rose-400' : 'bg-slate-500'
          }`} />
          <span className="font-bold">
            {status === 'connected' && detectedDevice
              ? `متصل باللوحة: ${detectedDevice.chipName} | MAC: ${detectedDevice.macAddress || 'غير محدد'} ${detectedDevice.ipAddress ? `| IP: ${detectedDevice.ipAddress}` : ''}`
              : status === 'connected'
              ? 'اللوحة متصلة بنجاح - في انتظار قراءة المعالج...'
              : 'اللوحة غير متصلة - اضغط على (توصيل اللوحة) لبدء البرمجة والتحكم'}
          </span>
        </div>

        {selectedDevice && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400">القالب المحدد:</span>
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-xl font-bold">
              {selectedDevice.name} ({selectedDevice.chipset})
            </span>
          </div>
        )}
      </div>

      {/* ── Navigation Tabs ──────────────────────────────── */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'detect', label: '🔍 الكشف التلقائي', icon: Radio },
          { id: 'library', label: '📚 مكتبة الأجهزة (12+)', icon: Layers },
          { id: 'wifi', label: '📶 إعداد الشبكة والسيرفر', icon: Wifi },
          { id: 'pins', label: '📌 تخصيص المخارج والمفاتيح', icon: Sliders },
          { id: 'flash', label: '⚡ برمجة الـ Firmware', icon: Zap },
          { id: 'otes', label: '🔐 أمان OTES & mTLS', icon: ShieldCheck },
          { id: 'test', label: '🔬 فحص وتجربة الهاردوير', icon: FlaskConical },
          { id: 'monitor', label: '📺 شاشة السيريال (Monitor)', icon: Terminal },
        ].map(t => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id as FlasherTab)}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-200 border ${
                isActive
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-cyan-400/40 shadow-lg shadow-blue-600/20 scale-[1.02]'
                  : 'bg-white/5 text-slate-400 hover:text-slate-200 hover:bg-white/10 border-white/5'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Main Layout: Workspace & Serial Monitor ──────── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* Left Side: Interactive Tabs (7 Columns) */}
        <div className="xl:col-span-7 space-y-6">

          {/* ── TAB 1: AUTO DETECT ────────────────────────── */}
          {tab === 'detect' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                    <Radio size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">الكشف التلقائي عن الشريحة الموصولة</h2>
                    <p className="text-xs text-slate-400">قراءة هوية المعالج، عنوان الـ MAC، وحجم ذاكرة الفلاش عبر السيريال</p>
                  </div>
                </div>
                <button
                  onClick={autoDetectDevice}
                  disabled={status !== 'connected'}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold disabled:opacity-40 transition"
                >
                  <RefreshCw size={14} />
                  إعادة الفحص
                </button>
              </div>

              {detectedDevice ? (
                <div className="space-y-4">
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold mb-3">
                      <CheckCircle2 size={18} />
                      <span>تم التعرف على الشريحة المتصلة بنجاح</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-400 block mb-1">نوع الشريحة (Chipset):</span>
                        <span className="text-white font-bold">{detectedDevice.chipName}</span>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-400 block mb-1">عنوان الماك (MAC Address):</span>
                        <span className="text-cyan-400 font-bold">{detectedDevice.macAddress || 'قيد الاسترجاع...'}</span>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-400 block mb-1">حجم الفلاش (Flash Size):</span>
                        <span className="text-amber-400 font-bold">{detectedDevice.flashSize || '4MB / 16MB'}</span>
                      </div>
                      <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                        <span className="text-slate-400 block mb-1">عنوان IP الحالي:</span>
                        <span className="text-emerald-400 font-bold">{detectedDevice.ipAddress || 'غير متصل بالواي فاي'}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xs font-bold text-slate-300 mb-3">القوالب المتوافقة المقترحة من المكتبة:</h3>
                    <div className="space-y-2">
                      {DEVICE_LIBRARY
                        .filter(d => d.chipset.toLowerCase().includes('esp32') || d.chipset.toLowerCase().includes(detectedDevice.chipName.toLowerCase()))
                        .slice(0, 3)
                        .map(device => (
                          <div
                            key={device.id}
                            onClick={() => setSelectedDevice(device)}
                            className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all ${
                              selectedDevice?.id === device.id
                                ? 'bg-blue-600/20 border-cyan-400/50 shadow-lg shadow-blue-600/10'
                                : 'bg-white/5 border-white/5 hover:border-white/20'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Cpu size={20} className={selectedDevice?.id === device.id ? 'text-cyan-400' : 'text-slate-400'} />
                              <div>
                                <p className="text-sm font-bold text-white">{device.name}</p>
                                <p className="text-xs text-slate-400">{device.manufacturer} • {device.chipset}</p>
                              </div>
                            </div>
                            {selectedDevice?.id === device.id && (
                              <span className="text-xs bg-cyan-500 text-slate-950 px-2.5 py-1 rounded-xl font-bold flex items-center gap-1">
                                <Check size={12} /> محدد
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16 px-4 border border-dashed border-white/10 rounded-2xl bg-black/20">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/20 animate-bounce">
                    <Usb size={32} />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">قم بتوصيل اللوحة عبر كابل الـ USB</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                    يدعم الكشف التلقائي كافة رقاقات ESP32, ESP32-S3, ESP8266, NodeMCU, Arduino, STM32
                  </p>
                  <button
                    onClick={connectDevice}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-blue-600/20 transition"
                  >
                    توصيل منفذ USB الآن
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB 2: DEVICE LIBRARY ─────────────────────── */}
          {tab === 'library' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center gap-3 mb-5">
                <div className="p-2.5 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <Layers size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">مكتبة الأجهزة المتوافقة (Device Library)</h2>
                  <p className="text-xs text-slate-400">اختر نوع الجهاز لتطبيق إعدادات الـ Baud rate وخريطة المخارج المناسبة له تلقائياً</p>
                </div>
              </div>

              {/* Search & Categories */}
              <div className="space-y-3 mb-5">
                <div className="relative">
                  <Search size={16} className="absolute right-4 top-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن اسم الجهاز، الشركة المصنعة (Sonoff, Shelly, MOSA, Arduino)..."
                    className="w-full bg-slate-950/80 border border-white/10 rounded-2xl pr-11 pl-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition"
                  />
                </div>

                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'all', label: 'الكل' },
                    { id: 'smart_switch', label: 'مفاتيح ذكية (Switches)' },
                    { id: 'smart_socket', label: 'مقابس ومراقبة طاقة' },
                    { id: 'sensor_node', label: 'عقد وحساسات' },
                    { id: 'gateway', label: 'بوابات ودونجل Zigbee' },
                    { id: 'thermostat', label: 'تكييف وترموستات' },
                    { id: 'security', label: 'كاميرات وأمان' },
                    { id: 'custom', label: 'مطورين ومخصص' },
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setFilterCategory(cat.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                        filterCategory === cat.id
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                          : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Device List */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredDevices.map(device => {
                  const isSelected = selectedDevice?.id === device.id;
                  return (
                    <div
                      key={device.id}
                      onClick={() => setSelectedDevice(device)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-blue-900/30 to-cyan-900/20 border-cyan-400 shadow-xl shadow-blue-900/20'
                          : 'bg-white/5 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white">{device.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-white/10 rounded-lg text-slate-300">
                              {device.chipset}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1">{device.description || `${device.manufacturer} • ${device.category}`}</p>
                          
                          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                            {device.protocol.map(p => (
                              <span key={p} className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                {p}
                              </span>
                            ))}
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              Flash: {device.flashConfig.flashSize}
                            </span>
                          </div>
                        </div>

                        {isSelected ? (
                          <div className="p-1.5 bg-cyan-500 text-slate-950 rounded-xl">
                            <Check size={16} />
                          </div>
                        ) : (
                          <button className="text-xs text-slate-400 hover:text-cyan-400 px-3 py-1 bg-white/5 rounded-xl border border-white/10">
                            تحديد
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── TAB 3: WIFI & SERVER SETUP (LIVE SYSTEM SYNC & C++ STUDIO) ── */}
          {tab === 'wifi' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-tr from-cyan-600 to-blue-500 text-white rounded-2xl shadow-lg shadow-cyan-500/20">
                    <Wifi size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-white">إعداد وحقن شبكة الواي فاي والسيرفر</h2>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2.5 py-0.5 rounded-full font-bold">
                        مزامنة حية 🟢
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      توليد كود الـ C++ تلقائياً، إرسال إعدادات الاتصال المنزلي وعنوان السيرفر للوحة وحقنها مباشرة في كود الفيرموير
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => fetchLiveBoardStatus()}
                    disabled={isQueryingLiveBoard}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold transition"
                    title="استعلام حالة الشريحة الحية عبر الشبكة أو السيريال"
                  >
                    <Activity size={14} className={isQueryingLiveBoard ? 'animate-spin text-blue-400' : ''} />
                    {isQueryingLiveBoard ? 'جاري الاستعلام...' : 'استعلام اللوحة الحية'}
                  </button>

                  <button
                    onClick={scanWifiNetworks}
                    disabled={status !== 'connected' || isScanningWifi}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded-xl text-xs font-bold disabled:opacity-40 transition"
                  >
                    <RefreshCw size={14} className={isScanningWifi ? 'animate-spin' : ''} />
                    {isScanningWifi ? 'جاري الفحص...' : 'فحص الشبكات من اللوحة'}
                  </button>
                </div>
              </div>

              {/* ── Realtime System Telemetry & Quick Selectors Bar ── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Real Homes Selector */}
                <div className="p-4 bg-slate-950/70 border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Home size={14} className="text-cyan-400" />
                      المنازل المتاحة في حسابك (Real Homes):
                    </span>
                    <span className="text-[10px] text-cyan-400/80 font-mono">
                      {systemHomes.length} مساحات
                    </span>
                  </div>
                  
                  {systemHomes.length > 0 ? (
                    <div className="flex gap-2 flex-wrap max-h-24 overflow-y-auto">
                      {systemHomes.map(h => {
                        const isSelected = homeId === h.id;
                        return (
                          <button
                            key={h.id}
                            type="button"
                            onClick={() => setHomeId(h.id)}
                            className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition ${
                              isSelected
                                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold shadow-md shadow-cyan-500/10'
                                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                            }`}
                          >
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            <span>{h.name}</span>
                            <span className="text-[10px] font-mono opacity-60">({h.id.slice(0, 8)}...)</span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 font-mono">جاري مزامنة معرفات المنازل من السيرفر...</p>
                  )}
                </div>

                {/* Real Detected Server IPs */}
                <div className="p-4 bg-slate-950/70 border border-white/10 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Server size={14} className="text-blue-400" />
                      عناوين سيرفر الرازبيري باي (Raspberry Pi 4 / Mosa OS):
                    </span>
                    <span className="text-[10px] text-emerald-400 font-bold">
                      منفذ MQTT: 8883 (mTLS مشفر) 🔒
                    </span>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {detectedServerIps.length > 0 ? (
                      detectedServerIps
                        .filter(ip => ip !== '192.168.1.103')
                        .map(ip => {
                          const isPrimary = ip === primaryServerIp || ip === '192.168.1.110';
                          const isTailscaleDomain = ip.includes('tail') || ip.includes('.ts.net');
                          const isTailscaleIp = ip.startsWith('100.');
                          
                          let badgeText = isPrimary ? 'الراسبيري باي (LAN)' : 'عنوان بديل';
                          if (isTailscaleDomain) badgeText = 'MagicDNS مشفر';
                          else if (isTailscaleIp) badgeText = 'نفق Tailscale';

                          return (
                            <button
                              key={ip}
                              type="button"
                              onClick={() => setMqttIP(ip)}
                              className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-mono transition ${
                                mqttIP === ip
                                  ? 'bg-blue-600/30 border-blue-400 text-blue-300 font-bold shadow-md shadow-blue-500/10'
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <Network size={12} />
                              {ip}
                              <span className={`text-[9px] px-1.5 py-0.5 rounded font-sans ${
                                isPrimary 
                                  ? 'bg-emerald-500/20 text-emerald-300 font-bold' 
                                  : isTailscaleDomain
                                  ? 'bg-purple-500/20 text-purple-300 font-bold'
                                  : 'bg-slate-500/20 text-slate-300'
                              }`}>
                                {badgeText}
                              </span>
                            </button>
                          );
                        })
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMqttIP('192.168.1.110')}
                        className="text-xs px-3 py-1.5 rounded-xl border bg-blue-600/20 border-blue-400 text-blue-300 font-mono font-bold"
                      >
                        192.168.1.110 (Raspberry Pi LAN)
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Discovered Networks list */}
              {discoveredNetworks.length > 0 && (
                <div className="p-4 bg-black/40 border border-white/10 rounded-2xl">
                  <p className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                    <Radio size={14} className="text-cyan-400" />
                    الشبكات التي التقطتها اللوحة (اضغط للاختيار السريع):
                  </p>
                  <div className="flex gap-2 flex-wrap max-h-32 overflow-y-auto">
                    {discoveredNetworks.map((net, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setWifiSSID(net.ssid)}
                        className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition ${
                          wifiSSID === net.ssid
                            ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 font-bold'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        <Wifi size={12} />
                        {net.ssid}
                        <span className="text-[10px] font-mono text-slate-500">({net.rssi} dBm)</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Form Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                    اسم شبكة الواي فاي المنزلية (SSID) *
                  </label>
                  <input
                    type="text"
                    value={wifiSSID}
                    onChange={e => setWifiSSID(e.target.value)}
                    placeholder="مثال: TP-Link_1C4F"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition shadow-inner"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                    كلمة مرور الواي فاي (Password) *
                  </label>
                  <div className="relative">
                    <input
                      type={showWifiPass ? 'text' : 'password'}
                      value={wifiPass}
                      onChange={e => setWifiPass(e.target.value)}
                      placeholder="كلمة المرور..."
                      className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 pl-11 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono transition shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowWifiPass(!showWifiPass)}
                      className="absolute left-3 top-3 text-slate-400 hover:text-white transition"
                    >
                      {showWifiPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      عنوان السيرفر (MQTT / Server IP) *
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">Port 8883 (mTLS)</span>
                  </div>
                  <input
                    type="text"
                    value={mqttIP}
                    onChange={e => setMqttIP(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono transition shadow-inner"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      معرّف المنزل (Home ID) *
                    </label>
                    {systemHomes.find(h => h.id === homeId) && (
                      <span className="text-[10px] text-cyan-400 font-bold">
                        {systemHomes.find(h => h.id === homeId)?.name}
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    value={homeId}
                    onChange={e => setHomeId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono transition shadow-inner"
                  />
                </div>
              </div>

              {/* ── LIVE C++ CODE GENERATOR & AUTO-INJECTION STUDIO ── */}
              <div className="p-5 bg-black/60 border border-cyan-500/30 rounded-3xl space-y-4 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-16 -top-16 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-cyan-500/20 text-cyan-400 rounded-xl border border-cyan-500/30">
                      <Code2 size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        كود الـ C++ المولد تلقائياً للفيرموير (Live C++ Code)
                        <Sparkles size={14} className="text-amber-400 animate-spin" />
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        يتحدث لحظياً مع أي تعديل على المعرف أو الشبكة أو عنوان السيرفر
                      </p>
                    </div>
                  </div>

                  {/* Actions for C++ Code */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={copyCppSnippet}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition"
                    >
                      {copiedCpp ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      {copiedCpp ? 'تم النسخ! ✅' : 'نسخ الكود'}
                    </button>

                    <button
                      type="button"
                      onClick={downloadHeaderFile}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition"
                    >
                      <Download size={14} />
                      تحميل Constants.h
                    </button>

                    <button
                      type="button"
                      onClick={injectIntoFirmwareSource}
                      disabled={isInjectingFirmware}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                    >
                      <Zap size={14} className={isInjectingFirmware ? 'animate-spin' : ''} />
                      {isInjectingFirmware ? 'جاري الحقن...' : '⚡ حقن وتحديث كود المشروع فوراً'}
                    </button>
                  </div>
                </div>

                {/* IDE-Style Syntax Highlighted Code Viewer */}
                <div className="bg-slate-950 border border-white/10 rounded-2xl p-4 font-mono text-xs text-left overflow-x-auto" dir="ltr">
                  <div className="text-slate-500 mb-2 flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span>// R1_Refactored/R1_Refactored.ino (Raspberry Pi 4 - MOSA OS)</span>
                    <span className="text-cyan-400 font-mono text-[10px]">Broker: {mqttIP}</span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-bold">const char</span>
                    <span className="text-slate-300">* </span>
                    <span className="text-blue-300">default_wifi_ssid</span>
                    <span className="text-slate-400">   = </span>
                    <span className="text-emerald-300 font-semibold">"{wifiSSID.trim()}"</span>
                    <span className="text-slate-400">;</span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-bold">const char</span>
                    <span className="text-slate-300">* </span>
                    <span className="text-blue-300">default_wifi_pass</span>
                    <span className="text-slate-400">   = </span>
                    <span className="text-emerald-300 font-semibold">"{wifiPass.trim()}"</span>
                    <span className="text-slate-400">;</span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-bold">const char</span>
                    <span className="text-slate-300">* </span>
                    <span className="text-blue-300">default_home_id</span>
                    <span className="text-slate-400">     = </span>
                    <span className="text-amber-300 font-semibold">"{homeId.trim()}"</span>
                    <span className="text-slate-400">;</span>
                  </div>
                  <div>
                    <span className="text-purple-400 font-bold">const char</span>
                    <span className="text-slate-300">* </span>
                    <span className="text-blue-300">default_mqtt_host</span>
                    <span className="text-slate-400">   = </span>
                    <span className="text-cyan-300 font-semibold">"{mqttIP.trim()}"</span>
                    <span className="text-slate-400">;</span>
                  </div>
                </div>

                {/* Injection Feedback Message */}
                {injectSuccessMsg && (
                  <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2 animate-bounce">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>{injectSuccessMsg}</span>
                  </div>
                )}
              </div>

              {/* ── LIVE CONNECTED BOARD READOUT (IF AVAILABLE) ── */}
              {liveBoardData && (
                <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-white font-bold">
                      بيانات الشريحة الحية: <span className="font-mono text-cyan-300">{liveBoardData.boardId}</span>
                    </span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-300">IP: <span className="font-mono text-white">{liveBoardData.ip}</span></span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-300">RSSI: <span className="font-mono text-emerald-400">{liveBoardData.rssi} dBm</span></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold ${
                      liveBoardData.mqttConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      MQTT: {liveBoardData.mqttConnected ? 'متصل بنجاح 🟢' : 'غير متصل 🔴'}
                    </span>
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-xl text-[11px] font-bold">
                      {liveBoardData.activeDevices} مخارج نشطة
                    </span>
                  </div>
                </div>
              )}

              {/* Save Success Alert */}
              {wifiSaveSuccess && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-emerald-400 text-xs font-bold animate-pulse">
                  <CheckCircle2 size={16} />
                  <span>تم إرسال وحقن إعدادات الشبكة بنجاح! اللوحة تعيد التشغيل الآن وستتصل بالراوتر وسيرفر MQTT خلال ثوانٍ...</span>
                </div>
              )}

              {/* Direct Save & Send to Hardware Button */}
              <button
                onClick={sendWifiConfig}
                disabled={status !== 'connected' || !wifiSSID}
                className="w-full py-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-cyan-600/30 disabled:opacity-40 transition flex items-center justify-center gap-2"
              >
                <Send size={18} />
                حفظ وإرسال إعدادات الواي فاي والسيرفر للوحة عبر USB / NVS Flash
              </button>
            </div>
          )}

          {/* ── TAB 4: PIN MAPPING & SWITCH SETUP ─────────── */}
          {tab === 'pins' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                    <Sliders size={22} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">تعريف وتخصيص المخارج والمفاتيح الجدارية</h2>
                    <p className="text-xs text-slate-400">تحديد أرقام أطراف الـ GPIO لكل ريليه ومفتاح سويتش خارجي وحساس</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {Object.entries(pinMap).map(([name, pin]) => {
                  const safe = isValidGPIO(pin);
                  const isRelay = name.toLowerCase().includes('relay');
                  const switchPin = customSwitchPins[name] ?? -1;
                  const activeState = activeStates[name] || 'HIGH';
                  const switchMode = switchModes[name] || 'GND';

                  return (
                    <div key={name} className="p-4 bg-slate-950/60 border border-white/10 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white uppercase">{name.replace('_', ' ')}</span>
                          {!safe && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg flex items-center gap-1">
                              <AlertTriangle size={10} /> غير آمن
                            </span>
                          )}
                        </div>

                        {/* Relay GPIO Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 font-mono">منفذ GPIO:</span>
                          <input
                            type="number"
                            value={pin}
                            onChange={e => setPinMap(prev => ({ ...prev, [name]: parseInt(e.target.value) || 0 }))}
                            className="w-16 bg-slate-800 border border-white/10 rounded-xl px-2 py-1.5 text-center font-mono font-bold text-xs text-cyan-400"
                            min={0}
                            max={48}
                          />
                        </div>
                      </div>

                      {/* External Switch & Logic Settings for Relays */}
                      {isRelay && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-2 border-t border-white/5 text-xs">
                          
                          {/* Switch Pin Selector */}
                          <div>
                            <span className="text-slate-400 block mb-1">منفذ السويتش (Switch Pin):</span>
                            <select
                              value={switchPin}
                              onChange={e => setCustomSwitchPins(prev => ({ ...prev, [name]: Number(e.target.value) }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200 font-mono"
                            >
                              <option value={-1}>بدون سويتش (-1)</option>
                              {[2, 4, 5, 12, 13, 14, 15, 16, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39].map(p => (
                                <option key={p} value={p}>GPIO {p}</option>
                              ))}
                            </select>
                          </div>

                          {/* Active State Selector */}
                          <div>
                            <span className="text-slate-400 block mb-1">حالة التفعيل (Active State):</span>
                            <select
                              value={activeState}
                              onChange={e => setActiveStates(prev => ({ ...prev, [name]: e.target.value as 'HIGH' | 'LOW' }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                            >
                              <option value="HIGH">HIGH (3.3V موجب)</option>
                              <option value="LOW">LOW (0V سالبة)</option>
                            </select>
                          </div>

                          {/* Switch Mode Selector */}
                          <div>
                            <span className="text-slate-400 block mb-1">توصيل المفتاح:</span>
                            <select
                              value={switchMode}
                              onChange={e => setSwitchModes(prev => ({ ...prev, [name]: e.target.value as 'GND' | '3.3V' }))}
                              className="w-full bg-slate-800 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-slate-200"
                            >
                              <option value="GND">سحب للأرضي (GND)</option>
                              <option value="3.3V">سحب للموجب (3.3V)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                <button
                  onClick={applyPinSettings}
                  disabled={status !== 'connected'}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-600/20 disabled:opacity-40 transition flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={18} />
                  تطبيق وحفظ إعدادات المخارج على الشريحة
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 5: FLASH FIRMWARE ─────────────────────── */}
          {tab === 'flash' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Zap size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">مبرمجة وتثبيت الـ Firmware الحقيقي (WebSerial Flasher)</h2>
                  <p className="text-xs text-slate-400">حرق نظام MOSA المعتمد مباشرة من المتصفح لشريحة ESP32 / ESP32-S3 عبر بروتوكول ROM Bootloader</p>
                </div>
              </div>

              {selectedDevice && (
                <div className="p-4 bg-slate-950/80 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-slate-400 block">المتحكم المستهدف:</span>
                    <span className="text-sm font-black text-white">{selectedDevice.name}</span>
                    <span className="text-xs font-mono text-cyan-400 block mt-0.5">
                      {selectedDevice.chipset} | Mode: {selectedDevice.flashConfig.flashMode} | Baud: {flashBaudRate} Baud
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-xl font-bold">
                      {detectedDevice?.chipName || selectedDevice.chipset}
                    </span>
                    <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-xl font-bold">
                      v{selectedDevice.firmwareVersion || '3.0.0'}
                    </span>
                  </div>
                </div>
              )}

              {isFlashing ? (
                <div className="p-6 bg-slate-950/95 border border-cyan-500/30 rounded-3xl space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-cyan-400 flex items-center gap-2">
                      <RefreshCw size={16} className="animate-spin" />
                      {flashStatusText || 'جاري كتابة الـ Firmware على الشريحة...'}
                    </span>
                    <span className="font-mono text-white text-base font-black">{flashProgress}%</span>
                  </div>
                  
                  <div className="w-full bg-slate-800 rounded-full h-4 overflow-hidden p-0.5 border border-white/10 shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400 h-full rounded-full transition-all duration-300 shadow-lg shadow-cyan-500/50"
                      style={{ width: `${flashProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1">
                    <span>
                      {flashBytesWritten > 0 ? `${(flashBytesWritten / 1024).toFixed(0)} KB مكتوبة` : 'تهيئة...'}
                    </span>
                    <span>
                      {flashBytesTotal > 0 ? `الحجم الإجمالي: ${(flashBytesTotal / 1024).toFixed(0)} KB` : ''}
                    </span>
                  </div>
                </div>
              ) : (
               <div className="space-y-4">
                  {/* Invalid Header Emergency Rescue Banner */}
                  {serialLog.some(l => l.includes('invalid header')) && (
                    <div className="p-4 bg-rose-950/60 border border-rose-500/50 rounded-2xl flex items-start gap-3 text-xs text-rose-200">
                      <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <span className="font-bold text-rose-300 block text-sm">تم رصد تلف في Bootloader الشريحة (invalid header: 0xffffffff)!</span>
                        <p className="text-slate-300 leading-relaxed">
                          الشريحة تفتقر إلى Second-Stage Bootloader سليم في العنوان 0x0 أو تم مسح ذاكرة الـ Flash بالكامل.
                          <strong className="text-emerald-300"> الحل الفوري:</strong> اختر وضع <strong>"تثبيت كامل للمصنع (Full Factory Image 0x0)"</strong> بالأسفل، واضغط <strong>"بدء برمجة وحرق السوفتوير"</strong>. سيقوم النظام بكتابة Bootloader و Partitions و App ككتلة واحدة ويصلح اللوحة فوراً.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mode Selector */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => { setFlashModeType('full'); setFlashAddress('0x0'); }}
                      className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
                        flashModeType === 'full'
                          ? 'bg-amber-500/15 border-amber-400 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-400'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-white">تثبيت كامل للمصنع (Full Image)</span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 py-0.5 rounded font-bold">إصلاح Bootloader</span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed">حرق صورة المصنع الكاملة من الصفر تشمل Bootloader وPartitions وMOSA Node v3 (Address: 0x0). يحل مشكلة invalid header فوراً.</p>
                      </div>
                      <span className="text-[10px] font-mono text-amber-400 mt-2 block font-bold">Offset: 0x0 (Factory Complete)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFlashModeType('app'); setFlashAddress('0x10000'); }}
                      className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
                        flashModeType === 'app'
                          ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-white">البرنامج الرسمي (App Only)</span>
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-mono px-1.5 py-0.5 rounded font-bold">تحديث سريع</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">تثبيت كود التطبيق فقط مع الحفاظ على Bootloader الحالي (Address: 0x10000).</p>
                      </div>
                      <span className="text-[10px] font-mono text-cyan-400 mt-2 block">Offset: 0x10000 (App Partition)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => { setFlashModeType('custom'); }}
                      className={`p-4 rounded-2xl border text-right transition flex flex-col justify-between ${
                        flashModeType === 'custom'
                          ? 'bg-purple-500/15 border-purple-400 text-white shadow-lg shadow-purple-500/10'
                          : 'bg-black/30 border-white/10 text-slate-400 hover:border-white/20'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-black text-white">ملف مخصص (.bin)</span>
                          <span className="text-[10px] bg-purple-500/20 text-purple-300 font-mono px-1.5 py-0.5 rounded font-bold">متقدم</span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">رفع وتثبيت أي ملف Binary مع خيار الدمج التلقائي مع Bootloader المصنع</p>
                      </div>
                      <span className="text-[10px] font-mono text-purple-400 mt-2 block">Custom Binary</span>
                    </button>
                  </div>

                  {/* Custom File Upload Box (If custom mode or optional upload) */}
                  {flashModeType === 'custom' && (
                    <div className="space-y-3 p-4 bg-black/40 border border-purple-500/30 rounded-2xl">
                      <div className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 rounded-2xl p-5 text-center bg-black/20 transition-all">
                        <input
                          type="file"
                          accept=".bin"
                          onChange={handleCustomFileUpload}
                          className="hidden"
                          id="firmware-file-picker"
                        />
                        <label htmlFor="firmware-file-picker" className="cursor-pointer block">
                          <Upload size={28} className="mx-auto text-purple-400 mb-2" />
                          <span className="text-xs font-bold text-white block mb-1">
                            {uploadedFirmwareName ? `تم اختيار: ${uploadedFirmwareName}` : 'انقر لاختيار ملف Binary (.bin) من جهازك'}
                          </span>
                          <span className="text-[11px] text-slate-500 block">
                            يدعم ملفات التطبيق (App Binaries مثل R1_Refactored.ino.bin) أو الصور المدمجة
                          </span>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-black/30 border border-purple-500/20 rounded-xl">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="auto-merge-bootloader-checkbox"
                            checked={autoMergeBootloader}
                            onChange={e => setAutoMergeBootloader(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 text-purple-500 focus:ring-0 bg-slate-900 cursor-pointer"
                          />
                          <label htmlFor="auto-merge-bootloader-checkbox" className="text-xs text-purple-200 font-bold cursor-pointer">
                            دمج تلقائي مع Bootloader و Partitions المصنع (العنوان 0x0)
                          </label>
                        </div>
                        <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold">
                          {autoMergeBootloader ? 'موصى به (يصلح إقلاع اللوحة)' : `حرق مباشر على ${flashAddress}`}
                        </span>
                      </div>

                      {!autoMergeBootloader && (
                        <div className="flex items-center gap-3">
                          <label className="text-xs text-slate-400 font-medium">عنوان كتابة الـ Flash (Address Hex):</label>
                          <input
                            type="text"
                            value={flashAddress}
                            onChange={e => setFlashAddress(e.target.value)}
                            placeholder="0x10000"
                            className="w-32 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-center font-mono text-cyan-400 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Flash Engine Settings Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-black/25 border border-white/5 rounded-2xl">
                    <div>
                      <label className="text-xs font-bold text-slate-300 block mb-1.5">سرعة الرفع (Flashing Baud Rate):</label>
                      <select
                        value={flashBaudRate}
                        onChange={e => setFlashBaudRate(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                      >
                        <option value={460800}>460,800 Baud (السرعة القياسية الموصى بها)</option>
                        <option value={921600}>921,600 Baud (سرعة فائقة للوحات الحديثة)</option>
                        <option value={115200}>115,200 Baud (الوضع الآمن للكوابل الطويلة)</option>
                      </select>
                    </div>

                    <div className="space-y-1 pt-4 md:pt-6">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="erase-flash-checkbox"
                          checked={eraseBeforeFlash}
                          onChange={e => setEraseBeforeFlash(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-700 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                        />
                        <label htmlFor="erase-flash-checkbox" className="text-xs text-slate-300 font-bold cursor-pointer">
                          مسح كامل لذاكرة الشريحة (Full Erase) قبل الرفع
                        </label>
                      </div>
                      <p className="text-[10px] text-amber-400/90 leading-tight pr-6">
                        ⚠️ تنبيه: مسح الذاكرة بالكامل يمسح Bootloader الشريحة ويسبب خطأ (invalid header) ما لم تكن في وضع "تثبيت كامل للمصنع (0x0)". اتركه غير مفعل للأمان.
                      </p>
                    </div>
                  </div>

                  {/* Troubleshooting Tip Notice */}
                  <div className="p-3.5 bg-blue-950/30 border border-blue-500/20 rounded-2xl flex items-start gap-2.5 text-xs text-blue-200">
                    <Info size={16} className="text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block mb-0.5">نصيحة هامة لضمان نجاح البرمجة عبر المتصفح:</span>
                      <p className="text-[11px] text-slate-300 leading-relaxed">
                        إذا توقفت المزامنة عند رسالة (Connecting...)، اضغط باستمرار على زر <strong>BOOT</strong> في لوحة ESP حتى يبدأ شريط الرفع ثم أفلته. بعد اكتمال البرمجة سيعاد تشغيل الشريحة تلقائياً واستئناف شاشة المراقبة.
                      </p>
                    </div>
                  </div>

                  {/* CRITICAL: Partition Scheme Warning */}
                  <div className="p-4 bg-rose-950/40 border-2 border-rose-500/40 rounded-2xl space-y-2">
                    <div className="flex items-start gap-2.5 text-rose-200">
                      <AlertTriangle size={20} className="text-rose-400 shrink-0 mt-0.5 animate-pulse" />
                      <div className="text-xs">
                        <span className="font-black block mb-1 text-rose-300">⚠️ CRITICAL: ESP32-S3 Partition Scheme Error</span>
                        <p className="text-[11px] text-slate-200 leading-relaxed mb-2">
                          The current firmware binary is <strong>1.32 MB</strong> but the default partition table only allocates <strong>1.28 MB</strong> for the app. This causes:
                        </p>
                        <pre className="bg-black/40 border border-rose-500/30 rounded-lg p-2 text-[10px] font-mono text-rose-300 mb-2 overflow-x-auto">
E (242) esp_image: Image length 1318256 doesn't fit in partition length 1310720{'\n'}E (243) boot: No bootable app partitions in the partition table
                        </pre>
                        <p className="text-[11px] text-slate-200 leading-relaxed mb-2">
                          <strong className="text-amber-300">FIX REQUIRED:</strong> Re-compile <code className="bg-black/40 px-1.5 py-0.5 rounded text-cyan-300">R1_Refactored.ino</code> in Arduino IDE with:
                        </p>
                        <ul className="text-[10px] text-slate-300 space-y-1 list-disc list-inside ml-2">
                          <li>Board: <strong className="text-white">ESP32S3 Dev Module</strong></li>
                          <li>Flash Size: <strong className="text-white">8MB (64Mb)</strong></li>
                          <li>Partition Scheme: <strong className="text-emerald-300">Huge APP (3MB No OTA/1MB SPIFFS)</strong></li>
                        </ul>
                        <p className="text-[10px] text-blue-300 mt-2">
                          Then upload the new <code className="bg-black/40 px-1 rounded">partitions.bin</code> to <code className="bg-black/40 px-1 rounded">apps/api/uploads/firmware/</code>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 italic">
                          📖 Full fix guide: <code className="bg-black/40 px-1 rounded text-cyan-400">docs/ESP32_S3_PARTITION_FIX.md</code>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={flashFirmware}
                    disabled={status !== 'connected' || isFlashing}
                    className="w-full py-4 bg-gradient-to-r from-amber-600 via-orange-600 to-rose-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-600/20 disabled:opacity-40 transition flex items-center justify-center gap-2"
                  >
                    <Zap size={18} />
                    بدء برمجة وحرق السوفتوير الفعلي (Flash Firmware via WebSerial)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: OTES & mTLS PROVISIONING ────────────── */}
          {tab === 'otes' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">تسجيل الأجهزة الآمن (OTES Provisioning & mTLS)</h2>
                    <p className="text-xs text-slate-400">توليد أسرار التسجيل لمرة واحدة وتوقيع شهادات هوية الأجهزة بدون تمرير المفاتيح الخاصة</p>
                  </div>
                </div>
                <button
                  onClick={downloadCaChain}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 rounded-xl text-xs font-bold transition"
                >
                  <Download size={14} className="text-cyan-400" />
                  حزمة شهادات CA
                </button>
              </div>

              {otesStatusMsg && (
                <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
                  otesStatusMsg.startsWith('✅') || otesStatusMsg.startsWith('🎉') || otesStatusMsg.startsWith('⚡')
                    ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                }`}>
                  <Info size={16} />
                  <span>{otesStatusMsg}</span>
                </div>
              )}

              {/* Step 1: Token Generation */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xs font-black">1</span>
                    <h3 className="font-bold text-sm text-white">توليد رمز التسجيل لمرة واحدة (OTES Token)</h3>
                  </div>
                  <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                    صلاحية 5 دقائق • استخدام واحد
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-medium">عنوان الماك للوحة (Device MAC):</label>
                    <input
                      type="text"
                      value={otesMacInput || detectedDevice?.macAddress || ''}
                      onChange={e => setOtesMacInput(e.target.value)}
                      placeholder="مثال: 30:30:F9:6A:1F:5C"
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-cyan-400 font-mono focus:outline-none focus:border-cyan-500 transition"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1 font-medium">المنزل المرتبط (Home ID):</label>
                    <input
                      type="text"
                      value={homeId}
                      readOnly
                      className="w-full bg-slate-950/40 border border-white/5 rounded-xl px-3.5 py-2.5 text-xs text-slate-400 font-mono cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={generateOtesToken}
                    disabled={isGeneratingToken}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-600/20 disabled:opacity-40 transition flex items-center justify-center gap-2"
                  >
                    <KeyRound size={16} />
                    {isGeneratingToken ? 'جاري التوليد...' : 'توليد رمز تسجيل جديد (Generate OTES Token)'}
                  </button>

                  {otesToken && (
                    <button
                      onClick={sendOtesTokenToBoard}
                      disabled={status !== 'connected'}
                      className="py-3 px-5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/20 disabled:opacity-40 transition flex items-center justify-center gap-2"
                    >
                      <Usb size={16} />
                      إرسال للوحة عبر USB (Auto-Enroll)
                    </button>
                  )}
                </div>

                {otesToken && (
                  <div className="p-4 bg-slate-950/80 border border-cyan-500/30 rounded-xl font-mono text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">الرمز السري النشط:</span>
                      <button
                        onClick={() => {
                          if (typeof navigator !== 'undefined') {
                            navigator.clipboard.writeText(otesToken);
                            addLog('📋 تم نسخ رمز OTES للحافظة');
                          }
                        }}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                      >
                        <Copy size={12} /> نسخ الرمز
                      </button>
                    </div>
                    <div className="text-lg font-black text-cyan-400 tracking-wider bg-black/40 p-2.5 rounded-lg border border-white/5 text-center">
                      {otesToken}
                    </div>
                    <div className="text-[11px] text-slate-500 text-center font-sans">
                      الأمر التسلسلي: <code className="text-amber-400 font-mono font-bold">OTES:{otesToken}</code>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Manual CSR Signing & Verification Inspector */}
              <div className="bg-black/30 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xs font-black">2</span>
                  <h3 className="font-bold text-sm text-white">توقيع طلب الشهادة (Manual CSR Signing Bench)</h3>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1 font-medium">طلب الشهادة بصيغة PEM (Certificate Signing Request):</label>
                  <textarea
                    rows={4}
                    value={csrInput}
                    onChange={e => setCsrInput(e.target.value)}
                    placeholder="-----BEGIN CERTIFICATE REQUEST-----&#10;...&#10;-----END CERTIFICATE REQUEST-----"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl p-3 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-purple-500 transition scrollbar-thin"
                    dir="ltr"
                  />
                </div>

                <button
                  onClick={submitManualCsr}
                  disabled={isSigningCsr || !otesToken || !csrInput.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/20 disabled:opacity-40 transition flex items-center justify-center gap-2"
                >
                  <FileCode size={16} />
                  {isSigningCsr ? 'جاري التحقق والتوقيع...' : 'توقيع الشهادة عبر Intermediate CA (Sign CSR)'}
                </button>

                {signedCert && (
                  <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
                      <span>✅ شهادة العميل الموقعة (mTLS Client Certificate):</span>
                      <button
                        onClick={() => {
                          if (typeof navigator !== 'undefined') {
                            navigator.clipboard.writeText(signedCert);
                            addLog('📋 تم نسخ الشهادة الموقعة للحافظة');
                          }
                        }}
                        className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                      >
                        <Copy size={12} /> نسخ الشهادة
                      </button>
                    </div>
                    <pre className="p-3 bg-black/50 border border-white/5 rounded-lg text-[10px] font-mono text-emerald-300 overflow-x-auto max-h-40 scrollbar-thin" dir="ltr">
                      {signedCert}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── TAB 6: HARDWARE TEST & QUICK ACTIONS ─────── */}
          {tab === 'test' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-6">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                  <FlaskConical size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-black text-white">فحص وتجربة الهاردوير المباشرة (Hardware Test)</h2>
                  <p className="text-xs text-slate-400">اختبار فوري لتشغيل وإطفاء الريليهات وتشغيل الفحص الذاتي عبر الـ USB</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={runSelfTest}
                  disabled={status !== 'connected'}
                  className="p-3.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-2xl text-xs font-bold disabled:opacity-40 transition flex flex-col items-center gap-1.5"
                >
                  <Activity size={20} className="text-blue-400" />
                  فحص ذاتي (Self-Test)
                </button>
                <button
                  onClick={scanPins}
                  disabled={status !== 'connected'}
                  className="p-3.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-2xl text-xs font-bold disabled:opacity-40 transition flex flex-col items-center gap-1.5"
                >
                  <Sliders size={20} className="text-purple-400" />
                  فحص المخارج (Pins)
                </button>
                <button
                  onClick={() => sendCommand('GET_DEVICES')}
                  disabled={status !== 'connected'}
                  className="p-3.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-2xl text-xs font-bold disabled:opacity-40 transition flex flex-col items-center gap-1.5"
                >
                  <Radio size={20} className="text-emerald-400" />
                  جلب الأجهزة المعرفة
                </button>
              </div>

              {/* Direct GPIO Output Toggles */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <p className="text-xs font-bold text-slate-300">تحكم واختبار فوري بمخارج الريليهات (Live GPIO Toggle):</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAllGPIO(true)}
                      disabled={status !== 'connected'}
                      className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-[11px] font-bold disabled:opacity-40 transition cursor-pointer"
                    >
                      ⚡ تشغيل الكل (ALL ON)
                    </button>
                    <button
                      onClick={() => setAllGPIO(false)}
                      disabled={status !== 'connected'}
                      className="px-3 py-1 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-[11px] font-bold disabled:opacity-40 transition cursor-pointer"
                    >
                      🛑 إطفاء الكل (ALL OFF)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[2, 4, 5, 18, 12, 14, 15, 16].map(pin => {
                    const isOn = gpioStates[pin] || false;
                    return (
                      <div
                        key={pin}
                        className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-2 ${
                          isOn
                            ? 'bg-emerald-600/25 border-emerald-400 text-emerald-300 shadow-lg shadow-emerald-600/20'
                            : 'bg-white/5 border-white/10 text-slate-300'
                        }`}
                      >
                        <button
                          onClick={() => toggleGPIO(pin)}
                          disabled={status !== 'connected'}
                          className="w-full text-center cursor-pointer disabled:opacity-40"
                        >
                          <Power size={20} className={`mx-auto mb-1 ${isOn ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
                          <span className="font-mono font-black text-xs block">GPIO {pin}</span>
                          <span className="text-[10px] font-bold uppercase mt-0.5 block">
                            {isOn ? 'ON (مفعل)' : 'OFF (مطفأ)'}
                          </span>
                        </button>
                        
                        {/* Quick Pulse Test Button */}
                        <button
                          onClick={() => pulseGPIO(pin)}
                          disabled={status !== 'connected'}
                          className="w-full py-1 bg-white/5 hover:bg-cyan-500/20 text-slate-400 hover:text-cyan-300 rounded-lg text-[10px] font-bold transition border border-white/5 cursor-pointer disabled:opacity-40"
                          title="إرسال 3 نبضات متتالية لاختبار الريليه أو الـ LED"
                        >
                          ⚡ اختبار نبض (3x)
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quick Node Commands */}
              <div>
                <p className="text-xs font-bold text-slate-300 mb-2">أوامر سريعة للوحة:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { cmd: 'STATUS', label: '📊 فحص الحالة' },
                    { cmd: 'DEVICES', label: '🔌 فحص المنافذ' },
                    { cmd: `SET_MQTT_AUTH:${detectedDevice?.macAddress ? `MosaNode_${detectedDevice.macAddress.replace(/:/g, '').toUpperCase()}` : 'MosaNode_441BF68DB5A0'},mtls`, label: '🔒 تفعيل اتصال MQTT' },
                    { cmd: 'REBOOT', label: '🔄 إعادة تشغيل' },
                    { cmd: 'OTA_CHECK', label: '⬆️ فحص تحديث OTA' },
                    { cmd: 'FACTORY_RESET', label: '🗑️ ضبط المصنع' },
                  ].map(({ cmd, label }) => (
                    <button
                      key={cmd}
                      onClick={() => sendCommand(cmd)}
                      disabled={status !== 'connected'}
                      className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-white/5 disabled:opacity-40 transition"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 7: SERIAL MONITOR (In-Tab View for Mobile) ── */}
          {tab === 'monitor' && (
            <div className="bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-6 shadow-2xl xl:hidden">
              <p className="text-xs text-slate-400 mb-2">شاشة المراقبة متاحة باللوحة الجانبية في الشاشات الكبيرة.</p>
            </div>
          )}
        </div>

        {/* Right Side: High-Performance Glassmorphic Serial Monitor (5 Columns) */}
        <div className="xl:col-span-5 bg-slate-900/60 border border-white/10 backdrop-blur-xl rounded-3xl p-5 shadow-2xl flex flex-col h-[640px]">
          
          <div className="flex items-center justify-between mb-3 pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-cyan-400" />
              <h3 className="font-mono font-bold text-xs text-white">
                SERIAL MONITOR ({baudRate} BAUD)
              </h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSerialLog([])}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 bg-white/5 rounded-xl border border-white/10 transition flex items-center gap-1"
              >
                <Trash2 size={12} /> مسح السجل
              </button>
            </div>
          </div>

          {/* Terminal Console Logs */}
          <div
            ref={logRef}
            className="flex-1 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 bg-black/60 rounded-2xl p-3.5 border border-white/5 scrollbar-thin scrollbar-thumb-white/10"
            dir="ltr"
          >
            {serialLog.length === 0 ? (
              <div className="text-center py-24 text-slate-500">
                <Terminal size={28} className="mx-auto mb-2 opacity-40" />
                <p>في انتظار البيانات والأوامر التسلسلية...</p>
              </div>
            ) : (
              serialLog.map((line, i) => {
                const isSuccess = line.includes('✅') || line.includes('[WiFi]') || line.includes('PASS') || line.includes('success');
                const isError = line.includes('❌') || line.includes('Error') || line.includes('FAIL') || line.includes('Exception');
                const isWarning = line.includes('⚠️') || line.includes('Warning') || line.includes('WAIT');
                const isMqtt = line.includes('[MQTT]');
                const isCmd = line.startsWith('>>') || line.startsWith('>');
                
                return (
                  <div
                    key={i}
                    className={`break-all ${
                      isSuccess ? 'text-emerald-400' :
                      isError ? 'text-rose-400 font-bold' :
                      isWarning ? 'text-amber-400' :
                      isMqtt ? 'text-cyan-400' :
                      isCmd ? 'text-purple-400 font-bold' :
                      'text-slate-300'
                    }`}
                  >
                    {line}
                  </div>
                );
              })
            )}
          </div>

          {/* Direct CLI Command Input */}
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={cliInput}
              onChange={e => setCliInput(e.target.value)}
              placeholder="أرسل أمر مباشر (مثال: STATUS أو SCAN أو REBOOT)..."
              disabled={status !== 'connected'}
              className="flex-1 bg-slate-950/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-40 transition"
              onKeyDown={async e => {
                if (e.key === 'Enter' && cliInput.trim()) {
                  await sendCommand(cliInput.trim());
                  setCliInput('');
                }
              }}
            />
            <button
              onClick={async () => {
                if (cliInput.trim()) {
                  await sendCommand(cliInput.trim());
                  setCliInput('');
                }
              }}
              disabled={status !== 'connected' || !cliInput.trim()}
              className="px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-2xl text-xs font-bold disabled:opacity-40 transition flex items-center justify-center shadow-lg shadow-blue-600/20"
            >
              <Send size={14} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
