'use client';

import React, { useState } from 'react';
import { Wifi, Smartphone, CheckCircle, Loader2, ArrowRight } from 'lucide-react';

export default function DeviceProvisioningPage() {
  const [step, setStep] = useState(1);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [isProvisioning, setIsProvisioning] = useState(false);

  const handleNext = () => setStep((s) => Math.min(4, s + 1));
  
  const handleProvision = async () => {
    setIsProvisioning(true);
    // Simulate connection to ESP32 Hotspot and cloud handshake
    setTimeout(() => {
      setIsProvisioning(false);
      setStep(4);
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white flex flex-col items-center pt-20 px-4">
      <div className="w-full max-w-2xl bg-[#111827] border border-[#1e293b] rounded-2xl shadow-2xl p-8">
        
        {/* Progress Bar */}
        <div className="flex items-center justify-between mb-12 relative">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-[#1e293b] -z-10 rounded-full"></div>
          <div 
            className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-blue-500 -z-10 rounded-full transition-all duration-500"
            style={{ width: `${((step - 1) / 3) * 100}%` }}
          ></div>
          
          {[1, 2, 3, 4].map((s) => (
            <div 
              key={s} 
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${
                s < step ? 'bg-blue-500 text-white' : 
                s === step ? 'bg-blue-600 ring-4 ring-blue-500/30 text-white' : 
                'bg-[#1e293b] text-gray-400'
              }`}
            >
              {s < step ? <CheckCircle className="w-5 h-5" /> : s}
            </div>
          ))}
        </div>

        {/* Step 1: Device Type */}
        {step === 1 && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold text-white">Select Device Type</h2>
            <p className="text-gray-400">Choose the type of smart device you want to add.</p>
            <div className="grid grid-cols-2 gap-4 mt-8">
              {['Smart Relay', 'Temperature Sensor', 'Smart Lock', 'RGB Strip'].map((type) => (
                <button 
                  key={type}
                  onClick={handleNext}
                  className="p-6 border border-[#1e293b] rounded-xl hover:border-blue-500 hover:bg-blue-500/10 transition-all text-left group"
                >
                  <Smartphone className="w-8 h-8 text-gray-400 group-hover:text-blue-400 mb-4" />
                  <h3 className="font-semibold text-white">{type}</h3>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Connect AP */}
        {step === 2 && (
          <div className="space-y-6 text-center animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-2xl font-bold text-white">Connect to Device</h2>
            <p className="text-gray-400">
              Go to your Wi-Fi settings and connect to the network starting with <strong className="text-white">MOSA_DEVICE_XXXX</strong>.
            </p>
            
            <div className="bg-[#1e293b] p-6 rounded-xl flex items-center justify-center gap-4 my-8">
              <Wifi className="w-8 h-8 text-blue-400 animate-pulse" />
              <span className="text-lg font-mono">Waiting for connection...</span>
            </div>

            <button 
              onClick={handleNext}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              I am connected
            </button>
          </div>
        )}

        {/* Step 3: Wi-Fi Credentials */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Wi-Fi Setup</h2>
              <p className="text-gray-400 mt-2">Enter your home Wi-Fi details so the device can connect to the cloud.</p>
            </div>

            <div className="space-y-4 mt-8 max-w-sm mx-auto">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Network Name (SSID)</label>
                <input 
                  type="text" 
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="MyHomeNetwork"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-[#0a0f1e] border border-[#1e293b] rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
              
              <button 
                onClick={handleProvision}
                disabled={isProvisioning || !ssid || !password}
                className="w-full mt-6 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isProvisioning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Provisioning Device...
                  </>
                ) : (
                  <>
                    Connect Device <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && (
          <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold text-white">Device Added!</h2>
            <p className="text-gray-400">
              Your device has successfully connected to the MOSA Cloud and is secured with mTLS.
            </p>
            
            <button 
              onClick={() => window.location.href = '/dashboard'}
              className="mt-8 px-8 py-3 bg-[#1e293b] hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
