import React from 'react';
import { Compass, Hand, Image as ImageIcon, Maximize2, Sliders, X } from 'lucide-react';
import type {
  ArtDocument,
  DrawingGuidesConfig,
  GestureConfig,
  ReferenceImageConfig,
  SymmetryMode,
} from '../../types/artStudio';

interface GuidesAndReferencePanelProps {
  open: boolean;
  onClose: () => void;
  doc: ArtDocument;
  gestures: GestureConfig;
  onResizeCanvas: (w: number, h: number, dpi: number) => void;
  onUpdateDocMeta: (patch: Partial<Pick<ArtDocument, 'title' | 'backgroundColor' | 'dpi' | 'referenceImage'>>) => void;
  onUpdateGuides: (updater: (g: DrawingGuidesConfig) => DrawingGuidesConfig) => void;
  onUpdateGestures: (cfg: GestureConfig) => void;
}

const CANVAS_PRESETS = [
  { label: '1024 × 1024 (Square Illustration)', w: 1024, h: 1024, dpi: 300 },
  { label: '1920 × 1080 (HD Game UI)', w: 1920, h: 1080, dpi: 150 },
  { label: '512 × 512 (Roblox Icon)', w: 512, h: 512, dpi: 300 },
  { label: '256 × 256 (Game Badge)', w: 256, h: 256, dpi: 300 },
];

