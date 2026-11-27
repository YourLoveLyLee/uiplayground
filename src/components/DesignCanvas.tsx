import React from 'react';
import type {
  AssetItem,
  ComponentStateName,
  ElementType,
  ScreenArtboard,
  ToolType,
  UIElement,
} from '../types/roblox';
import {
  AlignmentGuide,
  computeAlignmentSnap,
  createElement,
  getAbsolutePosition,
  resolveElementState,
  snapValue,
} from '../utils/projectLogic';
import { ElementRenderer } from './ElementRenderer';

interface DesignCanvasProps {
  screen: ScreenArtboard;
  assets: AssetItem[];
  activeTool: ToolType;
  selectedIds: string[];
  editingState: ComponentStateName;
  zoom: number;
  pan: { x: number; y: number };
  showGrid: boolean;
  snapToGrid: boolean;
  gridSize: number;
  onChangeZoom: (z: number) => void;
  onChangePan: (p: { x: number; y: number }) => void;
  onSelectIds: (ids: string[]) => void;
  onCreateElement: (el: UIElement) => void;
  onUpdateElement: (id: string, updater: (el: UIElement) => UIElement, recordHistory?: boolean) => void;
  onMoveElements: (updates: Array<{ id: string; x: number; y: number }>, recordHistory?: boolean) => void;
  onSelectTool: (tool: ToolType) => void;
}

