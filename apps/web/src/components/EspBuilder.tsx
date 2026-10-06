"use client";

import { useState } from 'react';
import { Cpu, Plus, Trash2, Code, Download, Zap } from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';

interface ComponentDef {
  id: string;
  type: 'RELAY' | 'DHT22' | 'PIR' | 'PWM';
  pin: number;
}

export function EspBuilder() {
  const [boardType, setBoardType] = useState('ESP32');
  const [components, setComponents] = useState<ComponentDef[]>([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const addComponent = () => {
    setComponents([...components, { id: Math.random().toString(36).substr(2, 5), type: 'RELAY', pin: 4 }]);
  };

  const removeComponent = (id: string) => {
    setComponents(components.filter(c => c.id !== id));
  };

  const updateComponent = (id: string, field: string, value: any) => {
    setComponents(components.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const generateFirmware = async () => {
    setIsGenerating(true);
    try {
      const response = await fetchAuth(`/api/firmware/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardType, components })
      });
      const data = await response.json();
      if (data.success) {
        setGeneratedCode(data.sourceCode);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
      alert('فشل الاتصال بالخادم المولد للأكواد');
    }
    setIsGenerating(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-up">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
          <Cpu size={32} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-white">MOSA-ESP Generator</h1>
          <p className="text-gray-400">بناء أنظمة مدمجة وكتابة أكواد C++ أوتوماتيكياً</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Visual Builder */}
        <div className="space-y-6">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <h2 className="text-xl font-bold text-white mb-4">إعدادات اللوحة</h2>
            <select 
              value={boardType}
              onChange={(e) => setBoardType(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ESP32">ESP32-WROOM-32 / ESP32-S3</option>
              <option value="ESP8266">ESP8266 (NodeMCU)</option>
            </select>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-white">المكونات الفيزيائية</h2>
              <button onClick={addComponent} className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 text-sm transition-colors">
                <Plus size={16} /> إضافة
              </button>
            </div>

            <div className="space-y-3">
              {components.map((comp) => (
                <div key={comp.id} className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                  <select 
                    value={comp.type}
                    onChange={(e) => updateComponent(comp.id, 'type', e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none flex-1 text-sm"
                  >
                    <option value="RELAY">ريلاي (مفتاح)</option>
                    <option value="DHT22">حساس حرارة ورطوبة (DHT22)</option>
                    <option value="PIR">حساس حركة (PIR)</option>
                    <option value="PWM">تحكم إضاءة (PWM)</option>
                  </select>
                  
                  <div className="flex items-center gap-2 bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                    <span className="text-gray-400 text-sm">GPIO</span>
                    <input 
                      type="number" 
                      value={comp.pin}
                      onChange={(e) => updateComponent(comp.id, 'pin', parseInt(e.target.value))}
                      className="w-12 bg-transparent text-white font-bold outline-none text-center"
                    />
                  </div>

                  <button onClick={() => removeComponent(comp.id)} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {components.length === 0 && (
                <p className="text-center text-gray-500 py-6">لم يتم إضافة مكونات. أضف حساساً أو مفتاحاً للبدء.</p>
              )}
            </div>

            <button 
              onClick={generateFirmware}
              disabled={components.length === 0 || isGenerating}
              className="w-full mt-6 bg-gradient-to-r from-primary to-blue-600 hover:opacity-90 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Code size={20} />}
              {isGenerating ? 'جاري التوليد...' : 'توليد الكود المصدري (C++)'}
            </button>
          </div>
        </div>

        {/* Right: Code Output */}
        <div className="bg-[#1E1E1E] border border-white/10 rounded-2xl p-6 flex flex-col h-[600px] shadow-2xl relative">
          <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Code size={20} className="text-blue-400" />
              main.cpp
            </h2>
            {generatedCode && (
              <button 
                onClick={() => {
                  const blob = new Blob([generatedCode], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'mosa_device.ino';
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors"
              >
                <Download size={16} /> تحميل (.ino)
              </button>
            )}
          </div>
          
          <div className="flex-1 overflow-auto bg-black/50 rounded-xl p-4 custom-scrollbar">
            {generatedCode ? (
              <pre className="text-emerald-400 font-mono text-sm leading-relaxed" dir="ltr">
                <code>{generatedCode}</code>
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4">
                <Zap size={48} className="opacity-20" />
                <p>قم بتكوين اللوحة واضغط على زر التوليد لرؤية الكود هنا.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
