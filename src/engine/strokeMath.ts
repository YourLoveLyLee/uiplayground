import type {
  BrushConfig,
  StampPlacement,
  StrokeInputPoint,
  SymmetryMode,
} from '../types/artStudio';

/**
 * Applies weighted string/lazy-mouse stabilization to raw pointer coordinates.
 */
export function stabilizePoint(
  prev: StrokeInputPoint | null,
  raw: StrokeInputPoint,
  stabilization: number,
  smoothing: number
): StrokeInputPoint {
  if (!prev) return raw;
  // Combine smoothing (EMA) and stabilization (pull radius dampening)
  const factor = Math.max(0.08, 1 - Math.min(0.92, stabilization * 0.65 + smoothing * 0.27));
  return {
    x: prev.x + (raw.x - prev.x) * factor,
    y: prev.y + (raw.y - prev.y) * factor,
    pressure: prev.pressure + (raw.pressure - prev.pressure) * Math.max(0.25, factor),
    tiltX: prev.tiltX + (raw.tiltX - prev.tiltX) * 0.35,
    tiltY: prev.tiltY + (raw.tiltY - prev.tiltY) * 0.35,
    timestamp: raw.timestamp,
  };
}

/**
 * Catmull-Rom spline interpolation between 4 control points.
 */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Resamples a sequence of input points with Catmull-Rom smoothing into dense evenly spaced points.
 */
