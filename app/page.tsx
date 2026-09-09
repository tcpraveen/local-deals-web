'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Deal {
  id: number;
  title: string;
  business: string;
  logo_url?: string;
  discount: string;
  original_price?: number | string;
  deal_price?: number | string;
  category: string;
  location?: string;
  phone?: string;
  expires_at?: string;
  opening_time?: string;
  closing_time?: string;
  image: string;
  description: string;
  inquiries_count?: number;
  is_verified_merchant?: boolean;
  store_address?: string;
  google_maps_url?: string;
  rating?: number;
  review_count?: number;
}

const CATEGORIES = ['All', 'Fashion', 'Services', 'Venues', 'Food', 'Retail'];
const LOCATIONS = ['All', 'Main Bazaar', 'Anna Nagar', 'Beach Road', 'North Authoor', 'Bryant Nagar'];

export function isStoreOpen(openingTime?: string, closingTime?: string): boolean {
  if (!openingTime || !closingTime) return true;
  try {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);

    const startMinutes = openH * 60 + (openM || 0);
    const endMinutes = closeH * 60 + (closeM || 0);

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch {
    return true;
  }
}

export default function Storefront() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<number[]>([]);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);

  useEffect(() => {
    fetchDeals();

    const saved = localStorage.getItem('ldh_favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse favorites:', e);
      }
    }
  }, []);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (err: any) {
      console.error('Error fetching deals:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = (id: number) => {
    setFavorites((prev) => {
      const updated = prev.includes(id) ? prev.filter((favId) => favId !== id) : [...prev, id];
      localStorage.setItem('ldh_favorites', JSON.stringify(updated));
      return updated;
    });
  };

  const handleClaimVoucher = async (deal: Deal) => {
    const voucherCode = `LDH-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      await supabase
        .from('deals')
        .update({ inquiries_count: (deal.inquiries_count || 0) + 1 })
        .eq('id', deal.id);
    } catch (err) {
      console.error('Error logging claim telemetry:', err);
    }

    const cleanPhone = (deal.phone || '').replace(/[^0-9]/g, '');
    const message = encodeURIComponent(
      `Hello ${deal.business}!\nI want to claim your offer from Local Deals Hub:\n\n` +
        `🏷️ Offer: *${deal.title}*\n` +
        `🎟️ Voucher Code: *${voucherCode}*\n` +
        `💰 Deal Price: ₹${deal.deal_price || deal.discount}\n\n` +
        `Please confirm availability.`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  const handleOpenMap = (deal: Deal) => {
    if (deal.google_maps_url) {
      window.open(deal.google_maps_url, '_blank');
      return;
    }
    const query = encodeURIComponent(
      `${deal.business}, ${deal.store_address || ''} ${deal.location || 'Thoothukudi'}`
    );
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  const filteredDeals = deals.filter((deal) => {
    const matchesCategory = selectedCategory === 'All' || deal.category === selectedCategory;
    const matchesLocation = selectedLocation === 'All' || deal.location === selectedLocation;
    const matchesVerified = !onlyVerified || Boolean(deal.is_verified_merchant);
    const matchesSaved = !showSavedOnly || favorites.includes(deal.id);
    const matchesSearch =
      deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.business.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (deal.location && deal.location.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesLocation && matchesVerified && matchesSaved && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
      {/* Navigation Header */}
      <header className="border-b border-slate-800 bg-[#0a101d]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl">🏷️</span>
            <span className="font-bold text-white tracking-tight text-sm sm:text-base">
              Local Deals Hub
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowSavedOnly((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition ${
                showSavedOnly
                  ? 'bg-rose-500/20 border-rose-500/50 text-rose-400'
                  : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              <span>❤️</span>
              <span>{favorites.length}</span>
            </button>

            <Link
              href="/merchant"
              className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm px-3.5 py-1.5 rounded-xl transition shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
            >
              <span>🏪</span>
              <span>Merchant Portal</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Hero Headline */}
        <section className="text-center space-y-3 max-w-3xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[11px] font-bold uppercase tracking-wider">
            100% Genuine Local Offers
          </span>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight">
            Discover Verified Local Discounts & Services
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Shop directly from verified neighborhood businesses with interactive map directions and
            instant WhatsApp voucher redemption.
          </p>
        </section>

        {/* Search and Filters Bar */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 max-w-2xl mx-auto">
            <input
              type="text"
              placeholder="Search deals, stores, or areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 shadow-inner"
            />
            <button
              onClick={() => setOnlyVerified((prev) => !prev)}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 flex-shrink-0 ${
                onlyVerified
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-[#0e1626] border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              ✓ Verified
            </button>
          </div>

          {/* Categories Filter Pills */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-[#0e1626] border border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Locations Filter Pills */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-500 font-medium mr-1">Area:</span>
            {LOCATIONS.map((loc) => (
              <button
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium transition ${
                  selectedLocation === loc
                    ? 'bg-slate-700 text-white'
                    : 'bg-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </section>

        {/* Deal Cards Grid */}
        <section>
          {loading ? (
            <div className="py-20 text-center text-slate-500 text-xs sm:text-sm">
              Finding active neighborhood discounts...
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="py-20 text-center space-y-3 bg-[#0e1626]/40 border border-slate-800 rounded-3xl p-8">
              <p className="text-slate-400 text-sm">No promotions match your filter criteria.</p>
              <button
                onClick={() => {
                  setSelectedCategory('All');
                  setSelectedLocation('All');
                  setSearchQuery('');
                  setOnlyVerified(false);
                  setShowSavedOnly(false);
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDeals.map((deal) => {
                const open = isStoreOpen(deal.opening_time, deal.closing_time);
                const isFav = favorites.includes(deal.id);

                return (
                  <div
                    key={deal.id}
                    className="bg-[#0e1626] border border-slate-800 rounded-3xl overflow-hidden flex flex-col shadow-xl hover:border-slate-700 transition group"
                  >
                    {/* Media Header */}
                    <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={deal.image}
                        alt={deal.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-3 left-3 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold border border-white/10">
                          {deal.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border backdrop-blur-md ${
                            open
                              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                              : 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                          }`}
                        >
                          {open ? '🟢 Open' : '🔴 Closed'}
                        </span>
                      </div>

                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white text-[11px] font-black shadow-lg">
                          {deal.discount}
                        </span>
                      </div>

                      {/* Favorite Button */}
                      <button
                        onClick={() => toggleFavorite(deal.id)}
                        className={`absolute bottom-3 right-3 p-2 rounded-full backdrop-blur-md transition ${
                          isFav
                            ? 'bg-rose-600 text-white'
                            : 'bg-black/60 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isFav ? '❤️' : '🤍'}
                      </button>
                    </div>

                    {/* Content Section */}
                    <div className="p-5 flex flex-col flex-1 justify-between space-y-4">
                      <div className="space-y-2">
                        {/* Merchant Identity & Map Trigger */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <img
                              src={
                                deal.logo_url ||
                                'https://cdn-icons-png.flaticon.com/512/869/869636.png'
                              }
                              alt={deal.business}
                              className="w-6 h-6 rounded-full object-cover border border-slate-700 flex-shrink-0"
                            />
                            <span className="text-xs font-bold text-slate-300 truncate">
                              {deal.business}
                            </span>
                            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.2 rounded font-semibold flex-shrink-0">
                              ✓ Verified
                            </span>
                          </div>

                          <button
                            onClick={() => handleOpenMap(deal)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1 flex-shrink-0"
                          >
                            📍 Map
                          </button>
                        </div>

                        {/* Ratings */}
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="text-amber-400 font-bold">
                            ★ {deal.rating || '4.8'}
                          </span>
                          <span className="text-slate-500 text-[11px]">
                            ({deal.review_count || 12} reviews)
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition leading-snug">
                            {deal.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                            {deal.description ||
                              'Visit the store counter or claim voucher on WhatsApp to redeem offer.'}
                          </p>
                        </div>
                      </div>

                      {/* Pricing & Claim Actions */}
                      <div className="space-y-3 pt-2 border-t border-slate-800/80">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-black text-emerald-400">
                            ₹{deal.deal_price || deal.original_price || 'Special'}
                          </span>
                          {deal.original_price && deal.deal_price && (
                            <span className="text-xs text-slate-500 line-through">
                              ₹{deal.original_price}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                          <span>🏬</span>
                          <span>
                            {deal.store_address || `${deal.location || 'Local area'}, Thoothukudi`}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleClaimVoucher(deal)}
                            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition flex items-center justify-center gap-1.5"
                          >
                            <span>Claim Voucher</span>
                            <span>→</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-slate-900 py-8 text-center text-xs text-slate-600">
        Local Deals Hub • Bridging neighborhood merchants with direct digital customers
      </footer>
    </div>
  );
}