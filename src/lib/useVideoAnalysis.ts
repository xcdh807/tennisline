import { useState, useEffect, useRef, useCallback } from 'react';

export interface AnalysisData {
  speed: number;         // KM/H
  rpm: number;           // rotations per minute
  rally: number;         // rally count
  netHeight: number;     // CM above net
  judgment: 'in' | 'out' | 'net' | null;
  marginMm: number;      // edge margin in mm
  shotType: string;      // forehand / backhand / serve
  accuracy: number;      // 0-100%
  isAnalyzing: boolean;
}

const SHOT_TYPES = ['正手抽球', '反手切球', '正手上旋', '反手平击', '发球ACE', '截击', '高压扣杀', '放小球'];
const JUDGMENTS: ('in' | 'out' | 'net')[] = ['in', 'in', 'in', 'in', 'in', 'out', 'net'];

function rand(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function randFloat(min: number, max: number, decimals = 1) {
  return parseFloat((min + Math.random() * (max - min)).toFixed(decimals));
}

export function useVideoAnalysis(active: boolean, intervalMs = 2000) {
  const [data, setData] = useState<AnalysisData>({
    speed: 0, rpm: 0, rally: 0, netHeight: 0,
    judgment: null, marginMm: 0, shotType: '', accuracy: 0,
    isAnalyzing: false,
  });

  const rallyRef = useRef(0);
  const shotCountRef = useRef(0);
  const inCountRef = useRef(0);

  const reset = useCallback(() => {
    rallyRef.current = 0;
    shotCountRef.current = 0;
    inCountRef.current = 0;
    setData({
      speed: 0, rpm: 0, rally: 0, netHeight: 0,
      judgment: null, marginMm: 0, shotType: '', accuracy: 0,
      isAnalyzing: false,
    });
  }, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    setData(prev => ({ ...prev, isAnalyzing: true }));

    // Initial delay before first analysis result
    const startTimeout = setTimeout(() => {
      const interval = setInterval(() => {
        // Simulate detecting a shot
        const detected = Math.random() > 0.15; // 85% chance of detecting a shot each tick
        if (!detected) return;

        shotCountRef.current += 1;
        // Occasionally increment rally
        if (Math.random() > 0.4) {
          rallyRef.current += 1;
        }

        const judgment = JUDGMENTS[rand(0, JUDGMENTS.length - 1)];
        if (judgment === 'in') inCountRef.current += 1;

        const accuracy = shotCountRef.current > 0
          ? Math.round((inCountRef.current / shotCountRef.current) * 100)
          : 0;

        setData({
          speed: rand(120, 210),
          rpm: rand(1200, 3200),
          rally: rallyRef.current,
          netHeight: rand(5, 45),
          judgment,
          marginMm: randFloat(0.1, 8.0),
          shotType: SHOT_TYPES[rand(0, SHOT_TYPES.length - 1)],
          accuracy,
          isAnalyzing: true,
        });
      }, intervalMs);

      return () => clearInterval(interval);
    }, 800);

    return () => clearTimeout(startTimeout);
  }, [active, intervalMs]);

  return { data, reset };
}
