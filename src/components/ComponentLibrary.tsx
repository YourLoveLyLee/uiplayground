import React from 'react';
import { Copy, PackagePlus, Trash2 } from 'lucide-react';
import type { SavedComponentTemplate } from '../types/roblox';

interface ComponentLibraryProps {
  library: SavedComponentTemplate[];
  onInsertTemplate: (tpl: SavedComponentTemplate) => void;
  onDuplicateTemplate: (id: string) => void;
  onRenameTemplate: (id: string, name: string) => void;
  onDeleteTemplate: (id: string) => void;
}

export const ComponentLibrary: React.FC<ComponentLibraryProps> = ({
  library,
  onInsertTemplate,
  onDuplicateTemplate,
  onRenameTemplate,
  onDeleteTemplate,
}) => {
  return (
    <div className="flex-1 h-full overflow-y-auto p-6 bg-[#0E1014]">
      <div className="max-w-5xl mx-auto space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">
            Component Library ({library.length})
          </h2>
          <p className="text-xs text-zinc-400">
            Reusable custom components preserve all visual states, sub-layers, and interactive definitions. Save any element from the Design Inspector.
          </p>
        </div>

        {library.length === 0 ? (
          <div className="p-8 rounded-md border border-dashed border-zinc-800 text-center text-xs text-zinc-500">
            No saved components yet. Select any element in Design mode and click "Save to Library".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {library.map((tpl) => {
              const stateCount = Object.keys(tpl.rootElement.interactive.states).length;
              return (
                <div
                  key={tpl.id}
                  className="p-4 rounded-md bg-[#16181D] border border-zinc-800 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        aria-label={`Component name for ${tpl.name}`}
                        value={tpl.name}
                        onChange={(e) => onRenameTemplate(tpl.id, e.target.value)}
                        className="flex-1 min-w-0 text-sm font-semibold text-zinc-100 bg-transparent border-b border-transparent focus:border-blue-500 outline-none"
                      />
                      <span className="text-[11px] font-mono text-zinc-400">
                        {tpl.category}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400">{tpl.description}</p>

                    <div className="text-[11px] font-mono text-zinc-500">
                      {Math.round(tpl.rootElement.width)}×{Math.round(tpl.rootElement.height)} ·{' '}
                      {stateCount} state{stateCount === 1 ? '' : 's'} ·{' '}
                      {tpl.childElements.length} child{tpl.childElements.length === 1 ? '' : 'ren'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      onClick={() => onInsertTemplate(tpl)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium"
                    >
                      <PackagePlus className="w-3.5 h-3.5" />
                      Insert into Screen
                    </button>
                    <button
                      type="button"
                      aria-label={`Duplicate ${tpl.name}`}
                      onClick={() => onDuplicateTemplate(tpl.id)}
                      className="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${tpl.name}`}
                      onClick={() => onDeleteTemplate(tpl.id)}
                      className="p-1.5 rounded bg-zinc-800 hover:bg-red-900/50 text-zinc-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
