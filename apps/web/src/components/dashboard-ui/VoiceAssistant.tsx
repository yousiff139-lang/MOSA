"use client";

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Mic, MicOff, X, Sparkles, Volume2, Radio, Play, Pause, Square, Zap, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { speakMosaVoice, mosaSound } from '@/lib/mosaVoice';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';

export default function VoiceAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [replyText, setReplyText] = useState('أهلاً بك! قل "يا موسى" أو تحدث بأمرك مباشرة...');
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
  const [audioStreamUrl, setAudioStreamUrl] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState<string>('');
  const [isPlayingStream, setIsPlayingStream] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const followUpTimerRef = useRef<any>(null);

  // Initialize Web Speech Recognition
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'ar-SA';

    rec.onstart = () => {
      setIsListening(true);
      setStatus('listening');
      mosaSound.playListeningChime();
    };

    rec.onresult = (event: any) => {
      const current = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('');
      setTranscript(current);

      // If final result
      if (event.results[0].isFinal) {
        processVoiceCommand(current);
      }
    };

    rec.onerror = (e: any) => {
      console.warn('[Voice Assistant] Error:', e.error);
      setIsListening(false);
      setStatus('idle');
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;
  }, []);

  const startListening = () => {
    if (audioRef.current && isPlayingStream) {
      audioRef.current.pause();
      setIsPlayingStream(false);
    }

    if (recognitionRef.current) {
      try {
        setTranscript('');
        setReplyText('أنا أستمع إليك الآن... 🎙️');
        recognitionRef.current.start();
        setIsOpen(true);
      } catch (e) {
        recognitionRef.current.stop();
        setTimeout(() => {
          try { recognitionRef.current.start(); } catch {}
        }, 200);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setStatus('idle');
  };

  const processVoiceCommand = async (text: string) => {
    if (!text.trim()) return;
    setStatus('processing');
    setReplyText('جاري معالجة الأمر والتحكم الفوري بالأجهزة...');

    try {
      const res = await fetchAuth('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();
      const spokenReply = data.reply_arabic || data.data?.reply || 'تم تنفيذ طلبك بنجاح.';
      setReplyText(spokenReply);
      setStatus('speaking');

      // Check if media playback is requested (Quran / Radio)
      if (data.data?.isMedia && data.data?.streamUrl) {
        setAudioStreamUrl(data.data.streamUrl);
        setStreamTitle(data.data.streamTitle || 'بث مباشر');
        setIsPlayingStream(true);
        if (audioRef.current) {
          audioRef.current.src = data.data.streamUrl;
          audioRef.current.play().catch(() => {});
        }
      }

      // Speak response with high-fidelity Arabic voice
      speakMosaVoice(spokenReply, () => {
        setStatus('idle');
        useSmartHomeStore.getState().initBackendConnection();

        // Alexa-Style Follow-Up Mode: Keep listening for 4 seconds for chaining commands!
        clearTimeout(followUpTimerRef.current);
        followUpTimerRef.current = setTimeout(() => {
          // Finished turn
        }, 4000);
      });

    } catch (err) {
      const errText = 'عذراً، حدث خطأ في الاتصال بالدماغ الاصطناعي.';
      setReplyText(errText);
      setStatus('idle');
      speakMosaVoice(errText);
    }
  };

  const toggleStreamPlayback = () => {
    if (!audioRef.current) return;
    if (isPlayingStream) {
      audioRef.current.pause();
      setIsPlayingStream(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlayingStream(true);
    }
  };

  if (pathname?.startsWith('/auth') || pathname?.startsWith('/setup')) {
    return null;
  }

  return (
    <>
      {/* Hidden Audio Stream Element */}
      <audio ref={audioRef} />

      {/* Floating Alexa-Style Glowing Orb Button */}
      <motion.button 
        onClick={isListening ? stopListening : startListening}
        aria-label="المساعد الصوتي الذكي MOSA"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={`fixed bottom-28 left-6 w-16 h-16 rounded-full flex items-center justify-center text-white z-40 transition-all border cursor-pointer ${
          isListening
            ? 'bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 shadow-[0_0_50px_rgba(6,182,212,0.8)] border-cyan-300 animate-pulse'
            : isPlayingStream
            ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-[0_0_35px_rgba(16,185,129,0.7)] border-emerald-400'
            : 'bg-gradient-to-tr from-cyan-600 via-indigo-600 to-blue-700 shadow-[0_0_30px_rgba(59,130,246,0.6)] border-cyan-400/40'
        }`}
        title="تحدث مع مساعد MOSA الصوتي (Alexa Mode)"
      >
        {isListening ? (
          <div className="relative flex items-center justify-center">
            <span className="absolute w-12 h-12 rounded-full border-2 border-cyan-200 animate-ping opacity-75" />
            <Mic size={26} className="text-white" />
          </div>
        ) : isPlayingStream ? (
          <Radio size={26} className="text-white animate-bounce" />
        ) : (
          <Mic size={26} className="text-white" />
        )}
      </motion.button>

      {/* Interactive Voice Orb Modal & HUD */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 60, scale: 0.9 }}
            className="fixed bottom-48 left-6 w-96 bg-slate-950/95 backdrop-blur-3xl border border-cyan-500/40 rounded-[2.5rem] p-6 shadow-[0_25px_60px_rgba(0,0,0,0.9)] z-50 overflow-hidden text-right font-sans"
            dir="rtl"
          >
            {/* Background Hologram Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex justify-between items-center border-b border-white/10 pb-3 relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-black">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Roro Voice AI (رورو)</h4>
                  <span className="text-[10px] text-pink-300 font-bold block">مساعد صوتي ذكي وفوري</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Glowing Alexa-Style Audio Wave Animation */}
            <div className="py-6 flex flex-col items-center justify-center relative">
              <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-500 ${
                isListening
                  ? 'bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 shadow-[0_0_50px_rgba(6,182,212,0.9)] scale-110 animate-pulse'
                  : status === 'speaking'
                  ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-[0_0_40px_rgba(16,185,129,0.8)]'
                  : 'bg-slate-900 border border-cyan-500/30 shadow-inner'
              }`}>
                {isListening ? (
                  <Mic size={36} className="text-white animate-bounce" />
                ) : status === 'speaking' ? (
                  <Volume2 size={36} className="text-white" />
                ) : (
                  <Sparkles size={36} className="text-cyan-400" />
                )}
              </div>

              {/* Realtime Audio Equalizer Bars */}
              {isListening && (
                <div className="flex items-center gap-1.5 mt-4 h-8">
                  {[20, 36, 16, 40, 24, 32, 18, 38].map((h, i) => (
                    <motion.div
                      key={i}
                      animate={{ height: [10, h, 12] }}
                      transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.08 }}
                      className="w-1.5 bg-gradient-to-t from-cyan-400 to-blue-500 rounded-full"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Transcript & Spoken Reply */}
            <div className="space-y-2 relative z-10 text-xs">
              {transcript && (
                <div className="p-2.5 bg-blue-950/40 border border-blue-500/30 rounded-2xl text-blue-200">
                  <span className="text-[10px] text-blue-400 font-bold block mb-0.5">ما قلته:</span>
                  <p className="font-bold">{transcript}</p>
                </div>
              )}

              <div className="p-3 bg-black/50 border border-white/10 rounded-2xl text-slate-200 leading-relaxed min-h-[50px]">
                <span className="text-[10px] text-cyan-400 font-bold block mb-0.5">رد MOSA:</span>
                <p className="text-white font-medium">{replyText}</p>
              </div>
            </div>

            {/* Media Audio Player Bar (If Radio / Quran playing) */}
            {audioStreamUrl && (
              <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <Radio size={18} className="text-emerald-400 shrink-0 animate-pulse" />
                  <span className="text-xs text-emerald-300 font-bold truncate">{streamTitle}</span>
                </div>
                <button
                  onClick={toggleStreamPlayback}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 transition"
                >
                  {isPlayingStream ? <Pause size={14} /> : <Play size={14} />}
                </button>
              </div>
            )}

            {/* Quick Actions Footer */}
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
              <button
                onClick={isListening ? stopListening : startListening}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/20'
                }`}
              >
                {isListening ? <MicOff size={14} /> : <Mic size={14} />}
                <span>{isListening ? 'إيقاف الاستماع' : 'تحدث بأمر جديد'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
