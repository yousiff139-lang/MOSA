"use client";
import { useState } from 'react';

import { motion } from 'framer-motion';
import { ClimateCard } from './cards/ClimateCard';
import { LightingCard } from './cards/LightingCard';
import { WeatherCard } from './cards/WeatherCard';
import { SecurityCard } from './cards/SecurityCard';
import { MediaControlCard } from './cards/MediaControlCard';
import EnergyChart from './EnergyChart';
import { NotificationCenter } from '../layout/NotificationCenter';
import { Settings } from 'lucide-react';
import { useSmartHomeStore } from '@/store/useSmartHomeStore';
import { useTranslation } from '@/hooks/useTranslation';

import RGL, { Responsive } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = (RGL as any).WidthProvider ? (RGL as any).WidthProvider(Responsive) : (Responsive as any);

export function BentoGrid() {
  const [activeRoom, setActiveRoom] = useState('all');
  
  // Define initial layout for the grid cards
  const [layout, setLayout] = useState([
    { i: 'weather', x: 0, y: 0, w: 2, h: 1 },
    { i: 'light1', x: 2, y: 0, w: 1, h: 1 },
    { i: 'light2', x: 3, y: 0, w: 1, h: 1 },
    { i: 'climate', x: 0, y: 1, w: 2, h: 2 },
    { i: 'security', x: 2, y: 1, w: 1, h: 2 },
    { i: 'media', x: 3, y: 1, w: 1, h: 1 },
    { i: 'energy', x: 0, y: 3, w: 4, h: 2 },
  ]);
  const rooms = useSmartHomeStore(s => s.rooms);
  const devices = useSmartHomeStore(s => s.devices);
  const lightDevices = devices.filter(d => d.type === 'light');
  const { t } = useTranslation();

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-32">
      {/* Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">{t('home.title') || 'منزلي'}</h1>
          <p className="text-gray-400 text-lg">{t('home.subtitle') || 'مرحباً بعودتك، 3 أجهزة تعمل حالياً.'}</p>
        </div>
        <div className="flex gap-3">
          <NotificationCenter />
          <button className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Rooms Filter */}
      <div className="flex gap-3 overflow-x-auto pb-4 mb-4 scrollbar-hide">
        {[{ id: 'all', name: t('home.filter.all') || 'الكل' }, ...rooms].map(room => (
          <button 
            key={room.id}
            onClick={() => setActiveRoom(room.id)}
            className={`px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all ${
              activeRoom === room.id 
                ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                : 'bg-white/5 text-white hover:bg-white/10 border border-white/5'
            }`}
          >
            {room.name}
          </button>
        ))}
      </div>

      {/* Bento Grid */}
      <ResponsiveGridLayout
        className="layout"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 4, md: 4, sm: 2, xs: 2, xxs: 1 }}
        rowHeight={150}
        onLayoutChange={(newLayout: any) => setLayout(newLayout)}
        isDraggable={true}
        isResizable={true}
        margin={[16, 16]}
      >
        <div key="weather">
          <WeatherCard />
        </div>
        <div key="light1">
          <LightingCard device={lightDevices[0]} />
        </div>
        <div key="light2">
          <LightingCard device={lightDevices[1]} />
        </div>
        <div key="climate">
          <ClimateCard />
        </div>
        <div key="security">
          <SecurityCard />
        </div>
        <div key="media">
          <MediaControlCard />
        </div>
        <div key="energy" className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6 flex flex-col justify-center backdrop-blur-xl">
           <h3 className="text-white font-bold text-lg mb-4">استهلاك الطاقة (آخر 7 أيام)</h3>
           <EnergyChart />
        </div>
      </ResponsiveGridLayout>
    </div>
  );
}
