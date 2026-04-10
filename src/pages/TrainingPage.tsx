import { Play, Pause, ChevronRight, Clock, Eye, TrendingUp, Bolt, X, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { TopAppBar } from '@/src/components/TopAppBar';
import { BottomNavBar } from '@/src/components/BottomNavBar';
import { useAuth } from '@/src/contexts/AuthContext';
import { getTrainingProgress } from '@/src/lib/api';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const TRAINING_VIDEOS = [
  {
    id: 'v1',
    title: '如何捕捉 "擦边球" 瞬间',
    duration: '12:45',
    views: '2.4k',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCUDxAqjE_bVoVrPcCZs5qPUZBCatiDwtGk-oWBv23T8l6P5F6kbUS_DZQN6BIiebP8JBAOawhWvdiidlgQxEsd2_G1CsjQeTy__J3Cip4mY2RCMEEkoI4mS9Scg3RUG68eLo3GKwf3Un0zhb0s2ZALCuCUwTtw95Z3M2Pcufwqf6EHnioo5Fz6Ikw6ocTCbWWcK1iTeNS8eq8Rt8beONs-5vUWKP0dD-LzE7KTpRTYS0h5gF4m1lPu3YzE9b7B-4xuyL-yUZ2ioog',
    description: '通过高速摄像分析，掌握判断擦边球的核心技巧。学习如何在比赛中快速识别球的落点，提升临场判断能力。',
    chapters: ['网球落点基础知识 (0:00)', '高速摄像回放分析 (3:20)', '擦边球识别技巧 (6:45)', '实战练习指南 (10:00)'],
  },
  {
    id: 'v2',
    title: '职业视角：底线判罚心理学',
    duration: '08:30',
    views: '1.8k',
    thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuB7U4N863nMvhBPPomX6JjBEb7BDWLJPnPCZ3XRVnF-9EodutyME02zP5jBr4bJhwUzwQxl0qLUihe9eEqFyOAK5FxiQKHv83crrFE7UDfvpuJMvlPQLt1mPPgvXSDNCXuaCufgpF8yednaz03uottkEVFsVTW7x4peDJihFEe3XKhTSAWChoOoTk9zWir3TcoeKisZePAsd_tmFiALN9yyme3CqqDW9dI48XGb7qJdriU4et6o6zSvWszVUbrrdKgR88rUv_GPFCY',
    description: '深入了解职业裁判的判罚思维，学习底线球判断中的心理学因素。包含多场大满贯经典案例的分析。',
    chapters: ['判罚心理学入门 (0:00)', '大满贯案例分析 (2:30)', '视觉盲区与误判 (5:15)', '训练你的判断力 (7:00)'],
  },
];

export function TrainingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [progress, setProgress] = useState<any>(null);
  const [showRules, setShowRules] = useState(false);
  const [activeVideo, setActiveVideo] = useState<typeof TRAINING_VIDEOS[0] | null>(null);
  const [showAllVideos, setShowAllVideos] = useState(false);

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

      {/* Rules Modal */}
      <AnimatePresence>
        {showRules && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => setShowRules(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container rounded-2xl p-6 max-w-md w-full shadow-2xl border border-outline-variant/10 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-headline text-lg font-bold text-white">边界挑战规则</h3>
                </div>
                <button onClick={() => setShowRules(false)} className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center hover:bg-surface-bright"><X className="w-4 h-4 text-on-surface-variant" /></button>
              </div>
              <div className="space-y-4 text-sm text-on-surface-variant">
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <h4 className="font-bold text-white mb-2">🎯 游戏目标</h4>
                  <p>在 AI 实时回放中，快速判断网球是否落在界内。提升你的视觉预判能力和反应速度。</p>
                </div>
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <h4 className="font-bold text-white mb-2">📋 规则说明</h4>
                  <ul className="space-y-2 list-disc pl-4">
                    <li>每轮展示 10 个网球落点回放</li>
                    <li>你需要在 <span className="text-primary font-bold">500ms</span> 内判断「界内」或「出界」</li>
                    <li>正确判断得 10 分，错误扣 5 分</li>
                    <li>连续正确 3 次获得 <span className="text-primary font-bold">2x</span> 倍率加成</li>
                    <li>最终根据得分和平均响应时间计算排名</li>
                  </ul>
                </div>
                <div className="bg-surface-container-low p-4 rounded-xl">
                  <h4 className="font-bold text-white mb-2">🏆 等级标准</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-surface-container p-2 rounded-lg text-center"><span className="text-primary font-bold block">S 级</span>95%+ 准确率</div>
                    <div className="bg-surface-container p-2 rounded-lg text-center"><span className="text-white font-bold block">A 级</span>85-94% 准确率</div>
                    <div className="bg-surface-container p-2 rounded-lg text-center"><span className="text-on-surface-variant font-bold block">B 级</span>70-84% 准确率</div>
                    <div className="bg-surface-container p-2 rounded-lg text-center"><span className="text-on-surface-variant/60 font-bold block">C 级</span>70% 以下</div>
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowRules(false); navigate('/record'); }} className="w-full mt-6 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
                <Play className="w-4 h-4 fill-on-primary" /> 开始挑战
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video Detail Modal */}
      <AnimatePresence>
        {activeVideo && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center"
            onClick={() => setActiveVideo(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 100, opacity: 0 }}
              className="bg-surface-container rounded-t-2xl md:rounded-2xl w-full max-w-lg shadow-2xl border border-outline-variant/10 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Video thumbnail as player placeholder */}
              <div className="relative aspect-video">
                <img src={activeVideo.thumbnail} className="w-full h-full object-cover rounded-t-2xl" referrerPolicy="no-referrer" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center rounded-t-2xl">
                  <div className="w-16 h-16 bg-primary/90 text-on-primary rounded-full flex items-center justify-center shadow-2xl">
                    <Play className="w-8 h-8 fill-on-primary ml-1" />
                  </div>
                </div>
                <button onClick={() => setActiveVideo(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white"><X className="w-4 h-4" /></button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <h3 className="font-headline text-xl font-bold text-white mb-1">{activeVideo.title}</h3>
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {activeVideo.duration}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {activeVideo.views} 次播放</span>
                  </div>
                </div>

                <p className="text-sm text-on-surface-variant leading-relaxed">{activeVideo.description}</p>

                <div>
                  <h4 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-2">章节目录</h4>
                  <div className="space-y-1">
                    {activeVideo.chapters.map((ch, i) => (
                      <button key={i} className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-3 text-sm">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                        <span className="text-on-surface">{ch}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setActiveVideo(null); navigate('/record'); }} className="flex-1 py-3 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all">
                    <Play className="w-4 h-4 fill-on-primary" /> 开始练习
                  </button>
                  <button onClick={() => setActiveVideo(null)} className="px-6 py-3 rounded-lg bg-surface-container-high text-on-surface-variant font-bold text-sm active:scale-95 transition-all">
                    关闭
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pt-20 px-6 max-w-5xl mx-auto space-y-10">
        {/* Hero: Boundary Challenge */}
        <section className="relative h-[420px] rounded-xl overflow-hidden group">
          <div className="absolute inset-0 z-0">
            <img alt="Tennis Court Boundary" className="w-full h-full object-cover brightness-[0.4] scale-105 group-hover:scale-100 transition-transform duration-700" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD8YNkLWP__GpDHxZoZRQDKdVIQkVqya7YHPXwMeliD4hG49IoBuKGdF1zG6jcVGTMsqW45_XTzQXaO0zy6pfOTttVW22NC54w769sn00q5k81sb8ORrEn-AkJqz2IyWyfUp62HRgvo7cWglZPAaVfFBdQK-tjctWms0xUfFKSRyjGSUeH6DBJqivLgx21dLa9ePikIBt-NRxqcip98sX638Y7gZVcCXPuuuEsHCnllw1Hd6ZVqevS0uLCOZLWH_T3kIP4RDi0F02s" referrerPolicy="no-referrer" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent z-10" />
          <div className="relative z-20 h-full flex flex-col justify-end p-8 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary text-on-primary text-[10px] font-bold uppercase tracking-widest rounded-sm w-fit">
              <Bolt className="w-3 h-3 fill-on-primary" /> AI 实时判定
            </div>
            <div>
              <h2 className="font-headline text-5xl font-black text-white italic tracking-tighter leading-none mb-2">边界挑战</h2>
              <p className="text-on-surface-variant font-body max-w-md">提升你的视觉预判能力。通过高精度 AI 模拟，练习在毫秒间判定网球是否出界。</p>
            </div>
            <div className="flex items-center gap-4 pt-4">
              <button onClick={() => navigate('/record')} className="px-8 py-3 bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold rounded-lg shadow-lg active:scale-95 transition-all flex items-center gap-2">
                <Play className="w-4 h-4 fill-on-primary" /> 开始挑战
              </button>
              <button onClick={() => setShowRules(true)} className="px-6 py-3 bg-surface-variant/40 backdrop-blur-xl text-primary font-medium rounded-lg border border-primary/20 hover:bg-surface-variant/60 transition-all active:scale-95">
                查看规则
              </button>
            </div>
          </div>
        </section>

        {/* Training Videos */}
        <section className="space-y-6">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <h3 className="font-headline text-2xl font-bold tracking-tight">技巧讲解</h3>
              <p className="text-on-surface-variant text-sm">专家级视频分析，拆解极限定影判罚。</p>
            </div>
            <button onClick={() => setShowAllVideos(!showAllVideos)} className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:underline active:scale-95">
              {showAllVideos ? '收起' : '全部视频'} <ChevronRight className={`w-3 h-3 transition-transform ${showAllVideos ? 'rotate-90' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TRAINING_VIDEOS.map((video) => (
              <div key={video.id} onClick={() => setActiveVideo(video)} className="bg-surface-container rounded-xl overflow-hidden hover:bg-surface-bright transition-colors cursor-pointer group active:scale-[0.98]">
                <div className="aspect-video relative overflow-hidden">
                  <img alt={video.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" src={video.thumbnail} referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                    <div className="w-12 h-12 bg-primary/90 text-on-primary rounded-full flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      <Play className="w-6 h-6 fill-on-primary ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white font-mono">{video.duration}</div>
                </div>
                <div className="p-4 space-y-2">
                  <h4 className="font-bold text-on-surface">{video.title}</h4>
                  <div className="flex items-center gap-3 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {video.duration}</span>
                    <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {video.views} 次播放</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Additional videos shown when "all" is clicked */}
          <AnimatePresence>
            {showAllVideos && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="bg-surface-container-low rounded-xl p-6 text-center space-y-3">
                  <p className="text-on-surface-variant text-sm">更多训练视频即将上线，敬请期待</p>
                  <button onClick={() => navigate('/record')} className="px-6 py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold border border-primary/20 hover:bg-primary/20 active:scale-95 transition-all">
                    先去录制练习视频
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Practice Progress */}
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
