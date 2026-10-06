"use client";

import { useTranslation } from '@/hooks/useTranslation';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { MoreVertical } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export function EnergySidebar() {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const socket = useSmartHomeStore(state => state.socket);
  const globalData = useSmartHomeStore(state => state.globalData);
  
  const [realTimeData, setRealTimeData] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [currentPower, setCurrentPower] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    
    // Fetch initial data
    fetch('/api/energy/daily', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(json => {
        const formatted = json.map((item: any) => ({
          time: item.time, today: item.power, avg: item.power * 0.85
        }));
        setRealTimeData(formatted);
      }).catch(console.error);

    fetch('/api/energy/summary', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => res.json())
      .then(json => {
        if (json.categories) {
          setDailyData([
            { name: 'lighting', value: json.categories.Lighting || 0 },
            { name: 'HVAC', value: json.categories.HVAC || 0 },
            { name: 'Appliances', value: json.categories.Appliances || 0 }
          ]);
        }
      }).catch(console.error);
  }, []);

  useEffect(() => {
    if (globalData?.currentPower) {
      setCurrentPower(globalData.currentPower);
    }
  }, [globalData?.currentPower]);

  // Determine optimal/moderate/high based on current usage
  const powerKw = currentPower / 1000;
  let gaugeColor = '#00f0ff'; // Green/Cyan
  let gaugeStatus = 'Optimal range';
  let rotateDegree = Math.min(Math.max((powerKw / 8) * 180, 0), 180) - 90; // Map 0-8kW to -90 to +90 degrees

  if (powerKw > 2 && powerKw <= 4) {
    gaugeColor = '#fbbf24'; // Yellow
    gaugeStatus = 'Moderate usage';
  } else if (powerKw > 4) {
    gaugeColor = '#ef4444'; // Red
    gaugeStatus = 'High consumption';
  }

  return (
    <div className="w-80 flex-shrink-0 space-y-6">
      <h2 className="text-sm font-black tracking-widest text-white uppercase mb-4">HOME ENERGY DASHBOARD</h2>
      
      {/* Real-time Consumption */}
      <div className="glass-panel-premium p-5 flex flex-col">
        <div className="flex justify-between items-start mb-2">
           <h3 className="text-xs font-bold text-white uppercase tracking-wider">REAL-TIME ENERGY CONSUMPTION (kW)</h3>
           <button className="text-white/40 hover:text-white"><MoreVertical size={16} /></button>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400 mb-4 justify-center">
           <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#b53cff]"></span> today</div>
           <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#00f0ff]"></span> avg</div>
        </div>
        <div className="h-32 w-full">
          {isMounted && (
              <AreaChart data={realTimeData} width={280} height={128}>
                <defs>
                  <linearGradient id="colorToday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#b53cff" stopOpacity={0.5}/>
                    <stop offset="95%" stopColor="#b53cff" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#00f0ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip contentStyle={{ backgroundColor: '#0b0e14', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 40]} />
                <Area type="monotone" dataKey="today" stroke="#b53cff" strokeWidth={3} fillOpacity={1} fill="url(#colorToday)" className="drop-shadow-[0_0_8px_rgba(181,60,255,0.8)]" />
                <Area type="monotone" dataKey="avg" stroke="#00f0ff" strokeWidth={2} fillOpacity={1} fill="url(#colorAvg)" />
              </AreaChart>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 font-bold mt-1">
          <span>10:00</span>
          <span>13:00</span>
          <span>15:00</span>
          <span>18:00</span>
          <span>20:00</span>
        </div>
      </div>

      {/* Current Usage Gauge */}
      <div className="glass-panel-premium p-5 flex flex-col items-center relative overflow-hidden">
        <div className="flex justify-between items-start w-full mb-6">
           <h3 className="text-xs font-bold text-white uppercase tracking-wider">CURRENT USAGE: {powerKw.toFixed(1)} kW</h3>
           <button className="text-white/40 hover:text-white"><MoreVertical size={16} /></button>
        </div>
        
        {/* CSS Semi-circle Gauge */}
        <div className="relative w-40 h-20 overflow-hidden flex items-end justify-center mb-2">
           {/* Background Track */}
           <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-[12px] border-white/5"></div>
           {/* Gradient Fill based on usage */}
           <div 
             className="absolute top-0 left-0 w-40 h-40 rounded-full border-[12px] border-transparent rotate-45 transition-all duration-1000" 
             style={{ 
               borderTopColor: gaugeColor, 
               borderLeftColor: '#00f0ff', 
               filter: `drop-shadow(0 0 15px ${gaugeColor}80)` 
             }}></div>
           {/* Needle */}
           <div 
             className="absolute bottom-0 w-1.5 h-16 bg-white rounded-full origin-bottom shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 transition-transform duration-1000"
             style={{ transform: `rotate(${rotateDegree}deg)` }}
           ></div>
           <div className="absolute bottom-0 w-3 h-3 bg-white rounded-full translate-y-1.5 z-20"></div>
        </div>
        <span className="text-xs font-bold mt-2 transition-colors duration-1000" style={{ color: gaugeColor, filter: `drop-shadow(0 0 5px ${gaugeColor}80)` }}>
          {gaugeStatus}
        </span>
      </div>

      {/* Daily Summary */}
      <div className="glass-panel-premium p-5 flex flex-col">
        <div className="flex justify-between items-start mb-6">
           <h3 className="text-xs font-bold text-white uppercase tracking-wider">DAILY ENERGY SUMMARY (kWh)</h3>
           <button className="text-white/40 hover:text-white"><MoreVertical size={16} /></button>
        </div>
        <div className="h-32 w-full">
          {isMounted && (
              <BarChart data={dailyData} width={280} height={128} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" />
                    <stop offset="100%" stopColor="#00f0ff" stopOpacity={0.2} />
                  </linearGradient>
                  <linearGradient id="barGradient2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00f0ff" />
                    <stop offset="100%" stopColor="#b53cff" />
                  </linearGradient>
                </defs>
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, 400]} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ backgroundColor: '#0b0e14', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={24} fill="url(#barGradient1)" className="drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]" />
              </BarChart>
          )}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 font-bold mt-2 px-4">
          <span>lighting</span>
          <span>HVAC</span>
          <span>Appliances</span>
        </div>
      </div>
    </div>
  );
}
