'use client';

import { FormEvent, useRef, useState } from 'react';
import { Deal } from '@/lib/deals';
import { isStoreOpen } from '@/lib/storeHours';
import BrandLogo from './BrandLogo';

interface AIAssistantProps {
  coords: { lat: number; lng: number } | null;
  deals: Deal[];
}

interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  text: string;
}

function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = radians(lat2 - lat1);
  const longitudeDelta = radians(lng2 - lng1);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildReply(
  question: string,
  coords: AIAssistantProps['coords'],
  deals: AIAssistantProps['deals']
): string {
  const normalizedQuestion = question.toLowerCase();

  if (/claim|voucher|redeem/.test(normalizedQuestion)) {
    return 'Tap Claim Voucher on an offer card to generate your LDH code. You can show that code in-store, or use the WhatsApp button to message the merchant directly.';
  }

  if (/open|hours|time/.test(normalizedQuestion)) {
    const openStores = deals.filter(
      (deal): deal is Deal & { opening_time: string; closing_time: string } =>
        typeof deal.opening_time === 'string' &&
        typeof deal.closing_time === 'string' &&
        isStoreOpen(deal.opening_time, deal.closing_time)
    );
    return openStores.length
      ? `These stores are open now: ${openStores.map((deal) => deal.business).join(', ')}.`
      : 'No verified active offers with available store hours are open right now.';
  }

  const matchingDeals = deals.filter((deal) =>
    [deal.business, deal.title, deal.location, deal.category]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => normalizedQuestion.includes(value.toLowerCase()))
  );

  if (matchingDeals.length > 0) {
    return matchingDeals.map((deal) => describeDeal(deal)).join('\n\n');
  }

  if (deals.length === 0) {
    return 'There are no verified active offers available right now. Check back soon.';
  }

  if (/near|nearby|distance|closest/.test(normalizedQuestion) && coords) {
    const closestDeals = deals
      .filter(
        (deal): deal is Deal & { lat: number; lng: number } =>
          typeof deal.lat === 'number' && typeof deal.lng === 'number'
      )
      .sort(
        (first, second) =>
          distanceKm(coords.lat, coords.lng, first.lat, first.lng) -
          distanceKm(coords.lat, coords.lng, second.lat, second.lng)
      )
      .slice(0, 3);
    return closestDeals.length
      ? `Closest offers to your current location:\n${closestDeals.map(describeDeal).join('\n')}`
      : 'There are no verified active offers with location coordinates available yet.';
  }

  if (/near|nearby|distance|closest/.test(normalizedQuestion)) {
    return 'Allow location access to sort offers by distance, or choose Main Bazaar, Anna Nagar, or Beach Road in the area filters.';
  }

  return deals.length
    ? `I can help find a deal by store, area, or category, check which stores are open, and explain how voucher claiming works. Verified active offers: ${deals.map((deal) => deal.business).join(', ')}.`
    : 'There are no verified active offers available right now. Check back soon.';
}

function describeDeal(deal: Deal): string {
  const location = deal.location ? ` (${deal.location})` : '';
  const vouchers =
    typeof deal.vouchers_left === 'number' ? ` ${deal.vouchers_left} vouchers left.` : '';
  return `${deal.business}${location} — ${deal.title}, ${deal.discount}.${vouchers}`;
}

export default function AIAssistant({ coords, deals }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 0,
      role: 'assistant',
      text: 'Vanakkam! Ask me about nearby deals, store hours, or how to claim a voucher.',
    },
  ]);
  const nextMessageId = useRef(1);

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;

    const userMessage: ChatMessage = {
      id: nextMessageId.current++,
      role: 'user',
      text: question,
    };
    const assistantMessage: ChatMessage = {
      id: nextMessageId.current++,
      role: 'assistant',
      text: buildReply(question, coords, deals),
    };
    setMessages((previous) => [...previous, userMessage, assistantMessage]);
    setInput('');
  };

  return (
    <>
      {isOpen && (
        <section
          aria-label="Local Deals AI Assistant"
          className="fixed inset-x-3 bottom-4 top-20 z-50 flex flex-col overflow-hidden rounded-3xl border border-blue-500/40 bg-[#0d162a]/95 shadow-2xl backdrop-blur-xl sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[530px] sm:w-96"
        >
          <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="flex items-center gap-3">
              <BrandLogo size={36} />
              <div>
                <h2 className="text-sm font-bold text-white">AI Assistant</h2>
                <p className="text-[11px] text-slate-400">Local Deals Hub</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close AI Assistant"
              className="rounded-lg px-2.5 py-1.5 text-lg leading-none text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          </header>

          <div
            aria-live="polite"
            className="flex-1 space-y-3 overflow-y-auto p-4"
          >
            {messages.map((message) => (
              <p
                key={message.id}
                className={`max-w-[90%] whitespace-pre-line rounded-2xl px-3 py-2.5 text-xs leading-relaxed ${
                  message.role === 'user'
                    ? 'ml-auto bg-blue-600 text-white'
                    : 'mr-auto border border-slate-700 bg-slate-800/80 text-slate-200'
                }`}
              >
                {message.text}
              </p>
            ))}
          </div>

          <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-800 p-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              aria-label="Ask the Local Deals AI Assistant"
              placeholder="Ask about local deals..."
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-xs text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </section>
      )}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-expanded={isOpen}
        className="fixed bottom-6 right-4 z-50 flex items-center gap-2 rounded-full border border-blue-300/30 bg-blue-600 px-4 py-3 text-xs font-bold text-white shadow-2xl shadow-blue-950/70 transition hover:bg-blue-500 active:scale-95 sm:right-6"
      >
        <BrandLogo size={22} />
        <span>{isOpen ? 'Close Assistant' : 'AI Assistant'}</span>
      </button>
    </>
  );
}
