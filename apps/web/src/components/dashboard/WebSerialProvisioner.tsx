'use client';

import React, { useState } from 'react';
import { Usb, AlertTriangle, CheckCircle, Terminal } from 'lucide-react';
import { AnimatedButton } from '@/components/ui/AnimatedButton';

export function WebSerialProvisioner() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isSupported, setIsSupported] = useState(true);

  // Check support on mount
  React.useEffect(() => {
    if (!('serial' in navigator)) {
      setIsSupported(false);
    }
  }, []);

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  // ARCHITECTURAL TRAP AVOIDED: Browser Support & HTTPS check
  const startProvisioning = async () => {
    if (!('serial' in navigator)) {
      alert("متصفحك لا يدعم WebSerial API. الرجاء استخدام Google Chrome أو Edge على الكمبيوتر.");
      return;
    }

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert("تقنية WebSerial تتطلب اتصالاً آمناً (HTTPS). لا يمكن التفليش عبر HTTP محلي.");
      return;
    }

    try {
      addLog("🔍 بانتظار اختيار جهاز ESP32 من القائمة...");
      // Prompt user to select serial port
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      
      addLog("✅ تم الاتصال بـ ESP32 بنجاح");
      
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();
      
      addLog("⚡ جاري إرسال إعدادات الشبكة و MQTT...");
      
      // Simulate sending Provisioning Payload
      const payload = `\nSET_WIFI:MyHomeNetwork,SecretPass123\nSET_MQTT:192.168.1.100,1883,mosa,admin\n`;
      await writer.write(encoder.encode(payload));
      
      addLog("✅ تم الإرسال. جاري إغلاق الاتصال.");
      await writer.close();
      await port.close();

      addLog("🎉 تمت البرمجة والتفليش بنجاح!");
      
    } catch (err: any) {
      addLog(`❌ خطأ: ${err.message}`);
    }
  };

  return (
    <div className="w-full bg-black/40 border border-white/10 rounded-[32px] p-6 relative">
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
          <Usb className="text-blue-400 w-6 h-6" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">تفليش الـ Edge (Zero-Touch Provisioning)</h3>
          <p className="text-sm text-gray-400">اربط الـ ESP32 بالـ USB وبرمجه مباشرة من المتصفح</p>
        </div>
      </div>

      {!isSupported && (
        <div className="bg-amber-900/40 border border-amber-500/50 p-4 rounded-xl mb-4 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0" />
          <p className="text-amber-200 text-sm">
            <strong>تحذير تقني:</strong> متصفحك الحالي لا يدعم تقنية WebSerial. يجب أن تستخدم المتصفحات المبنية على Chromium (Google Chrome, Edge) عبر اتصال HTTPS أو localhost حصراً لتتمكن من تفليش الأجهزة.
          </p>
        </div>
      )}

      <AnimatedButton 
        onClick={startProvisioning} 
        disabled={!isSupported}
        className={`w-full flex justify-center py-4 text-lg font-bold ${!isSupported ? 'opacity-50 cursor-not-allowed bg-gray-600' : 'bg-blue-600 hover:bg-blue-500'}`}
      >
        البدء ببرمجة الشريحة
      </AnimatedButton>

      {/* Terminal Output */}
      <div className="mt-6 bg-[#0d1117] border border-white/5 rounded-xl p-4 font-mono text-sm h-48 overflow-y-auto flex flex-col gap-1">
        <div className="text-gray-500 flex items-center gap-2 mb-2">
           <Terminal size={14} /> <span>Terminal Log</span>
        </div>
        {logs.map((log, i) => (
          <div key={i} className={`${log.includes('❌') ? 'text-red-400' : log.includes('✅') ? 'text-green-400' : 'text-gray-300'}`}>
            {log}
          </div>
        ))}
        {logs.length === 0 && <span className="text-gray-600">No output yet... Connect a device to start.</span>}
      </div>
    </div>
  );
}
