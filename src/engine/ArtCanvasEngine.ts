import type {
  ArtDocument,
  ArtLayer,
  BrushConfig,
  DrawingGuidesConfig,
  StampPlacement,
  StrokeInputPoint,
} from '../types/artStudio';
import type { SpriteRegion } from '../types/roblox';
import {
  computeStampPlacements,
  floodFillImageData,
  getSymmetryTransforms,
  hexToRgb,
  hsvToRgb,
  rgbToHex,
  rgbToHsv,
  stabilizePoint,
} from './strokeMath';

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyCtx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function createBackingCanvas(width: number, height: number): AnyCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    const oc = new OffscreenCanvas(width, height);
    oc.getContext('2d', { willReadFrequently: true });
    return oc;
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d', { willReadFrequently: true });
  return canvas;
}

function getCtx(canvas: AnyCanvas): AnyCtx {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Unable to acquire 2D canvas context');
  return ctx as AnyCtx;
}

async function canvasToDataUrl(canvas: AnyCanvas, mimeType = 'image/png', quality = 0.92): Promise<string> {
  if (typeof HTMLCanvasElement !== 'undefined' && canvas instanceof HTMLCanvasElement) {
    return canvas.toDataURL(mimeType, quality);
  }
  const offscreen = canvas as OffscreenCanvas;
  const blob = await offscreen.convertToBlob({ type: mimeType, quality });
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

interface HistorySnapshot {
  doc: ArtDocument;
  buffers: Map<string, ImageData>;
  masks: Map<string, ImageData>;
}

export interface SelectionState {
  kind: 'rect' | 'lasso';
  points: Array<{ x: number; y: number }>;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Decoupled, application-owned Art Studio document & rendering engine.
 * Independent of React UI; drives offscreen layer canvases, compositing,
 * stroke interpolation, brush stamps, masks, symmetry, undo/redo, and exports.
 */
export class ArtCanvasEngine {
  private doc: ArtDocument;
  private layerCanvases = new Map<string, AnyCanvas>();
  private maskCanvases = new Map<string, AnyCanvas>();
  private compositeCanvas: AnyCanvas;
  private strokeScratchCanvas: AnyCanvas;
  private stampCanvas: AnyCanvas;

  private undoStack: HistorySnapshot[] = [];
  private redoStack: HistorySnapshot[] = [];
  private readonly maxHistory = 24;

  private activeStrokePoints: StrokeInputPoint[] = [];
  private lastStabilized: StrokeInputPoint | null = null;
  private activeStrokeSeed = 1;
  private preStrokeImage: ImageData | null = null;

  private imageCache = new Map<string, HTMLImageElement>();
  private texturePatternCache = new Map<string, HTMLCanvasElement>();
  private selection: SelectionState | null = null;

  private onChangeListeners = new Set<() => void>();

  constructor(initialDoc: ArtDocument) {
    this.doc = structuredClone(initialDoc);
    this.compositeCanvas = createBackingCanvas(this.doc.width, this.doc.height);
    this.strokeScratchCanvas = createBackingCanvas(this.doc.width, this.doc.height);
    this.stampCanvas = createBackingCanvas(512, 512);
    this.ensureLayerCanvases();
  }

  public subscribe(listener: () => void): () => void {
    this.onChangeListeners.add(listener);
    return () => this.onChangeListeners.delete(listener);
  }

  private emitChange() {
    this.onChangeListeners.forEach((fn) => fn());
  }

  public getDocument(): ArtDocument {
    return this.doc;
  }

  public getSelection(): SelectionState | null {
    return this.selection;
  }

  public setSelection(sel: SelectionState | null) {
    this.selection = sel;
    this.emitChange();
  }

  public clearSelection() {
    this.selection = null;
    this.emitChange();
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public updateGuides(updater: (g: DrawingGuidesConfig) => DrawingGuidesConfig) {
    this.doc = {
      ...this.doc,
      guides: updater(this.doc.guides),
      updatedAt: new Date().toISOString(),
    };
    this.emitChange();
  }

  public updateDocumentMeta(patch: Partial<Pick<ArtDocument, 'title' | 'backgroundColor' | 'dpi' | 'referenceImage'>>) {
    this.doc = {
      ...this.doc,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.emitChange();
  }

  public async loadDocument(doc: ArtDocument): Promise<void> {
    this.doc = structuredClone(doc);
    this.undoStack = [];
    this.redoStack = [];
    this.selection = null;
    this.compositeCanvas = createBackingCanvas(this.doc.width, this.doc.height);
    this.strokeScratchCanvas = createBackingCanvas(this.doc.width, this.doc.height);
    this.layerCanvases.clear();
    this.maskCanvases.clear();
    this.ensureLayerCanvases();

    for (const layer of this.doc.layers) {
      if (layer.rasterDataUrl) {
        try {
          const img = await loadImage(layer.rasterDataUrl);
          const canvas = this.layerCanvases.get(layer.id);
          if (canvas) {
            const ctx = getCtx(canvas);
            ctx.clearRect(0, 0, this.doc.width, this.doc.height);
            ctx.drawImage(img, 0, 0, this.doc.width, this.doc.height);
          }
        } catch {
          // ignore broken raster snapshot
        }
      }
      if (layer.maskDataUrl) {
        try {
          const img = await loadImage(layer.maskDataUrl);
          const maskCanvas = this.ensureMaskCanvas(layer.id);
          const ctx = getCtx(maskCanvas);
          ctx.clearRect(0, 0, this.doc.width, this.doc.height);
          ctx.drawImage(img, 0, 0, this.doc.width, this.doc.height);
        } catch {
          // ignore
        }
      }
    }

    await this.refreshAllLayerPreviews();
    this.emitChange();
  }

  public resizeCanvas(newWidth: number, newHeight: number, dpi = this.doc.dpi) {
    const w = Math.max(16, Math.min(4096, Math.round(newWidth)));
    const h = Math.max(16, Math.min(4096, Math.round(newHeight)));
    this.pushHistorySnapshot();

    const oldCanvases = new Map(this.layerCanvases);
    const oldMasks = new Map(this.maskCanvases);

    this.doc = {
      ...this.doc,
      width: w,
      height: h,
      dpi,
      updatedAt: new Date().toISOString(),
    };
    this.compositeCanvas = createBackingCanvas(w, h);
    this.strokeScratchCanvas = createBackingCanvas(w, h);
    this.layerCanvases.clear();
    this.maskCanvases.clear();
    this.ensureLayerCanvases();

    for (const [id, oldC] of oldCanvases) {
      const nextC = this.layerCanvases.get(id);
      if (nextC) {
        const ctx = getCtx(nextC);
        ctx.drawImage(oldC as CanvasImageSource, 0, 0);
      }
    }
    for (const [id, oldM] of oldMasks) {
      const nextM = this.ensureMaskCanvas(id);
      const ctx = getCtx(nextM);
      ctx.drawImage(oldM as CanvasImageSource, 0, 0);
    }
    this.emitChange();
  }

  private ensureLayerCanvases() {
    for (const layer of this.doc.layers) {
      if (layer.kind === 'raster' && !this.layerCanvases.has(layer.id)) {
        this.layerCanvases.set(layer.id, createBackingCanvas(this.doc.width, this.doc.height));
      }
      if (layer.maskEnabled && !this.maskCanvases.has(layer.id)) {
        const mc = createBackingCanvas(this.doc.width, this.doc.height);
        const mctx = getCtx(mc);
        mctx.fillStyle = '#FFFFFF';
        mctx.fillRect(0, 0, this.doc.width, this.doc.height);
        this.maskCanvases.set(layer.id, mc);
      }
    }
  }

  private ensureMaskCanvas(layerId: string): AnyCanvas {
    let mc = this.maskCanvases.get(layerId);
    if (!mc) {
      mc = createBackingCanvas(this.doc.width, this.doc.height);
      const ctx = getCtx(mc);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, this.doc.width, this.doc.height);
      this.maskCanvases.set(layerId, mc);
    }
    return mc;
  }

  public pushHistorySnapshot() {
    const buffers = new Map<string, ImageData>();
    const masks = new Map<string, ImageData>();
    for (const [id, canvas] of this.layerCanvases) {
      const ctx = getCtx(canvas);
      buffers.set(id, ctx.getImageData(0, 0, this.doc.width, this.doc.height));
    }
    for (const [id, mask] of this.maskCanvases) {
      const ctx = getCtx(mask);
      masks.set(id, ctx.getImageData(0, 0, this.doc.width, this.doc.height));
    }
    this.undoStack.push({
      doc: structuredClone(this.doc),
      buffers,
      masks,
    });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  private captureCurrentSnapshot(): HistorySnapshot {
    const buffers = new Map<string, ImageData>();
    const masks = new Map<string, ImageData>();
    for (const [id, canvas] of this.layerCanvases) {
      buffers.set(id, getCtx(canvas).getImageData(0, 0, this.doc.width, this.doc.height));
    }
    for (const [id, mask] of this.maskCanvases) {
      masks.set(id, getCtx(mask).getImageData(0, 0, this.doc.width, this.doc.height));
    }
    return {
      doc: structuredClone(this.doc),
      buffers,
      masks,
    };
  }

  private restoreSnapshot(snap: HistorySnapshot) {
    this.doc = structuredClone(snap.doc);
    if (this.compositeCanvas.width !== this.doc.width || this.compositeCanvas.height !== this.doc.height) {
      this.compositeCanvas = createBackingCanvas(this.doc.width, this.doc.height);
      this.strokeScratchCanvas = createBackingCanvas(this.doc.width, this.doc.height);
    }
    this.layerCanvases.clear();
    this.maskCanvases.clear();
    this.ensureLayerCanvases();

    for (const [id, imgData] of snap.buffers) {
      const c = this.layerCanvases.get(id) ?? createBackingCanvas(this.doc.width, this.doc.height);
      getCtx(c).putImageData(imgData, 0, 0);
      this.layerCanvases.set(id, c);
    }
    for (const [id, imgData] of snap.masks) {
      const mc = createBackingCanvas(this.doc.width, this.doc.height);
      getCtx(mc).putImageData(imgData, 0, 0);
      this.maskCanvases.set(id, mc);
    }
    this.emitChange();
  }

  public undo(): boolean {
    const prev = this.undoStack.pop();
    if (!prev) return false;
    this.redoStack.push(this.captureCurrentSnapshot());
    this.restoreSnapshot(prev);
    return true;
  }

  public redo(): boolean {
    const next = this.redoStack.pop();
    if (!next) return false;
    this.undoStack.push(this.captureCurrentSnapshot());
    this.restoreSnapshot(next);
    return true;
  }

  // ---- Layer Operations ----
  public setActiveLayer(layerId: string) {
    if (this.doc.activeLayerId === layerId) return;
    this.doc = { ...this.doc, activeLayerId: layerId };
    this.emitChange();
  }

  public addLayer(kind: 'raster' | 'group' = 'raster', name?: string): ArtLayer {
    this.pushHistorySnapshot();
    const id = `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const newLayer: ArtLayer = {
      id,
      name: name ?? (kind === 'group' ? `Group ${this.doc.layers.length + 1}` : `Layer ${this.doc.layers.length + 1}`),
      kind,
      parentId: null,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'source-over',
      alphaLock: false,
      clippingMask: false,
      maskEnabled: false,
    };
    const activeIdx = this.doc.layers.findIndex((l) => l.id === this.doc.activeLayerId);
    const nextLayers = [...this.doc.layers];
    const insertIdx = activeIdx >= 0 ? activeIdx + 1 : nextLayers.length;
    nextLayers.splice(insertIdx, 0, newLayer);

    this.doc = {
      ...this.doc,
      layers: nextLayers,
      activeLayerId: id,
      updatedAt: new Date().toISOString(),
    };
    this.ensureLayerCanvases();
    this.emitChange();
    return newLayer;
  }

  public duplicateLayer(layerId: string) {
    const orig = this.doc.layers.find((l) => l.id === layerId);
    if (!orig) return;
    this.pushHistorySnapshot();
    const copyId = `layer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const copy: ArtLayer = {
      ...structuredClone(orig),
      id: copyId,
      name: `${orig.name} Copy`,
    };
    const idx = this.doc.layers.findIndex((l) => l.id === layerId);
    const nextLayers = [...this.doc.layers];
    nextLayers.splice(idx + 1, 0, copy);
    this.doc = {
      ...this.doc,
      layers: nextLayers,
      activeLayerId: copyId,
      updatedAt: new Date().toISOString(),
    };
    this.ensureLayerCanvases();

    const srcCanvas = this.layerCanvases.get(layerId);
    const dstCanvas = this.layerCanvases.get(copyId);
    if (srcCanvas && dstCanvas) {
      getCtx(dstCanvas).drawImage(srcCanvas as CanvasImageSource, 0, 0);
    }
    const srcMask = this.maskCanvases.get(layerId);
    if (srcMask) {
      const dstMask = this.ensureMaskCanvas(copyId);
      getCtx(dstMask).drawImage(srcMask as CanvasImageSource, 0, 0);
    }
    this.emitChange();
  }

  public deleteLayer(layerId: string) {
    if (this.doc.layers.length <= 1) return;
    this.pushHistorySnapshot();
    const nextLayers = this.doc.layers.filter((l) => l.id !== layerId);
    this.layerCanvases.delete(layerId);
    this.maskCanvases.delete(layerId);
    const nextActive =
      this.doc.activeLayerId === layerId
        ? nextLayers[nextLayers.length - 1].id
        : this.doc.activeLayerId;
    this.doc = {
      ...this.doc,
      layers: nextLayers,
      activeLayerId: nextActive,
      updatedAt: new Date().toISOString(),
    };
    this.emitChange();
  }

  public updateLayer(layerId: string, updater: (l: ArtLayer) => ArtLayer, recordHistory = true) {
    if (recordHistory) this.pushHistorySnapshot();
    this.doc = {
      ...this.doc,
      layers: this.doc.layers.map((l) => (l.id === layerId ? updater(l) : l)),
      updatedAt: new Date().toISOString(),
    };
    this.ensureLayerCanvases();
    this.emitChange();
  }

  public moveLayerOrder(layerId: string, direction: 'up' | 'down') {
    const idx = this.doc.layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    const target = direction === 'up' ? idx + 1 : idx - 1;
    if (target < 0 || target >= this.doc.layers.length) return;
    this.pushHistorySnapshot();
    const next = [...this.doc.layers];
    const [removed] = next.splice(idx, 1);
    next.splice(target, 0, removed);
    this.doc = { ...this.doc, layers: next, updatedAt: new Date().toISOString() };
    this.emitChange();
  }

  public clearLayer(layerId: string) {
    const c = this.layerCanvases.get(layerId);
    if (!c) return;
    this.pushHistorySnapshot();
    getCtx(c).clearRect(0, 0, this.doc.width, this.doc.height);
    this.emitChange();
  }

  public mergeLayerDown(layerId: string) {
    const idx = this.doc.layers.findIndex((l) => l.id === layerId);
    if (idx <= 0) return;
    const upper = this.doc.layers[idx];
    const lower = this.doc.layers[idx - 1];
    if (upper.kind !== 'raster' || lower.kind !== 'raster') return;
    const upperC = this.layerCanvases.get(upper.id);
    const lowerC = this.layerCanvases.get(lower.id);
    if (!upperC || !lowerC) return;

    this.pushHistorySnapshot();
    const lctx = getCtx(lowerC);
    lctx.save();
    lctx.globalAlpha = upper.opacity;
    lctx.globalCompositeOperation = upper.blendMode;
    lctx.drawImage(upperC as CanvasImageSource, 0, 0);
    lctx.restore();

    this.layerCanvases.delete(upper.id);
    this.maskCanvases.delete(upper.id);
    this.doc = {
      ...this.doc,
      layers: this.doc.layers.filter((l) => l.id !== upper.id),
      activeLayerId: lower.id,
      updatedAt: new Date().toISOString(),
    };
    this.emitChange();
  }

  // ---- Texture & Tip Assets ----
  private getProceduralTexturePattern(textureId: BrushConfig['textureId'], customUrl?: string): HTMLCanvasElement | null {
    if (textureId === 'none') return null;
    const key = customUrl ? `custom:${customUrl.slice(0, 48)}` : textureId;
    const cached = this.texturePatternCache.get(key);
    if (cached) return cached;

    const tile = document.createElement('canvas');
    tile.width = 64;
    tile.height = 64;
    const ctx = tile.getContext('2d')!;
    const img = ctx.createImageData(64, 64);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const idx = (y * 64 + x) * 4;
        let alpha = 255;
        if (textureId === 'paper_grain') {
          const n = Math.sin(x * 1.7 + y * 2.3) * 0.5 + Math.cos(x * 3.1 - y * 1.1) * 0.5;
          alpha = Math.max(90, Math.min(255, Math.round(180 + n * 70)));
        } else if (textureId === 'canvas_weave') {
          const wx = Math.sin((x / 4) * Math.PI);
          const wy = Math.sin((y / 4) * Math.PI);
          alpha = Math.round(145 + (wx * wy) * 100);
        } else if (textureId === 'charcoal_tooth') {
          const hash = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
          alpha = hash > 0.38 ? Math.round(120 + hash * 135) : 45;
        } else if (textureId === 'halftone') {
          const dx = (x % 8) - 4;
          const dy = (y % 8) - 4;
          alpha = dx * dx + dy * dy < 6.5 ? 255 : 25;
        }
        img.data[idx] = 255;
        img.data[idx + 1] = 255;
        img.data[idx + 2] = 255;
        img.data[idx + 3] = alpha;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.texturePatternCache.set(key, tile);
    return tile;
  }

  public preloadCustomBrushAssets(brush: BrushConfig) {
    if (brush.tipImageDataUrl && !this.imageCache.has(brush.tipImageDataUrl)) {
      loadImage(brush.tipImageDataUrl)
        .then((img) => this.imageCache.set(brush.tipImageDataUrl!, img))
        .catch(() => {});
    }
    if (brush.textureImageDataUrl && !this.imageCache.has(brush.textureImageDataUrl)) {
      loadImage(brush.textureImageDataUrl)
        .then((img) => this.imageCache.set(brush.textureImageDataUrl!, img))
        .catch(() => {});
    }
  }

  private drawStampShape(
    ctx: AnyCtx,
    stamp: StampPlacement,
    brush: BrushConfig,
    colorHex: string,
    mode: 'paint' | 'erase' | 'smudge' | 'blur',
    targetCanvas: AnyCanvas
  ) {
    const r = Math.max(0.75, stamp.radius);
    const { r: baseR, g: baseG, b: baseB } = hexToRgb(colorHex);
    let drawColor = colorHex;
    if (stamp.hueShift !== 0 || stamp.satShift !== 0 || stamp.briShift !== 0) {
      const hsv = rgbToHsv(baseR, baseG, baseB);
      const h = (hsv.h + stamp.hueShift + 360) % 360;
      const s = Math.max(0, Math.min(1, hsv.s + stamp.satShift / 100));
      const v = Math.max(0, Math.min(1, hsv.v + stamp.briShift / 100));
      const rgb = hsvToRgb(h, s, v);
      drawColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    }

    if (mode === 'blur' || mode === 'smudge') {
      const size = Math.max(4, Math.min(96, Math.round(r * 2)));
      const sx = Math.max(0, Math.min(targetCanvas.width - size, Math.round(stamp.x - size / 2)));
      const sy = Math.max(0, Math.min(targetCanvas.height - size, Math.round(stamp.y - size / 2)));
      if (size <= 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.arc(stamp.x, stamp.y, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.globalAlpha = mode === 'smudge' ? Math.min(0.65, stamp.opacity * 0.75) : Math.min(0.5, stamp.opacity * 0.55);
      if (mode === 'blur') {
        ctx.filter = `blur(${Math.max(1, Math.round(r * 0.25))}px)`;
        ctx.drawImage(targetCanvas as CanvasImageSource, sx, sy, size, size, sx, sy, size, size);
      } else {
        // Smudge offsets previous region slightly along stroke direction
        const ox = Math.cos(stamp.angleRad) * Math.max(1, r * 0.25);
        const oy = Math.sin(stamp.angleRad) * Math.max(1, r * 0.25);
        ctx.drawImage(targetCanvas as CanvasImageSource, sx - ox, sy - oy, size, size, sx, sy, size, size);
      }
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(stamp.x, stamp.y);
    ctx.rotate(stamp.angleRad);
    ctx.globalAlpha = stamp.opacity;

    if (brush.tipShape === 'custom_image' && brush.tipImageDataUrl) {
      const customImg = this.imageCache.get(brush.tipImageDataUrl);
      if (customImg) {
        const sctx = getCtx(this.stampCanvas);
        const dim = Math.max(8, Math.min(256, Math.ceil(r * 2)));
        sctx.clearRect(0, 0, dim, dim);
        sctx.save();
        sctx.drawImage(customImg, 0, 0, dim, dim);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = drawColor;
        sctx.fillRect(0, 0, dim, dim);
        sctx.restore();
        ctx.drawImage(this.stampCanvas as CanvasImageSource, 0, 0, dim, dim, -r, -r, r * 2, r * 2);
        ctx.restore();
        return;
      }
    }

    const drawTipPath = (scale = 1) => {
      const sr = r * scale;
      if (brush.tipShape === 'square') {
        ctx.fillStyle = drawColor;
        ctx.fillRect(-sr, -sr, sr * 2, sr * 2);
      } else if (brush.tipShape === 'oval') {
        ctx.beginPath();
        ctx.ellipse(0, 0, sr, sr * 0.52, 0, 0, Math.PI * 2);
        ctx.fillStyle = drawColor;
        ctx.fill();
      } else if (brush.tipShape === 'calligraphy') {
        ctx.beginPath();
        ctx.ellipse(0, 0, sr * 1.15, sr * 0.28, 0, 0, Math.PI * 2);
        ctx.fillStyle = drawColor;
        ctx.fill();
      } else if (brush.tipShape === 'bristle') {
        ctx.fillStyle = drawColor;
        const strands = 6;
        for (let i = 0; i < strands; i++) {
          const offset = ((i / (strands - 1)) - 0.5) * sr * 1.4;
          ctx.beginPath();
          ctx.ellipse(0, offset, sr * 0.75, Math.max(1, sr * 0.14), 0, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (brush.tipShape === 'star') {
        ctx.beginPath();
        for (let i = 0; i < 10; i++) {
          const rad = i % 2 === 0 ? sr : sr * 0.42;
          const a = (i * Math.PI) / 5 - Math.PI / 2;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fillStyle = drawColor;
        ctx.fill();
      } else {
        // Round brush with hardness radial gradient
        if (brush.hardness >= 0.9) {
          ctx.beginPath();
          ctx.arc(0, 0, sr, 0, Math.PI * 2);
          ctx.fillStyle = drawColor;
          ctx.fill();
        } else {
          const grad = ctx.createRadialGradient(0, 0, sr * brush.hardness * 0.65, 0, 0, sr);
          const { r: cr, g: cg, b: cb } = hexToRgb(drawColor);
          grad.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
          grad.addColorStop(Math.max(0.05, brush.hardness), `rgba(${cr},${cg},${cb},0.85)`);
          grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
          ctx.beginPath();
          ctx.arc(0, 0, sr, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }
    };

    drawTipPath(1);

    // Optional Dual Brush secondary scatter dab
    if (brush.dualBrushEnabled) {
      ctx.save();
      ctx.globalAlpha = stamp.opacity * 0.48;
      ctx.translate(
        Math.cos(stamp.angleRad + 1.2) * r * brush.dualBrushScatter,
        Math.sin(stamp.angleRad + 1.2) * r * brush.dualBrushScatter
      );
      drawTipPath(Math.max(0.25, brush.dualBrushSizeRatio));
      ctx.restore();
    }

    // Optional grain texture modulation inside stamp bounds
    if (brush.textureId !== 'none' && brush.grainDepth > 0.05 && mode === 'paint') {
      const tile = this.getProceduralTexturePattern(brush.textureId, brush.textureImageDataUrl);
      if (tile) {
        ctx.globalAlpha = Math.min(0.6, brush.grainDepth * stamp.opacity * 0.65);
        ctx.globalCompositeOperation = 'destination-out';
        const pat = ctx.createPattern(tile, 'repeat');
        if (pat) {
          ctx.fillStyle = pat;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  private applySelectionClip(ctx: AnyCtx) {
    if (!this.selection || this.selection.points.length < 2) return;
    ctx.beginPath();
    if (this.selection.kind === 'rect') {
      const b = this.selection.bounds;
      ctx.rect(b.x, b.y, b.width, b.height);
    } else {
      this.selection.points.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.closePath();
    }
    ctx.clip();
  }

  // ---- Active Stroke Lifecycle ----
  public beginStroke(rawPoint: StrokeInputPoint, brush: BrushConfig) {
    const activeLayer = this.doc.layers.find((l) => l.id === this.doc.activeLayerId);
    if (!activeLayer || activeLayer.locked || activeLayer.kind !== 'raster') return;
    const canvas = this.layerCanvases.get(activeLayer.id);
    if (!canvas) return;

    this.preloadCustomBrushAssets(brush);
    this.pushHistorySnapshot();
    this.preStrokeImage = getCtx(canvas).getImageData(0, 0, this.doc.width, this.doc.height);
    this.lastStabilized = rawPoint;
    this.activeStrokePoints = [rawPoint];
    this.activeStrokeSeed = Math.floor(Math.random() * 100000);
  }

  public extendStroke(
    rawPoint: StrokeInputPoint,
    brush: BrushConfig,
    colorHex: string,
    mode: 'paint' | 'erase' | 'smudge' | 'blur'
  ) {
    const activeLayer = this.doc.layers.find((l) => l.id === this.doc.activeLayerId);
    if (!activeLayer || activeLayer.locked || activeLayer.kind !== 'raster') return;
    const canvas = this.layerCanvases.get(activeLayer.id);
    if (!canvas || !this.preStrokeImage) return;

    const stabilized = stabilizePoint(
      this.lastStabilized,
      rawPoint,
      brush.stabilization,
      brush.smoothing
    );
    this.lastStabilized = stabilized;
    this.activeStrokePoints.push(stabilized);

    // Re-render current stroke smoothly from preStrokeImage into scratch/target
    const ctx = getCtx(canvas);
    ctx.putImageData(this.preStrokeImage, 0, 0);

    const stamps = computeStampPlacements(this.activeStrokePoints, brush, this.activeStrokeSeed);

    if (mode === 'paint') {
      const sctx = getCtx(this.strokeScratchCanvas);
      sctx.clearRect(0, 0, this.doc.width, this.doc.height);
      sctx.save();
      this.applySelectionClip(sctx);
      for (const st of stamps) {
        const symPts = getSymmetryTransforms(
          st.x,
          st.y,
          this.doc.width,
          this.doc.height,
          this.doc.guides.symmetry,
          this.doc.guides.radialSegments
        );
        for (const sp of symPts) {
          this.drawStampShape(sctx, { ...st, x: sp.x, y: sp.y }, brush, colorHex, 'paint', canvas);
        }
      }
      sctx.restore();

      ctx.save();
      if (activeLayer.alphaLock) {
        ctx.globalCompositeOperation = 'source-atop';
      }
      ctx.globalAlpha = brush.opacity;
      ctx.drawImage(this.strokeScratchCanvas as CanvasImageSource, 0, 0);
      ctx.restore();
    } else if (mode === 'erase') {
      ctx.save();
      this.applySelectionClip(ctx);
      ctx.globalCompositeOperation = 'destination-out';
      for (const st of stamps) {
        const symPts = getSymmetryTransforms(
          st.x,
          st.y,
          this.doc.width,
          this.doc.height,
          this.doc.guides.symmetry,
          this.doc.guides.radialSegments
        );
        for (const sp of symPts) {
          this.drawStampShape(ctx, { ...st, x: sp.x, y: sp.y }, brush, '#000000', 'erase', canvas);
        }
      }
      ctx.restore();
    } else {
      ctx.save();
      this.applySelectionClip(ctx);
      for (const st of stamps) {
        const symPts = getSymmetryTransforms(
          st.x,
          st.y,
          this.doc.width,
          this.doc.height,
          this.doc.guides.symmetry,
          this.doc.guides.radialSegments
        );
        for (const sp of symPts) {
          this.drawStampShape(ctx, { ...st, x: sp.x, y: sp.y }, brush, colorHex, mode, canvas);
        }
      }
      ctx.restore();
    }
  }

  public async endStroke() {
    this.activeStrokePoints = [];
    this.lastStabilized = null;
    this.preStrokeImage = null;
    await this.refreshLayerPreview(this.doc.activeLayerId);
    this.doc = { ...this.doc, updatedAt: new Date().toISOString() };
    this.emitChange();
  }

  // ---- Direct Pixel / Shape / Fill Tools ----
  public bucketFill(x: number, y: number, colorHex: string) {
    const activeLayer = this.doc.layers.find((l) => l.id === this.doc.activeLayerId);
    if (!activeLayer || activeLayer.locked || activeLayer.kind !== 'raster') return;
    const canvas = this.layerCanvases.get(activeLayer.id);
    if (!canvas) return;
    this.pushHistorySnapshot();
    const ctx = getCtx(canvas);
    const imgData = ctx.getImageData(0, 0, this.doc.width, this.doc.height);
    const changed = floodFillImageData(imgData, x, y, colorHex, 32);
    if (changed) {
      ctx.putImageData(imgData, 0, 0);
      this.refreshLayerPreview(activeLayer.id).then(() => this.emitChange());
    }
  }

  public drawShape(
    kind: 'line' | 'rect_shape' | 'circle_shape',
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    colorHex: string,
    strokeWidth: number
  ) {
    const activeLayer = this.doc.layers.find((l) => l.id === this.doc.activeLayerId);
    if (!activeLayer || activeLayer.locked || activeLayer.kind !== 'raster') return;
    const canvas = this.layerCanvases.get(activeLayer.id);
    if (!canvas) return;
    this.pushHistorySnapshot();
    const ctx = getCtx(canvas);
    ctx.save();
    this.applySelectionClip(ctx);
    if (activeLayer.alphaLock) ctx.globalCompositeOperation = 'source-atop';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = Math.max(1, strokeWidth);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (kind === 'line') {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    } else if (kind === 'rect_shape') {
      ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
    } else {
      const rx = Math.abs(x2 - x1) / 2;
      const ry = Math.abs(y2 - y1) / 2;
      ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
    this.refreshLayerPreview(activeLayer.id).then(() => this.emitChange());
  }

  public translateActiveLayer(dx: number, dy: number, scale = 1) {
    const activeLayer = this.doc.layers.find((l) => l.id === this.doc.activeLayerId);
    if (!activeLayer || activeLayer.locked || activeLayer.kind !== 'raster') return;
    const canvas = this.layerCanvases.get(activeLayer.id);
    if (!canvas) return;
    this.pushHistorySnapshot();
    const temp = createBackingCanvas(this.doc.width, this.doc.height);
    getCtx(temp).drawImage(canvas as CanvasImageSource, 0, 0);
    const ctx = getCtx(canvas);
    ctx.clearRect(0, 0, this.doc.width, this.doc.height);
    ctx.save();
    const cx = this.doc.width / 2;
    const cy = this.doc.height / 2;
    ctx.translate(cx + dx, cy + dy);
    ctx.scale(scale, scale);
    ctx.drawImage(temp as CanvasImageSource, -cx, -cy);
    ctx.restore();
    this.refreshLayerPreview(activeLayer.id).then(() => this.emitChange());
  }

  public pickColorAt(x: number, y: number): string | null {
    this.renderCompositeToCanvas(this.compositeCanvas, true);
    const px = Math.max(0, Math.min(this.doc.width - 1, Math.floor(x)));
    const py = Math.max(0, Math.min(this.doc.height - 1, Math.floor(y)));
    const data = getCtx(this.compositeCanvas).getImageData(px, py, 1, 1).data;
    if (data[3] === 0) return null;
    return rgbToHex(data[0], data[1], data[2]);
  }

  // ---- Compositing & Previews ----
  public renderCompositeToCanvas(target: CanvasRenderingContext2D | AnyCanvas, includeBackground = true) {
    const targetCanvas =
      'canvas' in target ? (target.canvas as HTMLCanvasElement) : (target as AnyCanvas);
    const ctx = 'canvas' in target ? target : getCtx(targetCanvas);

    ctx.clearRect(0, 0, this.doc.width, this.doc.height);
    if (includeBackground && this.doc.backgroundColor !== 'transparent') {
      ctx.fillStyle = this.doc.backgroundColor;
      ctx.fillRect(0, 0, this.doc.width, this.doc.height);
    }

    let prevBaseLayerId: string | null = null;
    for (const layer of this.doc.layers) {
      if (!layer.visible) continue;
      if (layer.kind !== 'raster') continue;
      const layerCanvas = this.layerCanvases.get(layer.id);
      if (!layerCanvas) continue;

      const sctx = getCtx(this.strokeScratchCanvas);
      sctx.clearRect(0, 0, this.doc.width, this.doc.height);
      sctx.drawImage(layerCanvas as CanvasImageSource, 0, 0);

      if (layer.maskEnabled) {
        const maskC = this.maskCanvases.get(layer.id);
        if (maskC) {
          sctx.save();
          sctx.globalCompositeOperation = 'destination-in';
          sctx.drawImage(maskC as CanvasImageSource, 0, 0);
          sctx.restore();
        }
      }

      if (layer.clippingMask && prevBaseLayerId) {
        const baseC = this.layerCanvases.get(prevBaseLayerId);
        if (baseC) {
          sctx.save();
          sctx.globalCompositeOperation = 'destination-in';
          sctx.drawImage(baseC as CanvasImageSource, 0, 0);
          sctx.restore();
        }
      } else {
        prevBaseLayerId = layer.id;
      }

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = layer.blendMode;
      ctx.drawImage(this.strokeScratchCanvas as CanvasImageSource, 0, 0);
      ctx.restore();
    }
  }

  private async refreshLayerPreview(layerId: string) {
    const layerCanvas = this.layerCanvases.get(layerId);
    if (!layerCanvas) return;
    const thumb = createBackingCanvas(64, 64);
    const tctx = getCtx(thumb);
    tctx.drawImage(layerCanvas as CanvasImageSource, 0, 0, 64, 64);
    const previewDataUrl = await canvasToDataUrl(thumb, 'image/png');
    this.doc = {
      ...this.doc,
      layers: this.doc.layers.map((l) =>
        l.id === layerId ? { ...l, previewDataUrl } : l
      ),
    };
  }

  private async refreshAllLayerPreviews() {
    for (const l of this.doc.layers) {
      if (l.kind === 'raster') {
        await this.refreshLayerPreview(l.id);
      }
    }
  }

  /**
   * Serializes the full document including raster layer PNGs for IndexedDB crash recovery.
   */
  public async serializeForStorage(): Promise<ArtDocument> {
    const serializedLayers: ArtLayer[] = [];
    for (const layer of this.doc.layers) {
      const c = this.layerCanvases.get(layer.id);
      const m = this.maskCanvases.get(layer.id);
      const rasterDataUrl = c ? await canvasToDataUrl(c, 'image/png') : undefined;
      const maskDataUrl = m ? await canvasToDataUrl(m, 'image/png') : undefined;
      serializedLayers.push({
        ...layer,
        rasterDataUrl,
        maskDataUrl,
      });
    }
    return {
      ...this.doc,
      layers: serializedLayers,
    };
  }

  /**
   * Exports composite artwork or single layer as PNG DataURL (transparent or with background).
   */
  public async exportPngDataUrl(options: {
    transparent?: boolean;
    scale?: number;
    layerId?: string;
    maxDim?: number;
  } = {}): Promise<{ dataUrl: string; width: number; height: number }> {
    const scale = options.scale ?? 1;
    let outW = Math.max(1, Math.round(this.doc.width * scale));
    let outH = Math.max(1, Math.round(this.doc.height * scale));
    if (options.maxDim && (outW > options.maxDim || outH > options.maxDim)) {
      const ratio = options.maxDim / Math.max(outW, outH);
      outW = Math.max(1, Math.round(outW * ratio));
      outH = Math.max(1, Math.round(outH * ratio));
    }

    const temp = createBackingCanvas(this.doc.width, this.doc.height);
    if (options.layerId) {
      const lc = this.layerCanvases.get(options.layerId);
      if (lc) getCtx(temp).drawImage(lc as CanvasImageSource, 0, 0);
    } else {
      this.renderCompositeToCanvas(temp, !options.transparent);
    }

    const out = createBackingCanvas(outW, outH);
    getCtx(out).drawImage(temp as CanvasImageSource, 0, 0, outW, outH);
    const dataUrl = await canvasToDataUrl(out, 'image/png');
    return { dataUrl, width: outW, height: outH };
  }

  /**
   * Packs selected visible raster layers into a single Sprite Atlas PNG + SpriteRegion descriptors.
   */
  public async exportSpriteAtlas(layerIds?: string[]): Promise<{
    dataUrl: string;
    width: number;
    height: number;
    sprites: SpriteRegion[];
  }> {
    const targets = this.doc.layers.filter(
      (l) => l.kind === 'raster' && l.visible && (!layerIds || layerIds.includes(l.id))
    );
    const list = targets.length > 0 ? targets : this.doc.layers.filter((l) => l.kind === 'raster').slice(0, 1);

    const cols = Math.ceil(Math.sqrt(list.length));
    const rows = Math.ceil(list.length / cols);
    const cellW = Math.min(256, this.doc.width);
    const cellH = Math.min(256, this.doc.height);
    const atlasW = cols * cellW;
    const atlasH = rows * cellH;
    const atlas = createBackingCanvas(atlasW, atlasH);
    const actx = getCtx(atlas);

    const sprites: SpriteRegion[] = [];
    list.forEach((layer, idx) => {
      const c = this.layerCanvases.get(layer.id);
      if (!c) return;
      const col = idx % cols;
      const row = Math.floor(idx / cols);
      const sx = col * cellW;
      const sy = row * cellH;
      actx.drawImage(c as CanvasImageSource, sx, sy, cellW, cellH);
      sprites.push({
        id: `sp_${layer.id}`,
        name: layer.name,
        x: sx,
        y: sy,
        width: cellW,
        height: cellH,
      });
    });

    const dataUrl = await canvasToDataUrl(atlas, 'image/png');
    return { dataUrl, width: atlasW, height: atlasH, sprites };
  }

  /**
   * Draws an initial demo badge / stroke onto a fresh canvas so users start with something tangible or blank.
   */
  public stampQuickBadge(text: string, bgHex = '#2563EB') {
    const active = this.doc.layers.find((l) => l.id === this.doc.activeLayerId);
    if (!active) return;
    const c = this.layerCanvases.get(active.id);
    if (!c) return;
    const ctx = getCtx(c);
    const cx = this.doc.width / 2;
    const cy = this.doc.height / 2;
    ctx.save();
    ctx.fillStyle = bgHex;
    ctx.beginPath();
    ctx.roundRect(cx - 140, cy - 48, 280, 96, 20);
    ctx.fill();
    ctx.strokeStyle = '#93C5FD';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);
    ctx.restore();
    this.refreshLayerPreview(active.id).then(() => this.emitChange());
  }
}

export function createBlankArtDocument(title = 'Untitled Illustration', width = 1024, height = 1024): ArtDocument {
  const baseLayerId = `layer_${Date.now().toString(36)}_1`;
  const sketchLayerId = `layer_${Date.now().toString(36)}_2`;
  return {
    id: `art_${Date.now().toString(36)}`,
    version: '1.0.0',
    title,
    width,
    height,
    dpi: 300,
    backgroundColor: '#FFFFFF',
    activeLayerId: sketchLayerId,
    layers: [
      {
        id: baseLayerId,
        name: 'Base Color',
        kind: 'raster',
        parentId: null,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'source-over',
        alphaLock: false,
        clippingMask: false,
        maskEnabled: false,
      },
      {
        id: sketchLayerId,
        name: 'Lineart & Ink',
        kind: 'raster',
        parentId: null,
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'source-over',
        alphaLock: false,
        clippingMask: false,
        maskEnabled: false,
      },
    ],
    guides: {
      symmetry: 'none',
      radialSegments: 6,
      gridVisible: false,
      gridSize: 64,
      perspectiveVisible: false,
      vanishingPoints: [
        { x: Math.round(width * 0.2), y: Math.round(height * 0.5) },
        { x: Math.round(width * 0.8), y: Math.round(height * 0.5) },
      ],
    },
    updatedAt: new Date().toISOString(),
  };
}
