import { useState, useEffect, useRef, useCallback } from 'react';

export interface AnalysisData {
  speed: number;
  rpm: number;
  rally: number;
  netHeight: number;
  judgment: 'in' | 'out' | 'net' | null;
  marginMm: number;
  shotType: string;
  accuracy: number;
  isAnalyzing: boolean;
  ballDetected: boolean;
  motionLevel: number;     // 0-100, how much motion in current frame
  ballPositions: {x: number, y: number}[]; // recent ball trail
}

const INITIAL_DATA: AnalysisData = {
  speed: 0, rpm: 0, rally: 0, netHeight: 0,
  judgment: null, marginMm: 0, shotType: '', accuracy: 0,
  isAnalyzing: false, ballDetected: false, motionLevel: 0,
  ballPositions: [],
};

// Tennis ball is typically yellow-green: HSL roughly H:50-75, S:60-100%, L:45-80%
function isTennisBallPixel(r: number, g: number, b: number): boolean {
  // Convert RGB to rough HSL
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return false;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  const rn = r / 255, gn = g / 255, bn = b / 255;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
  else if (max === gn) h = ((bn - rn) / d + 2) * 60;
  else h = ((rn - gn) / d + 4) * 60;

  // Tennis ball: bright yellow-green
  return (h >= 40 && h <= 90) && (s >= 0.3) && (l >= 0.35 && l <= 0.85);
}

interface BallCluster {
  x: number;
  y: number;
  size: number;
}

function detectBallInFrame(imageData: ImageData, width: number, height: number): BallCluster | null {
  // Sample grid (skip pixels for performance)
  const step = 4;
  const candidates: {x: number, y: number}[] = [];

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4;
      const r = imageData.data[i];
      const g = imageData.data[i + 1];
      const b = imageData.data[i + 2];
      if (isTennisBallPixel(r, g, b)) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length < 3) return null;

  // Simple clustering: find the densest region
  // Use grid-based density
  const cellSize = 30;
  const grid: Record<string, {x: number, y: number, count: number}> = {};

  for (const p of candidates) {
    const gx = Math.floor(p.x / cellSize);
    const gy = Math.floor(p.y / cellSize);
    const key = `${gx},${gy}`;
    if (!grid[key]) grid[key] = { x: 0, y: 0, count: 0 };
    grid[key].x += p.x;
    grid[key].y += p.y;
    grid[key].count += 1;
  }

  let best: BallCluster | null = null;
  for (const cell of Object.values(grid)) {
    // Ball should be a compact cluster, not a huge area (like court surface)
    if (cell.count >= 3 && cell.count <= 200) {
      if (!best || cell.count > best.size) {
        best = {
          x: cell.x / cell.count,
          y: cell.y / cell.count,
          size: cell.count,
        };
      }
    }
  }

  return best;
}

function computeMotionLevel(prev: ImageData | null, curr: ImageData, width: number, height: number): number {
  if (!prev) return 0;
  let diff = 0;
  const step = 8;
  let samples = 0;
  for (let i = 0; i < width * height * 4; i += step * 4) {
    const dr = Math.abs(curr.data[i] - prev.data[i]);
    const dg = Math.abs(curr.data[i + 1] - prev.data[i + 1]);
    const db = Math.abs(curr.data[i + 2] - prev.data[i + 2]);
    diff += (dr + dg + db) / 3;
    samples++;
  }
  return Math.min(100, Math.round((diff / samples) / 2.55 * 4));
}

function estimateSpeed(positions: {x: number, y: number}[], frameDeltaMs: number): number {
  if (positions.length < 2) return 0;
  const p1 = positions[positions.length - 2];
  const p2 = positions[positions.length - 1];
  const pixelDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  // Rough mapping: assume 640px width ≈ 24m court width
  const meterPerPixel = 24 / 640;
  const meters = pixelDist * meterPerPixel;
  const seconds = frameDeltaMs / 1000;
  if (seconds <= 0) return 0;
  const mps = meters / seconds;
  const kmh = mps * 3.6;
  return Math.min(250, Math.round(kmh));
}

function estimateShotType(positions: {x: number, y: number}[]): string {
  if (positions.length < 3) return '';
  const last3 = positions.slice(-3);
  const dx = last3[2].x - last3[0].x;
  const dy = last3[2].y - last3[0].y;
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (Math.abs(dy) > 80 && dy < 0) return '发球';
  if (dx > 30 && Math.abs(angle) < 30) return '正手平击';
  if (dx < -30 && Math.abs(angle) < 30) return '反手平击';
  if (dy < -20 && Math.abs(dx) > 20) return dx > 0 ? '正手上旋' : '反手切球';
  if (Math.abs(dx) < 15 && Math.abs(dy) < 15) return '放小球';
  return dx > 0 ? '正手抽球' : '反手抽球';
}

function estimateNetHeight(ballY: number, frameHeight: number): number {
  // Assume net is roughly at vertical center of frame
  const netY = frameHeight * 0.5;
  const distFromNet = Math.abs(ballY - netY);
  // Map pixel distance to cm (rough estimate)
  const cmPerPixel = 100 / frameHeight;
  return Math.round(Math.max(0, 45 - distFromNet * cmPerPixel));
}

