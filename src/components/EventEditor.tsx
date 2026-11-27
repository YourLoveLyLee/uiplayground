import React from 'react';
import { ArrowRight, Play, Plus, Trash2, Zap } from 'lucide-react';
import type {
  ActionType,
  EventTriggerType,
  InteractionAction,
  InteractionRule,
  ScreenArtboard,
} from '../types/roblox';
import { createId } from '../utils/projectLogic';
import { playPreviewSound } from '../utils/soundSynth';

interface EventEditorProps {
  screen: ScreenArtboard;
  allScreens: ScreenArtboard[];
  focusedElementId: string | null;
  onUpdateScreen: (updater: (s: ScreenArtboard) => ScreenArtboard) => void;
}

const TRIGGERS: Array<{ value: EventTriggerType; label: string }> = [
  { value: 'click', label: 'On Click' },
  { value: 'hoverEnter', label: 'On Hover Enter' },
  { value: 'hoverExit', label: 'On Hover Exit' },
  { value: 'press', label: 'On Press' },
  { value: 'release', label: 'On Release' },
  { value: 'valueChanged', label: 'On Value Changed' },
  { value: 'enabled', label: 'On Enabled' },
  { value: 'disabled', label: 'On Disabled' },
  { value: 'selected', label: 'On Selected' },
  { value: 'deselected', label: 'On Deselected' },
];

const ACTIONS: Array<{ value: ActionType; label: string; needsTargetElement: boolean; needsValue: boolean }> = [
  { value: 'show', label: 'Show Element', needsTargetElement: true, needsValue: false },
  { value: 'hide', label: 'Hide Element', needsTargetElement: true, needsValue: false },
  { value: 'enable', label: 'Enable Element', needsTargetElement: true, needsValue: false },
  { value: 'disable', label: 'Disable Element', needsTargetElement: true, needsValue: false },
  { value: 'changeText', label: 'Change Text', needsTargetElement: true, needsValue: true },
  { value: 'changeImage', label: 'Change Image (Asset ID)', needsTargetElement: true, needsValue: true },
  { value: 'changeValue', label: 'Change Value', needsTargetElement: true, needsValue: true },
  { value: 'updateState', label: 'Update State', needsTargetElement: true, needsValue: true },
  { value: 'playAnimation', label: 'Play Animation', needsTargetElement: true, needsValue: false },
  { value: 'playSound', label: 'Play Sound', needsTargetElement: false, needsValue: true },
  { value: 'navigateScreen', label: 'Navigate to Screen', needsTargetElement: false, needsValue: false },
];

