import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
// @ts-ignore
import { ARButton, XR, Controllers, Interactive } from '@react-three/xr';
import { Text, Box } from '@react-three/drei';
import { Glasses } from 'lucide-react';

function VirtualLightSwitch({ position, label }: { position: [number, number, number], label: string }) {
  const [hover, setHover] = useState(false);
  const [isOn, setIsOn] = useState(false);

  const onSelect = () => {
    setIsOn(!isOn);
    alert(`[AR Command] ${label} toggled: ${!isOn ? 'ON' : 'OFF'}`);
  };

  return (
    <Interactive
      onSelect={onSelect}
      onHover={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <group position={position}>
        <Box args={[0.2, 0.2, 0.05]} scale={hover ? 1.1 : 1}>
          <meshStandardMaterial color={isOn ? '#00f0ff' : '#333333'} />
        </Box>
        <Text
          position={[0, 0.15, 0]}
          fontSize={0.05}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </group>
    </Interactive>
  );
}

export default function ARViewer() {
  const [isARReady, setIsARReady] = useState(false);

  return (
    <div className="w-full h-[400px] bg-black border border-blue-500/30 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col items-center justify-center">
      {!isARReady ? (
        <div className="text-center p-8">
          <Glasses size={64} className="text-blue-400 mx-auto mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">الواقع المعزز (WebXR)</h3>
          <p className="text-gray-400 mb-6 max-w-md">
            قم بارتداء نظارة Apple Vision Pro أو استخدم كاميرا هاتفك لتفعيل طبقة التحكم الهولوغرامية فوق أجهزتك الحقيقية.
          </p>
          <button 
            onClick={() => setIsARReady(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors"
          >
            تفعيل الكاميرا و WebXR
          </button>
        </div>
      ) : (
        <>
          <div className="absolute top-4 left-4 z-10">
            {/* @ts-ignore */}
            <ARButton className="!bg-blue-600 !text-white !px-4 !py-2 !rounded-lg !border-none !font-bold" />
          </div>
          <Canvas>
            {/* @ts-ignore */}
            <XR>
              {/* @ts-ignore */}
              <Controllers />
              <ambientLight intensity={0.5} />
              <pointLight position={[5, 5, 5]} />
              
              {/* Floating Holographic Switches in physical space */}
              <VirtualLightSwitch position={[-0.5, 1, -1]} label="مكيف الصالة" />
              <VirtualLightSwitch position={[0.5, 1, -1]} label="إضاءة السقف" />
            </XR>
          </Canvas>
        </>
      )}
    </div>
  );
}
