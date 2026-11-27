import React from 'react';
import {
  Copy,
  Download,
  FileUp,
  Paintbrush,
  Plus,
  QrCode,
  Trash2,
  X,
} from 'lucide-react';
import type {
  BrushCategory,
  BrushConfig,
  BrushImportReport,
  BrushPack,
  BrushTipShape,
  StrokeInputPoint,
} from '../../types/artStudio';
import { createBaseBrush } from '../../engine/brushPresets';
import { computeStampPlacements } from '../../engine/strokeMath';
import {
  exportBrushPackJson,
  importClipStudioSut,
  importIbisPaintQRFromImageData,
  importNativeBrushPack,
  importPhotoshopAbr,
  importProcreateBrush,
} from '../../engine/brushImporters';

interface BrushStudioModalProps {
  open: boolean;
  onClose: () => void;
  brushPacks: BrushPack[];
  activeBrushId: string;
  activeColor: string;
  onSelectBrush: (brush: BrushConfig) => void;
  onSaveBrush: (packId: string, brush: BrushConfig) => void;
  onDeleteBrush: (packId: string, brushId: string) => void;
  onAddBrushPack: (pack: BrushPack) => void;
}

const CATEGORIES: BrushCategory[] = [
  'pencil',
  'mechanical_pencil',
  'ink_pen',
  'technical_pen',
  'marker',
  'airbrush',
  'soft_brush',
  'hard_brush',
  'watercolor',
  'gouache',
  'oil',
  'charcoal',
  'pastel',
  'crayon',
  'chalk',
  'texture',
  'particle',
  'decorative_stamp',
  'custom',
];

const TIP_SHAPES: BrushTipShape[] = [
  'round',
  'oval',
  'square',
  'calligraphy',
  'bristle',
  'star',
  'custom_image',
];

