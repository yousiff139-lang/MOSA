'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Volume2 } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export default function IntercomWidget() {
  const socket = useSmartHomeStore(s => s.socket);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (!socket) return;
    // Listen for incoming intercom broadcasts
    socket.on('intercom:receive', (data: { audioBlob: ArrayBuffer, from: string }) => {
      const blob = new Blob([data.audioBlob], { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().catch(console.error);
    });

    return () => {
      socket.off('intercom:receive');
    };
  }, [socket]);

  const startRecording = async () => {
    if (!socket) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        // Send the blob via Socket.io
        socket.emit('intercom:broadcast', { audioBlob });
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording && socket) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        className={`w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all ${
          isRecording 
            ? 'bg-red-500 animate-pulse scale-110 shadow-red-500/50' 
            : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-500/30 hover:scale-105'
        }`}
      >
        {isRecording ? <Square className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
      </button>
      
      {/* Tooltip */}
      <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-xs text-white px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-slate-700">
        اضغط وتحدث (Intercom)
      </div>
    </div>
  );
}
