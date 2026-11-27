import React from 'react';
import { ArrowRight, Check, Layers, PackagePlus, X } from 'lucide-react';
import type { ArtLayer } from '../../types/artStudio';
import type { ComponentStateName, UIElement } from '../../types/roblox';

interface SendToUIWorkshopModalProps {
  open: boolean;
  onClose: () => void;
  docTitle: string;
  layers: ArtLayer[];
  uiElements: UIElement[];
  onConfirmExport: (options: {
    exportKind: 'transparent_png' | 'opaque_png' | 'active_layer' | 'sprite_atlas';
    scale: number;
    assetName: string;
    targetElementId: string | 'new_image' | 'none';
    targetState: ComponentStateName;
    switchToUI: boolean;
  }) => Promise<void>;
}

const STATES: ComponentStateName[] = [
  'idle',
  'hover',
  'pressed',
  'disabled',
  'selected',
  'focused',
];

export const SendToUIWorkshopModal: React.FC<SendToUIWorkshopModalProps> = ({
  open,
  onClose,
  docTitle,
  layers,
  uiElements,
  onConfirmExport,
}) => {
  const [exportKind, setExportKind] = React.useState<
    'transparent_png' | 'opaque_png' | 'active_layer' | 'sprite_atlas'
  >('transparent_png');
  const [scale, setScale] = React.useState(0.5);
  const [assetName, setAssetName] = React.useState(`${docTitle || 'ArtAsset'}`);
  const [targetElementId, setTargetElementId] = React.useState<string>('new_image');
  const [targetState, setTargetState] = React.useState<ComponentStateName>('idle');
  const [switchToUI, setSwitchToUI] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setAssetName(docTitle || 'ArtAsset');
    }
  }, [open, docTitle]);

  if (!open) return null;

  const handleSubmit = async () => {
    setBusy(true);
    try {
      await onConfirmExport({
        exportKind,
        scale,
        assetName: assetName.trim() || 'ArtAsset',
        targetElementId,
        targetState,
        switchToUI,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Send Artwork to UI Workshop"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-[#16181D] text-zinc-100 shadow-2xl overflow-hidden text-xs">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PackagePlus className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold">Send Artwork to UI Workshop</h2>
          </div>
          <button
            type="button"
            aria-label="Close Send to UI Modal"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <label className="block space-y-1">
            <span className="text-zinc-300 font-medium">Shared Asset Name</span>
            <input
              type="text"
              value={assetName}
              onChange={(e) => setAssetName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
            />
          </label>

          <div className="space-y-1.5">
            <span className="text-zinc-300 font-medium block">Export Format</span>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'transparent_png', label: 'Transparent PNG', sub: 'Best for icons & buttons' },
                  { id: 'opaque_png', label: 'Flat Composite PNG', sub: 'Includes paper background' },
                  { id: 'active_layer', label: 'Active Layer PNG', sub: 'Single isolated layer' },
                  {
                    id: 'sprite_atlas',
                    label: 'Sprite Atlas Sheet',
                    sub: `${layers.filter((l) => l.visible && l.kind === 'raster').length} visible layers packed`,
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExportKind(opt.id)}
                  className={`p-2.5 rounded-lg border text-left ${
                    exportKind === opt.id
                      ? 'bg-blue-950/40 border-blue-500 text-white'
                      : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
                  }`}
                >
                  <div className="font-semibold">{opt.label}</div>
                  <div className="text-[10px] text-zinc-400">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-zinc-300 font-medium">Export Scale</span>
              <select
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700"
              >
                <option value={1}>1× Full Resolution</option>
                <option value={0.5}>0.5× UI Ready</option>
                <option value={0.25}>0.25× Compact Icon</option>
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-zinc-300 font-medium">Target UI Element</span>
              <select
                aria-label="Target UI Element"
                value={targetElementId}
                onChange={(e) => setTargetElementId(e.target.value)}
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700"
              >
                <option value="new_image">+ Create New Image Element</option>
                <option value="none">Shared Assets Library Only</option>
                {uiElements.map((el) => (
                  <option key={el.id} value={el.id}>
                    Bind to: {el.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {targetElementId !== 'none' && targetElementId !== 'new_image' && (
            <label className="block space-y-1">
              <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                Assign to Visual State
              </span>
              <select
                aria-label="Target Visual State"
                value={targetState}
                onChange={(e) => setTargetState(e.target.value as ComponentStateName)}
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 capitalize"
              >
                {STATES.map((st) => (
                  <option key={st} value={st}>
                    {st} State
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 text-zinc-300">
            <input
              type="checkbox"
              checked={switchToUI}
              onChange={(e) => setSwitchToUI(e.target.checked)}
              className="accent-blue-500"
            />
            Switch to UI Workshop after exporting
          </label>
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 bg-[#111318] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleSubmit()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold"
          >
            {busy ? (
              'Exporting...'
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                Export & Send
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
