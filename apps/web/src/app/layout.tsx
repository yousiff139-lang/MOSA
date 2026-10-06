import type { Metadata } from "next";
import { Inter, Cairo, Outfit } from "next/font/google";
import "./globals.css";
import dynamic from 'next/dynamic';

const VoiceAssistant = dynamic(() => import("@/components/dashboard-ui/VoiceAssistant"), { ssr: false });
const CommandPalette = dynamic(() => import("@/components/dashboard-ui/CommandPalette"), { ssr: false });

const inter = Inter({ subsets: ["latin"], variable: '--font-inter' });
const cairo = Cairo({ subsets: ["arabic", "latin"], weight: ['400', '600', '700', '800', '900'], variable: '--font-cairo' });
const outfit = Outfit({ subsets: ["latin"], weight: ['400', '600', '700', '800', '900'], variable: '--font-outfit' });

import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { DashboardWrapper } from "@/components/layout/DashboardWrapper";
import { SimpleModeGuard } from "@/components/layout/SimpleModeGuard";
import { SocketManager } from "@/components/SocketManager";
import { GlobalUIProvider } from "@/components/GlobalUIProvider";
import { BottomNav } from "@/components/BottomNav";
import { UpdateNotification } from "@/components/UpdateNotification";
import { UpdateBanner } from "@/components/UpdateBanner";
import { OfflineSyncBanner } from "@/components/OfflineSyncBanner";

export const metadata: Metadata = {
  title: "Mosa Smart Platform",
  description: "Next Generation Smart Home Platform",
  manifest: "/manifest.json",
  appleWebApp: {
    statusBarStyle: "black-translucent",
    title: "MosaHome",
  },
};

export const viewport = {
  themeColor: "#090E17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

import GlobalConfirmModal from "@/components/GlobalConfirmModal";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <title>Mosa Smart Platform</title>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={`${inter.variable} ${cairo.variable} ${outfit.variable} bg-background text-foreground min-h-screen overflow-hidden transition-colors duration-500 font-sans`}>
        <ErrorBoundary>
          <ThemeProvider>
            <LanguageProvider>
              <SocketManager />
              <GlobalUIProvider />
              <GlobalConfirmModal />
              <UpdateNotification />
              <UpdateBanner />
              <OfflineSyncBanner />
              <VoiceAssistant />
              <CommandPalette />
              <DashboardWrapper>
                <SimpleModeGuard>
                  {children}
                </SimpleModeGuard>
              </DashboardWrapper>
            </LanguageProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
