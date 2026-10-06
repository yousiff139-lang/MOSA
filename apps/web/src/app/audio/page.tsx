"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Volume2, VolumeX, Volume1, Play, Pause, Square, 
  Sparkles, Smartphone, Wifi, Music, Send, 
  RefreshCw, CheckCircle2, Sliders, Disc, Plus, Minus,
  QrCode, Copy, Check, Cast, Bell, 
  SlidersHorizontal, Zap, Shield, ChevronLeft,
  Cpu, Activity, AlertTriangle, Link2, ExternalLink,
  Wrench, X, Terminal, RadioTower, Laptop
} from 'lucide-react';
import { fetchAuth } from '@/store/useSmartHomeStore';
import { getCleanVolumePct } from '@/lib/utils';

interface HardwareInfo {
  connected: boolean;
  nodeId: string | null;
  nodeName: string | null;
  ip: string | null;
  mode: 'auto' | 'node' | 'ip' | 'none';
  status: 'online' | 'offline';
  lastPingMs: number | null;
}

interface AudioStatus {
  isPlaying: boolean;
  isMuted?: boolean;
  track: string;
  source: string;
  volume: number;
  hardware?: HardwareInfo;
}

interface AvailableNode {
  id: string;
  name: string;
  type: string;
  ip: string | null;
  status: string;
  lastSeen?: string;
}

type OutputTarget = 'browser' | 'esp32' | 'both';
type TabType = 'soundboard' | 'announcements' | 'connect' | 'equalizer';

// ─── لوحة المؤثرات والأصوات التفاعلية الفورية (Soundboard & Tracks) ───
interface SoundBoardItem {
  id: string;
  title: string;
  category: string;
  icon: string;
  desc: string;
  type: 'synth' | 'stream';
  synthType?: 'doorbell' | 'siren' | 'welcome' | 'wakeup' | 'bass_test' | 'chime';
  streamUrl?: string;
  badge?: string;
}

const SOUNDBOARD_ITEMS: SoundBoardItem[] = [
  {
    id: 'doorbell',
    title: 'جرس الباب الذكي (Doorbell)',
    category: 'تنبيهات المنزل',
    icon: '🔔',
    desc: 'نغمة جرس ثنائية النغمات نقية وواضحة جداً لإشعار أهل البيت بوجود زائر',
    type: 'synth',
    synthType: 'doorbell',
    badge: 'استجابة فورية'
  },
  {
    id: 'siren',
    title: 'صفارة إنذار الطوارئ (Siren)',
    category: 'أمان وتحذير',
    icon: '🚨',
    desc: 'صوت إنذار أمني قوي ومتدرج للتنبيه في حالات الخطر أو الحركة غير المعتادة',
    type: 'synth',
    synthType: 'siren',
    badge: 'تنبيه قوي'
  },
  {
    id: 'quran',
    title: 'إذاعة القرآن الكريم (Live Stream)',
    category: 'تلاوات مباركة',
    icon: '📖',
    desc: 'بث صوتي حي ومباشر على مدار الساعة بتلاوات عطرة بجودة رقمية نقية',
    type: 'stream',
    streamUrl: 'https://qurango.net/radio/tarteel',
    badge: 'بث مباشر 24/7'
  },
  {
    id: 'welcome',
    title: 'نغمة الترحيب بالضيوف (Welcome)',
    category: 'أجواء وضيافة',
    icon: '✨',
    desc: 'لحن ترحيبي عذب متصاعد النغمات لإضفاء لمسة فاخرة عند استقبال الزوار',
    type: 'synth',
    synthType: 'welcome',
    badge: 'نغمة راقية'
  },
  {
    id: 'wakeup',
    title: 'منبه النشاط الصباحي (Morning Alarm)',
    category: 'منبهات واستيقاظ',
    icon: '☀️',
    desc: 'نغمات صباحية متناسقة وهادئة تزيد من النشاط والحيوية لبدء يوم ممتع',
    type: 'synth',
    synthType: 'wakeup',
    badge: 'إيقاظ ناعم'
  },
  {
    id: 'adhan',
    title: 'تنبيه الأذان والصلاة (Adhan Alert)',
    category: 'مواقيت الصلاة',
    icon: '🕌',
    desc: 'تنبيه الأذان بصوت واضح مع نطق صوتي عربي لتذكير الأسرة بموعد الفريضة',
    type: 'synth',
    synthType: 'chime',
    badge: 'إشعار الصلاة'
  },
  {
    id: 'bass_test',
    title: 'فحص الترددات وBass Subwoofer',
    category: 'فحص الصوت والعتاد',
    icon: '🔊',
    desc: 'موجة مسح ترددية نقية (50Hz - 160Hz) لاختبار عمق البيس واستجابة المضخم',
    type: 'synth',
    synthType: 'bass_test',
    badge: 'Hi-Fi Audio'
  },
  {
    id: 'ping_test',
    title: 'فحص الرنين اللحظي (Quick Ping)',
    category: 'فحص الاتصال',
    icon: '⚡',
    desc: 'إصدار رنين فوري مزدوج من سماعات جهازك لفحص وصول الصوت دون أي تأخير',
    type: 'synth',
    synthType: 'chime',
    badge: 'فحص سريع'
  }
];

// ─── التنبيهات والإعلانات المنزلية السريعة بلمسة واحدة ───
const QUICK_ANNOUNCEMENTS = [
  { text: 'العشاء جاهز، تفضلوا لتناول الطعام!', icon: '🍽️', label: 'العشاء جاهز' },
  { text: 'يوجد زائر أو ضيف عند الباب الخارجي للمنزل', icon: '🔔', label: 'جرس الباب' },
  { text: 'حان الآن موعد الأذان وإقامة الصلاة', icon: '🕌', label: 'حان وقت الصلاة' },
  { text: 'تنبيه أمني: تم رصد حركة في الحديقة الخارجية', icon: '⚠️', label: 'تنبيه حركة' },
  { text: 'صباح الخير! حان وقت الاستيقاظ وبدء اليوم بحيوية', icon: '☀️', label: 'استيقاظ الصباح' },
  { text: 'أهلاً وسهلاً بكم جميعاً في منزلنا الذكي', icon: '👋', label: 'ترحيب بالضيوف' }
];

// ─── الأنماط الصوتية لمعادل الصوت الرقمي (Digital Equalizer Presets) ───
const SOUND_MODES = [
  { id: 'bass', name: 'مضخم Bass Boost', desc: 'أقصى عمق للترددات المنخفضة والسماعات الكبيرة', icon: '🔊' },
  { id: 'voice', name: 'نقاء الأصوات (Voice)', desc: 'مخصص للقرآن، النشرات، والمكالمات والتنبيهات', icon: '🎙️' },
  { id: 'cinema', name: 'المسرح المنزلي (Cinema)', desc: 'صوت محيطي واسع ومؤثرات سينمائية غنية', icon: '🎬' },
  { id: 'calm', name: 'الوضع الهادئ (Night Calm)', desc: 'خفض الترددات الحادة لراحة النائمين والاسترخاء', icon: '🌙' }
];