type DragInteraction =
  | { kind: 'pan'; startClientX: number; startClientY: number; startPanX: number; startPanY: number }
  | { kind: 'draw'; tool: Exclude<ToolType, 'select' | 'pan' | 'polygon'>; startX: number; startY: number; curX: number; curY: number }
  | { kind: 'marquee'; startX: number; startY: number; curX: number; curY: number }
  | {
      kind: 'move';
      startArtX: number;
      startArtY: number;
      origins: Array<{ id: string; x: number; y: number; width: number; height: number; parentId: string | null }>;
      isStateDelta: boolean;
      stateOriginDelta?: { dx: number; dy: number };
    }
  | {
      kind: 'resize';
      elementId: string;
      handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
      startArtX: number;
      startArtY: number;
      origBox: { x: number; y: number; width: number; height: number };
      isStateDelta: boolean;
      origDelta?: { dx: number; dy: number; dw: number; dh: number };
    }
  | {
      kind: 'rotate';
      elementId: string;
      centerX: number;
      centerY: number;
      origRotation: number;
    };

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
  screen,
  assets,
  activeTool,
  selectedIds,
  editingState,
  zoom,
  pan,
  showGrid,
  snapToGrid,
  gridSize,
  onChangeZoom,
  onChangePan,
  onSelectIds,
  onCreateElement,
  onUpdateElement,
  onMoveElements,
  onSelectTool,
}) => {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [drag, setDrag] = React.useState<DragInteraction | null>(null);
  const [guides, setGuides] = React.useState<AlignmentGuide[]>([]);
  const [polygonPts, setPolygonPts] = React.useState<Array<{ x: number; y: number }>>([]);
  const [spacePressed, setSpacePressed] = React.useState(false);
  const [inlineEditId, setInlineEditId] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  const clientToArtboard = React.useCallback(
    (clientX: number, clientY: number) => {
      const rect = stageRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      const stageX = clientX - rect.left;
      const stageY = clientY - rect.top;
      return {
        x: (stageX - pan.x) / zoom,
        y: (stageY - pan.y) / zoom,
      };
    },
    [pan.x, pan.y, zoom]
  );

  const finishPolygon = React.useCallback(
    (pts: Array<{ x: number; y: number }>) => {
      if (pts.length < 3) {
        setPolygonPts([]);
        return;
      }
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const w = Math.max(24, Math.round(maxX - minX));
      const h = Math.max(24, Math.round(maxY - minY));
      const normalized = pts.map((p) => ({
        x: +((p.x - minX) / w).toFixed(4),
        y: +((p.y - minY) / h).toFixed(4),
      }));

      const nextZ =
        screen.elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0) + 1;

      const el = createElement('polygon', {
        x: Math.round(minX),
        y: Math.round(minY),
        width: w,
        height: h,
        zIndex: nextZ,
        vectorPoints: normalized,
      });
      onCreateElement(el);
      setPolygonPts([]);
      onSelectTool('select');
    },
    [onCreateElement, onSelectTool, screen.elements]
  );

  const handleStagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (inlineEditId) {
      setInlineEditId(null);
    }

    // Middle mouse or Pan tool or Space+drag
    if (e.button === 1 || activeTool === 'pan' || spacePressed) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        kind: 'pan',
        startClientX: e.clientX,
        startClientY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      });
      return;
    }

    const pt = clientToArtboard(e.clientX, e.clientY);

    if (activeTool === 'polygon') {
      if (e.detail >= 2 && polygonPts.length >= 2) {
        finishPolygon([...polygonPts, pt]);
        return;
      }
      setPolygonPts((prev) => [...prev, pt]);
      return;
    }

    if (activeTool !== 'select') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setDrag({
        kind: 'draw',
        tool: activeTool,
        startX: snapValue(pt.x, gridSize, snapToGrid),
        startY: snapValue(pt.y, gridSize, snapToGrid),
        curX: snapValue(pt.x, gridSize, snapToGrid),
        curY: snapValue(pt.y, gridSize, snapToGrid),
      });
      return;
    }

    // Empty stage click -> start marquee selection
    onSelectIds([]);
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({
      kind: 'marquee',
      startX: pt.x,
      startY: pt.y,
      curX: pt.x,
      curY: pt.y,
    });
  };

  const handleElementPointerDown = (e: React.PointerEvent, el: UIElement) => {
    if (activeTool !== 'select' || spacePressed || e.button === 1) return;
    e.stopPropagation();
    if (el.locked) {
      onSelectIds([el.id]);
      return;
    }

    let nextSelected = selectedIds;
    if (e.shiftKey) {
      nextSelected = selectedIds.includes(el.id)
        ? selectedIds.filter((id) => id !== el.id)
        : [...selectedIds, el.id];
    } else if (!selectedIds.includes(el.id)) {
      nextSelected = [el.id];
    }
    onSelectIds(nextSelected);

    const pt = clientToArtboard(e.clientX, e.clientY);
    const isStateDelta =
      nextSelected.length === 1 &&
      el.interactive.isInteractive &&
      editingState !== 'idle';

    const origins = nextSelected
      .map((id) => screen.elements.find((item) => item.id === id))
      .filter((item): item is UIElement => Boolean(item && !item.locked))
      .map((item) => ({
        id: item.id,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        parentId: item.parentId,
      }));

    stageRef.current?.setPointerCapture(e.pointerId);
    setDrag({
      kind: 'move',
      startArtX: pt.x,
      startArtY: pt.y,
      origins,
      isStateDelta,
      stateOriginDelta: isStateDelta
        ? {
            dx: el.interactive.states[editingState]?.transformDelta.dx ?? 0,
            dy: el.interactive.states[editingState]?.transformDelta.dy ?? 0,
          }
        : undefined,
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;

    if (drag.kind === 'pan') {
      onChangePan({
        x: drag.startPanX + (e.clientX - drag.startClientX),
        y: drag.startPanY + (e.clientY - drag.startClientY),
      });
      return;
    }

    const pt = clientToArtboard(e.clientX, e.clientY);

    if (drag.kind === 'draw') {
      const snappedX = snapValue(pt.x, gridSize, snapToGrid);
      const snappedY = snapValue(pt.y, gridSize, snapToGrid);
      setDrag({ ...drag, curX: snappedX, curY: snappedY });
      return;
    }

    if (drag.kind === 'marquee') {
      setDrag({ ...drag, curX: pt.x, curY: pt.y });
      return;
    }

    if (drag.kind === 'move') {
      const dx = pt.x - drag.startArtX;
      const dy = pt.y - drag.startArtY;

      if (drag.isStateDelta && drag.origins.length === 1 && drag.stateOriginDelta) {
        const targetId = drag.origins[0].id;
        onUpdateElement(
          targetId,
          (el) => {
            const existing = el.interactive.states[editingState];
            if (!existing) return el;
            return {
              ...el,
              interactive: {
                ...el.interactive,
                states: {
                  ...el.interactive.states,
                  [editingState]: {
                    ...existing,
                    transformDelta: {
                      ...existing.transformDelta,
                      dx: Math.round(drag.stateOriginDelta!.dx + dx),
                      dy: Math.round(drag.stateOriginDelta!.dy + dy),
                    },
                  },
                },
              },
            };
          },
          false
        );
        return;
      }

      if (drag.origins.length === 1) {
        const orig = drag.origins[0];
        let nextX = snapValue(orig.x + dx, gridSize, snapToGrid);
        let nextY = snapValue(orig.y + dy, gridSize, snapToGrid);

        if (!orig.parentId) {
          const siblings = screen.elements.filter(
            (s) => s.id !== orig.id && s.parentId === orig.parentId
          );
          const snapped = computeAlignmentSnap(
            { x: nextX, y: nextY, width: orig.width, height: orig.height },
            siblings,
            screen.width,
            screen.height,
            6
          );
          nextX = snapped.x;
          nextY = snapped.y;
          setGuides(snapped.guides);
        }

        onMoveElements([{ id: orig.id, x: nextX, y: nextY }], false);
      } else {
        setGuides([]);
        onMoveElements(
          drag.origins.map((orig) => ({
            id: orig.id,
            x: snapValue(orig.x + dx, gridSize, snapToGrid),
            y: snapValue(orig.y + dy, gridSize, snapToGrid),
          })),
          false
        );
      }
      return;
    }

    if (drag.kind === 'resize') {
      const dx = pt.x - drag.startArtX;
      const dy = pt.y - drag.startArtY;
      const { x, y, width, height } = drag.origBox;

      let nx = x;
      let ny = y;
      let nw = width;
      let nh = height;

      if (drag.handle.includes('e')) nw = Math.max(12, width + dx);
      if (drag.handle.includes('s')) nh = Math.max(8, height + dy);
      if (drag.handle.includes('w')) {
        const proposedW = Math.max(12, width - dx);
        nx = x + (width - proposedW);
        nw = proposedW;
      }
      if (drag.handle.includes('n')) {
        const proposedH = Math.max(8, height - dy);
        ny = y + (height - proposedH);
        nh = proposedH;
      }

      nx = snapValue(nx, gridSize, snapToGrid);
      ny = snapValue(ny, gridSize, snapToGrid);
      nw = snapValue(nw, gridSize, snapToGrid);
      nh = snapValue(nh, gridSize, snapToGrid);

      if (drag.isStateDelta && drag.origDelta) {
        onUpdateElement(
          drag.elementId,
          (el) => {
            const st = el.interactive.states[editingState];
            if (!st) return el;
            return {
              ...el,
              interactive: {
                ...el.interactive,
                states: {
                  ...el.interactive.states,
                  [editingState]: {
                    ...st,
                    transformDelta: {
                      ...st.transformDelta,
                      dx: drag.origDelta!.dx + (nx - x),
                      dy: drag.origDelta!.dy + (ny - y),
                      dw: drag.origDelta!.dw + (nw - width),
                      dh: drag.origDelta!.dh + (nh - height),
                    },
                  },
                },
              },
            };
          },
          false
        );
      } else {
        onUpdateElement(
          drag.elementId,
          (el) => ({ ...el, x: nx, y: ny, width: nw, height: nh }),
          false
        );
      }
      return;
    }

    if (drag.kind === 'rotate') {
      const angleRad = Math.atan2(pt.y - drag.centerY, pt.x - drag.centerX);
      const deg = Math.round((angleRad * 180) / Math.PI + 90);
      onUpdateElement(drag.elementId, (el) => ({ ...el, rotation: deg }), false);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore if not captured
    }

    if (drag.kind === 'draw') {
      const rawW = Math.abs(drag.curX - drag.startX);
      const rawH = Math.abs(drag.curY - drag.startY);
      const isClick = rawW < 6 && rawH < 6;
      const elType = drag.tool as ElementType;

      let x = Math.min(drag.startX, drag.curX);
      let y = Math.min(drag.startY, drag.curY);
      let w = rawW;
      let h = rawH;

      if (isClick) {
        const temp = createElement(elType);
        w = temp.width;
        h = temp.height;
        x = Math.round(drag.startX - w / 2);
        y = Math.round(drag.startY - h / 2);
      } else if (elType === 'square' || elType === 'circle') {
        const side = Math.max(rawW, rawH);
        w = side;
        h = side;
      } else if (elType === 'line') {
        h = Math.max(4, rawH);
      }

      // Check if drawn inside an existing top-level Frame
      let parentId: string | null = null;
      if (elType !== 'frame') {
        const enclosingFrame = [...screen.elements]
          .filter((item) => item.type === 'frame' && !item.parentId)
          .sort((a, b) => b.zIndex - a.zIndex)
          .find(
            (frame) =>
              x >= frame.x &&
              y >= frame.y &&
              x <= frame.x + frame.width &&
              y <= frame.y + frame.height
          );
        if (enclosingFrame) {
          parentId = enclosingFrame.id;
          x = Math.round(x - enclosingFrame.x);
          y = Math.round(y - enclosingFrame.y);
        }
      }

      const nextZ =
        screen.elements.reduce((acc, el) => Math.max(acc, el.zIndex), 0) + 1;
      const newEl = createElement(elType, {
        x,
        y,
        width: Math.max(12, w),
        height: Math.max(4, h),
        parentId,
        zIndex: nextZ,
      });

      onCreateElement(newEl);
      onSelectTool('select');
    } else if (drag.kind === 'marquee') {
      const minX = Math.min(drag.startX, drag.curX);
      const maxX = Math.max(drag.startX, drag.curX);
      const minY = Math.min(drag.startY, drag.curY);
      const maxY = Math.max(drag.startY, drag.curY);

      if (maxX - minX > 4 || maxY - minY > 4) {
        const hitIds = screen.elements
          .filter((el) => {
            if (!el.visible || el.locked) return false;
            const abs = getAbsolutePosition(el, screen.elements);
            return (
              abs.x + el.width >= minX &&
              abs.x <= maxX &&
              abs.y + el.height >= minY &&
              abs.y <= maxY
            );
          })
          .map((el) => el.id);
        onSelectIds(hitIds);
      }
    } else if (drag.kind === 'move' || drag.kind === 'resize' || drag.kind === 'rotate') {
      // Commit final state to undo history
      if (drag.kind === 'move' && !drag.isStateDelta) {
        const currentPositions = drag.origins
          .map((o) => screen.elements.find((el) => el.id === o.id))
          .filter((el): el is UIElement => Boolean(el))
          .map((el) => ({ id: el.id, x: el.x, y: el.y }));
        onMoveElements(currentPositions, true);
      } else if (drag.kind === 'resize' || drag.kind === 'rotate') {
        const target = screen.elements.find((el) => el.id === drag.elementId);
        if (target) {
          onUpdateElement(target.id, (el) => ({ ...el }), true);
        }
      }
    }

    setGuides([]);
    setDrag(null);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      onChangeZoom(Math.max(0.25, Math.min(2.5, +(zoom + delta).toFixed(2))));
    } else {
      onChangePan({
        x: pan.x - e.deltaX,
        y: pan.y - e.deltaY,
      });
    }
  };

  const renderCanvasElements = (parentId: string | null): React.ReactNode => {
    const items = screen.elements
      .filter((el) => el.parentId === parentId)
      .sort((a, b) => a.zIndex - b.zIndex);

    return items.map((el) => {
      const isSelected = selectedIds.includes(el.id);
      const activeStateForRender: ComponentStateName =
        isSelected && el.interactive.isInteractive
          ? editingState
          : el.interactive.defaultState;

      return (
        <div
          key={el.id}
          onPointerDown={(e) => handleElementPointerDown(e, el)}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (el.appearance.text && !el.locked) {
              setInlineEditId(el.id);
            }
          }}
        >
          <ElementRenderer
            element={el}
            allElements={screen.elements}
            assets={assets}
            stateOverride={activeStateForRender}
            renderChildren={() => renderCanvasElements(el.id)}
          />
          {inlineEditId === el.id && el.appearance.text && (
            <div
              className="absolute z-50"
              style={{
                left: getAbsolutePosition(el, screen.elements).x,
                top: getAbsolutePosition(el, screen.elements).y,
                width: el.width,
                height: el.height,
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <input
                autoFocus
                type="text"
                aria-label={`Edit text for ${el.name}`}
                value={el.appearance.text.content}
                onChange={(e) =>
                  onUpdateElement(el.id, (curr) => ({
                    ...curr,
                    appearance: {
                      ...curr.appearance,
                      text: curr.appearance.text
                        ? { ...curr.appearance.text, content: e.target.value }
                        : undefined,
                    },
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') {
                    setInlineEditId(null);
                  }
                }}
                onBlur={() => setInlineEditId(null)}
                className="w-full h-full px-2 bg-zinc-950/90 text-white border-2 border-blue-500 rounded outline-none text-center"
              />
            </div>
          )}
        </div>
      );
    });
  };

  // Selection overlay for primary selected element
  const primarySelected =
    selectedIds.length === 1
      ? screen.elements.find((e) => e.id === selectedIds[0])
      : undefined;

  const renderSelectionOverlays = () => {
    return selectedIds.map((id) => {
      const el = screen.elements.find((item) => item.id === id);
      if (!el) return null;
      const absParent = el.parentId
        ? (() => {
            const parent = screen.elements.find((p) => p.id === el.parentId);
            return parent ? getAbsolutePosition(parent, screen.elements) : { x: 0, y: 0 };
          })()
        : { x: 0, y: 0 };

      const stateToShow =
        selectedIds.length === 1 && el.interactive.isInteractive
          ? editingState
          : el.interactive.defaultState;
      const resolved = resolveElementState(el, stateToShow);
      const absX = absParent.x + resolved.x;
      const absY = absParent.y + resolved.y;

      const isSingle = primarySelected?.id === el.id && !el.locked;
      const handles: Array<{
        id: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
        style: React.CSSProperties;
        cursor: string;
      }> = [
        { id: 'nw', style: { left: -4, top: -4 }, cursor: 'nwse-resize' },
        { id: 'n', style: { left: '50%', top: -4, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
        { id: 'ne', style: { right: -4, top: -4 }, cursor: 'nesw-resize' },
        { id: 'e', style: { right: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
        { id: 'se', style: { right: -4, bottom: -4 }, cursor: 'nwse-resize' },
        { id: 's', style: { left: '50%', bottom: -4, transform: 'translateX(-50%)' }, cursor: 'ns-resize' },
        { id: 'sw', style: { left: -4, bottom: -4 }, cursor: 'nesw-resize' },
        { id: 'w', style: { left: -4, top: '50%', transform: 'translateY(-50%)' }, cursor: 'ew-resize' },
      ];

      return (
        <div
          key={`sel_${el.id}`}
          className="absolute pointer-events-none border border-blue-500"
          style={{
            left: absX,
            top: absY,
            width: resolved.width,
            height: resolved.height,
            transform: `rotate(${resolved.rotation}deg)`,
            transformOrigin: `${el.anchorPoint.x * 100}% ${el.anchorPoint.y * 100}%`,
            zIndex: 999,
          }}
        >
          {/* AnchorPoint reticle */}
          <div
            className="absolute w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-400 bg-zinc-950/80"
            style={{
              left: `${el.anchorPoint.x * 100}%`,
              top: `${el.anchorPoint.y * 100}%`,
            }}
          />

          {isSingle && (
            <>
              {/* Dimension badge */}
              <div className="absolute -bottom-6 left-0 px-1.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-mono tabular-nums whitespace-nowrap">
                {Math.round(resolved.width)} × {Math.round(resolved.height)}
                {el.interactive.isInteractive && editingState !== 'idle'
                  ? ` · ${editingState}`
                  : ''}
              </div>

              {/* Rotation handle */}
              <div
                className="absolute left-1/2 -top-7 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-blue-500 pointer-events-auto cursor-grab"
                title="Rotate"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  stageRef.current?.setPointerCapture(e.pointerId);
                  setDrag({
                    kind: 'rotate',
                    elementId: el.id,
                    centerX: absX + resolved.width / 2,
                    centerY: absY + resolved.height / 2,
                    origRotation: resolved.rotation,
                  });
                }}
              />

              {handles.map((h) => (
                <div
                  key={h.id}
                  style={{ ...h.style, cursor: h.cursor }}
                  className="absolute w-2.5 h-2.5 bg-white border border-blue-600 pointer-events-auto"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const pt = clientToArtboard(e.clientX, e.clientY);
                    const isStateDelta =
                      el.interactive.isInteractive && editingState !== 'idle';
                    const existingDelta = el.interactive.states[editingState]?.transformDelta;
                    stageRef.current?.setPointerCapture(e.pointerId);
                    setDrag({
                      kind: 'resize',
                      elementId: el.id,
                      handle: h.id,
                      startArtX: pt.x,
                      startArtY: pt.y,
                      origBox: {
                        x: el.x,
                        y: el.y,
                        width: el.width,
                        height: el.height,
                      },
                      isStateDelta,
                      origDelta: isStateDelta
                        ? {
                            dx: existingDelta?.dx ?? 0,
                            dy: existingDelta?.dy ?? 0,
                            dw: existingDelta?.dw ?? 0,
                            dh: existingDelta?.dh ?? 0,
                          }
                        : undefined,
                    });
                  }}
                />
              ))}
            </>
          )}
        </div>
      );
    });
  };

  return (
    <div
      ref={stageRef}
      data-testid="design-canvas-stage"
      onPointerDown={handleStagePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      className={`relative flex-1 h-full overflow-hidden bg-[#0D0E12] select-none ${
        activeTool === 'pan' || spacePressed
          ? 'cursor-grab active:cursor-grabbing'
          : activeTool !== 'select'
          ? 'cursor-crosshair'
          : 'cursor-default'
      }`}
    >
      {/* Polygon finish bar */}
      {activeTool === 'polygon' && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-3 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 text-xs text-zinc-200 shadow-lg"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span>Click points on artboard to draw vector polygon ({polygonPts.length} pts)</span>
          {polygonPts.length >= 3 && (
            <button
              type="button"
              onClick={() => finishPolygon(polygonPts)}
              className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              Finish Shape
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setPolygonPts([]);
              onSelectTool('select');
            }}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Transformed Workspace Container */}
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        }}
      >
        {/* Artboard label */}
        <div className="mb-1.5 text-xs font-mono text-zinc-400 pointer-events-none select-none">
          {screen.name} · {screen.width} × {screen.height}
        </div>

        {/* Artboard */}
        <div
          data-testid="design-artboard"
          className="relative shadow-2xl border border-zinc-700/80 overflow-hidden"
          style={{
            width: screen.width,
            height: screen.height,
            backgroundColor: screen.backgroundColor,
            backgroundImage: showGrid
              ? `linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)`
              : undefined,
            backgroundSize: showGrid ? `${gridSize}px ${gridSize}px` : undefined,
          }}
        >

          {renderCanvasElements(null)}

          {/* Alignment Guides */}
          {guides.map((g, idx) =>
            g.axis === 'x' ? (
              <div
                key={`gx_${idx}`}
                className="absolute top-0 bottom-0 w-px bg-rose-500 pointer-events-none z-[998]"
                style={{ left: g.position }}
              />
            ) : (
              <div
                key={`gy_${idx}`}
                className="absolute left-0 right-0 h-px bg-rose-500 pointer-events-none z-[998]"
                style={{ top: g.position }}
              />
            )
          )}

          {/* Active Draw Preview */}
          {drag?.kind === 'draw' && (
            <div
              className="absolute border-2 border-blue-400 bg-blue-500/15 pointer-events-none z-[999]"
              style={{
                left: Math.min(drag.startX, drag.curX),
                top: Math.min(drag.startY, drag.curY),
                width: Math.max(4, Math.abs(drag.curX - drag.startX)),
                height: Math.max(4, Math.abs(drag.curY - drag.startY)),
                borderRadius:
                  drag.tool === 'circle' || drag.tool === 'ellipse' ? '9999px' : '4px',
              }}
            />
          )}

          {/* Active Marquee Box */}
          {drag?.kind === 'marquee' && (
            <div
              className="absolute border border-blue-400 bg-blue-500/10 pointer-events-none z-[999]"
              style={{
                left: Math.min(drag.startX, drag.curX),
                top: Math.min(drag.startY, drag.curY),
                width: Math.abs(drag.curX - drag.startX),
                height: Math.abs(drag.curY - drag.startY),
              }}
            />
          )}

          {/* Active Polygon Draft */}
          {polygonPts.length > 0 && (
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none z-[999]"
              viewBox={`0 0 ${screen.width} ${screen.height}`}
            >
              <polyline
                points={polygonPts.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#3B82F6"
                strokeWidth="2"
              />
              {polygonPts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r="4" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
              ))}
            </svg>
          )}

          {renderSelectionOverlays()}
        </div>
      </div>
    </div>
  );
};
