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

// ---- Core algorithm ported from tennis_tracker_package/process_all_mov.py ----

interface Contour {
  cx: number;
  cy: number;
  area: number;
  w: number;
  h: number;
  perimeter: number;
}

/**
 * Convert RGB to HSV (OpenCV convention: H[0-180], S[0-255], V[0-255])
 */
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
  h = h / 2; // OpenCV uses H range 0-180
  const s = max === 0 ? 0 : (d / max) * 255;
  const v = max * 255;
  return [h, s, v];
}

/**
 * Create HSV mask matching tennis ball color.
 * From process_all_mov.py: H[30,37], S[57,122], V[230,255]
 * Extended slightly for browser video color differences: H[25,45], S[40,150], V[180,255]
 */
function createTennisBallMask(
  imageData: ImageData,
  width: number,
  height: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  const d = imageData.data;
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    const [h, s, v] = rgbToHsv(d[idx], d[idx + 1], d[idx + 2]);
    // Wider range than Python to account for video compression artifacts
    if (h >= 25 && h <= 45 && s >= 40 && s <= 150 && v >= 180) {
      mask[i] = 255;
    }
  }
  return mask;
}

/**
 * Morphological erode (3x3 kernel, 1 iteration) — matches Python code
 */
function erode(mask: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let allSet = true;
      for (let dy = -1; dy <= 1 && allSet; dy++) {
        for (let dx = -1; dx <= 1 && allSet; dx++) {
          if (mask[(y + dy) * w + (x + dx)] === 0) allSet = false;
        }
      }
      out[y * w + x] = allSet ? 255 : 0;
    }
  }
  return out;
}

/**
 * Morphological dilate (3x3 kernel, n iterations) — matches Python code (2 iterations)
 */
function dilate(mask: Uint8Array, w: number, h: number, iterations: number): Uint8Array {
  let current = mask;
  for (let iter = 0; iter < iterations; iter++) {
    const out = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let anySet = false;
        for (let dy = -1; dy <= 1 && !anySet; dy++) {
          for (let dx = -1; dx <= 1 && !anySet; dx++) {
            if (current[(y + dy) * w + (x + dx)] === 255) anySet = true;
          }
        }
        out[y * w + x] = anySet ? 255 : 0;
      }
    }
    current = out;
  }
  return current;
}

/**
 * Connected component labeling + contour extraction from binary mask.
 * Returns blob-like contours with centroid, area, bounding box, and perimeter estimate.
 */
function findContours(mask: Uint8Array, w: number, h: number): Contour[] {
  const labels = new Int32Array(w * h);
  let nextLabel = 1;
  const blobData: Map<number, { minX: number; maxX: number; minY: number; maxY: number; count: number; sumX: number; sumY: number; borderPixels: number }> = new Map();

  // Simple flood-fill labeling
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (mask[idx] === 255 && labels[idx] === 0) {
        const label = nextLabel++;
        const stack = [idx];
        let minX = x, maxX = x, minY = y, maxY = y, count = 0, sumX = 0, sumY = 0, borderPixels = 0;

        while (stack.length > 0) {
          const ci = stack.pop()!;
          if (labels[ci] !== 0) continue;
          labels[ci] = label;
          const cx = ci % w, cy = Math.floor(ci / w);
          count++;
          sumX += cx;
          sumY += cy;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          // Check if border pixel (has a neighbor that's 0)
          let isBorder = false;
          for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) { isBorder = true; continue; }
            const ni = ny * w + nx;
            if (mask[ni] === 0) isBorder = true;
            else if (labels[ni] === 0) stack.push(ni);
          }
          if (isBorder) borderPixels++;
        }

        blobData.set(label, { minX, maxX, minY, maxY, count, sumX, sumY, borderPixels });
      }
    }
  }

  const contours: Contour[] = [];
  for (const [, blob] of blobData) {
    const bw = blob.maxX - blob.minX + 1;
    const bh = blob.maxY - blob.minY + 1;
    contours.push({
      cx: Math.round(blob.sumX / blob.count),
      cy: Math.round(blob.sumY / blob.count),
      area: blob.count,
      w: bw,
      h: bh,
      perimeter: blob.borderPixels, // approximate perimeter
    });
  }
  return contours;
}

/**
 * TennisBallTracker — ported from Python TennisBallTracker class
 */
class TennisBallTracker {
  private historyPositions: { x: number; y: number }[] = [];
  private maxHistory = 3;
  private prevBallPosition: { x: number; y: number } | null = null;

  reset() {
    this.historyPositions = [];
    this.prevBallPosition = null;
  }

