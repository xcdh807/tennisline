export type ExperienceLevel = 'beginner' | 'intermediate' | 'pro';
export type Handedness = 'left' | 'right';

export interface UserProfile {
  nickname: string;
  experience: ExperienceLevel;
  handedness: Handedness;
}

export interface MatchSession {
  id: string;
  type: 'match' | 'training' | 'highlight';
  title: string;
  date: string;
  accuracy?: number;
  shots?: number;
  location: string;
  result?: 'victory' | 'defeat';
  score?: { me: number; opponent: number };
  stats?: {
    speed?: number;
    rpm?: number;
  };
  thumbnail: string;
}
