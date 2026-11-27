import React from 'react';
import type {
  AssetItem,
  ComponentStateName,
  UIElement,
  VisualAppearance,
  VisualSubLayer,
} from '../types/roblox';
import { resolveElementState } from '../utils/projectLogic';

interface ElementRendererProps {
  element: UIElement;
  allElements: UIElement[];
  assets: AssetItem[];
  stateOverride?: ComponentStateName;
  runtimeValues?: Record<string, {
    visible?: boolean;
    disabled?: boolean;
    text?: string;
    assetId?: string;
    spriteId?: string;
    value?: number;
    checked?: boolean;
    selectedIndex?: number;
    animClass?: string;
  }>;
  interactiveMode?: boolean;
  previewHandlers?: {
    onElementStateEvent?: (el: UIElement, eventType: 'enter' | 'leave' | 'down' | 'up' | 'click') => void;
    onSliderChange?: (el: UIElement, newVal: number) => void;
    onDropdownSelect?: (el: UIElement, idx: number) => void;
    getActiveStateForElement?: (el: UIElement) => ComponentStateName;
  };
  renderChildren?: (parentEl: UIElement) => React.ReactNode;
}

function hexToRgba(hex: string, opacity: number): string {
  if (!hex || hex === 'transparent') return `rgba(0,0,0,0)`;
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (clean.length >= 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }
  return hex;
}

function buildBackgroundStyle(appearance: VisualAppearance): string {
  if (appearance.gradient?.enabled && appearance.gradient.stops.length >= 2) {
    const stops = appearance.gradient.stops
      .map((s) => `${hexToRgba(s.color, appearance.fillOpacity)} ${Math.round(s.offset * 100)}%`)
      .join(', ');
    return `linear-gradient(${appearance.gradient.angle}deg, ${stops})`;
  }
  return hexToRgba(appearance.fillColor, appearance.fillOpacity);
}