export const EventEditor: React.FC<EventEditorProps> = ({
  screen,
  allScreens,
  focusedElementId,
  onUpdateScreen,
}) => {
  const interactiveElements = screen.elements.filter((e) => e.interactive.isInteractive);
  const [selectedSourceId, setSelectedSourceId] = React.useState<string>(
    focusedElementId && interactiveElements.some((e) => e.id === focusedElementId)
      ? focusedElementId
      : interactiveElements[0]?.id ?? ''
  );
  const [testResult, setTestResult] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (
      focusedElementId &&
      interactiveElements.some((e) => e.id === focusedElementId)
    ) {
      setSelectedSourceId(focusedElementId);
    }
  }, [focusedElementId, interactiveElements]);

  const addRule = () => {
    if (!selectedSourceId) return;
    const defaultTarget =
      screen.elements.find((e) => e.id !== selectedSourceId)?.id ?? screen.elements[0]?.id;
    const newRule: InteractionRule = {
      id: createId('rule'),
      sourceElementId: selectedSourceId,
      trigger: 'click',
      actions: [
        {
          id: createId('act'),
          type: 'show',
          targetElementId: defaultTarget,
          value: '',
        },
      ],
    };
    onUpdateScreen((s) => ({ ...s, rules: [...s.rules, newRule] }));
  };

  const updateRule = (ruleId: string, updater: (r: InteractionRule) => InteractionRule) => {
    onUpdateScreen((s) => ({
      ...s,
      rules: s.rules.map((r) => (r.id === ruleId ? updater(r) : r)),
    }));
  };

  const removeRule = (ruleId: string) => {
    onUpdateScreen((s) => ({
      ...s,
      rules: s.rules.filter((r) => r.id !== ruleId),
    }));
  };

  const testRule = (rule: InteractionRule) => {
    const srcName =
      screen.elements.find((e) => e.id === rule.sourceElementId)?.name ?? 'Source';
    const summaryParts = rule.actions.map((act) => {
      if (act.type === 'playSound') {
        playPreviewSound(act.value || 'click');
        return `PlaySound(${act.value || 'click'})`;
      }
      if (act.type === 'navigateScreen') {
        const sc = allScreens.find((s) => s.id === act.targetScreenId);
        return `Navigate(${sc?.name ?? 'Screen'})`;
      }
      const tgt = screen.elements.find((e) => e.id === act.targetElementId);
      return `${act.type}(${tgt?.name ?? 'Target'}${act.value ? `: ${act.value}` : ''})`;
    });
    setTestResult(`Tested ${srcName} [${rule.trigger}] -> ${summaryParts.join(', ')}`);
  };

  // Build unique target nodes referenced by rules for the visual node graph
  const targetNodes = React.useMemo(() => {
    const map = new Map<string, { id: string; label: string; kind: string }>();
    for (const r of screen.rules) {
      for (const act of r.actions) {
        if (act.type === 'navigateScreen' && act.targetScreenId) {
          const sc = allScreens.find((s) => s.id === act.targetScreenId);
          if (sc) map.set(`screen:${sc.id}`, { id: `screen:${sc.id}`, label: sc.name, kind: 'ScreenGui' });
        } else if (act.type === 'playSound') {
          map.set(`sound:${act.value || 'click'}`, {
            id: `sound:${act.value || 'click'}`,
            label: `Sound: ${act.value || 'click'}`,
            kind: 'Audio',
          });
        } else if (act.targetElementId) {
          const el = screen.elements.find((e) => e.id === act.targetElementId);
          if (el) map.set(`el:${el.id}`, { id: `el:${el.id}`, label: el.name, kind: el.type });
        }
      }
    }
    return Array.from(map.values());
  }, [allScreens, screen.elements, screen.rules]);

  // Compute SVG node coordinates for clean visual wiring
  const nodeRowHeight = 52;
  const graphHeight = Math.max(
    180,
    Math.max(interactiveElements.length, targetNodes.length) * nodeRowHeight + 24
  );

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#0E1014] p-6 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              Visual Interaction & Node Graph — {screen.name}
            </h2>
            <p className="text-xs text-zinc-400">
              Connect interactive triggers on the left to UI elements, sounds, or screens on the right without scripting.
            </p>
          </div>
          <button
            type="button"
            disabled={!selectedSourceId}
            onClick={addRule}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Event Connection
          </button>
        </div>

        {testResult && (
          <div className="px-3.5 py-2 rounded bg-emerald-950/35 border border-emerald-800/60 text-xs text-emerald-200 flex items-center justify-between">
            <span className="font-mono">{testResult}</span>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-emerald-300 hover:text-white text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {interactiveElements.length === 0 ? (
          <div className="p-8 rounded-lg border border-dashed border-zinc-800 text-center text-xs text-zinc-400">
            No interactive components on this screen yet. Draw an element in Design mode and enable{' '}
            <strong className="text-zinc-200">Is Interactive?</strong> to wire events.
          </div>
        ) : (
          <>
            {/* Visual Node Connection Map */}
            <div className="rounded-md bg-[#13151B] border border-zinc-800 p-4 overflow-x-auto">
              <div className="text-[11px] font-semibold text-zinc-400 mb-3">
                Node Connection Map
              </div>
              <div className="relative min-w-[680px]" style={{ height: graphHeight }}>
                {/* SVG Bezier Wires */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {screen.rules.flatMap((rule) => {
                    const srcIdx = interactiveElements.findIndex(
                      (e) => e.id === rule.sourceElementId
                    );
                    if (srcIdx === -1) return [];
                    const y1 = 24 + srcIdx * nodeRowHeight + 18;
                    const x1 = 220;

                    return rule.actions.map((act) => {
                      const targetKey =
                        act.type === 'navigateScreen' && act.targetScreenId
                          ? `screen:${act.targetScreenId}`
                          : act.type === 'playSound'
                          ? `sound:${act.value || 'click'}`
                          : act.targetElementId
                          ? `el:${act.targetElementId}`
                          : '';
                      const tgtIdx = targetNodes.findIndex((t) => t.id === targetKey);
                      if (tgtIdx === -1) return null;
                      const y2 = 24 + tgtIdx * nodeRowHeight + 18;
                      const x2 = 460;
                      const c1 = x1 + 90;
                      const c2 = x2 - 90;
                      const strokeColor =
                        rule.trigger === 'click'
                          ? '#3B82F6'
                          : rule.trigger === 'valueChanged'
                          ? '#10B981'
                          : '#F59E0B';
                      return (
                        <g key={`${rule.id}_${act.id}`}>
                          <path
                            d={`M ${x1} ${y1} C ${c1} ${y1}, ${c2} ${y2}, ${x2} ${y2}`}
                            fill="none"
                            stroke={strokeColor}
                            strokeWidth="2"
                            strokeOpacity="0.85"
                          />
                          <circle cx={x1} cy={y1} r="3.5" fill={strokeColor} />
                          <circle cx={x2} cy={y2} r="3.5" fill={strokeColor} />
                        </g>
                      );
                    });
                  })}
                </svg>

                {/* Left Source Nodes */}
                <div className="absolute left-0 top-3 w-[220px] space-y-2">
                  {interactiveElements.map((el) => {
                    const active = selectedSourceId === el.id;
                    return (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => setSelectedSourceId(el.id)}
                        className={`w-full h-11 px-3 rounded border flex items-center justify-between text-xs transition-colors ${
                          active
                            ? 'bg-blue-950/40 border-blue-500 text-white'
                            : 'bg-[#191C23] border-zinc-800 text-zinc-200 hover:border-zinc-700'
                        }`}
                      >
                        <span className="font-medium truncate">{el.name}</span>
                        <span className="font-mono text-[10px] text-zinc-400">
                          {el.interactive.componentType}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Target Nodes */}
                <div className="absolute left-[460px] top-3 w-[220px] space-y-2">
                  {targetNodes.length === 0 ? (
                    <div className="h-11 px-3 rounded border border-dashed border-zinc-800 flex items-center text-[11px] text-zinc-500">
                      No targets wired yet
                    </div>
                  ) : (
                    targetNodes.map((t) => (
                      <div
                        key={t.id}
                        className="w-full h-11 px-3 rounded border border-zinc-800 bg-[#191C23] flex items-center justify-between text-xs text-zinc-200"
                      >
                        <span className="font-medium truncate">{t.label}</span>
                        <span className="font-mono text-[10px] text-zinc-400">{t.kind}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Configurable Rule List */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-zinc-400">
                Configured Connections ({screen.rules.length})
              </div>

              {screen.rules.length === 0 ? (
                <div className="p-6 rounded-md border border-dashed border-zinc-800 text-xs text-zinc-500">
                  Click "Add Event Connection" above to wire an event trigger to an action.
                </div>
              ) : (
                screen.rules.map((rule) => {
                  const src = screen.elements.find((e) => e.id === rule.sourceElementId);
                  return (
                    <div
                      key={rule.id}
                      className="p-3.5 rounded-md bg-[#16181D] border border-zinc-800 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs">
                          <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <select
                            aria-label="Rule source element"
                            value={rule.sourceElementId}
                            onChange={(e) =>
                              updateRule(rule.id, (r) => ({
                                ...r,
                                sourceElementId: e.target.value,
                              }))
                            }
                            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 font-medium"
                          >
                            {interactiveElements.map((ie) => (
                              <option key={ie.id} value={ie.id}>
                                {ie.name}
                              </option>
                            ))}
                          </select>

                          <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />

                          <select
                            aria-label="Rule trigger"
                            value={rule.trigger}
                            onChange={(e) =>
                              updateRule(rule.id, (r) => ({
                                ...r,
                                trigger: e.target.value as EventTriggerType,
                              }))
                            }
                            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-blue-300 font-medium"
                          >
                            {TRIGGERS.map((tr) => (
                              <option key={tr.value} value={tr.value}>
                                {tr.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => testRule(rule)}
                            className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-900/40 hover:bg-emerald-800/50 text-emerald-200 text-xs font-medium"
                          >
                            <Play className="w-3 h-3" /> Test Trigger
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateRule(rule.id, (r) => ({
                                ...r,
                                actions: [
                                  ...r.actions,
                                  {
                                    id: createId('act'),
                                    type: 'show',
                                    targetElementId: screen.elements[0]?.id,
                                  },
                                ],
                              }))
                            }
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200"
                          >
                            + Action
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete rule for ${src?.name ?? 'element'}`}
                            onClick={() => removeRule(rule.id)}
                            className="p-1 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Actions List */}
                      <div className="space-y-2 pl-4 border-l border-zinc-700/70">
                        {rule.actions.map((act: InteractionAction) => {
                          const meta = ACTIONS.find((a) => a.value === act.type) ?? ACTIONS[0];
                          return (
                            <div
                              key={act.id}
                              className="flex flex-wrap items-center gap-2 text-xs bg-zinc-900/70 p-2 rounded border border-zinc-800"
                            >
                              <select
                                aria-label="Action type"
                                value={act.type}
                                onChange={(e) => {
                                  const nextType = e.target.value as ActionType;
                                  updateRule(rule.id, (r) => ({
                                    ...r,
                                    actions: r.actions.map((a) =>
                                      a.id === act.id
                                        ? {
                                            ...a,
                                            type: nextType,
                                            targetScreenId:
                                              nextType === 'navigateScreen'
                                                ? allScreens[0]?.id
                                                : a.targetScreenId,
                                          }
                                        : a
                                    ),
                                  }));
                                }}
                                className="px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-100"
                              >
                                {ACTIONS.map((a) => (
                                  <option key={a.value} value={a.value}>
                                    {a.label}
                                  </option>
                                ))}
                              </select>

                              {meta.needsTargetElement && (
                                <select
                                  aria-label="Target element"
                                  value={act.targetElementId ?? ''}
                                  onChange={(e) =>
                                    updateRule(rule.id, (r) => ({
                                      ...r,
                                      actions: r.actions.map((a) =>
                                        a.id === act.id
                                          ? { ...a, targetElementId: e.target.value }
                                          : a
                                      ),
                                    }))
                                  }
                                  className="px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-200"
                                >
                                  {screen.elements.map((el) => (
                                    <option key={el.id} value={el.id}>
                                      {el.name}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {act.type === 'navigateScreen' && (
                                <select
                                  aria-label="Target screen"
                                  value={act.targetScreenId ?? ''}
                                  onChange={(e) =>
                                    updateRule(rule.id, (r) => ({
                                      ...r,
                                      actions: r.actions.map((a) =>
                                        a.id === act.id
                                          ? { ...a, targetScreenId: e.target.value }
                                          : a
                                      ),
                                    }))
                                  }
                                  className="px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-200"
                                >
                                  {allScreens.map((sc) => (
                                    <option key={sc.id} value={sc.id}>
                                      {sc.name}
                                    </option>
                                  ))}
                                </select>
                              )}

                              {meta.needsValue && (
                                <input
                                  type="text"
                                  placeholder={
                                    act.type === 'playSound'
                                      ? 'click / hover / toggle / success'
                                      : act.type === 'changeText'
                                      ? 'New text (use {value} for slider)'
                                      : 'Value'
                                  }
                                  value={act.value ?? ''}
                                  onChange={(e) =>
                                    updateRule(rule.id, (r) => ({
                                      ...r,
                                      actions: r.actions.map((a) =>
                                        a.id === act.id ? { ...a, value: e.target.value } : a
                                      ),
                                    }))
                                  }
                                  className="flex-1 min-w-[140px] px-2 py-1 rounded bg-zinc-950 border border-zinc-700 text-zinc-100"
                                />
                              )}

                              <button
                                type="button"
                                aria-label="Remove action"
                                onClick={() =>
                                  updateRule(rule.id, (r) => ({
                                    ...r,
                                    actions: r.actions.filter((a) => a.id !== act.id),
                                  }))
                                }
                                className="ml-auto p-1 text-zinc-500 hover:text-red-400"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
