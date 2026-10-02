'use client';

import { useEffect, useState } from 'react';
import BrandLogo from './BrandLogo';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    const splashTimer = setTimeout(() => {
      setFading(true);
      finishTimer = setTimeout(onFinish, 400);
    }, 1100);

    return () => {
      clearTimeout(splashTimer);
      if (finishTimer) clearTimeout(finishTimer);
    };
  }, [onFinish]);

  return (
    <div
      role="status"
      aria-label="Connecting to Local Deals Hub"
      className={`fixed inset-0 z-[100] flex select-none flex-col items-center justify-center bg-[#070b14] transition-opacity duration-[400ms] ease-out ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <div className="absolute h-80 w-80 animate-pulse rounded-full bg-blue-600/20 blur-3xl" />

      <div className="relative flex animate-splash-enter flex-col items-center gap-4 px-4 text-center">
        <BrandLogo size={68} />
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Local Deals <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">Hub</span>
          </h1>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Connecting Thoothukudi &amp; Authoor
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
