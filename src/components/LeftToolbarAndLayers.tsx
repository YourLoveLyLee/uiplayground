import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Eye,
  EyeOff,
  FolderPlus,
  Frame,
  Hand,
  Image as ImageIcon,
  Layers,
  Lock,
  Minus,
  MousePointer2,
  PackagePlus,
  Pentagon,
  RectangleHorizontal,
  Square,
  Trash2,
  Type,
  Unlock,
} from 'lucide-react';
import type { ToolType, UIElement } from '../types/roblox';

interface LeftToolbarAndLayersProps {
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  elements: UIElement[];
  selectedIds: string[];
  onSelectElement: (id: string, additive: boolean) => void;
  onToggleVisible: (id: string) => void;
  onToggleLock: (id: string) => void;
  onReorder: (id: string, direction: 'up' | 'down') => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onGroupSelected: () => void;
  onSaveComponent: (id: string) => void;
}

const TOOLS: Array<{
  id: ToolType;
  label: string;
  shortcut: string;
  icon: React.ReactNode;
}> = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: <MousePointer2 className="w-4 h-4" /> },
  { id: 'pan', label: 'Pan Canvas', shortcut: 'H', icon: <Hand className="w-4 h-4" /> },
  { id: 'frame', label: 'Frame / Container', shortcut: 'F', icon: <Frame className="w-4 h-4" /> },
  {
    id: 'rectangle',
    label: 'Rectangle',
    shortcut: 'R',
    icon: <RectangleHorizontal className="w-4 h-4" />,
  },
  { id: 'square', label: 'Square', shortcut: 'S', icon: <Square className="w-4 h-4" /> },
  { id: 'circle', label: 'Circle', shortcut: 'C', icon: <Circle className="w-4 h-4" /> },
  {
    id: 'ellipse',
    label: 'Ellipse',
    shortcut: 'E',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="12" rx="9" ry="5.5" />
      </svg>
    ),
  },
  { id: 'polygon', label: 'Vector Polygon', shortcut: 'P', icon: <Pentagon className="w-4 h-4" /> },
  { id: 'text', label: 'Text Label', shortcut: 'T', icon: <Type className="w-4 h-4" /> },
  { id: 'image', label: 'Image / Sprite', shortcut: 'I', icon: <ImageIcon className="w-4 h-4" /> },
  { id: 'line', label: 'Line', shortcut: 'L', icon: <Minus className="w-4 h-4" /> },
];

export const LeftToolbarAndLayers: React.FC<LeftToolbarAndLayersProps> = ({
  activeTool,
  onSelectTool,
  elements,
  selectedIds,
  onSelectElement,
  onToggleVisible,
  onToggleLock,
  onReorder,
  onDuplicateSelected,
  onDeleteSelected,
  onGroupSelected,
  onSaveComponent,
}) => {
  const [layersOpen, setLayersOpen] = React.useState(true);

  const renderTree = (parentId: string | null, depth: number): React.ReactNode => {
    const items = elements
      .filter((el) => el.parentId === parentId)
      .sort((a, b) => b.zIndex - a.zIndex);

    return items.map((el) => {
      const isSelected = selectedIds.includes(el.id);
      return (
        <div key={el.id}>
          <div
            className={`group flex items-center gap-1.5 px-2 py-1.5 text-xs border-b border-zinc-800/50 transition-colors ${
              isSelected
                ? 'bg-blue-600/20 text-blue-200'
                : 'text-zinc-300 hover:bg-zinc-800/70'
            }`}
            style={{ paddingLeft: `${8 + depth * 12}px` }}
          >
            <button
              type="button"
              onClick={(e) => onSelectElement(el.id, e.shiftKey)}
              className="flex-1 min-w-0 flex items-center gap-1.5 text-left truncate"
            >
              <span className="text-[10px] font-mono text-zinc-500 uppercase shrink-0">
                {el.interactive.isInteractive ? el.interactive.componentType.slice(0, 3) : el.type.slice(0, 3)}
              </span>
              <span className="truncate font-medium">{el.name}</span>
            </button>

            <div className="flex items-center gap-0.5 shrink-0">
              <div className={`flex items-center gap-0.5 ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                <button
                  type="button"
                  aria-label={`Move ${el.name} up`}
                  title="Move layer up"
                  onClick={() => onReorder(el.id, 'up')}
                  className="p-0.5 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-100"
                >
                  <ArrowUp className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${el.name} down`}
                  title="Move layer down"
                  onClick={() => onReorder(el.id, 'down')}
                  className="p-0.5 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-100"
                >
                  <ArrowDown className="w-3 h-3" />
                </button>
              </div>
              <button
                type="button"
                aria-label={el.visible ? `Hide ${el.name}` : `Show ${el.name}`}
                onClick={() => onToggleVisible(el.id)}
                className="p-0.5 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-100"
              >
                {el.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-zinc-600" />}
              </button>
              <button
                type="button"
                aria-label={el.locked ? `Unlock ${el.name}` : `Lock ${el.name}`}
                onClick={() => onToggleLock(el.id)}
                className="p-0.5 rounded hover:bg-zinc-700/70 text-zinc-400 hover:text-zinc-100"
              >
                {el.locked ? <Lock className="w-3 h-3 text-amber-400" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>
          </div>
          {renderTree(el.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <aside className="flex h-full shrink-0 border-r border-zinc-800 bg-[#16181D]">
      {/* Creation Tool Rail */}
      <div className="w-12 flex flex-col items-center py-2 gap-1 border-r border-zinc-800 bg-[#121418]">
        {TOOLS.map((tool) => {
          const active = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              aria-label={`${tool.label} (${tool.shortcut})`}
              title={`${tool.label} (${tool.shortcut})`}
              onClick={() => onSelectTool(tool.id)}
              className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              {tool.icon}
            </button>
          );
        })}

        <div className="mt-auto pt-2 border-t border-zinc-800 w-full flex flex-col items-center">
          <button
            type="button"
            aria-label={layersOpen ? 'Collapse layers panel' : 'Expand layers panel'}
            title="Toggle Layers"
            onClick={() => setLayersOpen((p) => !p)}
            className={`w-9 h-9 rounded-md flex items-center justify-center transition-colors ${
              layersOpen
                ? 'bg-zinc-800 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layer Hierarchy Panel */}
      {layersOpen && (
        <div className="w-60 flex flex-col h-full">
          <div className="px-3 py-2.5 border-b border-zinc-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-200 tracking-tight">
              Layers ({elements.length})
            </span>
            <div className="flex items-center gap-1">
              {selectedIds.length >= 2 && (
                <button
                  type="button"
                  aria-label="Group selected layers"
                  title="Group Selected"
                  onClick={onGroupSelected}
                  className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              )}
              {selectedIds.length === 1 && (
                <button
                  type="button"
                  aria-label="Save selected as reusable component"
                  title="Save to Component Library"
                  onClick={() => onSaveComponent(selectedIds[0])}
                  className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                </button>
              )}
              {selectedIds.length > 0 && (
                <>
                  <button
                    type="button"
                    aria-label="Duplicate selected"
                    title="Duplicate (Ctrl+D)"
                    onClick={onDuplicateSelected}
                    className="p-1 rounded text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Delete selected"
                    title="Delete"
                    onClick={onDeleteSelected}
                    className="p-1 rounded text-zinc-400 hover:bg-red-900/40 hover:text-red-300"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {elements.length === 0 ? (
              <div className="p-4 text-xs text-zinc-500 leading-relaxed">
                Select a shape, text, image, or frame tool from the left rail and drag on the artboard to draw.
              </div>
            ) : (
              renderTree(null, 0)
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
