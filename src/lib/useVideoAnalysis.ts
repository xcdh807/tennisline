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
  motionLevel: number;
  ballPositions: { x: number; y: number }[];
  frameCount: number;
  detectedFrames: number;
}

const INITIAL_DATA: AnalysisData = {
  speed: 0, rpm: 0, rally: 0, netHeight: 0,
  judgment: null, marginMm: 0, shotType: '', accuracy: 0,
  isAnalyzing: false, ballDetected: false, motionLevel: 0,
  ballPositions: [], frameCount: 0, detectedFrames: 0,
};

// ---- Helpers ----

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  h = h / 2;
  const s = max === 0 ? 0 : (d / max) * 255;
  const v = max * 255;
  return [h, s, v];
}

interface Blob {
  cx: number; cy: number;
  area: number; w: number; h: number;
  colorScore: number; // how well it matches tennis ball color
}

/**
 * Combined detection: color mask + frame differencing.
 * Returns candidate blobs sorted by likelihood of being the tennis ball.
 */
function detectCandidates(
  curr: ImageData,
  prev: ImageData | null,
  w: number, h: number,
): Blob[] {
  const data = curr.data;
  const prevData = prev?.data;
  // Scoring map: each pixel gets a score (0-255) based on color + motion
  const scoreMap = new Uint8Array(w * h);

  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    const r = data[idx], g = data[idx + 1], b = data[idx + 2];

    // --- Color score (0..150) ---
    let colorScore = 0;
    const [hue, sat, val] = rgbToHsv(r, g, b);

    // Tennis ball yellow-green: wide detection
    if (hue >= 15 && hue <= 55 && sat >= 25 && val >= 100) {
      colorScore = 100;
      // Bonus for being closer to ideal range
      if (hue >= 25 && hue <= 45 && sat >= 50 && val >= 150) colorScore = 150;
    }
    // RGB fallback: green-dominant, not too blue
    else if (g > 100 && g > b * 1.2 && r > 60 && (g - b) > 30 && b < 180) {
      colorScore = 80;
    }
    // Bright white/yellow ball under strong light
    else if (val > 220 && sat < 60 && hue >= 15 && hue <= 60) {
      colorScore = 60;
    }

    // --- Motion score (0..100) ---
    let motionScore = 0;
    if (prevData) {
      const dr = Math.abs(r - prevData[idx]);
      const dg = Math.abs(g - prevData[idx + 1]);
      const db = Math.abs(b - prevData[idx + 2]);
      const diff = (dr + dg + db) / 3;
      motionScore = Math.min(100, Math.round(diff * 3));
    } else {
      motionScore = 50; // No previous frame, assume possible motion
    }

    // Combined: color is primary, motion is secondary
    const combined = Math.min(255, colorScore + motionScore * 0.5);
    scoreMap[i] = combined > 60 ? 255 : 0; // threshold
  }

  // Morphological cleanup: erode once, dilate twice
  let mask = scoreMap;
  // Erode
  const eroded = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++)
        for (let dx = -1; dx <= 1 && ok; dx++)
          if (mask[(y+dy)*w+(x+dx)] === 0) ok = false;
      eroded[y*w+x] = ok ? 255 : 0;
    }
  mask = eroded;
  // Dilate 2x
  for (let iter = 0; iter < 2; iter++) {
    const dilated = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        let any = false;
        for (let dy = -1; dy <= 1 && !any; dy++)
          for (let dx = -1; dx <= 1 && !any; dx++)
            if (mask[(y+dy)*w+(x+dx)] === 255) any = true;
        dilated[y*w+x] = any ? 255 : 0;
      }
    mask = dilated;
  }

  // Connected component labeling
  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const blobs: Map<number, { minX: number; maxX: number; minY: number; maxY: number; count: number; sumX: number; sumY: number; colorSum: number }> = new Map();

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx] === 255 && labels[idx] === 0) {
        const label = nextLabel++;
        const stack = [idx];
        const b = { minX: x, maxX: x, minY: y, maxY: y, count: 0, sumX: 0, sumY: 0, colorSum: 0 };
        while (stack.length > 0) {
          const ci = stack.pop()!;
          if (labels[ci] !== 0) continue;
          labels[ci] = label;
          const cx = ci % w, cy = Math.floor(ci / w);
          b.count++;
          b.sumX += cx; b.sumY += cy;
          if (cx < b.minX) b.minX = cx;
          if (cx > b.maxX) b.maxX = cx;
          if (cy < b.minY) b.minY = cy;
          if (cy > b.maxY) b.maxY = cy;
          // Accumulate original color score
          const pi = ci * 4;
          const [hh, ss, vv] = rgbToHsv(data[pi], data[pi+1], data[pi+2]);
          if (hh >= 15 && hh <= 55 && ss >= 25 && vv >= 100) b.colorSum += 2;
          else if (data[pi+1] > 100) b.colorSum += 1;

          for (const [ddx, ddy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
            const nx = cx+ddx, ny = cy+ddy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const ni = ny*w+nx;
              if (mask[ni] === 255 && labels[ni] === 0) stack.push(ni);
            }
          }
        }
        blobs.set(label, b);
      }
    }

  // Convert to Blob array with filtering
  const results: Blob[] = [];
  for (const [, b] of blobs) {
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const area = b.count;

    // Tennis ball size filter: between 3 and 2000 pixels at 320x240
    if (area < 3 || area > 2000) continue;

    // Aspect ratio: ball should be roughly round
    const aspect = bw / Math.max(bh, 1);
    if (aspect < 0.3 || aspect > 3.0) continue;

    // Compactness: area / bounding box area — ball should fill its bbox
    const compactness = area / (bw * bh);
    if (compactness < 0.2) continue; // too sparse, likely not a ball

    results.push({
      cx: Math.round(b.sumX / area),
      cy: Math.round(b.sumY / area),
      area, w: bw, h: bh,
      colorScore: b.colorSum / area,
    });
  }

  return results;
}