function renderSpriteOrImage(
  assetId: string | undefined,
  spriteId: string | undefined,
  assets: AssetItem[],
  scaleType: 'Stretch' | 'Fit' | 'Crop' | 'Tile' = 'Fit',
  width: number,
  height: number
) {
  if (!assetId) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-800/40 border border-dashed border-zinc-600/60 text-[11px] text-zinc-400 select-none">
        No Image
      </div>
    );
  }
  const asset = assets.find((a) => a.id === assetId);
  if (!asset) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-800/40 text-[11px] text-zinc-400">
        Missing Asset
      </div>
    );
  }

  const sprite = spriteId ? asset.sprites.find((s) => s.id === spriteId) : undefined;
  if (sprite && asset.width > 0 && asset.height > 0) {
    const scaleX = width / Math.max(1, sprite.width);
    const scaleY = height / Math.max(1, sprite.height);
    return (
      <div
        className="w-full h-full overflow-hidden pointer-events-none"
        style={{
          backgroundImage: `url(${asset.dataUrl})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: `${asset.width * scaleX}px ${asset.height * scaleY}px`,
          backgroundPosition: `${-sprite.x * scaleX}px ${-sprite.y * scaleY}px`,
        }}
      />
    );
  }

  const objectFit =
    scaleType === 'Stretch' ? 'fill' : scaleType === 'Crop' ? 'cover' : 'contain';

  return (
    <img
      src={asset.dataUrl}
      alt={asset.name}
      draggable={false}
      referrerPolicy="no-referrer"
      className="w-full h-full pointer-events-none select-none"
      style={{ objectFit }}
    />
  );
}

function renderExtraSubLayer(sub: VisualSubLayer, assets: AssetItem[]) {
  if (!sub.visible) return null;
  const style: React.CSSProperties = {
    position: 'absolute',
    left: sub.x,
    top: sub.y,
    width: sub.width,
    height: sub.height,
    transform: `rotate(${sub.rotation}deg)`,
    opacity: sub.opacity,
    backgroundColor:
      sub.kind === 'shape' ? sub.fillColor : 'transparent',
    borderRadius: sub.cornerRadius >= 9999 ? '9999px' : `${sub.cornerRadius}px`,
    border:
      sub.strokeWidth > 0 ? `${sub.strokeWidth}px solid ${sub.strokeColor}` : 'none',
    pointerEvents: 'none',
    overflow: 'hidden',
  };

  return (
    <div key={sub.id} style={style}>
      {sub.kind === 'image' &&
        renderSpriteOrImage(sub.assetId, sub.spriteId, assets, 'Fit', sub.width, sub.height)}
      {sub.kind === 'text' && (
        <div
          className="w-full h-full flex items-center justify-center px-1"
          style={{
            fontSize: `${sub.fontSize ?? 13}px`,
            color: sub.textColor ?? '#FFFFFF',
          }}
        >
          {sub.text ?? ''}
        </div>
      )}
    </div>
  );
}

export const ElementRenderer: React.FC<ElementRendererProps> = ({
  element,
  allElements,
  assets,
  stateOverride,
  runtimeValues,
  interactiveMode = false,
  previewHandlers,
  renderChildren,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const runtime = runtimeValues?.[element.id];
  const isVisible = runtime?.visible !== undefined ? runtime.visible : element.visible;
  if (!isVisible) return null;

  const activeState: ComponentStateName =
    stateOverride ??
    (previewHandlers?.getActiveStateForElement
      ? previewHandlers.getActiveStateForElement(element)
      : element.interactive.defaultState);

  const resolved = resolveElementState(element, activeState);
  const app = resolved.appearance;

  const effectiveText =
    runtime?.text !== undefined ? runtime.text : app.text?.content;
  const effectiveAssetId =
    runtime?.assetId !== undefined ? runtime.assetId : app.image?.assetId;
  const effectiveSpriteId =
    runtime?.spriteId !== undefined ? runtime.spriteId : app.image?.spriteId;

  const boxShadow = app.shadow?.enabled
    ? `${app.shadow.x}px ${app.shadow.y}px ${app.shadow.blur}px ${hexToRgba(
        app.shadow.color,
        app.shadow.opacity
      )}`
    : undefined;

  const radiusCss =
    element.type === 'circle' || element.type === 'ellipse' || app.cornerRadius >= 9999
      ? '9999px'
      : `${app.cornerRadius}px`;

  const transitionCss =
    interactiveMode && resolved.transition.durationMs > 0
      ? `all ${resolved.transition.durationMs}ms ${
          resolved.transition.easing === 'linear'
            ? 'linear'
            : resolved.transition.easing === 'spring'
            ? 'cubic-bezier(0.34, 1.56, 0.64, 1)'
            : resolved.transition.easing === 'bounce'
            ? 'cubic-bezier(0.22, 1.4, 0.36, 1)'
            : 'ease-out'
        }`
      : undefined;

  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: resolved.x,
    top: resolved.y,
    width: resolved.width,
    height: resolved.height,
    transform: `rotate(${resolved.rotation}deg)`,
    transformOrigin: `${element.anchorPoint.x * 100}% ${element.anchorPoint.y * 100}%`,
    opacity: app.opacity,
    zIndex: element.zIndex,
    background: element.type === 'polygon' ? 'transparent' : buildBackgroundStyle(app),
    border:
      element.type !== 'polygon' && app.strokeWidth > 0
        ? `${app.strokeWidth}px solid ${hexToRgba(app.strokeColor, app.strokeOpacity)}`
        : undefined,
    borderRadius: element.type === 'polygon' ? undefined : radiusCss,
    boxShadow: element.type === 'polygon' ? undefined : boxShadow,
    transition: transitionCss,
    cursor:
      interactiveMode && element.interactive.isInteractive
        ? runtime?.disabled
          ? 'not-allowed'
          : 'pointer'
        : undefined,
    userSelect: 'none',
  };

  // Slider interactive math
  const sliderMin = element.interactive.behavior.min ?? 0;
  const sliderMax = element.interactive.behavior.max ?? 100;
  const sliderValue =
    runtime?.value !== undefined
      ? runtime.value
      : element.interactive.behavior.value ?? 50;
  const sliderPct = Math.max(
    0,
    Math.min(100, ((sliderValue - sliderMin) / Math.max(1, sliderMax - sliderMin)) * 100)
  );

  const isChecked =
    runtime?.checked !== undefined
      ? runtime.checked
      : Boolean(element.interactive.behavior.checked);

  const handleSliderPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!interactiveMode || !element.interactive.isInteractive || runtime?.disabled) return;
    if (element.interactive.componentType !== 'slider') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width)));
    const step = element.interactive.behavior.step ?? 1;
    const raw = sliderMin + ratio * (sliderMax - sliderMin);
    const stepped = Math.round(raw / step) * step;
    const clamped = Math.max(sliderMin, Math.min(sliderMax, stepped));
    previewHandlers?.onSliderChange?.(element, clamped);
  };

  const childElements = allElements
    .filter((c) => c.parentId === element.id)
    .sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      style={containerStyle}
      data-element-id={element.id}
      data-element-name={element.name}
      className={runtime?.animClass}
      onMouseEnter={() => {
        if (interactiveMode && element.interactive.isInteractive) {
          previewHandlers?.onElementStateEvent?.(element, 'enter');
        }
      }}
      onMouseLeave={() => {
        if (interactiveMode && element.interactive.isInteractive) {
          previewHandlers?.onElementStateEvent?.(element, 'leave');
        }
      }}
      onPointerDown={(e) => {
        if (interactiveMode && element.interactive.isInteractive) {
          if (element.interactive.componentType === 'slider') {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleSliderPointer(e);
          }
          previewHandlers?.onElementStateEvent?.(element, 'down');
        }
      }}
      onPointerMove={(e) => {
        if (
          interactiveMode &&
          element.interactive.isInteractive &&
          element.interactive.componentType === 'slider' &&
          e.buttons === 1
        ) {
          handleSliderPointer(e);
        }
      }}
      onPointerUp={() => {
        if (interactiveMode && element.interactive.isInteractive) {
          previewHandlers?.onElementStateEvent?.(element, 'up');
        }
      }}
      onClick={(e) => {
        if (!interactiveMode || !element.interactive.isInteractive) return;
        e.stopPropagation();
        if (element.interactive.componentType === 'dropdown') {
          setDropdownOpen((prev) => !prev);
        }
        previewHandlers?.onElementStateEvent?.(element, 'click');
      }}
    >
      {/* Polygon custom vector SVG */}
      {element.type === 'polygon' && element.vectorPoints && (
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible pointer-events-none"
        >
          <polygon
            points={element.vectorPoints
              .map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 100).toFixed(2)}`)
              .join(' ')}
            fill={hexToRgba(app.fillColor, app.fillOpacity)}
            stroke={app.strokeWidth > 0 ? hexToRgba(app.strokeColor, app.strokeOpacity) : 'none'}
            strokeWidth={app.strokeWidth}
          />
        </svg>
      )}

      {/* Image content */}
      {(element.type === 'image' || Boolean(effectiveAssetId)) && (
        <div
          className="absolute inset-0 overflow-hidden pointer-events-none"
          style={{ borderRadius: radiusCss }}
        >
          {renderSpriteOrImage(
            effectiveAssetId,
            effectiveSpriteId,
            assets,
            app.image?.scaleType ?? 'Fit',
            resolved.width,
            resolved.height
          )}
        </div>
      )}

      {/* Extra visual & image sub-layers (unlimited) */}
      {app.extraLayers.map((sub) => renderExtraSubLayer(sub, assets))}

      {/* Component-specific interactive visual controls */}
      {element.interactive.isInteractive &&
        element.interactive.componentType === 'slider' && (
          <div className="absolute inset-0 pointer-events-none flex items-center px-2">
            <div className="relative w-full h-2 rounded-full bg-black/30 overflow-visible">
              <div
                className="h-full rounded-full bg-blue-500"
                style={{ width: `${sliderPct}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white shadow border border-zinc-300"
                style={{ left: `${sliderPct}%` }}
              />
            </div>
          </div>
        )}

      {element.interactive.isInteractive &&
        element.interactive.componentType === 'toggle' && (
          <div className="absolute inset-0 pointer-events-none flex items-center px-1.5">
            <div
              className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isChecked ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
              }`}
            />
          </div>
        )}

      {element.interactive.isInteractive &&
        element.interactive.componentType === 'checkbox' &&
        isChecked && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-white font-bold text-sm">
            ✓
          </div>
        )}

      {element.interactive.isInteractive &&
        element.interactive.componentType === 'radio' &&
        isChecked && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-white" />
          </div>
        )}

      {/* Text content */}
      {app.text && (
        <div
          className="absolute inset-0 px-2 flex pointer-events-none overflow-hidden"
          style={{
            fontFamily: app.text.fontFamily,
            fontSize: `${app.text.fontSize}px`,
            fontWeight: app.text.fontWeight,
            color: app.text.color,
            justifyContent:
              app.text.align === 'left'
                ? 'flex-start'
                : app.text.align === 'right'
                ? 'flex-end'
                : 'center',
            alignItems:
              app.text.verticalAlign === 'top'
                ? 'flex-start'
                : app.text.verticalAlign === 'bottom'
                ? 'flex-end'
                : 'center',
            textAlign: app.text.align,
            lineHeight: 1.25,
          }}
        >
          {element.interactive.isInteractive &&
          element.interactive.componentType === 'dropdown'
            ? `${
                (element.interactive.behavior.options ?? ['Option A'])[
                  runtime?.selectedIndex ?? element.interactive.behavior.selectedIndex ?? 0
                ] ?? effectiveText
              } ▾`
            : effectiveText}
        </div>
      )}

      {/* Dropdown menu in Preview Mode */}
      {interactiveMode &&
        element.interactive.isInteractive &&
        element.interactive.componentType === 'dropdown' &&
        dropdownOpen && (
          <div
            className="absolute left-0 right-0 top-full mt-1 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-50 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {(element.interactive.behavior.options ?? ['Option A', 'Option B']).map(
              (opt, idx) => (
                <button
                  key={`${opt}_${idx}`}
                  type="button"
                  onClick={() => {
                    previewHandlers?.onDropdownSelect?.(element, idx);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-zinc-100 hover:bg-blue-600 transition-colors"
                >
                  {opt}
                </button>
              )
            )}
          </div>
        )}

      {/* Nested child elements */}
      {renderChildren
        ? renderChildren(element)
        : childElements.map((child) => (
            <ElementRenderer
              key={child.id}
              element={child}
              allElements={allElements}
              assets={assets}
              stateOverride={stateOverride}
              runtimeValues={runtimeValues}
              interactiveMode={interactiveMode}
              previewHandlers={previewHandlers}
            />
          ))}
    </div>
  );
};
