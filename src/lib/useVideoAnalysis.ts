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

// ---- Frame Buffer for 3-frame differencing ----
class FrameBuffer {
  private frames: Uint8Array[] = [];
  private w = 0;
  private h = 0;

  init(w: number, h: number) { this.w = w; this.h = h; this.frames = []; }

  push(imageData: ImageData) {
    // Convert to grayscale
    const gray = new Uint8Array(this.w * this.h);
    const d = imageData.data;
    for (let i = 0; i < this.w * this.h; i++) {
      const j = i * 4;
      gray[i] = Math.round(d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114);
    }
    this.frames.push(gray);
    if (this.frames.length > 3) this.frames.shift();
  }

  /**
   * 3-frame differencing: detects pixels that changed between frame N-2→N-1 AND N-1→N.
   * This isolates truly moving objects and removes static noise.
   */
  getMotionMask(threshold: number = 12): Uint8Array | null {
    if (this.frames.length < 2) return null;
    const len = this.frames.length;
    const fCurr = this.frames[len - 1];
    const fPrev = this.frames[len - 2];
    const fOld = len >= 3 ? this.frames[len - 3] : null;
    const mask = new Uint8Array(this.w * this.h);
    for (let i = 0; i < this.w * this.h; i++) {
      const d1 = Math.abs(fCurr[i] - fPrev[i]);
      // 2-frame diff: current vs previous (catches fast objects)
      if (d1 > threshold) {
        mask[i] = 255;
        continue;
      }
      // 3-frame diff: both transitions changed (catches slower objects reliably)
      if (fOld) {
        const d2 = Math.abs(fPrev[i] - fOld[i]);
        if (d1 > threshold * 0.7 && d2 > threshold * 0.7) {
          mask[i] = 255;
        }
      }
    }
    return mask;
  }

  getLatestColor(): ImageData | null { return null; } // unused placeholder
  ready() { return this.frames.length >= 2; }
}

// ---- Morphology ----
function dilate(mask: Uint8Array, w: number, h: number, n: number): Uint8Array {
  let m = mask;
  for (let iter = 0; iter < n; iter++) {
    const out = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        if (m[(y-1)*w+x] || m[(y+1)*w+x] || m[y*w+x-1] || m[y*w+x+1] || m[y*w+x])
          out[y * w + x] = 255;
      }
    m = out;
  }
  return m;
}

function erode(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (mask[(y-1)*w+x] && mask[(y+1)*w+x] && mask[y*w+x-1] && mask[y*w+x+1] && mask[y*w+x])
        out[y * w + x] = 255;
    }
  return out;
}

// ---- Connected Components ----
interface Blob {
  cx: number; cy: number;
  area: number; w: number; h: number;
  compactness: number;
}

function findBlobs(mask: Uint8Array, w: number, h: number): Blob[] {
  const labels = new Int32Array(w * h);
  let next = 1;
  const data: Map<number, { minX: number; maxX: number; minY: number; maxY: number; n: number; sx: number; sy: number }> = new Map();

  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (mask[i] && !labels[i]) {
        const label = next++;
        const stack = [i];
        const b = { minX: x, maxX: x, minY: y, maxY: y, n: 0, sx: 0, sy: 0 };
        while (stack.length) {
          const ci = stack.pop()!;
          if (labels[ci]) continue;
          labels[ci] = label;
          const cx = ci % w, cy = (ci - cx) / w;
          b.n++; b.sx += cx; b.sy += cy;
          if (cx < b.minX) b.minX = cx; if (cx > b.maxX) b.maxX = cx;
          if (cy < b.minY) b.minY = cy; if (cy > b.maxY) b.maxY = cy;
          for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              const ni = ny * w + nx;
              if (mask[ni] && !labels[ni]) stack.push(ni);
            }
          }
        }
        data.set(label, b);
      }
    }

  const blobs: Blob[] = [];
  for (const [, b] of data) {
    const bw = b.maxX - b.minX + 1;
    const bh = b.maxY - b.minY + 1;
    const area = b.n;
    const compactness = area / Math.max(bw * bh, 1);
    blobs.push({
      cx: Math.round(b.sx / area), cy: Math.round(b.sy / area),
      area, w: bw, h: bh, compactness,
    });
  }
  return blobs;
}

