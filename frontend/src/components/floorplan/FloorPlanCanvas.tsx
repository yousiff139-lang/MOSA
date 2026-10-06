'use client';
import { useState, useEffect } from 'react';
import { Stage, Layer, Circle, Text, Rect, Group } from 'react-konva';
import { api } from '@/services/api';
import { useSocket } from '@/hooks/useSocket';

export default function FloorPlanCanvas() {
  const [devices, setDevices] = useState<any[]>([]);
  const [placedDevices, setPlacedDevices] = useState<any[]>([]);
  const [floorPlanId, setFloorPlanId] = useState<string | null>(null);
  
  const { toggleDevice } = useSocket();

  useEffect(() => {
    // Fetch available devices
    api.get('/devices').then(res => setDevices(res.data)).catch(console.error);
    
    // Fetch floor plan & placed devices
    api.get('/floorplan').then(res => {
      const plans = res.data;
      if (plans && plans.length > 0) {
        setFloorPlanId(plans[0].id);
        setPlacedDevices(plans[0].devices.map((d: any) => ({
          ...d,
          isDragging: false
        })));
      } else {
        // Create an empty floor plan if none exists
        api.post('/floorplan', { name: 'المخطط الرئيسي' }).then(r => setFloorPlanId(r.data.id));
      }
    }).catch(console.error);
  }, []);

  const handleDragEnd = async (e: any, fpdId: string) => {
    const x = e.target.x();
    const y = e.target.y();
    
    // Update locally
    setPlacedDevices(prev => prev.map(d => d.id === fpdId ? { ...d, x, y, isDragging: false } : d));
    
    // Update DB
    try {
      await api.patch(`/floorplan/devices/${fpdId}`, { x, y });
    } catch (err) {
      console.error('Failed to save position');
    }
  };

  const placeDevice = async (deviceId: string) => {
    if (!floorPlanId) return;
    try {
      const res = await api.post('/floorplan/devices', { floorPlanId, deviceId, x: 100, y: 100 });
      // Reload floor plan to get full device details
      const planRes = await api.get('/floorplan');
      const plan = planRes.data.find((p: any) => p.id === floorPlanId);
      if (plan) {
        setPlacedDevices(plan.devices);
      }
    } catch (err) {
      console.error('Failed to place device');
    }
  };

  const handleDeviceClick = (fpd: any) => {
    const dev = fpd.device;
    if (!dev) return;
    const currentState = dev.state?.isOn ? 'OFF' : 'ON';
    
    // Optimistic UI update
    setPlacedDevices(prev => prev.map(d => {
      if (d.id === fpd.id) {
        return { ...d, device: { ...d.device, state: { ...d.device.state, isOn: currentState === 'ON' } } };
      }
      return d;
    }));

    if (dev.state?.mqttTopic) {
      toggleDevice(dev.id, dev.state.mqttTopic, currentState);
    }
  };

  return (
    <div className="flex gap-6 h-[700px]">
      {/* Sidebar / Toolbar */}
      <div className="w-64 bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col h-full overflow-hidden">
        <h3 className="text-zinc-100 font-bold mb-4">الأجهزة المتوفرة</h3>
        <p className="text-xs text-zinc-500 mb-4">اضغط على الجهاز لإضافته للمخطط</p>
        
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {devices.map(d => {
            const isPlaced = placedDevices.some(pd => pd.deviceId === d.id);
            return (
              <button 
                key={d.id}
                disabled={isPlaced}
                onClick={() => placeDevice(d.id)}
                className={`w-full text-right p-3 rounded-lg border text-sm transition-all ${isPlaced ? 'bg-zinc-950 border-zinc-800 text-zinc-600 cursor-not-allowed' : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-700'}`}
              >
                {d.name} {isPlaced && '(مضاف)'}
              </button>
            );
          })}
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden relative" style={{ backgroundImage: 'radial-gradient(#27272a 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
        <Stage width={800} height={700}>
          <Layer>
            {placedDevices.map(fpd => {
              const isOn = fpd.device?.state?.isOn;
              const color = isOn ? '#3b82f6' : '#52525b';
              const shadowColor = isOn ? '#3b82f6' : 'transparent';
              
              return (
                <Group 
                  key={fpd.id} 
                  x={fpd.x} 
                  y={fpd.y} 
                  draggable 
                  onDragStart={(e) => {
                    setPlacedDevices(prev => prev.map(d => d.id === fpd.id ? { ...d, isDragging: true } : d));
                  }}
                  onDragEnd={(e) => handleDragEnd(e, fpd.id)}
                  onClick={() => handleDeviceClick(fpd)}
                  onTap={() => handleDeviceClick(fpd)}
                >
                  <Circle
                    radius={20}
                    fill={color}
                    shadowColor={shadowColor}
                    shadowBlur={15}
                    shadowOpacity={0.5}
                    scaleX={fpd.isDragging ? 1.2 : 1}
                    scaleY={fpd.isDragging ? 1.2 : 1}
                  />
                  <Text
                    text={fpd.device?.name || 'مجهول'}
                    y={28}
                    x={-40}
                    width={80}
                    align="center"
                    fill="#a1a1aa"
                    fontSize={12}
                    fontFamily="Tajawal, sans-serif"
                  />
                </Group>
              );
            })}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
