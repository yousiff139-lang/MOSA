'use client';

import React from 'react';
import { Floorplan2DCAD } from '@/components/dashboard/Floorplan2DCAD';

export default function FloorplanPage() {
  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 font-sans">
      <Floorplan2DCAD />
    </div>
  );
}
