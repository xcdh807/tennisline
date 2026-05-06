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

// ---- RGB → HSV conversion (matching Python cv2 convention: H:0-180, S:0-255, V:0-255) ----

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), min = Math.min(rf, gf, bf);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rf) h = 60 * (((gf - bf) / d) % 6);
    else if (max === gf) h = 60 * ((bf - rf) / d + 2);
    else h = 60 * ((rf - gf) / d + 4);
    if (h < 0) h += 360;
  }
  const s = max > 0 ? d / max : 0;
  // Convert to cv2 scale: H:0-180, S:0-255, V:0-255
  return [h / 2, s * 255, max * 255];
}

// ---- Tennis ball color: HSV-based detection ----
// Tennis ball = fluorescent optic yellow. In HSV (cv2 scale):
//   H: 22-45 (yellow-green hue), S: 40-220, V: 140+ (bright)
// Racket = low saturation (gray/white) → rejected by S < 35
// Trees = H > 45 (greener hue) or G >> R → rejected

function isTennisBallColor(r: number, g: number, b: number): number {
  // ---- Fast RGB rejects ----
  if (r + g + b < 250) return 0;          // Too dark
  if (b > g || b > r) return 0;           // Blue dominant
  if (b > 150) return 0;                  // Too much blue

  // Gray/white: low color spread (racket, strings, white clothing)
  const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
  if (maxC - minC < 30) return 0;

  // Skin: R much higher than G with warm tone
  if (r > g + 50 && r > b + 60) return 0;

  // ---- HSV classification ----
  const [h, s, v] = rgbToHsv(r, g, b);

  // Hue: tennis ball is yellow-green, H roughly 22-45 in cv2 scale
  if (h < 18 || h > 48) return 0;

  // Saturation: must have color (not gray racket) but not neon clothing
  if (s < 35) return 0;   // White/gray → racket
  if (s > 230) return 0;  // Oversaturated → clothing

  // Value/brightness: tennis ball is relatively bright
  if (v < 130) return 0;

  // ---- Cross-checks to separate ball from green trees ----
  // Trees: G >> R (very green). Tennis ball: R ≈ G or R slightly < G
  if (g > r + 55) return 0; // Strong green → tree/grass

  // G - B spread: tennis ball has moderate to large spread
  const gbDiff = g - b;
  if (gbDiff < 20) return 0;

  // ---- Score tiers ----
  const rgDiff = Math.abs(r - g);

  // Tier 1: Ideal optic yellow — H:25-38, bright, R≈G, B low
  if (h >= 25 && h <= 38 && s >= 50 && v >= 180 && rgDiff < 35 && gbDiff > 50) return 5;

  // Tier 2: Good yellow-green
  if (h >= 22 && h <= 42 && s >= 45 && v >= 160 && rgDiff < 50 && gbDiff > 35) return 4;

  // Tier 3: Acceptable — wider range, still distinctive
  if (h >= 18 && h <= 48 && s >= 35 && v >= 130 && gbDiff > 20) return 3;

  // Tier 4: Marginal but possible (darker conditions, motion blur)
  if (h >= 18 && h <= 48 && s >= 35 && v >= 110) return 2;

  return 0;
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

  // Grid clustering (18px cells)
  const CS = 18;
  const grid: Map<string, { xs: number[]; ys: number[]; totalS: number }> = new Map();
  for (const p of scored) {
    const key = `${Math.floor(p.x / CS)},${Math.floor(p.y / CS)}`;
    let g = grid.get(key);
    if (!g) { g = { xs: [], ys: [], totalS: 0 }; grid.set(key, g); }
    g.xs.push(p.x); g.ys.push(p.y); g.totalS += p.s;
  }

  const cells = [...grid.entries()].map(([key, val]) => {
    const [gx, gy] = key.split(',').map(Number);
    return { gx, gy, ...val };
  });

  let best: BallCandidate | null = null;
  let bestScore = 0;

  for (const cell of cells) {
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

    const minX = Math.min(...allXs), maxX = Math.max(...allXs);
    const minY = Math.min(...allYs), maxY = Math.max(...allYs);
    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;

    // Size: tennis ball at 320x240 is roughly 4-30px
    if (cw > 35 || ch > 35) continue;
    if (n > 60) continue;

    // Aspect ratio: ball is roughly round, racket is elongated
    const aspect = cw / Math.max(ch, 1);
    if (aspect > 2.0 || aspect < 0.5) continue;

    // Density check
    const bbArea = (cw / 2 + 1) * (ch / 2 + 1);
    const density = n / bbArea;
    if (density < 0.15) continue;

    // Circularity: check pixel distribution around center
    const cx = allXs.reduce((a, b) => a + b, 0) / n;
    const cy = allYs.reduce((a, b) => a + b, 0) / n;
    const radius = Math.max(cw, ch) / 2;
    let withinCircle = 0;
    for (let i = 0; i < allXs.length; i++) {
      const dx = allXs[i] - cx;
      const dy = allYs[i] - cy;
      if (Math.sqrt(dx * dx + dy * dy) <= radius * 1.3) withinCircle++;
    }
    const circularFraction = withinCircle / n;
    if (circularFraction < 0.6) continue;

    // Score
    const avgS = totalS / n;
    const compactBonus = Math.min(density, 1) * 2;
    const circleBonus = circularFraction * 1.5;
    const sizeBonus = (cw <= 15 && ch <= 15) ? 3 : (cw <= 25 && ch <= 25) ? 1.5 : 0;
    const finalScore = avgS + compactBonus + circleBonus + sizeBonus;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      best = {
        x: Math.round(cx), y: Math.round(cy),
        score: finalScore, clusterW: cw, clusterH: ch, pixelCount: n
      };
    }
  }

  if (best && best.score >= 4) return best;
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

    // Physics: max 55px jump at 320x240
    if (this.history.length > 0) {
      const last = this.history[this.history.length - 1];
      const dist = Math.sqrt((c.x - last.x)**2 + (c.y - last.y)**2);
      if (dist > 55 && this.lostCount < 8) {
        this.lostCount++;
        return null;
      }
    }

    // Static filter — reject truly stationary objects
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

        if (ball) {
          // Only draw ball marker — no trajectory trail
          const bx = mx(ball.x), by = my(ball.y);

          // Outer glow circle
          oCtx.shadowColor = '#a1fe00'; oCtx.shadowBlur = 12;
          oCtx.strokeStyle = '#a1fe00'; oCtx.lineWidth = 2.5;
          oCtx.beginPath(); oCtx.arc(bx, by, 12, 0, Math.PI * 2); oCtx.stroke();
          oCtx.shadowBlur = 0;

          // Inner solid dot
          oCtx.fillStyle = '#ff3030';
          oCtx.beginPath(); oCtx.arc(bx, by, 3, 0, Math.PI * 2); oCtx.fill();
        }
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
