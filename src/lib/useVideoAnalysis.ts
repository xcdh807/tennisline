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

const INITIAL: AnalysisData = {
  speed: 0, rpm: 0, rally: 0, netHeight: 0,
  judgment: null, marginMm: 0, shotType: '', accuracy: 0,
  isAnalyzing: false, ballDetected: false, motionLevel: 0,
  ballPositions: [], frameCount: 0, detectedFrames: 0,
};

// ========== STEP 1: Motion Detection via Frame Differencing ==========

function getGrayscale(img: ImageData, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    g[i] = (d[j] * 77 + d[j+1] * 150 + d[j+2] * 29) >> 8;
  }
  return g;
}

function frameDiff(curr: Uint8Array, prev: Uint8Array, w: number, h: number, thresh: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    mask[i] = Math.abs(curr[i] - prev[i]) > thresh ? 255 : 0;
  }
  return mask;
}

// ========== STEP 2: Find tennis ball by color in motion regions ==========

function findBallByColor(
  img: ImageData, motionMask: Uint8Array, w: number, h: number
): { x: number; y: number; score: number } | null {
  // Scan motion regions for yellow-green tennis ball pixels
  const d = img.data;
  // Accumulate candidate pixel positions
  const candidates: { x: number; y: number; s: number }[] = [];

  // Grid-based scanning for performance (step=2)
  for (let y = 2; y < h - 2; y += 2) {
    for (let x = 2; x < w - 2; x += 2) {
      const mi = y * w + x;
      if (!motionMask[mi]) continue; // Not in motion region

      const i = mi * 4;
      const r = d[i], g = d[i+1], b = d[i+2];

      // Tennis ball color scoring
      let s = 0;

      // Yellow-green: high G, moderate-high R, low B
      if (g > 120 && r > 80 && b < 130 && g > b && (g + r) > (b * 3)) s += 3;
      else if (g > 100 && r > 70 && b < 160 && (g - b) > 20) s += 2;

      // Brightness bonus
      if (r + g + b > 350) s += 1;
      if (r + g + b > 450) s += 1;

      // Strong yellow/chartreuse
      if (r > 150 && g > 170 && b < 100) s += 3;

      // Not skin tone (skin: R>G>B with R high)
      if (r > 160 && g < r - 30 && b < r - 50) s -= 2;

      // Not pure white (all channels very close and high)
      if (r > 200 && g > 200 && b > 200 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) s -= 1;

      // Not green court surface (court: very green, less red)
      if (g > 100 && g > r * 1.5 && g > b * 1.5) s -= 1;

      if (s >= 2) {
        candidates.push({ x, y, s });
      }
    }
  }

  if (candidates.length === 0) return null;

  // Cluster candidates: find the densest small region
  const cellSize = 12;
  const grid: Map<string, { sx: number; sy: number; n: number; totalScore: number }> = new Map();
  for (const c of candidates) {
    const key = `${Math.floor(c.x / cellSize)},${Math.floor(c.y / cellSize)}`;
    const g = grid.get(key) || { sx: 0, sy: 0, n: 0, totalScore: 0 };
    g.sx += c.x; g.sy += c.y; g.n++; g.totalScore += c.s;
    grid.set(key, g);
  }

  // Find best cluster: high color score, small-medium size (ball, not person)
  let best: { x: number; y: number; score: number } | null = null;
  let bestScore = 0;
  for (const [, g] of grid) {
    // Ball cluster should be small (2-60 candidate hits at step=2)
    if (g.n < 1 || g.n > 80) continue;
    const avgScore = g.totalScore / g.n;
    const sizeBonus = g.n <= 30 ? 2 : (g.n <= 50 ? 1 : 0);
    const finalScore = avgScore + sizeBonus;
    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = { x: Math.round(g.sx / g.n), y: Math.round(g.sy / g.n), score: finalScore };
    }
  }

  return best;
}

// ========== STEP 3: Fallback - smallest moving blob ==========

interface Blob { cx: number; cy: number; area: number; w: number; h: number; }