// ---- Color verification ----
function colorScore(imageData: ImageData, cx: number, cy: number, w: number, h: number): number {
  const d = imageData.data;
  let score = 0, samples = 0;
  // Sample 7x7 area
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || x >= w || y < 0 || y >= h) continue;
      const i = (y * w + x) * 4;
      const r = d[i], g = d[i + 1], b = d[i + 2];
      samples++;
      // Bright pixel — tennis ball is always bright
      const brightness = r + g + b;
      if (brightness > 300) score += 1;
      if (brightness > 400) score += 1;
      // Yellow-green: g >= b, r moderate
      if (g > 80 && g >= b && (g - b) > 10) score += 1.5;
      // Yellow/orange range
      if (r > 120 && g > 100 && b < Math.max(r, g) * 0.8) score += 1;
      // White/bright (overexposed tennis ball)
      if (r > 180 && g > 180 && b > 120) score += 0.5;
    }
  }
  return samples > 0 ? score / samples : 0;
}

// ---- Ball Tracker with prediction ----
interface TrackPoint { x: number; y: number; t: number; }

class BallTracker {
  history: TrackPoint[] = [];
  lostCount = 0;

  reset() { this.history = []; this.lostCount = 0; }

  predict(): { x: number; y: number } | null {
    const h = this.history;
    if (h.length < 2) return null;
    const a = h[h.length - 2], b = h[h.length - 1];
    return { x: b.x + (b.x - a.x), y: b.y + (b.y - a.y) };
  }

  update(blobs: Blob[], colorData: ImageData, aw: number, ah: number, now: number): { x: number; y: number } | null {
    if (blobs.length === 0) {
      this.lostCount++;
      return null;
    }

    const pred = this.predict();
    const lastPos = this.history.length > 0 ? this.history[this.history.length - 1] : null;

    let best: Blob | null = null;
    let bestScore = -Infinity;

    for (const b of blobs) {
      let score = 0;

      // 1. Size: tennis ball is small (typically 3-80 pixels area at 320x240)
      if (b.area >= 2 && b.area <= 100) score += 5;
      else if (b.area > 100 && b.area <= 300) score += 2;
      else if (b.area > 300 && b.area <= 600) score += 0.5;
      else continue; // too big — not a ball

      // 2. Shape: roughly round
      const aspect = b.w / Math.max(b.h, 1);
      if (aspect >= 0.4 && aspect <= 2.5) score += 3;
      else continue;

      // 3. Compactness
      score += b.compactness * 3;

      // 4. Color verification
      const cs = colorScore(colorData, b.cx, b.cy, aw, ah);
      score += cs * 1.5;

      // 5. Proximity to last known position
      if (lastPos) {
        const dist = Math.sqrt((b.cx - lastPos.x) ** 2 + (b.cy - lastPos.y) ** 2);
        if (dist < 120) score += 4 * (1 - dist / 120);
      }

      // 6. Proximity to predicted position
      if (pred) {
        const dist = Math.sqrt((b.cx - pred.x) ** 2 + (b.cy - pred.y) ** 2);
        if (dist < 80) score += 3 * (1 - dist / 80);
      }

      if (score > bestScore) { bestScore = score; best = b; }
    }

    if (!best || bestScore < 2) {
      this.lostCount++;
      return null;
    }

    this.lostCount = 0;
    this.history.push({ x: best.cx, y: best.cy, t: now });
    if (this.history.length > 60) this.history.shift();
    return { x: best.cx, y: best.cy };
  }
}

// ---- Metrics ----
function calcSpeed(h: TrackPoint[], aw: number): number {
  if (h.length < 2) return 0;
  const a = h[h.length - 2], b = h[h.length - 1];
  const dt = (b.t - a.t) / 1000;
  if (dt <= 0.01) return 0;
  const px = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
  const m = px * (23.77 / aw);
  return Math.min(260, Math.round((m / dt) * 3.6));
}

