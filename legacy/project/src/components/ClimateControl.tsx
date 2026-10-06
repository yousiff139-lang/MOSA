import { useState } from 'react';
import { Power, Sun, Snowflake, Wind, ChevronUp, ChevronDown, Fan, Droplets } from 'lucide-react';

export function ClimateControl() {
  const [isOn, setIsOn] = useState(false);
  const [mode, setMode] = useState<'heat' | 'cool' | 'fan' | 'dry'>('cool');
  const [temperature, setTemperature] = useState(24.0);
  const [fanSpeed, setFanSpeed] = useState<'auto' | 'low' | 'med' | 'high'>('auto');
  const [swing, setSwing] = useState(false);

  const toggleMode = () => {
    const modes: ('heat' | 'cool' | 'fan' | 'dry')[] = ['cool', 'heat', 'fan', 'dry'];
    const nextIndex = (modes.indexOf(mode) + 1) % modes.length;
    setMode(modes[nextIndex]);
  };

  const toggleFanSpeed = () => {
    const speeds: ('auto' | 'low' | 'med' | 'high')[] = ['auto', 'low', 'med', 'high'];
    const nextIndex = (speeds.indexOf(fanSpeed) + 1) % speeds.length;
    setFanSpeed(speeds[nextIndex]);
  };

  const getModeIcon = () => {
    switch (mode) {
      case 'cool': return <Snowflake className="text-blue-400" size={28} />;
      case 'heat': return <Sun className="text-yellow-400" size={28} />;
      case 'fan': return <Fan className="text-gray-400" size={28} />;
      case 'dry': return <Droplets className="text-teal-400" size={28} />;
    }
  };

  const getModeName = () => {
    switch (mode) {
      case 'cool': return 'تبريد';
      case 'heat': return 'تدفئة';
      case 'fan': return 'مروحة';
      case 'dry': return 'تجفيف';
    }
  };

  const getFanSpeedName = () => {
    switch (fanSpeed) {
      case 'auto': return 'تلقائي';
      case 'low': return 'منخفض';
      case 'med': return 'متوسط';
      case 'high': return 'عالي';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 animate-fade-up">
      <header className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">نظام التكييف</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">تحكم ذكي بدرجة الحرارة والمناخ</p>
      </header>

      {/* Main Climate Dashboard */}
      <div className="relative rounded-3xl overflow-hidden glass-panel shadow-2xl p-6 md:p-8 min-h-[500px]">
        
        {/* Background glow effects */}
        <div className={`absolute top-0 right-0 w-96 h-96 bg-${mode === 'heat' ? 'yellow' : 'blue'}-500/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-1000`}></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-teal-500/10 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 h-full">
          
          {/* On/Off Panel */}
          <button 
            onClick={() => setIsOn(!isOn)}
            className={`flex items-center justify-between p-6 md:p-8 rounded-2xl border transition-all duration-300 ${
              isOn 
                ? 'bg-blue-600/20 border-primary/50 shadow-[0_0_30px_rgba(var(--color-primary),0.15)]' 
                : 'bg-black/5 dark:bg-white/5 border-white/10 hover:bg-black/10 dark:hover:bg-white/10'
            }`}
          >
            <span className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-wide">On/Off</span>
            <div className={`p-4 rounded-full transition-colors ${isOn ? 'bg-primary text-white shadow-lg shadow-blue-500/30' : 'bg-black/10 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400'}`}>
              <Power size={32} />
            </div>
          </button>

          {/* Mode Panel */}
          <button 
            onClick={toggleMode}
            className="flex items-center justify-between p-6 md:p-8 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
          >
            <div>
              <span className="block text-xl md:text-2xl font-bold text-gray-900 dark:text-white text-right mb-1">Mode</span>
              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{getModeName()}</span>
            </div>
            <div className="p-4 rounded-full bg-black/10 dark:bg-slate-800/50 shadow-inner border border-white/5">
              {getModeIcon()}
            </div>
          </button>

          {/* Setpoint Panel (Large) */}
          <div className="md:col-span-1 p-6 md:p-8 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 flex flex-col justify-between">
            <span className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-6">Setpoint</span>
            <div className="flex items-center justify-between px-4">
              <button 
                onClick={() => setTemperature(prev => Math.min(prev + 0.5, 30))}
                className="p-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-gray-800 dark:text-white active:scale-95"
              >
                <ChevronUp size={40} />
              </button>
              
              <div className="flex items-start">
                <span className="text-6xl md:text-7xl font-light text-gray-900 dark:text-white tracking-tighter tabular-nums">
                  {temperature.toFixed(1)}
                </span>
                <span className="text-2xl text-gray-500 dark:text-gray-400 mt-2 ml-1">°C</span>
              </div>

              <button 
                onClick={() => setTemperature(prev => Math.max(prev - 0.5, 16))}
                className="p-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-gray-800 dark:text-white active:scale-95"
              >
                <ChevronDown size={40} />
              </button>
            </div>
          </div>

          <div className="grid grid-rows-2 gap-4 md:gap-6">
            {/* Fan Speed Panel */}
            <button 
              onClick={toggleFanSpeed}
              className="flex items-center justify-between p-6 rounded-2xl bg-black/5 dark:bg-white/5 border border-white/10 hover:bg-black/10 dark:hover:bg-white/10 transition-all duration-300"
            >
              <div>
                <span className="block text-xl font-bold text-gray-900 dark:text-white text-right mb-1">Fan Speed</span>
                <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">{getFanSpeedName()}</span>
              </div>
              <div className={`p-4 rounded-full shadow-inner border border-white/5 ${fanSpeed !== 'auto' ? 'bg-primary/20 text-primary dark:text-blue-400' : 'bg-black/10 dark:bg-slate-800/50 text-gray-500 dark:text-gray-400'}`}>
                <Fan size={28} className={fanSpeed !== 'auto' ? 'animate-spin-slow' : ''} />
              </div>
            </button>

            {/* Swing Panel */}
            <button 
              onClick={() => setSwing(!swing)}
              className={`flex items-center justify-between p-6 rounded-2xl border transition-all duration-300 ${
                swing 
                  ? 'bg-blue-600/20 border-primary/50' 
                  : 'bg-black/5 dark:bg-white/5 border-white/10 hover:bg-black/10 dark:hover:bg-white/10'
              }`}
            >
              <span className="text-xl font-bold text-gray-900 dark:text-white">Swing</span>
              <div className={`p-4 rounded-full transition-colors ${swing ? 'text-primary dark:text-blue-400 bg-primary/10' : 'text-gray-500 dark:text-gray-400 bg-black/10 dark:bg-slate-800/50'}`}>
                <Wind size={28} className={swing ? 'animate-pulse' : ''} />
              </div>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