export function interpolateStrokePoints(
  points: StrokeInputPoint[],
  subdivisionsPerSegment = 6
): StrokeInputPoint[] {
  if (points.length <= 2) return points;
  const result: StrokeInputPoint[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    for (let s = 0; s < subdivisionsPerSegment; s++) {
      const t = s / subdivisionsPerSegment;
      result.push({
        x: catmullRom(p0.x, p1.x, p2.x, p3.x, t),
        y: catmullRom(p0.y, p1.y, p2.y, p3.y, t),
        pressure: p1.pressure + (p2.pressure - p1.pressure) * t,
        tiltX: p1.tiltX + (p2.tiltX - p1.tiltX) * t,
        tiltY: p1.tiltY + (p2.tiltY - p1.tiltY) * t,
        timestamp: p1.timestamp + (p2.timestamp - p1.timestamp) * t,
      });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

/**
 * Deterministic PRNG for repeatable brush scatter / grain / variation.
 */
export function seededNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Generates individual stamp placements along a stroke segment using spacing,
 * pressure dynamics, velocity, tilt, taper, scatter, rotation, and color jitter.
 */
export function computeStampPlacements(
  points: StrokeInputPoint[],
  brush: BrushConfig,
  strokeSeed = 1
): StampPlacement[] {
  if (points.length === 0) return [];
  const dense = interpolateStrokePoints(points, 5);
  const stamps: StampPlacement[] = [];

  const totalDistEstimate = dense.reduce((acc, pt, idx) => {
    if (idx === 0) return 0;
    const prev = dense[idx - 1];
    return acc + Math.hypot(pt.x - prev.x, pt.y - prev.y);
  }, 0);

  const baseRadius = Math.max(0.5, brush.size / 2);
  const stepDist = Math.max(1, brush.size * Math.max(0.03, brush.spacing));

  let traveled = 0;
  let nextStampDist = 0;
  let stampIndex = 0;

  const pushStamp = (pt: StrokeInputPoint, prevPt: StrokeInputPoint, distSoFar: number) => {
    const progress = totalDistEstimate > 0 ? distSoFar / totalDistEstimate : 0.5;
    // Taper start / end multiplier
    let taperMult = 1;
    if (brush.taperStart > 0 && progress < brush.taperStart * 0.4) {
      taperMult *= Math.max(0.12, progress / (brush.taperStart * 0.4));
    }
    if (brush.taperEnd > 0 && progress > 1 - brush.taperEnd * 0.4) {
      taperMult *= Math.max(0.12, (1 - progress) / (brush.taperEnd * 0.4));
    }

    // Velocity calculation (px/ms)
    const dt = Math.max(1, pt.timestamp - prevPt.timestamp);
    const segLen = Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
    const velocity = Math.min(4, segLen / dt);
    const velocityFactor = 1 + brush.velocityResponse * (velocity - 0.5) * 0.35;

    // Pressure curves
    const pSize = 1 - brush.pressureSize + brush.pressureSize * pt.pressure;
    const pOpacity = 1 - brush.pressureOpacity + brush.pressureOpacity * pt.pressure;

    // Tilt widens/modifies radius slightly when pen is tilted
    const tiltMag = Math.min(1, Math.hypot(pt.tiltX, pt.tiltY) / 60);
    const tiltFactor = 1 + brush.tiltResponse * tiltMag * 0.45;

    const rand1 = seededNoise(strokeSeed * 97 + stampIndex * 31);
    const rand2 = seededNoise(strokeSeed * 53 + stampIndex * 17);
    const rand3 = seededNoise(strokeSeed * 19 + stampIndex * 7);

    const varMult = 1 - brush.randomVariation * 0.35 + rand1 * brush.randomVariation * 0.7;
    const radius = Math.max(0.5, baseRadius * pSize * taperMult * velocityFactor * tiltFactor * varMult);

    const scatterDist = brush.scatter * brush.size * (rand2 - 0.5);
    const scatterAngle = rand3 * Math.PI * 2;
    const sx = pt.x + Math.cos(scatterAngle) * scatterDist;
    const sy = pt.y + Math.sin(scatterAngle) * scatterDist;

    const strokeAngle = Math.atan2(pt.y - prevPt.y, pt.x - prevPt.x);
    const baseAngle = (brush.rotation * Math.PI) / 180;
    const angleRad = brush.rotationFollowsStroke
      ? strokeAngle + baseAngle
      : baseAngle + (rand1 - 0.5) * brush.randomVariation * Math.PI;

    const opacity = Math.max(
      0.01,
      Math.min(1, brush.opacity * brush.flow * pOpacity)
    );

    stamps.push({
      x: sx,
      y: sy,
      radius,
      opacity,
      angleRad,
      hueShift: (rand1 - 0.5) * 60 * brush.colorDynamicsHue,
      satShift: (rand2 - 0.5) * 40 * brush.colorDynamicsSat,
      briShift: (rand3 - 0.5) * 30 * brush.colorDynamicsBri,
    });
    stampIndex++;
  };

  pushStamp(dense[0], dense[0], 0);

  for (let i = 1; i < dense.length; i++) {
    const prev = dense[i - 1];
    const curr = dense[i];
    const seg = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (seg <= 0.001) continue;

    while (traveled + seg >= nextStampDist + stepDist) {
      nextStampDist += stepDist;
      const ratio = (nextStampDist - traveled) / seg;
      const interp: StrokeInputPoint = {
        x: prev.x + (curr.x - prev.x) * ratio,
        y: prev.y + (curr.y - prev.y) * ratio,
        pressure: prev.pressure + (curr.pressure - prev.pressure) * ratio,
        tiltX: prev.tiltX + (curr.tiltX - prev.tiltX) * ratio,
        tiltY: prev.tiltY + (curr.tiltY - prev.tiltY) * ratio,
        timestamp: prev.timestamp + (curr.timestamp - prev.timestamp) * ratio,
      };
      pushStamp(interp, prev, nextStampDist);
    }
    traveled += seg;
  }

  return stamps;
}

/**
 * Generates mirrored / rotated symmetry points around canvas center.
 */
export function getSymmetryTransforms(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  mode: SymmetryMode,
  radialSegments = 6
): Array<{ x: number; y: number }> {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  if (mode === 'none') return [{ x, y }];
  if (mode === 'vertical') return [{ x, y }, { x: canvasWidth - x, y }];
  if (mode === 'horizontal') return [{ x, y }, { x, y: canvasHeight - y }];
  if (mode === 'quadrant') {
    return [
      { x, y },
      { x: canvasWidth - x, y },
      { x, y: canvasHeight - y },
      { x: canvasWidth - x, y: canvasHeight - y },
    ];
  }

  // Radial symmetry
  const count = Math.max(2, Math.min(24, radialSegments));
  const dx = x - cx;
  const dy = y - cy;
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const a = (i * Math.PI * 2) / count;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    pts.push({
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
    });
  }
  return pts;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; }
  else if (h < 120) { r1 = x; g1 = c; }
  else if (h < 180) { g1 = c; b1 = x; }
  else if (h < 240) { g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; b1 = c; }
  else { r1 = c; b1 = x; }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  if (h < 0) h += 360;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}

/**
 * Scanline flood fill on an ImageData buffer.
 */
export function floodFillImageData(
  imageData: ImageData,
  startX: number,
  startY: number,
  fillHex: string,
  tolerance = 28
): boolean {
  const { width, height, data } = imageData;
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return false;

  const startIdx = (sy * width + sx) * 4;
  const sr = data[startIdx];
  const sg = data[startIdx + 1];
  const sb = data[startIdx + 2];
  const sa = data[startIdx + 3];

  const target = hexToRgb(fillHex);
  if (
    Math.abs(sr - target.r) <= 2 &&
    Math.abs(sg - target.g) <= 2 &&
    Math.abs(sb - target.b) <= 2 &&
    sa >= 250
  ) {
    return false;
  }

  const visited = new Uint8Array(width * height);
  const stack: number[] = [sx, sy];

  const matches = (idx: number) => {
    const dr = Math.abs(data[idx] - sr);
    const dg = Math.abs(data[idx + 1] - sg);
    const db = Math.abs(data[idx + 2] - sb);
    const da = Math.abs(data[idx + 3] - sa);
    return dr <= tolerance && dg <= tolerance && db <= tolerance && da <= tolerance;
  };

  while (stack.length > 0) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    const pIdx = y * width + x;
    if (visited[pIdx]) continue;
    const dIdx = pIdx * 4;
    if (!matches(dIdx)) continue;

    visited[pIdx] = 1;
    data[dIdx] = target.r;
    data[dIdx + 1] = target.g;
    data[dIdx + 2] = target.b;
    data[dIdx + 3] = 255;

    if (x > 0) stack.push(x - 1, y);
    if (x < width - 1) stack.push(x + 1, y);
    if (y > 0) stack.push(x, y - 1);
    if (y < height - 1) stack.push(x, y + 1);
  }
  return true;
}
