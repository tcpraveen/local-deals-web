"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  Deal,
  getDirectionsUrl,
  isVerifiedActiveDeal,
  LOCATIONS,
  normalizeDeal,
  VERIFIED_REAL_DEALS,
} from "@/lib/deals";
import InstallPrompt from "./InstallPrompt";
import SplashScreen from "./SplashScreen";
import AIAssistant from "./AIAssistant";

function createVoucherCode(): string {
  return `LDH-${Math.floor(1000 + Math.random() * 9000)}`;
}

function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function estimateTravelDuration(distanceKm: number): string {
  if (distanceKm < 0.3) return "At location (<1 min)";
  const averageSpeedKmH = 32; // Realistic local transit/traffic average
  const totalMinutes = Math.round((distanceKm / averageSpeedKmH) * 60);

  if (totalMinutes < 60) {
    return `~${totalMinutes} min drive`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `~${hours}h ${mins}m drive`;
}

const CUSTOM_DEALS_STORAGE_KEY = 'ldh_custom_deals';

async function withTimeout<T>(operation: PromiseLike<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Supabase timeout')), timeoutMs);
  });

  try {
    return await Promise.race([Promise.resolve(operation), timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function readCustomDeals(): Deal[] {
  try {
    const stored = localStorage.getItem(CUSTOM_DEALS_STORAGE_KEY);
    if (!stored) return [];
    const records: unknown = JSON.parse(stored);
    if (!Array.isArray(records)) return [];
    return records
      .filter((record): record is Record<string, unknown> => Boolean(record) && typeof record === 'object')
      .map((record) => normalizeDeal(record))
      .filter((deal) => isVerifiedActiveDeal(deal) && Boolean(deal.user_id));
  } catch (error) {
    console.error('Unable to load locally published deals:', error);
    return [];
  }
}

function mergeDeals(primary: Deal[], customDeals: Deal[]): Deal[] {
  const merged = new Map<string, Deal>();
  for (const deal of [...primary, ...customDeals]) {
    const key = String(deal.id);
    const duplicate = [...merged.values()].some(
      (existing) => existing.business === deal.business && existing.title === deal.title
    );
    if (!merged.has(key) && !duplicate) merged.set(key, deal);
  }
  return [...merged.values()];
}

export default function StorefrontPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>("All");
  const [claimedDeals, setClaimedDeals] = useState<Record<string, string>>({});
  const finishSplash = useCallback(() => setShowSplash(false), []);

  useEffect(() => {
    const loadDeals = async () => {
      try {
        const customDeals = readCustomDeals();
        setDeals(customDeals);
        if (!isSupabaseConfigured) {
          setDeals(mergeDeals(VERIFIED_REAL_DEALS, customDeals));
          return;
        }

        const { data, error } = await withTimeout(
          supabase
            .from('deals')
            .select('*')
            .eq('is_verified_merchant', true)
            .order('created_at', { ascending: false }),
          3000
        );
        if (error) throw error;
        const activeDeals = (data || [])
          .map((record: Record<string, unknown>) => normalizeDeal(record))
          .filter((deal: Deal) => deal.id !== '' && isVerifiedActiveDeal(deal));
        setDeals(mergeDeals(activeDeals.length ? activeDeals : VERIFIED_REAL_DEALS, customDeals));
      } catch (error) {
        console.error('Error loading verified deals; showing verified baseline listings:', error);
        setDeals(mergeDeals(VERIFIED_REAL_DEALS, readCustomDeals()));
      } finally {
        setDealsLoading(false);
      }
    };

    queueMicrotask(() => {
      void loadDeals();
    });
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setGpsError("Geolocation is not supported by your browser."));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude
        });
        setGpsError(null);
      },
      (error) => {
        setGpsError(error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleClaim = (deal: Deal) => {
    if (claimedDeals[deal.id]) return;
    const uniqueCode = createVoucherCode();
    setClaimedDeals((prev) => ({ ...prev, [deal.id]: uniqueCode }));
  };

  const filteredDeals = deals.filter(
    (deal) => selectedArea === "All" || deal.location === selectedArea
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {showSplash && <SplashScreen onFinish={finishSplash} />}
      {/* Header */}
      <header className="border-b border-slate-800/80 bg-[#090e1c]/95 backdrop-blur-md sticky top-0 z-30 px-3.5 sm:px-8 py-3 transition">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 text-sm font-black text-white">
                L
              </div>
              <span className="whitespace-nowrap font-black text-base sm:text-lg tracking-tight text-white">
                Local Deals <span className="text-blue-400">Hub</span>
              </span>
              <span className="shrink-0 rounded-full border border-blue-700/50 bg-blue-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-blue-300">
                Live GPS
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <InstallPrompt />
              <Link
                href="/merchant"
                className="whitespace-nowrap rounded-xl border border-slate-700/80 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200"
              >
                Merchant Portal
              </Link>
            </div>
          </div>
          <p className="mt-1 truncate text-[11px] text-slate-400">
            Verified local retail discovery • Thoothukudi &amp; Authoor
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* GPS Live Tracking Notification Bar */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  coords ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  coords ? "bg-emerald-500" : "bg-amber-500"
                }`}
              />
            </span>
            <span className="text-slate-300 font-medium">
              {coords
                ? `GPS Active: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                : gpsError
                ? `Location Permission Required (${gpsError})`
                : "Acquiring live satellite coordinates..."}
            </span>
          </div>
          <span className="text-slate-400 font-mono">
            {coords ? "Live distance dynamically updates as you travel" : "Allow browser location for live ETA"}
          </span>
        </section>

        {/* Location Filtering Tabs */}
        <nav aria-label="Filter stores by area" className="flex items-center gap-2 overflow-x-auto pb-1">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setSelectedArea(loc)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedArea === loc
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                  : "bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {loc === "All" ? "All Outlets" : loc}
            </button>
          ))}
        </nav>

        {/* Deals Listing */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dealsLoading ? (
            <p className="col-span-full py-16 text-center text-sm text-slate-400">Loading verified deals...</p>
          ) : filteredDeals.length === 0 ? (
            <p className="col-span-full rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-12 text-center text-sm text-slate-400">
              No verified deals currently active in this area. Check back soon!
            </p>
          ) : filteredDeals.map((deal) => {
            const distance = coords && typeof deal.lat === 'number' && typeof deal.lng === 'number'
              ? calculateHaversineDistanceKm(coords.lat, coords.lng, deal.lat, deal.lng)
              : null;
            const eta = distance !== null ? estimateTravelDuration(distance) : null;
            const voucherCode = claimedDeals[deal.id];
            const dealPrice = deal.deal_price ?? deal.price ?? deal.discount;
            const phoneDigits = (deal.phone || '').replace(/\D/g, '');
            const whatsappNumber =
              phoneDigits.length === 10
                ? `91${phoneDigits}`
                : phoneDigits;

            return (
              <article
                key={deal.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 flex flex-col justify-between transition"
              >
                <div>
                  {/* Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {deal.location}
                    </span>
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800">
                      {deal.discount}
                    </span>
                  </div>

                  {/* Title & Shop Details */}
                  <h2 className="text-xl font-black mt-3 text-white">{deal.business}</h2>
                  <p className="text-xs font-medium text-blue-400 mt-0.5">{deal.title}</p>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">{deal.address}</p>

                  {/* Live Travel Distance / Navigation Status */}
                  <div className="mt-4 p-3.5 bg-slate-950/90 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                        Calculated Distance
                      </span>
                      <span className="text-sm font-black text-slate-100">
                        {distance !== null ? `${distance.toFixed(2)} km away` : "Calculating..."}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                        Estimated Transit
                      </span>
                      <span className="text-xs font-semibold text-blue-400">
                        {eta || "Waiting for GPS"}
                      </span>
                    </div>
                  </div>

                  {/* Pricing Overview */}
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">
                      {deal.deal_price !== undefined || deal.price !== undefined
                        ? `₹${dealPrice}`
                        : deal.discount}
                    </span>
                    {(deal.original_price ?? deal.originalPrice) !== undefined && (
                      <span className="text-xs text-slate-500 line-through">
                        ₹{deal.original_price ?? deal.originalPrice}
                      </span>
                    )}
                    {typeof deal.vouchers_left === 'number' && (
                      <span className="ml-auto text-[11px] font-bold text-amber-400">
                        {deal.vouchers_left} vouchers left
                      </span>
                    )}
                  </div>

                  {/* Voucher Claim Box */}
                  {voucherCode && (
                    <div className="mt-4 p-3 rounded-xl bg-blue-950/40 border border-blue-600/40 text-center">
                      <p className="text-[11px] font-semibold text-blue-300">Your Exclusive Voucher Code</p>
                      <p className="text-lg font-mono font-black text-white tracking-widest mt-0.5">
                        {voucherCode}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-1">Present this counter-side at checkout</p>
                    </div>
                  )}
                </div>

                {/* Direct Actions */}
                <div className="mt-6 pt-4 border-t border-slate-800/70 flex flex-col gap-2">
                  <div className="mb-2 flex items-center justify-between">
                    <a
                      href={deal.phone ? `tel:${deal.phone}` : undefined}
                      className="text-xs font-semibold text-slate-400 transition hover:text-white"
                    >
                      Call Shop
                    </a>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {whatsappNumber && (
                    <a
                      href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                        `Vanakkam! I want to claim the ${deal.discount || 'special offer'} for ${deal.title} seen on Local Deals Hub.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900/60 active:scale-95"
                    >
                      <span aria-hidden="true">💬</span> WhatsApp
                    </a>
                    )}
                    <button
                      onClick={() => handleClaim(deal)}
                      disabled={!!voucherCode}
                      className={`py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                        voucherCode
                          ? "bg-slate-800 text-slate-400 cursor-default"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                      }`}
                    >
                      {voucherCode ? "Claimed" : "Claim Voucher"}
                    </button>
                  </div>

                  {/* Exact Turn-by-Turn GPS Navigation */}
                  <a
                    href={
                      typeof deal.lat === 'number' && typeof deal.lng === 'number'
                        ? getDirectionsUrl(deal.lat, deal.lng)
                        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${deal.business}, ${deal.store_address || deal.location || ''}`
                          )}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5"
                  >
                    <span>Open Exact Turn-by-Turn Navigation</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
              </article>
            );
          })}
        </section>
      </div>
      <AIAssistant coords={coords} deals={deals} />
    </main>
  );
}