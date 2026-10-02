"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";

interface Deal {
  id: string;
  business: string;
  category: string;
  title: string;
  address: string;
  location: string;
  lat: number;
  lng: number;
  price: number;
  originalPrice: number;
  discount: string;
  vouchersCount: number;
  phone: string;
  rating: number;
  reviewsCount: number;
  imageUrl: string;
  openTime: string; // "09:00"
  closeTime: string; // "21:30"
}

const DEALS: Deal[] = [
  {
    id: "vrc-authoor",
    business: "VRC Electronics",
    category: "Home Appliances & Electronics",
    title: "Flat 25% Off All Inverters, Batteries & Smart Home Tech",
    address: "9/9, N Car St, Authoor, Tamil Nadu 628151",
    location: "Authoor",
    lat: 8.62325,
    lng: 78.06992,
    price: 999,
    originalPrice: 1499,
    discount: "25% OFF",
    vouchersCount: 12,
    phone: "919443123456",
    rating: 4.9,
    reviewsCount: 38,
    imageUrl: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80",
    openTime: "09:00",
    closeTime: "21:30",
  },
  {
    id: "mj-traders",
    business: "MJ Traders",
    category: "Household Goods & Kitchenware",
    title: "Up to 30% Off Commercial Cookware & Brass Essentials",
    address: "24a/1, Thanthi Office Road, beside VOC Market, New Colony, Thoothukudi",
    location: "Old Market",
    lat: 8.80327,
    lng: 78.15135,
    price: 499,
    originalPrice: 799,
    discount: "30% OFF",
    vouchersCount: 9,
    phone: "919842123456",
    rating: 4.8,
    reviewsCount: 54,
    imageUrl: "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=800&q=80",
    openTime: "08:30",
    closeTime: "22:00",
  },
];

const LOCATIONS = ["All Outlets", "Authoor", "Old Market", "Main Bazaar", "Anna Nagar", "Beach Road", "Millerpuram"];

function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
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

function estimateTransit(distanceKm: number): { drive: string; walk: string } {
  if (distanceKm < 0.2) return { drive: "< 1 min", walk: "< 2 min" };
  const driveMinutes = Math.max(1, Math.round((distanceKm / 32) * 60));
  const walkMinutes = Math.max(2, Math.round((distanceKm / 4.8) * 60));

  const drive = driveMinutes < 60 ? `~${driveMinutes} min drive` : `~${Math.floor(driveMinutes / 60)}h ${driveMinutes % 60}m drive`;
  const walk = walkMinutes < 60 ? `~${walkMinutes} min walk` : `~${Math.floor(walkMinutes / 60)}h walk`;

  return { drive, walk };
}

function getStoreStatus(openStr: string, closeStr: string): { status: "open" | "closed" | "closing_soon"; text: string } {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [oH, oM] = openStr.split(":").map(Number);
  const [cH, cM] = closeStr.split(":").map(Number);
  const openMinutes = oH * 60 + oM;
  const closeMinutes = cH * 60 + cM;

  if (currentMinutes >= openMinutes && currentMinutes <= closeMinutes) {
    if (closeMinutes - currentMinutes <= 30) {
      return { status: "closing_soon", text: "Closing Soon" };
    }
    return { status: "open", text: "Open Now" };
  }
  return { status: "closed", text: `Closed • Opens ${openStr}` };
}

interface Message {
  role: "assistant" | "user";
  text: string;
}

