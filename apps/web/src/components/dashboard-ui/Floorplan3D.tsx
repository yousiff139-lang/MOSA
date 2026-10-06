'use client';

// Suppress THREE.Clock / WebGLRenderer deprecation warnings in console
if (typeof window !== 'undefined') {
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      args[0] &&
      typeof args[0] === 'string' &&
      (args[0].includes('Clock has been deprecated') || args[0].includes('THREE.WebGLRenderer'))
    ) {
      return;
    }
    originalWarn(...args);
  };
}

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, Box, Plane, Sparkles } from '@react-three/drei';
import { useState } from 'react';
import * as THREE from 'three';

function Room({ position, size, color, name, isOn, onClick }: any) {
  const [hovered, setHover] = useState(false);

  return (
    <group position={position}>
      {/* Floor */}
      <Plane 
        args={[size[0], size[2]]} 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, -0.5, 0]}
        onClick={onClick}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <meshStandardMaterial color={hovered ? '#444' : '#222'} roughness={0.8} />
      </Plane>
      
      {/* Walls (simplified representation) */}
      <Box args={[size[0], 1, 0.1]} position={[0, 0, -size[2]/2]}>
        <meshStandardMaterial color="#111" transparent opacity={0.5} />
      </Box>
      <Box args={[size[0], 1, 0.1]} position={[0, 0, size[2]/2]}>
        <meshStandardMaterial color="#111" transparent opacity={0.5} />
      </Box>
      <Box args={[0.1, 1, size[2]]} position={[-size[0]/2, 0, 0]}>
        <meshStandardMaterial color="#111" transparent opacity={0.5} />
      </Box>
      <Box args={[0.1, 1, size[2]]} position={[size[0]/2, 0, 0]}>
        <meshStandardMaterial color="#111" transparent opacity={0.5} />
      </Box>

      {/* Light Source Representation */}
      {isOn && (
        <pointLight position={[0, 2, 0]} intensity={1.2} color={color} distance={8} />
      )}
      {isOn && (
        <Sparkles count={12} scale={size[0]} size={1.5} color={color} speed={0.2} opacity={0.4} />
      )}
      
      {/* Room Label */}
      <Box args={[0.5, 0.5, 0.5]} position={[0, 0.5, 0]}>
        <meshStandardMaterial color={isOn ? color : '#333'} emissive={isOn ? color : '#000'} emissiveIntensity={isOn ? 1.5 : 0} />
      </Box>
    </group>
  );
}

import { useSmartHomeStore } from '@/store/useSmartHomeStore';

export default function Floorplan3D() {
  const storeRooms = useSmartHomeStore(s => s.rooms);
  const devices = useSmartHomeStore(s => s.devices);
  const toggleDevice = useSmartHomeStore(s => s.toggleDevice);

  // Map backend rooms to 3D positions
  const mappedRooms = storeRooms.map((room, index) => {
    const isEven = index % 2 === 0;
    const xPos = isEven ? -4 : 4;
    const zPos = Math.floor(index / 2) * -6;
    
    // Check if any device in this room is ON
    const roomDevices = devices.filter(d => (d as any).room?.name === room.name || (d as any).roomId === room.id);
    const isOn = roomDevices.some(d => d.state === 'ON');

    return {
      id: room.id,
      name: room.name,
      position: [xPos, 0, zPos] as [number, number, number],
      size: [6, 2, 5] as [number, number, number],
      color: isEven ? '#ffaa00' : '#00f0ff',
      isOn,
      devices: roomDevices
    };
  });

  const toggleRoom = (roomId: string, devicesInRoom: any[]) => {
    devicesInRoom.forEach(d => {
       toggleDevice(d.id);
    });
  };

  return (
    <div className="w-full h-[450px] bg-[#050505] rounded-3xl overflow-hidden border border-white/5 relative shadow-2xl">
      <div className="absolute top-6 left-6 z-10 pointer-events-none">
        <h3 className="text-xl font-bold text-white mb-1">المخطط التفاعلي 3D</h3>
        <p className="text-sm text-gray-500">انقر على أي غرفة للتحكم بالإضاءة فورياً</p>
      </div>

      {/* GPU Low-Power Demand Rendering: Only renders when camera moves or state changes, 0% GPU idle load! */}
      <Canvas 
        frameloop="demand" 
        dpr={[1, 1.5]} 
        gl={{ powerPreference: 'low-power', antialias: false, preserveDrawingBuffer: false }} 
        camera={{ position: [8, 10, 8], fov: 45 }}
      >
        <color attach="background" args={['#050505']} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 10]} intensity={0.8} />
        
        {mappedRooms.length === 0 ? (
          <Room 
            position={[0, 0, 0]}
            size={[6, 2, 6]}
            color="#ffaa00"
            isOn={false}
            name="لا توجد غرف"
          />
        ) : mappedRooms.map((room) => (
          <Room 
            key={room.id}
            {...room}
            onClick={() => toggleRoom(room.id, room.devices)}
          />
        ))}

        <OrbitControls 
          enablePan={false} 
          minPolarAngle={0} 
          maxPolarAngle={Math.PI / 2.5} 
          minDistance={5}
          maxDistance={20}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
