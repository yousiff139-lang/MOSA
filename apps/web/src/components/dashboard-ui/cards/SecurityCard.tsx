"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, ShieldCheck, Lock } from 'lucide-react';
import { useSmartHome } from '@/hooks/useSmartHome';
import { useTranslation } from '@/hooks/useTranslation';

export function SecurityCard() {
  const { sendCommand } = useSmartHome();
  const { t } = useTranslation();
  const [isArmed, setIsArmed] = useState(false);
  const [pinMode, setPinMode] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const correctPin = '1234';

  const handleKeypad = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
    }
  };

  const submitPin = async () => {
    if (pin === correctPin) {
      const newState = !isArmed;
      setIsArmed(newState);
      setPinMode(false);
      setPin('');
      
      try {
        await fetch('/api/command/security/arm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ state: newState ? 'ARMED' : 'DISARMED' })
        });
      } catch (err) {
        console.error(err);
      }
      
    } else {
      setError(true);
      setTimeout(() => {
        setError(false);
        setPin('');
      }, 1000);
    }
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className={`relative overflow-hidden rounded-[2.5rem] p-6 h-full min-h-[300px] flex flex-col justify-between shadow-2xl transition-all duration-500 ${
        isArmed 
          ? 'bg-gradient-to-br from-red-600/80 to-rose-900/80 shadow-[0_0_30px_rgba(220,38,38,0.5)]' 
          : 'bg-white/5 border border-white/10'
      } backdrop-blur-xl`}
    >
      {isArmed && (
        <div className="absolute inset-0 bg-red-500/20 animate-pulse pointer-events-none"></div>
      )}
      <div className="flex justify-between items-start z-10">
        <div>
          <h3 className="text-white font-bold text-xl">{t('security.title')}</h3>
          <p className="text-white/60 text-sm">{isArmed ? t('security.status.armed') : t('security.status.disarmed')}</p>
        </div>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isArmed ? 'bg-white text-red-600' : 'bg-white/10 text-white'}`}>
          {isArmed ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!pinMode ? (
          <motion.div 
            key="status"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex items-center justify-center z-10"
          >
            <button
              onClick={() => setPinMode(true)}
              className={`px-8 py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                isArmed 
                  ? 'bg-white text-red-600 hover:bg-red-50' 
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              {isArmed ? t('device.off') : t('security.arm.home')}
            </button>
          </motion.div>
        ) : (
          <motion.div 
            key="keypad"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center z-10 space-y-4 pt-4"
          >
            <div className={`text-2xl tracking-[0.5em] font-mono h-8 ${error ? 'text-red-400 animate-pulse' : 'text-white'}`}>
              {pin.padEnd(4, '•')}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                <button 
                  key={num}
                  onClick={() => handleKeypad(num.toString())}
                  className="w-12 h-12 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
                >
                  {num}
                </button>
              ))}
              <button 
                onClick={() => { setPinMode(false); setPin(''); }}
                className="w-12 h-12 rounded-full bg-white/5 text-white/50 font-bold hover:bg-white/10 transition-colors text-sm"
              >
                إلغاء
              </button>
              <button 
                onClick={() => handleKeypad('0')}
                className="w-12 h-12 rounded-full bg-white/10 text-white font-bold hover:bg-white/20 transition-colors"
              >
                0
              </button>
              <button 
                onClick={submitPin}
                className="w-12 h-12 rounded-full bg-blue-500 text-white font-bold hover:bg-blue-600 transition-colors"
              >
                <Lock size={16} className="mx-auto" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
