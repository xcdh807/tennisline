import { Play, Map as MapIcon, MapPin, Bolt, Share2, ChevronRight } from 'lucide-react';
import { TopAppBar } from '@/src/components/TopAppBar';
import { BottomNavBar } from '@/src/components/BottomNavBar';
import { cn } from '@/src/lib/utils';
import { useState, useEffect } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMatchSessions } from '@/src/lib/api';

type FilterType = '全部' | '比赛' | '训练' | '高光';

export function HistoryPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>('全部');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getMatchSessions(user.id, activeFilter === '全部' ? undefined : activeFilter)
      .then(data => setSessions(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, activeFilter]);

  const typeLabel = (type: string) => {
    const map: Record<string, string> = { match: '比赛', training: '训练', highlight: '高光' };
    return map[type] || type;
  };

  return (
    <div className="min-h-screen bg-surface pb-32">
      <TopAppBar title="历史记录" />

      <main className="pt-24 px-6 max-w-4xl mx-auto">
        <section className="flex gap-3 overflow-x-auto pb-8 no-scrollbar">
          {(['全部', '比赛', '训练', '高光'] as FilterType[]).map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-5 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all border",
                activeFilter === filter
                  ? "bg-primary-container text-on-primary-container border-primary shadow-lg shadow-primary-container/10"
                  : "bg-surface-container-high text-on-surface-variant border-outline-variant/10 hover:bg-surface-bright"
              )}
            >
              {filter}
            </button>
          ))}
        </section>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            <p className="text-lg font-headline font-bold mb-2">暂无记录</p>
            <p className="text-sm">去录制你的第一场比赛吧！</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sessions.map((item) => (
              <div key={item.id} className="group relative bg-surface-container rounded-xl overflow-hidden flex flex-col md:flex-row gap-0 transition-all hover:bg-surface-container-high">
                <div className="relative w-full md:w-64 h-48 md:h-auto overflow-hidden">
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    src={item.thumbnail || 'https://placehold.co/400x300/001a34/ddffb0?text=TennisLine'}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-surface-container-lowest/40 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-2xl">
                      <Play className="w-6 h-6 fill-on-primary" />
                    </div>
                  </div>
                  {item.type === 'match' && (
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded px-2 py-1 flex items-center gap-1">
                      <MapIcon className="w-3.5 h-3.5 text-white" />
                      <span className="text-[10px] text-white font-medium">查看热图</span>
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-widest uppercase",
                          item.type === 'training' ? "bg-primary/10 text-primary" :
                          item.type === 'match' ? "bg-tertiary/10 text-tertiary" :
                          "bg-secondary/10 text-secondary"
                        )}>
                          {typeLabel(item.type)}
                        </span>
                        <span className="text-on-surface-variant text-xs">{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-headline text-xl font-bold text-on-surface">{item.title}</h3>
                    </div>
                    {item.accuracy && !item.result && (
                      <div className="text-right">
                        <div className="text-[10px] text-on-surface-variant uppercase tracking-tighter">准确率</div>
                        <div className="font-headline text-2xl font-bold text-primary">{item.accuracy}%</div>
                      </div>
                    )}
                    {item.result && (
                      <div className="flex flex-col items-end">
                        <span className="px-2 py-1 rounded bg-primary-container text-on-primary font-black text-[10px] italic skew-x-[-10deg] mb-2 uppercase">
                          {item.result === 'victory' ? 'VICTORY' : 'DEFEAT'}
                        </span>
                        {item.accuracy && (
                          <>
                            <div className="text-[10px] text-on-surface-variant uppercase tracking-tighter">本场胜率</div>
                            <div className="font-headline text-2xl font-bold text-primary">{item.accuracy}%</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {item.type !== 'highlight' ? (
                    <div className={cn(
                      "rounded-lg p-3 flex justify-between items-center mb-4",
                      item.type === 'match' ? "bg-surface-container-low" : "border-y border-outline-variant/10"
                    )}>
                      {item.type === 'training' ? (
                        <>
                          <div className="flex flex-col">
                            <span className="text-xs text-on-surface-variant mb-1">总击球</span>
                            <span className="font-headline font-bold">{item.shots} <span className="text-[10px] font-normal text-on-surface-variant">SHOTS</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-on-surface-variant mb-1">场地位置</span>
                            <span className="text-xs font-medium flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {item.location}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-3">
                            <div className="text-center">
                              <div className="text-[10px] text-on-surface-variant">我</div>
                              <div className="font-headline font-bold text-primary text-lg leading-none">{item.score_me}</div>
                            </div>
                            <div className="w-px h-6 bg-outline-variant/30" />
                            <div className="text-center">
                              <div className="text-[10px] text-on-surface-variant">对手</div>
                              <div className="font-headline font-bold text-on-surface-variant text-lg leading-none">{item.score_opponent}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[10px] text-on-surface-variant">赛场</div>
                            <div className="text-xs font-medium">{item.location}</div>
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-6 py-4 border-y border-outline-variant/10">
                      <div className="flex flex-col">
                        <span className="text-xs text-on-surface-variant mb-1">最高球速</span>
                        <span className="font-headline font-bold text-primary text-lg">{item.speed} <span className="text-[10px] font-normal text-on-surface-variant">KM/H</span></span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-on-surface-variant mb-1">转速</span>
                        <span className="font-headline font-bold text-on-surface text-lg">{item.rpm} <span className="text-[10px] font-normal text-on-surface-variant">RPM</span></span>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bolt className="w-4 h-4 text-primary" />
                      <span className="text-[11px] text-on-surface-variant font-medium">
                        {item.type === 'highlight' ? '自动剪辑已就绪' : '提升排名 +12 pts'}
                      </span>
                    </div>
                    <button className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                      {item.type === 'highlight' ? <Share2 className="w-4 h-4" /> : '详细战报'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <BottomNavBar />
    </div>
  );
}
