import { supabase } from './supabase';
import type { ExperienceLevel, Handedness } from '@/src/types';

// ---- Profile ----
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(userId: string, updates: {
  nickname?: string;
  experience?: ExperienceLevel;
  handedness?: Handedness;
  avatar_url?: string;
}) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Match Sessions ----
export async function getMatchSessions(userId: string, type?: string) {
  let query = supabase
    .from('match_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (type && type !== 'all') {
    const typeMap: Record<string, string> = { '比赛': 'match', '训练': 'training', '高光': 'highlight' };
    query = query.eq('type', typeMap[type] || type);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createMatchSession(session: {
  user_id: string;
  type: 'match' | 'training' | 'highlight';
  title: string;
  accuracy?: number;
  shots?: number;
  location?: string;
  result?: 'victory' | 'defeat';
  score_me?: number;
  score_opponent?: number;
  speed?: number;
  rpm?: number;
  thumbnail?: string;
  video_url?: string;
}) {
  const { data, error } = await supabase
    .from('match_sessions')
    .insert(session)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteMatchSession(sessionId: string, videoUrl?: string) {
  // Delete video from storage if exists
  if (videoUrl) {
    try {
      const url = new URL(videoUrl);
      // Extract path after /object/public/videos/
      const match = url.pathname.match(/\/object\/public\/videos\/(.+)/);
      if (match) {
        await supabase.storage.from('videos').remove([decodeURIComponent(match[1])]);
      }
    } catch {
      // Ignore storage deletion errors
    }
  }
  const { error } = await supabase
    .from('match_sessions')
    .delete()
    .eq('id', sessionId);
  if (error) throw error;
}

// ---- Performance Stats ----
export async function getPerformanceStats(userId: string) {
  const { data, error } = await supabase
    .from('performance_stats')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertPerformanceStats(userId: string, stats: {
  win_rate?: number;
  boundary_accuracy?: number;
  best_shot_name?: string;
  best_shot_power?: number;
  best_shot_spin?: number;
  total_rally_shots?: number;
  forehand_trend?: number[];
  overall_trend?: number[];
  backhand_trend?: number[];
  season?: string;
  player_rank?: string;
}) {
  const { data, error } = await supabase
    .from('performance_stats')
    .upsert({
      user_id: userId,
      ...stats,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Training Progress ----
export async function getTrainingProgress(userId: string) {
  const { data, error } = await supabase
    .from('training_progress')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertTrainingProgress(userId: string, progress: {
  week_accuracy?: number;
  accuracy_change?: number;
  avg_response_ms?: number;
  total_hours?: number;
  percentile?: number;
}) {
  const { data, error } = await supabase
    .from('training_progress')
    .upsert({
      user_id: userId,
      ...progress,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ---- Seed default data for a new user ----
export async function seedDefaultData(userId: string) {
  // Seed performance stats
  await supabase.from('performance_stats').upsert({
    user_id: userId,
    win_rate: 64,
    boundary_accuracy: 82,
    best_shot_name: '斜线反手球',
    best_shot_power: 88,
    best_shot_spin: 92,
    total_rally_shots: 1240,
    forehand_trend: [55, 60, 50, 65, 78, 70, 85, 75, 88, 92],
    overall_trend: [60, 65, 55, 70, 82, 75, 88, 78, 91, 94],
    backhand_trend: [65, 70, 60, 75, 85, 80, 92, 82, 94, 96],
    season: '24年夏季',
    player_rank: 'A-精英级',
  });

  // Seed training progress
  await supabase.from('training_progress').upsert({
    user_id: userId,
    week_accuracy: 94.8,
    accuracy_change: 2.3,
    avg_response_ms: 320,
    total_hours: 14.5,
    percentile: 85,
  });

  // Seed match sessions
  const sessions = [
    {
      user_id: userId,
      type: 'training',
      title: '晚间练习',
      date: '2024-05-20T19:00:00Z',
      accuracy: 88,
      shots: 32,
      location: '中心球场',
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAg1nI9vOJUTev4vKLUcNQtYqcaFilZdbiWJkBUkp32qnTD3Jv39AZMBq5tWJJt2On4F8O374HSTG5wyRfn5ppWJsXsx6C1Nrt82f_TW6UOMiPUXIl4f4iF0OsR2WvmGYqB71bDq1aRQY5omtthj5zYP1sbZgJfzQzfuk6uDuie5pTLUol1V6FZ9RZIYJN2sl9NOtOxo-YHAFQkuzw0-eVqL06TEq7r9zOAF3wgskBRUFwGCNhwn3H_W9o-mjDLMcWC5VPpDtX7Od0',
    },
    {
      user_id: userId,
      type: 'match',
      title: '周末比赛',
      date: '2024-05-18T14:00:00Z',
      accuracy: 64,
      location: '朝阳公园网球场',
      result: 'victory',
      score_me: 6,
      score_opponent: 4,
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAnI8478j0md-Wz1YIUqVZzBAoae2hWq6Q2YP3cEpEFJEnE4PxB9khz7ysEpYqRe5gvXPwwwkkVNBCx6xJnq7La2qJevlJG5IuXg9JflKGpApCI980g0Rh8DwL5aj5qKWeooWDC4hlaoppn1igrCR8lKzKDztprYDdK9daNtoetQNpD1YkZOG42SMwB4Jt5iVILJpPWrnOIBgPshkUVrni3xXZPg9jJwtHXzh1wLTmMSOz4nyOjZrHXllyC6hVz9fy18EfXn9F0fH8',
    },
    {
      user_id: userId,
      type: 'highlight',
      title: 'ACE 球集锦',
      date: '2024-05-15T16:00:00Z',
      speed: 198,
      rpm: 2400,
      thumbnail: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAjoHlQlsYmlbwYi0MmF9AsQYNm0CshFW-BAr7SWmY0YKdIKw1BluxDA3KhkuRVPFKlL2q8uXDytePtzkXxMs7ztUtxxXzQ2C6aVOvBntV7pJ0drumqyGN6TqqXUvwNUd1y1P0tQSPrMP7h6I4anVuPPGFIIMQArqluv_aeVA3G52xTNlzaXN23lIeuFrtgK9YLhjZgcWTTvFyj6B8noXkw4-hx9m4-I7zQxAXlGJ-hmQSmpjZrhnc5eVbTfkzCvPxW72dMbgGZ-4k',
    },
  ];
  await supabase.from('match_sessions').insert(sessions);

  // Update profile stats
  await supabase.from('profiles').update({
    total_matches: 124,
    win_rate: 64,
    max_speed: 198,
    avg_accuracy: 82,
  }).eq('id', userId);
}

// ---- Video Upload ----
export async function uploadVideo(userId: string, blob: Blob, filename: string): Promise<string> {
  const filePath = `${userId}/${filename}`;
  const { error } = await supabase.storage
    .from('videos')
    .upload(filePath, blob, {
      contentType: blob.type || 'video/webm',
      upsert: true,
    });
  if (error) throw error;

  const { data } = supabase.storage.from('videos').getPublicUrl(filePath);
  return data.publicUrl;
}
