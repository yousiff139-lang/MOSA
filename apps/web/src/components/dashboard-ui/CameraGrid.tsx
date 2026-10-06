"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Video, Maximize2, ShieldAlert } from 'lucide-react';
import JSMpeg from '@cycjimmy/jsmpeg-player';

interface Camera {
  id: string;
  name: string;
  rtspUrl: string;
  isActive: boolean;
}

export function CameraGrid() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      const res = await fetch('/api/cameras', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center">جاري التحميل...</div>;
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-6">
        <Video className="text-blue-500" />
        <h3 className="text-xl font-bold">كاميرات المراقبة (CCTV)</h3>
      </div>
      
      {cameras.length === 0 ? (
        <div className="glass-panel p-8 rounded-3xl text-center flex flex-col items-center justify-center border border-dashed border-white/20">
          <ShieldAlert size={48} className="text-gray-500 mb-4" />
          <p className="text-gray-400">لا توجد كاميرات مضافة حالياً.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cameras.map((cam, index) => (
            <CameraStreamPlayer key={cam.id} cam={cam} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function CameraStreamPlayer({ cam, index }: { cam: Camera, index: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  
  useEffect(() => {
    if (containerRef.current) {
      // wsPort decreases from 9999 for each camera in the backend
      const port = 9999 - index;
      const url = `ws://${window.location.hostname}:${port}`;
      
      playerRef.current = new JSMpeg.VideoElement(containerRef.current, url, {
        autoplay: true,
        loop: true,
        decodeFirstFrame: true,
      });
    }
    return () => {
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, [index]);

  return (
    <div className="relative aspect-video bg-black rounded-2xl overflow-hidden group border border-white/10 shadow-lg">
      <div ref={containerRef} className="absolute inset-0 flex items-center justify-center bg-gray-900 overflow-hidden [&>canvas]:w-full [&>canvas]:h-full [&>canvas]:object-cover" />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
      
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${cam.isActive ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="font-bold text-sm text-white drop-shadow-md">{cam.name}</span>
        </div>
        <button className="p-2 bg-black/50 hover:bg-black/80 rounded-lg backdrop-blur-md transition-colors opacity-0 group-hover:opacity-100 pointer-events-auto">
          <Maximize2 size={16} />
        </button>
      </div>
    </div>
  );
}
