import React from 'react';
import { Monitor, RotateCcw, Smartphone } from 'lucide-react';
import type {
  ComponentStateName,
  EventTriggerType,
  InteractionAction,
  PlaygroundProject,
  PreviewResolutionPreset,
  UIElement,
} from '../types/roblox';
import { playPreviewSound } from '../utils/soundSynth';
import { ElementRenderer } from './ElementRenderer';

interface PreviewModeProps {
  project: PlaygroundProject;
  initialScreenId: string;
}

const PRESETS: PreviewResolutionPreset[] = [
  { id: 'desktop', label: 'Desktop Landscape (1280×720)', width: 1280, height: 720, category: 'desktop' },
  { id: 'widescreen', label: 'Widescreen (1920×1080)', width: 1920, height: 1080, category: 'desktop' },
  { id: 'mobile_portrait', label: 'Mobile Portrait (390×844)', width: 390, height: 844, category: 'mobile' },
  { id: 'mobile_landscape', label: 'Mobile Landscape (844×390)', width: 844, height: 390, category: 'mobile' },
  { id: 'custom', label: 'Custom Resolution', width: 1024, height: 600, category: 'custom' },
];

interface RuntimeElementState {
  visible?: boolean;
  disabled?: boolean;
  text?: string;
  assetId?: string;
  spriteId?: string;
  value?: number;
  checked?: boolean;
  selectedIndex?: number;
  forcedState?: ComponentStateName;
  animClass?: string;
}

