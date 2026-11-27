import React from 'react';
import { Grid, ImagePlus, Plus, Trash2 } from 'lucide-react';
import type { AssetItem, SpriteRegion } from '../types/roblox';
import { createId } from '../utils/projectLogic';

interface AssetManagerProps {
  assets: AssetItem[];
  selectedElementName: string | null;
  onAddAssets: (items: AssetItem[]) => void;
  onUpdateAsset: (id: string, updater: (a: AssetItem) => AssetItem) => void;
  onDeleteAsset: (id: string) => void;
  onAssignToSelected: (assetId: string, spriteId?: string) => void;
}

export const AssetManager: React.FC<AssetManagerProps> = ({
  assets,
  selectedElementName,
  onAddAssets,
  onUpdateAsset,
  onDeleteAsset,
  onAssignToSelected,
}) => {
  const [selectedAssetId, setSelectedAssetId] = React.useState<string>(assets[0]?.id ?? '');
  const [sliceGrid, setSliceGrid] = React.useState({ cols: 2, rows: 2 });

  const activeAsset = assets.find((a) => a.id === selectedAssetId) ?? assets[0];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const loaded: AssetItem[] = [];
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });

      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth || 256, h: img.naturalHeight || 256 });
        img.onerror = () => resolve({ w: 256, h: 256 });
        img.src = dataUrl;
      });

      loaded.push({
        id: createId('asset'),
        name: file.name.replace(/\.[^.]+$/, ''),
        mimeType: file.type || 'image/png',
        dataUrl,
        width: dims.w,
        height: dims.h,
        isAtlas: false,
        sprites: [],
      });
    }

    onAddAssets(loaded);
    if (loaded[0]) setSelectedAssetId(loaded[0].id);
    e.target.value = '';
  };

  const generateSampleAtlas = () => {
    // Programmatic transparent SVG sprite sheet for immediate testing without local files
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect x="8" y="8" width="112" height="112" rx="16" fill="#2563EB"/>
      <polygon points="64,34 94,92 34,92" fill="#FFFFFF"/>
      <rect x="136" y="8" width="112" height="112" rx="16" fill="#059669"/>
      <circle cx="192" cy="64" r="28" fill="#FFFFFF"/>
      <rect x="8" y="136" width="112" height="112" rx="16" fill="#D97706"/>
      <rect x="38" y="166" width="52" height="52" rx="8" fill="#FFFFFF"/>
      <rect x="136" y="136" width="112" height="112" rx="16" fill="#DC2626"/>
      <path d="M168 168 L216 216 M216 168 L168 216" stroke="#FFFFFF" stroke-width="12" stroke-linecap="round"/>
    </svg>`;
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
    const sample: AssetItem = {
      id: createId('asset'),
      name: 'IconSpriteAtlas',
      mimeType: 'image/svg+xml',
      dataUrl,
      width: 256,
      height: 256,
      isAtlas: true,
      sprites: [
        { id: createId('sp'), name: 'BluePlay', x: 0, y: 0, width: 128, height: 128 },
        { id: createId('sp'), name: 'GreenConfirm', x: 128, y: 0, width: 128, height: 128 },
        { id: createId('sp'), name: 'AmberCrate', x: 0, y: 128, width: 128, height: 128 },
        { id: createId('sp'), name: 'RedClose', x: 128, y: 128, width: 128, height: 128 },
      ],
    };
    onAddAssets([sample]);
    setSelectedAssetId(sample.id);
  };

  const autoSliceAtlas = () => {
    if (!activeAsset) return;
    const cols = Math.max(1, sliceGrid.cols);
    const rows = Math.max(1, sliceGrid.rows);
    const sw = Math.floor(activeAsset.width / cols);
    const sh = Math.floor(activeAsset.height / rows);
    const regions: SpriteRegion[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        regions.push({
          id: createId('sp'),
          name: `${activeAsset.name}_${r}_${c}`,
          x: c * sw,
          y: r * sh,
          width: sw,
          height: sh,
        });
      }
    }
    onUpdateAsset(activeAsset.id, (a) => ({
      ...a,
      isAtlas: true,
      sprites: regions,
    }));
  };

  const addManualSprite = () => {
    if (!activeAsset) return;
    const region: SpriteRegion = {
      id: createId('sp'),
      name: `Sprite_${activeAsset.sprites.length + 1}`,
      x: 0,
      y: 0,
      width: Math.min(128, activeAsset.width),
      height: Math.min(128, activeAsset.height),
    };
    onUpdateAsset(activeAsset.id, (a) => ({
      ...a,
      isAtlas: true,
      sprites: [...a.sprites, region],
    }));
  };

  return (
    <div className="flex-1 h-full flex overflow-hidden bg-[#0E1014] text-xs">
      {/* Left: Asset Inventory */}
      <aside className="w-72 shrink-0 border-r border-zinc-800 bg-[#16181D] flex flex-col">
        <div className="p-3.5 border-b border-zinc-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-zinc-100">Image & Atlas Assets</h2>
            <span className="text-zinc-500 font-mono">{assets.length}</span>
          </div>

          <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium cursor-pointer">
            <ImagePlus className="w-4 h-4" />
            <span>Import PNG / JPG / SVG</span>
            <input
              type="file"
              multiple
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          <button
            type="button"
            onClick={generateSampleAtlas}
            className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium"
          >
            + Create Sample 2×2 Sprite Atlas
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {assets.map((asset) => {
            const active = activeAsset?.id === asset.id;
            return (
              <div
                key={asset.id}
                className={`flex items-center gap-2.5 p-2 rounded border transition-colors ${
                  active
                    ? 'bg-blue-950/30 border-blue-500'
                    : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedAssetId(asset.id)}
                  className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                >
                  <img
                    src={asset.dataUrl}
                    alt={asset.name}
                    className="w-10 h-10 rounded object-contain bg-zinc-950 border border-zinc-800 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-zinc-100 truncate">{asset.name}</div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      {asset.width}×{asset.height}
                      {asset.isAtlas ? ` · ${asset.sprites.length} sprites` : ''}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Delete asset ${asset.name}`}
                  onClick={() => onDeleteAsset(asset.id)}
                  className="p-1 text-zinc-500 hover:text-red-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right: Sprite Atlas Inspector & Slicer */}
      <div className="flex-1 overflow-y-auto p-6">
        {!activeAsset ? (
          <div className="h-full flex items-center justify-center text-zinc-500">
            Import PNG, JPG, or SVG images—or create a sample sprite atlas—to slice sprites and assign them to visual states.
          </div>
        ) : (
          <div className="max-w-5xl space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
              <div className="space-y-1">
                <input
                  type="text"
                  aria-label="Asset name"
                  value={activeAsset.name}
                  onChange={(e) =>
                    onUpdateAsset(activeAsset.id, (a) => ({ ...a, name: e.target.value }))
                  }
                  className="text-base font-semibold bg-transparent border-b border-transparent focus:border-blue-500 text-zinc-100 outline-none"
                />
                <div className="text-xs font-mono text-zinc-400">
                  {activeAsset.width} × {activeAsset.height}px · {activeAsset.mimeType}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="Optional Roblox Asset ID (e.g. 12345678)"
                  value={activeAsset.robloxAssetId ?? ''}
                  onChange={(e) =>
                    onUpdateAsset(activeAsset.id, (a) => ({
                      ...a,
                      robloxAssetId: e.target.value,
                    }))
                  }
                  className="w-60 px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono"
                />
                {selectedElementName && (
                  <button
                    type="button"
                    onClick={() => onAssignToSelected(activeAsset.id)}
                    className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
                  >
                    Assign Full Image to {selectedElementName}
                  </button>
                )}
              </div>
            </div>

            {/* Atlas Preview with Region Boxes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200">Atlas Preview</span>
                  <label className="flex items-center gap-1.5 text-zinc-300">
                    <input
                      type="checkbox"
                      checked={activeAsset.isAtlas}
                      onChange={(e) =>
                        onUpdateAsset(activeAsset.id, (a) => ({
                          ...a,
                          isAtlas: e.target.checked,
                        }))
                      }
                      className="accent-blue-600"
                    />
                    Sprite Atlas Mode
                  </label>
                </div>

                <div
                  className="relative inline-block border border-zinc-700 rounded bg-zinc-950 overflow-hidden"
                  style={{
                    backgroundImage:
                      'linear-gradient(45deg, #18181b 25%, transparent 25%), linear-gradient(-45deg, #18181b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #18181b 75%), linear-gradient(-45deg, transparent 75%, #18181b 75%)',
                    backgroundSize: '16px 16px',
                  }}
                >
                  <img
                    src={activeAsset.dataUrl}
                    alt={activeAsset.name}
                    className="max-w-full max-h-[380px] block"
                  />
                  {activeAsset.isAtlas &&
                    activeAsset.sprites.map((sp) => (
                      <div
                        key={sp.id}
                        title={sp.name}
                        className="absolute border border-amber-400 bg-amber-400/10 pointer-events-none"
                        style={{
                          left: `${(sp.x / activeAsset.width) * 100}%`,
                          top: `${(sp.y / activeAsset.height) * 100}%`,
                          width: `${(sp.width / activeAsset.width) * 100}%`,
                          height: `${(sp.height / activeAsset.height) * 100}%`,
                        }}
                      >
                        <span className="px-1 bg-amber-500 text-zinc-950 text-[9px] font-mono font-bold">
                          {sp.name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Sprite Regions Editor */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-zinc-200">
                    Sprite Regions ({activeAsset.sprites.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      max="16"
                      aria-label="Atlas columns"
                      value={sliceGrid.cols}
                      onChange={(e) =>
                        setSliceGrid((g) => ({ ...g, cols: Math.max(1, Number(e.target.value) || 1) }))
                      }
                      className="w-12 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                    />
                    <span className="text-zinc-500">×</span>
                    <input
                      type="number"
                      min="1"
                      max="16"
                      aria-label="Atlas rows"
                      value={sliceGrid.rows}
                      onChange={(e) =>
                        setSliceGrid((g) => ({ ...g, rows: Math.max(1, Number(e.target.value) || 1) }))
                      }
                      className="w-12 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                    />
                    <button
                      type="button"
                      onClick={autoSliceAtlas}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                    >
                      <Grid className="w-3.5 h-3.5" /> Grid Slice
                    </button>
                    <button
                      type="button"
                      onClick={addManualSprite}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                    >
                      <Plus className="w-3.5 h-3.5" /> Region
                    </button>
                  </div>
                </div>

                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {activeAsset.sprites.map((sp) => (
                    <div
                      key={sp.id}
                      className="p-2.5 rounded bg-[#16181D] border border-zinc-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={sp.name}
                          onChange={(e) =>
                            onUpdateAsset(activeAsset.id, (a) => ({
                              ...a,
                              sprites: a.sprites.map((item) =>
                                item.id === sp.id ? { ...item, name: e.target.value } : item
                              ),
                            }))
                          }
                          className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 font-medium"
                        />
                        {selectedElementName && (
                          <button
                            type="button"
                            onClick={() => onAssignToSelected(activeAsset.id, sp.id)}
                            className="px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white whitespace-nowrap"
                          >
                            Use on {selectedElementName}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Delete sprite ${sp.name}`}
                          onClick={() =>
                            onUpdateAsset(activeAsset.id, (a) => ({
                              ...a,
                              sprites: a.sprites.filter((item) => item.id !== sp.id),
                            }))
                          }
                          className="p-1 text-zinc-500 hover:text-red-400"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {(['x', 'y', 'width', 'height'] as const).map((coord) => (
                          <label key={coord} className="block space-y-0.5">
                            <span className="text-[10px] text-zinc-500 uppercase font-mono">
                              {coord}
                            </span>
                            <input
                              type="number"
                              value={sp[coord]}
                              onChange={(e) => {
                                const val = Math.max(0, Number(e.target.value) || 0);
                                onUpdateAsset(activeAsset.id, (a) => ({
                                  ...a,
                                  sprites: a.sprites.map((item) =>
                                    item.id === sp.id ? { ...item, [coord]: val } : item
                                  ),
                                }));
                              }}
                              className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
