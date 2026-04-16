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

// ---- Grayscale & Frame Diff ----

function toGray(img: ImageData, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    g[i] = (d[j] * 77 + d[j+1] * 150 + d[j+2] * 29) >> 8;
  }
  return g;
}

function diffMask(a: Uint8Array, b: Uint8Array, len: number, th: number): Uint8Array {
  const m = new Uint8Array(len);
  for (let i = 0; i < len; i++) m[i] = Math.abs(a[i] - b[i]) > th ? 255 : 0;
  return m;
}

function dilate2x(m: Uint8Array, w: number, h: number): Uint8Array {
  let cur = m;
  for (let iter = 0; iter < 2; iter++) {
    const o = new Uint8Array(w * h);
    for (let y = 1; y < h-1; y++)
      for (let x = 1; x < w-1; x++)
        if (cur[(y-1)*w+x]||cur[(y+1)*w+x]||cur[y*w+x-1]||cur[y*w+x+1]||cur[y*w+x])
          o[y*w+x] = 255;
    cur = o;
  }
  return cur;
}

// ---- Tennis ball color check (strict) ----

function isTennisBallColor(r: number, g: number, b: number): number {
  // Score 0-5 for how tennis-ball-like this pixel is

  // Hard reject: too dark
  if (r + g + b < 200) return 0;

  // Hard reject: too blue (sky, clothing)
  if (b > g && b > r) return 0;

  // Hard reject: skin tones
  if (r > 150 && g < r - 20 && b < r - 40) return 0;

  // Hard reject: gray/white (racket frame, lines)
  if (Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r > 150) return 0;

  // Hard reject: dark green (court surface typically has low R)
  if (g > 80 && r < 60 && b < 60) return 0;

  let score = 0;

  // Core: yellow-green where G is dominant or equal to R, B is clearly lower
  const gbDiff = g - b;
  if (gbDiff > 40 && g > 120 && r > 80) score += 3;
  else if (gbDiff > 25 && g > 100 && r > 70) score += 2;
  else if (gbDiff > 15 && g > 90) score += 1;
  else return 0; // Not enough green-blue separation

  // Bonus: classic optic yellow (high R and G, low B)
  if (r > 150 && g > 160 && b < 120) score += 2;

  return score;
}

// ---- Find ball: color+motion → cluster → shape check ----

interface BallCandidate {
  x: number; y: number;
  score: number;
  clusterW: number; clusterH: number;
  pixelCount: number;
}

function findBall(
  img: ImageData, motion: Uint8Array, w: number, h: number
): BallCandidate | null {
  // Step 1: Score every motion pixel by color
  const d = img.data;
  const scored: { x: number; y: number; s: number }[] = [];

  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      if (!motion[y * w + x]) continue;
      const i = (y * w + x) * 4;
      const s = isTennisBallColor(d[i], d[i+1], d[i+2]);
      if (s >= 2) scored.push({ x, y, s });
    }
  }

  if (scored.length < 2) return null;

  // Step 2: Grid clustering (20px cells — bigger to capture full ball)
  const CS = 20;
  const grid: Map<string, { xs: number[]; ys: number[]; totalS: number }> = new Map();
  for (const p of scored) {
    const key = `${Math.floor(p.x / CS)},${Math.floor(p.y / CS)}`;
    let g = grid.get(key);
    if (!g) { g = { xs: [], ys: [], totalS: 0 }; grid.set(key, g); }
    g.xs.push(p.x); g.ys.push(p.y); g.totalS += p.s;
  }

  // Step 3: Merge adjacent cells into clusters
  const cells = [...grid.entries()].map(([key, val]) => {
    const [gx, gy] = key.split(',').map(Number);
    return { gx, gy, ...val };
  });

  // Simple: for each cell, find its bounding box including neighbors
  let best: BallCandidate | null = null;
  let bestScore = 0;

  for (const cell of cells) {
    // Gather this cell + direct neighbors
    let allXs = [...cell.xs];
    let allYs = [...cell.ys];
    let totalS = cell.totalS;
    for (const other of cells) {
      if (other === cell) continue;
      if (Math.abs(other.gx - cell.gx) <= 1 && Math.abs(other.gy - cell.gy) <= 1) {
        allXs = allXs.concat(other.xs);
        allYs = allYs.concat(other.ys);
        totalS += other.totalS;
      }
    }

    const n = allXs.length;
    if (n < 2) continue;

    // Bounding box of this cluster
    const minX = Math.min(...allXs), maxX = Math.max(...allXs);
    const minY = Math.min(...allYs), maxY = Math.max(...allYs);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;

    // ---- Shape filters to reject non-ball objects ----

    // Reject if too large (person, racket swing arc)
    if (cw > 50 || ch > 50) continue;
    if (n > 120) continue; // Too many pixels at step=2

    // Reject if very elongated (racket: long and thin)
    const aspect = cw / Math.max(ch, 1);
    if (aspect > 2.5 || aspect < 0.4) continue;

    // Reject if too sparse (scattered noise, not a compact ball)
    const density = n / ((cw / 2) * (ch / 2) + 1); // at step=2
    if (density < 0.1) continue;

    // Score: avg color score + compactness bonus + small size bonus
    const avgS = totalS / n;
    const compactBonus = Math.min(density, 1) * 2;
    const sizeBonus = (cw <= 25 && ch <= 25) ? 2 : (cw <= 35 && ch <= 35) ? 1 : 0;
    const finalScore = avgS + compactBonus + sizeBonus;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      const cx = Math.round(allXs.reduce((a, b) => a + b, 0) / n);
      const cy = Math.round(allYs.reduce((a, b) => a + b, 0) / n);
      best = { x: cx, y: cy, score: finalScore, clusterW: cw, clusterH: ch, pixelCount: n };
    }
  }

  // Only return if score is reasonably high
  if (best && best.score >= 3) return best;
  return null;
}

