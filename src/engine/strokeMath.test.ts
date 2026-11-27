import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeStampPlacements,
  floodFillImageData,
  getSymmetryTransforms,
  hsvToRgb,
  interpolateStrokePoints,
  rgbToHsv,
  stabilizePoint,
} from './strokeMath';
import { FACTORY_BRUSHES } from './brushPresets';
import {
  importClipStudioSut,
  importNativeBrushPack,
  importPhotoshopAbr,
  importProcreateBrush,
} from './brushImporters';

test('stabilizePoint dampens abrupt pointer movement according to stabilization', () => {
  const prev = { x: 100, y: 100, pressure: 0.5, tiltX: 0, tiltY: 0, timestamp: 10 };
  const raw = { x: 200, y: 100, pressure: 1, tiltX: 0, tiltY: 0, timestamp: 20 };

  const soft = stabilizePoint(prev, raw, 0.9, 0.5);
  const crisp = stabilizePoint(prev, raw, 0.0, 0.0);

  assert.ok(soft.x < crisp.x);
  assert.ok(soft.x > 100 && soft.x < 200);
});

test('interpolateStrokePoints and computeStampPlacements honor pressure and taper', () => {
  const points = [
    { x: 0, y: 0, pressure: 0.2, tiltX: 0, tiltY: 0, timestamp: 0 },
    { x: 50, y: 20, pressure: 0.9, tiltX: 10, tiltY: 0, timestamp: 25 },
    { x: 120, y: 30, pressure: 0.4, tiltX: 0, tiltY: 0, timestamp: 60 },
  ];
  const interp = interpolateStrokePoints(points, 4);
  assert.ok(interp.length > points.length);

  const ink = FACTORY_BRUSHES.find((b) => b.category === 'ink_pen')!;
  const stamps = computeStampPlacements(points, ink, 42);
  assert.ok(stamps.length >= 10);
  // Middle pressure stamp should be wider than initial low-pressure tapered stamp
  const mid = stamps[Math.floor(stamps.length / 2)];
  assert.ok(mid.radius > stamps[0].radius);
});

test('getSymmetryTransforms produces vertical, quadrant, and radial transforms', () => {
  const vert = getSymmetryTransforms(100, 50, 1000, 800, 'vertical');
  assert.equal(vert.length, 2);
  assert.equal(vert[1].x, 900);

  const quad = getSymmetryTransforms(100, 50, 1000, 800, 'quadrant');
  assert.equal(quad.length, 4);

  const radial = getSymmetryTransforms(600, 400, 1000, 800, 'radial', 6);
  assert.equal(radial.length, 6);
});

test('floodFillImageData fills contiguous region within tolerance', () => {
  const width = 4, height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  // Fill all white except column 2 is black wall
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const v = x === 2 ? 0 : 255;
      data[idx] = v; data[idx + 1] = v; data[idx + 2] = v; data[idx + 3] = 255;
    }
  }
  const fakeImg = { width, height, data } as unknown as ImageData;
  const changed = floodFillImageData(fakeImg, 0, 0, '#2563EB', 10);
  assert.equal(changed, true);
  // x=0,y=0 should be blue (#2563EB -> r=37)
  assert.equal(data[0], 37);
  // x=3,y=0 across the black wall should stay white
  assert.equal(data[3 * 4], 255);
});

test('hsvToRgb and rgbToHsv roundtrip cleanly', () => {
  const rgb = hsvToRgb(210, 0.8, 0.9);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  assert.ok(Math.abs(hsv.h - 210) < 3);
  assert.ok(Math.abs(hsv.s - 0.8) < 0.03);
  assert.ok(Math.abs(hsv.v - 0.9) < 0.03);
});

test('FACTORY_BRUSHES includes all 19 required categories', () => {
  const categories = new Set(FACTORY_BRUSHES.map((b) => b.category));
  assert.equal(categories.size, 19);
});

test('modular brush importers validate native packs and report unsupported binary formats honestly', () => {
  const packJson = JSON.stringify({
    formatVersion: '1.0',
    id: 'test_pack',
    name: 'Test Pack',
    folder: 'Custom',
    brushes: [{ id: 'b1', name: 'Test Ink', category: 'ink_pen', size: 14 }],
  });
  const nativeRes = importNativeBrushPack(packJson);
  assert.equal(nativeRes.success, true);
  assert.equal(nativeRes.importedBrushes.length, 1);

  const abrBuf = new ArrayBuffer(16);
  const abrView = new DataView(abrBuf);
  abrView.setUint16(0, 2, false);
  abrView.setUint16(2, 3, false);
  const abrRes = importPhotoshopAbr(abrBuf, 'MySet.abr');
  assert.equal(abrRes.success, true);
  assert.equal(abrRes.importedBrushes.length, 3);
  assert.ok(abrRes.unsupportedFeatures.length > 0);

  const sutBytes = new TextEncoder().encode('SQLite format 3\0test');
  const sutRes = importClipStudioSut(sutBytes.buffer, 'Pencil.sut');
  assert.equal(sutRes.success, false);
  assert.ok(sutRes.unsupportedFeatures.length > 0);

  const proRes = importProcreateBrush(new ArrayBuffer(10), 'Brush.brush');
  assert.equal(proRes.success, false);
});