  /**
   * Detect tennis ball in a single frame — mirrors Python detect_tennis_ball()
   */
  detectTennisBall(
    imageData: ImageData,
    width: number,
    height: number,
  ): { x: number; y: number } | null {
    // Step 1: HSV color filtering
    let mask = createTennisBallMask(imageData, width, height);

    // Step 2: Morphological operations (erode 1x, dilate 2x — matches Python)
    mask = erode(mask, width, height);
    mask = dilate(mask, width, height, 2);

    // Step 3: Find contours
    const contours = findContours(mask, width, height);

    let bestPosition: { x: number; y: number } | null = null;
    let bestScore = 0;

    for (const c of contours) {
      // Area filter: 10 < area < 500 (from Python)
      // Scale for analysis resolution vs original — we use 320x240
      const minArea = 3;
      const maxArea = 800;
      if (c.area <= minArea || c.area >= maxArea) continue;

      // Aspect ratio filter: 0.5 < ratio < 1.5 (from Python)
      const aspectRatio = c.w / Math.max(c.h, 1);
      if (aspectRatio <= 0.5 || aspectRatio >= 1.5) continue;

      // Circularity: 4πA/P² (from Python)
      if (c.perimeter <= 0) continue;
      const circularity = (4 * Math.PI * c.area) / (c.perimeter * c.perimeter);

      // Distance from previous position (from Python)
      let distFromPrev = Infinity;
      if (this.prevBallPosition) {
        distFromPrev = Math.sqrt(
          (c.cx - this.prevBallPosition.x) ** 2 +
          (c.cy - this.prevBallPosition.y) ** 2
        );
      }

      // Composite score: 0.6*circularity + 0.4*proximity (from Python)
      const score = 0.6 * circularity + 0.4 * (1 - Math.min(distFromPrev, 200) / 200);

      if (score > bestScore) {
        bestScore = score;
        bestPosition = { x: c.cx, y: c.cy };
      }
    }

    // Step 5: Motion check — filter static objects (from Python is_moving)
    if (bestPosition) {
      if (this.isMoving(bestPosition)) {
        this.historyPositions.push(bestPosition);
        if (this.historyPositions.length > this.maxHistory) {
          this.historyPositions.shift();
        }
        this.prevBallPosition = bestPosition;
      } else {
        bestPosition = null; // Static object, discard
      }
    }

    return bestPosition;
  }

  /**
   * Check if object is moving — mirrors Python is_moving()
   */
  private isMoving(position: { x: number; y: number }): boolean {
    if (this.historyPositions.length < 2) return true;

    let totalDistance = 0;
    for (const prev of this.historyPositions) {
      totalDistance += Math.sqrt(
        (position.x - prev.x) ** 2 + (position.y - prev.y) ** 2
      );
    }
    const avgDistance = totalDistance / this.historyPositions.length;
    return avgDistance > 1; // Threshold from Python
  }
}

// ---- Derived metrics computation ----

function estimateSpeed(positions: { x: number; y: number }[], frameDeltaMs: number, analyzeWidth: number): number {
  if (positions.length < 2) return 0;
  const p1 = positions[positions.length - 2];
  const p2 = positions[positions.length - 1];
  const pixelDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  // Assume analysis width (320px) ≈ 24m court width
  const mPerPx = 24 / analyzeWidth;
  const meters = pixelDist * mPerPx;
  const seconds = frameDeltaMs / 1000;
  if (seconds <= 0) return 0;
  return Math.min(250, Math.round((meters / seconds) * 3.6));
}

function estimateShotType(positions: { x: number; y: number }[]): string {
  if (positions.length < 3) return '';
  const p = positions.slice(-3);
  const dx = p[2].x - p[0].x;
  const dy = p[2].y - p[0].y;
  if (Math.abs(dy) > 60 && dy < 0) return '发球';
  if (dx > 20 && Math.abs(dy) < 30) return '正手平击';
  if (dx < -20 && Math.abs(dy) < 30) return '反手平击';
  if (dy < -15 && dx > 15) return '正手上旋';
  if (dy < -15 && dx < -15) return '反手切球';
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return '放小球';
  return dx > 0 ? '正手抽球' : '反手抽球';
}

function detectDirectionChange(positions: { x: number; y: number }[]): boolean {
  if (positions.length < 4) return false;
  const p = positions;
  const prevDx = p[p.length - 2].x - p[p.length - 3].x;
  const currDx = p[p.length - 1].x - p[p.length - 2].x;
  return (prevDx > 5 && currDx < -5) || (prevDx < -5 && currDx > 5);
}

// ---- Main Hook ----

