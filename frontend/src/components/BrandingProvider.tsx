'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import axios from 'axios';

interface Branding {
  platformName: string;
  platformNameAr: string;
  colorPrimary: string;
  colorBackground: string;
  colorSurface: string;
  logoUrl?: string;
  showEnergyModule: boolean;
}

const defaultBranding: Branding = {
  platformName: 'MOSA',
  platformNameAr: 'منصة موسى الذكية',
  colorPrimary: '#3b82f6', // Default blue from our Deep Navy theme
  colorBackground: '#0a0f1e',
  colorSurface: '#111827',
  showEnergyModule: true,
};

const BrandingContext = createContext<{ branding: Branding, isLoading: boolean }>({
  branding: defaultBranding,
  isLoading: true,
});

export const useBranding = () => useContext(BrandingContext);

export function BrandingProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await axios.get('http://localhost:8080/api/branding');
        if (res.data) {
          setBranding(res.data);
          applyCSSVariables(res.data);
        }
      } catch (error) {
        console.error('Failed to fetch branding, using defaults');
        applyCSSVariables(defaultBranding);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBranding();
  }, []);

  const applyCSSVariables = (b: Branding) => {
    const root = document.documentElement;
    root.style.setProperty('--color-primary', b.colorPrimary);
    root.style.setProperty('--color-bg', b.colorBackground);
    root.style.setProperty('--color-surface', b.colorSurface);
    
    // Convert hex to rgb for rgba() usage in CSS if needed
    // In our Tailwind setup we use specific colors, but this allows custom injection
    document.title = b.platformNameAr || b.platformName;
  };

  return (
    <BrandingContext.Provider value={{ branding, isLoading }}>
      {children}
    </BrandingContext.Provider>
  );
}
