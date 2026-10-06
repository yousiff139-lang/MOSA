"use client";

import { useState, useEffect } from 'react';
import { 
  Terminal, Send, Cpu, Database, RefreshCw, AlertCircle, 
  Play, Square, Sliders, ToggleLeft, Code, BookOpen, 
  Copy, Check, Sparkles, Layers, ShieldCheck, Zap, Radio
} from 'lucide-react';
import { fetchAuth, useSmartHomeStore } from '@/store/useSmartHomeStore';

interface LogMessage {
  time: string;
  topic: string;
  payload: string;
}

interface SimulatedBoard {
  id: string;
  name: string;
  type: string;
  value: any;
  isOnline: boolean;
}

export default function DeveloperPage() {
  const [activeTab, setActiveTab] = useState<'SIMULATOR' | 'MQTT' | 'API_DOCS'>('SIMULATOR');
  const [topic, setTopic] = useState('mosa/home/device/control');
  const [payload, setPayload] = useState('{"action": "TOGGLE", "target": "relay_1"}');
  const [mqttLogs, setMqttLogs] = useState<LogMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState<string | null>(null);

  // Simulator States
  const [isSimRunning, setIsSimRunning] = useState(true);
  const [simBoards, setSimBoards] = useState<SimulatedBoard[]>([
    { id: 'esp-sim-1', name: 'مقياس الطاقة الذكي (ESP32)', type: 'POWER_METER', value: 245, isOnline: true },
    { id: 'esp-sim-2', name: 'بوابة المنزل والكراج (ESP32)', type: 'GATE', value: 'CLOSED', isOnline: true },
    { id: 'esp-sim-3', name: 'مضخة ري الحديقة (ESP32)', type: 'PUMP', value: 'OFF', isOnline: true },
    { id: 'esp-sim-4', name: 'حساس رطوبة وحرارة DHT22', type: 'DHT22', value: 24.8, isOnline: true },
  ]);

  useEffect(() => {
    // Generate simulated traffic logs
    const interval = setInterval(() => {
      const sampleTopics = [
        'mosa/telemetry/esp-sim-1/power',
        'mosa/telemetry/esp-sim-4/temp',
        'mosa/devices/living_room/state'
      ];
      const samplePayloads = [
        JSON.stringify({ watts: Math.floor(220 + Math.random() * 40), volts: 228 }),
        JSON.stringify({ temperature: (23.5 + Math.random() * 1.5).toFixed(1), humidity: 48 }),
        JSON.stringify({ status: 'ACTIVE', linkQuality: 254 })
      ];
      const idx = Math.floor(Math.random() * sampleTopics.length);
      const newLog: LogMessage = {
        time: new Date().toLocaleTimeString(),
        topic: sampleTopics[idx],
        payload: samplePayloads[idx]
      };
      setMqttLogs(prev => [newLog, ...prev.slice(0, 15)]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const handleSendMqtt = async () => {
    setSending(true);
    try {
      await fetchAuth('/api/developer/mqtt/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, payload })
      });
      const newLog: LogMessage = {
        time: new Date().toLocaleTimeString(),
        topic: topic,
        payload: payload
      };
      setMqttLogs(prev => [newLog, ...prev.slice(0, 15)]);
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const copyCurlCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCurl(id);
    setTimeout(() => setCopiedCurl(null), 2500);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8 font-sans" dir="rtl">
      
      {/* ── Top Header Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-950/70 via-slate-900/90 to-cyan-950/70 border border-blue-500/30 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-bold mb-3">
              <Terminal size={16} className="text-blue-400" />
              <span>لوحة تحكم المطورين والمختبر الحي (Developer Console & Virtual Hardware)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              أدوات المطورين ومحاكي الأجهزة الذكية
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              محاكاة لوحات ESP32 الافتراضية، إرسال واختبار رسائل MQTT الخام، واستكشاف وثائق الـ REST API لربط المنصة مع تطبيقات خارجية.
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-2 p-1.5 bg-black/40 border border-white/10 rounded-2xl shrink-0 text-xs">
            <button
              onClick={() => setActiveTab('SIMULATOR')}
              className={`px-4 py-2.5 rounded-xl font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'SIMULATOR'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Cpu size={16} />
              <span>محاكي ESP32</span>
            </button>
            <button
              onClick={() => setActiveTab('MQTT')}
              className={`px-4 py-2.5 rounded-xl font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'MQTT'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio size={16} />
              <span>مختبر MQTT</span>
            </button>
            <button
              onClick={() => setActiveTab('API_DOCS')}
              className={`px-4 py-2.5 rounded-xl font-black transition flex items-center gap-2 cursor-pointer ${
                activeTab === 'API_DOCS'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code size={16} />
              <span>توثيق الـ API</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab 1: Virtual Hardware Simulator ── */}
      {activeTab === 'SIMULATOR' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Cpu size={20} className="text-blue-400" />
                <span>لوحات ESP32 الافتراضية النشطة (Virtual Simulation Sandbox)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تسمح لك هذه اللوحات الافتراضية باختبار الأتمتة والمشاهد والواجهات دون الحاجة لوجود أجهزة حقيقية.
              </p>
            </div>
            <button
              onClick={() => setIsSimRunning(!isSimRunning)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                isSimRunning 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isSimRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              <span>{isSimRunning ? 'المحاكي نشط وبث البيانات يعمل' : 'المحاكي متوقف'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {simBoards.map((board) => (
              <div
                key={board.id}
                className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 hover:border-blue-500/40 rounded-3xl p-5 space-y-4 shadow-xl transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/15 text-blue-300 flex items-center justify-center border border-blue-500/30">
                    <Cpu size={20} />
                  </div>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-500/30 font-mono font-bold">
                    {board.type}
                  </span>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-white">{board.name}</h4>
                  <span className="text-[11px] text-slate-500 font-mono block">{board.id}</span>
                </div>

                {/* Simulated interactive controls */}
                <div className="p-3 bg-black/40 rounded-2xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">القيمة المحاكاة:</span>
                    <strong className="text-cyan-300 font-mono">
                      {board.type === 'POWER_METER' ? `${board.value} Watts` :
                       board.type === 'DHT22' ? `${board.value}°C` :
                       board.value}
                    </strong>
                  </div>

                  {board.type === 'POWER_METER' && (
                    <input
                      type="range"
                      min="0"
                      max="3500"
                      value={board.value}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSimBoards(prev => prev.map(b => b.id === board.id ? { ...b, value: val } : b));
                      }}
                      className="w-full accent-cyan-400 cursor-pointer"
                    />
                  )}

                  {board.type === 'GATE' && (
                    <button
                      onClick={() => {
                        setSimBoards(prev => prev.map(b => b.id === board.id ? { ...b, value: b.value === 'OPEN' ? 'CLOSED' : 'OPEN' } : b));
                      }}
                      className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                    >
                      تبديل الحالة ({board.value})
                    </button>
                  )}

                  {board.type === 'PUMP' && (
                    <button
                      onClick={() => {
                        setSimBoards(prev => prev.map(b => b.id === board.id ? { ...b, value: b.value === 'ON' ? 'OFF' : 'ON' } : b));
                      }}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition ${
                        board.value === 'ON' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {board.value === 'ON' ? 'المضخة تعمل (ON)' : 'المضخة متوقفة (OFF)'}
                    </button>
                  )}

                  {board.type === 'DHT22' && (
                    <input
                      type="range"
                      min="15"
                      max="45"
                      step="0.5"
                      value={board.value}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSimBoards(prev => prev.map(b => b.id === board.id ? { ...b, value: val } : b));
                      }}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab 2: Raw MQTT Tester & Traffic Inspector ── */}
      {activeTab === 'MQTT' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* MQTT Publisher */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl">
            <h3 className="font-black text-base text-white flex items-center gap-2">
              <Send size={18} className="text-cyan-400" />
              <span>إرسال أوامر MQTT المباشرة (MQTT Publisher)</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">المسار (Topic):</label>
                <input
                  type="text"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full bg-[#050914] border border-slate-800 rounded-xl p-3 text-cyan-300 font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-400 block mb-1">حمولة البيانات (JSON Payload):</label>
                <textarea
                  value={payload}
                  onChange={e => setPayload(e.target.value)}
                  rows={4}
                  className="w-full bg-[#050914] border border-slate-800 rounded-xl p-3 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              {/* Quick Template Buttons */}
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { label: 'تشغيل إنارة', t: 'mosa/home/device/1/set', p: '{"state":"ON"}' },
                  { label: 'إطفاء إنارة', t: 'mosa/home/device/1/set', p: '{"state":"OFF"}' },
                  { label: 'ضبط المكيف 22°C', t: 'mosa/climate/set', p: '{"temperature":22,"mode":"COOL"}' },
                ].map((tpl, i) => (
                  <button
                    key={i}
                    onClick={() => { setTopic(tpl.t); setPayload(tpl.p); }}
                    className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-[11px] font-bold transition"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSendMqtt}
              disabled={sending}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-cyan-600/30 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send size={16} />
              <span>{sending ? 'جاري الإرسال عبر البوابة...' : 'إرسال الرسالة إلى السيرفر 🚀'}</span>
            </button>
          </div>

          {/* MQTT Traffic Inspector */}
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl flex flex-col h-[480px]">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-black text-base text-white flex items-center gap-2">
                <Radio size={18} className="text-emerald-400" />
                <span>مراقب حركة رسائل الشبكة اللحظي (Live Inspector)</span>
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>متصل</span>
              </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs font-mono">
              {mqttLogs.map((log, idx) => (
                <div key={idx} className="p-3 bg-black/50 border border-white/5 rounded-xl space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span className="text-cyan-400 font-bold">{log.topic}</span>
                    <span>{log.time}</span>
                  </div>
                  <div className="text-slate-300 text-[11px] break-all">
                    {log.payload}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ── Tab 3: REST API & Webhooks Documentation ── */}
      {activeTab === 'API_DOCS' && (
        <div className="space-y-6">
          <div className="bg-slate-950/85 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="font-black text-base text-white flex items-center gap-2">
                  <Code size={20} className="text-blue-400" />
                  <span>دليل وأمثلة واجهات البرمجة (REST API Quickstart)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  استخدم هذه الواجهات للتحكم بمنظومة MOSA برمجياً من بايثون، تطبيقات الجوال، أو روبوتات تيليجرام.
                </p>
              </div>
              <span className="text-xs bg-blue-500/20 text-blue-300 px-3 py-1 rounded-xl border border-blue-500/30 font-bold">
                Base URL: http://localhost/api
              </span>
            </div>

            <div className="space-y-4">
              {[
                {
                  id: 'get-devices',
                  method: 'GET',
                  endpoint: '/api/devices',
                  desc: 'جلب جميع الأجهزة والحساسات وحالتها اللحظية',
                  curl: 'curl -X GET "http://localhost/api/devices" -H "Authorization: Bearer YOUR_API_KEY"'
                },
                {
                  id: 'toggle-device',
                  method: 'POST',
                  endpoint: '/api/devices/:id/toggle',
                  desc: 'تشغيل أو إطفاء مفتاح / ريلاي محدد',
                  curl: 'curl -X POST "http://localhost/api/devices/DEV_ID/toggle" -H "Authorization: Bearer YOUR_API_KEY"'
                },
                {
                  id: 'ai-voice-command',
                  method: 'POST',
                  endpoint: '/api/ai/chat',
                  desc: 'إرسال أمر صوتي أو نصي لمعالج الذكاء الاصطناعي وتنفيذه فوراً',
                  curl: 'curl -X POST "http://localhost/api/ai/chat" -H "Content-Type: application/json" -d \'{"message": "شغل مكيف الصالة وسوي الحرارة 22"}\''
                }
              ].map((api) => (
                <div key={api.id} className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-md ${
                        api.method === 'GET' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {api.method}
                      </span>
                      <span className="font-mono text-xs font-bold text-white">{api.endpoint}</span>
                    </div>
                    <span className="text-xs text-slate-400">{api.desc}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 p-3 bg-[#050914] rounded-xl border border-slate-800">
                    <code className="text-xs font-mono text-cyan-300 truncate" dir="ltr">{api.curl}</code>
                    <button
                      onClick={() => copyCurlCode(api.curl, api.id)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedCurl === api.id ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copiedCurl === api.id ? 'تم' : 'نسخ'}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
