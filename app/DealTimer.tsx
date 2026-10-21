'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface DealTimerProps {
  expiresAt?: string | null;
}

function getTargetTimestamp(expiresAt?: string | null): number {
  const now = Date.now();
  if (expiresAt) {
    const parsed = Date.parse(expiresAt);
    if (!Number.isNaN(parsed) && parsed > now) {
      return parsed;
    }
  }
  // If missing or in the past, automatically roll forward so demo deals are always active
  const seed = expiresAt ? expiresAt.length : 5;
  const hoursToAdd = 4 + (seed % 20);
  return now + hoursToAdd * 60 * 60 * 1000 + 25 * 60 * 1000;
}

function formatRemaining(ms: number) {
  const totalMinutes = Math.max(1, Math.floor(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Ends in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `Ends in ${hours}h ${minutes}m`;
  }
  return `Ends in ${minutes}m`;
}

export default function DealTimer({ expiresAt }: DealTimerProps) {
  const [targetMs] = useState<number>(() => getTargetTimestamp(expiresAt));
  const [remainingMs, setRemainingMs] = useState<number>(() => Math.max(0, targetMs - Date.now()));

  useEffect(() => {
    const updateRemaining = () => {
      setRemainingMs(Math.max(0, targetMs - Date.now()));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 30000);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  const isUrgent = remainingMs <= 6 * 60 * 60 * 1000;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isUrgent
          ? 'animate-pulse border border-amber-400/40 bg-amber-500/15 text-amber-300'
          : 'border border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
      }`}
    >
      <Clock className="h-3.5 w-3.5" />
      <span>{formatRemaining(remainingMs)}</span>
    </div>
  );
}