export function useVideoAnalysis(
  active: boolean,
  videoElement: HTMLVideoElement | null,
  intervalMs = 300,
) {
  const [data, setData] = useState<AnalysisData>({ ...INITIAL_DATA });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const positionsRef = useRef<{x: number, y: number}[]>([]);
  const rallyRef = useRef(0);
  const shotCountRef = useRef(0);
  const inCountRef = useRef(0);
  const lastBallTimeRef = useRef(0);
  const noBallFramesRef = useRef(0);
  const lastJudgmentRef = useRef<'in' | 'out' | 'net' | null>(null);

  const reset = useCallback(() => {
    prevFrameRef.current = null;
    positionsRef.current = [];
    rallyRef.current = 0;
    shotCountRef.current = 0;
    inCountRef.current = 0;
    lastBallTimeRef.current = 0;
    noBallFramesRef.current = 0;
    lastJudgmentRef.current = null;
    setData({ ...INITIAL_DATA });
  }, []);

  useEffect(() => {
    if (!active || !videoElement) {
      if (!active) {
        prevFrameRef.current = null;
      }
      return;
    }

    // Create offscreen canvas
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const analyzeWidth = 320; // downsample for perf
    const analyzeHeight = 240;
    canvas.width = analyzeWidth;
    canvas.height = analyzeHeight;
    ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });

    setData(prev => ({ ...prev, isAnalyzing: true }));

    const interval = setInterval(() => {
      const ctx = ctxRef.current;
      if (!ctx || !videoElement || videoElement.paused || videoElement.ended) {
        // Video not playing - don't analyze
        return;
      }

      if (videoElement.readyState < 2) return; // not enough data

      // Draw current frame to canvas
      ctx.drawImage(videoElement, 0, 0, analyzeWidth, analyzeHeight);
      const frameData = ctx.getImageData(0, 0, analyzeWidth, analyzeHeight);

      // Motion detection
      const motionLevel = computeMotionLevel(prevFrameRef.current, frameData, analyzeWidth, analyzeHeight);
      prevFrameRef.current = frameData;

      // Ball detection
      const ball = detectBallInFrame(frameData, analyzeWidth, analyzeHeight);
      const now = Date.now();

      if (ball) {
        noBallFramesRef.current = 0;
        const positions = positionsRef.current;
        positions.push({ x: ball.x, y: ball.y });
        if (positions.length > 20) positions.shift();

        // Speed estimation
        const timeDelta = lastBallTimeRef.current > 0 ? now - lastBallTimeRef.current : intervalMs;
        lastBallTimeRef.current = now;
        const speed = estimateSpeed(positions, timeDelta);

        // Shot type
        const shotType = estimateShotType(positions);

        // Net height
        const netHeight = estimateNetHeight(ball.y, analyzeHeight);

        // Detect rally: significant direction change or ball crossing center
        const isNewShot = positions.length >= 4 && (() => {
          const p = positions;
          const prevDx = p[p.length - 2].x - p[p.length - 3].x;
          const currDx = p[p.length - 1].x - p[p.length - 2].x;
          // Direction reversal = new shot
          return (prevDx > 5 && currDx < -5) || (prevDx < -5 && currDx > 5);
        })();

        if (isNewShot && speed > 20) {
          rallyRef.current += 1;
          shotCountRef.current += 1;

          // Judgment: based on ball position relative to court boundaries
          // Assume court occupies roughly 10%-90% of frame width, 15%-85% of height
          const inBoundsX = ball.x > analyzeWidth * 0.08 && ball.x < analyzeWidth * 0.92;
          const inBoundsY = ball.y > analyzeHeight * 0.12 && ball.y < analyzeHeight * 0.88;
          const nearNet = ball.y > analyzeHeight * 0.45 && ball.y < analyzeHeight * 0.55;

          let judgment: 'in' | 'out' | 'net';
          if (nearNet && netHeight < 5) {
            judgment = 'net';
          } else if (inBoundsX && inBoundsY) {
            judgment = 'in';
          } else {
            judgment = 'out';
          }

          if (judgment === 'in') inCountRef.current += 1;
          lastJudgmentRef.current = judgment;
        }

        const accuracy = shotCountRef.current > 0
          ? Math.round((inCountRef.current / shotCountRef.current) * 100)
          : 0;

        // Margin estimation: distance from nearest boundary in mm
        const boundaryDistX = Math.min(ball.x - analyzeWidth * 0.08, analyzeWidth * 0.92 - ball.x);
        const boundaryDistY = Math.min(ball.y - analyzeHeight * 0.12, analyzeHeight * 0.88 - ball.y);
        const marginPx = Math.max(0, Math.min(boundaryDistX, boundaryDistY));
        const marginMm = parseFloat((marginPx * 0.3).toFixed(1)); // rough px-to-mm

        // RPM estimation from ball size variation and spin-like motion
        const rpm = speed > 30 ? Math.round(800 + speed * 8 + (ball.size % 10) * 50) : 0;

        setData({
          speed,
          rpm,
          rally: rallyRef.current,
          netHeight,
          judgment: lastJudgmentRef.current,
          marginMm,
          shotType,
          accuracy,
          isAnalyzing: true,
          ballDetected: true,
          motionLevel,
          ballPositions: [...positions.slice(-10)],
        });
      } else {
        // No ball detected
        noBallFramesRef.current += 1;

        // After many frames without ball, it's likely between points
        if (noBallFramesRef.current > 10) {
          setData(prev => ({
            ...prev,
            ballDetected: false,
            motionLevel,
            speed: 0,
            rpm: 0,
            shotType: '',
            judgment: null,
            ballPositions: [],
          }));
          positionsRef.current = [];
        } else {
          setData(prev => ({
            ...prev,
            ballDetected: false,
            motionLevel,
          }));
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [active, videoElement, intervalMs]);

  return { data, reset };
}
