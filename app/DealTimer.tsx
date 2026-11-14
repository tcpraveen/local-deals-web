'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface DealTimerProps {
  expiresAt?: string | null;
  isDemo?: boolean;
}

function getExpiryTimestamp(expiresAt: string | null): number {
  if (!expiresAt) return Number.NaN;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt);
  const parsed = new Date(dateOnly ? `${expiresAt}T23:59:59` : expiresAt).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getTargetTimestamp(expiresAt: string | null, isDemo: boolean): number {
  const now = Date.now();
  const parsedExpiry = getExpiryTimestamp(expiresAt);
  if (Number.isFinite(parsedExpiry) && parsedExpiry > now) {
    return parsedExpiry;
  }
  if (isDemo) {
    return now + 24 * 60 * 60 * 1000;
  }

  const seed = expiresAt ? expiresAt.length : 5;
  const hoursToAdd = 4 + (seed % 20);
  return now + hoursToAdd * 60 * 60 * 1000 + 25 * 60 * 1000;
}

function formatRemaining(milliseconds: number): string {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `Ends in ${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `Ends in ${hours}h ${minutes}m`;
  }
  return `Ends in ${minutes}m`;
}

export default function DealTimer({ expiresAt, isDemo = false }: DealTimerProps) {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    const targetMs = getTargetTimestamp(expiresAt ?? null, isDemo);
    return Math.max(0, targetMs - Date.now());
  });

  useEffect(() => {
    let targetMs = getTargetTimestamp(expiresAt ?? null, isDemo);
    const updateRemaining = () => {
      const now = Date.now();
      if (isDemo && targetMs <= now) {
        targetMs = now + 24 * 60 * 60 * 1000;
      }
      setRemainingMs(Math.max(0, targetMs - now));
    };
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, isDemo]);

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
      <Clock className="w-3.5 h-3.5" />
      <span>{formatRemaining(remainingMs)}</span>
    </div>
  );
}