'use client';

import React from 'react';
import { Floorplan2DCAD } from './Floorplan2DCAD';

interface Device {
  id: string | number;
  name: string;
  type: string;
  state: string;
}

interface Floorplan3DProps {
  devices?: Device[];
  onSelectRoom?: (roomName: string) => void;
}

export function Floorplan3D({ onSelectRoom }: Floorplan3DProps) {
  return <Floorplan2DCAD onSelectRoom={onSelectRoom} />;
}

export default Floorplan3D;