// ---- Tracker ----

interface TP { x: number; y: number; t: number; }

class Tracker {
  history: TP[] = [];
  lostCount = 0;

  reset() { this.history = []; this.lostCount = 0; }

  update(c: BallCandidate | null): { x: number; y: number } | null {
    if (!c) { this.lostCount++; return null; }

    // Physics: max 60px jump (ball at 320x240 can't teleport further in 100ms)
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      const dist = Math.sqrt((c.x - last.x)**2 + (c.y - last.y)**2);
      if (dist > 60 && this.lostCount < 8) {
        this.lostCount++;
        return null; // Likely false detection
      }
    }

    // Static filter
    if (this.history.length >= 3) {
      const r = this.history.slice(-3);
      let td = 0;
      for (const p of r) td += Math.sqrt((c.x-p.x)**2 + (c.y-p.y)**2);
      if (td / r.length < 1.5) { this.lostCount++; return null; }
    }

    this.lostCount = 0;
    this.history.push({ x: c.x, y: c.y, t: Date.now() });
    if (this.history.length > 50) this.history.shift();
    return { x: c.x, y: c.y };
  }
}

// ---- Metrics ----

function calcSpeed(h: TP[], aw: number): number {
  if (h.length < 2) return 0;
  const a = h[h.length-2], b = h[h.length-1];
  const dt = (b.t - a.t) / 1000;
  if (dt < 0.02) return 0;
  const px = Math.sqrt((b.x-a.x)**2 + (b.y-a.y)**2);
  return Math.min(260, Math.round((px * (23.77 / aw) / dt) * 3.6));
}

function calcShot(h: TP[]): string {
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
  return '';
}

function checkRally(h: TP[]): boolean {
  if (h.length < 6) return false;
  const n = h.length;
  const dx1 = h[n-4].x - h[n-6].x;
  const dx2 = h[n-1].x - h[n-3].x;
  return ((dx1 > 5 && dx2 < -5) || (dx1 < -5 && dx2 > 5)) &&
    Math.sqrt((h[n-1].x-h[n-2].x)**2+(h[n-1].y-h[n-2].y)**2) > 2;
}

// ---- Hook ----

