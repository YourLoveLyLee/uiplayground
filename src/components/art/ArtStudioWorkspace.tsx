import React from 'react';
import {
  Blend,
  Brush,
  Circle,
  Compass,
  Download,
  Droplet,
  Eraser,
  Expand,
  FilePlus2,
  Hand,
  Lasso,
  Layers,
  Minimize2,
  Minus,
  Move,
  PaintBucket,
  Paintbrush,
  Palette,
  Pipette,
  Redo2,
  RotateCcw,
  Send,
  Square,
  SquareDashed,
  Undo2,
  X,
} from 'lucide-react';
import { ArtCanvasEngine, createBlankArtDocument } from '../../engine/ArtCanvasEngine';
import type {
  ArtDocument,
  ArtToolType,
  BrushConfig,
  BrushPack,
  ColorPalette,
  GestureConfig,
  StrokeInputPoint,
} from '../../types/artStudio';
import type { AssetItem, ComponentStateName, UIElement } from '../../types/roblox';
import { ColorWheelPicker } from './ColorWheelPicker';
import { ArtLayersPanel } from './ArtLayersPanel';
import { BrushStudioModal } from './BrushStudioModal';
import { GuidesAndReferencePanel } from './GuidesAndReferencePanel';
import { SendToUIWorkshopModal } from './SendToUIWorkshopModal';

interface ArtStudioWorkspaceProps {
  engine: ArtCanvasEngine;
  doc: ArtDocument;
  brushPacks: BrushPack[];
  palettes: ColorPalette[];
  gestures: GestureConfig;
  uiElements: UIElement[];
  onSaveBrush: (packId: string, brush: BrushConfig) => void;
  onDeleteBrush: (packId: string, brushId: string) => void;
  onAddBrushPack: (pack: BrushPack) => void;
  onAddSwatchToPalette: (paletteId: string, hex: string) => void;
  onCreatePalette: (name: string) => void;
  onUpdateGestures: (cfg: GestureConfig) => void;
  onExportToUIWorkshop: (payload: {
    asset: AssetItem;
    targetElementId: string | 'new_image' | 'none';
    targetState: ComponentStateName;
    switchToUI: boolean;
  }) => void;
  onResetDocument: (nextDoc: ArtDocument) => Promise<void>;
  notify: (msg: string) => void;
}

