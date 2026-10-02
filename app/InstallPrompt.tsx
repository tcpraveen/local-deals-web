'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

const INSTALLED_KEY = 'ldh_pwa_installed';

function detectInstalledState(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as NavigatorWithStandalone).standalone === true ||
    document.referrer.includes('android-app://') ||
    window.localStorage.getItem(INSTALLED_KEY) === 'true'
  );
}

function getInstallInstructions(): string {
  const userAgent = window.navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

  if (isIos) {
    return "Tap Share ⎋ and select 'Add to Home Screen ⊞'.";
  }
  if (/Android/i.test(userAgent)) {
    return "Tap the 3 dots (⋮) in Chrome top right and tap 'Install app' or 'Add to Home screen'.";
  }
  return 'Open your browser menu and choose Install App or Add to Home Screen.';
}

export default function InstallPrompt() {
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [installInstructions, setInstallInstructions] = useState('');

  useEffect(() => {
    if (detectInstalledState()) {
      queueMicrotask(() => setIsInstalled(true));
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      window.localStorage.setItem(INSTALLED_KEY, 'true');
      setIsInstalled(true);
      setShowGuide(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setInstallInstructions(getInstallInstructions());
      setShowGuide(true);
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'dismissed') {
        setInstallInstructions(getInstallInstructions());
        setShowGuide(true);
      }
    } catch (error) {
      console.error('Unable to open the native app installation prompt:', error);
      setInstallInstructions(getInstallInstructions());
      setShowGuide(true);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="shrink-0 flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-bold text-emerald-400 transition hover:bg-emerald-500/20"
      >
        <span>📲</span>
        <span>Install App</span>
      </button>
      {showGuide && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#070b14]/80 p-4 backdrop-blur-sm"
          onClick={() => setShowGuide(false)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            className="relative w-full max-w-sm rounded-2xl border border-blue-500/40 bg-[#0e1628] p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="Close install instructions"
              className="absolute right-3 top-3 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
            <h2 id="install-guide-title" className="pr-8 text-base font-bold text-white">
              Install Local Deals Hub
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              {installInstructions || getInstallInstructions()}
            </p>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-5 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </>
  );
}
