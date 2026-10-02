'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

type PromptView = 'checking' | 'hidden' | 'ios' | 'install';

const DISMISSAL_KEY = 'local-deals-install-prompt-dismissed';

export default function InstallPrompt() {
  const [view, setView] = useState<PromptView>('checking');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    let mounted = true;
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');

    const isStandalone = () =>
      standaloneQuery.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

    const isIosSafari = () => {
      const userAgent = navigator.userAgent;
      const isIosDevice =
        /iPad|iPhone|iPod/i.test(userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      const isSafari =
        /Safari/i.test(userAgent) &&
        !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(userAgent);
      return isIosDevice && isSafari;
    };

    const updateView = () => {
      if (isStandalone() || window.localStorage.getItem(DISMISSAL_KEY) === 'true') {
        setView('hidden');
      } else {
        setView(isIosSafari() ? 'ios' : 'hidden');
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      if (
        !isStandalone() &&
        window.localStorage.getItem(DISMISSAL_KEY) !== 'true'
      ) {
        setView('install');
      }
    };

    const handleDisplayModeChange = () => {
      if (isStandalone()) setView('hidden');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    standaloneQuery.addEventListener('change', handleDisplayModeChange);
    queueMicrotask(() => {
      if (mounted) updateView();
    });

    return () => {
      mounted = false;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      standaloneQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  if (view === 'checking' || view === 'hidden') return null;

  const dismissPermanently = () => {
    window.localStorage.setItem(DISMISSAL_KEY, 'true');
    setView('hidden');
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') {
        window.localStorage.setItem(DISMISSAL_KEY, 'true');
      }
      setView('hidden');
    } catch (error) {
      console.error('Unable to show the app installation prompt:', error);
      setView('hidden');
    } finally {
      setInstalling(false);
    }
  };

  return (
    <aside
      aria-label="Install Local Deals Hub"
      className="fixed bottom-20 left-4 right-4 z-40 rounded-2xl border border-blue-500/40 bg-[#0e1628]/95 p-4 shadow-2xl backdrop-blur sm:bottom-24 sm:left-auto sm:right-6 sm:w-96"
    >
      <button
        type="button"
        onClick={dismissPermanently}
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
      {view === 'ios' ? (
        <div className="pr-6">
          <p className="text-sm font-semibold text-white">Get Local Deals Hub on your Home Screen</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">
            Tap Share ⎋ and select Add to Home Screen ⊞ for instant deals.
          </p>
          <button
            type="button"
            onClick={() => setView('hidden')}
            className="mt-3 text-xs font-medium text-blue-300 transition hover:text-blue-200"
          >
            Later
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 pr-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">Take Local Deals Hub with you</p>
            <p className="mt-1 text-xs text-slate-300">Install for quick access to neighborhood offers.</p>
          </div>
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="shrink-0 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            {installing ? 'Installing…' : 'Install App'}
          </button>
          <button
            type="button"
            onClick={() => setView('hidden')}
            className="shrink-0 text-xs font-medium text-slate-300 transition hover:text-white"
          >
            Later
          </button>
        </div>
      )}
    </aside>
  );
}
