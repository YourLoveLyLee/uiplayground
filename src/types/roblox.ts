export type ToolType =
  | 'select'
  | 'pan'
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'text'
  | 'image'
  | 'line'
  | 'frame';

export type ElementType =
  | 'rectangle'
  | 'square'
  | 'circle'
  | 'ellipse'
  | 'polygon'
  | 'text'
  | 'image'
  | 'line'
  | 'frame'
  | 'group';

export type InteractiveComponentType =
  | 'button'
  | 'toggle'
  | 'slider'
  | 'checkbox'
  | 'radio'
  | 'dropdown'
  | 'tab'
  | 'custom';

export type ComponentStateName =
  | 'idle'
  | 'hover'
  | 'pressed'
  | 'disabled'
  | 'selected'
  | 'focused';

export type EventTriggerType =
  | 'click'
  | 'hoverEnter'
  | 'hoverExit'
  | 'press'
  | 'release'
  | 'valueChanged'
  | 'enabled'
  | 'disabled'
  | 'selected'
  | 'deselected';

export type ActionType =
  | 'show'
  | 'hide'
  | 'enable'
  | 'disable'
  | 'changeText'
  | 'changeImage'
  | 'changeValue'
  | 'playAnimation'
  | 'playSound'
  | 'navigateScreen'
  | 'updateState';

export interface GradientStop {
  offset: number; // 0 to 1
  color: string;
}

export interface GradientConfig {
  enabled: boolean;
  angle: number;
  stops: GradientStop[];
}

export interface ShadowConfig {
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  color: string;
  opacity: number;
}

export interface TextStyleConfig {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
}

export interface ImageAppearanceConfig {
  assetId: string;
  spriteId?: string;
  scaleType: 'Stretch' | 'Fit' | 'Crop' | 'Tile';
  tintColor: string;
  tintOpacity: number;
}

export interface VisualSubLayer {
  id: string;
  name: string;
  kind: 'shape' | 'text' | 'image';
  visible: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  fillColor: string;
  cornerRadius: number;
  strokeColor: string;
  strokeWidth: number;
  text?: string;
  fontSize?: number;
  textColor?: string;
  assetId?: string;
  spriteId?: string;
}

export interface VisualAppearance {
  fillColor: string;
  fillOpacity: number;
  gradient: GradientConfig;
  strokeColor: string;
  strokeWidth: number;
  strokeOpacity: number;
  cornerRadius: number;
  shadow: ShadowConfig;
  opacity: number;
  text?: TextStyleConfig;
  image?: ImageAppearanceConfig;
  extraLayers: VisualSubLayer[];
}

export interface StateTransformDelta {
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  dRotation: number;
}

export type TransitionEasing = 'linear' | 'easeOut' | 'easeInOut' | 'spring' | 'bounce';

export interface StateTransition {
  durationMs: number;
  easing: TransitionEasing;
}

export interface StateOverride {
  appearance: VisualAppearance;
  transformDelta: StateTransformDelta;
  transition: StateTransition;
}

export interface ComponentBehaviorConfig {
  checked?: boolean;
  min?: number;
  max?: number;
  value?: number;
  step?: number;
  orientation?: 'horizontal' | 'vertical';
  groupName?: string;
  options?: string[];
  selectedIndex?: number;
}

export interface InteractiveConfig {
  isInteractive: boolean;
  componentType: InteractiveComponentType;
  defaultState: ComponentStateName;
  states: Partial<Record<ComponentStateName, StateOverride>>;
  behavior: ComponentBehaviorConfig;
}

export interface InteractionAction {
  id: string;
  type: ActionType;
  targetElementId?: string;
  targetScreenId?: string;
  value?: string;
}

export interface InteractionRule {
  id: string;
  sourceElementId: string;
  trigger: EventTriggerType;
  actions: InteractionAction[];
}

export interface UIElement {
  id: string;
  name: string;
  type: ElementType;
  parentId: string | null;
  visible: boolean;
  locked: boolean;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  anchorPoint: { x: number; y: number };
  useScalePosition: boolean;
  useScaleSize: boolean;
  vectorPoints?: Array<{ x: number; y: number }>;
  appearance: VisualAppearance;
  interactive: InteractiveConfig;
}

export interface SpriteRegion {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AssetItem {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string;
  width: number;
  height: number;
  isAtlas: boolean;
  sprites: SpriteRegion[];
  robloxAssetId?: string;
}

export interface ScreenArtboard {
  id: string;
  name: string;
  width: number;
  height: number;
  backgroundColor: string;
  elements: UIElement[];
  rules: InteractionRule[];
}

export interface SavedComponentTemplate {
  id: string;
  name: string;
  description: string;
  category: InteractiveComponentType | 'layout';
  rootElement: UIElement;
  childElements: UIElement[];
  rules: InteractionRule[];
  createdAt: string;
}

export interface PlaygroundProject {
  id: string;
  name: string;
  version: string;
  updatedAt: string;
  activeScreenId: string;
  screens: ScreenArtboard[];
  assets: AssetItem[];
  library: SavedComponentTemplate[];
}

export type EditorWorkspaceTab =
  | 'design'
  | 'preview'
  | 'events'
  | 'assets'
  | 'library'
  | 'export';

export interface PreviewResolutionPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  category: 'desktop' | 'mobile' | 'custom';
}
