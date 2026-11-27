import React from 'react';
import { Plus, Trash2, Zap } from 'lucide-react';
import type {
  AssetItem,
  ComponentStateName,
  InteractiveComponentType,
  ScreenArtboard,
  UIElement,
  VisualAppearance,
  VisualSubLayer,
} from '../types/roblox';
import {
  computeRobloxUDim2,
  createId,
  enableInteractiveComponent,
} from '../utils/projectLogic';

interface PropertiesInspectorProps {
  screen: ScreenArtboard;
  selectedElements: UIElement[];
  assets: AssetItem[];
  editingState: ComponentStateName;
  onUpdateScreen: (updater: (s: ScreenArtboard) => ScreenArtboard) => void;
  onUpdateElement: (id: string, updater: (el: UIElement) => UIElement) => void;
  onSaveComponent: (id: string) => void;
  onOpenEventsForElement: (id: string) => void;
}

const COMPONENT_TYPES: Array<{ value: InteractiveComponentType; label: string }> = [
  { value: 'button', label: 'Button' },
  { value: 'toggle', label: 'Toggle Switch' },
  { value: 'slider', label: 'Slider' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'radio', label: 'Radio Button' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'tab', label: 'Tab' },
  { value: 'custom', label: 'Custom Interactive' },
];

const ANCHOR_PRESETS = [
  { x: 0, y: 0, label: 'TL' },
  { x: 0.5, y: 0, label: 'TC' },
  { x: 1, y: 0, label: 'TR' },
  { x: 0, y: 0.5, label: 'CL' },
  { x: 0.5, y: 0.5, label: 'CC' },
  { x: 1, y: 0.5, label: 'CR' },
  { x: 0, y: 1, label: 'BL' },
  { x: 0.5, y: 1, label: 'BC' },
  { x: 1, y: 1, label: 'BR' },
];

