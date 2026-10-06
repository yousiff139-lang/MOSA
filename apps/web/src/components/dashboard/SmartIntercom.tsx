'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, Volume2, MicOff, AlertCircle, Radio, Bell, 
  Coffee, ShieldAlert, Sparkles, Send, CheckCircle2, ChevronDown
} from 'lucide-react';
import { useSmartHomeStore, fetchAuth } from '@/store/useSmartHomeStore';
import { mosaSound } from '@/lib/mosaVoice';

interface RoomSpeaker {
  id: string;
  name: string;
  hasSpeaker: boolean;
  speakersCount: number;
}

const SMART_CHIMES = [
  { id: 'DOORBELL', label: 'جرس الباب الخارجي', icon: Bell, color: 'from-amber-500 to-orange-600' },
  { id: 'DINNER', label: 'نداء: الغداء / العشاء جاهز', icon: Coffee, color: 'from-emerald-500 to-teal-600' },
  { id: 'EMERGENCY', label: 'تنبيه طوارئ عاجل', icon: ShieldAlert, color: 'from-red-600 to-rose-600' },
  { id: 'PRAYER', label: 'حان الآن وقت الصلاة', icon: Sparkles, color: 'from-cyan-500 to-blue-600' },
];

export function SmartIntercom() {
  const [isRecording, setIsRecording] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<{ id: string; name: string }>({ id: 'ALL', name: 'جميع غرف المنزل (Broadcast)' });
  const [rooms, setRooms] = useState<RoomSpeaker[]>([]);
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);
  const [customText, setCustomText] = useState('');
  const [isSending, setIsSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const socket = useSmartHomeStore(state => state.socket);

  useEffect(() => {
    loadRooms();

    if (socket) {
      socket.on('intercom:receive', (data: any) => {
        mosaSound.playListeningChime();
        setBroadcastStatus(`نداء وارد من (${data.from}) إلى (${data.targetRoomName}): "${data.text}"`);
        setTimeout(() => setBroadcastStatus(null), 7000);
      });

      socket.on('intercom:chime', (data: any) => {
        mosaSound.playSuccessChime();
        setBroadcastStatus(`تنبيه رنين: ${data.title}`);
        setTimeout(() => setBroadcastStatus(null), 5000);
      });
    }

    return () => {
      if (socket) {
        socket.off('intercom:receive');
        socket.off('intercom:chime');
      }
    };
  }, [socket]);

  const loadRooms = async () => {
    try {
      const res = await fetchAuth('/api/audio/rooms');
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) setRooms(json.data);
      }
    } catch {}
  };

  const handleTriggerChime = async (chimeType: string) => {
    mosaSound.playSuccessChime();
    try {
      await fetchAuth('/api/audio/intercom/chime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chimeType,
          targetRoomId: selectedTarget.id
        })
      });
    } catch {}
  };

  const handleSendTextBroadcast = async () => {
    if (!customText.trim()) return;
    setIsSending(true);
    try {
      await fetchAuth('/api/audio/intercom/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: customText,
          targetRoomId: selectedTarget.id,
          targetRoomName: selectedTarget.name
        })
      });
      setCustomText('');
      setBroadcastStatus('تم إرسال النداء بنجاح! 📢');
      setTimeout(() => setBroadcastStatus(null), 4000);
    } catch {} finally {
      setIsSending(false);
    }
  };

  const startVoiceRecording = async () => {
    mosaSound.playListeningChime();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          await fetchAuth('/api/audio/intercom/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: 'رسالة صوتية مباشرة عبر الإنتركم 🎙️',
              targetRoomId: selectedTarget.id,
              targetRoomName: selectedTarget.name,
              audioBase64: base64Audio
            })
          });
        };
        stream.getTracks().forEach(t => t.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('يرجى السماح بالوصول للميكروفون للبث الصوتي.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mosaSound.playSuccessChime();
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-2xl space-y-6 font-sans text-right" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">نظام الإنتركم والبث المنزلي المباشر</h3>
            <p className="text-xs text-slate-400">تحدث مع أي غرفة في المنزل أو أرسل نداءً صوتياً فورياً</p>
          </div>
        </div>

        {/* Room Target Selector */}
        <div className="relative">
          <select
            value={selectedTarget.id}
            onChange={(e) => {
              const targetId = e.target.value;
              if (targetId === 'ALL') {
                setSelectedTarget({ id: 'ALL', name: 'جميع غرف المنزل (Broadcast)' });
              } else {
                const room = rooms.find(r => r.id === targetId);
                setSelectedTarget({ id: targetId, name: room?.name || 'الغرفة المحددة' });
              }
            }}
            className="bg-slate-950 border border-slate-700 text-cyan-300 font-bold text-xs rounded-2xl px-4 py-2.5 focus:outline-none focus:border-cyan-500 cursor-pointer"
          >
            <option value="ALL">📢 جميع غرف المنزل (Broadcast)</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>
                🔊 {r.name} {r.hasSpeaker ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Broadcast Alert Banner */}
      <AnimatePresence>
        {broadcastStatus && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-gradient-to-r from-cyan-950/40 to-indigo-950/40 border border-cyan-500/30 rounded-2xl text-cyan-200 text-xs font-bold flex items-center gap-2 shadow-lg"
          >
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>{broadcastStatus}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Smart Chimes */}
      <div>
        <div className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          تنبيهات ورنين الإنتركم الفوري
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {SMART_CHIMES.map((chime) => {
            const Icon = chime.icon;
            return (
              <button
                key={chime.id}
                onClick={() => handleTriggerChime(chime.id)}
                className="p-3 bg-slate-950/60 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-2xl transition-all text-right flex flex-col justify-between group shadow-md"
              >
                <div className={`w-8 h-8 rounded-xl bg-gradient-to-tr ${chime.color} flex items-center justify-center text-white mb-2 shadow-md group-hover:scale-105 transition-transform`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="font-bold text-xs text-white leading-tight">{chime.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Push-to-Talk (PTT) Button & Live Visualizer */}
      <div className="p-6 bg-slate-950/60 border border-slate-800/80 rounded-3xl flex flex-col items-center justify-center text-center space-y-4">
        <div className="text-xs text-slate-400">
          الهدف الحالي للبث: <span className="font-bold text-cyan-400">{selectedTarget.name}</span>
        </div>

        <button
          onMouseDown={startVoiceRecording}
          onMouseUp={stopVoiceRecording}
          onTouchStart={startVoiceRecording}
          onTouchEnd={stopVoiceRecording}
          className={`w-24 h-24 rounded-full flex flex-col items-center justify-center text-white shadow-2xl transition-all cursor-pointer select-none ${
            isRecording
              ? 'bg-red-600 shadow-[0_0_50px_rgba(239,68,68,0.7)] scale-110 animate-pulse'
              : 'bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 hover:scale-105 shadow-cyan-500/20'
          }`}
        >
          {isRecording ? <Radio className="w-8 h-8 text-white animate-bounce" /> : <Mic className="w-8 h-8 text-white" />}
          <span className="text-[10px] font-black mt-1">
            {isRecording ? 'أنت تبث الآن' : 'اضغط للتحدث'}
          </span>
        </button>

        <p className="text-[11px] text-slate-500">
          {isRecording ? 'اترك الزر لإنهاء البث وإرساله فورياً' : 'اضغط مع الاستمرار للتحدث عبر سبيكرات الغرفة المحددة (Push-To-Talk)'}
        </p>
      </div>

      {/* Quick Text Broadcast Bar */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendTextBroadcast()}
          placeholder={`اكتب رسالة لبثها إلى (${selectedTarget.name})...`}
          className="flex-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          onClick={handleSendTextBroadcast}
          disabled={!customText.trim() || isSending}
          className="px-5 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-2xl shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
          <span>بث</span>
        </button>
      </div>
    </div>
  );
}
