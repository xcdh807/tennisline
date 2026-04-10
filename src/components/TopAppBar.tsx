import { Settings, Zap } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useNavigate } from 'react-router-dom';

interface TopAppBarProps {
  title?: string;
  showAvatar?: boolean;
  className?: string;
}

export function TopAppBar({ title = "TennisLine", showAvatar = true, className }: TopAppBarProps) {
  const navigate = useNavigate();

  return (
    <header className={cn("fixed top-0 w-full z-50 bg-transparent backdrop-blur-xl flex justify-between items-center px-6 py-4", className)}>
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
        <Zap className="w-6 h-6 text-primary-container fill-primary-container" />
        <span className="text-xl font-headline font-black text-white italic tracking-tighter uppercase">
          {title}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="hidden md:flex gap-6 items-center">
          <button onClick={() => navigate('/record')} className="text-on-surface-variant font-body text-[10px] uppercase tracking-widest font-semibold hover:text-white transition-colors">拍摄</button>
          <button onClick={() => navigate('/dashboard')} className="text-primary font-body text-[10px] uppercase tracking-widest font-semibold bg-primary/10 rounded-lg py-2 px-4">统计</button>
          <button onClick={() => navigate('/training')} className="text-on-surface-variant font-body text-[10px] uppercase tracking-widest font-semibold hover:text-white transition-colors">训练</button>
          <button onClick={() => navigate('/history')} className="text-on-surface-variant font-body text-[10px] uppercase tracking-widest font-semibold hover:text-white transition-colors">历史</button>
        </div>
        
        {showAvatar && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/settings')}
              className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-bright transition-colors active:scale-95"
            >
              <Settings className="w-5 h-5 text-on-surface-variant" />
            </button>
            <div 
              onClick={() => navigate('/profile')}
              className="h-10 w-10 rounded-full bg-surface-container-highest overflow-hidden border border-outline-variant/20 cursor-pointer active:scale-95 transition-transform"
            >
              <img 
                alt="User profile" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDPQ1mXebP2-3RvdqYRDgy9FWz2mDP8U3FryqFw49nAJhc5BiyRuoi46UHFNSKd4ZDOxEOrAc1VgrjY4N9BGRiv_J7ISgY7wgx5t6UtMQ19wNefKi1XMlUe-urrx5cXX-Ezb4buhtMp5GZgftfmYuD5Q0em8t_RweKAuFXx1MOLWfHhqK7Noo4bx-PouYLf8RptB57mRHA-UoX1vrLoabbscin61qLzj4C8Y1xIfJ4bf0nTXm1vhSpf4ZJV2hu77DtRAeBTXcPyzbQ"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
