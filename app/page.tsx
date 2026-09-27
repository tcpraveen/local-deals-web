'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MapPin, 
  Navigation, 
  Phone, 
  Clock, 
  Tag, 
  Search, 
  MessageSquare, 
  ExternalLink 
} from 'lucide-react';
import { calculateDistanceKm, formatDistance, Coordinates } from '@/lib/geo';

interface Deal {
  id: string;
  shop_name: string;
  category: string;
  area: string;
  title: string;
  discount_badge: string;
  original_price: number;
  discount_price: number;
  open_time: string; // "09:00"
  close_time: string; // "21:00"
  valid_until: string; // ISO date string
  phone: string; // Without plus sign, e.g. "919876543210"
  lat: number;
  lng: number;
  image_url: string;
}

// Sample dataset with local coordinates
const INITIAL_DEALS: Deal[] = [
  {
    id: '1',
    shop_name: 'Metro Footwear',
    category: 'Fashion',
    area: 'Main Bazaar',
    title: 'Flat 30% Off All Casual & Formal Shoes',
    discount_badge: '30% OFF',
    original_price: 1499,
    discount_price: 1049,
    open_time: '09:30',
    close_time: '21:30',
    valid_until: '2026-10-31',
    phone: '919876543210',
    lat: 8.8052,
    lng: 78.1450,
    image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: '2',
    shop_name: 'Apex Electronics & Service',
    category: 'Services',
    area: 'Anna Nagar',
    title: 'Comprehensive AC Deep Cleaning & Gas Check',
    discount_badge: '35% OFF',
    original_price: 1200,
    discount_price: 780,
    open_time: '09:00',
    close_time: '20:00',
    valid_until: '2026-09-30',
    phone: '919876543211',
    lat: 8.8120,
    lng: 78.1520,
    image_url: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80'
  },
  {
    id: '3',
    shop_name: 'Boutique Trends',
    category: 'Fashion',
    area: 'Beach Road',
    title: 'Exclusive Festive Saree & Kurti Sets',
    discount_badge: '25% OFF',
    original_price: 2500,
    discount_price: 1875,
    open_time: '10:00',
    close_time: '22:00',
    valid_until: '2026-09-15', // Expired check
    phone: '919876543212',
    lat: 8.7980,
    lng: 78.1610,
    image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=600&auto=format&fit=crop&q=80'
  }
];

