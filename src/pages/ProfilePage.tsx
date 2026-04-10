import { ChevronLeft, Trophy, Target, Zap, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '@/src/contexts/AuthContext';
import { getProfile } from '@/src/lib/api';
import { useState, useEffect } from 'react';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id)
      .then(data => setProfile(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  const stats = [
    { label: '总场次', value: String(profile?.total_matches ?? 124), icon: Zap },
    { label: '胜率', value: `${profile?.win_rate ?? 64}%`, icon: TrendingUp },
    { label: '最高球速', value: String(profile?.max_speed ?? 198), unit: 'KM/H', icon: Zap },
    { label: '平均准确率', value: `${profile?.avg_accuracy ?? 82}%`, icon: Target },
  ];

  const nickname = profile?.nickname || 'ELITE PLAYER';

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface pb-20">
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl flex items-center px-6 py-4 border-b border-outline-variant/10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-white/5 rounded-full transition-colors">
          <ChevronLeft className="w-6 h-6 text-on-surface" />
        </button>
        <h1 className="ml-4 text-xl font-headline font-bold text-white tracking-tight">个人资料</h1>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-10">
        <section className="flex flex-col items-center text-center space-y-4">
          <div className="relative">
            <div className="w-32 h-32 rounded-full border-4 border-primary/20 p-1">
              <img
                alt="User profile"
                className="w-full h-full rounded-full object-cover"
                src={profile?.avatar_url || "https://lh3.googleusercontent.com/aida-public/AB6AXuDPQ1mXebP2-3RvdqYRDgy9FWz2mDP8U3FryqFw49nAJhc5BiyRuoi46UHFNSKd4ZDOxEOrAc1VgrjY4N9BGRiv_J7ISgY7wgx5t6UtMQ19wNefKi1XMlUe-urrx5cXX-Ezb4buhtMp5GZgftfmYuD5Q0em8t_RweKAuFXx1MOLWfHhqK7Noo4bx-PouYLf8RptB57mRHA-UoX1vrLoabbscin61qLzj4C8Y1xIfJ4bf0nTXm1vhSpf4ZJV2hu77DtRAeBTXcPyzbQ"}
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-primary text-on-primary p-2 rounded-full shadow-lg">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-headline font-black text-white italic tracking-tighter">{nickname.toUpperCase()}</h2>
            <p className="text-on-surface-variant font-body">24年夏季赛季 · A-精英级</p>
            {user?.email && <p className="text-on-surface-variant/60 text-xs mt-1">{user.email}</p>}
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-surface-container p-6 rounded-xl border border-outline-variant/10"
            >
              <div className="flex items-center gap-2 text-on-surface-variant mb-2">
                <stat.icon className="w-4 h-4 text-primary" />
                <span className="text-[10px] uppercase tracking-widest font-bold">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-headline font-black text-white">{stat.value}</span>
                {stat.unit && <span className="text-xs text-on-surface-variant">{stat.unit}</span>}
              </div>
            </motion.div>
          ))}
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-headline font-bold text-white tracking-tight">荣誉成就</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex-shrink-0 w-24 h-24 rounded-2xl bg-surface-container-highest flex items-center justify-center border border-primary/10">
                <Trophy className="w-10 h-10 text-primary/40" />
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
