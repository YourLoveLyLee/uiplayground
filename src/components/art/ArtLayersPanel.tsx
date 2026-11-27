import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  FolderPlus,
  Layers,
  Lock,
  Plus,
  Scissors,
  Trash2,
  Unlock,
} from 'lucide-react';
import type { ArtLayer } from '../../types/artStudio';

interface ArtLayersPanelProps {
  layers: ArtLayer[];
  activeLayerId: string;
  onSelectLayer: (id: string) => void;
  onAddLayer: (kind: 'raster' | 'group') => void;
  onDuplicateLayer: (id: string) => void;
  onDeleteLayer: (id: string) => void;
  onClearLayer: (id: string) => void;
  onMergeDown: (id: string) => void;
  onMoveLayer: (id: string, dir: 'up' | 'down') => void;
  onUpdateLayer: (id: string, updater: (l: ArtLayer) => ArtLayer) => void;
}

const BLEND_MODES: Array<{ value: GlobalCompositeOperation; label: string }> = [
  { value: 'source-over', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Add / Dodge' },
  { value: 'soft-light', label: 'Soft Light' },
];

export const ArtLayersPanel: React.FC<ArtLayersPanelProps> = ({
  layers,
  activeLayerId,
  onSelectLayer,
  onAddLayer,
  onDuplicateLayer,
  onDeleteLayer,
  onClearLayer,
  onMergeDown,
  onMoveLayer,
  onUpdateLayer,
}) => {
  const activeLayer = layers.find((l) => l.id === activeLayerId);
  // Display top-most layer first
  const ordered = [...layers].reverse();

  return (
    <div className="flex flex-col h-full text-xs">
      <div className="flex items-center justify-between pb-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-1.5 font-semibold text-zinc-100">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Layers ({layers.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="New Raster Layer"
            aria-label="Add raster layer"
            onClick={() => onAddLayer('raster')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Layer
          </button>
          <button
            type="button"
            title="New Layer Group"
            aria-label="Add layer group"
            onClick={() => onAddLayer('group')}
            className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active Layer Controls */}
      {activeLayer && (
        <div className="py-2.5 border-b border-zinc-800 space-y-2">
          <div className="flex items-center gap-2">
            <select
              aria-label="Layer blend mode"
              value={activeLayer.blendMode}
              onChange={(e) =>
                onUpdateLayer(activeLayer.id, (l) => ({
                  ...l,
                  blendMode: e.target.value as GlobalCompositeOperation,
                }))
              }
              className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
            >
              {BLEND_MODES.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
            <span className="font-mono text-zinc-400 w-10 text-right">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            aria-label="Layer opacity"
            min="0"
            max="1"
            step="0.02"
            value={activeLayer.opacity}
            onChange={(e) =>
              onUpdateLayer(activeLayer.id, (l) => ({
                ...l,
                opacity: Number(e.target.value),
              }))
            }
            className="w-full accent-emerald-500"
          />

          <div className="grid grid-cols-3 gap-1 text-[11px]">
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(activeLayer.id, (l) => ({ ...l, alphaLock: !l.alphaLock }))
              }
              className={`px-2 py-1 rounded border ${
                activeLayer.alphaLock
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              Alpha Lock
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(activeLayer.id, (l) => ({ ...l, clippingMask: !l.clippingMask }))
              }
              className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded border ${
                activeLayer.clippingMask
                  ? 'bg-amber-950/60 border-amber-500 text-amber-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              <Scissors className="w-3 h-3" /> Clip
            </button>
            <button
              type="button"
              onClick={() =>
                onUpdateLayer(activeLayer.id, (l) => ({ ...l, maskEnabled: !l.maskEnabled }))
              }
              className={`px-2 py-1 rounded border ${
                activeLayer.maskEnabled
                  ? 'bg-blue-950/60 border-blue-500 text-blue-300'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400'
              }`}
            >
              Mask
            </button>
          </div>
        </div>
      )}

      {/* Layer Stack */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1.5">
        {ordered.map((layer) => {
          const active = layer.id === activeLayerId;
          return (
            <div
              key={layer.id}
              className={`p-2 rounded-lg border transition-colors ${
                active
                  ? 'bg-emerald-950/30 border-emerald-500'
                  : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label={`Select layer ${layer.name}`}
                  onClick={() => onSelectLayer(layer.id)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                >
                  <div
                    className="w-9 h-9 rounded border border-zinc-700 shrink-0 overflow-hidden bg-zinc-950 flex items-center justify-center"
                    style={{
                      backgroundImage:
                        'linear-gradient(45deg, #1f2937 25%, transparent 25%), linear-gradient(-45deg, #1f2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2937 75%), linear-gradient(-45deg, transparent 75%, #1f2937 75%)',
                      backgroundSize: '8px 8px',
                    }}
                  >
                    {layer.previewDataUrl ? (
                      <img
                        src={layer.previewDataUrl}
                        alt={layer.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <span className="text-[9px] text-zinc-600">
                        {layer.kind === 'group' ? 'GRP' : ''}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-zinc-100 truncate">
                      {layer.clippingMask ? '↳ ' : ''}
                      {layer.name}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {Math.round(layer.opacity * 100)}%
                      {layer.alphaLock ? ' · α-Lock' : ''}
                      {layer.maskEnabled ? ' · Mask' : ''}
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  aria-label={`Toggle visibility for ${layer.name}`}
                  onClick={() => onUpdateLayer(layer.id, (l) => ({ ...l, visible: !l.visible }))}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
                >
                  {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-zinc-600" />}
                </button>
                <button
                  type="button"
                  aria-label={`Toggle lock for ${layer.name}`}
                  onClick={() => onUpdateLayer(layer.id, (l) => ({ ...l, locked: !l.locked }))}
                  className="p-1 rounded hover:bg-zinc-800 text-zinc-300"
                >
                  {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5 text-zinc-500" />}
                </button>
              </div>

              {active && (
                <div className="mt-2 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Move ${layer.name} up`}
                      onClick={() => onMoveLayer(layer.id, 'up')}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${layer.name} down`}
                      onClick={() => onMoveLayer(layer.id, 'down')}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Duplicate ${layer.name}`}
                      onClick={() => onDuplicateLayer(layer.id)}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Clear ${layer.name}`}
                      onClick={() => onClearLayer(layer.id)}
                      className="p-1 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
                    >
                      <Eraser className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onMergeDown(layer.id)}
                      className="px-1.5 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-[10px] text-zinc-300"
                    >
                      Merge
                    </button>
                    {layers.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Delete ${layer.name}`}
                        onClick={() => onDeleteLayer(layer.id)}
                        className="p-1 rounded bg-zinc-900 hover:bg-red-950 text-zinc-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
