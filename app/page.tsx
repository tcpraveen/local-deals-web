"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DEALS, LOCATIONS, getDirectionsUrl, Deal } from "@/lib/deals";
import InstallPrompt from "./InstallPrompt";
import BrandLogo from "./BrandLogo";
import SplashScreen from "./SplashScreen";
import AIAssistant from "./AIAssistant";
import { requestInstallGuide } from "./InstallPrompt";

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

export default function StorefrontPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string>("All");
  const [claimedDeals, setClaimedDeals] = useState<Record<string, string>>({});
  const finishSplash = useCallback(() => setShowSplash(false), []);

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

  const filteredDeals = DEALS.filter(
    (deal) => selectedArea === "All" || deal.location === selectedArea
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600 selection:text-white">
      {showSplash && <SplashScreen onFinish={finishSplash} />}
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo size={38} />
            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2 text-lg font-black tracking-tight text-white">
                <span>Local Deals <span className="text-blue-400">Hub</span></span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-900/40 text-blue-300 border border-blue-700/50 px-2 py-0.5 rounded-full">
                  Live GPS
                </span>
              </h1>
              <p className="mt-0.5 text-xs text-slate-400">
                Verified local retail discovery • Thoothukudi &amp; Authoor
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={requestInstallGuide}
              className="rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-600/30"
            >
              📲 Install App
            </button>
            <Link
              href="/merchant"
              className="rounded-lg border border-blue-500/40 bg-blue-600/15 px-3 py-2 text-xs font-semibold text-blue-100 transition hover:border-blue-400/60 hover:bg-blue-600/30"
            >
              Merchant Portal
            </Link>
          </div>
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
          {filteredDeals.map((deal) => {
            const distance = coords
              ? calculateHaversineDistanceKm(coords.lat, coords.lng, deal.lat, deal.lng)
              : null;
            const eta = distance !== null ? estimateTravelDuration(distance) : null;
            const voucherCode = claimedDeals[deal.id];
            const phoneDigits = (deal.phone || '').replace(/\D/g, '');
            const whatsappNumber =
              phoneDigits.length === 10
                ? `91${phoneDigits}`
                : phoneDigits || '919876543210';

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
                    <span className="text-2xl font-black text-white">₹{deal.price}</span>
                    <span className="text-xs text-slate-500 line-through">₹{deal.originalPrice}</span>
                    <span className="text-[11px] font-bold text-amber-400 ml-auto">
                      {deal.vouchersCount} vouchers left
                    </span>
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
                    href={getDirectionsUrl(deal.lat, deal.lng)}
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
      <InstallPrompt />
      <AIAssistant coords={coords} />
    </main>
  );
}