export function useVideoAnalysis(
  active: boolean,
  videoElement: HTMLVideoElement | null,
  intervalMs = 200,
) {
  const [data, setData] = useState<AnalysisData>({ ...INITIAL_DATA });

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const trackerRef = useRef<TennisBallTracker>(new TennisBallTracker());
  const positionsRef = useRef<{ x: number; y: number }[]>([]);
  const rallyRef = useRef(0);
  const shotCountRef = useRef(0);
  const inCountRef = useRef(0);
  const frameCountRef = useRef(0);
  const detectedFramesRef = useRef(0);
  const lastBallTimeRef = useRef(0);
  const noBallFramesRef = useRef(0);
  const lastJudgmentRef = useRef<'in' | 'out' | 'net' | null>(null);

  const reset = useCallback(() => {
    trackerRef.current.reset();
    positionsRef.current = [];
    rallyRef.current = 0;
    shotCountRef.current = 0;
    inCountRef.current = 0;
    frameCountRef.current = 0;
    detectedFramesRef.current = 0;
    lastBallTimeRef.current = 0;
    noBallFramesRef.current = 0;
    lastJudgmentRef.current = null;
    setData({ ...INITIAL_DATA });
  }, []);

  useEffect(() => {
    if (!active || !videoElement) {
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas');
    }
    const canvas = canvasRef.current;
    const AW = 320, AH = 240;
    canvas.width = AW;
    canvas.height = AH;
    ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });

    setData(prev => ({ ...prev, isAnalyzing: true }));

    const interval = setInterval(() => {
      const ctx = ctxRef.current;
      if (!ctx || !videoElement || videoElement.paused || videoElement.ended || videoElement.readyState < 2) return;

      frameCountRef.current++;
      ctx.drawImage(videoElement, 0, 0, AW, AH);
      const frameData = ctx.getImageData(0, 0, AW, AH);

      // Run the ported TennisBallTracker algorithm
      const ball = trackerRef.current.detectTennisBall(frameData, AW, AH);
      const now = Date.now();

      if (ball) {
        noBallFramesRef.current = 0;
        detectedFramesRef.current++;
        const positions = positionsRef.current;
        positions.push(ball);
        if (positions.length > 30) positions.shift();

        // Speed
        const timeDelta = lastBallTimeRef.current > 0 ? now - lastBallTimeRef.current : intervalMs;
        lastBallTimeRef.current = now;
        const speed = estimateSpeed(positions, timeDelta, AW);

        // Shot type
        const shotType = estimateShotType(positions);

        // Net height estimate
        const netY = AH * 0.5;
        const netHeight = Math.round(Math.max(0, 45 - Math.abs(ball.y - netY) * (100 / AH)));

        // Rally detection — direction change with speed threshold
        const isNewShot = detectDirectionChange(positions) && speed > 15;
        if (isNewShot) {
          rallyRef.current++;
          shotCountRef.current++;

          // Judgment based on court boundaries
          const inX = ball.x > AW * 0.08 && ball.x < AW * 0.92;
          const inY = ball.y > AH * 0.12 && ball.y < AH * 0.88;
          const nearNet = ball.y > AH * 0.45 && ball.y < AH * 0.55;

          let judgment: 'in' | 'out' | 'net';
          if (nearNet && netHeight < 5) judgment = 'net';
          else if (inX && inY) judgment = 'in';
          else judgment = 'out';

          if (judgment === 'in') inCountRef.current++;
          lastJudgmentRef.current = judgment;
        }

        const accuracy = shotCountRef.current > 0 ? Math.round((inCountRef.current / shotCountRef.current) * 100) : 0;
        const bDistX = Math.min(ball.x - AW * 0.08, AW * 0.92 - ball.x);
        const bDistY = Math.min(ball.y - AH * 0.12, AH * 0.88 - ball.y);
        const marginMm = parseFloat((Math.max(0, Math.min(bDistX, bDistY)) * 0.3).toFixed(1));
        const rpm = speed > 30 ? Math.round(800 + speed * 8) : 0;

        // Motion level: average displacement of last 3 positions
        let motionLevel = 0;
        if (positions.length >= 2) {
          const last = positions[positions.length - 1];
          const prev = positions[positions.length - 2];
          motionLevel = Math.min(100, Math.round(Math.sqrt((last.x - prev.x) ** 2 + (last.y - prev.y) ** 2) * 2));
        }

        setData({
          speed, rpm, rally: rallyRef.current, netHeight,
          judgment: lastJudgmentRef.current, marginMm, shotType, accuracy,
          isAnalyzing: true, ballDetected: true, motionLevel,
          ballPositions: positions.slice(-10),
          frameCount: frameCountRef.current,
          detectedFrames: detectedFramesRef.current,
        });
      } else {
        noBallFramesRef.current++;
        if (noBallFramesRef.current > 15) {
          positionsRef.current = [];
          setData(prev => ({
            ...prev, ballDetected: false, speed: 0, rpm: 0, shotType: '', judgment: null,
            motionLevel: 0, ballPositions: [],
            frameCount: frameCountRef.current, detectedFrames: detectedFramesRef.current,
          }));
        } else {
          setData(prev => ({
            ...prev, ballDetected: false, motionLevel: 0,
            frameCount: frameCountRef.current, detectedFrames: detectedFramesRef.current,
          }));
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [active, videoElement, intervalMs]);

  return { data, reset };
}
