"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import {
  Deal,
  isVerifiedActiveDeal,
  LOCATIONS,
  normalizeDeal,
  slugifyStoreName,
  VERIFIED_REAL_DEALS,
} from "@/lib/deals";
import { calculateDistance, getUserLocation } from "@/lib/geo";
import InstallPrompt from "./InstallPrompt";
import SplashScreen from "./SplashScreen";
import AIAssistant from "./AIAssistant";

function createVoucherCode(): string {
  return `LDH-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getDirectionsUrl(deal: Deal): string {
  if (typeof deal.lat === 'number' && typeof deal.lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${deal.lat},${deal.lng}&destination_place_id=&travelmode=driving`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${deal.business}, ${deal.address || deal.store_address || deal.location || ''}`
  )}`;
}

function estimateTravelDuration(distanceKm: number): string {
  const roadDistanceKm = distanceKm * 1.35;
  if (distanceKm < 1) {
    const walkingMinutes = Math.max(1, Math.round((roadDistanceKm / 4.5) * 60));
    return `~${walkingMinutes} min walk`;
  }

  const transitMinutes = Math.max(3, Math.round((roadDistanceKm / 25) * 60));
  return `~${transitMinutes} min drive`;
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
  const [locationStatus, setLocationStatus] = useState<
    'gps_active' | 'manual_selected' | 'location_unavailable'
  >('location_unavailable');
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationStatusRef = useRef(locationStatus);
  const [selectedArea, setSelectedArea] = useState<string>("All");
  const [claimedDeals, setClaimedDeals] = useState<Record<string, string>>({});
  const [shareToast, setShareToast] = useState<string | null>(null);
  const shareToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const engagementCounts = useRef<Record<string, number>>({});
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
    const setGpsActive = (position: GeolocationPosition) => {
      if (locationStatusRef.current === 'manual_selected') return;
      setCoords({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      });
      locationStatusRef.current = 'gps_active';
      setLocationStatus('gps_active');
      setLocationError(null);
    };

    if (!navigator.geolocation) {
      queueMicrotask(() => setLocationError('Geolocation is not supported by this browser.'));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      setGpsActive,
      (error) => {
        if (locationStatusRef.current !== 'manual_selected') {
          locationStatusRef.current = 'location_unavailable';
          setLocationStatus('location_unavailable');
          setLocationError(
            error.code === error.PERMISSION_DENIED
              ? 'Device location permission is disabled.'
              : error.code === error.TIMEOUT
                ? 'Device location timed out.'
                : 'Device location is currently unavailable.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const selectTown = (town: 'Authoor' | 'Thoothukudi') => {
    const townCoordinates = town === 'Authoor'
      ? { lat: 8.6256, lng: 78.0772 }
      : { lat: 8.7642, lng: 78.1348 };
    locationStatusRef.current = 'manual_selected';
    setCoords(townCoordinates);
    setLocationStatus('manual_selected');
    setLocationError(null);
  };

  const retryGps = async () => {
    locationStatusRef.current = 'location_unavailable';
    setLocationStatus('location_unavailable');
    setLocationError(null);
    try {
      const position = await getUserLocation();
      locationStatusRef.current = 'gps_active';
      setCoords(position);
      setLocationStatus('gps_active');
    } catch (error) {
      locationStatusRef.current = 'location_unavailable';
      setLocationStatus('location_unavailable');
      const geoError = error as GeolocationPositionError;
      setLocationError(
        geoError.code === geoError.PERMISSION_DENIED
          ? 'Device location permission is disabled.'
          : geoError.code === geoError.TIMEOUT
            ? 'Device location timed out.'
            : error instanceof Error
              ? error.message
              : 'Device location is currently unavailable.'
      );
    }
  };

  const handleClaim = (deal: Deal) => {
    if (claimedDeals[deal.id]) return;
    const uniqueCode = createVoucherCode();
    setClaimedDeals((prev) => ({ ...prev, [deal.id]: uniqueCode }));
  };

  const handleShareDeal = async (deal: Deal) => {
    const url = `${window.location.origin}/store/${slugifyStoreName(deal.business)}`;
    const shareData = {
      title: deal.title,
      text: `Check out ${deal.discount} at ${deal.business} (${deal.location || 'nearby'}) on Local Deals Hub!`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareToast('Deal link copied to clipboard!');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      console.error('Unable to share or copy the deal link:', error);
      setShareToast('Unable to share the deal link. Please try again.');
    }

    if (shareToastTimer.current) clearTimeout(shareToastTimer.current);
    shareToastTimer.current = setTimeout(() => setShareToast(null), 2500);
  };

  const recordDealMetric = async (
    deal: Deal,
    metric: 'views_count' | 'inquiries_count'
  ) => {
    const counterKey = `${deal.id}:${metric}`;
    const previousValue = engagementCounts.current[counterKey] ?? deal[metric] ?? 0;
    const nextValue = previousValue + 1;
    engagementCounts.current[counterKey] = nextValue;
    setDeals((currentDeals) =>
      currentDeals.map((item) =>
        item.id === deal.id ? { ...item, [metric]: nextValue } : item
      )
    );
    if (typeof deal.id !== 'number') return;

    void withTimeout(
      supabase.rpc('increment_deal_metric', {
        p_deal_id: deal.id,
        p_metric: metric,
      }),
      3000
    )
      .then(({ error }) => {
        if (error) throw error;
      })
      .catch((error: unknown) => {
        console.error(`Unable to record ${metric} for deal ${deal.id}:`, error);
        const currentValue = engagementCounts.current[counterKey] ?? nextValue;
        engagementCounts.current[counterKey] = Math.max(0, currentValue - 1);
        setDeals((currentDeals) =>
          currentDeals.map((item) =>
            item.id === deal.id
              ? { ...item, [metric]: Math.max(0, (item[metric] || 0) - 1) }
              : item
          )
        );
      });
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
                {locationStatus === 'gps_active'
                  ? 'Live GPS'
                  : locationStatus === 'manual_selected'
                    ? 'Town Selected'
                    : 'GPS Needed'}
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

      {locationStatus !== 'gps_active' && (
        <section className="mx-auto mt-3 flex max-w-5xl flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-100">
          <span>📍 Enable device GPS or select your town for accurate distance:</span>
          <button
            type="button"
            onClick={() => selectTown('Authoor')}
            className={`rounded-lg border px-2.5 py-1 font-semibold transition ${
              locationStatus === 'manual_selected' && coords?.lat === 8.6256
                ? 'border-blue-400/50 bg-blue-500/20 text-blue-100'
                : 'border-slate-600 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
            }`}
          >
            Authoor
          </button>
          <button
            type="button"
            onClick={() => selectTown('Thoothukudi')}
            className={`rounded-lg border px-2.5 py-1 font-semibold transition ${
              locationStatus === 'manual_selected' && coords?.lat === 8.7642
                ? 'border-blue-400/50 bg-blue-500/20 text-blue-100'
                : 'border-slate-600 bg-slate-900/70 text-slate-200 hover:bg-slate-800'
            }`}
          >
            Thoothukudi
          </button>
          <button
            type="button"
            onClick={() => void retryGps()}
            className="rounded-lg px-2 py-1 font-semibold text-emerald-300 underline-offset-2 hover:underline"
          >
            Enable GPS
          </button>
          {locationError && <span role="status" className="w-full text-amber-200/80">{locationError}</span>}
        </section>
      )}

      <div className="max-w-5xl mx-auto p-6 space-y-6">

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
            const hasLocation = locationStatus !== 'location_unavailable' && coords !== null;
            const distance = hasLocation && typeof deal.lat === 'number' && typeof deal.lng === 'number'
              ? calculateDistance(coords.lat, coords.lng, deal.lat, deal.lng)
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
                        {distance !== null ? `${distance.toFixed(2)} km away` : "Enable GPS for ETA"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">
                        Estimated Transit
                      </span>
                      <span className="text-xs font-semibold text-blue-400">
                        {eta || "Enable GPS for ETA"}
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
                  <div className="grid grid-cols-3 gap-2">
                    {whatsappNumber && (
                    <a
                      href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                        `Vanakkam! I want to claim the ${deal.discount || 'special offer'} for ${deal.title} seen on Local Deals Hub.`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => void recordDealMetric(deal, 'inquiries_count')}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-3 py-2.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900/60 active:scale-95"
                    >
                      <span aria-hidden="true">💬</span> WhatsApp
                    </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleShareDeal(deal)}
                      aria-label={`Share ${deal.business} deal`}
                      className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition flex items-center justify-center"
                    >
                      📤
                    </button>
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
                    href={getDirectionsUrl(deal)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => void recordDealMetric(deal, 'views_count')}
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
      {shareToast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-slate-700 bg-[#0e1628] px-4 py-3 text-sm font-medium text-white shadow-2xl"
        >
          {shareToast}
        </div>
      )}
      <AIAssistant coords={coords} deals={deals} />
    </main>
  );
}