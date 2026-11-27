import React from 'react';
import type { User } from 'firebase/auth';
import {
  Cloud,
  CloudUpload,
  FolderDown,
  LogIn,
  LogOut,
  RefreshCw,
  X,
} from 'lucide-react';
import type { CloudArtDocumentRecord, CloudUIProjectSummary } from '../services/firebase';

interface CloudAccountModalProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
  authBusy: boolean;
  syncBusy: boolean;
  cloudError: string | null;
  cloudUIProjects: CloudUIProjectSummary[];
  cloudArtDocs: CloudArtDocumentRecord[];
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onSaveUIProjectCloud: () => Promise<void>;
  onSaveArtDocCloud: () => Promise<void>;
  onLoadUIProjectCloud: (proj: CloudUIProjectSummary) => void;
  onLoadArtDocCloud: (docRec: CloudArtDocumentRecord) => void;
  onSyncAllAssetsCloud: () => Promise<void>;
}

export const CloudAccountModal: React.FC<CloudAccountModalProps> = ({
  open,
  onClose,
  user,
  authBusy,
  syncBusy,
  cloudError,
  cloudUIProjects,
  cloudArtDocs,
  onSignIn,
  onSignOut,
  onSaveUIProjectCloud,
  onSaveArtDocCloud,
  onLoadUIProjectCloud,
  onLoadArtDocCloud,
  onSyncAllAssetsCloud,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Cloud Account and Sync"
    >
      <div className="w-full max-w-2xl max-h-[88vh] flex flex-col rounded-xl border border-zinc-800 bg-[#16181D] text-zinc-100 shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold">Creator Account & Cloud Sync</h2>
          </div>
          <button
            type="button"
            aria-label="Close Cloud Account Modal"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {cloudError && (
            <div className="p-3 rounded-lg border border-red-900/60 bg-red-950/40 text-red-200">
              {cloudError}
            </div>
          )}

          {!user ? (
            <div className="p-6 rounded-xl border border-zinc-800 bg-[#111318] text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center mx-auto text-blue-400">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="space-y-1.5 max-w-md mx-auto">
                <h3 className="text-sm font-semibold text-white">
                  Sign in to sync across UI Workshop & Art Studio
                </h3>
                <p className="text-zinc-400 leading-relaxed">
                  Local autosave and IndexedDB crash recovery always work offline. Connect your Google account to back up UI projects, shared sprite atlases, custom brush packs, and Academy progress to Cloud Firestore.
                </p>
              </div>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void onSignIn()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
              >
                <LogIn className="w-4 h-4" />
                {authBusy ? 'Signing in...' : 'Sign in with Google'}
              </button>
            </div>
          ) : (
            <>
              {/* Account Card */}
              <div className="p-3.5 rounded-lg border border-zinc-800 bg-[#111318] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={user.displayName ?? 'Creator'}
                      className="w-10 h-10 rounded-full border border-zinc-700"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white">
                      {(user.displayName ?? 'C').slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-white">
                      {user.displayName || 'Creator Account'}
                    </div>
                    <div className="text-zinc-400 font-mono text-[11px]">{user.email}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onSignOut()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>

              {/* Quick Cloud Save Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => void onSaveUIProjectCloud()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium"
                >
                  <CloudUpload className="w-4 h-4" />
                  Save UI Project
                </button>
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => void onSaveArtDocCloud()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium"
                >
                  <CloudUpload className="w-4 h-4" />
                  Save Art Metadata
                </button>
                <button
                  type="button"
                  disabled={syncBusy}
                  onClick={() => void onSyncAllAssetsCloud()}
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 font-medium"
                >
                  <RefreshCw className={`w-4 h-4 ${syncBusy ? 'animate-spin' : ''}`} />
                  Sync Assets & Brushes
                </button>
              </div>

              {/* Cloud UI Projects */}
              <div className="space-y-2">
                <h3 className="font-semibold text-zinc-200">
                  Cloud UI Workshop Projects ({cloudUIProjects.length})
                </h3>
                {cloudUIProjects.length === 0 ? (
                  <p className="text-zinc-500">No UI projects saved to cloud yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {cloudUIProjects.map((p) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-lg border border-zinc-800 bg-[#111318] flex items-center justify-between gap-2"
                      >
                        <div>
                          <div className="font-medium text-zinc-100">{p.name}</div>
                          <div className="text-[11px] text-zinc-400">
                            {p.screens?.length ?? 0} screens · {p.library?.length ?? 0} library templates
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onLoadUIProjectCloud(p);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                        >
                          <FolderDown className="w-3.5 h-3.5" />
                          Load
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Cloud Art Documents */}
              <div className="space-y-2">
                <h3 className="font-semibold text-zinc-200">
                  Cloud Art Studio Documents ({cloudArtDocs.length})
                </h3>
                {cloudArtDocs.length === 0 ? (
                  <p className="text-zinc-500">No Art Studio documents saved to cloud yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {cloudArtDocs.map((d) => (
                      <div
                        key={d.id}
                        className="p-2.5 rounded-lg border border-zinc-800 bg-[#111318] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5">
                          {d.previewDataUrl && (
                            <img
                              src={d.previewDataUrl}
                              alt={d.title}
                              className="w-10 h-10 rounded object-cover border border-zinc-700 bg-zinc-950"
                            />
                          )}
                          <div>
                            <div className="font-medium text-zinc-100">{d.title}</div>
                            <div className="text-[11px] text-zinc-400 font-mono">
                              {d.width}×{d.height}px · {d.dpi} DPI · {d.layers?.length ?? 0} layers
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onLoadArtDocCloud(d);
                            onClose();
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                        >
                          <FolderDown className="w-3.5 h-3.5" />
                          Open
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
