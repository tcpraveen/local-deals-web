'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface DealTimerProps {
<<<<<<< HEAD
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
=======
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
>>>>>>> agents/project-upgrades-merchant-dashboard
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Ends in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `Ends in ${hours}h ${minutes}m`;
  }
  return `Ends in ${minutes}m`;
}

<<<<<<< HEAD
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
=======
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
>>>>>>> agents/project-upgrades-merchant-dashboard
  );
}