// ---- Tracker with temporal consistency ----

class BallTracker {
  private history: { x: number; y: number; t: number }[] = [];
  private lostFrames = 0;

  reset() { this.history = []; this.lostFrames = 0; }

  update(candidates: Blob[], now: number): { x: number; y: number } | null {
    if (candidates.length === 0) {
      this.lostFrames++;
      return null;
    }

    let best: Blob | null = null;
    let bestScore = -1;

    const lastPos = this.history.length > 0 ? this.history[this.history.length - 1] : null;

    for (const c of candidates) {
      let score = 0;

      // Color score (0..2)
      score += c.colorScore;

      // Size score: prefer small-medium blobs (tennis ball)
      if (c.area >= 5 && c.area <= 500) score += 1.5;
      else if (c.area > 500 && c.area <= 1000) score += 0.5;

      // Compactness bonus
      const compact = c.area / (c.w * c.h);
      score += compact * 1.5;

      // Proximity to last known position
      if (lastPos) {
        const dist = Math.sqrt((c.cx - lastPos.x) ** 2 + (c.cy - lastPos.y) ** 2);
        score += Math.max(0, 2 - dist / 80);
      }

      // Motion consistency: if we have history, prefer candidates in predicted direction
      if (this.history.length >= 2) {
        const h = this.history;
        const predX = h[h.length - 1].x + (h[h.length - 1].x - h[h.length - 2].x);
        const predY = h[h.length - 1].y + (h[h.length - 1].y - h[h.length - 2].y);
        const predDist = Math.sqrt((c.cx - predX) ** 2 + (c.cy - predY) ** 2);
        score += Math.max(0, 1.5 - predDist / 60);
      }

      if (score > bestScore) { bestScore = score; best = c; }
    }

    if (!best) { this.lostFrames++; return null; }

    // Filter static objects: check if it's actually moving
    if (this.history.length >= 3) {
      const recent = this.history.slice(-3);
      let totalDist = 0;
      for (const p of recent) {
        totalDist += Math.sqrt((best.cx - p.x) ** 2 + (best.cy - p.y) ** 2);
      }
      if (totalDist / recent.length < 1.5) {
        // Barely moved — static object
        this.lostFrames++;
        return null;
      }
    }

    this.lostFrames = 0;
    this.history.push({ x: best.cx, y: best.cy, t: now });
    if (this.history.length > 40) this.history.shift();
    return { x: best.cx, y: best.cy };
  }

  getHistory() { return this.history; }
  getLostFrames() { return this.lostFrames; }
}

// ---- Metrics ----

function calcSpeed(history: { x: number; y: number; t: number }[], aw: number): number {
  if (history.length < 2) return 0;
  const a = history[history.length - 2];
  const b = history[history.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0) return 0;
  const px = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  const m = px * (23.77 / aw); // ITF court = 23.77m
  return Math.min(260, Math.round((m / dt) * 3.6));
}