export const PreviewMode: React.FC<PreviewModeProps> = ({
  project,
  initialScreenId,
}) => {
  const [activeScreenId, setActiveScreenId] = React.useState(initialScreenId);
  const [presetId, setPresetId] = React.useState<string>('desktop');
  const [customSize, setCustomSize] = React.useState({ width: 1024, height: 600 });
  const [touchSim, setTouchSim] = React.useState(false);

  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [pressedId, setPressedId] = React.useState<string | null>(null);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);
  const [runtimeMap, setRuntimeMap] = React.useState<Record<string, RuntimeElementState>>({});
  const [logs, setLogs] = React.useState<string[]>([]);

  const activeScreen =
    project.screens.find((s) => s.id === activeScreenId) ?? project.screens[0];

  const activePreset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const viewportW = presetId === 'custom' ? customSize.width : activePreset.width;
  const viewportH = presetId === 'custom' ? customSize.height : activePreset.height;

  // Scale preview viewport to fit comfortably in screen
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [fitScale, setFitScale] = React.useState(0.75);

  React.useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pad = 48;
      const sx = (rect.width - pad) / Math.max(1, viewportW);
      const sy = (rect.height - pad) / Math.max(1, viewportH);
      setFitScale(Math.min(1, Math.max(0.2, Math.min(sx, sy))));
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [viewportW, viewportH]);

  const appendLog = React.useCallback((entry: string) => {
    const time = new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [`[${time}] ${entry}`, ...prev].slice(0, 40));
  }, []);

  const executeActions = React.useCallback(
    (actions: InteractionAction[], sourceEl: UIElement, numericValue?: number) => {
      for (const act of actions) {
        if (act.type === 'navigateScreen' && act.targetScreenId) {
          const nextScreen = project.screens.find((s) => s.id === act.targetScreenId);
          if (nextScreen) {
            setActiveScreenId(nextScreen.id);
            appendLog(`${sourceEl.name} -> Navigated to ${nextScreen.name}`);
          }
          continue;
        }

        if (act.type === 'playSound') {
          playPreviewSound(act.value || 'click');
          appendLog(`${sourceEl.name} -> Played sound "${act.value || 'click'}"`);
          continue;
        }

        if (!act.targetElementId) continue;
        const targetId = act.targetElementId;
        const targetEl = activeScreen.elements.find((e) => e.id === targetId);
        const targetName = targetEl?.name ?? targetId;

        if (act.type === 'show') {
          setRuntimeMap((prev) => ({ ...prev, [targetId]: { ...prev[targetId], visible: true } }));
          appendLog(`${sourceEl.name} -> Show ${targetName}`);
        } else if (act.type === 'hide') {
          setRuntimeMap((prev) => ({ ...prev, [targetId]: { ...prev[targetId], visible: false } }));
          appendLog(`${sourceEl.name} -> Hide ${targetName}`);
        } else if (act.type === 'enable') {
          setRuntimeMap((prev) => ({
            ...prev,
            [targetId]: { ...prev[targetId], disabled: false, forcedState: undefined },
          }));
          appendLog(`${sourceEl.name} -> Enable ${targetName}`);
        } else if (act.type === 'disable') {
          setRuntimeMap((prev) => ({
            ...prev,
            [targetId]: { ...prev[targetId], disabled: true, forcedState: 'disabled' },
          }));
          appendLog(`${sourceEl.name} -> Disable ${targetName}`);
        } else if (act.type === 'changeText') {
          const resolvedText = (act.value ?? '').replace(
            '{value}',
            numericValue !== undefined ? String(numericValue) : ''
          );
          setRuntimeMap((prev) => ({
            ...prev,
            [targetId]: { ...prev[targetId], text: resolvedText },
          }));
          appendLog(`${sourceEl.name} -> Set text on ${targetName} to "${resolvedText}"`);
        } else if (act.type === 'changeImage') {
          setRuntimeMap((prev) => ({
            ...prev,
            [targetId]: { ...prev[targetId], assetId: act.value || '' },
          }));
          appendLog(`${sourceEl.name} -> Changed image on ${targetName}`);
        } else if (act.type === 'changeValue') {
          const val = Number(act.value) || 0;
          setRuntimeMap((prev) => ({
            ...prev,
            [targetId]: { ...prev[targetId], value: val },
          }));
          appendLog(`${sourceEl.name} -> Set value on ${targetName} to ${val}`);
        } else if (act.type === 'updateState') {
          setRuntimeMap((prev) => ({
            ...prev,
            [targetId]: {
              ...prev[targetId],
              forcedState: (act.value as ComponentStateName) || 'selected',
            },
          }));
          appendLog(`${sourceEl.name} -> State of ${targetName} = ${act.value}`);
        } else if (act.type === 'playAnimation') {
          setRuntimeMap((prev) => ({
            ...prev,
            [targetId]: { ...prev[targetId], animClass: 'animate-bounce' },
          }));
          setTimeout(() => {
            setRuntimeMap((prev) => ({
              ...prev,
              [targetId]: { ...prev[targetId], animClass: undefined },
            }));
          }, 700);
          appendLog(`${sourceEl.name} -> Played animation on ${targetName}`);
        }
      }
    },
    [activeScreen.elements, appendLog, project.screens]
  );

  const fireRulesForTrigger = React.useCallback(
    (el: UIElement, trigger: EventTriggerType, numericValue?: number) => {
      const matching = activeScreen.rules.filter(
        (r) => r.sourceElementId === el.id && r.trigger === trigger
      );
      for (const rule of matching) {
        executeActions(rule.actions, el, numericValue);
      }
    },
    [activeScreen.rules, executeActions]
  );

  const getActiveStateForElement = (el: UIElement): ComponentStateName => {
    const rt = runtimeMap[el.id];
    if (rt?.disabled) return 'disabled';
    if (rt?.forcedState) return rt.forcedState;
    if (pressedId === el.id) return 'pressed';
    if (!touchSim && hoveredId === el.id) return 'hover';
    if (rt?.checked) return 'selected';
    if (focusedId === el.id) return 'focused';
    return el.interactive.defaultState;
  };

  const handleElementStateEvent = (
    el: UIElement,
    eventType: 'enter' | 'leave' | 'down' | 'up' | 'click'
  ) => {
    if (runtimeMap[el.id]?.disabled) return;

    if (eventType === 'enter' && !touchSim) {
      setHoveredId(el.id);
      fireRulesForTrigger(el, 'hoverEnter');
    } else if (eventType === 'leave') {
      setHoveredId((curr) => (curr === el.id ? null : curr));
      setPressedId((curr) => (curr === el.id ? null : curr));
      fireRulesForTrigger(el, 'hoverExit');
    } else if (eventType === 'down') {
      setPressedId(el.id);
      setFocusedId(el.id);
      fireRulesForTrigger(el, 'press');
    } else if (eventType === 'up') {
      setPressedId((curr) => (curr === el.id ? null : curr));
      fireRulesForTrigger(el, 'release');
    } else if (eventType === 'click') {
      const compType = el.interactive.componentType;
      if (compType === 'toggle' || compType === 'checkbox' || compType === 'tab') {
        const currentChecked =
          runtimeMap[el.id]?.checked ?? Boolean(el.interactive.behavior.checked);
        const nextChecked = !currentChecked;
        setRuntimeMap((prev) => ({
          ...prev,
          [el.id]: { ...prev[el.id], checked: nextChecked },
        }));
        fireRulesForTrigger(el, nextChecked ? 'enabled' : 'disabled');
        fireRulesForTrigger(el, nextChecked ? 'selected' : 'deselected');
      } else if (compType === 'radio') {
        setRuntimeMap((prev) => {
          const next = { ...prev };
          const grp = el.interactive.behavior.groupName || 'default_group';
          for (const sib of activeScreen.elements) {
            if (
              sib.interactive.isInteractive &&
              sib.interactive.componentType === 'radio' &&
              (sib.interactive.behavior.groupName || 'default_group') === grp
            ) {
              next[sib.id] = { ...next[sib.id], checked: sib.id === el.id };
            }
          }
          return next;
        });
        fireRulesForTrigger(el, 'selected');
      }
      fireRulesForTrigger(el, 'click');
    }
  };

  const resetPreview = () => {
    setRuntimeMap({});
    setHoveredId(null);
    setPressedId(null);
    setFocusedId(null);
    setActiveScreenId(initialScreenId);
    setLogs([]);
  };

  // Scale screen coordinates proportionally to fit the simulated preview device viewport
  const scaleToPreviewX = viewportW / Math.max(1, activeScreen.width);
  const scaleToPreviewY = viewportH / Math.max(1, activeScreen.height);

  return (
    <div className="flex flex-1 h-full overflow-hidden bg-[#0D0E12]">
      {/* Left/Center Viewport Simulator */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preview Controls Bar */}
        <div className="px-4 py-2.5 border-b border-zinc-800 bg-[#16181D] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-zinc-200 font-medium">
              {activePreset.category === 'mobile' ? (
                <Smartphone className="w-4 h-4 text-blue-400" />
              ) : (
                <Monitor className="w-4 h-4 text-blue-400" />
              )}
              <select
                aria-label="Preview resolution preset"
                value={presetId}
                onChange={(e) => setPresetId(e.target.value)}
                className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {presetId === 'custom' && (
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  aria-label="Custom preview width"
                  value={customSize.width}
                  onChange={(e) =>
                    setCustomSize((s) => ({
                      ...s,
                      width: Math.max(240, Number(e.target.value) || 800),
                    }))
                  }
                  className="w-18 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
                />
                <span className="text-zinc-500">×</span>
                <input
                  type="number"
                  aria-label="Custom preview height"
                  value={customSize.height}
                  onChange={(e) =>
                    setCustomSize((s) => ({
                      ...s,
                      height: Math.max(240, Number(e.target.value) || 600),
                    }))
                  }
                  className="w-18 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums"
                />
              </div>
            )}

            <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={touchSim}
                onChange={(e) => setTouchSim(e.target.checked)}
                className="accent-blue-600"
              />
              Touch Simulation (No Hover)
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-mono tabular-nums">
              Screen: {activeScreen.name} ({viewportW}×{viewportH})
            </span>
            <button
              type="button"
              onClick={resetPreview}
              className="flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset State
            </button>
          </div>
        </div>

        {/* Simulated Device Frame */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center p-6 overflow-hidden"
        >
          <div
            data-testid="preview-viewport"
            className="relative rounded-lg border-2 border-zinc-700 shadow-2xl overflow-hidden"
            style={{
              width: viewportW * fitScale,
              height: viewportH * fitScale,
              backgroundColor: activeScreen.backgroundColor,
            }}
          >
            <div
              className="origin-top-left relative"
              style={{
                width: activeScreen.width,
                height: activeScreen.height,
                transform: `scale(${fitScale * scaleToPreviewX}, ${fitScale * scaleToPreviewY})`,
              }}
            >
              {activeScreen.elements
                .filter((e) => !e.parentId)
                .sort((a, b) => a.zIndex - b.zIndex)
                .map((el) => (
                  <ElementRenderer
                    key={el.id}
                    element={el}
                    allElements={activeScreen.elements}
                    assets={project.assets}
                    runtimeValues={runtimeMap}
                    interactiveMode
                    previewHandlers={{
                      onElementStateEvent: handleElementStateEvent,
                      onSliderChange: (sliderEl, newVal) => {
                        setRuntimeMap((prev) => ({
                          ...prev,
                          [sliderEl.id]: { ...prev[sliderEl.id], value: newVal },
                        }));
                        fireRulesForTrigger(sliderEl, 'valueChanged', newVal);
                      },
                      onDropdownSelect: (dropEl, idx) => {
                        setRuntimeMap((prev) => ({
                          ...prev,
                          [dropEl.id]: { ...prev[dropEl.id], selectedIndex: idx },
                        }));
                        fireRulesForTrigger(dropEl, 'valueChanged', idx);
                      },
                      getActiveStateForElement,
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Live Preview Event Console */}
      <aside className="w-72 shrink-0 border-l border-zinc-800 bg-[#16181D] flex flex-col">
        <div className="px-3.5 py-2.5 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">
            Interaction Log ({logs.length})
          </span>
          <button
            type="button"
            onClick={() => setLogs([])}
            className="text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            Clear
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px]">
          {logs.length === 0 ? (
            <p className="text-zinc-500 font-sans text-xs leading-relaxed">
              Interact with buttons, sliders, toggles, or dropdowns in the preview viewport to observe live state changes and event execution.
            </p>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="text-zinc-300 border-b border-zinc-800/60 pb-1">
                {line}
              </div>
            ))
          )}
        </div>
      </aside>
    </div>
  );
};
