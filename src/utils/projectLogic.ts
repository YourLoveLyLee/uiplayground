import type {
  ComponentStateName,
  ElementType,
  InteractiveComponentType,
  ScreenArtboard,
  StateOverride,
  UIElement,
  VisualAppearance,
} from '../types/roblox';

export function createId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}_${Date.now().toString(36).slice(-4)}`;
}

export function cloneDeep<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createDefaultAppearance(type: ElementType): VisualAppearance {
  const isText = type === 'text';
  const isLine = type === 'line';
  const isCircleOrEllipse = type === 'circle' || type === 'ellipse';
  const isFrame = type === 'frame';

  return {
    fillColor: isText
      ? 'transparent'
      : isLine
      ? '#E4E4E7'
      : isFrame
      ? '#1E2028'
      : '#3B4252',
    fillOpacity: isText ? 0 : isFrame ? 0.85 : 1,
    gradient: {
      enabled: false,
      angle: 90,
      stops: [
        { offset: 0, color: '#4C566A' },
        { offset: 1, color: '#2E3440' },
      ],
    },
    strokeColor: isFrame ? '#4B5563' : '#94A3B8',
    strokeWidth: isFrame ? 1 : 0,
    strokeOpacity: 1,
    cornerRadius: isCircleOrEllipse ? 9999 : type === 'rectangle' || type === 'square' || isFrame ? 8 : 0,
    shadow: {
      enabled: false,
      x: 0,
      y: 4,
      blur: 12,
      color: '#000000',
      opacity: 0.35,
    },
    opacity: 1,
    text: isText
      ? {
          content: 'Label Text',
          fontFamily: 'Plus Jakarta Sans',
          fontSize: 18,
          fontWeight: 600,
          color: '#F4F4F5',
          align: 'center',
          verticalAlign: 'middle',
        }
      : undefined,
    image:
      type === 'image'
        ? {
            assetId: '',
            scaleType: 'Fit',
            tintColor: '#FFFFFF',
            tintOpacity: 1,
          }
        : undefined,
    extraLayers: [],
  };
}

export function createElement(
  type: ElementType,
  opts: Partial<UIElement> = {}
): UIElement {
  const defaultDims: Record<ElementType, { w: number; h: number }> = {
    rectangle: { w: 180, h: 64 },
    square: { w: 100, h: 100 },
    circle: { w: 96, h: 96 },
    ellipse: { w: 140, h: 90 },
    polygon: { w: 120, h: 120 },
    text: { w: 180, h: 42 },
    image: { w: 128, h: 128 },
    line: { w: 180, h: 4 },
    frame: { w: 320, h: 220 },
    group: { w: 200, h: 200 },
  };

  const dims = defaultDims[type] || { w: 140, h: 64 };
  const labelMap: Record<ElementType, string> = {
    rectangle: 'Rectangle',
    square: 'Square',
    circle: 'Circle',
    ellipse: 'Ellipse',
    polygon: 'Vector Shape',
    text: 'TextLabel',
    image: 'ImageLabel',
    line: 'Line',
    frame: 'Frame',
    group: 'Group',
  };

  return {
    id: opts.id ?? createId('el'),
    name: opts.name ?? labelMap[type],
    type,
    parentId: opts.parentId ?? null,
    visible: opts.visible ?? true,
    locked: opts.locked ?? false,
    zIndex: opts.zIndex ?? 1,
    x: opts.x ?? 100,
    y: opts.y ?? 100,
    width: opts.width ?? dims.w,
    height: opts.height ?? dims.h,
    rotation: opts.rotation ?? 0,
    anchorPoint: opts.anchorPoint ?? { x: 0, y: 0 },
    useScalePosition: opts.useScalePosition ?? true,
    useScaleSize: opts.useScaleSize ?? false,
    vectorPoints:
      opts.vectorPoints ??
      (type === 'polygon'
        ? [
            { x: 0.5, y: 0.05 },
            { x: 0.95, y: 0.38 },
            { x: 0.78, y: 0.95 },
            { x: 0.22, y: 0.95 },
            { x: 0.05, y: 0.38 },
          ]
        : undefined),
    appearance: opts.appearance ?? createDefaultAppearance(type),
    interactive: opts.interactive ?? {
      isInteractive: false,
      componentType: 'button',
      defaultState: 'idle',
      states: {},
      behavior: {
        checked: false,
        min: 0,
        max: 100,
        value: 50,
        step: 1,
        orientation: 'horizontal',
        groupName: 'default_group',
        options: ['Option A', 'Option B', 'Option C'],
        selectedIndex: 0,
      },
    },
  };
}

export function createStateOverrideFromAppearance(
  appearance: VisualAppearance,
  durationMs = 140
): StateOverride {
  return {
    appearance: cloneDeep(appearance),
    transformDelta: { dx: 0, dy: 0, dw: 0, dh: 0, dRotation: 0 },
    transition: { durationMs, easing: 'easeOut' },
  };
}

/**
 * Resolves the effective appearance and transform for a given element + state.
 * Preserves independently customized state designs without mutating the base element.
 */
export function resolveElementState(
  element: UIElement,
  stateName: ComponentStateName
): {
  appearance: VisualAppearance;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  transition: { durationMs: number; easing: string };
} {
  if (!element.interactive.isInteractive) {
    return {
      appearance: element.appearance,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      transition: { durationMs: 0, easing: 'linear' },
    };
  }

  const override = element.interactive.states[stateName];
  if (!override) {
    // Fall back to 'idle' override if defined, otherwise base appearance
    const idleOverride = element.interactive.states.idle;
    const baseApp = idleOverride ? idleOverride.appearance : element.appearance;
    return {
      appearance: baseApp,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      transition: { durationMs: 140, easing: 'easeOut' },
    };
  }

  return {
    appearance: override.appearance,
    x: element.x + override.transformDelta.dx,
    y: element.y + override.transformDelta.dy,
    width: Math.max(4, element.width + override.transformDelta.dw),
    height: Math.max(4, element.height + override.transformDelta.dh),
    rotation: element.rotation + override.transformDelta.dRotation,
    transition: override.transition,
  };
}

/**
 * Duplicates a source visual state into a target state for an interactive component.
 */
export function duplicateComponentState(
  element: UIElement,
  fromState: ComponentStateName,
  toState: ComponentStateName
): UIElement {
  const sourceOverride =
    element.interactive.states[fromState] ??
    createStateOverrideFromAppearance(element.appearance);

  const cloned = cloneDeep(sourceOverride);
  return {
    ...element,
    interactive: {
      ...element.interactive,
      states: {
        ...element.interactive.states,
        [toState]: cloned,
      },
    },
  };
}

/**
 * Enables interactive mode on any drawn element, initializing its Idle state
 * directly from its current drawn appearance (draw first, assign functionality later).
 */
export function enableInteractiveComponent(
  element: UIElement,
  componentType: InteractiveComponentType = 'button'
): UIElement {
  const existingStates = element.interactive.states ?? {};
  const idleState =
    existingStates.idle ?? createStateOverrideFromAppearance(element.appearance);

  return {
    ...element,
    interactive: {
      ...element.interactive,
      isInteractive: true,
      componentType,
      defaultState: 'idle',
      states: {
        ...existingStates,
        idle: idleState,
      },
    },
  };
}

export interface UDim2Result {
  positionUDim2: string;
  sizeUDim2: string;
  anchorString: string;
}

/**
 * Translates canvas coordinates and dimensions into Roblox UDim2 values
 * taking AnchorPoint and artboard/parent dimensions into account.
 */
export function computeRobloxUDim2(
  element: UIElement,
  parentWidth: number,
  parentHeight: number
): UDim2Result {
  const safeW = Math.max(1, parentWidth);
  const safeH = Math.max(1, parentHeight);
  const ax = element.anchorPoint.x;
  const ay = element.anchorPoint.y;

  // Top-left x,y converted to anchored position
  const anchoredX = element.x + element.width * ax;
  const anchoredY = element.y + element.height * ay;

  const posScaleX = element.useScalePosition ? +(anchoredX / safeW).toFixed(4) : 0;
  const posOffsetX = element.useScalePosition ? 0 : Math.round(anchoredX);
  const posScaleY = element.useScalePosition ? +(anchoredY / safeH).toFixed(4) : 0;
  const posOffsetY = element.useScalePosition ? 0 : Math.round(anchoredY);

  const sizeScaleX = element.useScaleSize ? +(element.width / safeW).toFixed(4) : 0;
  const sizeOffsetX = element.useScaleSize ? 0 : Math.round(element.width);
  const sizeScaleY = element.useScaleSize ? +(element.height / safeH).toFixed(4) : 0;
  const sizeOffsetY = element.useScaleSize ? 0 : Math.round(element.height);

  return {
    positionUDim2: `UDim2.new(${posScaleX}, ${posOffsetX}, ${posScaleY}, ${posOffsetY})`,
    sizeUDim2: `UDim2.new(${sizeScaleX}, ${sizeOffsetX}, ${sizeScaleY}, ${sizeOffsetY})`,
    anchorString: `Vector2.new(${ax}, ${ay})`,
  };
}

export function snapValue(value: number, gridSize: number, enabled: boolean): number {
  if (!enabled || gridSize <= 1) return Math.round(value);
  return Math.round(value / gridSize) * gridSize;
}

export interface AlignmentGuide {
  axis: 'x' | 'y';
  position: number;
}

/**
 * Finds alignment snap guides against artboard center and sibling edges/centers.
 */
export function computeAlignmentSnap(
  movingBox: { x: number; y: number; width: number; height: number },
  siblings: UIElement[],
  artboardWidth: number,
  artboardHeight: number,
  threshold = 6
): { x: number; y: number; guides: AlignmentGuide[] } {
  const guides: AlignmentGuide[] = [];
  let nextX = movingBox.x;
  let nextY = movingBox.y;

  const targetXs = [0, artboardWidth / 2, artboardWidth];
  const targetYs = [0, artboardHeight / 2, artboardHeight];

  for (const sib of siblings) {
    targetXs.push(sib.x, sib.x + sib.width / 2, sib.x + sib.width);
    targetYs.push(sib.y, sib.y + sib.height / 2, sib.y + sib.height);
  }

  const movingXEdges = [
    { offset: 0, val: movingBox.x },
    { offset: movingBox.width / 2, val: movingBox.x + movingBox.width / 2 },
    { offset: movingBox.width, val: movingBox.x + movingBox.width },
  ];

  let bestDx = threshold + 1;
  let snappedGuideX: number | null = null;
  for (const edge of movingXEdges) {
    for (const tx of targetXs) {
      const diff = Math.abs(edge.val - tx);
      if (diff < bestDx) {
        bestDx = diff;
        nextX = tx - edge.offset;
        snappedGuideX = tx;
      }
    }
  }
  if (snappedGuideX !== null && bestDx <= threshold) {
    guides.push({ axis: 'x', position: snappedGuideX });
  } else {
    nextX = movingBox.x;
  }

  const movingYEdges = [
    { offset: 0, val: movingBox.y },
    { offset: movingBox.height / 2, val: movingBox.y + movingBox.height / 2 },
    { offset: movingBox.height, val: movingBox.y + movingBox.height },
  ];

  let bestDy = threshold + 1;
  let snappedGuideY: number | null = null;
  for (const edge of movingYEdges) {
    for (const ty of targetYs) {
      const diff = Math.abs(edge.val - ty);
      if (diff < bestDy) {
        bestDy = diff;
        nextY = ty - edge.offset;
        snappedGuideY = ty;
      }
    }
  }
  if (snappedGuideY !== null && bestDy <= threshold) {
    guides.push({ axis: 'y', position: snappedGuideY });
  } else {
    nextY = movingBox.y;
  }

  return { x: Math.round(nextX), y: Math.round(nextY), guides };
}

export function reorderElementZIndex(
  elements: UIElement[],
  elementId: string,
  direction: 'up' | 'down' | 'front' | 'back'
): UIElement[] {
  const sorted = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  const idx = sorted.findIndex((e) => e.id === elementId);
  if (idx === -1) return elements;

  const [item] = sorted.splice(idx, 1);
  if (direction === 'up') {
    sorted.splice(Math.min(sorted.length, idx + 1), 0, item);
  } else if (direction === 'down') {
    sorted.splice(Math.max(0, idx - 1), 0, item);
  } else if (direction === 'front') {
    sorted.push(item);
  } else {
    sorted.unshift(item);
  }

  return sorted.map((el, i) => ({ ...el, zIndex: i + 1 }));
}

export function collectDescendants(elements: UIElement[], rootId: string): UIElement[] {
  const children = elements.filter((e) => e.parentId === rootId);
  const result: UIElement[] = [];
  for (const child of children) {
    result.push(child, ...collectDescendants(elements, child.id));
  }
  return result;
}

export function getAbsolutePosition(
  element: UIElement,
  elements: UIElement[]
): { x: number; y: number } {
  let x = element.x;
  let y = element.y;
  let currentParentId = element.parentId;
  const visited = new Set<string>([element.id]);
  while (currentParentId && !visited.has(currentParentId)) {
    visited.add(currentParentId);
    const parent = elements.find((e) => e.id === currentParentId);
    if (!parent) break;
    x += parent.x;
    y += parent.y;
    currentParentId = parent.parentId;
  }
  return { x, y };
}

export function getScreenById(screens: ScreenArtboard[], id: string): ScreenArtboard | undefined {
  return screens.find((s) => s.id === id) ?? screens[0];
}
