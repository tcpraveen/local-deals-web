'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

interface DealTimerProps {
  expiresAt?: string;
}

function getExpiryTime(expiresAt: string): number {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt);
  const parsed = new Date(dateOnly ? `${expiresAt}T23:59:59` : expiresAt).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatRemaining(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Ends in ${days}d ${String(hours).padStart(2, '0')}h`;
  return `Ends in ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

export default function DealTimer({ expiresAt }: DealTimerProps) {
  const [remaining, setRemaining] = useState<{ expiresAt: string; milliseconds: number } | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const expiryTime = getExpiryTime(expiresAt);
    if (!Number.isFinite(expiryTime)) return;

    const updateRemaining = () => {
      setRemaining({ expiresAt, milliseconds: Math.max(0, expiryTime - Date.now()) });
    };
    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 30_000);
    return () => window.clearInterval(timerId);
  }, [expiresAt]);

  if (!expiresAt || !Number.isFinite(getExpiryTime(expiresAt)) || remaining?.expiresAt !== expiresAt) {
    return null;
  }

  const isUrgent =
    remaining.milliseconds > 0 && remaining.milliseconds < 6 * 60 * 60 * 1000;
  const isExpired = remaining.milliseconds === 0;

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        isExpired
          ? 'border-slate-700 bg-slate-800 text-slate-400'
          : isUrgent
            ? 'animate-pulse border-orange-500/40 bg-red-500/10 text-orange-300'
            : 'border-blue-500/30 bg-blue-500/10 text-blue-200'
      }`}
    >
      <Clock3 size={13} aria-hidden="true" />
      {isExpired ? 'Deal ended' : formatRemaining(remaining.milliseconds)}
    </span>
  );
}
