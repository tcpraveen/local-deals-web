'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface DealTimerProps {
  expiresAt?: string | null;
  isDemo?: boolean;
}

function getTargetTimestamp(expiresAt: string | null): number {
  const now = Date.now();
  if (expiresAt) {
    const parsed = Date.parse(expiresAt);
    if (!Number.isNaN(parsed) && parsed > now) {
      return parsed;
    }
  }
  // Auto-roll expired or missing demo timers so deals always show live countdown
  const seed = expiresAt ? expiresAt.length : 5;
  const hoursToAdd = 4 + (seed % 20);
  return now + hoursToAdd * 60 * 60 * 1000 + 25 * 60 * 1000;
}

function getExpiryTime(expiresAt: string): number {
  if (!expiresAt) return Number.NaN;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(expiresAt);
  const parsed = new Date(dateOnly ? `${expiresAt}T23:59:59` : expiresAt).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getEffectiveExpiry(expiresAt: string | undefined, isDemo: boolean): number {
  const parsedExpiry = getExpiryTime(expiresAt!);
  if (isDemo && (!Number.isFinite(parsedExpiry) || parsedExpiry <= Date.now())) {
    return Date.now() + 24 * 60 * 60 * 1000;
  }
  return parsedExpiry;
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

export default function DealTimer({ expiresAt }: DealTimerProps) {
  const [targetMs] = useState<number>(() => getTargetTimestamp(expiresAt ?? null));
  const [remainingMs, setRemainingMs] = useState<number>(() => Math.max(0, targetMs - Date.now()));

  useEffect(() => {
    const updateRemaining = () => {
      setRemainingMs(Math.max(0, targetMs - Date.now()));
    };
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 30000);
    return () => window.clearInterval(timer);
  }, [targetMs]);

  return (
    <div className="flex items-center gap-1.5 text-xs text-amber-400 font-medium">
      <Clock className="w-3.5 h-3.5" />
      <span>{formatRemaining(remainingMs)}</span>
    </div>
  );
}