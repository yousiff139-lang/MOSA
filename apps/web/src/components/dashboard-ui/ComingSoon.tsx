import { Construction, Sparkles } from 'lucide-react';
import Link from 'next/link';

interface ComingSoonProps {
  title: string;
  description?: string;
  icon?: any;
}

export function ComingSoon({ title, description, icon: Icon }: ComingSoonProps) {
  return (
    <div className="w-full h-[calc(100vh-100px)] flex items-center justify-center relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#0b0e14]/40 backdrop-blur-3xl shadow-2xl">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-5 z-0"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-[#00f0ff]/10 to-[#b53cff]/10 rounded-full blur-[100px] -z-10 animate-pulse-slow"></div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto p-8">
        <div className="relative mb-8 group">
          <div className="absolute inset-0 bg-gradient-to-r from-[#00f0ff] to-[#b53cff] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-700"></div>
          <div className="w-24 h-24 rounded-3xl bg-[#0b0e14] border border-white/10 flex items-center justify-center relative z-10 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            {Icon ? <Icon size={40} className="text-[#00f0ff]" /> : <Construction size={40} className="text-[#00f0ff]" />}
          </div>
          <Sparkles className="absolute -top-4 -right-4 text-[#b53cff] animate-bounce" size={24} />
        </div>

        <h1 className="text-4xl font-black text-white mb-4 tracking-tight drop-shadow-md">
          {title}
        </h1>
        
        <p className="text-gray-400 text-lg mb-8 leading-relaxed">
          {description || "نحن نعمل بشغف على برمجة وتصميم هذه الواجهة لتكون جاهزة قريباً. شكراً لصبركم!"}
        </p>

        <div className="flex gap-4">
          <Link 
            href="/"
            className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#00d0f0] text-[#0b0e14] font-bold shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:shadow-[0_0_30px_rgba(0,240,255,0.5)] hover:scale-105 transition-all"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}
