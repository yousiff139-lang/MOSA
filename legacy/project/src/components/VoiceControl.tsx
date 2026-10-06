import { useState, useEffect, useCallback } from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Device } from '../types';

interface VoiceControlProps {
  devices: Device[];
  onToggle: (id: number, boardId: string) => void;
  onTurnOffAll: () => void;
}

export function VoiceControl({ devices, onToggle, onTurnOffAll }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  
  // @ts-ignore - SpeechRecognition is not fully typed in standard TS yet
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  const processCommand = useCallback((cmd: string) => {
    setTranscript(cmd);
    const lowerCmd = cmd.toLowerCase();
    
    if (lowerCmd.includes('اطفئ الكل') || lowerCmd.includes('طفي كل شيء') || lowerCmd.includes('طفي البيت')) {
      onTurnOffAll();
      return;
    }

    devices.forEach(d => {
      // Very basic Arabic keyword matching for demo purposes
      if (lowerCmd.includes(d.name.toLowerCase()) || lowerCmd.includes(d.room.toLowerCase())) {
        if (lowerCmd.includes('شغل') || lowerCmd.includes('افتح') || lowerCmd.includes('نور')) {
          if (d.state === 'OFF' && d.boardId) onToggle(d.id, d.boardId);
        } else if (lowerCmd.includes('طفي') || lowerCmd.includes('اطفئ') || lowerCmd.includes('اغلق') || lowerCmd.includes('سكر')) {
          if (d.state === 'ON' && d.boardId) onToggle(d.id, d.boardId);
        }
      }
    });

    setTimeout(() => setTranscript(''), 3000);
  }, [devices, onToggle, onTurnOffAll]);

  useEffect(() => {
    if (!SpeechRecognition) return;
    
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'ar-SA';

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
    <div className="fixed bottom-8 left-8 z-50 flex flex-col items-center gap-3">
      {transcript && (
        <div className="bg-gray-900 text-white text-xs py-2 px-4 rounded-xl shadow-lg animate-fade-up max-w-[200px] text-center">
          "{transcript}"
        </div>
      )}
      <button
        onClick={() => setIsListening(!isListening)}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all backdrop-blur-md border ${isListening ? 'bg-red-500 text-white animate-pulse border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-white/20 dark:bg-black/20 text-gray-800 dark:text-gray-200 border-white/30 hover:border-primary/50 hover:text-primary'}`}
      >
        {isListening ? <Mic size={24} /> : <MicOff size={24} />}
      </button>
    </div>
  );
}
