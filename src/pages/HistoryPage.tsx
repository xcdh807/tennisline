import { Play, Map as MapIcon, MapPin, Bolt, Share2, ChevronRight, X, Video, Trash2 } from 'lucide-react';
import { TopAppBar } from '@/src/components/TopAppBar';
import { BottomNavBar } from '@/src/components/BottomNavBar';
import { cn } from '@/src/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import { getMatchSessions, deleteMatchSession } from '@/src/lib/api';
import { motion, AnimatePresence } from 'motion/react';

type FilterType = '全部' | '比赛' | '训练' | '高光';

export function HistoryPage() {
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<FilterType>('全部');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const playerRef = useRef<HTMLVideoElement>(null);

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

  const handlePlayClick = (item: any) => {
    if (item.video_url) {
      setPlayingVideo(item.video_url);
    }
  };

  const closePlayer = () => {
    if (playerRef.current) {
      playerRef.current.pause();
    }
    setPlayingVideo(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMatchSession(deleteTarget.id, deleteTarget.video_url || undefined);
      setSessions(prev => prev.filter(s => s.id !== deleteTarget.id));
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-32">
      <TopAppBar title="历史记录" />

      {/* Video Player Modal */}
      <AnimatePresence>
        {playingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-3 bg-black/80">
              <span className="text-white font-headline font-bold text-lg">视频回放</span>
              <button
                onClick={closePlayer}
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors active:scale-90"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <video
                ref={playerRef}
                src={playingVideo}
                className="w-full h-full object-contain"
                controls
                autoPlay
                playsInline
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center px-6"
            onClick={() => !deleting && setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface-container rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-outline-variant/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-error" />
                </div>
                <h3 className="font-headline text-lg font-bold text-white">删除记录</h3>
              </div>
              <p className="text-on-surface-variant text-sm mb-2">
                确定要删除 <span className="text-white font-medium">「{deleteTarget.title}」</span> 吗？
              </p>
              {deleteTarget.video_url && (
                <p className="text-on-surface-variant/60 text-xs mb-6">关联的视频文件也会被一并删除，此操作不可撤销。</p>
              )}
              {!deleteTarget.video_url && (
                <p className="text-on-surface-variant/60 text-xs mb-6">此操作不可撤销。</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-lg bg-surface-container-high text-on-surface font-bold text-sm hover:bg-surface-bright transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 h-11 rounded-lg bg-error text-white font-bold text-sm hover:bg-error/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {deleting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      删除
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                {/* Delete button - always visible, top-right of card */}
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteTarget(item); }}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-error/80 flex items-center justify-center text-white shadow-lg shadow-black/30 hover:bg-error active:scale-90 transition-all z-20"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                {/* Thumbnail / Play area */}
                <div
                  className={cn(
                    "relative w-full md:w-64 h-48 md:h-auto overflow-hidden",
                    item.video_url ? "cursor-pointer" : ""
                  )}
                  onClick={() => handlePlayClick(item)}
                >
                  {item.thumbnail ? (
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={item.thumbnail}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-surface-container-highest flex items-center justify-center">
                      <Video className="w-12 h-12 text-on-surface-variant/30" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-surface-container-lowest/40 flex items-center justify-center">
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-transform",
                      item.video_url
                        ? "bg-primary-container text-on-primary hover:scale-110"
                        : "bg-surface-container-highest/60 text-on-surface-variant/40"
                    )}>
                      <Play className="w-6 h-6 fill-current" />
                    </div>
                  </div>
                  {/* Video badge */}
                  {item.video_url && (
                    <div className="absolute top-2 left-2 bg-primary/90 backdrop-blur-md rounded px-2 py-0.5 flex items-center gap-1">
                      <Video className="w-3 h-3 text-on-primary" />
                      <span className="text-[9px] text-on-primary font-bold">可播放</span>
                    </div>
                  )}
                  {!item.video_url && (
                    <div className="absolute top-2 left-2 bg-surface-container-highest/70 backdrop-blur-md rounded px-2 py-0.5">
                      <span className="text-[9px] text-on-surface-variant font-medium">无视频</span>
                    </div>
                  )}
                  {item.type === 'match' && (
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md rounded px-2 py-1 flex items-center gap-1">
                      <MapIcon className="w-3.5 h-3.5 text-white" />
                      <span className="text-[10px] text-white font-medium">查看热图</span>
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-4 pr-6">
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
                            <span className="font-headline font-bold">{item.shots || 0} <span className="text-[10px] font-normal text-on-surface-variant">SHOTS</span></span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs text-on-surface-variant mb-1">场地位置</span>
                            <span className="text-xs font-medium flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5" />
                              {item.location || '--'}
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
                        {item.video_url ? '视频已保存' : item.type === 'highlight' ? '自动剪辑已就绪' : '提升排名 +12 pts'}
                      </span>
                    </div>
                    {item.video_url ? (
                      <button
                        onClick={() => handlePlayClick(item)}
                        className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                      >
                        播放视频
                        <Play className="w-4 h-4 fill-primary" />
                      </button>
                    ) : (
                      <button className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                        {item.type === 'highlight' ? <Share2 className="w-4 h-4" /> : '详细战报'}
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
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
