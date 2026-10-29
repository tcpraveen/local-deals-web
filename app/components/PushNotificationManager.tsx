'use client';

import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';

function decodeVapidKey(value: string): Uint8Array {
  const cleanValue = value.trim();
  const padding = '='.repeat((4 - (cleanValue.length % 4)) % 4);
  const base64 = (cleanValue + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}
async function getDeviceId(): Promise<string> {
  const key = 'ldh_push_device_id';
  const existing = localStorage.getItem(key);
  if (existing) return existing;

  const id = crypto.randomUUID();
  localStorage.setItem(key, id);
  return id;
}

async function saveSubscription(subscription: PushSubscription): Promise<void> {
  const subscriptionJson = subscription.toJSON();
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      device_id: await getDeviceId(),
      subscription: subscriptionJson,
    }),
  });
  if (!response.ok) {
    const result: unknown = await response.json().catch(() => null);
    const message =
      typeof result === 'object' &&
      result !== null &&
      'error' in result &&
      typeof result.error === 'string'
        ? result.error
        : 'Unable to save your notification subscription.';
    throw new Error(message);
  }
}

export default function PushNotificationManager() {
  const [dismissed, setDismissed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    let active = true;
    const inspectSubscription = async () => {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        await Promise.resolve();
        if (active) {
          setPermission('unsupported');
          setChecking(false);
        }
        return;
      }

      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.getSubscription();
        if (active) {
          setPermission(Notification.permission);
          setSubscribed(Boolean(subscription));
        }
      } catch (subscriptionError: unknown) {
        console.error('Unable to inspect push notification subscription:', subscriptionError);
        if (active) setError('Unable to check notification settings on this device.');
      } finally {
        if (active) setChecking(false);
      }
    };
    void inspectSubscription();

    return () => {
      active = false;
    };
  }, []);

  if (checking || dismissed || permission === 'unsupported') {
    return null;
  }

  const notificationsBlocked = permission === 'denied';

  const enableNotifications = async () => {
    if (notificationsBlocked) return;
    setBusy(true);
    setError('');
    try {
      const publicKey = process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY;
      if (!publicKey) throw new Error('Push notifications are not configured yet.');

      const registration = await navigator.serviceWorker.register('/sw.js');
      const nextPermission = permission === 'granted'
        ? permission
        : await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        if (nextPermission === 'denied') {
          setError('Notifications are blocked in your browser settings.');
        } else {
          setError('Allow notifications in the browser prompt to enable deal alerts.');
        }
        return;
      }

      const subscription = await registration.pushManager.getSubscription() ||
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey),
        });
      await saveSubscription(subscription);
      setSubscribed(true);
    } catch (subscriptionError: unknown) {
      console.error('Unable to enable push notifications:', subscriptionError);
      setError(subscriptionError instanceof Error
        ? subscriptionError.message
        : 'Unable to enable deal alerts. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      aria-label="Deal notifications"
      className="mx-auto mt-4 flex max-w-5xl flex-col gap-3 rounded-2xl border border-blue-500/30 bg-blue-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 h-5 w-5 shrink-0 text-blue-300" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-bold text-white">
            {notificationsBlocked
              ? 'Notifications are blocked'
              : subscribed
                ? 'Deal alerts are enabled'
                : 'Get local flash-deal alerts'}
          </h2>
          <p className="mt-1 text-xs text-slate-300">
            {notificationsBlocked
              ? 'Allow notifications in your browser settings to receive local offers.'
              : 'Be notified when nearby merchants share a limited-time offer.'}
          </p>
          {error && <p role="alert" className="mt-2 text-xs text-rose-300">{error}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
        <button
          type="button"
          onClick={() => void enableNotifications()}
          disabled={busy || notificationsBlocked}
          className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {busy ? 'Enabling...' : notificationsBlocked ? 'Blocked in browser settings' : subscribed ? 'Sync this device' : 'Enable alerts'}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss deal alert prompt"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
