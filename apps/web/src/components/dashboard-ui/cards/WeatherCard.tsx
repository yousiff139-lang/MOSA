"use client";

import { motion } from 'framer-motion';
import { CloudRain, Wind } from 'lucide-react';
import { useState, useEffect } from 'react';

export function WeatherCard() {
  const [weather, setWeather] = useState<any>(null);

  useEffect(() => {
    fetch('/api/weather', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(data => setWeather(data))
      .catch(console.error);
  }, []);

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-[2.5rem] p-6 h-[220px] shadow-2xl transition-all duration-500 bg-gradient-to-br from-indigo-500/80 to-purple-600/80 backdrop-blur-xl text-white col-span-2"
    >
      <div className="flex justify-between items-start h-full">
        <div className="flex flex-col justify-between h-full">
          <div>
            <h3 className="font-bold text-2xl">{weather ? weather.city : 'جاري التحميل...'}</h3>
            <p className="text-white/70">{weather ? weather.description : ''}</p>
          </div>
          {weather && (
            <div className="flex items-center gap-4 text-sm font-semibold bg-black/20 w-fit px-4 py-2 rounded-xl border border-white/10">
              <span className="flex items-center gap-1"><CloudRain size={16}/> {weather.precipitation}%</span>
              <span className="flex items-center gap-1"><Wind size={16}/> {weather.wind_speed} km/h</span>
            </div>
          )}
        </div>

        <div className="text-right">
          <div className="text-6xl font-black mb-2">{weather ? Math.round(weather.temperature) : '--'}°</div>
          <div className="text-sm opacity-80">جودة الهواء: <span className="text-emerald-300 font-bold">ممتازة</span></div>
        </div>
      </div>

      {/* Clouds / Rain decorative elements can be added here using standard divs */}
      <div className="absolute top-[-20px] left-[-20px] w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
    </motion.div>
  );
}