function findSmallestMovingBlob(mask: Uint8Array, w: number, h: number): Blob | null {
  // Quick connected components with size limit
  const labels = new Int32Array(w * h);
  let next = 1;
  const blobs: Blob[] = [];

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i] && !labels[i]) {
        const label = next++;
        const stack = [i];
        let minX = x, maxX = x, minY = y, maxY = y, n = 0, sx = 0, sy = 0;
        while (stack.length) {
          const ci = stack.pop()!;
          if (labels[ci]) continue;
          labels[ci] = label;
          const cx = ci % w, cy = (ci - cx) / w;
          n++; sx += cx; sy += cy;
          if (cx < minX) minX = cx; if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy; if (cy > maxY) maxY = cy;
          if (n > 2000) break; // Too large, skip
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx+dx, ny = cy+dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const ni = ny*w+nx;
              if (mask[ni] && !labels[ni]) stack.push(ni);
            }
          }
        }
        if (n >= 3 && n <= 500) {
          const bw = maxX - minX + 1, bh = maxY - minY + 1;
          const aspect = bw / Math.max(bh, 1);
          if (aspect > 0.3 && aspect < 3.0) {
            blobs.push({ cx: Math.round(sx/n), cy: Math.round(sy/n), area: n, w: bw, h: bh });
          }
        }
      }
    }

  if (blobs.length === 0) return null;

  // Prefer smallest blob that's roughly circular
  blobs.sort((a, b) => a.area - b.area);
  return blobs[0];
}

// ========== STEP 4: Tracker with physics constraints ==========

interface TrackPoint { x: number; y: number; t: number; }

class BallTracker {
  history: TrackPoint[] = [];
  lostCount = 0;
  private maxJumpPx = 80; // Max pixels ball can move between frames at 320x240

  reset() { this.history = []; this.lostCount = 0; }

  predict(): { x: number; y: number } | null {
    const h = this.history;
    if (h.length < 2) return h.length === 1 ? { x: h[0].x, y: h[0].y } : null;
    const a = h[h.length - 2], b = h[h.length - 1];
    return { x: b.x + (b.x - a.x), y: b.y + (b.y - a.y) };
  }

  update(candidate: { x: number; y: number } | null): { x: number; y: number } | null {
    if (!candidate) {
      this.lostCount++;
      return null;
    }

    // Physics check: ball can't jump too far in one frame
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      const dist = Math.sqrt((candidate.x - last.x) ** 2 + (candidate.y - last.y) ** 2);
      if (dist > this.maxJumpPx) {
        // Too far — might be a false detection. Accept only if we've been lost for a while.
        if (this.lostCount < 5) {
          this.lostCount++;
          return null;
        }
        // Lost long enough — accept new position (ball reappeared elsewhere)
      }
    }

    // Static check: must be actually moving
    if (this.history.length >= 3) {
      const recent = this.history.slice(-3);
      let totalDist = 0;
      for (const p of recent) {
        totalDist += Math.sqrt((candidate.x - p.x) ** 2 + (candidate.y - p.y) ** 2);
      }
      if (totalDist / recent.length < 1.0) {
        this.lostCount++;
        return null; // Static
      }
    }

    this.lostCount = 0;
    this.history.push({ x: candidate.x, y: candidate.y, t: Date.now() });
    if (this.history.length > 60) this.history.shift();
    return candidate;
  }
}

// ========== Metrics ==========

function calcSpeed(h: TrackPoint[], aw: number): number {
  if (h.length < 2) return 0;
  const a = h[h.length - 2], b = h[h.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt < 0.02) return 0;
  const px = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  return Math.min(260, Math.round((px * (23.77 / aw) / dt) * 3.6));
}

function calcShotType(h: TrackPoint[]): string {
  if (h.length < 4) return '';
  const s = h.slice(-5);
  const dx = s[s.length-1].x - s[0].x;
  const dy = s[s.length-1].y - s[0].y;
  if (Math.sqrt(dx*dx+dy*dy) < 5) return '';
  if (dy < -30 && Math.abs(dx) < 20) return '发球';
  if (dx > 12 && dy < -8) return '正手上旋';
  if (dx < -12 && dy < -8) return '反手切球';
  if (dx > 12) return '正手抽球';
  if (dx < -12) return '反手抽球';
  if (Math.abs(dy) > 20) return '高压球';
  return '';
}

function detectRally(h: TrackPoint[]): boolean {
  if (h.length < 6) return false;
  const n = h.length;
  const dx1 = h[n-4].x - h[n-6].x;
  const dx2 = h[n-1].x - h[n-3].x;
  return ((dx1 > 5 && dx2 < -5) || (dx1 < -5 && dx2 > 5)) &&
    Math.sqrt((h[n-1].x-h[n-2].x)**2 + (h[n-1].y-h[n-2].y)**2) > 2;
}

// ========== Main Hook ==========

