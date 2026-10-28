'use client';

import { useMemo, useState } from 'react';
import { Deal, isDealActive } from '@/lib/deals';
import { supabase } from '@/lib/supabaseClient';

interface FlashDealBroadcastProps {
  deals: Deal[];
}

interface BroadcastResult {
  sent: number;
  failed: number;
  total: number;
}

export default function FlashDealBroadcast({ deals }: FlashDealBroadcastProps) {
  const eligibleDeals = useMemo(
    () => deals.filter((deal) => deal.is_verified_merchant === true && isDealActive(deal)),
    [deals]
  );
  const [selectedDealId, setSelectedDealId] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<BroadcastResult | null>(null);

  if (!eligibleDeals.length) return null;

  const selectedDeal = eligibleDeals.find((deal) => String(deal.id) === selectedDealId)
    ?? eligibleDeals[0];

  const sendBroadcast = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setResult(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error('Sign in again before sending a flash deal.');

      const response = await fetch('/api/push', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deal_id: selectedDeal.id, message }),
      });
      const responseBody: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const apiError =
          typeof responseBody === 'object' &&
          responseBody !== null &&
          'error' in responseBody &&
          typeof responseBody.error === 'string'
            ? responseBody.error
            : 'Unable to send the flash deal.';
        throw new Error(apiError);
      }

      if (
        typeof responseBody !== 'object' ||
        responseBody === null ||
        !('sent' in responseBody) ||
        typeof responseBody.sent !== 'number' ||
        !('failed' in responseBody) ||
        typeof responseBody.failed !== 'number' ||
        !('total' in responseBody) ||
        typeof responseBody.total !== 'number'
      ) {
        throw new Error('The notification service returned an invalid response.');
      }

      setResult({
        sent: responseBody.sent,
        failed: responseBody.failed,
        total: responseBody.total,
      });
      setMessage('');
    } catch (broadcastError: unknown) {
      console.error('Unable to broadcast flash deal:', broadcastError);
      setError(broadcastError instanceof Error
        ? broadcastError.message
        : 'Unable to send the flash deal. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-white">Broadcast a Flash Deal</h2>
        <p className="mt-1 text-xs text-slate-400">
          Send a limited-time alert to customers who enabled Local Deals Hub notifications.
        </p>
      </div>
      <form onSubmit={sendBroadcast} className="space-y-3">
        <label className="block text-xs font-semibold text-slate-300">
          Verified active offer
          <select
            value={selectedDeal.id}
            onChange={(event) => setSelectedDealId(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"
          >
            {eligibleDeals.map((deal) => (
              <option key={deal.id} value={deal.id}>{deal.business} — {deal.title}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-slate-300">
          Alert message
          <textarea
            required
            maxLength={240}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="50% off all items for the next 2 hours!"
            rows={3}
            className="mt-1.5 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500"
          />
          <span className="mt-1 block text-right text-[11px] font-normal text-slate-500">
            {message.length}/240
          </span>
        </label>
        {error && <p role="alert" className="text-xs text-rose-300">{error}</p>}
        {result && (
          <p role="status" className="text-xs text-emerald-300">
            Sent to {result.sent} of {result.total} subscribers
            {result.failed ? `; ${result.failed} delivery${result.failed === 1 ? '' : 'ies'} failed.` : '.'}
            {!result.total && ' Customers can enable alerts from the storefront.'}
          </p>
        )}
        <button
          type="submit"
          disabled={sending || !message.trim()}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending ? 'Sending alerts...' : 'Send Flash Deal'}
        </button>
      </form>
    </section>
  );
}
