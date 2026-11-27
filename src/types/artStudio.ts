export type WorkspaceAppMode = 'ui_workshop' | 'art_studio';

export type BrushCategory =
  | 'pencil'
  | 'mechanical_pencil'
  | 'ink_pen'
  | 'technical_pen'
  | 'marker'
  | 'airbrush'
  | 'soft_brush'
  | 'hard_brush'
  | 'watercolor'
  | 'gouache'
  | 'oil'
  | 'charcoal'
  | 'pastel'
  | 'crayon'
  | 'chalk'
  | 'texture'
  | 'particle'
  | 'decorative_stamp'
  | 'custom';

export type BrushTipShape = 'round' | 'oval' | 'square' | 'calligraphy' | 'bristle' | 'star' | 'custom_image';
export type TextureBlendMode = 'multiply' | 'overlay' | 'subtract' | 'screen';

export interface BrushConfig {
  id: string;
  name: string;
  category: BrushCategory;
  folder: string;
  // Basic brush settings
  size: number; // px (1..300)
  opacity: number; // 0..1
  flow: number; // 0.05..1
  spacing: number; // 0.02..2.0 (fraction of diameter)
  hardness: number; // 0..1
  smoothing: number; // 0..1
  stabilization: number; // 0..1 (lazy-mouse pull)
  // Stroke dynamics
  pressureSize: number; // 0..1
  pressureOpacity: number; // 0..1
  tiltResponse: number; // 0..1
  rotation: number; // degrees
  rotationFollowsStroke: boolean;
  scatter: number; // 0..2
  randomVariation: number; // 0..1
  taperStart: number; // 0..1
  taperEnd: number; // 0..1
  velocityResponse: number; // -1..1 (negative thins at high speed, positive thickens)
  // Construction
  tipShape: BrushTipShape;
  tipImageDataUrl?: string;
  textureId: 'none' | 'paper_grain' | 'canvas_weave' | 'charcoal_tooth' | 'halftone' | 'custom';
  textureImageDataUrl?: string;
  textureScale: number;
  textureBlend: TextureBlendMode;
  grainDepth: number; // 0..1
  dualBrushEnabled: boolean;
  dualBrushSizeRatio: number; // 0.2..2.0
  dualBrushScatter: number;
  colorDynamicsHue: number; // 0..1
  colorDynamicsSat: number; // 0..1
  colorDynamicsBri: number; // 0..1
  isEraserCapable?: boolean;
}

export interface BrushPack {
  formatVersion: '1.0';
  id: string;
  name: string;
  folder: string;
  author: string;
  brushes: BrushConfig[];
  createdAt: string;
}

export type ArtToolType =
  | 'brush'
  | 'eraser'
  | 'smudge'
  | 'blur'
  | 'eyedropper'
  | 'bucket'
  | 'lasso'
  | 'rect_select'
  | 'move'
  | 'transform'
  | 'line'
  | 'rect_shape'
  | 'circle_shape'
  | 'pan';

export type SymmetryMode = 'none' | 'vertical' | 'horizontal' | 'quadrant' | 'radial';

export interface ArtLayer {
  id: string;
  name: string;
  kind: 'raster' | 'group' | 'mask';
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..1
  blendMode: GlobalCompositeOperation;
  alphaLock: boolean;
  clippingMask: boolean;
  maskEnabled: boolean;
  previewDataUrl?: string;
  // Optional pixel persistence for recovery/IDB
  rasterDataUrl?: string;
  maskDataUrl?: string;
}

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
}

export interface DrawingGuidesConfig {
  symmetry: SymmetryMode;
  radialSegments: number;
  gridVisible: boolean;
  gridSize: number;
  perspectiveVisible: boolean;
  vanishingPoints: Array<{ x: number; y: number }>;
}

export interface ReferenceImageConfig {
  visible: boolean;
  dataUrl: string;
  opacity: number;
  x: number;
  y: number;
  scale: number;
}

export interface GestureConfig {
  oneFingerMode: 'draw' | 'pan';
  twoFingerTapUndo: boolean;
  threeFingerTapRedo: boolean;
  pinchToZoom: boolean;
  twoFingerRotate: boolean;
  stylusOnlyDraw: boolean;
}

export interface ArtDocument {
  id: string;
  version: string;
  title: string;
  width: number;
  height: number;
  dpi: number;
  backgroundColor: string;
  activeLayerId: string;
  layers: ArtLayer[];
  guides: DrawingGuidesConfig;
  referenceImage?: ReferenceImageConfig;
  updatedAt: string;
}

export interface StrokeInputPoint {
  x: number;
  y: number;
  pressure: number;
  tiltX: number;
  tiltY: number;
  timestamp: number;
}

export interface StampPlacement {
  x: number;
  y: number;
  radius: number;
  opacity: number;
  angleRad: number;
  hueShift: number;
  satShift: number;
  briShift: number;
}

export interface BrushImportReport {
  sourceFormat: 'brushpack' | 'ibispaint_qr' | 'photoshop_abr' | 'procreate_brush' | 'csp_sut';
  success: boolean;
  importedBrushes: BrushConfig[];
  warnings: string[];
  unsupportedFeatures: string[];
  rawMetadata?: Record<string, unknown>;
}

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  targetTourId?: string;
  actionHint: string;
}

export interface TutorialLesson {
  id: string;
  app: WorkspaceAppMode;
  order: number;
  title: string;
  difficulty: 'Beginner' | 'Advanced';
  summary: string;
  steps: TutorialStep[];
}
