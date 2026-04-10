import { BatteryFull, CheckCircle2, VideoOff, LayoutGrid, Zap, Square, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { BottomNavBar } from '@/src/components/BottomNavBar';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';

export function LiveRecordingPage() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(true);
  const [timer, setTimer] = useState(2535); // 00:42:15 in seconds

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-surface text-on-surface font-body overflow-hidden h-screen w-full relative">
      {/* Background: Live Tennis Court View with Trajectory Overlay */}
      <div className="fixed inset-0 z-0">
        <img 
          alt="Tennis Court Live View" 
          className="w-full h-full object-cover opacity-60" 
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCukPUrGkWZOyC3F7dyTLyvPXMZ5XlPaA8ISof_Rz8dN1oFyohLcpMij5q_j65GOajjSGeGEA1hYOIGNNbY7hAk2g3xsm0VLHSJQJ33QL1LYcwZUCczLKRqL_bv34pEUt2LBvI-_QtYgYtICQtSJDaurjBFEHvlO7Yr_HiN274y1HFh-Lz2W2hjHusrYSH36vcjqRLb8CCfQrdTivRNlLmHvcS5GEe2F4ze4BZl2lUlmDDhsd_oB2FJUnRbuMe0edIsGs6ccPB5428"
          referrerPolicy="no-referrer"
        />
        
        {/* Kinetic Trajectory Overlay */}
        <AnimatePresence>
          {isRecording && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 1000" preserveAspectRatio="none">
              <motion.path 
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.8 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity }}
                d="M 200,800 Q 500,200 800,600" 
                fill="none" 
                stroke="#a1fe00" 
                strokeWidth="4"
                className="drop-shadow-[0_0_8px_#a1fe00]"
                strokeDasharray="10"
              />
              <motion.circle 
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                cx="800" cy="600" r="8" fill="#a1fe00" 
                className="shadow-[0_0_15px_#a1fe00]"
              />
            </svg>
          )}
        </AnimatePresence>
      </div>

      {/* TopAppBar */}
      <header className="fixed top-0 w-full z-50 bg-transparent backdrop-blur-xl flex justify-between items-center px-6 py-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="text-primary hover:text-white transition-colors">
            <Zap className="w-6 h-6 fill-primary" />
          </button>
          <div className="flex flex-col">
            <span className="font-headline font-bold tracking-tight text-xl text-white italic">TennisLine</span>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-semibold text-on-surface-variant">
              <span className={cn("w-1.5 h-1.5 rounded-full bg-error", isRecording && "animate-pulse")} />
              {isRecording ? `录制中 ${formatTime(timer)}` : '已暂停'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-on-surface-variant font-body text-sm">
            <BatteryFull className="w-4 h-4" />
            <span>88%</span>
          </div>
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-outline-variant/20">
            <img 
              alt="User Profile" 
              className="w-full h-full object-cover" 
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDcVNPrXLO3Yir_VybQLpSPGPBk3bwROcyrgc1Q3nI895FpHqn4Z51sSaFAu-lUvTXCZHmsLzGa0hUGpn7raMs18iZTd0i87c4JPh-DF7X7avACm0IHHiUQfULqEmR_kyeD6LVtboVOOCRCkaeLNtnQM6SQ5PZOrRCw_qF5XzRgVwvj9ePR22S4pt1F0EGP9xM9tB3s15ORCsS5Y1iMT_xI3UDWLosWzFbKQG7b09swcaRCoryN3gE-1D3T7kHQhilU0uGXb_epIGM"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
      </header>

      {/* Main HUD Overlays */}
      <main className="relative z-10 h-full w-full flex flex-col items-center pt-24 pb-32">
        {/* Center HUD: Decision Status */}
        <AnimatePresence>
          {isRecording && (
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="glass-panel px-8 py-3 rounded-lg border border-primary/20 flex items-center gap-4 mb-8"
            >
              <div className="bg-primary-container text-on-primary-container px-4 py-1 rounded-lg font-headline font-bold text-2xl flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 fill-on-primary-container" />
                <span>界内</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">基准线检查</span>
                <span className="text-sm font-medium text-white">边缘偏差: 0.2mm</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Lateral Data Gauges */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-6">
          <div className="glass-panel p-4 rounded-lg border-l-4 border-primary">
            <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block mb-1">球速</span>
            <div className="flex items-baseline gap-1">
              <span className="font-headline text-3xl font-bold text-white">{isRecording ? '184' : '--'}</span>
              <span className="text-on-surface-variant text-xs">KM/H</span>
            </div>
          </div>
          <div className="glass-panel p-4 rounded-lg border-l-4 border-secondary">
            <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block mb-1">旋转率</span>
            <div className="flex items-baseline gap-1">
              <span className="font-headline text-3xl font-bold text-white">{isRecording ? '2.4k' : '--'}</span>
              <span className="text-on-surface-variant text-xs">RPM</span>
            </div>
          </div>
        </div>

        <div className="absolute right-6 top-1/2 -translate-y-1/2 flex flex-col gap-6">
          <div className="glass-panel p-4 rounded-lg border-r-4 border-tertiary text-right">
            <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block mb-1">回合数</span>
            <span className="font-headline text-3xl font-bold text-white">{isRecording ? '12' : '0'}</span>
          </div>
          <div className="glass-panel p-4 rounded-lg border-r-4 border-primary text-right">
            <span className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant block mb-1">净高</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="font-headline text-3xl font-bold text-white">{isRecording ? '24' : '--'}</span>
              <span className="text-on-surface-variant text-xs">CM</span>
            </div>
          </div>
        </div>

        {/* Camera Controls & Stop FAB */}
        <div className="mt-auto flex items-center gap-8 mb-12">
          <button className="glass-panel w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors">
            <VideoOff className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setIsRecording(!isRecording)}
            className="kinetic-gradient w-20 h-20 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(161,254,0,0.3)] group scale-95 active:scale-90 transition-transform"
          >
            {isRecording ? (
              <Square className="w-6 h-6 fill-on-primary text-on-primary" />
            ) : (
              <Circle className="w-6 h-6 fill-on-primary text-on-primary" />
            )}
          </button>
          <button className="glass-panel w-14 h-14 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-colors">
            <LayoutGrid className="w-6 h-6" />
          </button>
        </div>
      </main>

      <BottomNavBar />

      {/* Focus Crosshair Decor */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center opacity-20">
        <div className="w-64 h-64 border border-white/40 rounded-full relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-white" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-white" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 w-4 bg-white" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-0.5 w-4 bg-white" />
        </div>
      </div>
    </div>
  );
}