function calcShotType(h: TrackPoint[]): string {
  if (h.length < 4) return '';
  const s = h.slice(-5);
  const dx = s[s.length - 1].x - s[0].x;
  const dy = s[s.length - 1].y - s[0].y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 5) return '';
  if (dy < -30 && Math.abs(dx) < 20) return '发球';
  if (dx > 12 && dy < -8) return '正手上旋';
  if (dx < -12 && dy < -8) return '反手切球';
  if (dx > 12) return '正手抽球';
  if (dx < -12) return '反手抽球';
  if (Math.abs(dy) > 20 && Math.abs(dx) < 10) return '高压球';
  return '';
}

function detectRally(h: TrackPoint[]): boolean {
  if (h.length < 6) return false;
  const n = h.length;
  // Check for direction reversal in X
  const dx1 = h[n - 4].x - h[n - 6].x;
  const dx2 = h[n - 1].x - h[n - 3].x;
  if ((dx1 > 6 && dx2 < -6) || (dx1 < -6 && dx2 > 6)) {
    // Confirm with sufficient speed
    const speed = Math.sqrt((h[n-1].x - h[n-2].x) ** 2 + (h[n-1].y - h[n-2].y) ** 2);
    return speed > 2;
  }
  return false;
}

// ---- Main Hook ----
export function useVideoAnalysis(
  active: boolean,
  videoElement: HTMLVideoElement | null,
  intervalMs = 100,
) {
  const [data, setData] = useState<AnalysisData>({ ...INITIAL });
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const aCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const aCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const frameBufferRef = useRef(new FrameBuffer());
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
    frameBufferRef.current = new FrameBuffer();
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
    frameBufferRef.current.init(AW, AH);

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

      // Get the actual video intrinsic dimensions
      const vidW = videoElement.videoWidth || AW;
      const vidH = videoElement.videoHeight || AH;

      ctx.drawImage(videoElement, 0, 0, AW, AH);
      const frameData = ctx.getImageData(0, 0, AW, AH);
      frameBufferRef.current.push(frameData);

      if (!frameBufferRef.current.ready()) return;

      let motionMask = frameBufferRef.current.getMotionMask(12);
      if (!motionMask) return;

      motionMask = dilate(motionMask, AW, AH, 3);
      motionMask = erode(motionMask, AW, AH);

      const blobs = findBlobs(motionMask, AW, AH);

      const now = Date.now();
      const ball = trackerRef.current.update(blobs, frameData, AW, AH, now);
      const history = trackerRef.current.history;

      // ---- Compute actual video render rect within the container (object-contain) ----
      // object-contain scales the video to fit within the container while maintaining aspect ratio.
      // This means there may be black bars (letterbox or pillarbox).
      const containerAspect = vw / vh;
      const videoAspect = vidW / vidH;
      let renderW: number, renderH: number, offsetX: number, offsetY: number;
      if (videoAspect > containerAspect) {
        // Video is wider → pillarbox (black bars top/bottom)
        renderW = vw;
        renderH = vw / videoAspect;
        offsetX = 0;
        offsetY = (vh - renderH) / 2;
      } else {
        // Video is taller → letterbox (black bars left/right)
        renderH = vh;
        renderW = vh * videoAspect;
        offsetX = (vw - renderW) / 2;
        offsetY = 0;
      }

      // Map analysis coords (0..AW, 0..AH) → container pixel coords
      const mapX = (ax: number) => offsetX + (ax / AW) * renderW;
      const mapY = (ay: number) => offsetY + (ay / AH) * renderH;

      const oCtx = overlay.getContext('2d');

      if (oCtx) {
        oCtx.clearRect(0, 0, vw, vh);

        if (ball) {
          // Draw trajectory trail (green glow line)
          if (history.length >= 2) {
            const trail = history.slice(-20);
            for (let i = 1; i < trail.length; i++) {
              const alpha = 0.2 + 0.8 * (i / trail.length);
              const width = 1 + 2 * (i / trail.length);
              oCtx.strokeStyle = `rgba(161, 254, 0, ${alpha})`;
              oCtx.lineWidth = width;
              oCtx.beginPath();
              oCtx.moveTo(mapX(trail[i - 1].x), mapY(trail[i - 1].y));
              oCtx.lineTo(mapX(trail[i].x), mapY(trail[i].y));
              oCtx.stroke();
            }
          }

          // Ball marker: red circle with glow
          const bx = mapX(ball.x), by = mapY(ball.y);
          oCtx.shadowColor = '#ff3030';
          oCtx.shadowBlur = 15;
          oCtx.strokeStyle = '#ff3030';
          oCtx.lineWidth = 2.5;
          oCtx.beginPath();
          oCtx.arc(bx, by, 14, 0, Math.PI * 2);
          oCtx.stroke();
          oCtx.shadowBlur = 0;

          // Inner dot
          oCtx.fillStyle = '#ff3030';
          oCtx.beginPath();
          oCtx.arc(bx, by, 4, 0, Math.PI * 2);
          oCtx.fill();

          // Coordinate text
          oCtx.font = 'bold 12px monospace';
          oCtx.fillStyle = 'rgba(255, 48, 48, 0.9)';
          oCtx.fillText(`(${Math.round(bx)},${Math.round(by)})`, bx + 18, by - 18);
        }

        // Bottom-left info
        oCtx.font = '11px monospace';
        oCtx.fillStyle = 'rgba(255,255,255,0.6)';
        oCtx.fillText(`F:${fCountRef.current} D:${dCountRef.current} B:${blobs.length}`, 8, vh - 8);
      }

      if (ball) {
        dCountRef.current++;
        const speed = calcSpeed(history, AW);
        const shotType = calcShotType(history);
        const netHeight = Math.round(Math.max(0, 45 - Math.abs(ball.y - AH * 0.5) * (90 / AH)));

        // Rally detection with cooldown
        if (detectRally(history) && fCountRef.current - lastRallyFRef.current > 15) {
          rallyRef.current++;
          shotCountRef.current++;
          lastRallyFRef.current = fCountRef.current;

          const inX = ball.x > AW * 0.05 && ball.x < AW * 0.95;
          const inY = ball.y > AH * 0.08 && ball.y < AH * 0.92;
          const nearNet = ball.y > AH * 0.42 && ball.y < AH * 0.58;
          let j: 'in' | 'out' | 'net';
          if (nearNet && netHeight < 5) j = 'net';
          else if (inX && inY) j = 'in';
          else j = 'out';
          if (j === 'in') inCountRef.current++;
          lastJRef.current = j;
        }

        const accuracy = shotCountRef.current > 0 ? Math.round((inCountRef.current / shotCountRef.current) * 100) : 0;
        const bDx = Math.min(ball.x - AW * 0.05, AW * 0.95 - ball.x);
        const bDy = Math.min(ball.y - AH * 0.08, AH * 0.92 - ball.y);
        const marginMm = parseFloat((Math.max(0, Math.min(bDx, bDy)) * 0.3).toFixed(1));
        const rpm = speed > 25 ? Math.round(600 + speed * 8) : 0;
        const motionLevel = history.length >= 2
          ? Math.min(100, Math.round(Math.sqrt((history[history.length - 1].x - history[history.length - 2].x) ** 2 + (history[history.length - 1].y - history[history.length - 2].y) ** 2) * 4))
          : 0;

        setData({
          speed, rpm, rally: rallyRef.current, netHeight,
          judgment: lastJRef.current, marginMm, shotType, accuracy,
          isAnalyzing: true, ballDetected: true, motionLevel,
          ballPositions: history.slice(-10).map(p => ({ x: p.x, y: p.y })),
          frameCount: fCountRef.current, detectedFrames: dCountRef.current,
        });
      } else {
        if (trackerRef.current.lostCount > 30) {
          setData(prev => ({
            ...prev, ballDetected: false, speed: 0, rpm: 0, shotType: '',
            motionLevel: 0, ballPositions: [],
            frameCount: fCountRef.current, detectedFrames: dCountRef.current,
          }));
        } else {
          setData(prev => ({
            ...prev, ballDetected: false,
            frameCount: fCountRef.current, detectedFrames: dCountRef.current,
          }));
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
