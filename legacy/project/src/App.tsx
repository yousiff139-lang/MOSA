import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { AddDevice } from './components/AddDevice';
import { Settings } from './components/Settings';
import { AuthScreen } from './components/AuthScreen';
import { Scenes } from './components/Scenes';
import { VoiceControl } from './components/VoiceControl';
import { PinMapping } from './components/PinMapping';
import { ActivityLog } from './components/ActivityLog';
import { EnergyMonitor } from './components/EnergyMonitor';
import { Automations } from './components/Automations';
import { ClimateControl } from './components/ClimateControl';
import { FloorPlan } from './components/FloorPlan';
import { SmartPairingPopup } from './components/SmartPairingPopup';
import { useSmartHome } from './hooks/useSmartHome';
import { AlertTriangle, X, WifiOff, Key, Radio } from 'lucide-react';
import { useTheme, auroraColorsMap } from './context/ThemeContext';

export default function App() {
  const [isAuthenticatedApp, setIsAuthenticatedApp] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { 
    devices, isConnected, isMqttConnected, isAuthenticated, wsPassword, setWsPassword,
    connectWS, toggle, updatePWM, updateColor, setTimer, updateSchedule, executeScene,
    addDevice, deleteDevice, turnOffAll, resetSystem,
    motionAlert, setMotionAlert, discoveryAlert, setDiscoveryAlert,
    globalData, activityLogs, powerHistory, sendCommand
  } = useSmartHome();

  const { theme, toggleTheme, accentColor, backgroundStyle } = useTheme();

  const [timeOfDay, setTimeOfDay] = useState<'morning' | 'afternoon' | 'evening' | 'night'>('morning');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) setTimeOfDay('morning');
    else if (hour >= 12 && hour < 18) setTimeOfDay('afternoon');
    else if (hour >= 18 && hour < 20) setTimeOfDay('evening');
    else setTimeOfDay('night');
  }, []);

  const currentColors = backgroundStyle === 'aurora' ? auroraColorsMap[accentColor] : null;

  if (!isAuthenticatedApp) {
    return <AuthScreen onLogin={() => setIsAuthenticatedApp(true)} />;
  }

  // Determine active mode class based on body's class list or theme context
  const isDark = document.documentElement.classList.contains('dark') || theme === 'dark';

  return (
    <div className={`min-h-screen w-full transition-colors duration-1000 font-sans selection:bg-primary/30 flex relative overflow-hidden ${
      isDark
        ? (backgroundStyle === 'solid' ? 'bg-theme-solid text-slate-300' : 'bg-theme-base text-slate-300')
        : (backgroundStyle === 'solid' ? 'bg-white text-gray-900' : 'bg-slate-50 text-gray-900')
    }`} dir="rtl">
      
      {/* Aurora Background Elements */}
      {backgroundStyle === 'aurora' && currentColors && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
          <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] aurora-blob-1 rounded-full blur-[100px] opacity-60 transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${currentColors[0]} 0%, rgba(0,0,0,0) 70%)` }}></div>
          <div className="absolute top-[30%] -right-[10%] w-[50%] h-[50%] aurora-blob-2 rounded-full blur-[100px] opacity-50 transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${currentColors[1]} 0%, rgba(0,0,0,0) 70%)` }}></div>
          <div className="absolute -bottom-[20%] left-[20%] w-[70%] h-[70%] aurora-blob-3 rounded-full blur-[120px] opacity-40 transition-colors duration-1000" style={{ background: `radial-gradient(circle, ${currentColors[2]} 0%, rgba(0,0,0,0) 70%)` }}></div>
        </div>
      )}
      
      {/* Glass Background Elements */}
      {backgroundStyle === 'glass' && (
        <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-50">
           <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]"></div>
           <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px]"></div>
        </div>
      )}

      <div className="relative z-10 flex w-full">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} isConnected={isConnected || isMqttConnected} />
        
        {/* Main Content Area - padded at bottom on mobile to clear the dock */}
        <main className="flex-1 p-6 md:p-10 overflow-y-auto relative pb-28 md:pb-10 custom-scrollbar">
        
        {/* Top Bar for Theme Toggle & Notifications */}
        <div className="absolute top-4 left-8 z-50 flex items-center gap-4">
          <button 
            onClick={toggleTheme}
            className="p-3 rounded-full bg-white dark:bg-slate-800 shadow-md hover:scale-110 transition-transform"
            title="تبديل المظهر"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Smart Pairing Popup (AirPods Style) */}
        <SmartPairingPopup onPair={() => setActiveTab('add')} />

        {/* Disconnect Banner */}
        {(!isConnected && !isMqttConnected) && (
          <div className="mb-6 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-500/50 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl shadow-lg animate-slide-down relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 relative z-10 w-full">
              <WifiOff size={20} className="animate-pulse flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">انقطع الاتصال بجهاز التحكم (ESP32)</p>
                <p className="text-xs opacity-80">جاري محاولة إعادة الاتصال تلقائياً...</p>
              </div>
            </div>
            <button onClick={connectWS} className="relative z-10 w-full sm:w-auto bg-red-500 hover:bg-red-600 text-white text-xs px-4 py-2 rounded-lg font-bold transition-colors whitespace-nowrap shadow-sm hover:scale-105 active:scale-95">
              محاولة الآن
            </button>
            <div className="absolute bottom-0 left-0 h-1 bg-red-500 animate-shrink"></div>
          </div>
        )}

        {/* Auth Error Banner */}
        {(isConnected && !isAuthenticated) && (
          <div className="mb-6 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-500/50 text-yellow-800 dark:text-yellow-400 px-4 py-3 rounded-xl flex flex-col gap-3 shadow-sm">
            <div className="flex items-center gap-3">
              <Key size={20} />
              <p className="font-bold">يرجى إدخال كلمة مرور التحكم الصحيحة للاتصال بالمنزل.</p>
            </div>
            <div className="flex items-center gap-2 max-w-sm">
              <input 
                type="password" 
                placeholder="كلمة المرور..."
                className="flex-1 p-2 rounded-lg border dark:border-gray-600 bg-white dark:bg-slate-800 focus:ring-2 ring-yellow-500 outline-none"
                value={wsPassword}
                onChange={(e) => setWsPassword(e.target.value)}
              />
              <button 
                onClick={connectWS}
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-bold transition-colors"
              >
                دخول
              </button>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <Dashboard 
            devices={devices}
            isConnected={isConnected || isMqttConnected}
            onToggle={toggle}
            onDelete={deleteDevice}
            onRefresh={connectWS}
            onAddClick={() => setActiveTab('add')}
            onUpdatePWM={updatePWM}
            onUpdateColor={updateColor}
            onSetTimer={setTimer}
            onUpdateSchedule={updateSchedule}
          />
        )}

        {activeTab === 'scenes' && (
          <Scenes onExecuteScene={executeScene} devices={devices} />
        )}

        {activeTab === 'floorplan' && (
          <FloorPlan devices={devices} onToggle={toggle} />
        )}

        {activeTab === 'add' && (
          <AddDevice devices={devices} onAdd={(boardId, formData) => { addDevice(boardId, formData); setActiveTab('dashboard'); }} />
        )}

        {activeTab === 'settings' && (
          <Settings 
            isConnected={isConnected || isMqttConnected}
            onRefresh={connectWS}
            onTurnOffAll={turnOffAll}
            onReset={resetSystem}
          />
        )}

        {activeTab === 'climate' && (
          <ClimateControl />
        )}

        {activeTab === 'automations' && (
          <Automations />
        )}

        {activeTab === 'pinmap' && (
          <PinMapping />
        )}

        {activeTab === 'energy' && (
          <EnergyMonitor globalData={globalData} powerHistory={powerHistory} />
        )}

        {activeTab === 'logs' && (
          <ActivityLog logs={activityLogs} />
        )}
        
        <VoiceControl devices={devices} onToggle={toggle} onTurnOffAll={turnOffAll} />
      </main>

      {/* Motion Alert Banner */}
      {motionAlert && (
        <div 
          onClick={() => setMotionAlert(false)}
          className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[100] bg-red-100 dark:bg-red-900/90 border border-red-500 text-red-700 dark:text-red-300 px-4 py-2 rounded-full shadow-lg flex items-center gap-3 animate-pulse cursor-pointer hover:scale-105 transition-transform"
        >
          <AlertTriangle size={20} className="text-red-600 dark:text-red-400 animate-bounce" />
          <span className="font-bold text-sm">إنذار اختراق! رصد حركة</span>
          <button className="p-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-full mr-2 transition-colors">
             <X size={16} />
          </button>
        </div>
      )}

      </div>
    </div>
  );
}