function calcShotType(history: { x: number; y: number; t: number }[]): string {
  if (history.length < 3) return '';
  const h = history.slice(-4);
  const dx = h[h.length - 1].x - h[0].x;
  const dy = h[h.length - 1].y - h[0].y;
  if (dy < -40) return '发球';
  if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return '';
  if (dx > 15 && dy < -10) return '正手上旋';
  if (dx < -15 && dy < -10) return '反手切球';
  if (dx > 15) return '正手抽球';
  if (dx < -15) return '反手抽球';
  return '';
}

function detectRally(history: { x: number; y: number; t: number }[]): boolean {
  if (history.length < 5) return false;
  const h = history;
  const n = h.length;
  const dx1 = h[n - 3].x - h[n - 4].x;
  const dx2 = h[n - 1].x - h[n - 2].x;
  // Direction reversal
  if ((dx1 > 4 && dx2 < -4) || (dx1 < -4 && dx2 > 4)) {
    const speed = Math.sqrt((h[n-1].x - h[n-2].x)**2 + (h[n-1].y - h[n-2].y)**2);
    return speed > 3;
  }
  return false;
}

// ---- Hook ----

export function useVideoAnalysis(
  active: boolean,
  videoElement: HTMLVideoElement | null,
  intervalMs = 150,
) {
  const [data, setData] = useState<AnalysisData>({ ...INITIAL_DATA });

  // Overlay canvas that will be drawn on top of video
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analysisCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const prevFrameRef = useRef<ImageData | null>(null);
  const trackerRef = useRef(new BallTracker());
  const rallyRef = useRef(0);
  const shotCountRef = useRef(0);
  const inCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const detectedFramesRef = useRef(0);
  const lastJudgmentRef = useRef<'in' | 'out' | 'net' | null>(null);
  const lastRallyFrameRef = useRef(0);

  const reset = useCallback(() => {
    trackerRef.current.reset();
    prevFrameRef.current = null;
    rallyRef.current = 0;
    shotCountRef.current = 0;
    inCountRef.current = 0;
    frameCountRef.current = 0;
    detectedFramesRef.current = 0;
    lastJudgmentRef.current = null;
    lastRallyFrameRef.current = 0;
    setData({ ...INITIAL_DATA });
    // Clear overlay
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  }, []);

  // Create/get the overlay canvas element (to be mounted in the DOM)
  const getOverlayCanvas = useCallback(() => {
    if (!overlayRef.current) {
      overlayRef.current = document.createElement('canvas');
      overlayRef.current.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    }
    return overlayRef.current;
  }, []);

  useEffect(() => {
    if (!active || !videoElement) {
      prevFrameRef.current = null;
      return;
    }

    // Setup analysis canvas (offscreen, small)
    if (!analysisCanvasRef.current) {
      analysisCanvasRef.current = document.createElement('canvas');
    }
    const AW = 320, AH = 240;
    analysisCanvasRef.current.width = AW;
    analysisCanvasRef.current.height = AH;
    analysisCtxRef.current = analysisCanvasRef.current.getContext('2d', { willReadFrequently: true });

    // Setup overlay canvas (matches video container)
    const overlay = getOverlayCanvas();
    // Attach overlay to video's parent if not already
    const parent = videoElement.parentElement;
    if (parent && !parent.contains(overlay)) {
      parent.style.position = 'relative';
      parent.appendChild(overlay);
    }

    setData(prev => ({ ...prev, isAnalyzing: true }));

    const interval = setInterval(() => {
      const ctx = analysisCtxRef.current;
      if (!ctx || !videoElement || videoElement.paused || videoElement.ended || videoElement.readyState < 2) return;

      // Resize overlay to match video container
      const vw = videoElement.clientWidth || videoElement.videoWidth || 640;
      const vh = videoElement.clientHeight || videoElement.videoHeight || 480;
      if (overlay.width !== vw || overlay.height !== vh) {
        overlay.width = vw;
        overlay.height = vh;
      }

      frameCountRef.current++;

      // Draw frame to analysis canvas
      ctx.drawImage(videoElement, 0, 0, AW, AH);
      const frameData = ctx.getImageData(0, 0, AW, AH);

      // Detect candidates using color + motion
      const candidates = detectCandidates(frameData, prevFrameRef.current, AW, AH);
      prevFrameRef.current = frameData;

      // Track best ball
      const now = Date.now();
      const ball = trackerRef.current.update(candidates, now);
      const history = trackerRef.current.getHistory();

      // Scale factors for overlay drawing
      const sx = vw / AW, sy = vh / AH;
      const oCtx = overlay.getContext('2d');

      if (oCtx) {
        oCtx.clearRect(0, 0, vw, vh);

        if (ball && history.length >= 2) {
          // Draw trajectory trail
          oCtx.strokeStyle = '#a1fe00';
          oCtx.lineWidth = 3;
          oCtx.shadowColor = '#a1fe00';
          oCtx.shadowBlur = 8;
          oCtx.beginPath();
          const trail = history.slice(-15);
          oCtx.moveTo(trail[0].x * sx, trail[0].y * sy);
          for (let i = 1; i < trail.length; i++) {
            oCtx.lineTo(trail[i].x * sx, trail[i].y * sy);
          }
          oCtx.stroke();
          oCtx.shadowBlur = 0;

          // Draw ball marker
          oCtx.beginPath();
          oCtx.arc(ball.x * sx, ball.y * sy, 12, 0, Math.PI * 2);
          oCtx.strokeStyle = '#ff3030';
          oCtx.lineWidth = 3;
          oCtx.stroke();
          oCtx.beginPath();
          oCtx.arc(ball.x * sx, ball.y * sy, 4, 0, Math.PI * 2);
          oCtx.fillStyle = '#ff3030';
          oCtx.fill();

          // Draw coordinates text
          oCtx.font = 'bold 14px monospace';
          oCtx.fillStyle = '#ff3030';
          oCtx.fillText(`(${Math.round(ball.x * sx)}, ${Math.round(ball.y * sy)})`,
            ball.x * sx + 16, ball.y * sy - 16);
        }

        // Frame counter
        oCtx.font = 'bold 12px monospace';
        oCtx.fillStyle = 'rgba(255,255,255,0.7)';
        oCtx.fillText(`Frame: ${frameCountRef.current}  Detected: ${detectedFramesRef.current}`, 10, vh - 10);
      }

      if (ball) {
        detectedFramesRef.current++;

        const speed = calcSpeed(history, AW);
        const shotType = calcShotType(history);
        const netY = AH * 0.5;
        const netHeight = Math.round(Math.max(0, 45 - Math.abs(ball.y - netY) * (90 / AH)));

        // Rally detection with cooldown
        if (detectRally(history) && frameCountRef.current - lastRallyFrameRef.current > 10) {
          rallyRef.current++;
          shotCountRef.current++;
          lastRallyFrameRef.current = frameCountRef.current;

          const inX = ball.x > AW * 0.05 && ball.x < AW * 0.95;
          const inY = ball.y > AH * 0.08 && ball.y < AH * 0.92;
          const nearNet = ball.y > AH * 0.42 && ball.y < AH * 0.58;
          let j: 'in' | 'out' | 'net';
          if (nearNet && netHeight < 5) j = 'net';
          else if (inX && inY) j = 'in';
          else j = 'out';
          if (j === 'in') inCountRef.current++;
          lastJudgmentRef.current = j;
        }

        const accuracy = shotCountRef.current > 0 ? Math.round((inCountRef.current / shotCountRef.current) * 100) : 0;
        const bDx = Math.min(ball.x - AW * 0.05, AW * 0.95 - ball.x);
        const bDy = Math.min(ball.y - AH * 0.08, AH * 0.92 - ball.y);
        const marginMm = parseFloat((Math.max(0, Math.min(bDx, bDy)) * 0.3).toFixed(1));
        const rpm = speed > 30 ? Math.round(800 + speed * 7.5) : 0;
        const motionLevel = history.length >= 2
          ? Math.min(100, Math.round(Math.sqrt((history[history.length-1].x - history[history.length-2].x)**2 + (history[history.length-1].y - history[history.length-2].y)**2) * 3))
          : 0;

        setData({
          speed, rpm, rally: rallyRef.current, netHeight,
          judgment: lastJudgmentRef.current, marginMm, shotType, accuracy,
          isAnalyzing: true, ballDetected: true, motionLevel,
          ballPositions: history.slice(-10).map(h => ({ x: h.x, y: h.y })),
          frameCount: frameCountRef.current, detectedFrames: detectedFramesRef.current,
        });
      } else {
        const lost = trackerRef.current.getLostFrames();
        if (lost > 20) {
          setData(prev => ({
            ...prev, ballDetected: false, speed: 0, rpm: 0, shotType: '',
            motionLevel: 0, ballPositions: [],
            frameCount: frameCountRef.current, detectedFrames: detectedFramesRef.current,
          }));
        } else {
          setData(prev => ({
            ...prev, ballDetected: false,
            frameCount: frameCountRef.current, detectedFrames: detectedFramesRef.current,
          }));
        }
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
      // Remove overlay from DOM
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    };
  }, [active, videoElement, intervalMs, getOverlayCanvas]);

  return { data, reset, getOverlayCanvas };
}