export const PropertiesInspector: React.FC<PropertiesInspectorProps> = ({
  screen,
  selectedElements,
  assets,
  editingState,
  onUpdateScreen,
  onUpdateElement,
  onSaveComponent,
  onOpenEventsForElement,
}) => {
  if (selectedElements.length === 0) {
    return (
      <aside className="w-76 shrink-0 h-full border-l border-zinc-800 bg-[#16181D] overflow-y-auto p-4 space-y-5">
        <div>
          <h2 className="text-xs font-semibold text-zinc-200 tracking-tight mb-3">
            Screen Artboard
          </h2>
          <div className="space-y-3 text-xs">
            <label className="block space-y-1">
              <span className="text-zinc-400">ScreenGui Name</span>
              <input
                type="text"
                value={screen.name}
                onChange={(e) =>
                  onUpdateScreen((s) => ({ ...s, name: e.target.value }))
                }
                className="w-full px-2.5 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 focus:border-blue-500 outline-none"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-zinc-400">Width (px)</span>
                <input
                  type="number"
                  value={screen.width}
                  onChange={(e) =>
                    onUpdateScreen((s) => ({
                      ...s,
                      width: Math.max(240, Number(e.target.value) || 1280),
                    }))
                  }
                  className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono tabular-nums"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-zinc-400">Height (px)</span>
                <input
                  type="number"
                  value={screen.height}
                  onChange={(e) =>
                    onUpdateScreen((s) => ({
                      ...s,
                      height: Math.max(240, Number(e.target.value) || 720),
                    }))
                  }
                  className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono tabular-nums"
                />
              </label>
            </div>
            <label className="block space-y-1">
              <span className="text-zinc-400">Canvas Backdrop</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={screen.backgroundColor}
                  onChange={(e) =>
                    onUpdateScreen((s) => ({ ...s, backgroundColor: e.target.value }))
                  }
                  className="w-8 h-8 rounded bg-transparent border border-zinc-700 cursor-pointer"
                />
                <input
                  type="text"
                  value={screen.backgroundColor}
                  onChange={(e) =>
                    onUpdateScreen((s) => ({ ...s, backgroundColor: e.target.value }))
                  }
                  className="flex-1 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 font-mono text-xs"
                />
              </div>
            </label>
          </div>
        </div>
        <div className="pt-4 border-t border-zinc-800 text-xs text-zinc-400 leading-relaxed">
          Draw any shape or text on the canvas, then select it to customize colors, layers, Roblox anchoring, and interactive states.
        </div>
      </aside>
    );
  }

  if (selectedElements.length > 1) {
    return (
      <aside className="w-76 shrink-0 h-full border-l border-zinc-800 bg-[#16181D] p-4 space-y-4">
        <h2 className="text-xs font-semibold text-zinc-200">
          {selectedElements.length} Elements Selected
        </h2>
        <p className="text-xs text-zinc-400">
          Drag together on the canvas, group them via the Layers panel, or select a single element to inspect properties and states.
        </p>
      </aside>
    );
  }

  const el = selectedElements[0];
  const isEditingOverride =
    el.interactive.isInteractive && Boolean(el.interactive.states[editingState]);

  const activeAppearance: VisualAppearance = isEditingOverride
    ? el.interactive.states[editingState]!.appearance
    : el.appearance;

  const updateAppearance = (updater: (app: VisualAppearance) => VisualAppearance) => {
    onUpdateElement(el.id, (curr) => {
      if (curr.interactive.isInteractive && curr.interactive.states[editingState]) {
        const st = curr.interactive.states[editingState]!;
        return {
          ...curr,
          interactive: {
            ...curr.interactive,
            states: {
              ...curr.interactive.states,
              [editingState]: {
                ...st,
                appearance: updater(st.appearance),
              },
            },
          },
        };
      }
      return {
        ...curr,
        appearance: updater(curr.appearance),
      };
    });
  };

  const parent = el.parentId
    ? screen.elements.find((p) => p.id === el.parentId)
    : undefined;
  const udim = computeRobloxUDim2(
    el,
    parent ? parent.width : screen.width,
    parent ? parent.height : screen.height
  );

  const selectedAsset = assets.find((a) => a.id === activeAppearance.image?.assetId);

  const addExtraLayer = (kind: 'shape' | 'text' | 'image') => {
    const newLayer: VisualSubLayer = {
      id: createId('sub'),
      name: `${kind === 'image' ? 'Image' : kind === 'text' ? 'Text' : 'Shape'} Layer`,
      kind,
      visible: true,
      x: 8,
      y: 8,
      width: Math.max(24, Math.round(el.width * 0.5)),
      height: Math.max(20, Math.round(el.height * 0.5)),
      rotation: 0,
      opacity: 1,
      fillColor: '#60A5FA',
      cornerRadius: 4,
      strokeColor: '#FFFFFF',
      strokeWidth: 0,
      text: kind === 'text' ? 'Sub-label' : undefined,
      fontSize: 12,
      textColor: '#FFFFFF',
      assetId: kind === 'image' && assets[0] ? assets[0].id : undefined,
    };
    updateAppearance((app) => ({
      ...app,
      extraLayers: [...app.extraLayers, newLayer],
    }));
  };

  return (
    <aside className="w-76 shrink-0 h-full border-l border-zinc-800 bg-[#16181D] overflow-y-auto divide-y divide-zinc-800 text-xs">
      {/* Header & Name */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <input
            type="text"
            aria-label="Element name"
            value={el.name}
            onChange={(e) =>
              onUpdateElement(el.id, (curr) => ({ ...curr, name: e.target.value }))
            }
            className="flex-1 min-w-0 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 font-medium focus:border-blue-500 outline-none"
          />
          <span className="text-[11px] font-mono text-zinc-400 shrink-0">
            {el.type}
          </span>
        </div>

        {el.interactive.isInteractive && (
          <div className="px-2 py-1.5 rounded bg-blue-950/40 border border-blue-800/50 text-blue-200 flex items-center justify-between">
            <span>Editing State:</span>
            <span className="font-mono font-semibold uppercase">{editingState}</span>
          </div>
        )}
      </div>

      {/* Draw First, Assign Functionality Later */}
      <div className="p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <label htmlFor="is-interactive-toggle" className="font-semibold text-zinc-100">
            Is Interactive?
          </label>
          <input
            id="is-interactive-toggle"
            type="checkbox"
            checked={el.interactive.isInteractive}
            onChange={(e) => {
              const checked = e.target.checked;
              onUpdateElement(el.id, (curr) =>
                checked
                  ? enableInteractiveComponent(curr, curr.interactive.componentType || 'button')
                  : {
                      ...curr,
                      interactive: { ...curr.interactive, isInteractive: false },
                    }
              );
            }}
            className="w-4 h-4 accent-blue-600 cursor-pointer"
          />
        </div>

        {el.interactive.isInteractive && (
          <div className="space-y-2.5 pt-1">
            <label className="block space-y-1">
              <span className="text-zinc-400">Component Type</span>
              <select
                aria-label="Interactive component type"
                value={el.interactive.componentType}
                onChange={(e) =>
                  onUpdateElement(el.id, (curr) => ({
                    ...curr,
                    interactive: {
                      ...curr.interactive,
                      componentType: e.target.value as InteractiveComponentType,
                    },
                  }))
                }
                className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
              >
                {COMPONENT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>
                    {ct.label}
                  </option>
                ))}
              </select>
            </label>

            {el.interactive.componentType === 'slider' && (
              <div className="grid grid-cols-3 gap-1.5">
                <label className="block space-y-1">
                  <span className="text-zinc-400">Min</span>
                  <input
                    type="number"
                    value={el.interactive.behavior.min ?? 0}
                    onChange={(e) =>
                      onUpdateElement(el.id, (c) => ({
                        ...c,
                        interactive: {
                          ...c.interactive,
                          behavior: { ...c.interactive.behavior, min: Number(e.target.value) },
                        },
                      }))
                    }
                    className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Max</span>
                  <input
                    type="number"
                    value={el.interactive.behavior.max ?? 100}
                    onChange={(e) =>
                      onUpdateElement(el.id, (c) => ({
                        ...c,
                        interactive: {
                          ...c.interactive,
                          behavior: { ...c.interactive.behavior, max: Number(e.target.value) },
                        },
                      }))
                    }
                    className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-zinc-400">Value</span>
                  <input
                    type="number"
                    value={el.interactive.behavior.value ?? 50}
                    onChange={(e) =>
                      onUpdateElement(el.id, (c) => ({
                        ...c,
                        interactive: {
                          ...c.interactive,
                          behavior: { ...c.interactive.behavior, value: Number(e.target.value) },
                        },
                      }))
                    }
                    className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
                  />
                </label>
              </div>
            )}

            {el.interactive.componentType === 'dropdown' && (
              <label className="block space-y-1">
                <span className="text-zinc-400">Options (comma-separated)</span>
                <input
                  type="text"
                  value={(el.interactive.behavior.options ?? []).join(', ')}
                  onChange={(e) =>
                    onUpdateElement(el.id, (c) => ({
                      ...c,
                      interactive: {
                        ...c.interactive,
                        behavior: {
                          ...c.interactive.behavior,
                          options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                        },
                      },
                    }))
                  }
                  className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
                />
              </label>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenEventsForElement(el.id)}
                className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Events
              </button>
              <button
                type="button"
                onClick={() => onSaveComponent(el.id)}
                className="px-2 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium"
              >
                Save to Library
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transform & Roblox Anchoring */}
      <div className="p-3.5 space-y-3">
        <h3 className="font-semibold text-zinc-200">Transform & Roblox UDim2</h3>
        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-zinc-400">X</span>
            <input
              type="number"
              value={Math.round(el.x)}
              onChange={(e) =>
                onUpdateElement(el.id, (c) => ({ ...c, x: Number(e.target.value) || 0 }))
              }
              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-400">Y</span>
            <input
              type="number"
              value={Math.round(el.y)}
              onChange={(e) =>
                onUpdateElement(el.id, (c) => ({ ...c, y: Number(e.target.value) || 0 }))
              }
              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-400">Width</span>
            <input
              type="number"
              value={Math.round(el.width)}
              onChange={(e) =>
                onUpdateElement(el.id, (c) => ({
                  ...c,
                  width: Math.max(4, Number(e.target.value) || 4),
                }))
              }
              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-400">Height</span>
            <input
              type="number"
              value={Math.round(el.height)}
              onChange={(e) =>
                onUpdateElement(el.id, (c) => ({
                  ...c,
                  height: Math.max(4, Number(e.target.value) || 4),
                }))
              }
              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-zinc-400">Rotation (°)</span>
            <input
              type="number"
              value={Math.round(el.rotation)}
              onChange={(e) =>
                onUpdateElement(el.id, (c) => ({ ...c, rotation: Number(e.target.value) || 0 }))
              }
              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-400">ZIndex</span>
            <input
              type="number"
              value={el.zIndex}
              onChange={(e) =>
                onUpdateElement(el.id, (c) => ({ ...c, zIndex: Number(e.target.value) || 1 }))
              }
              className="w-full px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
        </div>

        {/* AnchorPoint 3x3 */}
        <div className="space-y-1.5">
          <span className="text-zinc-400">AnchorPoint ({el.anchorPoint.x}, {el.anchorPoint.y})</span>
          <div className="grid grid-cols-3 gap-1 w-28">
            {ANCHOR_PRESETS.map((preset) => {
              const active =
                el.anchorPoint.x === preset.x && el.anchorPoint.y === preset.y;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    onUpdateElement(el.id, (c) => ({
                      ...c,
                      anchorPoint: { x: preset.x, y: preset.y },
                    }))
                  }
                  className={`py-1 rounded text-[10px] font-mono border ${
                    active
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="flex items-center gap-1.5 text-zinc-300">
              <input
                type="checkbox"
                checked={el.useScalePosition}
                onChange={(e) =>
                  onUpdateElement(el.id, (c) => ({ ...c, useScalePosition: e.target.checked }))
                }
                className="accent-blue-600"
              />
              Scale Pos
            </label>
            <label className="flex items-center gap-1.5 text-zinc-300">
              <input
                type="checkbox"
                checked={el.useScaleSize}
                onChange={(e) =>
                  onUpdateElement(el.id, (c) => ({ ...c, useScaleSize: e.target.checked }))
                }
                className="accent-blue-600"
              />
              Scale Size
            </label>
          </div>
          <div className="p-2 rounded bg-zinc-900/90 border border-zinc-800 font-mono text-[10px] text-zinc-400 space-y-0.5 select-all">
            <div className="truncate">Pos: {udim.positionUDim2}</div>
            <div className="truncate">Size: {udim.sizeUDim2}</div>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="p-3.5 space-y-3">
        <h3 className="font-semibold text-zinc-200">Appearance</h3>

        <div className="grid grid-cols-2 gap-2">
          <label className="block space-y-1">
            <span className="text-zinc-400">Fill Color</span>
            <div className="flex items-center gap-1.5">
              <input
                type="color"
                aria-label="Fill color picker"
                value={
                  activeAppearance.fillColor === 'transparent'
                    ? '#000000'
                    : activeAppearance.fillColor
                }
                onChange={(e) =>
                  updateAppearance((app) => ({ ...app, fillColor: e.target.value, fillOpacity: app.fillOpacity === 0 ? 1 : app.fillOpacity }))
                }
                className="w-7 h-7 rounded bg-transparent border border-zinc-700 cursor-pointer shrink-0"
              />
              <input
                type="text"
                aria-label="Fill color hex"
                value={activeAppearance.fillColor}
                onChange={(e) =>
                  updateAppearance((app) => ({ ...app, fillColor: e.target.value }))
                }
                className="w-full min-w-0 px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
              />
            </div>
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-400">Opacity ({Math.round(activeAppearance.opacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={activeAppearance.opacity}
              onChange={(e) =>
                updateAppearance((app) => ({ ...app, opacity: Number(e.target.value) }))
              }
              className="w-full accent-blue-600 mt-2"
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <label className="block space-y-1">
            <span className="text-zinc-400">Radius</span>
            <input
              type="number"
              min="0"
              value={activeAppearance.cornerRadius >= 9999 ? 999 : activeAppearance.cornerRadius}
              onChange={(e) =>
                updateAppearance((app) => ({
                  ...app,
                  cornerRadius: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-400">Border px</span>
            <input
              type="number"
              min="0"
              value={activeAppearance.strokeWidth}
              onChange={(e) =>
                updateAppearance((app) => ({
                  ...app,
                  strokeWidth: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-zinc-400">Border</span>
            <input
              type="color"
              value={activeAppearance.strokeColor}
              onChange={(e) =>
                updateAppearance((app) => ({ ...app, strokeColor: e.target.value }))
              }
              className="w-full h-7 rounded bg-transparent border border-zinc-700 cursor-pointer"
            />
          </label>
        </div>

        {/* Gradient Toggle */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-zinc-300">Gradient Fill</span>
            <input
              type="checkbox"
              checked={activeAppearance.gradient.enabled}
              onChange={(e) =>
                updateAppearance((app) => ({
                  ...app,
                  gradient: { ...app.gradient, enabled: e.target.checked },
                }))
              }
              className="accent-blue-600"
            />
          </div>
          {activeAppearance.gradient.enabled && (
            <div className="grid grid-cols-3 gap-1.5 items-center">
              <input
                type="color"
                value={activeAppearance.gradient.stops[0]?.color ?? '#3B82F6'}
                onChange={(e) =>
                  updateAppearance((app) => ({
                    ...app,
                    gradient: {
                      ...app.gradient,
                      stops: [
                        { offset: 0, color: e.target.value },
                        app.gradient.stops[1] ?? { offset: 1, color: '#1E293B' },
                      ],
                    },
                  }))
                }
                className="w-full h-7 rounded border border-zinc-700 bg-transparent"
              />
              <input
                type="color"
                value={activeAppearance.gradient.stops[1]?.color ?? '#1E293B'}
                onChange={(e) =>
                  updateAppearance((app) => ({
                    ...app,
                    gradient: {
                      ...app.gradient,
                      stops: [
                        app.gradient.stops[0] ?? { offset: 0, color: '#3B82F6' },
                        { offset: 1, color: e.target.value },
                      ],
                    },
                  }))
                }
                className="w-full h-7 rounded border border-zinc-700 bg-transparent"
              />
              <input
                type="number"
                title="Gradient angle"
                value={activeAppearance.gradient.angle}
                onChange={(e) =>
                  updateAppearance((app) => ({
                    ...app,
                    gradient: { ...app.gradient, angle: Number(e.target.value) || 0 },
                  }))
                }
                className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
              />
            </div>
          )}
        </div>

        {/* Shadow Toggle */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-zinc-300">Drop Shadow</span>
          <input
            type="checkbox"
            checked={activeAppearance.shadow.enabled}
            onChange={(e) =>
              updateAppearance((app) => ({
                ...app,
                shadow: { ...app.shadow, enabled: e.target.checked },
              }))
            }
            className="accent-blue-600"
          />
        </div>
      </div>

      {/* Typography */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-200">Typography</h3>
          {!activeAppearance.text && (
            <button
              type="button"
              onClick={() =>
                updateAppearance((app) => ({
                  ...app,
                  text: {
                    content: 'Button Label',
                    fontFamily: 'Plus Jakarta Sans',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#FFFFFF',
                    align: 'center',
                    verticalAlign: 'middle',
                  },
                }))
              }
              className="text-[11px] text-blue-400 hover:text-blue-300"
            >
              + Add Text
            </button>
          )}
        </div>

        {activeAppearance.text && (
          <div className="space-y-2">
            <input
              type="text"
              aria-label="Text content"
              value={activeAppearance.text.content}
              onChange={(e) =>
                updateAppearance((app) => ({
                  ...app,
                  text: app.text ? { ...app.text, content: e.target.value } : undefined,
                }))
              }
              className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
            />
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                aria-label="Font size"
                value={activeAppearance.text.fontSize}
                onChange={(e) =>
                  updateAppearance((app) => ({
                    ...app,
                    text: app.text
                      ? { ...app.text, fontSize: Math.max(8, Number(e.target.value) || 14) }
                      : undefined,
                  }))
                }
                className="px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono"
              />
              <select
                aria-label="Text align"
                value={activeAppearance.text.align}
                onChange={(e) =>
                  updateAppearance((app) => ({
                    ...app,
                    text: app.text
                      ? { ...app.text, align: e.target.value as 'left' | 'center' | 'right' }
                      : undefined,
                  }))
                }
                className="px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
              <input
                type="color"
                aria-label="Text color"
                value={activeAppearance.text.color}
                onChange={(e) =>
                  updateAppearance((app) => ({
                    ...app,
                    text: app.text ? { ...app.text, color: e.target.value } : undefined,
                  }))
                }
                className="w-full h-7 rounded border border-zinc-700 bg-transparent"
              />
            </div>
          </div>
        )}
      </div>

      {/* Image & Sprite Assignment */}
      <div className="p-3.5 space-y-2.5">
        <h3 className="font-semibold text-zinc-200">Image & Sprite Layer</h3>
        <select
          aria-label="Assigned image asset"
          value={activeAppearance.image?.assetId ?? ''}
          onChange={(e) => {
            const nextAssetId = e.target.value;
            updateAppearance((app) => ({
              ...app,
              image: nextAssetId
                ? {
                    assetId: nextAssetId,
                    spriteId: undefined,
                    scaleType: app.image?.scaleType ?? 'Fit',
                    tintColor: app.image?.tintColor ?? '#FFFFFF',
                    tintOpacity: app.image?.tintOpacity ?? 1,
                  }
                : undefined,
            }));
          }}
          className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
        >
          <option value="">None</option>
          {assets.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.width}×{a.height})
            </option>
          ))}
        </select>

        {selectedAsset && selectedAsset.sprites.length > 0 && (
          <label className="block space-y-1">
            <span className="text-zinc-400">Sprite Slice</span>
            <select
              value={activeAppearance.image?.spriteId ?? ''}
              onChange={(e) =>
                updateAppearance((app) => ({
                  ...app,
                  image: app.image
                    ? { ...app.image, spriteId: e.target.value || undefined }
                    : undefined,
                }))
              }
              className="w-full px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
            >
              <option value="">Full Image</option>
              {selectedAsset.sprites.map((sp) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name} ({sp.x},{sp.y} · {sp.width}×{sp.height})
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {/* Unlimited Visual & Image Sub-Layers */}
      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-zinc-200">
            Sub-Layers ({activeAppearance.extraLayers.length})
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => addExtraLayer('shape')}
              className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Shape
            </button>
            <button
              type="button"
              onClick={() => addExtraLayer('image')}
              className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center gap-0.5"
            >
              <Plus className="w-3 h-3" /> Image
            </button>
          </div>
        </div>

        {activeAppearance.extraLayers.length > 0 && (
          <div className="space-y-2">
            {activeAppearance.extraLayers.map((sub) => (
              <div
                key={sub.id}
                className="p-2 rounded bg-zinc-900/90 border border-zinc-800 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-1">
                  <input
                    type="text"
                    value={sub.name}
                    onChange={(e) =>
                      updateAppearance((app) => ({
                        ...app,
                        extraLayers: app.extraLayers.map((l) =>
                          l.id === sub.id ? { ...l, name: e.target.value } : l
                        ),
                      }))
                    }
                    className="flex-1 min-w-0 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-zinc-200"
                  />
                  <button
                    type="button"
                    aria-label={`Remove sub-layer ${sub.name}`}
                    onClick={() =>
                      updateAppearance((app) => ({
                        ...app,
                        extraLayers: app.extraLayers.filter((l) => l.id !== sub.id),
                      }))
                    }
                    className="p-1 text-zinc-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  <input
                    type="number"
                    title="X"
                    value={sub.x}
                    onChange={(e) =>
                      updateAppearance((app) => ({
                        ...app,
                        extraLayers: app.extraLayers.map((l) =>
                          l.id === sub.id ? { ...l, x: Number(e.target.value) || 0 } : l
                        ),
                      }))
                    }
                    className="px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[10px]"
                  />
                  <input
                    type="number"
                    title="Y"
                    value={sub.y}
                    onChange={(e) =>
                      updateAppearance((app) => ({
                        ...app,
                        extraLayers: app.extraLayers.map((l) =>
                          l.id === sub.id ? { ...l, y: Number(e.target.value) || 0 } : l
                        ),
                      }))
                    }
                    className="px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[10px]"
                  />
                  <input
                    type="number"
                    title="Width"
                    value={sub.width}
                    onChange={(e) =>
                      updateAppearance((app) => ({
                        ...app,
                        extraLayers: app.extraLayers.map((l) =>
                          l.id === sub.id ? { ...l, width: Number(e.target.value) || 12 } : l
                        ),
                      }))
                    }
                    className="px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 font-mono text-[10px]"
                  />
                  {sub.kind === 'shape' ? (
                    <input
                      type="color"
                      value={sub.fillColor}
                      onChange={(e) =>
                        updateAppearance((app) => ({
                          ...app,
                          extraLayers: app.extraLayers.map((l) =>
                            l.id === sub.id ? { ...l, fillColor: e.target.value } : l
                          ),
                        }))
                      }
                      className="w-full h-5 rounded border border-zinc-800 bg-transparent"
                    />
                  ) : (
                    <select
                      value={sub.assetId ?? ''}
                      onChange={(e) =>
                        updateAppearance((app) => ({
                          ...app,
                          extraLayers: app.extraLayers.map((l) =>
                            l.id === sub.id ? { ...l, assetId: e.target.value } : l
                          ),
                        }))
                      }
                      className="px-1 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px]"
                    >
                      <option value="">Asset</option>
                      {assets.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
