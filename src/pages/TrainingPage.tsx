import { Play, ChevronRight, Clock, Eye, TrendingUp, Bolt } from 'lucide-react';
import { motion } from 'motion/react';
import { TopAppBar } from '@/src/components/TopAppBar';
import { BottomNavBar } from '@/src/components/BottomNavBar';
import { useAuth } from '@/src/contexts/AuthContext';
import { getTrainingProgress } from '@/src/lib/api';
import { useState, useEffect } from 'react';

export function TrainingPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    getTrainingProgress(user.id)
      .then(data => setProgress(data))
      .catch(console.error);
  }, [user]);

  const weekAccuracy = progress?.week_accuracy ?? 94.8;
  const accuracyChange = progress?.accuracy_change ?? 2.3;
  const avgResponseMs = progress?.avg_response_ms ?? 320;
  const totalHours = progress?.total_hours ?? 14.5;
  const percentile = progress?.percentile ?? 85;

  return (
    <div className="min-h-screen bg-surface pb-32">
      <TopAppBar title="训练中心" />

      <main className="pt-20 px-6 max-w-5xl mx-auto space-y-10">
        <section className="relative h-[420px] rounded-xl overflow-hidden group">
          <div className="absolute inset-0 z-0">
            <img
              alt="Tennis Court Boundary"
              className="w-full h-full object-cover brightness-[0.4] scale-105 group-hover:scale-100 transition-transform duration-700"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8YNkLWP__GpDHxZoZRQDKdVIQkVqya7YHPXwMeliD4hG49IoBuKGdF1zG6jcVGTMsqW45_XTzQXaO0zy6pfOTttVW22NC54w769sn00q5k81sb8ORrEn-AkJqz2IyWyfUp62HRgvo7cWglZPAaVfFBdQK-tjctWms0xUfFKSRyjGSUeH6DBJqivLgx21dLa9ePikIBt-NRxqcip98sX638Y7gZVcCXPuuuEsHCnllw1Hd6ZVqevS0uLCOZLWH_T3kIP4RDi0F02s"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10" />
          <div className="relative z-20 h-full flex flex-col justify-end p-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-on-primary text-[10px] font-bold uppercase tracking-widest rounded-sm w-fit">
              <Bolt className="w-3 h-3 fill-on-primary" />
              AI 实时判定
            </div>
            <div>
              <h2 className="font-headline text-5xl font-black text-white italic tracking-tighter leading-none mb-2">边界挑战</h2>
              <p className="text-on-surface-variant font-body max-w-md">提升你的视觉预判能力。通过高精度 AI 模拟，练习在毫秒间判定网球是否出界。</p>
            </div>
            <div className="flex items-center gap-4 pt-4">
              <button className="px-8 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold rounded-lg shadow-lg active:scale-95 transition-all flex items-center gap-2">
                <Play className="w-4 h-4 fill-on-primary" />
                开始挑战
              </button>
              <button className="px-6 py-3 bg-surface-variant/40 backdrop-blur-xl text-primary font-medium rounded-lg border border-primary/20 hover:bg-surface-variant/60 transition-all">
                查看规则
              </button>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <h3 className="font-headline text-2xl font-bold tracking-tight">技巧讲解</h3>
              <p className="text-on-surface-variant text-sm">专家级视频分析，拆解极限定影判罚。</p>
            </div>
            <button className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline">
              全部视频 <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-surface-container rounded-xl overflow-hidden hover:bg-surface-bright transition-colors cursor-pointer group">
              <div className="aspect-video relative overflow-hidden">
                <img
                  alt="Tennis Analysis"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCUDxAqjE_bVoVrPcCZs5qPUZBCatiDwtGk-oWBv23T8l6P5F6kbUS_DZQN6BIiebP8JBAOawhWvdiidlgQxEsd2_G1CsjQeTy__J3Cip4mY2RCMEEkoI4mS9Scg3RUG68eLo3GKwf3Un0zhb0s2ZALCuCUwTtw95Z3M2Pcufwqf6EHnioo5Fz6Ikw6ocTCbWWcK1iTeNS8eq8Rt8beONs-5vUWKP0dD-LzE7KTpRTYS0h5gF4m1lPu3YzE9b7B-4xuyL-yUZ2ioog"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="w-12 h-12 bg-primary/90 text-on-primary rounded-full flex items-center justify-center shadow-2xl">
                    <Play className="w-6 h-6 fill-on-primary" />
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <h4 className="font-bold text-on-surface">如何捕捉 "擦边球" 瞬间</h4>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 12:45</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> 2.4k 次播放</span>
                </div>
              </div>
            </div>

            <div className="bg-surface-container rounded-xl overflow-hidden hover:bg-surface-bright transition-colors cursor-pointer group">
              <div className="aspect-video relative overflow-hidden">
                <img
                  alt="Tennis Strategy"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7U4N863nMvhBPPomX6JjBEb7BDWLJPnPCZ3XRVnF-9EodutyME02zP5jBr4bJhwUzwQxl0qLUihe9eEqFyOAK5FxiQKHv83crrFE7UDfvpuJMvlPQLt1mPPgvXSDNCXuaCufgpF8yednaz03uottkEVFsVTW7x4peDJihFEe3XKhTSAWChoOoTk9zWir3TcoeKisZePAsd_tmFiALN9yyme3CqqDW9dI48XGb7qJdriU4et6o6zSvWszVUbrrdKgR88rUv_GPFCY"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                  <div className="w-12 h-12 bg-primary/90 text-on-primary rounded-full flex items-center justify-center shadow-2xl">
                    <Play className="w-6 h-6 fill-on-primary" />
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-2">
                <h4 className="font-bold text-on-surface">职业视角：底线判罚心理学</h4>
                <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 08:30</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> 1.8k 次播放</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <h3 className="font-headline text-2xl font-bold tracking-tight">练习进度</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-surface-container-low p-6 rounded-xl border-l-4 border-primary">
              <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1 block">本周判罚准确率</span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-4xl font-black text-primary">{weekAccuracy}%</span>
                <span className="text-primary-container text-sm flex items-center"><TrendingUp className="w-4 h-4" /> +{accuracyChange}%</span>
              </div>
              <div className="mt-4 h-1 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${weekAccuracy}%` }} />
              </div>
            </div>

            <div className="bg-surface-container-low p-6 rounded-xl">
              <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1 block">平均判定响应</span>
              <div className="flex items-baseline gap-2">
                <span className="font-headline text-4xl font-black text-on-surface">{avgResponseMs}ms</span>
              </div>
              <p className="text-on-surface-variant text-xs mt-2 italic">击败了 {percentile}% 的同级别学员</p>
            </div>

            <div className="bg-surface-container-low p-6 rounded-xl relative overflow-hidden">
              <div className="relative z-10">
                <span className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1 block">挑战总时长</span>
                <div className="flex items-baseline gap-2">
                  <span className="font-headline text-4xl font-black text-on-surface">{totalHours}h</span>
                </div>
              </div>
              <div className="absolute bottom-0 right-0 left-0 h-1/2 opacity-20 flex items-end justify-between px-2 gap-1">
                {[40, 60, 30, 80, 50, 90, 75].map((h, i) => (
                  <div key={i} className="bg-primary w-full" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <BottomNavBar />
    </div>
  );
}
