'use client';

import { useCallback, useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
}

type InstallPlatform = 'ios' | 'android' | 'other';

const DISMISSAL_KEY = 'ldh_pwa_dismissed';
const MANUAL_INSTALL_EVENT = 'ldh:show-install-guide';

function isStandaloneMode(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function getInstallPlatform(): InstallPlatform {
  const userAgent = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIos) return 'ios';
  if (/Android/i.test(userAgent)) return 'android';
  return 'other';
}

function isMobileDevice(): boolean {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function requestInstallGuide(): void {
  window.dispatchEvent(new Event(MANUAL_INSTALL_EVENT));
}

export default function InstallPrompt() {
  const [isVisible, setIsVisible] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('other');
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  const launchNativePrompt = useCallback(async (promptEvent: BeforeInstallPromptEvent) => {
    setInstalling(true);
    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'accepted') setIsVisible(false);
    } catch (error) {
      console.error('Unable to show the app installation prompt:', error);
      setIsVisible(true);
    } finally {
      setInstalling(false);
    }
  }, []);

  useEffect(() => {
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

    const updateStandalone = () => {
      const standalone = isStandaloneMode();
      setIsStandalone(standalone);
      if (standalone) setIsVisible(false);
      return standalone;
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const handleManualInstallRequest = () => {
      if (updateStandalone()) return;
      if (deferredPrompt) {
        void launchNativePrompt(deferredPrompt);
      } else {
        setIsVisible(true);
      }
    };

    const handleAppInstalled = () => {
      setIsVisible(false);
      setDeferredPrompt(null);
      setIsStandalone(true);
      window.localStorage.setItem(DISMISSAL_KEY, 'true');
    };

    const handleDisplayModeChange = () => {
      updateStandalone();
    };

    const standalone = isStandaloneMode();
    const detectedPlatform = getInstallPlatform();
    const dismissed = window.localStorage.getItem(DISMISSAL_KEY) === 'true';
    queueMicrotask(() => {
      setIsStandalone(standalone);
      setPlatform(detectedPlatform);
      if (!standalone && !dismissed && isMobileDevice()) {
        fallbackTimer = setTimeout(() => setIsVisible(true), 2500);
      }
    });

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener(MANUAL_INSTALL_EVENT, handleManualInstallRequest);
    window.addEventListener('appinstalled', handleAppInstalled);
    standaloneQuery.addEventListener('change', handleDisplayModeChange);

    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener(MANUAL_INSTALL_EVENT, handleManualInstallRequest);
      window.removeEventListener('appinstalled', handleAppInstalled);
      standaloneQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, [deferredPrompt, launchNativePrompt]);

  const dismissPermanently = () => {
    window.localStorage.setItem(DISMISSAL_KEY, 'true');
    setIsVisible(false);
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await launchNativePrompt(deferredPrompt);
    } else {
      setIsVisible(true);
    }
  };

  if (isStandalone || !isVisible) return null;

  const instructions =
    platform === 'ios'
      ? "Tap Share ⎋ and select 'Add to Home Screen ⊞'."
      : platform === 'android'
        ? "Tap the 3 dots (⋮) in Chrome top right and tap 'Install app' or 'Add to Home screen'."
        : 'Use your browser menu to install or add Local Deals Hub to your home screen.';

  return (
    <aside
      aria-label="Install Local Deals Hub"
      className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl border border-blue-500/40 bg-[#0e1628]/95 p-4 shadow-2xl backdrop-blur sm:bottom-24 sm:left-auto sm:right-6 sm:w-96"
    >
      <button
        type="button"
        onClick={dismissPermanently}
        aria-label="Dismiss install prompt"
        className="absolute right-3 top-3 rounded-md p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
      <div className="pr-6">
        <p className="text-sm font-semibold text-white">Install Local Deals Hub</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-300">{instructions}</p>
        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstallClick}
            disabled={installing}
            className="mt-3 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"
          >
            {installing ? 'Installing…' : 'Install App'}
          </button>
        )}
      </div>
    </aside>
  );
}