export default function LocalDealsApp() {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [selectedLocation, setSelectedLocation] = useState<string>("All Outlets");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [maxRadius, setMaxRadius] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState<boolean>(false);

  // Voucher modal state
  const [activeVoucher, setActiveVoucher] = useState<{ deal: Deal; code: string } | null>(null);
  const [claimedCodes, setClaimedCodes] = useState<Record<string, string>>({});

  // AI Assistant states
  const [isAiOpen, setIsAiOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      text: "Vanakkam! I'm your Local Deals Assistant. Need help finding a shop in Authoor/Thoothukudi, claiming a voucher, or leaving a store review?",
    },
  ]);
  const [inputVal, setInputVal] = useState<string>("");
  const [userRating, setUserRating] = useState<number>(5);
  const [reviewSent, setReviewSent] = useState<boolean>(false);

  // Load saved favorites from local storage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ldh_favs");
      if (saved) setFavorites(JSON.parse(saved));
    } catch {}
  }, []);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id];
      try {
        localStorage.setItem("ldh_favs", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Watch GPS Position
  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsActive(true);
      },
      () => setGpsActive(false),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const handleClaim = (deal: Deal) => {
    let code = claimedCodes[deal.id];
    if (!code) {
      code = `LDH-${Math.floor(1000 + Math.random() * 9000)}`;
      setClaimedCodes((prev) => ({ ...prev, [deal.id]: code }));
    }
    setActiveVoucher({ deal, code });
  };

  const handleSendAi = (text?: string) => {
    const prompt = text || inputVal;
    if (!prompt.trim()) return;

    const updated: Message[] = [...messages, { role: "user", text: prompt }];
    setMessages(updated);
    if (!text) setInputVal("");

    const q = prompt.toLowerCase();
    let reply = "I can guide you to stores, check voucher validity, or record your store experience. How else can I help?";

    if (q.includes("gps") || q.includes("distance") || q.includes("location")) {
      reply = "We stream your device's live coordinates to calculate real-time driving/walking times directly to the shop's door!";
    } else if (q.includes("vrc") || q.includes("authoor") || q.includes("electronics")) {
      reply = "VRC Electronics is located at 9/9 N Car St, Authoor. Tap 'Open Exact Turn-by-Turn Navigation' to drive straight to their shop!";
    } else if (q.includes("mj") || q.includes("thoothukudi") || q.includes("market")) {
      reply = "MJ Traders is right by VOC Market on Thanthi Office Road, Thoothukudi. They offer up to 30% off kitchen essentials.";
    } else if (q.includes("voucher") || q.includes("claim") || q.includes("how to use")) {
      reply = "Tap 'Claim Voucher' on any store deal to generate your unique LDH code, or send it directly to the merchant on WhatsApp.";
    } else if (q.includes("review") || q.includes("rating")) {
      reply = "You can rate your store experience directly inside this chat! Select your stars below and hit Submit Review.";
    }

    setTimeout(() => {
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    }, 350);
  };

  const submitReview = () => {
    setReviewSent(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: `Thank you! Your ${userRating}-star review has been recorded to help local shoppers in Thoothukudi & Authoor.`,
      },
    ]);
  };

  // Filter deals
  const filteredDeals = useMemo(() => {
    return DEALS.filter((d) => {
      const matchLoc = selectedLocation === "All Outlets" || d.location === selectedLocation;
      const matchSearch =
        searchQuery === "" ||
        d.business.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.address.toLowerCase().includes(searchQuery.toLowerCase());

      const dist = coords ? calculateHaversineDistanceKm(coords.lat, coords.lng, d.lat, d.lng) : null;
      const matchRadius = maxRadius === null || (dist !== null && dist <= maxRadius);
      const matchSaved = !showSavedOnly || favorites.includes(d.id);

      return matchLoc && matchSearch && matchRadius && matchSaved;
    });
  }, [selectedLocation, searchQuery, maxRadius, showSavedOnly, favorites, coords]);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-[#090e1c]/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 transition">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center font-black text-white shadow-md shadow-blue-500/20">
              L
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight text-white">Local Deals Hub</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
                  Live GPS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-0.5">Verified local retail discovery • Thoothukudi & Authoor</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={`text-xs font-semibold px-3 py-2 rounded-xl border transition flex items-center gap-1.5 ${
                showSavedOnly
                  ? "bg-rose-600/20 border-rose-500/40 text-rose-300"
                  : "bg-slate-900 border-slate-700/80 text-slate-300 hover:bg-slate-800"
              }`}
            >
              <span>{showSavedOnly ? "❤️" : "🤍"}</span>
              <span>Saved ({favorites.length})</span>
            </button>
            <Link
              href="/merchant"
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-slate-200 transition shadow-sm"
            >
              Merchant Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* GPS Live Telemetry Pill */}
        <div className="bg-[#0b1224] border border-blue-900/30 rounded-2xl p-3.5 sm:px-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-inner">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${gpsActive ? "bg-emerald-400" : "bg-amber-400"}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${gpsActive ? "bg-emerald-500" : "bg-amber-500"}`} />
            </span>
            <span className="text-slate-300 font-medium">
              {coords ? (
                <>
                  <span className="text-emerald-400 font-semibold">GPS Active:</span> {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </>
              ) : (
                "Locating device position..."
              )}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            {coords ? "Live distance dynamically updates as you travel" : "Allow browser location for live transit ETA"}
          </div>
        </div>

        {/* Search & Radius Filter */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search stores, kitchenware, inverters, or streets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#0d162a] border border-slate-800 rounded-2xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition shadow-sm"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto bg-[#0d162a] border border-slate-800 p-1.5 rounded-2xl">
            <span className="text-[11px] text-slate-400 font-bold px-2.5">Radius:</span>
            {[
              { label: "All", val: null },
              { label: "< 2 km", val: 2 },
              { label: "< 5 km", val: 5 },
              { label: "< 25 km", val: 25 },
            ].map((r) => (
              <button
                key={r.label}
                onClick={() => setMaxRadius(r.val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  maxRadius === r.val ? "bg-blue-600 text-white shadow-md shadow-blue-600/30" : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Area Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setSelectedLocation(loc)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedLocation === loc
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                  : "bg-[#0d162a] border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Store Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredDeals.map((deal) => {
            const distance = coords ? calculateHaversineDistanceKm(coords.lat, coords.lng, deal.lat, deal.lng) : null;
            const transit = distance !== null ? estimateTransit(distance) : null;
            const isClaimed = !!claimedCodes[deal.id];
            const isFav = favorites.includes(deal.id);
            const storeStatus = getStoreStatus(deal.openTime, deal.closeTime);

            return (
              <div
                key={deal.id}
                className="bg-[#0b1224] border border-slate-800/80 hover:border-slate-700 rounded-3xl overflow-hidden shadow-xl transition flex flex-col justify-between group"
              >
                {/* Store Cover Image */}
                <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                  <Image
                    src={deal.imageUrl}
                    alt={deal.business}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover group-hover:scale-105 transition duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b1224] via-transparent to-black/30" />

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur-md text-white border border-white/10">
                      {deal.location}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 backdrop-blur-md border ${
                        storeStatus.status === "open"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : storeStatus.status === "closing_soon"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          storeStatus.status === "open"
                            ? "bg-emerald-400 animate-pulse"
                            : storeStatus.status === "closing_soon"
                            ? "bg-amber-400"
                            : "bg-rose-400"
                        }`}
                      />
                      {storeStatus.text}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      onClick={() => toggleFavorite(deal.id)}
                      className="w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-sm border border-white/10 hover:scale-110 transition"
                      aria-label="Save store to favorites"
                    >
                      {isFav ? "❤️" : "🤍"}
                    </button>
                    <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-rose-600 text-white shadow-lg shadow-rose-600/30">
                      {deal.discount}
                    </span>
                  </div>

                  {/* Calculated Live Distance */}
                  <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md border border-white/10 px-3 py-1 rounded-xl text-right">
                    <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Distance</div>
                    <div className="text-xs font-black text-white">
                      {distance !== null ? `${distance.toFixed(2)} km away` : "Calculating..."}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-black text-white group-hover:text-blue-400 transition">{deal.business}</h2>
                        <span className="text-blue-400 text-xs" title="Verified Store">✓</span>
                      </div>
                      <div className="flex items-center gap-1 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-md text-amber-300 text-xs font-bold">
                        <span>★</span>
                        <span>{deal.rating}</span>
                        <span className="text-slate-500 text-[10px]">({deal.reviewsCount})</span>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-blue-400 mt-0.5">{deal.category}</p>
                    <p className="text-sm font-bold text-slate-200 mt-2">{deal.title}</p>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-1 leading-relaxed">{deal.address}</p>

                    {/* Drive & Walk Time Pill */}
                    <div className="mt-4 p-3 bg-[#080d1a] border border-slate-800 rounded-2xl flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Transit ETA</span>
                        <span className="font-bold text-blue-400">{transit?.drive || "Acquiring GPS..."}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Foot Walk</span>
                        <span className="font-semibold text-slate-300">{transit?.walk || "--"}</span>
                      </div>
                    </div>

                    {/* Pricing */}
                    <div className="mt-4 flex items-baseline gap-2">
                      <span className="text-2xl font-black text-white">₹{deal.price}</span>
                      <span className="text-xs text-slate-500 line-through">₹{deal.originalPrice}</span>
                      <span className="text-[11px] font-bold text-amber-400 ml-auto">{deal.vouchersCount} vouchers left</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col gap-2">
                    <div className="flex gap-2">
                      <a
                        href={`https://wa.me/${deal.phone}?text=${encodeURIComponent(
                          `Vanakkam! I want to claim the ${deal.discount} offer for${deal.business} on Local Deals Hub.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 text-center py-2.5 px-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <span>💬</span> WhatsApp
                      </a>
                      <button
                        onClick={() => handleClaim(deal)}
                        className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition ${
                          isClaimed
                            ? "bg-slate-800 text-emerald-400 border border-emerald-500/30"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/25"
                        }`}
                      >
                        {isClaimed ? "✓ Code Ready" : "Claim Voucher"}
                      </button>
                    </div>

                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${deal.lat},${deal.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full text-center py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wide transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-1.5"
                    >
                      <span>Open Exact Turn-by-Turn Navigation</span>
                      <span>→</span>
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Interactive Voucher Pop-up Modal */}
      {activeVoucher && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0e1628] border border-blue-500/30 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
            <button
              onClick={() => setActiveVoucher(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg font-bold"
            >
              ✕
            </button>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-2xl flex items-center justify-center mx-auto">
              🏷️
            </div>
            <div>
              <h3 className="text-lg font-black text-white">{activeVoucher.deal.business}</h3>
              <p className="text-xs text-blue-400 mt-0.5">{activeVoucher.deal.discount} Promo Voucher</p>
            </div>

            <div className="p-4 bg-[#070b14] border border-dashed border-blue-500/40 rounded-2xl">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-1">
                Show Counter-side
              </span>
              <span className="text-2xl font-mono font-black text-emerald-400 tracking-widest">
                {activeVoucher.code}
              </span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Present this code at {activeVoucher.deal.business} ({activeVoucher.deal.location}) during checkout to redeem your discount.
            </p>

            <div className="flex gap-2">
              <a
                href={`https://wa.me/${activeVoucher.deal.phone}?text=${encodeURIComponent(
                  `Vanakkam! I claimed voucher ${activeVoucher.code} for ${activeVoucher.deal.discount} at${activeVoucher.deal.business}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition"
              >
                Send to WhatsApp
              </a>
              <button
                onClick={() => setActiveVoucher(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating AI Assistant & Review Hub */}
      <div className="fixed bottom-6 right-6 z-40">
        {!isAiOpen && (
          <button
            onClick={() => setIsAiOpen(true)}
            className="flex items-center gap-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-3.5 rounded-full shadow-2xl shadow-blue-600/40 hover:scale-105 active:scale-95 transition"
          >
            <span className="text-base">✨</span>
            <span>AI Assistant & Reviews</span>
          </button>
        )}

        {isAiOpen && (
          <div className="bg-[#0d162a] border border-blue-900/40 w-[360px] sm:w-[390px] h-[520px] rounded-3xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
            {/* Assistant Header */}
            <div className="bg-[#090e1c] p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <div>
                  <h4 className="font-extrabold text-sm text-white">Local Deals Assistant</h4>
                  <p className="text-[10px] text-slate-400">Authoor & Thoothukudi Support</p>
                </div>
              </div>
              <button
                onClick={() => setIsAiOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Chat Body */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-2.5 text-xs">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-2xl max-w-[85%] leading-relaxed ${
                    m.role === "assistant"
                      ? "bg-[#141f38] text-slate-200 border border-slate-800 mr-auto"
                      : "bg-blue-600 text-white ml-auto"
                  }`}
                >
                  {m.text}
                </div>
              ))}

              {/* In-Chat Star Rating Widget */}
              {!reviewSent && (
                <div className="p-3.5 bg-[#090e1c] border border-slate-800 rounded-2xl space-y-2 mt-2">
                  <span className="text-[11px] font-bold text-slate-300 block">Rate a Local Store:</span>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setUserRating(star)}
                        className={`text-xl transition ${userRating >= star ? "text-amber-400" : "text-slate-700"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={submitReview}
                    className="w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition shadow-md"
                  >
                    Submit {userRating}-Star Review
                  </button>
                </div>
              )}
            </div>

            {/* Quick Prompt Chips */}
            <div className="p-2 border-t border-slate-800/80 bg-[#090e1c] flex gap-1.5 overflow-x-auto">
              <button
                onClick={() => handleSendAi("How do I use vouchers?")}
                className="text-[10px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full text-slate-300 transition"
              >
                🏷️️ How to redeem
              </button>
              <button
                onClick={() => handleSendAi("Tell me about VRC Electronics")}
                className="text-[10px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full text-slate-300 transition"
              >
                🏬 VRC Authoor
              </button>
              <button
                onClick={() => handleSendAi("How does GPS routing work?")}
                className="text-[10px] whitespace-nowrap bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-full text-slate-300 transition"
              >
                📍 GPS guide
              </button>
            </div>

            {/* Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAi();
              }}
              className="p-3 border-t border-slate-800 bg-[#070b14] flex gap-2"
            >
              <input
                type="text"
                placeholder="Ask about stores, distance, offers..."
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="flex-1 bg-[#0e1628] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-md shadow-blue-600/30"
              >
                Send
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}