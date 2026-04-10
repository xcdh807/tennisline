import { Hand, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import React, { useState } from 'react';
import { ExperienceLevel, Handedness } from '@/src/types';
import { cn } from '@/src/lib/utils';
import { useAuth } from '@/src/contexts/AuthContext';
import { updateProfile } from '@/src/lib/api';
import { seedDefaultData } from '@/src/lib/api';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [experience, setExperience] = useState<ExperienceLevel>('beginner');
  const [handedness, setHandedness] = useState<Handedness>('right');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    try {
      await updateProfile(user.id, { nickname, experience, handedness });
      await seedDefaultData(user.id);
      navigate('/dashboard');
    } catch (err) {
      console.error('Failed to save profile:', err);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface relative overflow-hidden">
      <header className="relative z-50 flex items-center justify-between px-6 py-4 w-full">
        <span className="text-xl font-headline font-bold tracking-tighter text-primary">TennisLine</span>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-[10px] font-bold tracking-[0.2em] text-on-surface-variant uppercase">Network: Connected</span>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-12 relative z-10">
        <div className="max-w-xl w-full space-y-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-left space-y-4"
          >
            <h1 className="text-5xl md:text-6xl font-headline font-bold text-on-surface leading-tight tracking-tighter">
              完善你的<br/>
              <span className="text-primary italic">竞技画像</span>
            </h1>
            <p className="text-on-surface-variant font-body max-w-md leading-relaxed">
              为了提供精准的 AI 运动表现分析，我们需要了解您的基础生理参数与网球等级。
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="group">
              <label className="block text-[10px] font-bold tracking-[0.15em] text-primary uppercase mb-3">球场昵称 / Nickname</label>
              <div className="relative">
                <input
                  className="w-full bg-surface-container-highest border-none text-on-surface p-4 rounded-lg focus:ring-0 focus:outline-none transition-all placeholder:text-outline/50 font-medium"
                  placeholder="输入您的球员代号"
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
                <div className="absolute bottom-0 left-0 h-[2px] w-0 bg-primary transition-all duration-300 group-focus-within:w-full" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] text-primary uppercase mb-4">网球等级 / Experience</label>
              <div className="grid grid-cols-3 gap-3">
                {(['beginner', 'intermediate', 'pro'] as ExperienceLevel[]).map((level) => (
                  <label key={level} className="relative cursor-pointer group">
                    <input
                      type="radio"
                      name="experience"
                      className="peer sr-only"
                      checked={experience === level}
                      onChange={() => setExperience(level)}
                    />
                    <div className="p-4 rounded-lg bg-surface-container-low border border-outline-variant/15 text-center transition-all peer-checked:bg-primary peer-checked:text-on-primary group-hover:bg-surface-container-high">
                      <span className="block text-sm font-bold font-headline">
                        {level === 'beginner' ? '初学者' : level === 'intermediate' ? '中级球员' : '专业级'}
                      </span>
                      <span className="text-[9px] opacity-60 font-medium tracking-tighter uppercase">{level}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold tracking-[0.15em] text-primary uppercase mb-4">常用手 / Handedness</label>
              <div className="flex gap-4">
                {(['right', 'left'] as Handedness[]).map((hand) => (
                  <label key={hand} className="flex-1 relative cursor-pointer group">
                    <input
                      type="radio"
                      name="handedness"
                      className="peer sr-only"
                      checked={handedness === hand}
                      onChange={() => setHandedness(hand)}
                    />
                    <div className="flex items-center gap-4 p-5 rounded-lg bg-surface-container border border-outline-variant/10 transition-all peer-checked:bg-surface-bright peer-checked:ring-1 peer-checked:ring-primary/30">
                      <Hand className={cn("w-6 h-6 text-primary", hand === 'left' && "scale-x-[-1]")} />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{hand === 'right' ? '右手球员' : '左手球员'}</span>
                        <span className="text-[9px] text-on-surface-variant font-medium tracking-widest uppercase">{hand} Handed</span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 rounded-lg bg-gradient-to-br from-primary to-primary-container text-on-primary font-bold text-lg tracking-tight hover:opacity-90 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>开启网球智慧之旅</span>
                  <ArrowRight className="w-5 h-5 font-bold" />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-tertiary/5 rounded-full blur-[100px] pointer-events-none" />
    </div>
  );
}
