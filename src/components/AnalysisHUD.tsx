import { CheckCircle2, XCircle, MinusCircle, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AnalysisData } from '@/src/lib/useVideoAnalysis';

interface AnalysisHUDProps {
  data: AnalysisData;
  compact?: boolean;
}

export function AnalysisHUD({ data, compact = false }: AnalysisHUDProps) {
  if (!data.isAnalyzing) return null;

  const judgmentConfig = {
    in: { label: '界内', icon: CheckCircle2, color: 'bg-primary-container text-on-primary-container', glow: 'shadow-[0_0_20px_rgba(161,254,0,0.3)]' },
    out: { label: '出界', icon: XCircle, color: 'bg-error text-white', glow: 'shadow-[0_0_20px_rgba(255,113,98,0.3)]' },
    net: { label: '触网', icon: MinusCircle, color: 'bg-secondary-container text-on-secondary', glow: 'shadow-[0_0_20px_rgba(188,211,244,0.3)]' },
  };

  const j = data.judgment ? judgmentConfig[data.judgment] : null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* Top center: Judgment badge */}
      <AnimatePresence mode="wait">
        {j && (
          <motion.div
            key={data.judgment! + data.marginMm}
            initial={{ y: -20, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -10, opacity: 0 }}
            className={`absolute top-20 left-1/2 -translate-x-1/2 glass-panel px-5 py-2.5 rounded-xl border border-white/10 flex items-center gap-3 ${j.glow}`}
          >
            <div className={`${j.color} px-3 py-1 rounded-lg font-headline font-bold text-lg flex items-center gap-1.5`}>
              <j.icon className="w-5 h-5" />
              <span>{j.label}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] uppercase tracking-widest font-bold text-on-surface-variant">边缘偏差</span>
              <span className="text-sm font-medium text-white">{data.marginMm} mm</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shot type badge */}
      {data.shotType && (
        <motion.div
          key={data.shotType + data.speed}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-36 right-4 glass-panel px-3 py-1.5 rounded-lg border border-primary/20"
        >
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">{data.shotType}</span>
          </div>
        </motion.div>
      )}

      {/* Left gauges */}
      <div className={`absolute left-3 ${compact ? 'bottom-36' : 'top-1/2 -translate-y-1/2'} flex flex-col gap-3`}>
        <motion.div
          key={'speed-' + data.speed}
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="glass-panel p-2.5 rounded-lg border-l-4 border-primary"
        >
          <span className="text-[8px] uppercase tracking-widest font-bold text-on-surface-variant block">球速</span>
          <div className="flex items-baseline gap-0.5">
            <span className="font-headline text-xl font-bold text-white">{data.speed || '--'}</span>
            <span className="text-on-surface-variant text-[9px]">KM/H</span>
          </div>
        </motion.div>
        <motion.div
          key={'rpm-' + data.rpm}
          initial={{ x: -10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="glass-panel p-2.5 rounded-lg border-l-4 border-secondary"
        >
          <span className="text-[8px] uppercase tracking-widest font-bold text-on-surface-variant block">旋转</span>
          <div className="flex items-baseline gap-0.5">
            <span className="font-headline text-xl font-bold text-white">{data.rpm ? `${(data.rpm / 1000).toFixed(1)}k` : '--'}</span>
            <span className="text-on-surface-variant text-[9px]">RPM</span>
          </div>
        </motion.div>
      </div>

      {/* Right gauges */}
      <div className={`absolute right-3 ${compact ? 'bottom-36' : 'top-1/2 -translate-y-1/2'} flex flex-col gap-3`}>
        <motion.div
          key={'rally-' + data.rally}
          initial={{ x: 10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="glass-panel p-2.5 rounded-lg border-r-4 border-tertiary text-right"
        >
          <span className="text-[8px] uppercase tracking-widest font-bold text-on-surface-variant block">回合</span>
          <span className="font-headline text-xl font-bold text-white">{data.rally}</span>
        </motion.div>
        <motion.div
          key={'net-' + data.netHeight}
          initial={{ x: 10, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="glass-panel p-2.5 rounded-lg border-r-4 border-primary text-right"
        >
          <span className="text-[8px] uppercase tracking-widest font-bold text-on-surface-variant block">净高</span>
          <div className="flex items-baseline justify-end gap-0.5">
            <span className="font-headline text-xl font-bold text-white">{data.netHeight || '--'}</span>
            <span className="text-on-surface-variant text-[9px]">CM</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom center: Accuracy bar */}
      {data.accuracy > 0 && (
        <div className={`absolute ${compact ? 'bottom-28' : 'bottom-36'} left-1/2 -translate-x-1/2 glass-panel px-4 py-2 rounded-xl flex items-center gap-3 min-w-[200px]`}>
          <div className="flex flex-col flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[8px] uppercase tracking-widest font-bold text-on-surface-variant">准确率</span>
              <span className="text-xs font-headline font-bold text-primary">{data.accuracy}%</span>
            </div>
            <div className="h-1 w-full bg-surface-variant rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${data.accuracy}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
          <div className="text-center pl-3 border-l border-outline-variant/20">
            <span className="text-[8px] uppercase tracking-widest font-bold text-on-surface-variant block">击球</span>
            <span className="font-headline text-sm font-bold text-white">{data.rally}</span>
          </div>
        </div>
      )}

      {/* Analyzing indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 glass-panel rounded-full">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-[9px] uppercase tracking-widest font-bold text-primary">AI 分析中</span>
      </div>
    </div>
  );
}
