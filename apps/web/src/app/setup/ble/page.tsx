'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BleClient, BleDevice } from '@capacitor-community/bluetooth-le';

const MOSA_SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const MOSA_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';

export default function BLEProvisioningPage() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BleDevice | null>(null);
  
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  
  const [step, setStep] = useState<'scan' | 'wifi' | 'provisioning' | 'success' | 'error'>('scan');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    BleClient.initialize().catch((err: any) => {
      console.error('BLE Initialization failed', err);
      setErrorMsg('Bluetooth is not available. Are you running this on a native device?');
      setStep('error');
    });
  }, []);

  const scanForDevices = async () => {
    try {
      setDevices([]);
      setIsScanning(true);
      await BleClient.requestLEScan(
        { services: [MOSA_SERVICE_UUID] },
        (result: any) => {
          setDevices((prev) => {
            if (!prev.find(d => d.deviceId === result.device.deviceId)) {
              return [...prev, result.device];
            }
            return prev;
          });
        }
      );
      
      // Stop scanning after 5 seconds
      setTimeout(async () => {
        await BleClient.stopLEScan();
        setIsScanning(false);
      }, 5000);
      
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to scan');
      setStep('error');
    }
  };

  const startProvisioning = async () => {
    if (!selectedDevice || !ssid) return;
    setStep('provisioning');
    
    try {
      // 1. Get Token from Backend
      const tokenRes = await fetch('/api/provisioning/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!tokenRes.ok) throw new Error('Failed to fetch provisioning token from backend');
      const { provisioningToken } = await tokenRes.json();
      
      // 2. Connect via BLE
      await BleClient.connect(selectedDevice.deviceId);
      
      // 3. Negotiate MTU 512 for large JSON payloads!
      if ((BleClient as any).requestMtu) {
         try {
           await (BleClient as any).requestMtu(selectedDevice.deviceId, 512);
         } catch(e) {
           console.warn('MTU request failed, might be unsupported on this OS version', e);
         }
      }

      // 4. Send Payload
      const payload = {
        s: ssid,
        p: password,
        t: provisioningToken,
        a: window.location.origin // Dynamic API URL for ESP32 to call
      };
      
      const payloadStr = JSON.stringify(payload);
      
      // Convert string to DataView
      const buffer = new ArrayBuffer(payloadStr.length);
      const view = new Uint8Array(buffer);
      for (let i = 0; i < payloadStr.length; i++) {
        view[i] = payloadStr.charCodeAt(i);
      }
      const dataView = new DataView(buffer);

      await BleClient.write(selectedDevice.deviceId, MOSA_SERVICE_UUID, MOSA_CHAR_UUID, dataView);
      
      // 5. Success
      setStep('success');
      
      // Wait for device to disconnect naturally as it reboots
      setTimeout(async () => {
        try { await BleClient.disconnect(selectedDevice.deviceId); } catch(e) {}
        router.push('/devices');
      }, 3000);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Provisioning failed');
      setStep('error');
      try { await BleClient.disconnect(selectedDevice.deviceId); } catch(e) {}
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-6">
      
      {step === 'scan' && (
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700/50">
          <div className="text-center mb-8">
            <div className={`w-20 h-20 mx-auto rounded-full bg-blue-500/20 flex items-center justify-center mb-4 ${isScanning ? 'animate-pulse' : ''}`}>
               {/* Simplified Bluetooth Icon */}
               <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8l12 8-6 4V4l6 4-12 8" /></svg>
            </div>
            <h2 className="text-2xl font-bold">Add New Device</h2>
            <p className="text-slate-400 mt-2">Make sure your MOSA Node is powered on.</p>
          </div>
          
          <button 
            onClick={scanForDevices}
            disabled={isScanning}
            className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all disabled:opacity-50"
          >
            {isScanning ? 'Scanning...' : 'Scan for Devices'}
          </button>
          
          <div className="mt-6 space-y-3">
            {devices.map(device => (
              <div 
                key={device.deviceId} 
                onClick={() => { setSelectedDevice(device); setStep('wifi'); }}
                className="p-4 bg-slate-700/50 hover:bg-slate-700 border border-slate-600 rounded-xl cursor-pointer flex justify-between items-center transition-colors"
              >
                <div className="font-semibold">{device.name || 'MOSA Node'}</div>
                <div className="text-xs text-slate-400">{device.deviceId}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'wifi' && (
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700/50 animate-in fade-in zoom-in duration-300">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold">Wi-Fi Setup</h2>
            <p className="text-slate-400 mt-2">Enter credentials for {selectedDevice?.name || 'the device'}</p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Wi-Fi Name (SSID)</label>
              <input 
                type="text" 
                value={ssid}
                onChange={e => setSsid(e.target.value)}
                className="w-full p-4 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="My Home Network"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full p-4 bg-slate-900 border border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              onClick={startProvisioning}
              disabled={!ssid}
              className="w-full py-4 mt-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all disabled:opacity-50"
            >
              Secure & Connect
            </button>
            <button onClick={() => setStep('scan')} className="w-full py-3 text-slate-400 hover:text-white transition-colors">
              Back
            </button>
          </div>
        </div>
      )}

      {step === 'provisioning' && (
        <div className="w-full max-w-md bg-slate-800 p-12 rounded-2xl shadow-2xl text-center border border-slate-700/50">
           <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
           <h2 className="text-xl font-bold">Provisioning Device...</h2>
           <p className="text-slate-400 mt-3 text-sm">Negotiating Zero-Trust Token Exchange and transferring credentials.</p>
        </div>
      )}

      {step === 'success' && (
        <div className="w-full max-w-md bg-slate-800 p-12 rounded-2xl shadow-2xl text-center border border-emerald-500/30 relative overflow-hidden">
           <div className="absolute inset-0 bg-emerald-500/5 animate-pulse"></div>
           <svg className="w-20 h-20 text-emerald-500 mx-auto mb-6 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
           <h2 className="text-2xl font-bold text-white relative z-10">Success!</h2>
           <p className="text-slate-400 mt-3 relative z-10">The device has been securely paired and is connecting to the network.</p>
        </div>
      )}

      {step === 'error' && (
        <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-red-500/30 text-center">
          <svg className="w-16 h-16 text-red-500 mx-auto mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h2 className="text-xl font-bold text-white">Setup Failed</h2>
          <p className="text-slate-400 mt-3">{errorMsg}</p>
          <button 
            onClick={() => setStep('scan')}
            className="w-full py-4 mt-8 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-all"
          >
            Try Again
          </button>
        </div>
      )}

    </div>
  );
}
