import React from 'react';
import { AlertTriangle, Check, Copy, Download, Info } from 'lucide-react';
import type { PlaygroundProject } from '../types/roblox';
import { generateRobloxExport } from '../utils/robloxExporter';

interface RobloxExportViewProps {
  project: PlaygroundProject;
}

type ExportTab = 'rbxmx' | 'luau' | 'rojo' | 'assets';

export const RobloxExportView: React.FC<RobloxExportViewProps> = ({ project }) => {
  const [activeTab, setActiveTab] = React.useState<ExportTab>('rbxmx');
  const [copied, setCopied] = React.useState(false);

  const bundle = React.useMemo(() => generateRobloxExport(project), [project]);

  const activeContent =
    activeTab === 'rbxmx'
      ? bundle.rbxmxXml
      : activeTab === 'luau'
      ? bundle.luauRuntime
      : activeTab === 'rojo'
      ? bundle.rojoProjectJson
      : bundle.assetManifestJson;

  const activeFilename =
    activeTab === 'rbxmx'
      ? `${project.name.replace(/\s+/g, '_')}.rbxmx`
      : activeTab === 'luau'
      ? 'UIPlaygroundRuntime.luau'
      : activeTab === 'rojo'
      ? 'default.project.json'
      : 'asset-manifest.json';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([activeContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeFilename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col lg:flex-row bg-[#0E1014] text-xs">
      {/* Main Code & XML Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-800 bg-[#16181D] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-md border border-zinc-800">
            {(
              [
                { id: 'rbxmx', label: 'Roblox Model (.rbxmx)' },
                { id: 'luau', label: 'Luau Runtime (.luau)' },
                { id: 'rojo', label: 'Rojo Project (.json)' },
                { id: 'assets', label: 'Asset & Atlas Map' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded font-medium transition-colors ${
                  activeTab === t.id
                    ? 'bg-blue-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium"
            >
              <Download className="w-3.5 h-3.5" />
              Download {activeFilename}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <pre className="p-4 rounded-md bg-[#121419] border border-zinc-800 font-mono text-[12px] text-zinc-200 leading-relaxed overflow-x-auto select-all">
            {activeContent}
          </pre>
        </div>
      </div>

      {/* Compatibility & Unsupported Feature Report */}
      <aside className="w-full lg:w-80 shrink-0 border-t lg:border-t-0 lg:border-l border-zinc-800 bg-[#16181D] overflow-y-auto p-4 space-y-4">
        <div>
          <h3 className="text-xs font-semibold text-zinc-100">
            Roblox Compatibility Report
          </h3>
          <p className="text-zinc-400 mt-1 leading-relaxed">
            Unsupported effects or pending asset uploads are reported explicitly so nothing is silently dropped.
          </p>
        </div>

        {bundle.issues.length === 0 ? (
          <div className="p-3 rounded bg-emerald-950/30 border border-emerald-800/50 text-emerald-200">
            All screens, instances, UDim2 positions, UICorners, UIStrokes, and interactive scripts translate cleanly to Roblox Studio.
          </div>
        ) : (
          <div className="space-y-2.5">
            {bundle.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`p-3 rounded border space-y-1 ${
                  issue.severity === 'warning'
                    ? 'bg-amber-950/25 border-amber-800/60 text-amber-100'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold">
                  {issue.severity === 'warning' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  ) : (
                    <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  )}
                  <span className="truncate">
                    {issue.screenName} / {issue.elementName}
                  </span>
                </div>
                <p className="text-[11px] opacity-90 leading-relaxed">{issue.message}</p>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
};