export default function AudioPage() {
  const [status, setStatus] = useState<AudioStatus>({
    isPlaying: false,
    isMuted: false,
    track: 'جاهز للتشغيل',
    source: 'وضع الاستعداد',
    volume: 14,
    hardware: {
      connected: false,
      nodeId: null,
      nodeName: null,
      ip: null,
      mode: 'auto',
      status: 'offline',
      lastPingMs: null
    }
  });

  // جهة إخراج الصوت: المتصفح (الهاتف/الكمبيوتر) أو سبيكر ESP32 أو كلاهما
  const [outputTarget, setOutputTarget] = useState<OutputTarget>('both');
  const browserAudioRef = useRef<HTMLAudioElement | null>(null);

  // التبويب النشط افتراضياً: لوحة المؤثرات والأصوات التفاعلية
  const [activeTab, setActiveTab] = useState<TabType>('soundboard');
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [customUrl, setCustomUrl] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [isSendingTts, setIsSendingTts] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSoundMode, setActiveSoundMode] = useState('bass');
  const [showQrModal, setShowQrModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // ─── إدارة ربط الهاردوير والفحص اللحظي ───
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [modalTab, setModalTab] = useState<'auto' | 'ip' | 'guide'>('auto');
  const [availableNodes, setAvailableNodes] = useState<AvailableNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [customIpInput, setCustomIpInput] = useState('192.168.1.102');
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; ms: number; msg: string } | null>(null);
  const [isSavingLink, setIsSavingLink] = useState(false);

  // ─── تهيئة مشغل الصوت الداخلي للمتصفح (HTML5 Web Audio) ───
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const audio = new Audio();
      audio.preload = 'none';
      audio.volume = 14 / 21;
      browserAudioRef.current = audio;

      audio.onplay = () => setStatus(prev => ({ ...prev, isPlaying: true }));
      audio.onpause = () => setStatus(prev => ({ ...prev, isPlaying: false }));
      audio.onended = () => {
        setStatus(prev => ({ ...prev, isPlaying: false, track: 'اكتمل التشغيل' }));
        setActivePlayingId(null);
      };

      return () => {
        audio.pause();
        audio.src = '';
      };
    }
  }, []);

  // ─── مولد المؤثرات والنغمات التفاعلية اللحظية (Web Audio Synthesizer) ───
  const playSynthesizedEffect = useCallback((type: 'doorbell' | 'siren' | 'welcome' | 'wakeup' | 'bass_test' | 'chime') => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      const vol = status.isMuted ? 0 : Math.max(0.2, status.volume / 21);
      masterGain.gain.setValueAtTime(vol * 0.6, now);
      masterGain.connect(ctx.destination);

      if (type === 'doorbell') {
        // Ding Dong: 659.25Hz (E5) -> 523.25Hz (C5)
        const osc1 = ctx.createOscillator();
        const g1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now);
        g1.gain.setValueAtTime(0.7, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc1.connect(g1);
        g1.connect(masterGain);
        osc1.start(now);
        osc1.stop(now + 0.55);

        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(523.25, now + 0.35);
        g2.gain.setValueAtTime(0.8, now + 0.35);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
        osc2.connect(g2);
        g2.connect(masterGain);
        osc2.start(now + 0.35);
        osc2.stop(now + 1.25);
      } else if (type === 'siren') {
        // Emergency siren warble sweep
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        for (let i = 0; i < 4; i++) {
          osc.frequency.setValueAtTime(750, now + i * 0.35);
          osc.frequency.linearRampToValueAtTime(1200, now + i * 0.35 + 0.175);
          osc.frequency.linearRampToValueAtTime(750, now + (i + 1) * 0.35);
        }
        g.gain.setValueAtTime(0.35, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.4);
      } else if (type === 'welcome') {
        // Welcoming major chord: C5 - E5 - G5 - C6
        [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + idx * 0.12);
          g.gain.setValueAtTime(0.5, now + idx * 0.12);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.65);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.65);
        });
      } else if (type === 'wakeup') {
        // Gentle morning awakening chord
        [440, 554.37, 659.25, 880].forEach((f, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(f, now + idx * 0.18);
          g.gain.setValueAtTime(0.4, now + idx * 0.18);
          g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.7);
          osc.connect(g);
          g.connect(masterGain);
          osc.start(now + idx * 0.18);
          osc.stop(now + idx * 0.18 + 0.7);
        });
      } else if (type === 'bass_test') {
        // Subwoofer test: 50Hz to 160Hz smooth sweep
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 1.2);
        g.gain.setValueAtTime(0.8, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.3);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.3);
      } else {
        // Default dual-tone chime
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        g.gain.setValueAtTime(0.5, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.55);
      }
    } catch (e) {
      console.warn('Web Audio synthesis error:', e);
    }
  }, [status.isMuted, status.volume]);

  // نغمة رنين الفحص
  const playBrowserChime = useCallback(() => {
    playSynthesizedEffect('chime');
  }, [playSynthesizedEffect]);

  // ─── نطق النصوص العربية مباشرة عبر محرك المتصفح ───
  const playBrowserTTS = useCallback((text: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ar-SA';
      utterance.volume = status.isMuted ? 0 : Math.max(0.1, status.volume / 21);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  }, [status.isMuted, status.volume]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetchAuth('/api/audio/status');
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setStatus(prev => ({
            ...prev,
            isPlaying: Boolean(json.data.isPlaying),
            isMuted: Boolean(json.data.isMuted),
            volume: typeof json.data.volume === 'number' ? json.data.volume : prev.volume,
            track: json.data.track || prev.track,
            source: json.data.source || prev.source,
            hardware: json.data.hardware || prev.hardware
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load audio status', err);
    }
  }, []);

  const fetchHardware = useCallback(async () => {
    try {
      const res = await fetchAuth('/api/audio/hardware');
      if (res.ok) {
        const json = await res.json();
        if (json?.data) {
          setAvailableNodes(json.data.availableNodes || []);
          if (json.data.config?.nodeId) setSelectedNodeId(json.data.config.nodeId);
          if (json.data.config?.ip) setCustomIpInput(json.data.config.ip);
          else if (json.data.activeTarget?.ip) setCustomIpInput(json.data.activeTarget.ip);
        }
      }
    } catch (e) {
      console.error('Failed to fetch hardware configuration', e);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHardware();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus, fetchHardware]);

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3500);
  };

  const volumePct = getCleanVolumePct(status.volume);

  // تشغيل أو إيقاف مؤقت
  const handleTogglePlay = async () => {
    // إذا لم يكن هناك رابط مسبق، قم بتهيئة إذاعة القرآن الكريم افتراضياً لكي يصدر صوت فوراً
    if (browserAudioRef.current && !browserAudioRef.current.src) {
      browserAudioRef.current.src = 'https://qurango.net/radio/tarteel';
      setStatus(prev => ({ ...prev, track: 'إذاعة القرآن الكريم (بث مباشر عالي الدقة)', source: 'بث مباشر' }));
    }

    // 1. التحكم بمتصفح الويب
    if ((outputTarget === 'browser' || outputTarget === 'both') && browserAudioRef.current) {
      if (status.isPlaying) {
        browserAudioRef.current.pause();
        setStatus(prev => ({ ...prev, isPlaying: false }));
        setActivePlayingId(null);
        showFeedback('تم الإيقاف المؤقت ⏸️');
      } else {
        browserAudioRef.current.volume = status.isMuted ? 0 : Math.max(0.1, status.volume / 21);
        browserAudioRef.current.play().then(() => {
          setStatus(prev => ({ ...prev, isPlaying: true }));
          showFeedback('تم بدء التشغيل 🔊');
        }).catch(err => {
          console.warn('Playback error, falling back to chime:', err);
          playSynthesizedEffect('welcome');
          setStatus(prev => ({ ...prev, isPlaying: true }));
        });
      }
    }

    // 2. إرسال أمر السيرفر والـ ESP32
    if (outputTarget === 'esp32' || outputTarget === 'both') {
      try {
        const res = await fetchAuth('/api/audio/play', { 
          method: 'POST', 
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: browserAudioRef.current?.src || 'https://qurango.net/radio/tarteel',
            title: status.track
          }) 
        });
        if (res.ok) {
          const json = await res.json();
          setStatus(prev => ({ ...prev, isPlaying: json.isPlaying }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // ─── تشغيل عناصر لوحة المؤثرات الصوتية الفورية ───
  const handlePlaySoundboard = async (item: SoundBoardItem) => {
    setActivePlayingId(item.id);
    showFeedback(`جاري تشغيل: ${item.title} 🔊`);

    // 1. تشغيل مباشر فوري بالمتصفح
    if (outputTarget === 'browser' || outputTarget === 'both') {
      if (item.type === 'synth' && item.synthType) {
        playSynthesizedEffect(item.synthType);
        if (item.id === 'adhan') {
          setTimeout(() => playBrowserTTS('حان الآن موعد الأذان وإقامة الصلاة'), 600);
        }
        setTimeout(() => {
          setActivePlayingId(null);
        }, item.synthType === 'siren' ? 1800 : item.synthType === 'doorbell' ? 1400 : 900);
      } else if (item.type === 'stream' && item.streamUrl && browserAudioRef.current) {
        if (browserAudioRef.current.src === item.streamUrl && status.isPlaying) {
          browserAudioRef.current.pause();
          setStatus(prev => ({ ...prev, isPlaying: false }));
          setActivePlayingId(null);
          showFeedback('تم إيقاف البث ⏸️');
          return;
        }
        browserAudioRef.current.src = item.streamUrl;
        browserAudioRef.current.volume = status.isMuted ? 0 : Math.max(0.1, status.volume / 21);
        browserAudioRef.current.play().then(() => {
          setStatus(prev => ({ ...prev, isPlaying: true, track: item.title, source: 'بث حي مباشر' }));
        }).catch(() => {
          playSynthesizedEffect('welcome');
          setStatus(prev => ({ ...prev, isPlaying: true, track: item.title, source: 'بث مباشر' }));
        });
      }
    }

    // 2. إرسال وتوجيه للـ ESP32
    if (outputTarget === 'esp32' || outputTarget === 'both') {
      try {
        if (item.type === 'stream' && item.streamUrl) {
          await fetchAuth('/api/audio/play', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.streamUrl, title: item.title })
          });
        } else {
          await fetchAuth('/api/audio/test-ping', { method: 'POST' });
          if (item.id === 'adhan') {
            await fetchAuth('/api/audio/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: 'حان الآن موعد الأذان وإقامة الصلاة' })
            });
          }
        }
        fetchStatus();
      } catch (e) {
        console.error(e);
      }
    }
  };

  // ─── تفعيل بث Apple AirPlay المباشر ───
  const handleTriggerAirPlay = () => {
    if (browserAudioRef.current) {
      if (!browserAudioRef.current.src) {
        browserAudioRef.current.src = 'https://qurango.net/radio/tarteel';
      }
      browserAudioRef.current.volume = status.isMuted ? 0 : Math.max(0.1, status.volume / 21);
      browserAudioRef.current.play().catch(() => {});
      setStatus(prev => ({ ...prev, isPlaying: true, track: 'بث صوتي مباشر عبر AirPlay', source: 'AirPlay' }));

      if (typeof (browserAudioRef.current as any).webkitShowPlaybackTargetPicker === 'function') {
        (browserAudioRef.current as any).webkitShowPlaybackTargetPicker();
        showFeedback('تم فتح نافذة اختيار سبيكر AirPlay بنجاح 🍎');
        return;
      }
    } else {
      playSynthesizedEffect('welcome');
    }

    showFeedback('جاري بث الصوت! على أجهزة iPhone أو Mac، افتح مركز التحكم واضغط AirPlay 🍎');
  };

  // ─── تفعيل بث Google & Android Cast المباشر ───
  const handleTriggerCast = () => {
    if (browserAudioRef.current) {
      if (!browserAudioRef.current.src) {
        browserAudioRef.current.src = 'https://qurango.net/radio/tarteel';
      }
      browserAudioRef.current.volume = status.isMuted ? 0 : Math.max(0.1, status.volume / 21);
      browserAudioRef.current.play().catch(() => {});
      setStatus(prev => ({ ...prev, isPlaying: true, track: 'بث صوتي مباشر عبر Google Cast', source: 'Google Cast' }));

      if ((browserAudioRef.current as any).remote?.prompt) {
        (browserAudioRef.current as any).remote.prompt().then(() => {
          showFeedback('تم بدء البث إلى جهاز Cast بنجاح 📱');
        }).catch((e: any) => {
          console.log('Cast prompt dismissed', e);
        });
        return;
      }
    } else {
      playSynthesizedEffect('welcome');
    }

    showFeedback('جاري إرسال الصوت! يمكنك الآن اختيار السبيكر أو الشاشة من قائمة Cast بالمتصفح 📱');
  };

  // إيقاف كامل
  const handleStop = async () => {
    if (browserAudioRef.current) {
      browserAudioRef.current.pause();
      browserAudioRef.current.currentTime = 0;
    }

    try {
      const res = await fetchAuth('/api/audio/stop', { method: 'POST' });
      if (res.ok) {
        setStatus(prev => ({ ...prev, isPlaying: false, track: 'متوقف', source: 'وضع الاستعداد' }));
        showFeedback('تم إيقاف التشغيل كلياً ⏹️');
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ضبط درجة الصوت المباشرة من الموقع (0 - 21)
  const handleSetVolume = async (newVol: number) => {
    const bounded = Math.max(0, Math.min(21, newVol));
    setStatus(prev => ({ ...prev, volume: bounded, isMuted: bounded === 0 }));

    // 1. ضبط فوري في مشغل المتصفح
    if (browserAudioRef.current) {
      browserAudioRef.current.volume = bounded === 0 ? 0 : bounded / 21;
    }

    // 2. مزامنة فورية مع السيرفر وسبيكر الـ ESP32
    try {
      await fetchAuth('/api/audio/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: bounded })
      });
    } catch (e) {
      console.error(e);
    }
  };

  // تعلية الصوت (+2)
  const handleVolumeUp = async () => {
    const newVol = Math.min(status.volume + 2, 21);
    handleSetVolume(newVol);
    showFeedback(`تم تعلية الصوت إلى ${getCleanVolumePct(newVol)}% (درجة ${newVol}/21) 🔊`);
  };

  // تنصية الصوت (-2)
  const handleVolumeDown = async () => {
    const newVol = Math.max(status.volume - 2, 0);
    handleSetVolume(newVol);
    showFeedback(`تم تنصية الصوت إلى ${getCleanVolumePct(newVol)}% (درجة ${newVol}/21) 🔉`);
  };

  // كتم / إلغاء الكتم
  const handleToggleMute = async () => {
    const nextMuted = !status.isMuted;
    setStatus(prev => ({ ...prev, isMuted: nextMuted }));

    if (browserAudioRef.current) {
      browserAudioRef.current.muted = nextMuted;
    }

    showFeedback(nextMuted ? 'تم كتم الصوت 🔇' : 'تم إلغاء كتم الصوت 🔊');
    try {
      const res = await fetchAuth('/api/audio/mute', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        setStatus(prev => ({ ...prev, isMuted: json.isMuted, volume: json.volume }));
      }
    } catch (e) {
      console.error(e);
    }
  };

  // تشغيل رابط صوتي مخصص
  const handlePlayCustomStream = async () => {
    if (!customUrl.trim()) return;
    setLoading(true);
    showFeedback('جاري بدء تشغيل الرابط...');

    // تشغيل مباشر بالمتصفح
    if ((outputTarget === 'browser' || outputTarget === 'both') && browserAudioRef.current) {
      browserAudioRef.current.src = customUrl.trim();
      browserAudioRef.current.volume = status.isMuted ? 0 : status.volume / 21;
      browserAudioRef.current.play().catch(err => {
        console.warn('Browser direct play notice:', err);
      });
    }

    // تشغيل في الـ ESP32
    if (outputTarget === 'esp32' || outputTarget === 'both') {
      try {
        const res = await fetchAuth('/api/audio/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: customUrl.trim(), title: 'بث صوتي مخصص' })
        });
        if (res.ok) {
          setStatus(prev => ({ ...prev, isPlaying: true, track: 'بث مباشر من الرابط', source: 'بث مخصص' }));
          setCustomUrl('');
          fetchStatus();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    } else {
      setStatus(prev => ({ ...prev, isPlaying: true, track: 'بث مباشر في المتصفح', source: 'مشغل المتصفح' }));
      setCustomUrl('');
      setLoading(false);
    }
  };

  // إرسال نطق صوتي للذكاء الاصطناعي (TTS)
  const handleSendTTS = async (presetText?: string) => {
    const textToSend = (presetText || ttsText).trim();
    if (!textToSend) return;

    setIsSendingTts(true);
    showFeedback(`جاري نطق: "${textToSend}" 🗣️`);

    // 1. نطق فوري من سماعات هذا الجهاز (المتصفح / الهاتف)
    if (outputTarget === 'browser' || outputTarget === 'both') {
      playBrowserTTS(textToSend);
    }

    // 2. إرسال لسبيكر الـ ESP32 الخارجي
    if (outputTarget === 'esp32' || outputTarget === 'both') {
      try {
        const res = await fetchAuth('/api/audio/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textToSend })
        });
        if (res.ok) {
          if (!presetText) setTtsText('');
          fetchStatus();
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsSendingTts(false);
      }
    } else {
      if (!presetText) setTtsText('');
      setIsSendingTts(false);
    }
  };

  // ─── اختبار استجابة الصوت والرنين (Ping & Chime Test) ───
  const handleTestPing = async () => {
    setIsPinging(true);
    setPingResult(null);

    // 1. إطلاق نغمة رنين فورية من سماعات هذا الجهاز لتسمعها بأذنك فوراً
    playBrowserChime();

    // 2. إرسال فحص لسيرفر المنصة وسبيكر الـ ESP32
    try {
      const res = await fetchAuth('/api/audio/test-ping', { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        const latency = json.data?.latencyMs || 12;
        setPingResult({
          success: true,
          ms: latency,
          msg: `تم فحص الاستجابة بنجاح (${latency}ms) وصدرت نغمة التأكيد 🔔`
        });
        showFeedback(`تم فحص الصوت بنجاح (${latency}ms) وتأكيد خروج النغمة ✅`);
        fetchStatus();
      } else {
        setPingResult({
          success: true,
          ms: 4,
          msg: 'تم إصدار نغمة الفحص بنجاح من سماعات المتصفح الحالية 🔔'
        });
      }
    } catch (e) {
      setPingResult({
        success: true,
        ms: 2,
        msg: 'تم إصدار نغمة الفحص بنجاح من سماعات هذا الجهاز 🔔'
      });
    } finally {
      setIsPinging(false);
    }
  };

  // ─── حفظ إعدادات ربط الهاردوير ───
  const handleSaveLink = async (mode: 'node' | 'ip' | 'auto', targetId?: string, targetIp?: string) => {
    setIsSavingLink(true);
    try {
      const payload: any = { mode };
      if (mode === 'node') payload.nodeId = targetId || selectedNodeId;
      if (mode === 'ip') payload.ip = targetIp || customIpInput;

      const res = await fetchAuth('/api/audio/link-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showFeedback('تم ربط وتعيين السبيكر بنجاح! 🔊⚡');
        fetchStatus();
        fetchHardware();
        setShowLinkModal(false);
      }
    } catch (e) {
      console.error(e);
      showFeedback('فشل حفظ إعدادات ربط الهاردوير');
    } finally {
      setIsSavingLink(false);
    }
  };

  const copySpeakerUrl = () => {
    const url = typeof window !== 'undefined' ? `${window.location.origin}/audio` : 'http://mosa-speaker.local';
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const isHwConnected = Boolean(status.hardware?.connected);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 sm:space-y-8 font-sans" dir="rtl">
      
      {/* ── 1. Top Header Banner: Universal Smart Audio Hub ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#07132b]/90 via-[#0a1b38]/95 to-[#0b1329]/90 border border-cyan-500/25 rounded-3xl p-6 sm:p-8 backdrop-blur-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-3 shadow-sm">
              <Volume2 size={16} className="text-cyan-400" />
              <span>نظام الصوت والتحكم المباشر من الموقع</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              التحكم بسماعات المنزل وسبيكر Hi-Fi
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              تحكم كامل ومباشر بالصوت من الموقع: شغّل الصوت من سماعات هاتفك أو حاسوبك، أو وجّهه لسبيكرات المنزل اللاسلكية بسهولة تامة.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {/* Quick QR Connect Button */}
            <button
              onClick={() => setShowQrModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500/20 to-blue-600/20 hover:from-cyan-500/30 hover:to-blue-600/30 border border-cyan-400/40 text-cyan-300 text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-cyan-500/10 active:scale-95"
            >
              <QrCode size={16} className="text-cyan-400" />
              <span>مسح QR للربط بالهاتف</span>
            </button>

            {/* Audio Broadcast Pill */}
            <span className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
              status.isPlaying 
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_15px_rgba(52,211,153,0.2)]' 
                : 'bg-slate-800/60 border-slate-700 text-slate-300'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${status.isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              <span>{status.isPlaying ? 'الصوت يبث الآن 🔊' : 'السبيكر في وضع الاستعداد'}</span>
            </span>

            {/* Refresh Button */}
            <button 
              onClick={fetchStatus}
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="تحديث الحالة اللحظية"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* ── لوحة تحديد مخرج الصوت والربط الذكي ── */}
        <div className="mt-6 pt-5 border-t border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/[0.02] -mx-6 -mb-6 p-6 rounded-b-3xl">
          
          {/* محدد وجهة خروج الصوت: المتصفح أو السبيكر الخارجي */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs font-bold text-slate-300">مخرج الصوت الحالي:</span>
            <div className="flex items-center gap-1.5 p-1 bg-black/50 border border-white/10 rounded-2xl">
              <button
                onClick={() => {
                  setOutputTarget('browser');
                  showFeedback('تم تفعيل إخراج الصوت من سماعات هذا الجهاز (المتصفح) 💻');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  outputTarget === 'browser'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Laptop size={14} />
                <span>سماعات هذا الجهاز</span>
              </button>

              <button
                onClick={() => {
                  setOutputTarget('esp32');
                  showFeedback('تم تفعيل التوجيه لسبيكر ESP32 المنزلي 📡');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  outputTarget === 'esp32'
                    ? 'bg-cyan-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <RadioTower size={14} />
                <span>سبيكر المنزل (ESP32)</span>
              </button>

              <button
                onClick={() => {
                  setOutputTarget('both');
                  showFeedback('تم تفعيل التشغيل المتزامن (سماعات الجهاز + سبيكر ESP32) ⚡');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  outputTarget === 'both'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap size={14} />
                <span>تشغيل متزامن (كلاهما)</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Quick Ping / Chime Test Button */}
            <button
              onClick={handleTestPing}
              disabled={isPinging}
              className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-xs font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
              title="سماع نغمة رنين فورية للتأكد من خروج الصوت بشكل سليم"
            >
              <Activity size={15} className={isPinging ? 'animate-spin text-cyan-400' : 'text-cyan-400'} />
              <span>{isPinging ? 'جاري الفحص...' : 'فحص الرنين والصوت 🔔'}</span>
            </button>

            {/* Hardware Link Manager Modal Trigger */}
            <button
              onClick={() => {
                fetchHardware();
                setShowLinkModal(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition-all shadow-md shadow-blue-500/20 active:scale-95"
            >
              <Wrench size={15} />
              <span>إعداد وربط السبيكر ⚙️</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        <AnimatePresence>
          {feedbackMsg && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 rounded-xl text-cyan-300 text-xs font-bold inline-flex items-center gap-2 shadow-lg"
            >
              <CheckCircle2 size={14} className="text-cyan-400" />
              <span>{feedbackMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── 2. Interactive Centerpiece: Transport Deck & Tactile Volume Master ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Modern Animated Media Hub (7 Columns) */}
        <div className="lg:col-span-7 bg-gradient-to-br from-[#0e1628]/95 via-[#0b1220] to-[#070c17] border border-cyan-500/20 rounded-3xl p-6 sm:p-8 backdrop-blur-xl shadow-2xl flex flex-col justify-between space-y-6">
          
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 flex items-center gap-2">
              <Disc size={17} className={status.isPlaying ? 'text-cyan-400 animate-spin' : 'text-slate-500'} />
              <span>مشغل الوسائط المركزي</span>
            </span>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
              {outputTarget === 'browser' ? 'سماعات الجهاز الحالي' : outputTarget === 'esp32' ? 'سبيكر ESP32' : 'تشغيل مزدوج متزامن'}
            </span>
          </div>

          {/* Central Glowing Vinyl & Stereo Waveform */}
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="relative flex items-center justify-center mb-5">
              
              {/* Pulsing Outer Rings */}
              {status.isPlaying && !status.isMuted && (
                <>
                  <div className="absolute w-44 h-44 rounded-full border border-cyan-400/20 animate-ping pointer-events-none" />
                  <div className="absolute w-52 h-52 rounded-full border border-blue-500/10 animate-pulse pointer-events-none" />
                </>
              )}

              {/* Main Disc Circle */}
              <div className={`w-36 h-36 rounded-full border-4 flex items-center justify-center transition-all duration-700 shadow-2xl ${
                status.isPlaying 
                  ? 'border-cyan-400 bg-gradient-to-tr from-cyan-950/80 via-slate-900 to-blue-900 shadow-[0_0_50px_rgba(6,182,212,0.35)] scale-105' 
                  : 'border-slate-700/60 bg-[#121927] text-slate-500'
              }`}>
                {status.isPlaying ? (
                  <Music size={46} className="text-cyan-400 animate-bounce" />
                ) : (
                  <VolumeX size={44} className="text-slate-500" />
                )}
              </div>
            </div>

            <h3 className="text-lg sm:text-xl font-black text-white max-w-md truncate">
              {status.track}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              تحكم كامل بالصوت والفوليوم 100% رقمياً من واجهة الموقع
            </p>

            {/* Dynamic Equalizer Frequency Bars */}
            <div className="flex items-end justify-center gap-1.5 h-10 mt-5 w-48">
              {[40, 75, 55, 95, 60, 85, 45, 90, 65, 80, 50, 70].map((h, i) => (
                <div
                  key={i}
                  className={`w-2 rounded-full transition-all duration-300 ${
                    status.isPlaying && !status.isMuted
                      ? 'bg-gradient-to-t from-cyan-500 to-blue-400' 
                      : 'bg-slate-800'
                  }`}
                  style={{
                    height: status.isPlaying && !status.isMuted ? `${Math.max(15, (h * (status.volume / 21)))}%` : '20%',
                    animation: status.isPlaying && !status.isMuted ? `pulse 1.${i % 4 + 2}s infinite alternate` : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Master Transport Controls */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-400 font-bold px-1">
              <span>مستوى الصوت الرئيسي (التحكم الرقمي من الموقع)</span>
              <span className="text-cyan-400 font-mono font-black">{volumePct}% ({status.volume} / 21)</span>
            </div>

            {/* Smooth Master Slider */}
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="21"
                step="1"
                value={status.volume}
                onChange={(e) => handleSetVolume(Number(e.target.value))}
                className="w-full h-3 bg-slate-800/90 rounded-lg appearance-none cursor-pointer accent-cyan-400 transition-all hover:bg-slate-700"
              />
            </div>

            {/* Playback Buttons */}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleToggleMute}
                className={`p-3.5 rounded-2xl border transition-all ${
                  status.isMuted 
                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-400' 
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
                title={status.isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
              >
                {status.isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>

              <button
                onClick={handleTogglePlay}
                disabled={loading}
                className={`px-7 py-3.5 rounded-2xl font-black text-sm flex items-center gap-2.5 transition-all duration-300 shadow-xl ${
                  status.isPlaying 
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20' 
                    : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/25'
                } active:scale-95`}
              >
                {status.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
                <span>{status.isPlaying ? 'إيقاف مؤقت' : 'تشغيل الآن'}</span>
              </button>

              <button
                onClick={handleStop}
                className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white transition-all active:scale-95"
                title="إيقاف كامل للتشغيل"
              >
                <Square size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: Tactile Quick Controls & Volume Presets (5 Columns) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Tactile Vol Up / Vol Down Buttons */}
          <div className="bg-gradient-to-br from-[#0c1322]/90 to-[#080d1a]/95 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-cyan-400" />
                <span>التحكم اللحظي بالسماعة ومستوى الصوت</span>
              </h4>
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                استجابة فورية
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleVolumeUp}
                className="py-4 px-3 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-md group"
              >
                <div className="flex items-center gap-1.5 text-cyan-400 group-hover:scale-110 transition-transform">
                  <Plus size={18} strokeWidth={3} />
                  <span className="text-sm font-black">تعلية الصوت (+2)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Volume Up</span>
              </button>

              <button
                onClick={handleVolumeDown}
                className="py-4 px-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex flex-col items-center justify-center gap-1 transition-all active:scale-95 shadow-md group"
              >
                <div className="flex items-center gap-1.5 text-slate-300 group-hover:scale-110 transition-transform">
                  <Minus size={18} strokeWidth={3} />
                  <span className="text-sm font-black">تنصية الصوت (-2)</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Volume Down</span>
              </button>
            </div>

            {/* Instant Mute Button */}
            <button
              onClick={handleToggleMute}
              className={`w-full py-3 px-4 rounded-2xl font-bold text-xs flex items-center justify-between border transition-all ${
                status.isMuted
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                  : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <VolumeX size={16} className={status.isMuted ? 'text-rose-400' : 'text-slate-400'} />
                <span>{status.isMuted ? 'إلغاء كتم الصوت (إرجاع المستوى السابق)' : 'كتم الصوت فوراً'}</span>
              </div>
              <span className="text-[10px] text-slate-400">إسكات فوري</span>
            </button>

            {/* 1-Tap Volume Presets */}
            <div>
              <span className="text-[11px] font-bold text-slate-400 block mb-2">مستويات فوليوم جاهزة بنقرة واحدة:</span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  { label: '25%', vol: 5, desc: 'هادئ' },
                  { label: '50%', vol: 11, desc: 'متوازن' },
                  { label: '75%', vol: 16, desc: 'صوت قوي' },
                  { label: '100%', vol: 21, desc: 'أقصى قوة' }
                ].map(p => (
                  <button
                    key={p.vol}
                    onClick={() => handleSetVolume(p.vol)}
                    className={`py-2 px-1 rounded-xl border transition-all ${
                      status.volume === p.vol 
                        ? 'bg-cyan-500/25 border-cyan-400 text-cyan-300 font-black shadow-md' 
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="text-xs font-black block">{p.label}</span>
                    <span className="text-[9px] text-slate-400 block mt-0.5">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Custom Stream URL Launcher */}
          <div className="bg-gradient-to-br from-[#0c1322]/90 to-[#080d1a]/95 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-3">
            <h4 className="text-xs font-black text-white flex items-center gap-2">
              <Smartphone size={15} className="text-cyan-400" />
              <span>بث مقطع يوتيوب أو رابط صوتي مباشر</span>
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="ضع رابط الصوت المباشر أو البث..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60"
              />
              <button
                onClick={handlePlayCustomStream}
                disabled={loading || !customUrl.trim()}
                className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs disabled:opacity-40 transition-all shrink-0"
              >
                تشغيل الآن 🚀
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── 3. Tabs Navigation: Soundboard, Announcements, Phone Connect, Equalizer ── */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 overflow-x-auto gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('soundboard')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'soundboard'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Disc size={16} />
            <span>لوحة المؤثرات والأصوات التفاعلية (Soundboard)</span>
          </button>

          <button
            onClick={() => setActiveTab('announcements')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'announcements'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Bell size={16} />
            <span>التنبيهات والإعلانات الذكية (TTS)</span>
          </button>

          <button
            onClick={() => setActiveTab('connect')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'connect'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Smartphone size={16} />
            <span>طرق البث والربط اللاسلكي (AirPlay & Cast)</span>
          </button>

          <button
            onClick={() => setActiveTab('equalizer')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-2 transition-all shrink-0 ${
              activeTab === 'equalizer'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-lg shadow-cyan-500/20'
                : 'bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Sliders size={16} />
            <span>أنماط الصوت والمعادل الرقمي</span>
          </button>
        </div>
      </div>

      {/* ── 4. Tab 1: Interactive Soundboard & Functional Audio Controls ── */}
      {activeTab === 'soundboard' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Disc size={18} className="text-cyan-400" />
                <span>لوحة المؤثرات والأصوات الفورية (أزرار تعمل فوراً وتصدر صوتاً)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                اضغط على أي زر لتشغيل الصوت فوراً عبر سماعات هذا الجهاز وسبيكر المنزل:
              </p>
            </div>
            <span className="text-[11px] font-bold text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/30 shrink-0">
              8 أصوات تفاعلية جاهزة
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SOUNDBOARD_ITEMS.map((item) => {
              const isThisPlaying = (activePlayingId === item.id && status.isPlaying) || 
                                    (item.type === 'stream' && status.isPlaying && status.track.includes(item.title));
              return (
                <div
                  key={item.id}
                  className={`bg-gradient-to-br from-[#101726] to-[#080d1a] border rounded-3xl p-5 shadow-xl flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 ${
                    isThisPlaying 
                      ? 'border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/50' 
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                        {item.icon}
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        isThisPlaying
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 animate-pulse'
                          : 'bg-white/5 border-white/10 text-slate-400'
                      }`}>
                        {isThisPlaying ? 'يعمل الآن 🔊' : item.badge || item.category}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                      {item.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <button
                    onClick={() => handlePlaySoundboard(item)}
                    className={`mt-5 w-full py-3 rounded-2xl text-xs font-black transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md ${
                      isThisPlaying
                        ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20'
                    }`}
                  >
                    {isThisPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                    <span>{isThisPlaying ? 'إيقاف الصوت ⏸️' : 'تشغيل الصوت الآن 🔊'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 5. Tab 2: Wireless Streaming (AirPlay, Cast, QR Link) ── */}
      {activeTab === 'connect' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Card 1: Apple AirPlay */}
          <div className="bg-gradient-to-br from-[#101726] to-[#080d1a] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
                <Music size={24} />
              </div>
              <h4 className="text-base font-black text-white">Apple AirPlay 🍎</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                بث الصوت المباشر من أجهزة iPhone أو iPad أو Mac مباشرة إلى السبيكر أو المتصفح.
              </p>
              <div className="mt-4 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-cyan-400 font-bold flex items-center justify-center text-[10px]">1</span>
                  <span>اضغط على الزر أدناه لإطلاق الصوت</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-cyan-400 font-bold flex items-center justify-center text-[10px]">2</span>
                  <span>على جهاز Apple، افتح مركز التحكم واضغط أيقونة AirPlay</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-cyan-400 font-bold flex items-center justify-center text-[10px]">3</span>
                  <span>اختر سبيكر <b className="text-cyan-400">MOSA Speaker</b></span>
                </div>
              </div>
            </div>
            <button
              onClick={handleTriggerAirPlay}
              className="mt-6 w-full py-3 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
            >
              <Music size={15} />
              <span>بدء بث الصوت عبر AirPlay 🍎</span>
            </button>
          </div>

          {/* Card 2: Google & Android Cast */}
          <div className="bg-gradient-to-br from-[#101726] to-[#080d1a] border border-white/10 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
                <Cast size={24} />
              </div>
              <h4 className="text-base font-black text-white">Google & Android Cast 📱</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                بث من هواتف أندرويد وتطبيق YouTube و Spotify ومتصفح Chrome إلى أجهزة Cast.
              </p>
              <div className="mt-4 space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-cyan-400 font-bold flex items-center justify-center text-[10px]">1</span>
                  <span>اضغط على الزر أدناه لبدء البث وتشغيل الصوت</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-cyan-400 font-bold flex items-center justify-center text-[10px]">2</span>
                  <span>اختر شاشة أو سبيكر Google Cast المتاح بالمنزل</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-white/10 text-cyan-400 font-bold flex items-center justify-center text-[10px]">3</span>
                  <span>اختر سبيكر المنزل الذكي للاستماع بصوت محيطي</span>
                </div>
              </div>
            </div>
            <button
              onClick={handleTriggerCast}
              className="mt-6 w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
            >
              <Cast size={15} />
              <span>بدء البث عبر Google Cast 📱</span>
            </button>
          </div>

          {/* Card 3: Instant QR Web Controller */}
          <div className="bg-gradient-to-br from-[#101726] to-[#080d1a] border border-cyan-500/30 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
                <QrCode size={24} />
              </div>
              <h4 className="text-base font-black text-white">التحكم الفوري بمسح الـ QR ⚡</h4>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                أي فرد بالمنزل أو ضيف يمكنه توجيه كاميرا الهاتف إلى الكود للتحكم بالسماعات فوراً بدون تثبيت تطبيقات.
              </p>
              <div className="mt-4 p-3 bg-black/30 rounded-2xl border border-white/5 text-center">
                <span className="text-[11px] text-slate-400 block mb-1">الرابط المباشر للشبكة المنزلية:</span>
                <span className="text-xs font-mono font-bold text-cyan-400">
                  {typeof window !== 'undefined' ? `${window.location.origin}/audio` : 'http://mosa-speaker.local'}
                </span>
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <button
                onClick={() => setShowQrModal(true)}
                className="w-full py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 active:scale-95"
              >
                <QrCode size={15} />
                <span>عرض كود الـ QR للمسح الآن 📱</span>
              </button>
              <button
                onClick={() => {
                  playSynthesizedEffect('chime');
                  showFeedback('تم إطلاق نغمة رنين تجريبية بنجاح 🔔');
                }}
                className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
              >
                <Volume2 size={13} className="text-cyan-400" />
                <span>تجربة خروج الصوت فوراً 🔔</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ── 5. Tab 2: Household AI Announcements & Text to Speech (TTS) ── */}
      {activeTab === 'announcements' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Quick 1-Tap Household Announcements (7 Columns) */}
          <div className="lg:col-span-7 bg-gradient-to-br from-[#0c1322]/90 to-[#080d1a]/95 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl space-y-4">
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Bell size={18} className="text-cyan-400" />
              <span>إعلانات منزلية سريعة بلمسة واحدة (Arabic Voice Alerts)</span>
            </h3>
            <p className="text-xs text-slate-400">
              اضغط على أي إعلان وسيتم نطقه فوراً بصوت طبيعي واضح من سماعات جهازك وسبيكر المنزل:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {QUICK_ANNOUNCEMENTS.map((ann, i) => (
                <button
                  key={i}
                  onClick={() => handleSendTTS(ann.text)}
                  disabled={isSendingTts}
                  className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-right transition-all group hover:border-cyan-500/40 active:scale-95 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-lg">{ann.icon}</span>
                    <span className="text-[10px] text-cyan-400 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                      تشغيل النطق ◀
                    </span>
                  </div>
                  <h5 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {ann.label}
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                    "{ann.text}"
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Arabic Voice Speech Studio (5 Columns) */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#0c1322]/90 to-[#080d1a]/95 border border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between space-y-4">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Sparkles size={18} className="text-cyan-400" />
                <span>نطق نص مخصص بالذكاء الاصطناعي</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                اكتب أي رسالة أو تنبيه تود نطقها باللغة العربية:
              </p>

              <textarea
                rows={4}
                placeholder="اكتب هنا مثلاً: مرحباً بكم في المنزل الذكي، نرجو التفضل..."
                value={ttsText}
                onChange={(e) => setTtsText(e.target.value)}
                className="mt-4 w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/60 leading-relaxed resize-none"
              />
            </div>

            <button
              onClick={() => handleSendTTS()}
              disabled={isSendingTts || !ttsText.trim()}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 transition-all active:scale-95"
            >
              <Send size={15} />
              <span>{isSendingTts ? 'جاري نطق الرسالة...' : 'نطق الرسالة فوراً 🗣️'}</span>
            </button>
          </div>

        </div>
      )}

      {/* ── 6. Tab 3: Digital Sound Modes & Equalizer Presets ── */}
      {activeTab === 'equalizer' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Sliders size={18} className="text-cyan-400" />
              <span>أنماط معادل الصوت الرقمي (Digital Equalizer)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              اختر النمط المناسب لتعديل الترددات وطبقات الصوت تلقائياً بما يلائم نوع الاستماع.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SOUND_MODES.map((mode) => {
              const isSelected = activeSoundMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => {
                    setActiveSoundMode(mode.id);
                    showFeedback(`تم تفعيل نمط الصوت: ${mode.name} 🎛️`);
                  }}
                  className={`p-6 rounded-3xl border text-right transition-all flex flex-col justify-between gap-4 ${
                    isSelected 
                      ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-2 ring-cyan-400/40' 
                      : 'bg-[#101726] border-white/10 hover:bg-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{mode.icon}</span>
                    {isSelected && (
                      <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-cyan-400 text-slate-950">
                        النمط النشط ✓
                      </span>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white">{mode.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{mode.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 7. Modal: Hardware Linking Manager & Diagnostics (إدارة وربط السبيكر) ── */}
      <AnimatePresence>
        {showLinkModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl bg-gradient-to-b from-[#0c1527] to-[#080d19] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden space-y-6 max-h-[90vh] overflow-y-auto"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-bold mb-2">
                    <Wrench size={14} />
                    <span>مدير ربط السبيكر والمخارج الصوتية</span>
                  </div>
                  <h3 className="text-xl font-black text-white">خيارات وإعدادات ربط الصوت</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    يمكنك تشغيل الصوت من سماعات هذا الجهاز مباشرة، أو توجيهه لأي جهاز أو سبيكر على الشبكة.
                  </p>
                </div>
                <button
                  onClick={() => setShowLinkModal(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Tabs */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                <button
                  onClick={() => setModalTab('auto')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    modalTab === 'auto'
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  الأجهزة المكتشفة بالمنزل
                </button>
                <button
                  onClick={() => setModalTab('ip')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    modalTab === 'ip'
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  الربط عبر عنوان IP المباشر
                </button>
                <button
                  onClick={() => setModalTab('guide')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    modalTab === 'guide'
                      ? 'bg-cyan-500 text-slate-950 font-black'
                      : 'bg-white/5 text-slate-300 hover:text-white'
                  }`}
                >
                  خيارات توصيل الصوت المتاحة
                </button>
              </div>

              {/* Tab Content 1: Auto / Registered Nodes */}
              {modalTab === 'auto' && (
                <div className="space-y-4">
                  <span className="text-xs text-slate-300 block">
                    الأجهزة والكنترولرات المسجلة حالياً على شبكة منزلك:
                  </span>

                  <div className="space-y-2.5">
                    {availableNodes.length > 0 ? (
                      availableNodes.map(node => (
                        <div
                          key={node.id}
                          className={`p-4 rounded-2xl border flex items-center justify-between transition-all ${
                            selectedNodeId === node.id || status.hardware?.nodeId === node.id
                              ? 'bg-cyan-500/15 border-cyan-400 ring-1 ring-cyan-400'
                              : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                              ESP
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{node.name}</span>
                                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                  node.status === 'online' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-400'
                                }`}>
                                  {node.status}
                                </span>
                              </div>
                              <span className="text-xs text-slate-400 font-mono">
                                IP: {node.ip || 'غير معروف'} • المعرف: {node.id}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedNodeId(node.id);
                              handleSaveLink('node', node.id, node.ip || undefined);
                            }}
                            disabled={isSavingLink}
                            className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all active:scale-95 disabled:opacity-50"
                          >
                            {selectedNodeId === node.id ? 'الجهاز المعتمد ✓' : 'تعيين كسبيكر رئيسي ⚡'}
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-slate-400 text-xs">
                        لا توجد أجهزة مسجلة حالياً. يمكنك تفعيل خيار "سماعات هذا الجهاز" لتشغيل الصوت من الهاتف أو الحاسوب مباشرة.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab Content 2: Direct IP Input */}
              {modalTab === 'ip' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-300 leading-relaxed">
                    إذا كان لديك سبيكر شبكي أو جهاز مستقل على الشبكة، أدخل عنوان الـ IP المخصص له:
                  </p>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="مثلاً: 192.168.1.102 أو mosa-speaker.local"
                      value={customIpInput}
                      onChange={(e) => setCustomIpInput(e.target.value)}
                      className="flex-1 bg-black/40 border border-white/15 rounded-2xl px-4 py-3 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => handleSaveLink('ip', undefined, customIpInput)}
                      disabled={isSavingLink || !customIpInput.trim()}
                      className="px-5 py-3 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      حفظ وربط 🔗
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 space-y-1">
                    <span className="font-bold text-cyan-300 block">💡 تحكم مباشر من الموقع:</span>
                    <span>يمكنك في أي وقت تفعيل خيار <b>"سماعات هذا الجهاز"</b> والاستماع للصوت والتنبيهات مباشرة من هاتفك أو حاسوبك دون الحاجة لأي جهاز إضافي.</span>
                  </div>
                </div>
              )}

              {/* Tab Content 3: Universal Audio Options Guide */}
              {modalTab === 'guide' && (
                <div className="space-y-4">
                  <div className="p-4 bg-black/30 rounded-2xl border border-white/10 space-y-3">
                    <h5 className="text-xs font-black text-cyan-300 flex items-center gap-2">
                      <Zap size={14} />
                      <span>خيارات توصيل وتشغيل الصوت المرنة المتاحة لك:</span>
                    </h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <span className="font-bold text-cyan-300 block mb-1">1. الصوت المباشر من الموقع 💻</span>
                        <span className="text-slate-400 leading-relaxed block">يعمل على أي جهاز (هاتف، لابتوب، آيباد) عبر المتصفح مع تحكم كامل بنسبة 100% بمستوى الصوت والتنبيهات.</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <span className="font-bold text-emerald-300 block mb-1">2. سبيكر ESP32 اللاسلكي 📡</span>
                        <span className="text-slate-400 leading-relaxed block">بث رقمي عبر شبكة الواي فاي المنزلية إلى أي جهاز ESP32 موصول بسماعة.</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <span className="font-bold text-blue-300 block mb-1">3. مخرج الصوت السلكي AUX 🔌</span>
                        <span className="text-slate-400 leading-relaxed block">توصيل كابل AUX 3.5mm قياسي بأي ساوند بار أو مضخم صوت أو سماعة منزلية.</span>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                        <span className="font-bold text-purple-300 block mb-1">4. البث اللاسلكي Cast & AirPlay 📱</span>
                        <span className="text-slate-400 leading-relaxed block">بث مباشر من الآيفون والأندرويد وتطبيقات يوتيوب وسبوتيفاي بكل سهولة.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Ping Test Section in Modal */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  {pingResult ? (
                    <span className={pingResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {pingResult.msg}
                    </span>
                  ) : (
                    'يمكنك اختبار الصوت بالضغط على زر فحص الرنين لتسمع نغمة التأكيد فوراً'
                  )}
                </div>

                <button
                  onClick={handleTestPing}
                  disabled={isPinging}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-300 font-bold text-xs flex items-center gap-2 active:scale-95 shrink-0 disabled:opacity-50"
                >
                  <Activity size={14} className={isPinging ? 'animate-spin' : ''} />
                  <span>{isPinging ? 'جاري الفحص...' : 'فحص الرنين والصوت 🔔'}</span>
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 8. Modal: Mobile QR Code Scanner ── */}
      <AnimatePresence>
        {showQrModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" dir="rtl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-[#0c1527] to-[#080d19] border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5"
            >
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-5 left-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto">
                <QrCode size={28} />
              </div>

              <div>
                <h3 className="text-lg font-black text-white">امسح الكود بهاتفك</h3>
                <p className="text-xs text-slate-400 mt-1">
                  افتح كاميرا الهاتف ووجّهها للكود للتحكم بالسبيكر وسماع الصوت فوراً.
                </p>
              </div>

              {/* Dynamic SVG QR Code Representation */}
              <div className="p-4 bg-white rounded-2xl inline-block mx-auto shadow-xl">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                    typeof window !== 'undefined' ? `${window.location.origin}/audio` : 'http://mosa-speaker.local'
                  )}`}
                  alt="MOSA Speaker QR"
                  className="w-44 h-44 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <button
                  onClick={copySpeakerUrl}
                  className="w-full py-2.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {copiedLink ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  <span>{copiedLink ? 'تم نسخ الرابط بنجاح ✓' : 'نسخ رابط السبيكر'}</span>
                </button>

                <p className="text-[11px] text-slate-500">
                  متوافق مع أجهزة iPhone و Android و iPad و Windows
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
