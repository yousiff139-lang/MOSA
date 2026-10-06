import { useState } from 'react';
import { Cpu, Wifi, RefreshCw, Power, AlertTriangle, Activity, Lock, Save, Plus, Trash2, Palette, Moon, Sun, Monitor, Image, Shield, Settings2, Database, Volume2, Vibrate, Radar } from 'lucide-react';

import { useSmartHomeStore } from '../store/useSmartHomeStore';
import { useSmartHome } from '../hooks/useSmartHome';
import { useTheme, AccentColor, BackgroundStyle, DarkBackgroundHue } from '../context/ThemeContext';

interface SettingsProps {
  isConnected: boolean;
  onRefresh: () => void;
  onTurnOffAll: () => void;
  onReset: () => void;
}

type TabType = 'appearance' | 'boards' | 'security' | 'system';

export function Settings({ isConnected, onRefresh, onTurnOffAll, onReset }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<TabType>('appearance');
  const [newPin, setNewPin] = useState('');
  const [pinMessage, setPinMessage] = useState('');
  const [ipMessage, setIpMessage] = useState('');
  
  const { theme, setTheme, accentColor, setAccentColor, backgroundStyle, setBackgroundStyle, darkBackgroundHue, setDarkBackgroundHue, soundEnabled, setSoundEnabled, hapticsEnabled, setHapticsEnabled } = useTheme();
  
  const accentColors: {id: AccentColor, name: string, bgClass: string}[] = [
    { id: 'blue', name: 'أزرق', bgClass: 'bg-primary' },
    { id: 'emerald', name: 'زمردي', bgClass: 'bg-emerald-500' },
    { id: 'rose', name: 'وردي', bgClass: 'bg-rose-500' },
    { id: 'purple', name: 'بنفسجي', bgClass: 'bg-purple-500' },
    { id: 'orange', name: 'برتقالي', bgClass: 'bg-orange-500' },
  ];
  
  const [newBoardId, setNewBoardId] = useState('');
  const [newBoardIp, setNewBoardIp] = useState('');
  const [newBoardName, setNewBoardName] = useState('');
  const [addBoardMessage, setAddBoardMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState('');
  const { scanNetwork } = useSmartHome();

  const boards = useSmartHomeStore(state => state.boards);
  const addOrUpdateBoard = useSmartHomeStore(state => state.addOrUpdateBoard);
  const removeBoard = useSmartHomeStore(state => state.removeBoard);

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length === 4) {
      localStorage.setItem('app_pin', newPin);
      setPinMessage('تم تحديث الرمز بنجاح');
      setNewPin('');
      setTimeout(() => setPinMessage(''), 3000);
    } else {
      setPinMessage('يجب أن يتكون الرمز من 4 أرقام');
    }
  };

  const handleUpdateBoardIp = (boardId: string, ip: string, name: string) => {
    addOrUpdateBoard(boardId, ip, name);
    setIpMessage('تم الحفظ بنجاح.');
    setTimeout(() => setIpMessage(''), 3000);
  };

  const handleAddBoard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardId.trim() || !newBoardIp.trim() || !newBoardName.trim()) {
      setAddBoardMessage('يرجى تعبئة جميع الحقول');
      return;
    }
    
    addOrUpdateBoard(newBoardId, newBoardIp, newBoardName);
    setAddBoardMessage('تم إضافة اللوحة بنجاح');
    setNewBoardId('');
    setNewBoardIp('');
    setNewBoardName('');
    setTimeout(() => setAddBoardMessage(''), 3000);
  };

  const handleRemoveBoard = (boardId: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذه اللوحة؟ سيتم حذف جميع أجهزتها أيضاً.')) {
      removeBoard(boardId);
    }
  };

  const handleScan = async () => {
    setIsScanning(true);
    setScanMessage('جاري البحث عن اللوحات...');
    const devices = await scanNetwork();
    setIsScanning(false);
    if (devices && devices.length > 0) {
      setScanMessage(`تم العثور على ${devices.length} لوحة!`);
      setTimeout(() => setScanMessage(''), 3000);
    } else {
      setScanMessage('لم يتم العثور على لوحات.');
      setTimeout(() => setScanMessage(''), 3000);
    }
  };

  const renderTabButton = (id: TabType, label: string, Icon: any) => {
    const isActive = activeTab === id;
    return (
      <button
        onClick={() => setActiveTab(id)}
        className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${
          isActive 
            ? 'bg-primary text-white shadow-lg shadow-primary/30' 
            : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white'
        }`}
      >
        <Icon size={18} className={isActive ? "text-white" : "text-gray-400 dark:text-gray-500"} />
        {label}
      </button>
    );
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">
      <header className="flex flex-col md:flex-row md:justify-between md:items-end border-b border-white/10 pb-6 gap-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white drop-shadow-md mb-2">الإعدادات</h2>
          <p className="text-sm text-gray-500">قم بتخصيص الواجهة وإدارة النظام الخاص بك</p>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide w-full md:w-auto">
          {renderTabButton('appearance', 'المظهر', Palette)}
          {renderTabButton('boards', 'إدارة اللوحات', Cpu)}
          {renderTabButton('security', 'الأمان', Shield)}
          {renderTabButton('system', 'النظام', Settings2)}
        </div>
      </header>

      <div className="animate-fade-in relative">
        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-xl glow-primary">
            <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">تخصيص المظهر</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">تحكم بألوان وشكل الواجهة</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20">
                <Palette size={24} className="text-primary" />
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">اللون الأساسي</p>
                <div className="flex gap-4 flex-wrap">
                  {accentColors.map(color => (
                    <button
                      key={color.id}
                      onClick={() => setAccentColor(color.id)}
                      className={`w-12 h-12 rounded-full ${color.bgClass} flex items-center justify-center transition-all ${accentColor === color.id ? 'ring-4 ring-offset-2 ring-offset-[#06090f] ring-white scale-110 shadow-xl' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">وضع الإضاءة</p>
                <div className="flex gap-3">
                  <button onClick={() => setTheme('light')} className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all ${theme === 'light' ? 'bg-primary text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 border border-white/10'}`}>
                    <Sun size={24} /> فاتح
                  </button>
                  <button onClick={() => setTheme('dark')} className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all ${theme === 'dark' ? 'bg-primary text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 border border-white/10'}`}>
                    <Moon size={24} /> داكن
                  </button>
                  <button onClick={() => setTheme('auto')} className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center justify-center gap-2 font-bold text-sm transition-all ${theme === 'auto' ? 'bg-primary text-white shadow-lg' : 'bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 border border-white/10'}`}>
                    <Monitor size={24} /> تلقائي
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">نمط الخلفية</p>
                <div className="flex gap-3 flex-col sm:flex-row">
                  <button onClick={() => setBackgroundStyle('aurora')} className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center justify-center gap-3 font-bold text-sm transition-all ${backgroundStyle === 'aurora' ? 'border-2 border-primary bg-primary/10 text-primary' : 'border border-white/10 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                    <Image size={28} /> شفق ساحر (Aurora)
                  </button>
                  <button onClick={() => setBackgroundStyle('glass')} className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center justify-center gap-3 font-bold text-sm transition-all ${backgroundStyle === 'glass' ? 'border-2 border-primary bg-primary/10 text-primary' : 'border border-white/10 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                    <div className="w-7 h-7 border-2 border-current rounded-md opacity-70"></div> تأثير زجاجي (Glass)
                  </button>
                  <button onClick={() => setBackgroundStyle('solid')} className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center justify-center gap-3 font-bold text-sm transition-all ${backgroundStyle === 'solid' ? 'border-2 border-primary bg-primary/10 text-primary' : 'border border-white/10 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10'}`}>
                    <div className="w-7 h-7 bg-current rounded-md opacity-70"></div> لون سادة (Solid)
                  </button>
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">لون الخلفية (الوضع الداكن)</p>
                <div className="flex gap-4 flex-wrap">
                  {[
                    { id: 'midnight', name: 'أزرق منتصف الليل', bg: '#090E17' },
                    { id: 'plum', name: 'بنفسجي داكن', bg: '#120516' },
                    { id: 'emerald', name: 'زمردي عميق', bg: '#041510' },
                    { id: 'charcoal', name: 'رمادي فحمي', bg: '#0f1115' },
                    { id: 'coffee', name: 'قهوة داكنة', bg: '#1a110c' }
                  ].map(color => (
                    <button
                      key={color.id}
                      onClick={() => setDarkBackgroundHue(color.id as DarkBackgroundHue)}
                      className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-white/10 ${darkBackgroundHue === color.id ? 'ring-4 ring-offset-2 ring-offset-[#06090f] ring-white scale-110 shadow-xl' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
                      style={{ backgroundColor: color.bg }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              <div className="border-t border-white/10 pt-8 mt-8">
                <p className="text-sm font-bold text-gray-900 dark:text-white mb-4">التأثيرات الصوتية والاهتزاز</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`flex-1 py-4 px-4 rounded-xl flex items-center justify-between gap-3 font-bold text-sm transition-all border ${soundEnabled ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Volume2 size={20} /> أزرار تحكم مسموعة
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${soundEnabled ? 'bg-primary' : 'bg-gray-400 dark:bg-gray-600'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-[16px]' : 'translate-x-0'}`}></div>
                    </div>
                  </button>

                  <button 
                    onClick={() => setHapticsEnabled(!hapticsEnabled)}
                    className={`flex-1 py-4 px-4 rounded-xl flex items-center justify-between gap-3 font-bold text-sm transition-all border ${hapticsEnabled ? 'border-primary bg-primary/10 text-primary' : 'border-white/10 bg-black/5 dark:bg-white/5 text-gray-700 dark:text-gray-300'}`}
                  >
                    <div className="flex items-center gap-3">
                      <Vibrate size={20} /> اهتزاز الجوال عند اللمس
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${hapticsEnabled ? 'bg-primary' : 'bg-gray-400 dark:bg-gray-600'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full transition-transform ${hapticsEnabled ? 'translate-x-[16px]' : 'translate-x-0'}`}></div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Boards Tab */}
        {activeTab === 'boards' && (
          <div className="space-y-6">
            <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-xl">
              <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-6">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">إضافة لوحة جديدة</h3>
                    <button 
                      type="button" 
                      onClick={handleScan}
                      disabled={isScanning}
                      className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/80 transition-colors bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20"
                    >
                      {isScanning ? <RefreshCw size={14} className="animate-spin" /> : <Radar size={14} className="animate-pulse" />}
                      {isScanning ? 'جاري البحث...' : 'اكتشاف تلقائي'}
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">أضف لوحة ESP32 يدوياً إذا لم يتم اكتشافها تلقائياً</p>
                  {scanMessage && <p className={`text-[10px] font-bold mt-2 ${scanMessage.includes('تم') ? 'text-green-500' : 'text-blue-500'}`}>{scanMessage}</p>}
                </div>
                <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center border border-emerald-500/20">
                  <Plus size={24} className="text-emerald-500" />
                </div>
              </div>
              
              <form onSubmit={handleAddBoard} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-bold mb-2">معرف اللوحة (Board ID)</p>
                    <input 
                      type="text" 
                      value={newBoardId}
                      onChange={(e) => setNewBoardId(e.target.value)}
                      placeholder="مثال: livingroom" 
                      className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-white/10 text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-colors text-sm" dir="ltr"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-bold mb-2">الـ IP المحلي (اختياري)</p>
                    <input 
                      type="text" 
                      value={newBoardIp}
                      onChange={(e) => setNewBoardIp(e.target.value)}
                      placeholder="مثال: 192.168.1.100" 
                      className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-white/10 text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-colors text-sm" dir="ltr"
                    />
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-bold mb-2">الاسم (يظهر في الواجهة)</p>
                    <input 
                      type="text" 
                      value={newBoardName}
                      onChange={(e) => setNewBoardName(e.target.value)}
                      placeholder="غرفة الجلوس" 
                      className="w-full p-4 bg-black/5 dark:bg-white/5 rounded-xl border border-white/10 text-gray-900 dark:text-white outline-none focus:border-emerald-500 transition-colors text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4 pt-2">
                  <button type="submit" className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2">
                    <Save size={18} /> حفظ اللوحة
                  </button>
                  {addBoardMessage && <span className="text-sm font-bold text-emerald-500 animate-fade-in">{addBoardMessage}</span>}
                </div>
              </form>
            </div>

            <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-xl">
              <div className="flex justify-between items-start mb-6 border-b border-white/10 pb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">اللوحات المتصلة</h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">اللوحات التي تواصلت مع السيرفر</p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center border border-blue-500/20">
                  <Database size={24} className="text-blue-500" />
                </div>
              </div>

              <div className="space-y-4">
                {Object.values(boards).map((board) => (
                  <div key={board.id} className="p-5 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/10 space-y-4 relative group hover:border-primary/50 transition-colors">
                    <button 
                      onClick={() => handleRemoveBoard(board.id)}
                      className="absolute top-5 left-5 p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-colors md:opacity-0 group-hover:opacity-100"
                      title="حذف اللوحة"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                      <Wifi className="text-primary" size={22} />
                      <span className="text-lg font-bold text-gray-900 dark:text-white">{board.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-2">اسم اللوحة</p>
                        <input 
                          type="text" 
                          defaultValue={board.name}
                          onBlur={(e) => handleUpdateBoardIp(board.id, board.ip, e.target.value)}
                          className="text-sm w-full p-3 bg-white/10 dark:bg-black/30 rounded-xl border border-white/10 text-gray-900 dark:text-white outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 dark:text-gray-400 font-bold mb-2">IP المحلي</p>
                        <input 
                          type="text" 
                          defaultValue={board.ip}
                          onBlur={(e) => handleUpdateBoardIp(board.id, e.target.value, board.name)}
                          placeholder="مثال: 192.168.1.50"
                          className="text-sm w-full p-3 bg-white/10 dark:bg-black/30 rounded-xl border border-white/10 text-gray-900 dark:text-white outline-none focus:border-primary transition-colors" dir="ltr"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {Object.keys(boards).length === 0 && (
                  <div className="text-center py-10 border-2 border-dashed border-white/10 rounded-2xl">
                    <p className="text-gray-500 font-medium">لم يتم اكتشاف أو إضافة أي لوحات بعد.</p>
                  </div>
                )}
                {ipMessage && <p className="text-sm text-emerald-500 font-bold text-center mt-2 animate-pulse">{ipMessage}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-xl">
            <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">إعدادات الأمان</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">تغيير رمز المرور لحماية النظام</p>
              </div>
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
                <Lock size={24} className="text-purple-500" />
              </div>
            </div>

            <form onSubmit={handleUpdatePin} className="space-y-4 max-w-sm">
              <div>
                <label className="block text-sm font-semibold mb-2">رمز PIN الجديد (4 أرقام)</label>
                <input 
                  type="password" 
                  maxLength={4}
                  className="w-full p-4 rounded-xl bg-black/5 dark:bg-white/5 border border-white/10 focus:ring-2 ring-primary outline-none text-center text-2xl tracking-[1em]"
                  placeholder="••••"
                  value={newPin}
                  onChange={e => setNewPin(e.target.value.replace(/[^0-9]/g, ''))}
                  dir="ltr"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 transition-colors shadow-lg shadow-primary/30"
              >
                <Save size={20} /> حفظ الرمز
              </button>
              {pinMessage && (
                <p className={`text-sm font-bold text-center ${pinMessage.includes('بنجاح') ? 'text-emerald-500' : 'text-red-500'}`}>
                  {pinMessage}
                </p>
              )}
            </form>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="glass-panel p-6 md:p-8 rounded-3xl shadow-xl">
            <div className="flex justify-between items-start mb-8 border-b border-white/10 pb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">إدارة النظام</h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">التحكم المركزي وتهيئة الأجهزة</p>
              </div>
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                <Settings2 size={24} className="text-red-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center gap-3 text-gray-900 dark:text-white font-bold text-lg">
                  <Activity className="text-blue-500" /> حالة الاتصال
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  هذه الحالة تبين اتصال واجهة الاستخدام بالسيرفر المركزي لتبادل البيانات فورياً.
                </p>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm ${isConnected ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/20 text-red-600 dark:text-red-400'}`}>
                  <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></div>
                  {isConnected ? 'النظام متصل وتفاعلي' : 'غير متصل بالسيرفر'}
                </div>
              </div>

              <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center gap-3 text-gray-900 dark:text-white font-bold text-lg">
                  <RefreshCw className="text-primary" /> إعادة المزامنة
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  اطلب من جميع اللوحات إرسال حالتها الحالية إلى السيرفر مرة أخرى لضمان تزامن الواجهة.
                </p>
                <button 
                  onClick={onRefresh}
                  className="bg-white/10 hover:bg-white/20 text-gray-900 dark:text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors border border-white/20"
                >
                  <RefreshCw size={18} /> تحديث البيانات الآن
                </button>
              </div>

              <div className="bg-black/5 dark:bg-white/5 p-6 rounded-2xl border border-white/10 space-y-4">
                <div className="flex items-center gap-3 text-gray-900 dark:text-white font-bold text-lg">
                  <Power className="text-orange-500" /> إطفاء شامل
                </div>
                <p className="text-sm text-gray-500 leading-relaxed">
                  قم بإطفاء جميع الأجهزة النشطة في جميع اللوحات دفعة واحدة.
                </p>
                <button 
                  onClick={onTurnOffAll}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-orange-500/30"
                >
                  <Power size={18} /> إطفاء جميع الأجهزة
                </button>
              </div>

              <div className="bg-red-500/5 p-6 rounded-2xl border border-red-500/20 space-y-4">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-400 font-bold text-lg">
                  <AlertTriangle /> إعادة ضبط المصنع
                </div>
                <p className="text-sm text-red-800/80 dark:text-red-200/60 leading-relaxed">
                  تحذير: هذا سيقوم بحذف جميع الأجهزة من اللوحات ومسح قاعدة البيانات. هذا الإجراء لا يمكن التراجع عنه.
                </p>
                <button 
                  onClick={onReset}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-red-600/30"
                >
                  <AlertTriangle size={18} /> مسح جميع اللوحات
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
