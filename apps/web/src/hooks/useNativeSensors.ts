import { useState, useEffect } from 'react';
import { Geolocation, Position } from '@capacitor/geolocation';
import { Device, DeviceInfo, BatteryInfo } from '@capacitor/device';

export interface NativeSensors {
  position: Position | null;
  deviceInfo: DeviceInfo | null;
  batteryInfo: BatteryInfo | null;
  error: string | null;
}

export function useNativeSensors(): NativeSensors {
  const [position, setPosition] = useState<Position | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [batteryInfo, setBatteryInfo] = useState<BatteryInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let watchId: string;

    const initSensors = async () => {
      try {
        // 1. Get Device Info
        const info = await Device.getInfo();
        setDeviceInfo(info);

        // 2. Get Battery Info
        const battery = await Device.getBatteryInfo();
        setBatteryInfo(battery);

        // 3. Request Geolocation Permissions and watch position
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
           await Geolocation.requestPermissions();
        }

        watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
          if (pos) {
            setPosition(pos);
            // Example: send pos to Mosa backend to trigger 'entered_home' automation
            // fetch('/api/telemetry/location', { method: 'POST', body: JSON.stringify(pos.coords) });
          }
          if (err) {
            console.error('Geolocation watch error:', err);
            setError(err.message);
          }
        });
      } catch (e: any) {
        console.error('Error initializing native sensors:', e);
        setError(e.message || 'Failed to initialize sensors');
      }
    };

    initSensors();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, []);

  return { position, deviceInfo, batteryInfo, error };
}