export function useVideoAnalysis(
  active: boolean,
  videoElement: HTMLVideoElement | null,
  intervalMs = 100,
) {
  const [data, setData] = useState<AnalysisData>({ ...INITIAL });
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const aCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const prevGrayRef = useRef<Uint8Array | null>(null);
  const trackerRef = useRef(new BallTracker());
  const rallyRef = useRef(0);
  const shotCountRef = useRef(0);
  const inCountRef = useRef(0);
  const fCountRef = useRef(0);
  const dCountRef = useRef(0);
  const lastJRef = useRef<'in' | 'out' | 'net' | null>(null);
  const lastRallyFRef = useRef(0);

  const reset = useCallback(() => {
    trackerRef.current.reset();
    prevGrayRef.current = null;
    rallyRef.current = 0; shotCountRef.current = 0; inCountRef.current = 0;
    fCountRef.current = 0; dCountRef.current = 0;
    lastJRef.current = null; lastRallyFRef.current = 0;
    setData({ ...INITIAL });
    if (overlayRef.current) {
      const c = overlayRef.current.getContext('2d');
      if (c) c.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
  }, []);

  const getOverlayCanvas = useCallback(() => {
    if (!overlayRef.current) {
      overlayRef.current = document.createElement('canvas');
      overlayRef.current.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:5;';
    }
    return overlayRef.current;
  }, []);

  useEffect(() => {
    if (!active || !videoElement) return;

    const AW = 320, AH = 240;
    if (!aCanvasRef.current) aCanvasRef.current = document.createElement('canvas');
    aCanvasRef.current.width = AW; aCanvasRef.current.height = AH;
    aCtxRef.current = aCanvasRef.current.getContext('2d', { willReadFrequently: true });
    prevGrayRef.current = null;

    const overlay = getOverlayCanvas();
    const parent = videoElement.parentElement;
    if (parent && !parent.contains(overlay)) {
      parent.style.position = 'relative';
      parent.appendChild(overlay);
    }

    setData(prev => ({ ...prev, isAnalyzing: true }));

    const interval = setInterval(() => {
      const ctx = aCtxRef.current;
      if (!ctx || !videoElement || videoElement.paused || videoElement.ended || videoElement.readyState < 2) return;

      const vw = videoElement.clientWidth || 640;
      const vh = videoElement.clientHeight || 480;
      if (overlay.width !== vw || overlay.height !== vh) { overlay.width = vw; overlay.height = vh; }

      fCountRef.current++;
      ctx.drawImage(videoElement, 0, 0, AW, AH);
      const frameData = ctx.getImageData(0, 0, AW, AH);
      const currGray = getGrayscale(frameData, AW, AH);

      // Need previous frame
      if (!prevGrayRef.current) {
        prevGrayRef.current = currGray;
        return;
      }

      // Step 1: Frame differencing
      const motionMask = frameDiff(currGray, prevGrayRef.current, AW, AH, 15);
      prevGrayRef.current = currGray;

      // Dilate motion mask to expand regions (ball pixels may be sparse)
      let dilated = motionMask;
      for (let iter = 0; iter < 2; iter++) {
        const out = new Uint8Array(AW * AH);
        for (let y = 1; y < AH - 1; y++)
          for (let x = 1; x < AW - 1; x++) {
            if (dilated[(y-1)*AW+x] || dilated[(y+1)*AW+x] || dilated[y*AW+x-1] || dilated[y*AW+x+1] || dilated[y*AW+x])
              out[y*AW+x] = 255;
          }
        dilated = out;
      }

      // Step 2: Find tennis ball by color within motion regions
      let candidate = findBallByColor(frameData, dilated, AW, AH);

      // Step 3: Fallback to smallest moving blob if color didn't find anything
      if (!candidate) {
        const blob = findSmallestMovingBlob(dilated, AW, AH);
        if (blob && blob.area <= 200) {
          candidate = { x: blob.cx, y: blob.cy, score: 1 };
        }
      }

      // Step 4: Track with physics constraints
      const ball = trackerRef.current.update(candidate);
      const history = trackerRef.current.history;

      // ---- Compute video render rect (object-contain) ----
      const vidW = videoElement.videoWidth || AW;
      const vidH = videoElement.videoHeight || AH;
      const cAspect = vw / vh, vAspect = vidW / vidH;
      let rW: number, rH: number, oX: number, oY: number;
      if (vAspect > cAspect) { rW = vw; rH = vw / vAspect; oX = 0; oY = (vh - rH) / 2; }
      else { rH = vh; rW = vh * vAspect; oX = (vw - rW) / 2; oY = 0; }
      const mapX = (ax: number) => oX + (ax / AW) * rW;
      const mapY = (ay: number) => oY + (ay / AH) * rH;

      // ---- Draw overlay ----
      const oCtx = overlay.getContext('2d');
      if (oCtx) {
        oCtx.clearRect(0, 0, vw, vh);

        if (ball && history.length >= 2) {
          // Trail
          const trail = history.slice(-20);
          for (let i = 1; i < trail.length; i++) {
            const alpha = 0.15 + 0.85 * (i / trail.length);
            oCtx.strokeStyle = `rgba(161, 254, 0, ${alpha})`;
            oCtx.lineWidth = 1 + 2.5 * (i / trail.length);
            oCtx.beginPath();
            oCtx.moveTo(mapX(trail[i-1].x), mapY(trail[i-1].y));
            oCtx.lineTo(mapX(trail[i].x), mapY(trail[i].y));
            oCtx.stroke();
          }

          // Ball circle
          const bx = mapX(ball.x), by = mapY(ball.y);
          oCtx.shadowColor = '#ff3030';
          oCtx.shadowBlur = 12;
          oCtx.strokeStyle = '#ff3030';
          oCtx.lineWidth = 2;
          oCtx.beginPath();
          oCtx.arc(bx, by, 12, 0, Math.PI * 2);
          oCtx.stroke();
          oCtx.shadowBlur = 0;
          oCtx.fillStyle = '#ff3030';
          oCtx.beginPath();
          oCtx.arc(bx, by, 3, 0, Math.PI * 2);
          oCtx.fill();

          // Coords
          oCtx.font = 'bold 11px monospace';
          oCtx.fillStyle = 'rgba(255,48,48,0.85)';
          oCtx.fillText(`(${Math.round(bx)},${Math.round(by)})`, bx + 16, by - 14);
        }

        // Debug info
        oCtx.font = '10px monospace';
        oCtx.fillStyle = 'rgba(255,255,255,0.5)';
        oCtx.fillText(`F:${fCountRef.current} D:${dCountRef.current}`, 6, vh - 6);
      }

      if (ball) {
        dCountRef.current++;
        const speed = calcSpeed(history, AW);
        const shotType = calcShotType(history);
        const netHeight = Math.round(Math.max(0, 45 - Math.abs(ball.y - AH*0.5) * (90/AH)));

        if (detectRally(history) && fCountRef.current - lastRallyFRef.current > 15) {
          rallyRef.current++; shotCountRef.current++;
          lastRallyFRef.current = fCountRef.current;
          const inX = ball.x > AW*0.05 && ball.x < AW*0.95;
          const inY = ball.y > AH*0.08 && ball.y < AH*0.92;
          const nearNet = ball.y > AH*0.42 && ball.y < AH*0.58;
          let j: 'in'|'out'|'net';
          if (nearNet && netHeight < 5) j = 'net';
          else if (inX && inY) j = 'in';
          else j = 'out';
          if (j === 'in') inCountRef.current++;
          lastJRef.current = j;
        }

        const accuracy = shotCountRef.current > 0 ? Math.round((inCountRef.current/shotCountRef.current)*100) : 0;
        const bDx = Math.min(ball.x - AW*0.05, AW*0.95 - ball.x);
        const bDy = Math.min(ball.y - AH*0.08, AH*0.92 - ball.y);
        const marginMm = parseFloat((Math.max(0, Math.min(bDx, bDy)) * 0.3).toFixed(1));
        const rpm = speed > 25 ? Math.round(600 + speed * 8) : 0;
        const motionLevel = history.length >= 2
          ? Math.min(100, Math.round(Math.sqrt((history[history.length-1].x-history[history.length-2].x)**2+(history[history.length-1].y-history[history.length-2].y)**2)*4))
          : 0;

        setData({
          speed, rpm, rally: rallyRef.current, netHeight,
          judgment: lastJRef.current, marginMm, shotType, accuracy,
          isAnalyzing: true, ballDetected: true, motionLevel,
          ballPositions: history.slice(-10).map(p => ({x:p.x, y:p.y})),
          frameCount: fCountRef.current, detectedFrames: dCountRef.current,
        });
      } else {
        if (trackerRef.current.lostCount > 30) {
          setData(prev => ({ ...prev, ballDetected: false, speed: 0, rpm: 0, shotType: '', motionLevel: 0, ballPositions: [], frameCount: fCountRef.current, detectedFrames: dCountRef.current }));
        } else {
          setData(prev => ({ ...prev, ballDetected: false, frameCount: fCountRef.current, detectedFrames: dCountRef.current }));
        }
      }
    }, intervalMs);

    return () => {
      clearInterval(interval);
      if (overlay.parentElement) overlay.parentElement.removeChild(overlay);
    };
  }, [active, videoElement, intervalMs, getOverlayCanvas]);

  return { data, reset, getOverlayCanvas };
}
