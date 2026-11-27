import React from 'react';
import { Plus } from 'lucide-react';
import type { ColorPalette } from '../../types/artStudio';
import { hexToRgb, hsvToRgb, rgbToHex, rgbToHsv } from '../../engine/strokeMath';

interface ColorWheelPickerProps {
  color: string;
  onChangeColor: (hex: string) => void;
  palettes: ColorPalette[];
  onAddSwatchToPalette: (paletteId: string, hex: string) => void;
  onCreatePalette: (name: string) => void;
}

export const ColorWheelPicker: React.FC<ColorWheelPickerProps> = ({
  color,
  onChangeColor,
  palettes,
  onAddSwatchToPalette,
  onCreatePalette,
}) => {
  const wheelRef = React.useRef<HTMLCanvasElement>(null);
  const [newPaletteName, setNewPaletteName] = React.useState('');
  const [activePaletteId, setActivePaletteId] = React.useState(palettes[0]?.id ?? '');

  const rgb = hexToRgb(color);
  const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b);
  const [hue, setHue] = React.useState(hsv.h);
  const [sat, setSat] = React.useState(hsv.s);
  const [val, setVal] = React.useState(hsv.v);

  React.useEffect(() => {
    const nextRgb = hexToRgb(color);
    const nextHsv = rgbToHsv(nextRgb.r, nextRgb.g, nextRgb.b);
    if (nextHsv.s > 0.02) setHue(nextHsv.h);
    setSat(nextHsv.s);
    setVal(nextHsv.v);
  }, [color]);

  // Draw outer Hue ring + inner SV box
  React.useEffect(() => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 4;
    const innerR = outerR - 18;

    ctx.clearRect(0, 0, size, size);

    // Hue Ring
    for (let deg = 0; deg < 360; deg += 1) {
      const start = ((deg - 1) * Math.PI) / 180;
      const end = ((deg + 1.5) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(cx, cy, (outerR + innerR) / 2, start, end);
      ctx.lineWidth = outerR - innerR;
      ctx.strokeStyle = `hsl(${deg}, 100%, 50%)`;
      ctx.stroke();
    }

    // SV Box inside ring
    const boxHalf = Math.floor((innerR - 10) / Math.SQRT2);
    const bx = cx - boxHalf;
    const by = cy - boxHalf;
    const bw = boxHalf * 2;

    const pureHue = hsvToRgb(hue, 1, 1);
    ctx.fillStyle = rgbToHex(pureHue.r, pureHue.g, pureHue.b);
    ctx.fillRect(bx, by, bw, bw);

    const whiteGrad = ctx.createLinearGradient(bx, by, bx + bw, by);
    whiteGrad.addColorStop(0, 'rgba(255,255,255,1)');
    whiteGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = whiteGrad;
    ctx.fillRect(bx, by, bw, bw);

    const blackGrad = ctx.createLinearGradient(bx, by, bx, by + bw);
    blackGrad.addColorStop(0, 'rgba(0,0,0,0)');
    blackGrad.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = blackGrad;
    ctx.fillRect(bx, by, bw, bw);

    // Hue ring marker
    const hRad = (hue * Math.PI) / 180;
    const hr = (outerR + innerR) / 2;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(hRad) * hr, cy + Math.sin(hRad) * hr, 6, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // SV marker
    const sx = bx + sat * bw;
    const sy = by + (1 - val) * bw;
    ctx.beginPath();
    ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = val > 0.55 ? '#111827' : '#FFFFFF';
    ctx.stroke();
  }, [hue, sat, val]);

  const handleWheelPointer = (e: React.PointerEvent<HTMLCanvasElement>, dragModeRef: React.MutableRefObject<'ring' | 'box' | null>, isStart: boolean) => {
    const canvas = wheelRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const px = (e.clientX - rect.left) * scaleX;
    const py = (e.clientY - rect.top) * scaleY;

    const size = canvas.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 4;
    const innerR = outerR - 18;
    const boxHalf = Math.floor((innerR - 10) / Math.SQRT2);
    const bx = cx - boxHalf;
    const by = cy - boxHalf;
    const bw = boxHalf * 2;

    const dist = Math.hypot(px - cx, py - cy);
    if (isStart) {
      if (dist >= innerR - 4 && dist <= outerR + 6) dragModeRef.current = 'ring';
      else dragModeRef.current = 'box';
    }

    if (dragModeRef.current === 'ring') {
      let deg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      setHue(deg);
      const next = hsvToRgb(deg, sat, val);
      onChangeColor(rgbToHex(next.r, next.g, next.b));
    } else if (dragModeRef.current === 'box') {
      const nextS = Math.max(0, Math.min(1, (px - bx) / bw));
      const nextV = Math.max(0, Math.min(1, 1 - (py - by) / bw));
      setSat(nextS);
      setVal(nextV);
      const next = hsvToRgb(hue, nextS, nextV);
      onChangeColor(rgbToHex(next.r, next.g, next.b));
    }
  };

  const dragModeRef = React.useRef<'ring' | 'box' | null>(null);

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-col items-center">
        <canvas
          ref={wheelRef}
          width={200}
          height={200}
          aria-label="HSV Color Wheel"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleWheelPointer(e, dragModeRef, true);
          }}
          onPointerMove={(e) => {
            if (dragModeRef.current) handleWheelPointer(e, dragModeRef, false);
          }}
          onPointerUp={() => {
            dragModeRef.current = null;
          }}
          className="w-44 h-44 touch-none cursor-crosshair select-none"
        />
      </div>

      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded border border-zinc-700 shrink-0"
          style={{ backgroundColor: color }}
        />
        <input
          type="text"
          aria-label="Hex color value"
          value={color.toUpperCase()}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) onChangeColor(v);
          }}
          className="flex-1 px-2 py-1.5 rounded bg-zinc-900 border border-zinc-700 font-mono text-zinc-100"
        />
        <input
          type="color"
          aria-label="Native color picker"
          value={color}
          onChange={(e) => onChangeColor(e.target.value)}
          className="w-8 h-8 rounded bg-transparent cursor-pointer"
        />
      </div>

      {/* Shared Ecosystem Palettes */}
      <div className="space-y-2 pt-2 border-t border-zinc-800">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-300">Shared Palettes</span>
          <button
            type="button"
            onClick={() => {
              const targetId = activePaletteId || palettes[0]?.id;
              if (targetId) onAddSwatchToPalette(targetId, color.toUpperCase());
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-100"
          >
            <Plus className="w-3 h-3" /> Add Swatch
          </button>
        </div>

        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {palettes.map((pal) => (
            <div
              key={pal.id}
              className={`p-2 rounded border ${
                activePaletteId === pal.id
                  ? 'border-blue-500/60 bg-zinc-900/90'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <button
                type="button"
                onClick={() => setActivePaletteId(pal.id)}
                className="w-full text-left text-[11px] font-medium text-zinc-300 mb-1.5 truncate"
              >
                {pal.name}
              </button>
              <div className="grid grid-cols-8 gap-1">
                {pal.colors.map((swatch, idx) => (
                  <button
                    key={`${pal.id}_${idx}_${swatch}`}
                    type="button"
                    aria-label={`Select swatch ${swatch}`}
                    onClick={() => onChangeColor(swatch)}
                    className={`h-5 rounded border ${
                      color.toUpperCase() === swatch.toUpperCase()
                        ? 'border-white ring-1 ring-blue-400'
                        : 'border-zinc-700'
                    }`}
                    style={{ backgroundColor: swatch }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="New palette name..."
            value={newPaletteName}
            onChange={(e) => setNewPaletteName(e.target.value)}
            className="flex-1 px-2 py-1 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 text-[11px]"
          />
          <button
            type="button"
            onClick={() => {
              if (!newPaletteName.trim()) return;
              onCreatePalette(newPaletteName.trim());
              setNewPaletteName('');
            }}
            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[11px]"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};
