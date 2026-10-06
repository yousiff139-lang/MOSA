"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, Sparkles, Send, Mic, MicOff, User, Volume2, VolumeX,
  RefreshCw, Zap, Moon, Sun, Home, Thermometer, Lightbulb,
  CheckCircle2, AlertCircle, ShieldCheck, Cpu, Trash2, Copy, Check,
  ChevronRight, BrainCircuit, Activity, Sliders, Play, Settings2,
  Wand2, ShieldAlert, CheckCheck, ArrowUpRight, Flame, Droplets, Clock,
  Pause, Square, Radio, Server, Gauge, Wrench, CheckSquare, Layers, Lock
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { speakMosaVoice, getStoredVoiceSettings, saveVoiceSettings, VoiceSettings, DEFAULT_VOICE_SETTINGS } from '@/lib/mosaVoice';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isAction?: boolean;
  intent?: string;
  actionsExecuted?: string[];
  devices?: any[];
  isLoading?: boolean;
  needsApiKey?: boolean;
}

interface AIRecommendation {
  id: string;
  title: string;
  description: string;
  impact: string;
  confidence: number;
  type: string;
  suggestedAction?: any;
}

interface AIAnomaly {
  id: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  message: string;
  deviceName?: string;
  fixAction?: string;
  category: string;
  timestamp: string;
}

interface DiagnosticsData {
  overallScore: number;
  status: 'EXCELLENT' | 'GOOD' | 'WARNING' | 'CRITICAL';
  nodesCount: number;
  devicesCount: number;
  activeDevicesCount: number;
  offlineNodesCount: number;
  networkLatencyMs: number;
  mqttStatus: string;
  climateStatus: { temperature: number; humidity: number; isOptimal: boolean };
  checks: Array<{ name: string; status: 'PASS' | 'WARN' | 'FAIL'; details: string }>;
  recommendations: string[];
}

const QUICK_COMMANDS = [
  { emoji: '💡', label: 'طفي كل الإنارة', prompt: 'طفي كل الإنارة في المنزل' },
  { emoji: '🌙', label: 'وضع النوم', prompt: 'تفعيل وضع النوم وإطفاء الأجهزة' },
  { emoji: '❄️', label: 'اضبط التكييف 22°C', prompt: 'اضبط التكييف على 22 درجة' },
  { emoji: '🔍', label: 'شكو مشتغل هسه؟', prompt: 'شكو مشتغل هسه؟' },
  { emoji: '🌡️', label: 'درجة الحرارة', prompt: 'كم درجة الحرارة الحالية؟' },
  { emoji: '⚡', label: 'استهلاك الكهرباء', prompt: 'كم استهلاك الكهرباء الحالي؟' },
  { emoji: '🌱', label: 'شغل مضخة الحديقة', prompt: 'شغل مضخة الري' },
  { emoji: '📻', label: 'إذاعة القرآن الكريم', prompt: 'شغل قرآن كريم' },
  { emoji: '🎬', label: 'وضع السينما', prompt: 'وضع السينما' },
  { emoji: '🏠', label: 'مغادرة المنزل', prompt: 'وضع الخروج من المنزل' },
];

