import { LayoutGrid, Plus, Settings, Cpu, Wifi, WifiOff, Sun, Moon, MapPin, Activity, ShieldAlert, Map } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isConnected: boolean;
}

export function Sidebar({ activeTab, setActiveTab, isConnected }: SidebarProps) {
  const { theme, toggleTheme } = useTheme();

  const tabs = [
    { id: 'dashboard', icon: LayoutGrid, label: 'الرئيسية' },
    { id: 'floorplan', icon: Map, label: 'الخريطة' },
    { id: 'scenes', icon: Sun, label: 'السيناريوهات' },
    { id: 'automations', icon: Cpu, label: 'الأتمتة' },
    { id: 'climate', icon: Sun, label: 'التكييف' },
    { id: 'energy', icon: Activity, label: 'الطاقة' },
    { id: 'logs', icon: ShieldAlert, label: 'السجل' },
    { id: 'add', icon: Plus, label: 'إضافة' },
    { id: 'pinmap', icon: MapPin, label: 'المنافذ' },
    { id: 'settings', icon: Settings, label: 'الإعدادات' },
  ];

  return (
    <>
      {/* 💻 Desktop Glass Sidebar */}
      <aside className="hidden md:flex w-[280px] flex-col relative z-20 m-6 rounded-3xl glass-panel overflow-hidden shadow-2xl transition-all duration-500">
        <div className="p-8 flex items-center justify-between mb-2">
          <div className='flex flex-col'>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight mb-1">Mosa Smart</h1>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">نظام التحكم الذكي</p>
          </div>
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(var(--color-primary),0.5)]">
            <Cpu size={22} className="text-white" />
          </div>
        </div>

        <div className="px-4 py-2 flex-1 overflow-y-auto custom-scrollbar">
          <div className="space-y-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)} 
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 ${
                    isActive 
                      ? 'bg-primary/20 text-primary dark:text-blue-400 border border-primary/30 shadow-[0_0_15px_rgba(var(--color-primary),0.15)]' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent'
                  }`}>
                  <Icon size={20} className={`${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(var(--color-primary),0.8)]' : ''} transition-transform`} /> 
                  <span className="text-sm font-bold">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 space-y-4 border-t border-white/5">
          <button 
            onClick={toggleTheme} 
            className="w-full bg-white/5 hover:bg-white/10 rounded-2xl p-4 flex items-center justify-between border border-white/10 transition-all">
            <span className="text-xs font-bold text-gray-700 dark:text-white">المظهر</span>
            <div className="p-2 rounded-xl bg-black/20">
              {theme === 'dark' ? <Moon size={14} className="text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.8)]" /> : <Sun size={14} className="text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.8)]" />}
            </div>
          </button>

          <div className="bg-white/5 rounded-2xl p-4 flex items-center justify-between border border-white/10">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-900 dark:text-white">{isConnected ? 'متصل' : 'غير متصل'}</span>
            </div>
            <div className="p-2 rounded-xl bg-black/20">
               {isConnected ? 
                 <Wifi size={14} className="text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]" /> : 
                 <WifiOff size={14} className="text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
               }
            </div>
          </div>
        </div>
      </aside>

      {/* 📱 Mobile Floating Dock */}
      <div className="md:hidden fixed bottom-6 left-4 right-4 z-50">
        <div className="glass-panel rounded-3xl p-2 flex items-center justify-between shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10">
          <div className="flex gap-1 overflow-x-auto custom-scrollbar pb-1 px-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex flex-col items-center justify-center min-w-[64px] h-16 rounded-2xl transition-all duration-300 relative ${
                    isActive 
                      ? 'bg-primary/20 text-blue-400 border border-primary/30' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                >
                  <Icon size={20} className={`${isActive ? 'scale-110 drop-shadow-[0_0_8px_rgba(var(--color-primary),0.8)]' : ''} transition-all duration-300`} />
                  <span className={`text-[10px] font-bold mt-1.5 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 h-0 mt-0 overflow-hidden'}`}>
                    {tab.label}
                  </span>
                  {isActive && (
                    <div className="absolute -bottom-1 w-8 h-1 bg-primary rounded-full blur-[2px]"></div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
