'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, X, Sparkles, Check, AlertCircle } from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { speakMosaVoice, mosaSound } from '@/lib/mosaVoice';

interface VoiceAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function VoiceAssistantModal({ isOpen, onClose }: VoiceAssistantModalProps) {
  const lang = useRuntimeStore(s => s.lang);
  const isEn = lang === 'en';
  const devices = useSmartHomeStore(s => s.devices);
  const toggleDevice = useSmartHomeStore(s => s.toggleDevice);

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [statusState, setStatusState] = useState<'idle' | 'listening' | 'processing' | 'success' | 'error'>('idle');

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = isEn ? 'en-US' : 'ar-SA';

      rec.onstart = () => {
        setIsListening(true);
        setStatusState('listening');
        setTranscript('');
        setFeedback(isEn ? 'Listening for your voice command...' : 'جاري الاستماع لأمرك الصوتي...');
        mosaSound.playListeningChime();
      };

      rec.onresult = (event: any) => {
        const text = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join('');
        setTranscript(text);
        parseAndExecuteVoiceCommand(text);
      };

      rec.onerror = (event: any) => {
        console.error('Voice Recognition Error:', event.error);
        setIsListening(false);
        setStatusState('error');
        setFeedback(isEn ? 'Microphone error or permission denied.' : 'حدث خطأ في الميكروفون أو الصلاحيات.');
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, [isEn]);

  // Execute processing through unified backend AI NLP engine
  const parseAndExecuteVoiceCommand = async (text: string) => {
    if (!text.trim()) return;
    setStatusState('processing');
    setFeedback(isEn ? 'Processing command...' : 'جاري معالجة الأمر وتنفيذه...');

    try {
      const res = await fetchAuth('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });

      const data = await res.json();
      if (res.ok && data.reply_arabic) {
        setStatusState('success');
        setFeedback(data.reply_arabic);
        speakMosaVoice(data.reply_arabic);
        useSmartHomeStore.getState().initBackendConnection();
      } else {
        setStatusState('error');
        const errText = data.error || (isEn ? 'Could not execute command.' : 'تعذر تنفيذ الأمر الصوتي.');
        setFeedback(errText);
        speakMosaVoice(errText);
      }
    } catch (e) {
      setStatusState('error');
      const errText = isEn ? 'Connection error to AI engine.' : 'خطأ في الاتصال بمحرك الذكاء الاصطناعي.';
      setFeedback(errText);
      speakMosaVoice(errText);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
      if (transcript) parseAndExecuteVoiceCommand(transcript);
    } else {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch (e) {}
      }
    }
  };

  if (!isOpen) return null;

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-lg flex items-center justify-center p-4" dir="rtl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[#0b1329] border border-cyan-500/30 rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full shadow-[0_0_50px_rgba(6,182,212,0.2)] text-center space-y-6 relative overflow-hidden"
        dir={isEn ? 'ltr' : 'rtl'}
      >
        {/* Background Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-cyan-400" size={22} />
            <h3 className="text-lg sm:text-xl font-bold text-white">
              {isEn ? 'MOSA Local Voice Assistant' : 'المساعد الصوتي الذكي (MOSA AI)'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 cursor-pointer">
            <X size={24} />
          </button>
        </div>

        {/* Animated Mic Sphere */}
        <div className="flex flex-col items-center justify-center py-4">
          <button
            onClick={toggleListening}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl relative cursor-pointer ${
              isListening
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-[0_0_50px_rgba(6,182,212,0.6)] animate-pulse'
                : statusState === 'success'
                  ? 'bg-emerald-500 text-white shadow-[0_0_30px_rgba(16,185,129,0.5)]'
                  : statusState === 'error'
                    ? 'bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.5)]'
                    : 'bg-slate-800 text-cyan-400 border border-cyan-500/30 hover:border-cyan-400'
            }`}
          >
            {isListening ? (
              <Mic size={44} className="animate-bounce" />
            ) : statusState === 'success' ? (
              <Check size={44} />
            ) : statusState === 'error' ? (
              <AlertCircle size={44} />
            ) : (
              <Mic size={44} />
            )}
          </button>

          <span className="text-xs text-slate-300 mt-4 font-bold">
            {isListening 
              ? (isEn ? 'Tap to finish & execute' : 'انقر عند الانتهاء للتنفيذ') 
              : (isEn ? 'Tap mic to start speaking' : 'اضغط على الميكروفون للتحدث بأمرك')
            }
          </span>
        </div>

        {/* Live Speech Recognition Transcript */}
        {transcript && (
          <div className="bg-black/40 border border-cyan-500/20 p-4 rounded-2xl text-cyan-300 font-mono text-xs sm:text-sm shadow-inner">
            "{transcript}"
          </div>
        )}

        {/* Feedback message */}
        {feedback && (
          <div className={`p-3.5 rounded-xl font-bold text-xs leading-relaxed ${
            statusState === 'success'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : statusState === 'error'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
          }`}>
            {feedback}
          </div>
        )}

        {/* Command Examples Footer */}
        <div className="bg-white/[0.02] border border-white/5 p-3 sm:p-4 rounded-2xl text-right text-xs text-slate-400 space-y-1" dir="rtl">
          <p className="font-bold text-white text-[11px] mb-1">🗣️ أمثلة للأوامر المدعومة:</p>
          <p>• "شغّل إضاءة المطبخ"</p>
          <p>• "طفي كل أجهزة الصالة"</p>
          <p>• "تفعيل وضع النوم"</p>
          <p>• "ما هي الأجهزة الشغالة حالياً؟"</p>
        </div>

      </motion.div>
    </div>,
    document.body
  );
}
