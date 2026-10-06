import React, { useState } from 'react';
import { Bluetooth, X, Wifi, ShieldCheck, Search } from 'lucide-react';

export default function BLEPairingModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [status, setStatus] = useState('جاهز للبحث عن أجهزة MOSA عبر البلوتوث');
  const [ssid, setSsid] = useState('');
  const [pass, setPass] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const startBluetoothScan = async () => {
    if (!navigator.bluetooth) {
      setStatus("عذراً، متصفحك لا يدعم Web Bluetooth API. يرجى استخدام Chrome.");
      return;
    }

    setIsScanning(true);
    setStatus("جاري البحث عن أجهزة MOSA القريبة...");

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'MOSA-ESP32' }],
        optionalServices: ['4fafc201-1fb5-459e-8fcc-c5c9c331914b']
      });

      setStatus(`تم الاتصال بجهاز: ${device.name}. جاري تجهيز القناة الآمنة...`);
      
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService('4fafc201-1fb5-459e-8fcc-c5c9c331914b');
      const characteristic = await service?.getCharacteristic('beb5483e-36e1-4688-b7f5-ea07361b26a8');

      // Prepare provisioning payload
      const payload = JSON.stringify({
        ssid,
        pass,
        homeId: "home_12345", // Dynamic in real app
        deviceId: "device_" + Math.floor(Math.random() * 1000)
      });

      const encoder = new TextEncoder();
      await characteristic?.writeValue(encoder.encode(payload));

      setStatus("✅ تم نقل الإعدادات بنجاح! الجهاز سيقوم بإعادة التشغيل والاتصال بالواي فاي.");
      setIsScanning(false);
      
    } catch (error: any) {
      setStatus(`❌ فشل الاتصال: ${error.message}`);
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in" dir="rtl">
      <div className="bg-[#0b0e14] border border-blue-500/30 rounded-3xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(37,99,235,0.2)]">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Bluetooth size={24} className="text-blue-400" />
              ربط جهاز جديد (BLE)
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X size={24} />
            </button>
          </div>

          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                <Wifi size={16} /> شبكة الواي فاي
              </label>
              <input 
                type="text" 
                value={ssid}
                onChange={e => setSsid(e.target.value)}
                placeholder="اسم الشبكة"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500" 
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
                <ShieldCheck size={16} /> كلمة السر
              </label>
              <input 
                type="password" 
                value={pass}
                onChange={e => setPass(e.target.value)}
                placeholder="كلمة سر الواي فاي"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500" 
              />
            </div>
          </div>

          <div className="p-4 bg-blue-900/20 border border-blue-500/20 rounded-xl mb-6 text-sm text-blue-200 text-center">
            {status}
          </div>

          <button 
            onClick={startBluetoothScan}
            disabled={!ssid || !pass || isScanning}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            {isScanning ? <span className="animate-spin text-xl">⏳</span> : <Search size={20} />}
            البحث عن جهاز للربط
          </button>
        </div>
      </div>
    </div>
  );
}