export const BrushStudioModal: React.FC<BrushStudioModalProps> = ({
  open,
  onClose,
  brushPacks,
  activeBrushId,
  activeColor,
  onSelectBrush,
  onSaveBrush,
  onDeleteBrush,
  onAddBrushPack,
}) => {
  const [tab, setTab] = React.useState<'library' | 'editor' | 'import'>('library');
  const [selectedFolder, setSelectedFolder] = React.useState<string>('All');
  const [importReport, setImportReport] = React.useState<BrushImportReport | null>(null);
  const testCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const isDrawingTestRef = React.useRef(false);
  const testPointsRef = React.useRef<StrokeInputPoint[]>([]);

  // Find active brush & pack
  let currentPack = brushPacks[0];
  let currentBrush = brushPacks[0]?.brushes[0];
  for (const p of brushPacks) {
    const found = p.brushes.find((b) => b.id === activeBrushId);
    if (found) {
      currentPack = p;
      currentBrush = found;
      break;
    }
  }

  const allBrushes = React.useMemo(
    () => brushPacks.flatMap((p) => p.brushes.map((b) => ({ pack: p, brush: b }))),
    [brushPacks]
  );

  const folders = React.useMemo(() => {
    const set = new Set<string>(['All']);
    allBrushes.forEach((item) => set.add(item.brush.folder || 'Core'));
    return Array.from(set);
  }, [allBrushes]);

  const drawPreviewWave = React.useCallback((brush: BrushConfig) => {
    const canvas = testCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pts: StrokeInputPoint[] = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      pts.push({
        x: 20 + t * (canvas.width - 40),
        y: canvas.height / 2 + Math.sin(t * Math.PI * 2.2) * 26,
        pressure: Math.sin(t * Math.PI) * 0.85 + 0.15,
        tiltX: 0,
        tiltY: 0,
        timestamp: i * 16,
      });
    }
    const stamps = computeStampPlacements(pts, brush, 42);
    for (const st of stamps) {
      ctx.save();
      ctx.translate(st.x, st.y);
      ctx.rotate(st.angleRad);
      ctx.globalAlpha = st.opacity;
      ctx.fillStyle = activeColor;
      ctx.beginPath();
      ctx.arc(0, 0, Math.min(28, st.radius), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }, [activeColor]);

  React.useEffect(() => {
    if (open && tab === 'editor' && currentBrush) {
      drawPreviewWave(currentBrush);
    }
  }, [open, tab, currentBrush, drawPreviewWave]);

  if (!open || !currentBrush || !currentPack) return null;

  const updateCurrent = (patch: Partial<BrushConfig>) => {
    const next = { ...currentBrush, ...patch };
    onSaveBrush(currentPack.id, next);
  };

  const handleDuplicateBrush = () => {
    const copy: BrushConfig = {
      ...currentBrush,
      id: `brush_${Date.now().toString(36)}`,
      name: `${currentBrush.name} Copy`,
      category: 'custom',
      folder: 'Custom',
    };
    onSaveBrush(currentPack.id, copy);
    onSelectBrush(copy);
    setTab('editor');
  };

  const handleCreateCustomBrush = () => {
    const fresh = createBaseBrush({
      id: `brush_${Date.now().toString(36)}`,
      name: `Custom Brush ${allBrushes.length + 1}`,
      category: 'custom',
      folder: 'Custom',
    });
    onSaveBrush(currentPack.id, fresh);
    onSelectBrush(fresh);
    setTab('editor');
  };

  const handleExportBrushPack = () => {
    const json = exportBrushPackJson(currentPack);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPack.name.replace(/\s+/g, '_').toLowerCase()}.brushpack`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase();

    if (ext.endsWith('.brushpack') || ext.endsWith('.json')) {
      const text = await file.text();
      const rep = importNativeBrushPack(text);
      setImportReport(rep);
      if (rep.success && rep.importedBrushes.length > 0) {
        const pack: BrushPack = {
          formatVersion: '1.0',
          id: `pack_${Date.now().toString(36)}`,
          name: file.name.replace(/\.[^.]+$/, ''),
          folder: 'Imported',
          author: 'Imported Pack',
          brushes: rep.importedBrushes,
          createdAt: new Date().toISOString(),
        };
        onAddBrushPack(pack);
        onSelectBrush(rep.importedBrushes[0]);
      }
    } else if (ext.endsWith('.abr')) {
      const buf = await file.arrayBuffer();
      const rep = importPhotoshopAbr(buf, file.name);
      setImportReport(rep);
      if (rep.importedBrushes.length > 0) {
        onAddBrushPack({
          formatVersion: '1.0',
          id: `pack_${Date.now().toString(36)}`,
          name: `${file.name} (ABR)`,
          folder: 'Imported ABR',
          author: 'Photoshop Importer',
          brushes: rep.importedBrushes,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (ext.endsWith('.brush') || ext.endsWith('.brushset')) {
      const buf = await file.arrayBuffer();
      const rep = importProcreateBrush(buf, file.name);
      setImportReport(rep);
      if (rep.importedBrushes.length > 0) {
        onAddBrushPack({
          formatVersion: '1.0',
          id: `pack_${Date.now().toString(36)}`,
          name: `${file.name} (Procreate)`,
          folder: 'Imported Procreate',
          author: 'Procreate Importer',
          brushes: rep.importedBrushes,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (ext.endsWith('.sut')) {
      const buf = await file.arrayBuffer();
      const rep = importClipStudioSut(buf, file.name);
      setImportReport(rep);
      if (rep.importedBrushes.length > 0) {
        onAddBrushPack({
          formatVersion: '1.0',
          id: `pack_${Date.now().toString(36)}`,
          name: `${file.name} (CSP)`,
          folder: 'Imported CSP',
          author: 'CSP Importer',
          brushes: rep.importedBrushes,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, c.width, c.height);
        const rep = importIbisPaintQRFromImageData(imgData);
        setImportReport(rep);
        if (rep.success && rep.importedBrushes.length > 0) {
          onAddBrushPack({
            formatVersion: '1.0',
            id: `pack_${Date.now().toString(36)}`,
            name: `QR Import (${file.name})`,
            folder: 'QR Imports',
            author: 'QR Decoder',
            brushes: rep.importedBrushes,
            createdAt: new Date().toISOString(),
          });
          onSelectBrush(rep.importedBrushes[0]);
        }
        URL.revokeObjectURL(url);
      };
      img.src = url;
    }
    e.target.value = '';
  };

  const renderSlider = (
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    onChange: (val: number) => void,
    unit = ''
  ) => (
    <label className="block space-y-1">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-300">{label}</span>
        <span className="font-mono text-zinc-400">
          {Number.isInteger(step) ? value : value.toFixed(2)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-emerald-500"
      />
    </label>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Brush Studio and Importers"
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-zinc-800 bg-[#16181D] text-zinc-100 shadow-2xl overflow-hidden text-xs">
        <div className="px-4 py-3 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Paintbrush className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-semibold">Brush Studio</h2>
            <span className="text-zinc-500">· {currentBrush.name}</span>
          </div>

          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'library', label: '19-Category Library' },
                { id: 'editor', label: 'Custom Brush Editor' },
                { id: 'import', label: 'Import / QR / Packs' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1 rounded font-medium ${
                  tab === t.id
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Close Brush Studio"
              onClick={onClose}
              className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'library' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                  {folders.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSelectedFolder(f)}
                      className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                        selectedFolder === f
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCreateCustomBrush}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> New Brush
                  </button>
                  <button
                    type="button"
                    onClick={handleDuplicateBrush}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                  >
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {allBrushes
                  .filter(
                    (item) => selectedFolder === 'All' || item.brush.folder === selectedFolder
                  )
                  .map(({ pack, brush }) => {
                    const selected = brush.id === currentBrush.id;
                    return (
                      <div
                        key={brush.id}
                        className={`p-3 rounded-lg border flex flex-col justify-between gap-2 transition-colors ${
                          selected
                            ? 'bg-emerald-950/35 border-emerald-500'
                            : 'bg-[#111318] border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectBrush(brush);
                            onClose();
                          }}
                          className="text-left space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-zinc-100">{brush.name}</span>
                            <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-[10px] font-mono text-zinc-400">
                              {brush.category.replace('_', ' ')}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {brush.size}px · {Math.round(brush.hardness * 100)}% hard ·{' '}
                            {brush.textureId === 'none' ? 'Smooth' : brush.textureId.replace('_', ' ')}
                          </div>
                        </button>
                        <div className="flex items-center justify-between pt-1 border-t border-zinc-800/70">
                          <span className="text-[10px] text-zinc-500">{pack.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                onSelectBrush(brush);
                                setTab('editor');
                              }}
                              className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200"
                            >
                              Customize
                            </button>
                            {brush.category === 'custom' && (
                              <button
                                type="button"
                                aria-label={`Delete brush ${brush.name}`}
                                onClick={() => onDeleteBrush(pack.id, brush.id)}
                                className="p-1 text-zinc-500 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {tab === 'editor' && (
            <div className="space-y-4">
              {/* Live Stroke Test Pad */}
              <div className="p-3 rounded-lg border border-zinc-800 bg-[#111318] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">
                    Live Brush Test Pad (drag to draw test strokes)
                  </span>
                  <button
                    type="button"
                    onClick={() => drawPreviewWave(currentBrush)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px]"
                  >
                    Reset Preview Wave
                  </button>
                </div>
                <canvas
                  ref={testCanvasRef}
                  width={760}
                  height={110}
                  aria-label="Brush live stroke test pad"
                  onPointerDown={(e) => {
                    isDrawingTestRef.current = true;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pt: StrokeInputPoint = {
                      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
                      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
                      pressure: e.pressure || 0.65,
                      tiltX: e.tiltX || 0,
                      tiltY: e.tiltY || 0,
                      timestamp: performance.now(),
                    };
                    testPointsRef.current = [pt];
                    e.currentTarget.getContext('2d')?.clearRect(0, 0, e.currentTarget.width, e.currentTarget.height);
                  }}
                  onPointerMove={(e) => {
                    if (!isDrawingTestRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pt: StrokeInputPoint = {
                      x: ((e.clientX - rect.left) / rect.width) * e.currentTarget.width,
                      y: ((e.clientY - rect.top) / rect.height) * e.currentTarget.height,
                      pressure: e.pressure || 0.65,
                      tiltX: e.tiltX || 0,
                      tiltY: e.tiltY || 0,
                      timestamp: performance.now(),
                    };
                    testPointsRef.current.push(pt);
                    const ctx = e.currentTarget.getContext('2d');
                    if (!ctx) return;
                    ctx.clearRect(0, 0, e.currentTarget.width, e.currentTarget.height);
                    const stamps = computeStampPlacements(testPointsRef.current, currentBrush, 7);
                    for (const st of stamps) {
                      ctx.save();
                      ctx.translate(st.x, st.y);
                      ctx.rotate(st.angleRad);
                      ctx.globalAlpha = st.opacity;
                      ctx.fillStyle = activeColor;
                      ctx.beginPath();
                      ctx.arc(0, 0, Math.min(32, st.radius), 0, Math.PI * 2);
                      ctx.fill();
                      ctx.restore();
                    }
                  }}
                  onPointerUp={() => {
                    isDrawingTestRef.current = false;
                  }}
                  className="w-full h-28 rounded border border-zinc-800 bg-zinc-950 touch-none cursor-crosshair"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Identity & Basic */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-[#111318] space-y-2.5">
                  <h3 className="font-semibold text-emerald-400">Basic Settings</h3>
                  <input
                    type="text"
                    aria-label="Brush name"
                    value={currentBrush.name}
                    onChange={(e) => updateCurrent({ name: e.target.value })}
                    className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
                  />
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      aria-label="Brush category"
                      value={currentBrush.category}
                      onChange={(e) => updateCurrent({ category: e.target.value as BrushCategory })}
                      className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      aria-label="Brush folder"
                      value={currentBrush.folder}
                      onChange={(e) => updateCurrent({ folder: e.target.value })}
                      className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
                    />
                  </div>
                  {renderSlider('Size', currentBrush.size, 1, 200, 1, (v) => updateCurrent({ size: v }), 'px')}
                  {renderSlider('Opacity', currentBrush.opacity, 0.05, 1, 0.02, (v) => updateCurrent({ opacity: v }))}
                  {renderSlider('Flow', currentBrush.flow, 0.05, 1, 0.02, (v) => updateCurrent({ flow: v }))}
                  {renderSlider('Spacing', currentBrush.spacing, 0.03, 1.5, 0.01, (v) => updateCurrent({ spacing: v }))}
                  {renderSlider('Hardness', currentBrush.hardness, 0, 1, 0.02, (v) => updateCurrent({ hardness: v }))}
                  {renderSlider('Smoothing', currentBrush.smoothing, 0, 1, 0.05, (v) => updateCurrent({ smoothing: v }))}
                  {renderSlider('Stabilization', currentBrush.stabilization, 0, 1, 0.05, (v) => updateCurrent({ stabilization: v }))}
                </div>

                {/* Stroke Dynamics */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-[#111318] space-y-2.5">
                  <h3 className="font-semibold text-blue-400">Stroke Dynamics</h3>
                  {renderSlider('Pressure → Size', currentBrush.pressureSize, 0, 1, 0.05, (v) => updateCurrent({ pressureSize: v }))}
                  {renderSlider('Pressure → Opacity', currentBrush.pressureOpacity, 0, 1, 0.05, (v) => updateCurrent({ pressureOpacity: v }))}
                  {renderSlider('Tilt Response', currentBrush.tiltResponse, 0, 1, 0.05, (v) => updateCurrent({ tiltResponse: v }))}
                  {renderSlider('Rotation', currentBrush.rotation, 0, 360, 5, (v) => updateCurrent({ rotation: v }), '°')}
                  <label className="flex items-center gap-2 text-[11px] text-zinc-300">
                    <input
                      type="checkbox"
                      checked={currentBrush.rotationFollowsStroke}
                      onChange={(e) => updateCurrent({ rotationFollowsStroke: e.target.checked })}
                      className="accent-blue-500"
                    />
                    Angle Follows Stroke Direction
                  </label>
                  {renderSlider('Scatter', currentBrush.scatter, 0, 2, 0.05, (v) => updateCurrent({ scatter: v }))}
                  {renderSlider('Random Jitter', currentBrush.randomVariation, 0, 1, 0.05, (v) => updateCurrent({ randomVariation: v }))}
                  {renderSlider('Taper Start', currentBrush.taperStart, 0, 1, 0.05, (v) => updateCurrent({ taperStart: v }))}
                  {renderSlider('Taper End', currentBrush.taperEnd, 0, 1, 0.05, (v) => updateCurrent({ taperEnd: v }))}
                  {renderSlider('Velocity Response', currentBrush.velocityResponse, -1, 1, 0.05, (v) => updateCurrent({ velocityResponse: v }))}
                </div>

                {/* Brush Construction */}
                <div className="p-3 rounded-lg border border-zinc-800 bg-[#111318] space-y-2.5">
                  <h3 className="font-semibold text-amber-400">Construction & Grain</h3>
                  <label className="block space-y-1">
                    <span className="text-[11px] text-zinc-400">Brush Tip Shape</span>
                    <select
                      value={currentBrush.tipShape}
                      onChange={(e) => updateCurrent({ tipShape: e.target.value as BrushTipShape })}
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
                    >
                      {TIP_SHAPES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 cursor-pointer text-[11px]">
                    <FileUp className="w-3.5 h-3.5" /> Import Custom Tip PNG
                    <input
                      type="file"
                      accept="image/png,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const reader = new FileReader();
                        reader.onload = () =>
                          updateCurrent({
                            tipShape: 'custom_image',
                            tipImageDataUrl: String(reader.result),
                          });
                        reader.readAsDataURL(f);
                      }}
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] text-zinc-400">Texture / Grain</span>
                    <select
                      value={currentBrush.textureId}
                      onChange={(e) =>
                        updateCurrent({ textureId: e.target.value as BrushConfig['textureId'] })
                      }
                      className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700"
                    >
                      <option value="none">None</option>
                      <option value="paper_grain">Paper Grain</option>
                      <option value="canvas_weave">Canvas Weave</option>
                      <option value="charcoal_tooth">Charcoal Tooth</option>
                      <option value="halftone">Halftone Dots</option>
                    </select>
                  </label>

                  {renderSlider('Grain Depth', currentBrush.grainDepth, 0, 1, 0.05, (v) => updateCurrent({ grainDepth: v }))}

                  <label className="flex items-center gap-2 text-[11px] text-zinc-300 pt-1">
                    <input
                      type="checkbox"
                      checked={currentBrush.dualBrushEnabled}
                      onChange={(e) => updateCurrent({ dualBrushEnabled: e.target.checked })}
                      className="accent-amber-500"
                    />
                    Enable Dual Brush Stamp
                  </label>
                  {currentBrush.dualBrushEnabled && (
                    <>
                      {renderSlider('Dual Ratio', currentBrush.dualBrushSizeRatio, 0.2, 1.8, 0.05, (v) => updateCurrent({ dualBrushSizeRatio: v }))}
                      {renderSlider('Dual Scatter', currentBrush.dualBrushScatter, 0, 1.5, 0.05, (v) => updateCurrent({ dualBrushScatter: v }))}
                    </>
                  )}
                  {renderSlider('Hue Jitter', currentBrush.colorDynamicsHue, 0, 1, 0.05, (v) => updateCurrent({ colorDynamicsHue: v }))}
                  {renderSlider('Brightness Jitter', currentBrush.colorDynamicsBri, 0, 1, 0.05, (v) => updateCurrent({ colorDynamicsBri: v }))}
                </div>
              </div>
            </div>
          )}

          {tab === 'import' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-zinc-800 bg-[#111318] space-y-3">
                  <div className="flex items-center gap-2 font-semibold text-emerald-400">
                    <QrCode className="w-4 h-4" />
                    <span>Import Brushes, QR Codes & External Packs</span>
                  </div>
                  <p className="text-zinc-400 leading-relaxed">
                    Supports native <code className="text-zinc-200">.brushpack</code> JSON packs, ibisPaint QR code images (decoded via jsQR), plus metadata/fallback inspection for Photoshop <code className="text-zinc-200">.abr</code>, Procreate <code className="text-zinc-200">.brush/.brushset</code>, and Clip Studio Paint <code className="text-zinc-200">.sut</code>.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium cursor-pointer">
                      <FileUp className="w-4 h-4" />
                      <span>Import Brush File or QR Image</span>
                      <input
                        type="file"
                        accept=".brushpack,.json,.abr,.brush,.brushset,.sut,image/*"
                        onChange={handleFileImport}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleExportBrushPack}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium"
                    >
                      <Download className="w-4 h-4" />
                      Export Current .brushpack
                    </button>
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-zinc-800 bg-[#111318] space-y-2">
                  <h3 className="font-semibold text-zinc-200">Compatibility & Honest Reporting</h3>
                  {!importReport ? (
                    <p className="text-zinc-500">
                      Select a `.brushpack`, QR code PNG, `.abr`, `.brush`, or `.sut` file to view decoded brush parameters, warnings, and any unsupported proprietary features.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-100">
                          Format: {importReport.sourceFormat}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            importReport.success
                              ? 'bg-emerald-950 text-emerald-300'
                              : 'bg-red-950 text-red-300'
                          }`}
                        >
                          {importReport.success
                            ? `${importReport.importedBrushes.length} Brush(es) Imported`
                            : 'Import Failed'}
                        </span>
                      </div>
                      {importReport.warnings.length > 0 && (
                        <ul className="list-disc pl-4 text-amber-300 space-y-0.5">
                          {importReport.warnings.map((w, i) => (
                            <li key={i}>{w}</li>
                          ))}
                        </ul>
                      )}
                      {importReport.unsupportedFeatures.length > 0 && (
                        <div className="pt-1">
                          <div className="text-[11px] font-semibold text-zinc-400">
                            Unsupported Proprietary Features:
                          </div>
                          <ul className="list-disc pl-4 text-zinc-400 space-y-0.5">
                            {importReport.unsupportedFeatures.map((u, i) => (
                              <li key={i}>{u}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
