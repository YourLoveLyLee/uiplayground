import React from 'react';
import { ChevronDown, ChevronUp, Copy, Play, RotateCcw } from 'lucide-react';
import type {
  ComponentStateName,
  TransitionEasing,
  UIElement,
} from '../types/roblox';
import {
  createStateOverrideFromAppearance,
  duplicateComponentState,
} from '../utils/projectLogic';

interface StateTimelinePanelProps {
  element: UIElement | undefined;
  editingState: ComponentStateName;
  onSelectEditingState: (state: ComponentStateName) => void;
  onUpdateElement: (id: string, updater: (el: UIElement) => UIElement) => void;
}

const ALL_STATES: Array<{ id: ComponentStateName; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'hover', label: 'Hover' },
  { id: 'pressed', label: 'Pressed' },
  { id: 'disabled', label: 'Disabled' },
  { id: 'selected', label: 'Selected' },
  { id: 'focused', label: 'Focused' },
];

export const StateTimelinePanel: React.FC<StateTimelinePanelProps> = ({
  element,
  editingState,
  onSelectEditingState,
  onUpdateElement,
}) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const [duplicateFrom, setDuplicateFrom] = React.useState<ComponentStateName>('idle');
  const [timelineProgress, setTimelineProgress] = React.useState(100);
  const [isPlayingAnim, setIsPlayingAnim] = React.useState(false);

  React.useEffect(() => {
    if (!isPlayingAnim) return;
    let raf = 0;
    const duration =
      element?.interactive.states[editingState]?.transition.durationMs ?? 160;
    const start = performance.now();
    const step = (now: number) => {
      const pct = Math.min(100, ((now - start) / Math.max(40, duration)) * 100);
      setTimelineProgress(Math.round(pct));
      if (pct < 100) {
        raf = requestAnimationFrame(step);
      } else {
        setIsPlayingAnim(false);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [isPlayingAnim, element, editingState]);

  if (!element || !element.interactive.isInteractive) {
    return (
      <div className="border-t border-zinc-800 bg-[#14161B] px-4 py-2 flex items-center justify-between text-xs text-zinc-400">
        <span>
          Visual State & Timeline Editor — Select an element and enable{' '}
          <strong className="text-zinc-200">Is Interactive?</strong> in the Inspector to design custom states.
        </span>
      </div>
    );
  }

  const currentOverride = element.interactive.states[editingState];
  const hasCustomState = Boolean(currentOverride);

  return (
    <section className="border-t border-zinc-800 bg-[#14161B] shrink-0">
      {/* Header Bar */}
      <div className="px-4 py-2 flex items-center justify-between gap-4 border-b border-zinc-800/80">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setCollapsed((p) => !p)}
            aria-label={collapsed ? 'Expand state editor' : 'Collapse state editor'}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 hover:text-white"
          >
            {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>Visual States & Timeline</span>
          </button>
          <span className="text-xs text-zinc-500 font-mono truncate">
            {element.name} ({element.interactive.componentType})
          </span>
        </div>

        {/* State Selector Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-md border border-zinc-800">
          {ALL_STATES.map((st) => {
            const defined = Boolean(element.interactive.states[st.id]);
            const active = editingState === st.id;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => onSelectEditingState(st.id)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-blue-600 text-white'
                    : defined
                    ? 'text-zinc-200 hover:bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {st.label}
                {defined && !active ? ' ·' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 py-3 grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
          {/* State Authoring Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-300">
                {editingState.toUpperCase()} State Appearance
              </span>
              <span className="text-[11px] text-zinc-400">
                {hasCustomState ? 'Custom design active' : 'Inheriting Idle'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Duplicate from state"
                value={duplicateFrom}
                onChange={(e) => setDuplicateFrom(e.target.value as ComponentStateName)}
                className="px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-200"
              >
                {ALL_STATES.filter((s) => s.id !== editingState).map((s) => (
                  <option key={s.id} value={s.id}>
                    From {s.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() =>
                  onUpdateElement(elIdOrThrow(element), (curr) =>
                    duplicateComponentState(curr, duplicateFrom, editingState)
                  )
                }
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicate State
              </button>
              {editingState !== 'idle' && hasCustomState && (
                <button
                  type="button"
                  title="Reset state to inherit Idle"
                  onClick={() =>
                    onUpdateElement(element.id, (curr) => {
                      const nextStates = { ...curr.interactive.states };
                      delete nextStates[editingState];
                      return {
                        ...curr,
                        interactive: { ...curr.interactive, states: nextStates },
                      };
                    })
                  }
                  className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {!hasCustomState && (
              <button
                type="button"
                onClick={() =>
                  onUpdateElement(element.id, (curr) => ({
                    ...curr,
                    interactive: {
                      ...curr.interactive,
                      states: {
                        ...curr.interactive.states,
                        [editingState]: createStateOverrideFromAppearance(
                          curr.interactive.states.idle?.appearance ?? curr.appearance
                        ),
                      },
                    },
                  }))
                }
                className="w-full py-1.5 rounded border border-dashed border-zinc-700 hover:border-blue-500 text-zinc-300 hover:text-blue-300 transition-colors"
              >
                Initialize Independent {editingState} State
              </button>
            )}
          </div>

          {/* Transform Delta Offsets */}
          <div className="space-y-2">
            <span className="font-medium text-zinc-300">State Position & Size Offset</span>
            {currentOverride ? (
              <div className="grid grid-cols-5 gap-1.5">
                {(['dx', 'dy', 'dw', 'dh', 'dRotation'] as const).map((field) => (
                  <label key={field} className="block space-y-1">
                    <span className="text-[10px] text-zinc-400 font-mono">{field}</span>
                    <input
                      type="number"
                      value={currentOverride.transformDelta[field]}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        onUpdateElement(element.id, (curr) => ({
                          ...curr,
                          interactive: {
                            ...curr.interactive,
                            states: {
                              ...curr.interactive.states,
                              [editingState]: {
                                ...currentOverride,
                                transformDelta: {
                                  ...currentOverride.transformDelta,
                                  [field]: val,
                                },
                              },
                            },
                          },
                        }));
                      }}
                      className="w-full px-1.5 py-1 rounded bg-zinc-900 border border-zinc-700 font-mono tabular-nums text-zinc-100"
                    />
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-zinc-500 py-2">
                Duplicate or initialize this state to offset its position, size, or rotation.
              </div>
            )}
          </div>

          {/* Transition & Animation Timeline */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-medium text-zinc-300">Transition Timeline</span>
              <button
                type="button"
                onClick={() => {
                  setTimelineProgress(0);
                  setIsPlayingAnim(true);
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-600/20 text-blue-300 hover:bg-blue-600/30"
              >
                <Play className="w-3 h-3" /> Preview Tween
              </button>
            </div>

            {currentOverride ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 bg-zinc-900 border border-zinc-700 rounded px-2 py-1">
                    <span className="text-zinc-400">ms</span>
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      step="20"
                      value={currentOverride.transition.durationMs}
                      onChange={(e) =>
                        onUpdateElement(element.id, (curr) => ({
                          ...curr,
                          interactive: {
                            ...curr.interactive,
                            states: {
                              ...curr.interactive.states,
                              [editingState]: {
                                ...currentOverride,
                                transition: {
                                  ...currentOverride.transition,
                                  durationMs: Math.max(0, Number(e.target.value) || 0),
                                },
                              },
                            },
                          },
                        }))
                      }
                      className="w-full bg-transparent text-zinc-100 font-mono tabular-nums outline-none"
                    />
                  </label>
                  <select
                    aria-label="Transition easing"
                    value={currentOverride.transition.easing}
                    onChange={(e) =>
                      onUpdateElement(element.id, (curr) => ({
                        ...curr,
                        interactive: {
                          ...curr.interactive,
                          states: {
                            ...curr.interactive.states,
                            [editingState]: {
                              ...currentOverride,
                              transition: {
                                ...currentOverride.transition,
                                easing: e.target.value as TransitionEasing,
                              },
                            },
                          },
                        },
                      }))
                    }
                    className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100"
                  >
                    <option value="linear">Linear</option>
                    <option value="easeOut">EaseOut</option>
                    <option value="easeInOut">EaseInOut</option>
                    <option value="spring">Spring</option>
                    <option value="bounce">Bounce</option>
                  </select>
                </div>

                {/* Keyframe Track */}
                <div className="h-5 rounded bg-zinc-900 border border-zinc-800 flex items-center gap-2 px-2">
                  <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${timelineProgress}%` }}
                    />
                  </div>
                  <span className="font-mono text-[10px] text-zinc-400 tabular-nums shrink-0">
                    {Math.round(
                      (timelineProgress / 100) * currentOverride.transition.durationMs
                    )}
                    ms
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500 py-2">Default 140ms EaseOut transition.</div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

function elIdOrThrow(el: UIElement): string {
  return el.id;
}
