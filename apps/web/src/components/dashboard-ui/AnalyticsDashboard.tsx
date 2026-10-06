import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/context/ThemeContext';
import { GlassCard } from '../ui/GlassCard';

const data = [
  { time: '00:00', value: 1.2 },
  { time: '04:00', value: 0.8 },
  { time: '08:00', value: 3.5 },
  { time: '12:00', value: 4.2 },
  { time: '16:00', value: 5.8 },
  { time: '20:00', value: 7.1 },
  { time: '24:00', value: 2.3 },
];

export function AnalyticsDashboard() {
  const { accentColor } = useTheme();

  // Mapping simple accent colors to actual hex codes for Recharts
  const colorMap: Record<string, string> = {
    blue: '#00f0ff',
    emerald: '#10b981',
    purple: '#b53cff',
    rose: '#f43f5e',
    orange: '#f97316'
  };

  const primaryColor = colorMap[accentColor] || '#00f0ff';

  return (
    <GlassCard className="w-full h-full p-6 flex flex-col">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">استهلاك الطاقة المباشر</h2>
        <p className="text-sm text-gray-400 mt-1">تتبع استهلاك النظام خلال 24 ساعة (كيلو واط)</p>
      </div>
      
      <div className="flex-1 w-full min-h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.4}/>
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="time" 
              stroke="rgba(255,255,255,0.2)" 
              tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} 
              axisLine={false}
              tickLine={false}
              dy={10}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.2)" 
              tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 12}} 
              axisLine={false}
              tickLine={false}
              dx={-10}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(11, 14, 20, 0.8)', 
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '16px',
                color: '#fff',
                fontWeight: 'bold'
              }}
              itemStyle={{ color: primaryColor }}
              cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2, strokeDasharray: '4 4' }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              name="الاستهلاك (kW)"
              stroke={primaryColor} 
              strokeWidth={3}
              fillOpacity={1} 
              fill="url(#colorValue)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}
