'use client';

import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';

interface DealTimerProps {
  expiresAt?: string;
  isDemo?: boolean;
}

function getExpiryTime(expiresAt?: string): number {
  if (!expiresAt) return Number.NaN;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt);
  const parsed = new Date(dateOnly ? `${expiresAt}T23:59:59` : expiresAt).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getEffectiveExpiry(expiresAt: string | undefined, isDemo: boolean): number {
  const parsedExpiry = getExpiryTime(expiresAt);
  if (isDemo && (!Number.isFinite(parsedExpiry) || parsedExpiry <= Date.now())) {
    return Date.now() + 24 * 60 * 60 * 1000;
  }
  return parsedExpiry;
}

function formatRemaining(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60_000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `Ends in ${days}d ${String(hours).padStart(2, '0')}h`;
  return `Ends in ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
}

export default function DealTimer({ expiresAt, isDemo = false }: DealTimerProps) {
  const [remaining, setRemaining] = useState<{ key: string; milliseconds: number } | null>(null);

  useEffect(() => {
    let expiryTime = getEffectiveExpiry(expiresAt, isDemo);
    if (!Number.isFinite(expiryTime)) return;

    const updateRemaining = () => {
      const now = Date.now();
      if (isDemo && expiryTime <= now) {
        expiryTime = now + 24 * 60 * 60 * 1000;
      }
      setRemaining({ key: `${expiresAt ?? ''}:${isDemo}`, milliseconds: expiryTime - now });
    };
    const initialUpdateId = window.setTimeout(updateRemaining, 0);
    const timerId = window.setInterval(updateRemaining, 30_000);
    return () => {
      window.clearTimeout(initialUpdateId);
      window.clearInterval(timerId);
    };
  }, [expiresAt, isDemo]);

  const key = `${expiresAt ?? ''}:${isDemo}`;
  if ((!Number.isFinite(getExpiryTime(expiresAt)) && !isDemo) || remaining?.key !== key) {
    return null;
  }

  const isUrgent =
    remaining.milliseconds > 0 && remaining.milliseconds < 6 * 60 * 60 * 1000;

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
        isUrgent
          ? 'animate-pulse border-orange-500/40 bg-red-500/10 text-orange-300'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-200'
      }`}
    >
      <Clock3 size={13} aria-hidden="true" />
      {formatRemaining(remaining.milliseconds)}
    </span>
  );
}