export default function HyperlocalDealsHub() {
  const [deals] = useState<Deal[]>(INITIAL_DEALS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRadiusKm, setSelectedRadiusKm] = useState<number | null>(null);

  // User Geolocation state
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Load saved location on mount
  useEffect(() => {
    const cached = localStorage.getItem('ldh_user_coords');
    if (cached) {
      try {
        setUserLocation(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem('ldh_user_coords');
      }
    }
  }, []);

  // Geolocation trigger
  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocationError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setUserLocation(coords);
        localStorage.setItem('ldh_user_coords', JSON.stringify(coords));
        setLocating(false);
      },
      (err) => {
        setLocationError('Unable to retrieve location. Please check browser permissions.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // Helper: Shop Open status calculation
  const isShopOpen = (openStr: string, closeStr: string) => {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [openH, openM] = openStr.split(':').map(Number);
    const [closeH, closeM] = closeStr.split(':').map(Number);

    const openMins = openH * 60 + openM;
    const closeMins = closeH * 60 + closeM;

    return currentMins >= openMins && currentMins < closeMins;
  };

  // Helper: Deal Expiration calculation
  const isDealExpired = (validUntil: string) => {
    return new Date(validUntil).getTime() < new Date().setHours(0, 0, 0, 0);
  };

  // Process and sort deals
  const processedDeals = useMemo(() => {
    return deals
      .map((deal) => {
        let distanceKm: number | null = null;
        if (userLocation) {
          distanceKm = calculateDistanceKm(userLocation, { lat: deal.lat, lng: deal.lng });
        }
        return {
          ...deal,
          distanceKm,
          isOpen: isShopOpen(deal.open_time, deal.close_time),
          isExpired: isDealExpired(deal.valid_until),
        };
      })
      .filter((deal) => {
        // Search filter
        const matchesSearch = 
          deal.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.area.toLowerCase().includes(searchQuery.toLowerCase());

        // Category filter
        const matchesCategory = selectedCategory === 'All' || deal.category === selectedCategory;

        // Distance Radius filter
        const matchesRadius = selectedRadiusKm === null || (deal.distanceKm !== null && deal.distanceKm <= selectedRadiusKm);

        return matchesSearch && matchesCategory && matchesRadius;
      })
      .sort((a, b) => {
        // Sort closest first if distance exists
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        return 0;
      });
  }, [deals, userLocation, searchQuery, selectedCategory, selectedRadiusKm]);

  // Voucher claim action (Generates LDH voucher and opens WhatsApp)
  const handleClaimVoucher = (deal: typeof processedDeals[0]) => {
    if (deal.isExpired) return;

    const voucherCode = `LDH-${Math.floor(1000 + Math.random() * 9000)}`;
    const text = encodeURIComponent(
      `Hello ${deal.shop_name}! I would like to claim the offer: "${deal.title}" via Local Deals Hub.\n\nVoucher Code: *${voucherCode}*\nStore: ${deal.area}`
    );
    window.open(`https://wa.me/${deal.phone}?text=${text}`, '_blank');
  };

  const categories = ['All', 'Fashion', 'Services', 'Dining', 'Retail'];

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 pb-20">
      {/* Top Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-extrabold tracking-tight text-white">
              Local<span className="text-emerald-400">Deals</span>Hub
            </span>
          </div>

          <div className="flex items-center gap-3">
            {userLocation ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                GPS Active
              </span>
            ) : (
              <button
                onClick={requestLocation}
                disabled={locating}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition"
              >
                <Navigation className="w-3.5 h-3.5 text-emerald-400" />
                {locating ? 'Locating...' : 'Enable Exact Distance'}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Control Bar: Search, Category Chips & Distance Radii */}
      <section className="max-w-6xl mx-auto px-4 pt-6 space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-3 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search stores, offers, or neighborhoods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 transition"
          />
        </div>

        {/* Filter Rows */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-white text-black font-semibold'
                    : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Radius Chips (Active only when location is detected) */}
          {userLocation && (
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <span className="text-xs text-zinc-500 mr-1">Radius:</span>
              {[
                { label: 'All', value: null },
                { label: '< 2 km', value: 2 },
                { label: '< 5 km', value: 5 },
                { label: '< 10 km', value: 10 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => setSelectedRadiusKm(chip.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                    selectedRadiusKm === chip.value
                      ? 'bg-emerald-500 text-black font-semibold'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {locationError && (
          <p className="text-xs text-amber-400/90">{locationError}</p>
        )}
      </section>

      {/* Deals Listing Grid */}
      <section className="max-w-6xl mx-auto px-4 mt-6">
        {processedDeals.length === 0 ? (
          <div className="text-center py-20 bg-zinc-900/40 rounded-2xl border border-zinc-900">
            <Tag className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm text-zinc-400">No matching deals found within this radius or category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedDeals.map((deal) => (
              <article
                key={deal.id}
                className="group flex flex-col justify-between rounded-2xl bg-zinc-900/70 border border-zinc-800/80 overflow-hidden hover:border-zinc-700 transition"
              >
                {/* Visual Header with Badges */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-800">
                  <img
                    src={deal.image_url}
                    alt={deal.shop_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />

                  {/* Primary Discount Tag */}
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-black tracking-wide bg-red-600 text-white shadow-md">
                    {deal.discount_badge}
                  </span>

                  {/* Operational Status Badges */}
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    {/* Expiry Badge */}
                    {deal.isExpired ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-950/80 text-red-300 border border-red-800 backdrop-blur-md">
                        Offer Ended
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800 backdrop-blur-md">
                        ⚡ Active Offer
                      </span>
                    )}

                    {/* Shop Operating Hours Badge */}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-black/60 text-zinc-300 backdrop-blur-md border border-zinc-700/50">
                      <span className={`w-1.5 h-1.5 rounded-full ${deal.isOpen ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                      {deal.isOpen ? 'Shop Open' : 'Closed'}
                    </span>
                  </div>
                </div>

                {/* Content Details */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                      <span className="font-semibold text-emerald-400">{deal.category}</span>
                      {deal.distanceKm !== null && (
                        <span className="font-medium text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded">
                          {formatDistance(deal.distanceKm)}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-white text-base leading-snug mb-1">
                      {deal.title}
                    </h3>
                    
                    <p className="text-xs text-zinc-400 flex items-center gap-1 mb-3">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      {deal.shop_name} • {deal.area}
                    </p>
                  </div>

                  {/* Pricing and Operating Meta */}
                  <div className="pt-3 border-t border-zinc-800/80">
                    <div className="flex items-baseline gap-2 mb-3">
                      <span className="text-lg font-bold text-white">₹{deal.discount_price}</span>
                      <span className="text-xs text-zinc-500 line-through">₹{deal.original_price}</span>
                    </div>

                    {/* Conversion Action Bar */}
                    <div className="grid grid-cols-5 gap-2">
                      {/* WhatsApp Voucher Button */}
                      <button
                        onClick={() => handleClaimVoucher(deal)}
                        disabled={deal.isExpired}
                        className={`col-span-4 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-semibold text-xs transition ${
                          deal.isExpired
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-950/40'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {deal.isExpired ? 'Offer Expired' : 'Claim Voucher'}
                      </button>

                      {/* Map Navigation Link */}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${deal.lat},${deal.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="col-span-1 flex items-center justify-center rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/50 transition"
                        title="Get Directions"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}