export const GuidesAndReferencePanel: React.FC<GuidesAndReferencePanelProps> = ({
  open,
  onClose,
  doc,
  gestures,
  onResizeCanvas,
  onUpdateDocMeta,
  onUpdateGuides,
  onUpdateGestures,
}) => {
  const [widthInput, setWidthInput] = React.useState(doc.width);
  const [heightInput, setHeightInput] = React.useState(doc.height);
  const [dpiInput, setDpiInput] = React.useState(doc.dpi);

  React.useEffect(() => {
    setWidthInput(doc.width);
    setHeightInput(doc.height);
    setDpiInput(doc.dpi);
  }, [doc.width, doc.height, doc.dpi]);

  if (!open) return null;

  const refImg: ReferenceImageConfig = doc.referenceImage ?? {
    visible: false,
    dataUrl: '',
    opacity: 0.85,
    x: 24,
    y: 24,
    scale: 1,
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Canvas Guides, Reference and Gestures"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-zinc-800 bg-[#16181D] text-zinc-100 shadow-2xl overflow-hidden text-xs">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold">Canvas, Guides, Reference & Gestures</h2>
          </div>
          <button
            type="button"
            aria-label="Close Canvas and Guides Modal"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {/* Canvas Resolution & Paper */}
          <section className="p-3.5 rounded-lg border border-zinc-800 bg-[#111318] space-y-3">
            <div className="flex items-center gap-2 font-semibold text-zinc-200">
              <Maximize2 className="w-4 h-4 text-emerald-400" />
              <span>Canvas Dimensions & Paper</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {CANVAS_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => onResizeCanvas(p.w, p.h, p.dpi)}
                  className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-[11px]"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2 items-end">
              <label className="space-y-1">
                <span className="text-[11px] text-zinc-400">Width</span>
                <input
                  type="number"
                  min={16}
                  max={4096}
                  value={widthInput}
                  onChange={(e) => setWidthInput(Number(e.target.value) || 512)}
                  className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-zinc-400">Height</span>
                <input
                  type="number"
                  min={16}
                  max={4096}
                  value={heightInput}
                  onChange={(e) => setHeightInput(Number(e.target.value) || 512)}
                  className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-zinc-400">DPI</span>
                <input
                  type="number"
                  min={72}
                  max={600}
                  value={dpiInput}
                  onChange={(e) => setDpiInput(Number(e.target.value) || 300)}
                  className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                />
              </label>
              <button
                type="button"
                onClick={() => onResizeCanvas(widthInput, heightInput, dpiInput)}
                className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                Apply Size
              </button>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <span className="text-zinc-400">Paper Color:</span>
              {['#FFFFFF', '#F3F4F6', '#18181B', 'transparent'].map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => onUpdateDocMeta({ backgroundColor: bg })}
                  className={`px-2 py-1 rounded border text-[11px] ${
                    doc.backgroundColor === bg
                      ? 'border-blue-500 bg-blue-950/30 text-white'
                      : 'border-zinc-700 bg-zinc-900 text-zinc-300'
                  }`}
                >
                  {bg === 'transparent' ? 'Transparent' : bg}
                </button>
              ))}
            </div>
          </section>

          {/* Symmetry & Perspective Guides */}
          <section className="p-3.5 rounded-lg border border-zinc-800 bg-[#111318] space-y-3">
            <div className="flex items-center gap-2 font-semibold text-zinc-200">
              <Sliders className="w-4 h-4 text-amber-400" />
              <span>Symmetry & Perspective Guides</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['none', 'vertical', 'horizontal', 'quadrant', 'radial'] as SymmetryMode[]).map(
                (mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onUpdateGuides((g) => ({ ...g, symmetry: mode }))}
                    className={`px-2.5 py-1 rounded capitalize border ${
                      doc.guides.symmetry === mode
                        ? 'bg-amber-600 border-amber-500 text-white font-medium'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-300'
                    }`}
                  >
                    {mode}
                  </button>
                )
              )}
            </div>
            {doc.guides.symmetry === 'radial' && (
              <label className="flex items-center gap-3">
                <span className="text-zinc-400">Radial Segments:</span>
                <input
                  type="range"
                  min={2}
                  max={16}
                  value={doc.guides.radialSegments}
                  onChange={(e) =>
                    onUpdateGuides((g) => ({ ...g, radialSegments: Number(e.target.value) }))
                  }
                  className="w-40 accent-amber-500"
                />
                <span className="font-mono">{doc.guides.radialSegments}</span>
              </label>
            )}
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={doc.guides.gridVisible}
                  onChange={(e) =>
                    onUpdateGuides((g) => ({ ...g, gridVisible: e.target.checked }))
                  }
                  className="accent-blue-500"
                />
                Show Drawing Grid ({doc.guides.gridSize}px)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={doc.guides.perspectiveVisible}
                  onChange={(e) =>
                    onUpdateGuides((g) => ({ ...g, perspectiveVisible: e.target.checked }))
                  }
                  className="accent-blue-500"
                />
                Show 2-Point Perspective Horizon
              </label>
            </div>
          </section>

          {/* Reference Image Panel */}
          <section className="p-3.5 rounded-lg border border-zinc-800 bg-[#111318] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-zinc-200">
                <ImageIcon className="w-4 h-4 text-purple-400" />
                <span>Floating Reference Image</span>
              </div>
              <label className="px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium cursor-pointer">
                Upload Reference
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      onUpdateDocMeta({
                        referenceImage: {
                          ...refImg,
                          visible: true,
                          dataUrl: String(reader.result),
                        },
                      });
                    };
                    reader.readAsDataURL(f);
                  }}
                />
              </label>
            </div>
            {refImg.dataUrl && (
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={refImg.visible}
                    onChange={(e) =>
                      onUpdateDocMeta({
                        referenceImage: { ...refImg, visible: e.target.checked },
                      })
                    }
                    className="accent-purple-500"
                  />
                  Show Reference Window
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-zinc-400">Opacity</span>
                  <input
                    type="range"
                    min={0.15}
                    max={1}
                    step={0.05}
                    value={refImg.opacity}
                    onChange={(e) =>
                      onUpdateDocMeta({
                        referenceImage: { ...refImg, opacity: Number(e.target.value) },
                      })
                    }
                    className="w-28 accent-purple-500"
                  />
                </label>
              </div>
            )}
          </section>

          {/* Touch & Stylus Gestures */}
          <section className="p-3.5 rounded-lg border border-zinc-800 bg-[#111318] space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-zinc-200">
              <Hand className="w-4 h-4 text-cyan-400" />
              <span>Touch & Stylus Gestures</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gestures.twoFingerTapUndo}
                  onChange={(e) =>
                    onUpdateGestures({ ...gestures, twoFingerTapUndo: e.target.checked })
                  }
                  className="accent-cyan-500"
                />
                Two-Finger Tap to Undo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gestures.threeFingerTapRedo}
                  onChange={(e) =>
                    onUpdateGestures({ ...gestures, threeFingerTapRedo: e.target.checked })
                  }
                  className="accent-cyan-500"
                />
                Three-Finger Tap to Redo
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gestures.pinchToZoom}
                  onChange={(e) =>
                    onUpdateGestures({ ...gestures, pinchToZoom: e.target.checked })
                  }
                  className="accent-cyan-500"
                />
                Two-Finger Pinch & Pan
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={gestures.twoFingerRotate}
                  onChange={(e) =>
                    onUpdateGestures({ ...gestures, twoFingerRotate: e.target.checked })
                  }
                  className="accent-cyan-500"
                />
                Two-Finger Rotate Canvas
              </label>
              <label className="flex items-center gap-2 sm:col-span-2">
                <input
                  type="checkbox"
                  checked={gestures.stylusOnlyDraw}
                  onChange={(e) =>
                    onUpdateGestures({ ...gestures, stylusOnlyDraw: e.target.checked })
                  }
                  className="accent-cyan-500"
                />
                Palm Rejection (Stylus-Only Drawing; Finger Pans)
              </label>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
