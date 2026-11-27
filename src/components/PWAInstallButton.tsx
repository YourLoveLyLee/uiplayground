import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white whitespace-nowrap shrink-0"
      >
        <Download className="w-3.5 h-3.5" />
        Install App
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800 whitespace-nowrap shrink-0"
        >
          Install on iOS
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-sm rounded-lg bg-[#181A20] border border-zinc-700 p-5 shadow-xl text-xs">
              <h3 className="text-sm font-semibold text-zinc-100">
                Install on iPhone / iPad
              </h3>
              <p className="mt-2 text-zinc-300 leading-relaxed">
                1. Tap the <strong>Share</strong> button in Safari toolbar.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full rounded bg-zinc-800 hover:bg-zinc-700 py-2 font-medium text-zinc-100"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
