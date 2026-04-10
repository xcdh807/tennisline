import { TrendingUp, Verified, LineChart as ChartIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { TopAppBar } from '@/src/components/TopAppBar';
import { BottomNavBar } from '@/src/components/BottomNavBar';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { getPerformanceStats } from '@/src/lib/api';

type TrendFilter = '正手' | '综合' | '反手';

export function DashboardPage() {
  const { user } = useAuth();
  const [activeTrend, setActiveTrend] = useState<TrendFilter>('综合');
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getPerformanceStats(user.id)
      .then(data => setStats(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const trendData: Record<TrendFilter, number[]> = {
    '正手': stats?.forehand_trend || [55, 60, 50, 65, 78, 70, 85, 75, 88, 92],
    '综合': stats?.overall_trend || [60, 65, 55, 70, 82, 75, 88, 78, 91, 94],
    '反手': stats?.backhand_trend || [65, 70, 60, 75, 85, 80, 92, 82, 94, 96],
  };

  const winRate = stats?.win_rate ?? 64;
  const boundaryAccuracy = stats?.boundary_accuracy ?? 82;
  const bestShotName = stats?.best_shot_name ?? '斜线反手球';
  const bestShotPower = stats?.best_shot_power ?? 88;
  const bestShotSpin = stats?.best_shot_spin ?? 92;
  const totalShots = stats?.total_rally_shots ?? 1240;
  const season = stats?.season ?? '24年夏季';
  const playerRank = stats?.player_rank ?? 'A-精英级';

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface pb-32">
      <TopAppBar />

      <main className="pt-24 px-6 max-w-7xl mx-auto space-y-10">
        <section className="flex flex-col md:flex-row justify-between items-end gap-6 border-b border-outline-variant/10 pb-10">
          <div className="space-y-2">
            <span className="text-primary-container font-headline uppercase tracking-[0.2em] text-xs font-bold">运动表现分析</span>
            <h1 className="text-5xl md:text-7xl font-headline font-black tracking-tight text-white uppercase">性能看板</h1>
          </div>
          <div className="flex gap-4">
            <div className="px-6 py-3 bg-surface-container-low rounded-lg text-right">
              <p className="text-on-surface-variant text-[10px] uppercase tracking-widest">夏季赛季</p>
              <p className="text-white font-headline font-bold">{season}</p>
            </div>
            <div className="px-6 py-3 bg-primary-container rounded-lg text-right">
              <p className="text-on-primary-container text-[10px] uppercase tracking-widest font-bold">球员等级</p>
              <p className="text-on-primary font-headline font-bold">{playerRank}</p>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="md:col-span-8 bg-surface-container-low rounded-xl overflow-hidden relative group"
          >
            <div className="p-8 pb-0">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-headline font-bold text-white tracking-tight">击球区域</h2>
                  <p className="text-on-surface-variant text-sm">AI 映射的 {totalShots.toLocaleString()} 次对攻落点分布</p>
                </div>
                <ChartIcon className="text-primary w-8 h-8" />
              </div>
            </div>
            <div className="relative w-full aspect-[16/9] px-10 pb-10">
              <div className="w-full h-full border-2 border-outline-variant/30 relative flex items-center justify-center">
                <div className="absolute inset-x-8 inset-y-0 border-x border-outline-variant/20" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-outline-variant/50" />
                <div className="absolute inset-x-0 top-[20%] h-px bg-outline-variant/20" />
                <div className="absolute inset-x-0 bottom-[20%] h-px bg-outline-variant/20" />
                <div className="absolute top-1/4 right-1/4 w-32 h-32 bg-primary/20 blur-[40px] rounded-full animate-pulse" />
                <div className="absolute top-1/2 right-[15%] w-48 h-48 bg-primary/30 blur-[60px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute bottom-1/4 left-1/4 w-24 h-24 bg-primary/10 blur-[30px] rounded-full opacity-60" />
                <div className="absolute top-[15%] right-[10%] bg-surface-container-highest/80 backdrop-blur px-3 py-1 rounded-lg border border-primary/20">
                  <span className="text-[10px] font-bold text-primary-container">优势区域 (42%)</span>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="md:col-span-4 space-y-6">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-surface-container p-8 rounded-xl border-l-4 border-primary"
            >
              <p className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold mb-1">胜率</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-headline font-black text-white">{Math.round(winRate)}</span>
                <span className="text-2xl font-headline font-bold text-primary">%</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-primary-container">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs font-bold">自5月以来提升 +4.2%</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-surface-container p-8 rounded-xl"
            >
              <p className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold mb-1">边界准确率</p>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-headline font-black text-white">{Math.round(boundaryAccuracy)}</span>
                <span className="text-2xl font-headline font-bold text-primary">%</span>
              </div>
              <div className="mt-4 h-1 w-full bg-surface-variant rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${boundaryAccuracy}%` }} />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-surface-container-highest p-8 rounded-xl flex flex-col justify-between aspect-square md:aspect-auto"
            >
              <div>
                <Verified className="text-primary w-6 h-6 mb-4 fill-primary/20" />
                <p className="text-on-surface-variant text-xs uppercase tracking-[0.2em] font-bold mb-1">招牌动作</p>
                <h3 className="text-2xl font-headline font-bold text-white leading-tight">{bestShotName.replace(/(.{2})/, '$1\n')}</h3>
              </div>
              <div className="mt-6 flex gap-2">
                <span className="px-3 py-1 bg-surface/40 rounded-lg text-[10px] font-bold border border-outline-variant/10">力量: {bestShotPower}</span>
                <span className="px-3 py-1 bg-surface/40 rounded-lg text-[10px] font-bold border border-outline-variant/10">旋转: {bestShotSpin}</span>
              </div>
            </motion.div>
          </div>
        </div>

        <section className="bg-surface-container-low p-8 rounded-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
            <div>
              <h2 className="text-2xl font-headline font-bold text-white tracking-tight">准确率趋势</h2>
              <p className="text-on-surface-variant text-sm">最近 10 场比赛的精度追踪</p>
            </div>
            <div className="flex gap-4">
              {(['正手', '综合', '反手'] as TrendFilter[]).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveTrend(filter)}
                  className={cn(
                    "px-4 py-2 text-xs font-bold transition-all rounded-lg border",
                    activeTrend === filter
                      ? "text-primary bg-primary/10 border-primary/20"
                      : "text-on-surface-variant bg-surface-container border-outline-variant/20 hover:text-white"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full relative flex items-end justify-between gap-1">
            <div className="absolute inset-0 flex flex-col justify-between py-2 pointer-events-none">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-full h-px bg-outline-variant/10" />
              ))}
            </div>
            {trendData[activeTrend].map((height, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end group">
                <motion.div
                  key={`${activeTrend}-${i}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    "w-full rounded-t-sm transition-colors",
                    i === trendData[activeTrend].length - 1 ? "bg-primary" : "bg-primary/20 group-hover:bg-primary/40"
                  )}
                />
                <span className={cn(
                  "text-[10px] mt-3 text-center",
                  i === trendData[activeTrend].length - 1 ? "text-primary font-bold" : "text-on-surface-variant"
                )}>
                  {i === trendData[activeTrend].length - 1 ? "实时" : `M0${i + 1}`}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <BottomNavBar />
    </div>
  );
}