const TOOL_BUTTONS: Array<{ id: ArtToolType; label: string; icon: React.ReactNode }> = [
  { id: 'brush', label: 'Brush', icon: <Brush className="w-4 h-4" /> },
  { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-4 h-4" /> },
  { id: 'smudge', label: 'Smudge', icon: <Blend className="w-4 h-4" /> },
  { id: 'blur', label: 'Blur', icon: <Droplet className="w-4 h-4" /> },
  { id: 'bucket', label: 'Fill', icon: <PaintBucket className="w-4 h-4" /> },
  { id: 'eyedropper', label: 'Eyedropper', icon: <Pipette className="w-4 h-4" /> },
  { id: 'lasso', label: 'Lasso', icon: <Lasso className="w-4 h-4" /> },
  { id: 'rect_select', label: 'Rect Select', icon: <SquareDashed className="w-4 h-4" /> },
  { id: 'move', label: 'Move Layer', icon: <Move className="w-4 h-4" /> },
  { id: 'line', label: 'Line', icon: <Minus className="w-4 h-4" /> },
  { id: 'rect_shape', label: 'Rectangle', icon: <Square className="w-4 h-4" /> },
  { id: 'circle_shape', label: 'Ellipse', icon: <Circle className="w-4 h-4" /> },
  { id: 'pan', label: 'Pan View', icon: <Hand className="w-4 h-4" /> },
];

export const ArtStudioWorkspace: React.FC<ArtStudioWorkspaceProps> = ({
  engine,
  doc,
  brushPacks,
  palettes,
  gestures,
  uiElements,
  onSaveBrush,
  onDeleteBrush,
  onAddBrushPack,
  onAddSwatchToPalette,
  onCreatePalette,
  onUpdateGestures,
  onExportToUIWorkshop,
  onResetDocument,
  notify,
}) => {
  const displayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const [activeTool, setActiveTool] = React.useState<ArtToolType>('brush');
  const [activeBrushId, setActiveBrushId] = React.useState<string>(
    brushPacks[0]?.brushes[0]?.id ?? 'brush_pencil'
  );
  const [activeColor, setActiveColor] = React.useState<string>('#2563EB');

  // View transform (Zoom, Pan, Canvas Rotation in degrees)
  const [zoom, setZoom] = React.useState(0.55);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [rotationDeg, setRotationDeg] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);

  // Adaptive Panel states (desktop side dock or mobile slide-over drawer)
  const [sideTab, setSideTab] = React.useState<'color' | 'layers'>('layers');
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [brushModalOpen, setBrushModalOpen] = React.useState(false);
  const [guidesModalOpen, setGuidesModalOpen] = React.useState(false);
  const [sendModalOpen, setSendModalOpen] = React.useState(false);

  // Active pointer / multi-touch gesture tracking
  const activePointersRef = React.useRef<Map<number, { x: number; y: number; type: string }>>(new Map());
  const gestureStateRef = React.useRef<{
    isPinching: boolean;
    startDist: number;
    startAngle: number;
    startZoom: number;
    startRot: number;
    lastMidX: number;
    lastMidY: number;
    maxTouchCount: number;
    touchStartTime: number;
    movedSignificantly: boolean;
  }>({
    isPinching: false,
    startDist: 0,
    startAngle: 0,
    startZoom: 1,
    startRot: 0,
    lastMidX: 0,
    lastMidY: 0,
    maxTouchCount: 0,
    touchStartTime: 0,
    movedSignificantly: false,
  });

  const drawingToolStateRef = React.useRef<{
    isDrawing: boolean;
    startPt: { x: number; y: number } | null;
    currPt: { x: number; y: number } | null;
    lassoPts: Array<{ x: number; y: number }>;
    lastPanScreen: { x: number; y: number } | null;
  }>({
    isDrawing: false,
    startPt: null,
    currPt: null,
    lassoPts: [],
    lastPanScreen: null,
  });

  const activeBrush = React.useMemo(() => {
    for (const pack of brushPacks) {
      const b = pack.brushes.find((item) => item.id === activeBrushId);
      if (b) return b;
    }
    return brushPacks[0]?.brushes[0];
  }, [brushPacks, activeBrushId]);

  const activeBrushPackId = React.useMemo(() => {
    for (const pack of brushPacks) {
      if (pack.brushes.some((item) => item.id === activeBrushId)) return pack.id;
    }
    return brushPacks[0]?.id ?? 'pack_core_studio';
  }, [brushPacks, activeBrushId]);

  // Fit artboard smoothly on initial mount or viewport resize
  const fitCanvasToViewport = React.useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 40) return;
    const pad = rect.width < 640 ? 28 : 72;
    const nextZoom = Math.max(
      0.15,
      Math.min(1.5, Math.min((rect.width - pad) / doc.width, (rect.height - pad) / doc.height))
    );
    setZoom(Number(nextZoom.toFixed(2)));
    setPan({ x: 0, y: 0 });
    setRotationDeg(0);
  }, [doc.width, doc.height]);

  React.useEffect(() => {
    fitCanvasToViewport();
    const vp = viewportRef.current;
    if (!vp || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      fitCanvasToViewport();
    });
    ro.observe(vp);
    return () => ro.disconnect();
  }, [fitCanvasToViewport]);

  // Render composite artwork + interactive overlays
  const renderViewport = React.useCallback(() => {
    const dc = displayCanvasRef.current;
    if (dc) {
      if (dc.width !== doc.width || dc.height !== doc.height) {
        dc.width = doc.width;
        dc.height = doc.height;
      }
      const ctx = dc.getContext('2d');
      if (ctx) {
        engine.renderCompositeToCanvas(ctx, true);
      }
    }

    const oc = overlayCanvasRef.current;
    if (oc) {
      if (oc.width !== doc.width || oc.height !== doc.height) {
        oc.width = doc.width;
        oc.height = doc.height;
      }
      const octx = oc.getContext('2d');
      if (octx) {
        octx.clearRect(0, 0, doc.width, doc.height);

        // Grid overlay
        if (doc.guides.gridVisible) {
          octx.save();
          octx.strokeStyle = 'rgba(59, 130, 246, 0.22)';
          octx.lineWidth = 1;
          const step = Math.max(16, doc.guides.gridSize);
          for (let x = step; x < doc.width; x += step) {
            octx.beginPath();
            octx.moveTo(x, 0);
            octx.lineTo(x, doc.height);
            octx.stroke();
          }
          for (let y = step; y < doc.height; y += step) {
            octx.beginPath();
            octx.moveTo(0, y);
            octx.lineTo(doc.width, y);
            octx.stroke();
          }
          octx.restore();
        }

        // Symmetry guide lines
        if (doc.guides.symmetry !== 'none') {
          octx.save();
          octx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
          octx.setLineDash([8, 6]);
          octx.lineWidth = 2;
          const cx = doc.width / 2;
          const cy = doc.height / 2;
          if (doc.guides.symmetry === 'vertical' || doc.guides.symmetry === 'quadrant') {
            octx.beginPath();
            octx.moveTo(cx, 0);
            octx.lineTo(cx, doc.height);
            octx.stroke();
          }
          if (doc.guides.symmetry === 'horizontal' || doc.guides.symmetry === 'quadrant') {
            octx.beginPath();
            octx.moveTo(0, cy);
            octx.lineTo(doc.width, cy);
            octx.stroke();
          }
          if (doc.guides.symmetry === 'radial') {
            const count = doc.guides.radialSegments;
            const radius = Math.hypot(doc.width, doc.height);
            for (let i = 0; i < count; i++) {
              const a = (i * Math.PI * 2) / count;
              octx.beginPath();
              octx.moveTo(cx, cy);
              octx.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
              octx.stroke();
            }
          }
          octx.restore();
        }

        // Perspective lines
        if (doc.guides.perspectiveVisible) {
          octx.save();
          octx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
          octx.lineWidth = 1.5;
          const horizonY = doc.height * 0.5;
          octx.beginPath();
          octx.moveTo(0, horizonY);
          octx.lineTo(doc.width, horizonY);
          octx.stroke();
          for (const vp of doc.guides.vanishingPoints) {
            octx.fillStyle = '#A855F7';
            octx.beginPath();
            octx.arc(vp.x, vp.y, 6, 0, Math.PI * 2);
            octx.fill();
            for (let a = -3; a <= 3; a++) {
              const ty = horizonY + a * (doc.height * 0.16);
              octx.beginPath();
              octx.moveTo(vp.x, vp.y);
              octx.lineTo(vp.x < doc.width / 2 ? doc.width : 0, ty);
              octx.stroke();
            }
          }
          octx.restore();
        }

        // Active Selection outline
        const sel = engine.getSelection();
        if (sel && sel.points.length >= 2) {
          octx.save();
          octx.strokeStyle = '#38BDF8';
          octx.lineWidth = 2;
          octx.setLineDash([6, 4]);
          octx.beginPath();
          if (sel.kind === 'rect') {
            octx.rect(sel.bounds.x, sel.bounds.y, sel.bounds.width, sel.bounds.height);
          } else {
            sel.points.forEach((p, idx) => (idx === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y)));
            octx.closePath();
          }
          octx.stroke();
          octx.restore();
        }

        // Rubber-band shape / lasso preview during drag
        const st = drawingToolStateRef.current;
        if (st.isDrawing && st.startPt && st.currPt) {
          octx.save();
          octx.strokeStyle = activeColor;
          octx.lineWidth = Math.max(2, activeBrush?.size ? activeBrush.size * 0.35 : 4);
          if (activeTool === 'line') {
            octx.beginPath();
            octx.moveTo(st.startPt.x, st.startPt.y);
            octx.lineTo(st.currPt.x, st.currPt.y);
            octx.stroke();
          } else if (activeTool === 'rect_shape' || activeTool === 'rect_select') {
            if (activeTool === 'rect_select') {
              octx.strokeStyle = '#38BDF8';
              octx.setLineDash([6, 4]);
              octx.lineWidth = 2;
            }
            octx.strokeRect(
              Math.min(st.startPt.x, st.currPt.x),
              Math.min(st.startPt.y, st.currPt.y),
              Math.abs(st.currPt.x - st.startPt.x),
              Math.abs(st.currPt.y - st.startPt.y)
            );
          } else if (activeTool === 'circle_shape') {
            octx.beginPath();
            octx.ellipse(
              (st.startPt.x + st.currPt.x) / 2,
              (st.startPt.y + st.currPt.y) / 2,
              Math.abs(st.currPt.x - st.startPt.x) / 2,
              Math.abs(st.currPt.y - st.startPt.y) / 2,
              0,
              0,
              Math.PI * 2
            );
            octx.stroke();
          } else if (activeTool === 'lasso' && st.lassoPts.length > 1) {
            octx.strokeStyle = '#38BDF8';
            octx.setLineDash([6, 4]);
            octx.lineWidth = 2;
            octx.beginPath();
            st.lassoPts.forEach((p, idx) => (idx === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y)));
            octx.stroke();
          }
          octx.restore();
        }
      }
    }
  }, [doc, engine, activeColor, activeBrush, activeTool]);

  React.useEffect(() => {
    renderViewport();
    return engine.subscribe(renderViewport);
  }, [engine, renderViewport]);

  const screenToCanvasPoint = (clientX: number, clientY: number): { x: number; y: number } => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // Map screen coordinates accounting for centered rotation + scale
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const rad = (-rotationDeg * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return {
      x: rx / zoom + doc.width / 2,
      y: ry / zoom + doc.height / 2,
    };
  };

  const toStrokePoint = (e: PointerEvent | React.PointerEvent): StrokeInputPoint => {
    const pos = screenToCanvasPoint(e.clientX, e.clientY);
    const pressure = e.pointerType === 'pen' ? Math.max(0.05, e.pressure) : e.pressure > 0 ? e.pressure : 0.65;
    return {
      x: pos.x,
      y: pos.y,
      pressure,
      tiltX: e.tiltX || 0,
      tiltY: e.tiltY || 0,
      timestamp: e.timeStamp || performance.now(),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType,
    });

    const ptrs = Array.from(activePointersRef.current.values());
    if (e.pointerType === 'touch') {
      gestureStateRef.current.maxTouchCount = Math.max(
        gestureStateRef.current.maxTouchCount,
        ptrs.length
      );
      if (ptrs.length === 1) {
        gestureStateRef.current.touchStartTime = performance.now();
        gestureStateRef.current.movedSignificantly = false;
      }
    }

    // Multi-touch Pinch / Pan / Rotate Gesture
    if (ptrs.length >= 2) {
      drawingToolStateRef.current.isDrawing = false;
      const [p1, p2] = ptrs;
      gestureStateRef.current.isPinching = true;
      gestureStateRef.current.startDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      gestureStateRef.current.startAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      gestureStateRef.current.startZoom = zoom;
      gestureStateRef.current.startRot = rotationDeg;
      gestureStateRef.current.lastMidX = (p1.x + p2.x) / 2;
      gestureStateRef.current.lastMidY = (p1.y + p2.y) / 2;
      return;
    }

    // Palm rejection or Pan tool
    const fingerPanOnly = gestures.stylusOnlyDraw && e.pointerType === 'touch';
    if (activeTool === 'pan' || fingerPanOnly || e.button === 1) {
      drawingToolStateRef.current.lastPanScreen = { x: e.clientX, y: e.clientY };
      return;
    }

    const pt = toStrokePoint(e);
    if (activeTool === 'eyedropper') {
      const picked = engine.pickColorAt(pt.x, pt.y);
      if (picked) {
        setActiveColor(picked);
        notify(`Picked color ${picked.toUpperCase()}`);
      }
      return;
    }
    if (activeTool === 'bucket') {
      engine.bucketFill(pt.x, pt.y, activeColor);
      return;
    }

    drawingToolStateRef.current.isDrawing = true;
    drawingToolStateRef.current.startPt = { x: pt.x, y: pt.y };
    drawingToolStateRef.current.currPt = { x: pt.x, y: pt.y };
    drawingToolStateRef.current.lassoPts = [{ x: pt.x, y: pt.y }];

    if (
      (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'smudge' || activeTool === 'blur') &&
      activeBrush
    ) {
      engine.beginStroke(pt, activeBrush);
      const mode =
        activeTool === 'eraser'
          ? 'erase'
          : activeTool === 'smudge'
          ? 'smudge'
          : activeTool === 'blur'
          ? 'blur'
          : 'paint';
      engine.extendStroke(pt, activeBrush, activeColor, mode);
      renderViewport();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      const prev = activePointersRef.current.get(e.pointerId)!;
      if (Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > 8) {
        gestureStateRef.current.movedSignificantly = true;
      }
      activePointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType,
      });
    }

    const ptrs = Array.from(activePointersRef.current.values());
    if (gestureStateRef.current.isPinching && ptrs.length >= 2) {
      const [p1, p2] = ptrs;
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      const dx = midX - gestureStateRef.current.lastMidX;
      const dy = midY - gestureStateRef.current.lastMidY;
      gestureStateRef.current.lastMidX = midX;
      gestureStateRef.current.lastMidY = midY;

      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      if (gestures.pinchToZoom && gestureStateRef.current.startDist > 10) {
        const scale = dist / gestureStateRef.current.startDist;
        setZoom(Math.max(0.15, Math.min(4, gestureStateRef.current.startZoom * scale)));
      }
      if (gestures.twoFingerRotate) {
        const degDelta = ((angle - gestureStateRef.current.startAngle) * 180) / Math.PI;
        setRotationDeg(gestureStateRef.current.startRot + degDelta);
      }
      return;
    }

    if (drawingToolStateRef.current.lastPanScreen) {
      const dx = e.clientX - drawingToolStateRef.current.lastPanScreen.x;
      const dy = e.clientY - drawingToolStateRef.current.lastPanScreen.y;
      drawingToolStateRef.current.lastPanScreen = { x: e.clientX, y: e.clientY };
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      return;
    }

    if (!drawingToolStateRef.current.isDrawing) return;

    const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ce of coalesced) {
      const pt = toStrokePoint(ce);
      drawingToolStateRef.current.currPt = { x: pt.x, y: pt.y };

      if (
        (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'smudge' || activeTool === 'blur') &&
        activeBrush
      ) {
        const mode =
          activeTool === 'eraser'
            ? 'erase'
            : activeTool === 'smudge'
            ? 'smudge'
            : activeTool === 'blur'
            ? 'blur'
            : 'paint';
        engine.extendStroke(pt, activeBrush, activeColor, mode);
      } else if (activeTool === 'lasso') {
        drawingToolStateRef.current.lassoPts.push({ x: pt.x, y: pt.y });
      }
    }
    renderViewport();
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(e.pointerId);

    // Check quick 2-finger tap Undo / 3-finger tap Redo when all fingers lifted
    if (activePointersRef.current.size === 0 && gestureStateRef.current.isPinching) {
      const elapsed = performance.now() - gestureStateRef.current.touchStartTime;
      if (elapsed < 320 && !gestureStateRef.current.movedSignificantly) {
        if (gestureStateRef.current.maxTouchCount === 2 && gestures.twoFingerTapUndo) {
          if (engine.undo()) notify('Two-finger tap: Undo');
        } else if (gestureStateRef.current.maxTouchCount >= 3 && gestures.threeFingerTapRedo) {
          if (engine.redo()) notify('Three-finger tap: Redo');
        }
      }
      gestureStateRef.current.isPinching = false;
      gestureStateRef.current.maxTouchCount = 0;
    }

    drawingToolStateRef.current.lastPanScreen = null;
    if (!drawingToolStateRef.current.isDrawing) return;
    drawingToolStateRef.current.isDrawing = false;

    const { startPt, currPt, lassoPts } = drawingToolStateRef.current;

    if (activeTool === 'brush' || activeTool === 'eraser' || activeTool === 'smudge' || activeTool === 'blur') {
      await engine.endStroke();
    } else if (startPt && currPt) {
      if (activeTool === 'line' || activeTool === 'rect_shape' || activeTool === 'circle_shape') {
        engine.drawShape(
          activeTool,
          startPt.x,
          startPt.y,
          currPt.x,
          currPt.y,
          activeColor,
          Math.max(2, (activeBrush?.size ?? 8) * 0.45)
        );
      } else if (activeTool === 'rect_select') {
        const w = Math.abs(currPt.x - startPt.x);
        const h = Math.abs(currPt.y - startPt.y);
        if (w > 4 && h > 4) {
          const x = Math.min(startPt.x, currPt.x);
          const y = Math.min(startPt.y, currPt.y);
          engine.setSelection({
            kind: 'rect',
            points: [
              { x, y },
              { x: x + w, y: y + h },
            ],
            bounds: { x, y, width: w, height: h },
          });
        }
      } else if (activeTool === 'lasso' && lassoPts.length > 3) {
        const xs = lassoPts.map((p) => p.x);
        const ys = lassoPts.map((p) => p.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        engine.setSelection({
          kind: 'lasso',
          points: lassoPts,
          bounds: {
            x: minX,
            y: minY,
            width: Math.max(1, Math.max(...xs) - minX),
            height: Math.max(1, Math.max(...ys) - minY),
          },
        });
      } else if (activeTool === 'move') {
        engine.translateActiveLayer(currPt.x - startPt.x, currPt.y - startPt.y);
      }
    }

    drawingToolStateRef.current.startPt = null;
    drawingToolStateRef.current.currPt = null;
    drawingToolStateRef.current.lassoPts = [];
    renderViewport();
  };

  const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    const delta = e.deltaY > 0 ? -0.08 : 0.08;
    setZoom((z) => Math.max(0.15, Math.min(4, Number((z + delta).toFixed(2)))));
  };

  const handleDownloadPng = async () => {
    const res = await engine.exportPngDataUrl({ transparent: false, scale: 1 });
    const a = document.createElement('a');
    a.href = res.dataUrl;
    a.download = `${doc.title.replace(/\s+/g, '_').toLowerCase()}.png`;
    a.click();
    notify('Exported artwork PNG');
  };

  const handleNewIllustration = async () => {
    const fresh = createBlankArtDocument('New Illustration', 1024, 1024);
    await onResetDocument(fresh);
    notify('Created new Art Studio canvas');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0E1014] text-zinc-100 relative select-none">
      {/* Art Studio Toolbar */}
      <div className="h-11 shrink-0 px-2 border-b border-zinc-800 bg-[#14161B] flex items-center justify-between gap-1.5 overflow-x-auto">
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <input
            type="text"
            aria-label="Illustration title"
            value={doc.title}
            onChange={(e) => engine.updateDocumentMeta({ title: e.target.value })}
            className="w-36 md:w-44 px-2 py-1 rounded bg-zinc-900/70 border border-zinc-800 focus:border-emerald-500 text-xs text-zinc-100 outline-none truncate"
          />
          <span className="hidden md:inline text-[11px] font-mono text-zinc-500 whitespace-nowrap">
            {doc.width}×{doc.height} · {doc.dpi}DPI
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0 sm:ml-auto">
          <button
            type="button"
            aria-label="Art Studio Undo"
            onClick={() => engine.undo()}
            disabled={!engine.canUndo()}
            className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-200 shrink-0"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Art Studio Redo"
            onClick={() => engine.redo()}
            disabled={!engine.canRedo()}
            className="p-1.5 rounded hover:bg-zinc-800 disabled:opacity-30 text-zinc-200 shrink-0"
          >
            <Redo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            aria-label="Reset Art View"
            onClick={fitCanvasToViewport}
            className="px-1.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-[11px] font-mono text-zinc-300 shrink-0"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            type="button"
            aria-label="Guides and Canvas Settings"
            data-tour-id="art-guides-btn"
            onClick={() => setGuidesModalOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 whitespace-nowrap shrink-0"
          >
            <Compass className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Guides</span>
          </button>

          <button
            type="button"
            aria-label="Open Brush Studio"
            data-tour-id="art-brushes-btn"
            onClick={() => setBrushModalOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-100 whitespace-nowrap shrink-0"
          >
            <Paintbrush className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">{activeBrush?.name ?? 'Brushes'}</span>
          </button>

          {/* Mobile Drawer Trigger for Color/Layers */}
          <button
            type="button"
            aria-label="Toggle Layers and Color Drawer"
            onClick={() => setMobileDrawerOpen((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-800 text-xs text-zinc-100 whitespace-nowrap shrink-0"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Layers</span>
          </button>

          <button
            type="button"
            aria-label="Toggle Fullscreen Canvas"
            onClick={() => setFullscreen((f) => !f)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-300 shrink-0"
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Expand className="w-4 h-4" />}
          </button>

          <button
            type="button"
            aria-label="New Artwork Canvas"
            onClick={() => void handleNewIllustration()}
            className="hidden sm:inline-flex p-1.5 rounded hover:bg-zinc-800 text-zinc-300 shrink-0"
          >
            <FilePlus2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            aria-label="Download Artwork PNG"
            onClick={() => void handleDownloadPng()}
            className="hidden sm:inline-flex p-1.5 rounded hover:bg-zinc-800 text-zinc-300 shrink-0"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            data-tour-id="art-send-ui-btn"
            onClick={() => setSendModalOpen(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send to UI</span>
          </button>
        </div>
      </div>

      {/* Main Studio Body */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Tool Dock (hidden in fullscreen) */}
        {!fullscreen && (
          <aside
            data-tour-id="art-tool-dock"
            className="w-12 sm:w-14 shrink-0 border-r border-zinc-800 bg-[#14161B] flex flex-col items-center py-2 gap-1 overflow-y-auto z-20"
          >
            {TOOL_BUTTONS.map((tool) => (
              <button
                key={tool.id}
                type="button"
                title={tool.label}
                aria-label={tool.label}
                onClick={() => setActiveTool(tool.id)}
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                  activeTool === tool.id
                    ? 'bg-emerald-600 text-white shadow'
                    : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                }`}
              >
                {tool.icon}
              </button>
            ))}

            {/* Quick Active Color Swatch */}
            <button
              type="button"
              data-tour-id="art-color-btn"
              aria-label="Open Color Picker"
              onClick={() => {
                setSideTab('color');
                setMobileDrawerOpen(true);
              }}
              className="mt-auto w-8 h-8 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: activeColor }}
            />
          </aside>
        )}

        {/* Quick Brush Size & Opacity Floating Pill (compact edge bar) */}
        {!fullscreen && activeBrush && (
          <div
            data-tour-id="art-quick-sliders"
            className="hidden sm:flex flex-col gap-2 w-12 py-3 px-1.5 bg-[#14161B]/90 border-r border-zinc-800 items-center text-[10px] font-mono text-zinc-400 shrink-0 z-10"
          >
            <span>{Math.round(activeBrush.size)}px</span>
            <input
              type="range"
              aria-label="Quick Brush Size"
              min={1}
              max={150}
              value={activeBrush.size}
              onChange={(e) =>
                onSaveBrush(activeBrushPackId, { ...activeBrush, size: Number(e.target.value) })
              }
              className="h-24 w-2 accent-emerald-500 [writing-mode:vertical-lr] rotate-180 cursor-pointer"
            />
            <span>{Math.round(activeBrush.opacity * 100)}%</span>
            <input
              type="range"
              aria-label="Quick Brush Opacity"
              min={0.05}
              max={1}
              step={0.05}
              value={activeBrush.opacity}
              onChange={(e) =>
                onSaveBrush(activeBrushPackId, {
                  ...activeBrush,
                  opacity: Number(e.target.value),
                })
              }
              className="h-24 w-2 accent-blue-500 [writing-mode:vertical-lr] rotate-180 cursor-pointer"
            />
          </div>
        )}

        {/* Center Canvas Viewport (touch-action: none blocks native page scrolling) */}
        <div
          ref={viewportRef}
          data-tour-id="art-canvas-stage"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheelZoom}
          className="flex-1 relative overflow-hidden bg-[#090B0F] flex items-center justify-center touch-none cursor-crosshair"
        >
          {/* Transformed Artboard Wrapper */}
          <div
            className="relative shrink-0 shadow-2xl border border-zinc-700/80"
            style={{
              width: doc.width,
              height: doc.height,
              minWidth: doc.width,
              minHeight: doc.height,
              transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotationDeg}deg) scale(${zoom})`,
              transformOrigin: 'center center',
              backgroundImage:
                'linear-gradient(45deg, #1a1d24 25%, transparent 25%), linear-gradient(-45deg, #1a1d24 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1d24 75%), linear-gradient(-45deg, transparent 75%, #1a1d24 75%)',
              backgroundSize: '24px 24px',
              backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0',
            }}
          >
            <canvas
              ref={displayCanvasRef}
              data-testid="art-studio-canvas"
              className="block w-full h-full pointer-events-none"
            />
            <canvas
              ref={overlayCanvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />
          </div>

          {/* Selection Clear Floating Pill */}
          {engine.getSelection() && (
            <button
              type="button"
              onClick={() => engine.clearSelection()}
              className="absolute top-3 left-3 z-20 inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium shadow-lg"
            >
              <RotateCcw className="w-3 h-3" /> Clear Selection
            </button>
          )}

          {/* Floating Reference Image Window */}
          {doc.referenceImage?.visible && doc.referenceImage.dataUrl && (
            <div
              className="absolute top-3 right-3 z-20 w-36 sm:w-44 rounded-lg border border-zinc-700 bg-zinc-950/90 shadow-xl overflow-hidden"
              style={{ opacity: doc.referenceImage.opacity }}
            >
              <div className="px-2 py-1 bg-zinc-900 flex items-center justify-between text-[10px] text-zinc-300">
                <span>Reference</span>
                <button
                  type="button"
                  aria-label="Hide reference"
                  onClick={() =>
                    engine.updateDocumentMeta({
                      referenceImage: { ...doc.referenceImage!, visible: false },
                    })
                  }
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <img
                src={doc.referenceImage.dataUrl}
                alt="Reference"
                className="w-full max-h-40 object-contain pointer-events-none"
              />
            </div>
          )}

          {fullscreen && (
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="absolute top-3 right-3 z-30 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-900/90 border border-zinc-700 text-xs text-white shadow-lg"
            >
              <Minimize2 className="w-3.5 h-3.5" /> Exit Fullscreen
            </button>
          )}
        </div>

        {/* Right Side Panel (Desktop always visible; Mobile slide-over drawer) */}
        {!fullscreen && (
          <aside
            className={`${
              mobileDrawerOpen
                ? 'fixed inset-y-12 right-0 z-40 flex w-72 shadow-2xl'
                : 'hidden lg:flex w-72'
            } shrink-0 border-l border-zinc-800 bg-[#14161B] flex-col`}
          >
            <div className="p-2 border-b border-zinc-800 flex items-center gap-1">
              <button
                type="button"
                data-tour-id="art-layers-btn"
                onClick={() => setSideTab('layers')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium ${
                  sideTab === 'layers'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Layers
              </button>
              <button
                type="button"
                onClick={() => setSideTab('color')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium ${
                  sideTab === 'color'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100'
                }`}
              >
                <Palette className="w-3.5 h-3.5" /> Color
              </button>
              <button
                type="button"
                aria-label="Close Art Side Drawer"
                onClick={() => setMobileDrawerOpen(false)}
                className="lg:hidden p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {sideTab === 'layers' ? (
                <ArtLayersPanel
                  layers={doc.layers}
                  activeLayerId={doc.activeLayerId}
                  onSelectLayer={(id) => engine.setActiveLayer(id)}
                  onAddLayer={(kind) => engine.addLayer(kind)}
                  onDuplicateLayer={(id) => engine.duplicateLayer(id)}
                  onDeleteLayer={(id) => engine.deleteLayer(id)}
                  onClearLayer={(id) => engine.clearLayer(id)}
                  onMergeDown={(id) => engine.mergeLayerDown(id)}
                  onMoveLayer={(id, dir) => engine.moveLayerOrder(id, dir)}
                  onUpdateLayer={(id, updater) => engine.updateLayer(id, updater)}
                />
              ) : (
                <ColorWheelPicker
                  color={activeColor}
                  onChangeColor={setActiveColor}
                  palettes={palettes}
                  onAddSwatchToPalette={onAddSwatchToPalette}
                  onCreatePalette={onCreatePalette}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modals */}
      <BrushStudioModal
        open={brushModalOpen}
        onClose={() => setBrushModalOpen(false)}
        brushPacks={brushPacks}
        activeBrushId={activeBrushId}
        activeColor={activeColor}
        onSelectBrush={(b) => setActiveBrushId(b.id)}
        onSaveBrush={onSaveBrush}
        onDeleteBrush={onDeleteBrush}
        onAddBrushPack={onAddBrushPack}
      />

      <GuidesAndReferencePanel
        open={guidesModalOpen}
        onClose={() => setGuidesModalOpen(false)}
        doc={doc}
        gestures={gestures}
        onResizeCanvas={(w, h, dpi) => engine.resizeCanvas(w, h, dpi)}
        onUpdateDocMeta={(patch) => engine.updateDocumentMeta(patch)}
        onUpdateGuides={(updater) => engine.updateGuides(updater)}
        onUpdateGestures={onUpdateGestures}
      />

      <SendToUIWorkshopModal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        docTitle={doc.title}
        layers={doc.layers}
        uiElements={uiElements}
        onConfirmExport={async ({
          exportKind,
          scale,
          assetName,
          targetElementId,
          targetState,
          switchToUI,
        }) => {
          if (exportKind === 'sprite_atlas') {
            const atlas = await engine.exportSpriteAtlas();
            const asset: AssetItem = {
              id: `asset_${Date.now().toString(36)}`,
              name: `${assetName}_Atlas`,
              mimeType: 'image/png',
              dataUrl: atlas.dataUrl,
              width: atlas.width,
              height: atlas.height,
              isAtlas: true,
              sprites: atlas.sprites,
            };
            onExportToUIWorkshop({
              asset,
              targetElementId,
              targetState,
              switchToUI,
            });
          } else {
            const res = await engine.exportPngDataUrl({
              transparent: exportKind !== 'opaque_png',
              scale,
              layerId: exportKind === 'active_layer' ? doc.activeLayerId : undefined,
            });
            const asset: AssetItem = {
              id: `asset_${Date.now().toString(36)}`,
              name: assetName,
              mimeType: 'image/png',
              dataUrl: res.dataUrl,
              width: res.width,
              height: res.height,
              isAtlas: false,
              sprites: [],
            };
            onExportToUIWorkshop({
              asset,
              targetElementId,
              targetState,
              switchToUI,
            });
          }
        }}
      />
    </div>
  );
};