export function useVideoAnalysis(
  active: boolean,
  videoElement: HTMLVideoElement | null,
  intervalMs = 100,
) {
  const [data, setData] = useState<AnalysisData>({ ...INITIAL });
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const aCvRef = useRef<HTMLCanvasElement | null>(null);
  const aCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const prevRef = useRef<Uint8Array | null>(null);
  const trkRef = useRef(new Tracker());
  const rally = useRef(0), shots = useRef(0), ins = useRef(0);
  const fc = useRef(0), dc = useRef(0);
  const lastJ = useRef<'in'|'out'|'net'|null>(null);
  const lastRF = useRef(0);

  const reset = useCallback(() => {
    trkRef.current.reset(); prevRef.current = null;
    rally.current = 0; shots.current = 0; ins.current = 0;
    fc.current = 0; dc.current = 0;
    lastJ.current = null; lastRF.current = 0;
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
    if (!aCvRef.current) aCvRef.current = document.createElement('canvas');
    aCvRef.current.width = AW; aCvRef.current.height = AH;
    aCtxRef.current = aCvRef.current.getContext('2d', { willReadFrequently: true });
    prevRef.current = null;

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

      fc.current++;
      ctx.drawImage(videoElement, 0, 0, AW, AH);
      const frameData = ctx.getImageData(0, 0, AW, AH);
      const gray = toGray(frameData, AW, AH);

      if (!prevRef.current) { prevRef.current = gray; return; }

      const motion = dilate2x(diffMask(gray, prevRef.current, AW * AH, 15), AW, AH);
      prevRef.current = gray;

      // Find ball by color in motion region
      const candidate = findBall(frameData, motion, AW, AH);
      const ball = trkRef.current.update(candidate);
      const hist = trkRef.current.history;

      // Map coords to video render area
      const vidW = videoElement.videoWidth || AW;
      const vidH = videoElement.videoHeight || AH;
      const cA = vw / vh, vA = vidW / vidH;
      let rW: number, rH: number, oX: number, oY: number;
      if (vA > cA) { rW = vw; rH = vw / vA; oX = 0; oY = (vh - rH) / 2; }
      else { rH = vh; rW = vh * vA; oX = (vw - rW) / 2; oY = 0; }
      const mx = (ax: number) => oX + (ax / AW) * rW;
      const my = (ay: number) => oY + (ay / AH) * rH;

      const oCtx = overlay.getContext('2d');
      if (oCtx) {
        oCtx.clearRect(0, 0, vw, vh);

        if (ball && hist.length >= 2) {
          // Green trajectory trail with fade
          const trail = hist.slice(-15);
          for (let i = 1; i < trail.length; i++) {
            const a = 0.1 + 0.9 * (i / trail.length);
            oCtx.strokeStyle = `rgba(161,254,0,${a})`;
            oCtx.lineWidth = 1 + 2 * (i / trail.length);
            oCtx.beginPath();
            oCtx.moveTo(mx(trail[i-1].x), my(trail[i-1].y));
            oCtx.lineTo(mx(trail[i].x), my(trail[i].y));
            oCtx.stroke();
          }

          // Red ball marker
          const bx = mx(ball.x), by = my(ball.y);
          oCtx.shadowColor = '#ff3030'; oCtx.shadowBlur = 10;
          oCtx.strokeStyle = '#ff3030'; oCtx.lineWidth = 2;
          oCtx.beginPath(); oCtx.arc(bx, by, 10, 0, Math.PI*2); oCtx.stroke();
          oCtx.shadowBlur = 0;
          oCtx.fillStyle = '#ff3030';
          oCtx.beginPath(); oCtx.arc(bx, by, 3, 0, Math.PI*2); oCtx.fill();

          oCtx.font = 'bold 10px monospace';
          oCtx.fillStyle = 'rgba(255,48,48,0.8)';
          oCtx.fillText(`(${Math.round(bx)},${Math.round(by)})`, bx + 14, by - 12);
        }
        // NO debug text or stale data when ball not detected - clean overlay
      }

      if (ball) {
        dc.current++;
        const speed = calcSpeed(hist, AW);
        const shotType = calcShot(hist);
        const netHeight = Math.round(Math.max(0, 45 - Math.abs(ball.y - AH*0.5) * (90/AH)));

        if (checkRally(hist) && fc.current - lastRF.current > 15) {
          rally.current++; shots.current++;
          lastRF.current = fc.current;
          const inX = ball.x > AW*0.05 && ball.x < AW*0.95;
          const inY = ball.y > AH*0.08 && ball.y < AH*0.92;
          const near = ball.y > AH*0.42 && ball.y < AH*0.58;
          let j: 'in'|'out'|'net';
          if (near && netHeight < 5) j = 'net'; else if (inX && inY) j = 'in'; else j = 'out';
          if (j === 'in') ins.current++;
          lastJ.current = j;
        }

        const acc = shots.current > 0 ? Math.round((ins.current/shots.current)*100) : 0;
        const rpm = speed > 25 ? Math.round(600 + speed * 8) : 0;

        setData({
          speed, rpm, rally: rally.current, netHeight,
          judgment: lastJ.current, marginMm: 0, shotType, accuracy: acc,
          isAnalyzing: true, ballDetected: true,
          motionLevel: Math.min(100, Math.round(Math.sqrt((hist[hist.length-1].x-hist[hist.length-2].x)**2+(hist[hist.length-1].y-hist[hist.length-2].y)**2)*4)),
          ballPositions: hist.slice(-10).map(p => ({x:p.x,y:p.y})),
          frameCount: fc.current, detectedFrames: dc.current,
        });
      } else {
        // Clear data when not detected — show clean "waiting" state
        const lost = trkRef.current.lostCount;
        if (lost > 5) {
          setData(prev => ({
            ...prev, ballDetected: false, speed: 0, rpm: 0, shotType: '',
            motionLevel: 0, ballPositions: [], judgment: null,
            frameCount: fc.current, detectedFrames: dc.current,
          }));
        } else {
          // Brief loss — keep last data but mark not detected
          setData(prev => ({ ...prev, ballDetected: false, frameCount: fc.current, detectedFrames: dc.current }));
        }
      }
    }, intervalMs);

    return () => { clearInterval(interval); if (overlay.parentElement) overlay.parentElement.removeChild(overlay); };
  }, [active, videoElement, intervalMs, getOverlayCanvas]);

  return { data, reset, getOverlayCanvas };
}
