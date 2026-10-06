// @ts-nocheck
"use client";
/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Device } from '@/types';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

interface VoiceControlProps {
  devices: Device[];
  onToggle: (id: number, boardId: string) => void;
  onTurnOffAll: () => void;
}

export function VoiceControl({ devices, onToggle, onTurnOffAll }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // @ts-ignore - SpeechRecognition is not fully typed in standard TS yet
  const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
  
  const toggleListening = () => setIsListening(prev => !prev);
  
  const processCommand = useCallback((cmd: string) => {
    setTranscript(cmd);
    const lowerCmd = cmd.toLowerCase();
    
    // Arabic Scene Triggers
    if (lowerCmd.includes('وضع النوم') || lowerCmd.includes('نوم')) {
      useSmartHomeStore.getState().executeScene(1);
      setTranscript('تم تفعيل وضع النوم');
      return;
    }
    if (lowerCmd.includes('وضع السينما') || lowerCmd.includes('سينما')) {
      useSmartHomeStore.getState().executeScene(2);
      setTranscript('تم تفعيل وضع السينما');
      return;
    }

    // Device specific toggle
    devices.forEach(d => {
      const roomName = typeof d.room === 'object' && d.room ? (d.room.name || '') : (d.room || '');
      // Check if command contains device name or room name
      if (lowerCmd.includes(d.name.toLowerCase()) || lowerCmd.includes(roomName.toLowerCase())) {
        
        // Turn ON keywords
        if (
          lowerCmd.includes('شغل') || 
          lowerCmd.includes('افتح') || 
          lowerCmd.includes('نور') ||
          lowerCmd.includes('turn on') ||
          lowerCmd.includes('switch on') ||
          lowerCmd.includes('start')
        ) {
          if (d.state === 'OFF' && d.boardId) onToggle(d.id, d.boardId);
        } 
        // Turn OFF keywords
        else if (
          lowerCmd.includes('طفي') || 
          lowerCmd.includes('اطفئ') || 
          lowerCmd.includes('اغلق') || 
          lowerCmd.includes('سكر') ||
          lowerCmd.includes('turn off') ||
          lowerCmd.includes('switch off') ||
          lowerCmd.includes('stop')
        ) {
          if (d.state === 'ON' && d.boardId) onToggle(d.id, d.boardId);
        }
      }
    });

    setTimeout(() => setTranscript(''), 3000);
  }, [devices, onToggle, onTurnOffAll]);

  const { lang } = useRuntimeStore();

  useEffect(() => {
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang === 'ar' ? 'ar-SA' : 'en-US';

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const t = event.results[current][0].transcript;
      processCommand(t);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        setIsListening(false);
      }
    } else {
      recognition.stop();
    }

    return () => {
      recognition.stop();
    };
  }, [isListening, SpeechRecognition, processCommand]);

  if (!SpeechRecognition) {
    return null; // Browser doesn't support speech recognition
  }

  return (
    <div className="hidden md:flex fixed bottom-8 left-8 z-50 flex-col items-center gap-3">
      {transcript && (
        <div className="bg-gray-900 text-white text-xs py-2 px-4 rounded-xl shadow-lg animate-fade-up max-w-[200px] text-center">
          "{transcript}"
        </div>
      )}
      <button
        onClick={toggleListening}
        aria-label="التحكم الصوتي"
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all backdrop-blur-md border ${isListening ? 'bg-red-500 text-white animate-pulse border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white/20 dark:bg-black/20 text-gray-800 dark:text-gray-200 border-white/30 hover:border-primary/50 hover:text-primary'}`}
      >
        <Mic size={24} className={isListening ? "animate-pulse" : "opacity-60"} />
      </button>
    </div>
  );
}
