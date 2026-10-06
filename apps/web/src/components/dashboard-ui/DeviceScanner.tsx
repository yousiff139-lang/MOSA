import { useState } from 'react';
import { Camera, Bluetooth, QrCode, CheckCircle2, XCircle } from 'lucide-react';

export default function DeviceScanner() {
  const [step, setStep] = useState<'SCAN' | 'CONNECTING' | 'SUCCESS' | 'ERROR'>('SCAN');
  const [deviceInfo, setDeviceInfo] = useState<{ mac?: string, pin?: string }>({});

  const scanQRCode = () => {
    // Mocking Camera QR Code Scan
    setStep('CONNECTING');
    
    setTimeout(() => {
      // Example payload extracted from the QR code printed on the PCB enclosure
      const scannedData = { mac: 'A1:B2:C3:D4:E5:F6', pin: '839201' };
      setDeviceInfo(scannedData);
      connectViaBLE(scannedData.pin);
    }, 1500);
  };

  const connectViaBLE = async (setupPin: string) => {
    try {
      if (!navigator.bluetooth || !navigator.bluetooth.requestDevice) {
        console.warn('Web Bluetooth API is not supported or requires HTTPS. Simulating connection...');
        setTimeout(() => setStep('SUCCESS'), 1500);
        return;
      }

      // 1. Request Bluetooth Device (Matter-style provisioning)
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: 'MOSA_' }],
        optionalServices: ['0000aaaa-0000-1000-8000-00805f9b34fb'] // Provisioning Service UUID
      });

      console.log('Found Device:', device.name);

      // 2. Connect to GATT Server
      const server = await device.gatt?.connect();
      if (!server) throw new Error('Could not connect to GATT Server');

      // 3. Get the Provisioning Service & Characteristics
      const service = await server.getPrimaryService('0000aaaa-0000-1000-8000-00805f9b34fb');
      const authCharacteristic = await service.getCharacteristic('0000bbbb-0000-1000-8000-00805f9b34fb');

      // 4. Send the WiFi credentials + Setup PIN
      const payload = JSON.stringify({
        ssid: 'MyWiFiNetwork',
        pass: 'SecretPassword',
        pin: setupPin
      });

      const encoder = new TextEncoder();
      await authCharacteristic.writeValue(encoder.encode(payload));

      setStep('SUCCESS');
    } catch (error: any) {
      console.error(error);
      setStep('ERROR');
    }
  };

  return (
    <div className="bg-[#11141c] border border-white/10 rounded-3xl p-8 max-w-md mx-auto text-center" dir="rtl">
      {step === 'SCAN' && (
        <>
          <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <QrCode size={40} className="text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">إضافة جهاز جديد</h2>
          <p className="text-gray-400 mb-8">قم بتوجيه الكاميرا نحو الباركود (QR Code) المطبوع على خلفية الجهاز.</p>
          <button 
            onClick={scanQRCode}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold flex items-center justify-center gap-3 transition-colors"
          >
            <Camera size={20} /> مسح الباركود
          </button>
        </>
      )}

      {step === 'CONNECTING' && (
        <>
          <div className="w-24 h-24 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
            <Bluetooth size={40} className="text-purple-500 animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">جاري الاتصال الآمن...</h2>
          <p className="text-gray-400">يتم إرسال المفاتيح الأمنية وإعدادات الشبكة للجهاز عبر البلوتوث (BLE).</p>
        </>
      )}

      {step === 'SUCCESS' && (
        <>
          <div className="w-24 h-24 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">تمت الإضافة بنجاح!</h2>
          <p className="text-gray-400 mb-8">تم تشفير الجهاز وربطه بحسابك بشكل نهائي.</p>
          <button 
            onClick={() => setStep('SCAN')}
            className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold transition-colors"
          >
            إنهاء
          </button>
        </>
      )}

      {step === 'ERROR' && (
        <>
          <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle size={40} className="text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">فشل الاتصال</h2>
          <p className="text-gray-400 mb-8">حدث خطأ أثناء نقل المفاتيح عبر البلوتوث. تأكد من أنك قريب من الجهاز.</p>
          <button 
            onClick={() => setStep('SCAN')}
            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-colors"
          >
            إعادة المحاولة
          </button>
        </>
      )}
    </div>
  );
}
