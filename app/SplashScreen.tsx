'use client';

import { useEffect, useState } from 'react';

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let finishTimer: ReturnType<typeof setTimeout> | undefined;
    const splashTimer = setTimeout(() => {
      setFading(true);
      finishTimer = setTimeout(onFinish, 400);
    }, 1200);

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
        <div className="relative flex h-16 w-16 animate-pulse items-center justify-center rounded-2xl border border-white/20 bg-gradient-to-tr from-blue-600 to-indigo-500 text-2xl font-black text-white shadow-2xl">
          <span aria-hidden="true">L</span>
          <span className="absolute bottom-2 right-2 h-2.5 w-2.5 rounded-full border-2 border-[#070b14] bg-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Local Deals Hub
          </h1>
          <div className="mt-1.5 flex items-center justify-center gap-2">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              Thoothukudi &amp; Authoor
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