export default function AIPage() {
  const initBackendConnection = useSmartHomeStore(state => state.initBackendConnection);

  const [activeTab, setActiveTab] = useState<'chat' | 'radar' | 'habits' | 'security' | 'automation' | 'models'>('chat');
  const [habits, setHabits] = useState<any[]>([]);
  const [selfHealResult, setSelfHealResult] = useState<any>(null);
  const [isSelfHealing, setIsSelfHealing] = useState(false);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [insight, setInsight] = useState<string>("جاري تحليل استهلاك الطاقة وبيانات الحساسات...");
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [anomalies, setAnomalies] = useState<AIAnomaly[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<{ role: string; content: string }[]>([]);

  // Media & Streaming state
  const [mediaStreamUrl, setMediaStreamUrl] = useState<string | null>(null);
  const [mediaTitle, setMediaTitle] = useState<string>('');
  const [isPlayingMedia, setIsPlayingMedia] = useState(false);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  // Optimizing Eco State
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optResult, setOptResult] = useState<any>(null);

  // Voice & Assistant Settings
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // AI Provider & API Key Configuration State
  const [aiConfig, setAiConfig] = useState({
    provider: 'openai',
    model: 'gpt-4o-mini',
    apiKey: '',
    customBaseUrl: '',
    assistantName: 'رورو (Roro)',
    persona: 'roro',
    languageMode: 'iraqi_modern',
    hasApiKey: false
  });
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; latencyMs?: number } | null>(null);
  const [isSavingKey, setIsSavingKey] = useState(false);

  // Prompt-to-Automation State
  const [autoPrompt, setAutoPrompt] = useState("");
  const [isGeneratingAuto, setIsGeneratingAuto] = useState(false);
  const [generatedRule, setGeneratedRule] = useState<any>(null);
  const [isRuleSaved, setIsRuleSaved] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      sender: 'assistant',
      text: 'مرحباً بك! أنا **رورو (Roro)** 🌸 — مساعدتك الصوتية والتشغيلية الذكية لإدارة منزلك والتحكم بجميع الأجهزة، الإنارة، التكييف، وحساسات الـ ESP32. كيف يمكنني خدمتك اليوم؟',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    loadInsights();
    loadRecommendations();
    loadAnomalies();
    loadAiConfig();
    loadDiagnostics();
    loadHabits();

    if (typeof window !== 'undefined') {
      setVoiceSettings(getStoredVoiceSettings());
      if ('speechSynthesis' in window) {
        const updateVoices = () => {
          setAvailableVoices(window.speechSynthesis.getVoices());
        };
        updateVoices();
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  const loadAiConfig = async () => {
    try {
      const res = await fetchAuth('/api/ai/config');
      if (res.ok) {
        const json = await res.json();
        if (json.data) {
          setAiConfig(prev => ({
            ...prev,
            provider: json.data.provider || 'openai',
            model: json.data.model || 'gpt-4o-mini',
            customBaseUrl: json.data.customBaseUrl || '',
            assistantName: json.data.assistantName || 'رورو (Roro)',
            persona: json.data.persona || 'roro',
            languageMode: json.data.languageMode || 'iraqi_modern',
            hasApiKey: json.data.hasApiKey
          }));
        }
      }
    } catch {}
  };

  const loadInsights = async () => {
    try {
      const res = await fetchAuth('/api/ai/insights');
      if (res.ok) {
        const json = await res.json();
        if (json.data?.insight) {
          setInsight(json.data.insight);
        }
      }
    } catch {}
  };

  const loadRecommendations = async () => {
    try {
      const res = await fetchAuth('/api/ai/recommendations');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setRecommendations(data);
      }
    } catch {}
  };

  const loadAnomalies = async () => {
    try {
      const res = await fetchAuth('/api/ai/anomalies');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) setAnomalies(json.data);
      }
    } catch {}
  };

  const loadDiagnostics = async () => {
    setIsDiagnosing(true);
    try {
      const res = await fetchAuth('/api/ai/diagnostics');
      if (res.ok) {
        const json = await res.json();
        if (json.data) setDiagnostics(json.data);
      }
    } catch {} finally {
      setIsDiagnosing(false);
    }
  };

  const loadHabits = async () => {
    try {
      const res = await fetchAuth('/api/ai/habits');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) setHabits(json.data);
      }
    } catch {}
  };

  const handleApplyHabit = async (habitId: string) => {
    try {
      const res = await fetchAuth('/api/ai/habits/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ habitId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        alert(data.message || 'تم تطبيق العادة الذكية بنجاح! ⚡');
        if (!isMuted) speakMosaVoice(data.message);
      }
    } catch {}
  };

  const handleSelfHeal = async () => {
    setIsSelfHealing(true);
    try {
      const res = await fetchAuth('/api/ai/self-heal', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setSelfHealResult(data);
        loadDiagnostics();
        if (!isMuted) speakMosaVoice(data.message);
      }
    } catch {} finally {
      setIsSelfHealing(false);
    }
  };

  const handleFixAnomaly = async (anomalyId: string) => {
    try {
      const res = await fetchAuth('/api/ai/fix-anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
        if (!isMuted) speakMosaVoice(data.message || 'تم حل التنبيه بنجاح');
      }
    } catch {}
  };

  const handleOptimizeEnergy = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetchAuth('/api/ai/optimize-energy', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        setOptResult(data);
        loadInsights();
        loadRecommendations();
        if (!isMuted) speakMosaVoice(data.message || 'تم ترشيد الطاقة بنجاح');
      }
    } catch {} finally {
      setIsOptimizing(false);
    }
  };

  const handleSaveAiConfig = async () => {
    setIsSavingKey(true);
    try {
      const res = await fetchAuth('/api/ai/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig)
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setTestResult({ success: true, message: data.message || 'تم حفظ إعدادات الذكاء الاصطناعي بنجاح ✅' });
        loadAiConfig();
      } else {
        setTestResult({ success: false, message: data?.error || data?.message || 'فشل حفظ الإعدادات' });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'فشل الاتصال بالخادم' });
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleTestAiConnection = async () => {
    setIsTestingKey(true);
    setTestResult(null);
    try {
      const res = await fetchAuth('/api/ai/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestResult({
          success: true,
          message: data.message || `تم الاتصال بنجاح! الاستجابة: "${data.response}"`,
          latencyMs: data.latencyMs
        });
      } else {
        setTestResult({
          success: false,
          message: data.error || 'فشل الاتصال بالنموذج'
        });
      }
    } catch (err: any) {
      setTestResult({ success: false, message: 'فشل الاتصال بالخادم' });
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleGenerateAutomation = async () => {
    if (!autoPrompt.trim()) return;
    setIsGeneratingAuto(true);
    setIsRuleSaved(false);
    try {
      const res = await fetchAuth('/api/ai/parse-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: autoPrompt })
      });
      const data = await res.json();
      if (res.ok && data.rule) {
        setGeneratedRule(data.rule);
      }
    } catch {} finally {
      setIsGeneratingAuto(false);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    setInput("");
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetchAuth('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          conversationHistory,
          assistantName: aiConfig.assistantName
        })
      });

      const data = await res.json();
      const replyText = data.reply_arabic || data.data?.reply || 'تم استلام الأمر بنجاح ✨';

      // Check media playback intent
      if (data.data?.isMedia && data.data?.streamUrl) {
        setMediaStreamUrl(data.data.streamUrl);
        setMediaTitle(data.data.streamTitle || 'بث مباشر');
        setIsPlayingMedia(true);
        if (audioPlayerRef.current) {
          audioPlayerRef.current.src = data.data.streamUrl;
          audioPlayerRef.current.play().catch(() => {});
        }
      }

      if (data.type === 'API_KEY_CONFIGURED' || data.data?.hasApiKey) {
        loadAiConfig();
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: replyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isAction: data.data?.isAction || false,
        intent: data.type || data.data?.intent,
        actionsExecuted: data.data?.actionsExecuted,
        needsApiKey: data.data?.needsApiKey || data.type === 'NEEDS_API_KEY'
      };

      setMessages(prev => [...prev, assistantMsg]);
      setConversationHistory(prev => [
        ...prev.slice(-8),
        { role: 'user', content: query },
        { role: 'assistant', content: replyText }
      ]);

      if (!isMuted) {
        speakMosaVoice(replyText, undefined, voiceSettings);
      }

      loadInsights();
      loadAnomalies();
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'assistant',
        text: 'عذراً، حدث خطأ أثناء معالجة الأمر. يرجى المحاولة مرة أخرى.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('متصفحك لا يدعم التعرف على الصوت المباشر.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'ar-SA';

    rec.onstart = () => setIsListening(true);
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      if (transcript) {
        handleSendMessage(transcript);
      }
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);

    recognitionRef.current = rec;
    rec.start();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 font-sans pb-24" dir="rtl">
      {/* Hidden Audio Player for Radio / Quran streaming */}
      <audio ref={audioPlayerRef} className="hidden" />

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl p-6 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-4 ring-cyan-500/20 animate-pulse">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-950"></span>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl md:text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-cyan-100 to-cyan-400">
                  مركز الذكاء الاصطناعي الفائق
                </h1>
                <span className="px-3 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold rounded-full flex items-center gap-1">
                  <BrainCircuit className="w-3.5 h-3.5" />
                  MOSA AI 3.0
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-1">
                المساعد الصوتي والتشغيلي الذكي، رادار توفير الطاقة، الحارس الأمني، ومولد السيناريوهات
              </p>
            </div>
          </div>

          {/* Quick Stats & Controls */}
          <div className="flex items-center gap-2 relative z-10 flex-wrap">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-2xl border transition-all flex items-center gap-2 text-sm font-medium ${
                isMuted 
                  ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                  : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}
              title={isMuted ? 'الصوت معطل' : 'الصوت مفعل'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span>{isMuted ? 'صامت' : 'صوت ناطق'}</span>
            </button>

            <button
              onClick={handleOptimizeEnergy}
              disabled={isOptimizing}
              className="px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
            >
              <Zap className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
              <span>{isOptimizing ? 'جاري الترشيد...' : 'ترشيد الطاقة الفوري'}</span>
            </button>
          </div>
        </div>

        {/* Live Radio / Media Player Banner if Active */}
        <AnimatePresence>
          {mediaStreamUrl && isPlayingMedia && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 bg-gradient-to-r from-indigo-900/60 to-purple-900/60 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between backdrop-blur-lg shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 animate-pulse">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-indigo-300 font-medium">بث صوتي مباشر قيد التشغيل</div>
                  <div className="text-sm font-bold text-white">{mediaTitle}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (audioPlayerRef.current) {
                      if (isPlayingMedia) audioPlayerRef.current.pause();
                      else audioPlayerRef.current.play();
                      setIsPlayingMedia(!isPlayingMedia);
                    }
                  }}
                  className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all"
                >
                  {isPlayingMedia ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    if (audioPlayerRef.current) audioPlayerRef.current.pause();
                    setIsPlayingMedia(false);
                    setMediaStreamUrl(null);
                  }}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
                >
                  <Square className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto mt-4 pb-2 border-b border-slate-800/80 scrollbar-none">
          {[
            { id: 'chat', label: 'المساعد والتحكم الصوتي', icon: Bot, badge: null },
            { id: 'radar', label: 'رادار الطاقة والتوصيات', icon: Zap, badge: recommendations.length > 0 ? recommendations.length : null },
            { id: 'habits', label: 'التعلم الذاتي للعادات والتعافي', icon: BrainCircuit, badge: habits.length > 0 ? habits.length : 'ذاتي' },
            { id: 'security', label: 'الحارس الأمني وفحص الأعطال', icon: ShieldAlert, badge: anomalies.length > 0 ? anomalies.length : null, badgeColor: 'bg-red-500' },
            { id: 'automation', label: 'استوديو توليد الأتمتة', icon: Wand2, badge: 'جديد' },
            { id: 'models', label: 'المحركات والنماذج والمساعد', icon: Settings2, badge: null },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl font-bold text-sm transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-900/40 text-slate-400 hover:text-white hover:bg-slate-900 border border-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-2 py-0.5 text-xs rounded-full font-bold text-white ${tab.badgeColor || 'bg-cyan-500'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {/* TAB 1: Chat & Voice Assistant Studio */}
        {activeTab === 'chat' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Chat Box */}
            <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800/80 rounded-3xl flex flex-col h-[650px] shadow-2xl relative overflow-hidden">
              {/* Messages Container */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                {/* Notice banner if no API Key is registered */}
                {!aiConfig.hasApiKey && (
                  <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg backdrop-blur-md">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-amber-200">
                          مطلوب ربط مفتاح API للدردشة مع الذكاء الاصطناعي
                        </div>
                        <div className="text-xs text-amber-300/80 mt-0.5">
                          لا يمكن التحدث مع الذكاء الاصطناعي بدون تزويد المنظومة بمفتاح API (Gemini، OpenAI، Groq...). يمكنك كتابته هنا أو إدخاله في تبويب النماذج.
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('models')}
                      className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs rounded-xl shadow-md transition-all shrink-0 flex items-center gap-1.5"
                    >
                      <Settings2 className="w-4 h-4" />
                      <span>إدخال المفتاح والربط الآن</span>
                    </button>
                  </div>
                )}

                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${
                        msg.sender === 'user'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-gradient-to-tr from-purple-600 to-indigo-600 text-white'
                      }`}
                    >
                      {msg.sender === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                    </div>

                    <div
                      className={`max-w-[85%] rounded-3xl p-4 shadow-lg text-sm md:text-base leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-cyan-600/20 text-cyan-100 border border-cyan-500/30 rounded-tr-sm'
                          : 'bg-slate-800/80 text-slate-100 border border-slate-700/60 rounded-tl-sm'
                      }`}
                    >
                      <div className="whitespace-pre-line">{msg.text}</div>

                      {msg.isAction && msg.actionsExecuted && msg.actionsExecuted.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-wrap gap-1.5 items-center">
                          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> الأجهزة المتأثرة:
                          </span>
                          {msg.actionsExecuted.map((dev, idx) => (
                            <span key={idx} className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-lg font-medium">
                              {dev}
                            </span>
                          ))}
                        </div>
                      )}

                      {msg.needsApiKey && (
                        <div className="mt-3 pt-3 border-t border-slate-700/50">
                          <button
                            onClick={() => setActiveTab('models')}
                            className="px-4 py-2 bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/40 text-amber-200 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-sm"
                          >
                            <Settings2 className="w-4 h-4 text-amber-400" />
                            <span>الانتقال لإدخال مفتاح الـ API والربط الآن 🔑</span>
                          </button>
                        </div>
                      )}

                      <div className="mt-2 text-[10px] text-slate-400 flex items-center justify-between">
                        <span>{msg.timestamp}</span>
                        {msg.sender === 'assistant' && (
                          <button
                            onClick={() => speakMosaVoice(msg.text, undefined, voiceSettings)}
                            className="text-slate-400 hover:text-cyan-400 p-1 transition-colors"
                            title="إعادة القراءة الصوتية"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 animate-spin">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="bg-slate-800/80 border border-slate-700/60 rounded-3xl p-4 text-slate-300 text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                      <span>جاري معالجة الأمر وتنفيذه بالمنظومة...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Bar */}
              <div className="p-4 bg-slate-950/80 border-t border-slate-800/80">
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    className={`p-3.5 rounded-2xl transition-all shadow-lg ${
                      isListening
                        ? 'bg-red-500 text-white animate-pulse shadow-red-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                    title={isListening ? 'إيقاف الاستماع' : 'تحدث صوتياً'}
                  >
                    {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                  </button>

                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="اكتب أمرك أو استفسارك هنا (مثال: طفي كل الإنارة، اضبط التكييف على 22)..."
                    className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!input.trim() || isLoading}
                    className="p-3.5 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-2xl shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Actions & Live Telemetry Card */}
            <div className="space-y-6">
              {/* Quick Commands Widget */}
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
                <h3 className="font-bold text-base text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  أوامر سريعة بنقرة واحدة
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {QUICK_COMMANDS.map((cmd, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(cmd.prompt)}
                      className="p-3 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-cyan-500/40 rounded-2xl text-right transition-all flex items-center gap-2.5 text-xs font-semibold text-slate-200"
                    >
                      <span className="text-base">{cmd.emoji}</span>
                      <span className="truncate">{cmd.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy Summary Widget */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    الموجز التحليلي اللحظي
                  </h3>
                  <button onClick={loadInsights} className="text-slate-400 hover:text-white p-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-950/50 p-4 rounded-2xl border border-slate-800/60">
                  {insight}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Predictive Eco Radar & Energy Recommendations */}
        {activeTab === 'radar' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-teal-950/40 via-slate-900 to-slate-900 border border-teal-500/20 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-teal-300 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-teal-400" />
                    رادار الذكاء الاصطناعي لتوفير وترشيد استهلاك الكهرباء
                  </h2>
                  <p className="text-sm text-slate-400 mt-1">
                    يقوم الذكاء الاصطناعي برصد الأحمال المهدورة وضبط درجات الحرارة آلياً لتحقيق أعلى كفاءة وتوفير حتى 35% من الفاتورة.
                  </p>
                </div>
                <button
                  onClick={handleOptimizeEnergy}
                  disabled={isOptimizing}
                  className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-sm rounded-2xl shadow-lg shadow-teal-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  <Zap className={`w-4 h-4 ${isOptimizing ? 'animate-spin' : ''}`} />
                  <span>{isOptimizing ? 'جاري التنفيذ...' : 'تطبيق الترشيد الشامل بنقرة واحدة'}</span>
                </button>
              </div>
            </div>

            {optResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-950/40 border border-emerald-500/30 rounded-3xl p-6 shadow-xl text-emerald-200"
              >
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="font-bold text-base text-white">نتيجة الترشيد الذكي</span>
                </div>
                <p className="text-sm">{optResult.message}</p>
              </motion.div>
            )}

            {/* Recommendations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-slate-700 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold rounded-full">
                        {rec.impact}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        دقة التوصية: {rec.confidence}%
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-white mb-2">{rec.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{rec.description}</p>
                  </div>
                  <button
                    onClick={() => handleSendMessage(`نفذ التوصية: ${rec.title}`)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>تطبيق التوصية فوراً</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: Autonomous Habit Learning & Self-Healing Network */}
        {activeTab === 'habits' && (
          <div className="space-y-6">
            {/* Self-Healing Banner */}
            <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-indigo-300 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-indigo-400" />
                  محرك استكشاف العادات والتعافي الذاتي للشبكة (Self-Healing AI)
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  يقوم الذكاء الاصطناعي برصد السلوكيات اليومية وتحويلها إلى روتين ذكي، مع معالجة انقطاعات العُقد آلياً عبر شبكة الـ ESP-NOW Mesh.
                </p>
              </div>

              <button
                onClick={handleSelfHeal}
                disabled={isSelfHealing}
                className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-500/20 flex items-center gap-2 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
              >
                <Sparkles className={`w-4 h-4 ${isSelfHealing ? 'animate-spin' : ''}`} />
                <span>{isSelfHealing ? 'جاري الفحص والتعافي...' : 'بدء فحص وموازنة الشبكة الذاتية'}</span>
              </button>
            </div>

            {/* Self-Healing Report if Triggered */}
            <AnimatePresence>
              {selfHealResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-slate-900/90 border border-indigo-500/40 rounded-3xl p-6 shadow-xl space-y-3"
                >
                  <div className="flex items-center gap-2 text-indigo-300 font-bold text-base">
                    <CheckCircle2 className="w-5 h-5 text-indigo-400" />
                    <span>تقرير التعافي الذاتي المباشر</span>
                  </div>
                  <p className="text-xs text-slate-300">{selfHealResult.message}</p>
                  <div className="space-y-1.5 pt-2">
                    {selfHealResult.healedActions?.map((act: string, i: number) => (
                      <div key={i} className="text-xs text-slate-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Discovered Habits Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {habits.map((habit) => (
                <div
                  key={habit.id}
                  className="bg-slate-900/80 border border-slate-800/80 rounded-3xl p-6 shadow-xl flex flex-col justify-between hover:border-indigo-500/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="px-3 py-1 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 text-xs font-bold rounded-full">
                        {habit.timeWindow}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        دقة النمط: {habit.confidence}%
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-white mb-2">{habit.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed mb-3">{habit.description}</p>
                    
                    <div className="text-[11px] text-slate-500 mb-4 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-400" />
                      <span>التكرار: {habit.frequency}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleApplyHabit(habit.id)}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>تحويل إلى روتين أتمتة دائم</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: Security Guardian & System Diagnostics */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {/* Anomalies Alert Banner */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-400" />
                  الأخطاء والتنبيهات الأمنية والتشغيلية النشطة ({anomalies.length})
                </h2>
                <button onClick={loadAnomalies} className="text-slate-400 hover:text-white p-1">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {anomalies.length === 0 ? (
                <div className="p-8 text-center bg-slate-950/40 rounded-2xl border border-slate-800/60">
                  <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                  <h4 className="font-bold text-white text-base">لا توجد أي أخطاء أو مخاطر نشطة</h4>
                  <p className="text-xs text-slate-400 mt-1">جميع الأجهزة، المضخات، الأقفال، ووحدات الـ ESP32 تعمل بأمان واستقرار تام.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {anomalies.map((anom) => (
                    <div
                      key={anom.id}
                      className="p-4 bg-red-950/20 border border-red-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-bold text-sm text-white">{anom.title}</h4>
                          <p className="text-xs text-slate-300 mt-0.5">{anom.message}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleFixAnomaly(anom.id)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl shadow-md transition-all shrink-0"
                      >
                        معالجة فورية
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnostics Report */}
            {diagnostics && (
              <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-lg text-white flex items-center gap-2">
                      <Gauge className="w-5 h-5 text-indigo-400" />
                      فحص سلامة واستقرار المنظومة (AI System Diagnostics)
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                      تقييم شامل للاتصال الشبكي، استجابة وحدات الـ ESP32، وحالة الحساسات
                    </p>
                  </div>
                  <div className="text-center px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl">
                    <div className="text-2xl font-black text-indigo-400">{diagnostics.overallScore}%</div>
                    <div className="text-[10px] text-slate-400 font-bold">مؤشر الصحة العام</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {diagnostics.checks.map((chk, i) => (
                    <div key={i} className="p-4 bg-slate-950/60 border border-slate-800/80 rounded-2xl flex items-start gap-3">
                      {chk.status === 'PASS' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">{chk.name}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{chk.details}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: Natural Language Automation Studio */}
        {activeTab === 'automation' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/20 rounded-3xl p-6 shadow-xl">
              <h2 className="text-xl font-bold text-purple-300 flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-purple-400" />
                استوديو توليد الأتمتة باللغة الطبيعية
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                اكتب سيناريو الأتمتة بالعربية أو اللهجة العراقية وسيقوم الذكاء الاصطناعي ببناء الشروط، المشغلات، والمخرجات تلقائياً.
              </p>

              <div className="mt-6 flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  value={autoPrompt}
                  onChange={(e) => setAutoPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerateAutomation()}
                  placeholder="مثال: إذا صارت درجة الحرارة أكثر من 28 شغل السبلت وسد البردات"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleGenerateAutomation}
                  disabled={!autoPrompt.trim() || isGeneratingAuto}
                  className="px-6 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm rounded-2xl shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isGeneratingAuto ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingAuto ? 'جاري التوليد...' : 'توليد الأتمتة الذكية'}</span>
                </button>
              </div>
            </div>

            {generatedRule && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-slate-900/80 border border-purple-500/30 rounded-3xl p-6 shadow-2xl space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-white">{generatedRule.name}</h3>
                      <p className="text-xs text-slate-400">{generatedRule.explanation}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/20 text-xs font-bold rounded-full">
                    نوع المشغل: {generatedRule.triggerType}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold text-purple-400 mb-2">المشغل والشروط (Trigger & Conditions)</div>
                    <pre className="text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify({ trigger: generatedRule.triggerConfig, conditions: generatedRule.conditions }, null, 2)}
                    </pre>
                  </div>
                  <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800">
                    <div className="text-xs font-bold text-emerald-400 mb-2">المخرجات والتنفيذ (Actions)</div>
                    <pre className="text-[11px] text-slate-300 font-mono overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(generatedRule.actions, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setIsRuleSaved(true);
                      alert('تم تثبيت الأتمتة بالمنظومة بنجاح! ✅');
                    }}
                    disabled={isRuleSaved}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>{isRuleSaved ? 'تم التثبيت بنجاح ✅' : 'تثبيت الأتمتة بالمنظومة'}</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* TAB 5: Model Hub, Providers & Voice Persona */}
        {activeTab === 'models' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LLM Engine & Provider Setup */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400" />
                  مزود ونموذج الذكاء الاصطناعي (AI Provider)
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  اختر المزود والنموذج المناسب أو استخدم المحرك المحلي المدمج
                </p>
              </div>

              {/* Provider Buttons */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 2.0 / 1.5 Flash' },
                  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o / GPT-4o-mini' },
                  { id: 'groq', name: 'Groq Cloud', desc: 'Llama 3.3 70B (خارق السرعة)' },
                  { id: 'deepseek', name: 'DeepSeek', desc: 'DeepSeek R1 / V3' },
                  { id: 'ollama', name: 'Local Ollama', desc: 'سيرفر محلي (Offline)' },
                  { id: 'edge', name: 'MOSA Edge', desc: 'محرك القواعد المدمج' },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      let defModel = 'gpt-4o-mini';
                      if (p.id === 'gemini') defModel = 'gemini-1.5-flash';
                      if (p.id === 'groq') defModel = 'llama-3.3-70b-versatile';
                      if (p.id === 'deepseek') defModel = 'deepseek-chat';
                      if (p.id === 'ollama') defModel = 'llama3';
                      setAiConfig(prev => ({ ...prev, provider: p.id, model: defModel }));
                    }}
                    className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between ${
                      aiConfig.provider === p.id
                        ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-200'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="font-bold text-xs text-white">{p.name}</span>
                    <span className="text-[10px] text-slate-500 mt-1">{p.desc}</span>
                  </button>
                ))}
              </div>

              {/* API Key Input */}
              {aiConfig.provider !== 'edge' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      مفتاح الـ API Key ({aiConfig.provider})
                    </label>
                    <input
                      type="password"
                      value={aiConfig.apiKey}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                      placeholder={aiConfig.hasApiKey ? '•••••••••••••••• (مفتاح مسجل مسبقاً)' : 'ألصق المفتاح هنا (sk-...)'}
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      اسم النموذج (Model Name)
                    </label>
                    <input
                      type="text"
                      value={aiConfig.model}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-300 block mb-1">
                      عنوان الـ Base URL المخصص (اختياري)
                    </label>
                    <input
                      type="text"
                      value={aiConfig.customBaseUrl}
                      onChange={(e) => setAiConfig(prev => ({ ...prev, customBaseUrl: e.target.value }))}
                      placeholder="https://... أو اتركه فارغاً للافتراضي"
                      className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleTestAiConnection}
                  disabled={isTestingKey}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Activity className={`w-4 h-4 ${isTestingKey ? 'animate-spin' : ''}`} />
                  <span>{isTestingKey ? 'جاري الفحص...' : 'اختبار الاتصال'}</span>
                </button>

                <button
                  onClick={handleSaveAiConfig}
                  disabled={isSavingKey}
                  className="flex-1 py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSavingKey ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
                </button>
              </div>

              {testResult && (
                <div className={`p-4 rounded-2xl border text-xs font-medium ${
                  testResult.success ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' : 'bg-red-950/40 border-red-500/40 text-red-300'
                }`}>
                  <div className="font-bold mb-1">{testResult.message}</div>
                  {testResult.latencyMs !== undefined && (
                    <div className="text-[11px] opacity-80">زمن الاستجابة (Latency): {testResult.latencyMs}ms</div>
                  )}
                </div>
              )}
            </div>

            {/* Persona & Voice Customization */}
            <div className="bg-slate-900/70 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-5">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-purple-400" />
                  تخصيص شخصية وصوت المساعد
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  اختر اسم المساعد، سرعة النطق، ونبرة الصوت
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  اسم المساعد الصوتي
                </label>
                <input
                  type="text"
                  value={aiConfig.assistantName}
                  onChange={(e) => setAiConfig(prev => ({ ...prev, assistantName: e.target.value }))}
                  placeholder="رورو (Roro) أو موسى (MOSA)"
                  className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  نمط اللهجة والتفاعل
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'iraqi_modern', name: 'العراقية الحديثة 🇮🇶', desc: 'كلوبات، سبلت، ماطور' },
                    { id: 'standard_arabic', name: 'الفصحى الدافئة 🇸🇦', desc: 'إنارة، تكييف، مضخة' },
                    { id: 'khaleeji', name: 'الخليجية 🇦🇪', desc: 'ليتات، مكيف، قفل' },
                    { id: 'shami', name: 'الشامية 🇱🇧', desc: 'ضوا، شوفاج، برادي' },
                  ].map((dial) => (
                    <button
                      key={dial.id}
                      onClick={() => setAiConfig(prev => ({ ...prev, languageMode: dial.id }))}
                      className={`p-3 rounded-2xl border text-right transition-all ${
                        aiConfig.languageMode === dial.id
                          ? 'bg-purple-500/20 border-purple-500/50 text-purple-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-white">{dial.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{dial.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>سرعة النطق الصوتي (Rate)</span>
                    <span className="font-mono text-cyan-400">{voiceSettings.rate}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.7"
                    max="1.4"
                    step="0.05"
                    value={voiceSettings.rate}
                    onChange={(e) => {
                      const updated = saveVoiceSettings({ rate: parseFloat(e.target.value) });
                      setVoiceSettings(updated);
                    }}
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>حدة ونبرة الصوت (Pitch)</span>
                    <span className="font-mono text-purple-400">{voiceSettings.pitch}</span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="1.5"
                    step="0.05"
                    value={voiceSettings.pitch}
                    onChange={(e) => {
                      const updated = saveVoiceSettings({ pitch: parseFloat(e.target.value) });
                      setVoiceSettings(updated);
                    }}
                    className="w-full accent-purple-400"
                  />
                </div>
              </div>

              <button
                onClick={() => speakMosaVoice(`أهلاً بك! أنا ${aiConfig.assistantName}، مساعدتك الصوتية الذكية لإدارة منزلك بأعلى دقة وسرعة.`, undefined, voiceSettings)}
                className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-bold text-xs rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Volume2 className="w-4 h-4" />
                <span>تجربة الصوت الآن</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
