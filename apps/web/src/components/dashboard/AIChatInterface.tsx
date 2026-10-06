'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Mic } from 'lucide-react';
import { AnimatedButton } from '@/components/ui/AnimatedButton';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
}

export function AIChatInterface() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', sender: 'ai', text: 'أهلاً بك! أنا مساعدك الذكي المحلي. أوامري لا تخرج للإنترنت. كيف يمكنني المساعدة؟' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('token') || document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
      
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: userMsg.text })
      });

      const data = await res.json();
      
      let replyText = 'حدث خطأ في الخادم المحلي.';
      if (data.reply_arabic) {
        replyText = data.reply_arabic;
      } else if (data.action === 'toggle') {
        replyText = `تم تنفيذ الأمر بنجاح (تشغيل/إطفاء الجهاز).`;
      } else if (data.text) {
        replyText = data.text;
      }

      const aiMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        sender: 'ai', 
        text: replyText
      };
      
      setMessages(prev => [...prev, aiMsg]);

    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: 'فشل الاتصال بالذكاء الاصطناعي المحلي (Local LLM Edge).' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button - Desktop only, mobile uses BottomNav */}
      <button 
        onClick={() => setIsOpen(true)}
        className="hidden md:flex fixed bottom-44 left-6 z-40 w-14 h-14 bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 rounded-full items-center justify-center shadow-[0_0_25px_rgba(6,182,212,0.6)] hover:scale-110 transition-all border border-cyan-400/40 cursor-pointer"
        title="مساعد الذكاء الاصطناعي المحلي (Edge AI)"
      >
        <Bot className="text-white w-7 h-7" />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-60 left-6 z-50 w-[350px] h-[500px] bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/40 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-slide-up">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900/50 to-indigo-900/50 p-4 border-b border-white/10 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/20 rounded-full flex items-center justify-center relative">
                 <Bot className="text-indigo-400 w-5 h-5" />
                 <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full" />
              </div>
              <div>
                <h3 className="text-white font-bold text-sm">مساعد الذكاء الاصطناعي</h3>
                <p className="text-indigo-300 text-xs">Offline Local Edge</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">✕</button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto flex flex-col gap-4">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.sender === 'user' 
                    ? 'bg-indigo-600 text-white rounded-bl-none' 
                    : 'bg-white/10 text-gray-200 border border-white/5 rounded-br-none'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 border border-white/5 p-3 rounded-2xl rounded-br-none flex gap-1">
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-black/40 flex items-center gap-2">
            <button className="p-2 text-gray-400 hover:text-indigo-400 transition-colors">
               <Mic size={20} />
            </button>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="اطلب تشغيل التكييف..."
              className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-indigo-600 rounded-full text-white disabled:opacity-50 hover:bg-indigo-500 transition-colors"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
