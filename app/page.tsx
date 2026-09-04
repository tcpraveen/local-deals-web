'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Review {
  id: number;
  deal_id: number;
  reviewer_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface Deal {
  id: number;
  title: string;
  business: string;
  logo_url?: string;
  discount: string;
  original_price?: number;
  deal_price?: number;
  category: string;
  location?: string;
  phone?: string;
  expires_at?: string;
  opening_time?: string;
  closing_time?: string;
  image: string;
  description: string;
  views_count?: number;
  inquiries_count?: number;
  is_featured?: boolean;
  is_verified_merchant?: boolean;
  store_address?: string;
  google_maps_url?: string;
  lat?: number;
  lng?: number;
  rating?: number;
  review_count?: number;
}

const CATEGORIES = ['All', 'Fashion', 'Services', 'Venues', 'Food', 'Retail'];
const LOCATIONS = ['All', 'Main Bazaar', 'Anna Nagar', 'Beach Road', 'North Authoor', 'Bryant Nagar'];

function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

function DealsContent() {
  const searchParams = useSearchParams();
  const highlightedDealId = searchParams.get('deal');

  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [savedDealIds, setSavedDealIds] = useState<number[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // User Geolocation Coordinates
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoLocating, setGeoLocating] = useState(false);

  // Modals & Voucher State
  const [mapModalDeal, setMapModalDeal] = useState<Deal | null>(null);
  const [reviewModalDeal, setReviewModalDeal] = useState<Deal | null>(null);
  const [claimVoucherDeal, setClaimVoucherDeal] = useState<Deal | null>(null);
  const [generatedVoucher, setGeneratedVoucher] = useState<string>('');

  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewerName, setReviewerName] = useState('');
  const [ratingInput, setRatingInput] = useState(5);
  const [commentInput, setCommentInput] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchDeals();
    const saved = localStorage.getItem('local_deals_saved');
    if (saved) {
      try {
        setSavedDealIds(JSON.parse(saved));
      } catch (e) {}
    }
    const storedTheme = localStorage.getItem('local_deals_theme');
    if (storedTheme) {
      setIsDarkMode(storedTheme === 'dark');
    }
  }, []);

  useEffect(() => {
    if (highlightedDealId && !loading && deals.length > 0) {
      const el = document.getElementById(`deal-${highlightedDealId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightedDealId, loading, deals]);

  const toggleTheme = () => {
    const nextTheme = !isDarkMode;
    setIsDarkMode(nextTheme);
    localStorage.setItem('local_deals_theme', nextTheme ? 'dark' : 'light');
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortBy('near_me');
        setGeoLocating(false);
      },
      () => {
        alert('Location access was denied. Unable to calculate distance.');
        setGeoLocating(false);
      },
      { timeout: 10000 }
    );
  };

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

  const toggleSaveDeal = (id: number) => {
    const updated = savedDealIds.includes(id)
      ? savedDealIds.filter((item) => item !== id)
      : [...savedDealIds, id];
    setSavedDealIds(updated);
    localStorage.setItem('local_deals_saved', JSON.stringify(updated));
  };

  const handleClaimVoucher = async (deal: Deal) => {
    // Generate clean 6-digit redemption code
    const voucher = `${deal.id}${Math.floor(1000 + Math.random() * 9000)}`;
    setGeneratedVoucher(voucher);
    setClaimVoucherDeal(deal);

    try {
      await supabase.rpc('increment_inquiries', { deal_id: deal.id });
    } catch (e) {}

    // Send pre-filled claim request with voucher code to WhatsApp
    const cleanPhone = (deal.phone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const text = encodeURIComponent(
      `Hello ${deal.business}! I am claiming "${deal.title}" via Local Deals Hub.\nMy Voucher Code is: ${voucher}`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${text}`, '_blank');
  };

  const handleShareDeal = (deal: Deal) => {
    const shareUrl = `${window.location.origin}/?deal=${deal.id}`;
    if (navigator.share) {
      navigator
        .share({
          title: `${deal.business} - ${deal.title}`,
          text: `Check out this verified offer from ${deal.business}: ${deal.discount}!`,
          url: shareUrl,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Offer link copied to clipboard!');
    }
  };

  const getStoreStatus = (opening?: string, closing?: string) => {
    const op = opening || '09:00';
    const cl = closing || '21:30';
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [oH, oM] = op.split(':').map(Number);
    const [cH, cM] = cl.split(':').map(Number);
    const openMins = oH * 60 + (oM || 0);
    const closeMins = cH * 60 + (cM || 0);

    const isOpen = currentMins >= openMins && currentMins <= closeMins;
    return isOpen
      ? { label: '🟢 Open Now', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' }
      : { label: '🔴 Closed', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
  };

  const getExpiryStatus = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const now = new Date().getTime();
    const expiry = new Date(expiresAt).getTime();
    const diffHours = (expiry - now) / (1000 * 60 * 60);

    if (diffHours <= 0) return { label: 'Offer Expired', isExpired: true, color: 'bg-slate-700 text-slate-300' };
    if (diffHours <= 24) return { label: '⏳ Ends Today', isExpired: false, color: 'bg-amber-500/20 text-amber-300 border border-amber-500/40' };
    const diffDays = Math.ceil(diffHours / 24);
    if (diffDays <= 3) return { label: `⏳ ${diffDays}d left`, isExpired: false, color: 'bg-orange-500/20 text-orange-300 border border-orange-500/40' };
    return null;
  };

  const openReviews = async (deal: Deal) => {
    setReviewModalDeal(deal);
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('deal_reviews')
        .select('*')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviewsList(data || []);
    } catch (err: any) {
      console.error('Error fetching reviews:', err.message);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalDeal || !reviewerName.trim()) return;

    try {
      setSubmittingReview(true);
      const newReview = {
        deal_id: reviewModalDeal.id,
        reviewer_name: reviewerName.trim(),
        rating: ratingInput,
        comment: commentInput.trim(),
      };

      const { data, error } = await supabase
        .from('deal_reviews')
        .insert([newReview])
        .select()
        .single();

      if (error) throw error;

      setReviewsList([data, ...reviewsList]);
      setReviewerName('');
      setCommentInput('');
      setRatingInput(5);

      const allRatings = [data.rating, ...reviewsList.map((r) => r.rating)];
      const avg = allRatings.reduce((a, b) => a + b, 0) / allRatings.length;
      await supabase
        .from('deals')
        .update({ rating: parseFloat(avg.toFixed(1)), review_count: allRatings.length })
        .eq('id', reviewModalDeal.id);

      setDeals((prev) =>
        prev.map((d) =>
          d.id === reviewModalDeal.id
            ? { ...d, rating: parseFloat(avg.toFixed(1)), review_count: allRatings.length }
            : d
        )
      );
    } catch (err: any) {
      alert(`Error submitting review: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredDeals = useMemo(() => {
    return deals
      .filter((deal) => {
        if (showSavedOnly && !savedDealIds.includes(deal.id)) return false;
        const matchesCategory = selectedCategory === 'All' || deal.category === selectedCategory;
        const matchesLocation = selectedLocation === 'All' || deal.location === selectedLocation;
        const matchesVerified = !verifiedOnly || deal.is_verified_merchant;
        const matchesSearch =
          deal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.business.toLowerCase().includes(searchQuery.toLowerCase()) ||
          deal.description.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesLocation && matchesVerified && matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === 'near_me' && userCoords) {
          const distA = calculateHaversineDistance(userCoords.lat, userCoords.lng, a.lat || 8.81, a.lng || 78.14);
          const distB = calculateHaversineDistance(userCoords.lat, userCoords.lng, b.lat || 8.81, b.lng || 78.14);
          return distA - distB;
        }
        if (sortBy === 'price_low') return (Number(a.deal_price) || 0) - (Number(b.deal_price) || 0);
        if (sortBy === 'price_high') return (Number(b.deal_price) || 0) - (Number(a.deal_price) || 0);
        if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0);
        return 0;
      });
  }, [deals, searchQuery, selectedCategory, selectedLocation, verifiedOnly, showSavedOnly, savedDealIds, sortBy, userCoords]);

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 ${
      isDarkMode ? 'bg-[#070b14] text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Dynamic Header */}
      <header className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${
        isDarkMode ? 'border-slate-800/80 bg-[#0a101d]/90' : 'border-slate-200 bg-white/90 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="text-xl">🏷️</span>
            <span className={`text-sm sm:text-base font-bold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
              Local Deals Hub
            </span>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl border transition text-sm ${
                isDarkMode ? 'bg-slate-800 text-amber-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Toggle Light / Dark Mode"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>

            {/* Saved Items */}
            <button
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={`text-xs px-2.5 sm:px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition ${
                showSavedOnly
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                  : isDarkMode
                  ? 'bg-slate-800 text-slate-300 hover:text-white border-slate-700'
                  : 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span>❤️</span>
              <span className="font-semibold">{savedDealIds.length}</span>
            </button>

            {/* Merchant Portal Navigation */}
            <Link
              href="/merchant"
              className="text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-3.5 py-1.5 rounded-xl shadow-lg shadow-blue-500/20 transition flex items-center gap-1.5"
            >
              <span>🏬</span>
              <span>Merchant Portal</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="py-8 sm:py-12 text-center max-w-3xl mx-auto px-4 space-y-3">
        <div className="inline-block text-[11px] font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full uppercase tracking-wider">
          100% Genuine Local Offers
        </div>
        <h1 className={`text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight ${
          isDarkMode ? 'text-white' : 'text-slate-900'
        }`}>
          Discover Verified Local Discounts & Services
        </h1>
        <p className={`text-xs sm:text-sm max-w-xl mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          Shop directly from verified neighborhood businesses with interactive map directions and store billing.
        </p>

        {/* Search, GPS Sort & Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-2 pt-4 max-w-xl mx-auto">
          <input
            type="text"
            placeholder="Search deals, stores, or areas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`flex-1 border rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 ${
              isDarkMode
                ? 'bg-[#0e1626] border-slate-800 text-white placeholder-slate-500'
                : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />

          <div className="flex gap-2">
            {/* GPS Near Me Button */}
            <button
              onClick={handleGetLocation}
              disabled={geoLocating}
              className={`text-xs px-3 py-2.5 rounded-xl border font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${
                sortBy === 'near_me'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-md'
                  : isDarkMode
                  ? 'bg-[#0e1626] text-blue-400 border-slate-800 hover:border-slate-700'
                  : 'bg-white text-blue-600 border-slate-200 shadow-sm'
              }`}
            >
              <span>📍</span>
              <span>{geoLocating ? 'Locating...' : 'Near Me'}</span>
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={`flex-1 sm:flex-none border rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-blue-500 ${
                isDarkMode ? 'bg-[#0e1626] border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-800'
              }`}
            >
              <option value="latest">Sort: Latest Added</option>
              <option value="rating">Sort: Top Rated</option>
              <option value="price_low">Price (Low to High)</option>
              <option value="price_high">Price (High to Low)</option>
            </select>

            <button
              onClick={() => setVerifiedOnly(!verifiedOnly)}
              className={`text-xs px-3 py-2.5 rounded-xl border font-semibold transition whitespace-nowrap ${
                verifiedOnly
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-sm'
                  : isDarkMode
                  ? 'bg-[#0e1626] text-slate-400 border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
            >
              ✓ Verified
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow'
                  : isDarkMode
                  ? 'bg-slate-800/60 text-slate-400 hover:text-white'
                  : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Location Filter Row */}
        <div className={`flex flex-wrap items-center justify-center gap-1.5 text-xs pt-1 ${
          isDarkMode ? 'text-slate-400' : 'text-slate-600'
        }`}>
          <span className="opacity-60">Area:</span>
          {LOCATIONS.map((loc) => (
            <button
              key={loc}
              onClick={() => setSelectedLocation(loc)}
              className={`px-2.5 py-0.5 rounded transition ${
                selectedLocation === loc
                  ? isDarkMode
                    ? 'bg-slate-700 text-white font-semibold'
                    : 'bg-slate-300 text-slate-900 font-semibold'
                  : 'hover:opacity-100'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>
      </div>

      {/* Main Deals Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Loading verified local deals...</div>
        ) : filteredDeals.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-slate-400 text-sm">No promotions found matching your selected filters.</p>
            <button
              onClick={() => {
                setSelectedCategory('All');
                setSelectedLocation('All');
                setSearchQuery('');
                setVerifiedOnly(false);
                setShowSavedOnly(false);
                setUserCoords(null);
                setSortBy('latest');
                fetchDeals();
              }}
              className="text-xs bg-slate-800 text-blue-400 px-4 py-2 rounded-lg border border-slate-700 hover:bg-slate-700 transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeals.map((deal) => {
              const isSaved = savedDealIds.includes(deal.id);
              const isTargeted = String(deal.id) === highlightedDealId;
              const expiry = getExpiryStatus(deal.expires_at);
              const storeStatus = getStoreStatus(deal.opening_time, deal.closing_time);

              // Calculate Haversine Distance if user coords enabled
              const distanceKm = userCoords
                ? calculateHaversineDistance(userCoords.lat, userCoords.lng, deal.lat || 8.81, deal.lng || 78.14)
                : null;

              return (
                <div
                  id={`deal-${deal.id}`}
                  key={deal.id}
                  className={`rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between transition-all duration-300 border ${
                    isDarkMode ? 'bg-[#0e1626] border-slate-800' : 'bg-white border-slate-200'
                  } ${
                    isTargeted
                      ? 'border-blue-500 ring-4 ring-blue-500/20 scale-[1.01]'
                      : 'hover:border-slate-700'
                  }`}
                >
                  {/* Image Cover, Categories & Urgent Badges */}
                  <div className="relative h-48 w-full bg-slate-900">
                    <img src={deal.image} alt={deal.title} className="w-full h-full object-cover" />

                    <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                      <span className="bg-black/70 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-1 rounded-md">
                        {deal.category}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-md border ${storeStatus.color}`}>
                        {storeStatus.label}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      <span className="bg-rose-600 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-md shadow-md">
                        {deal.discount}
                      </span>
                      {expiry && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded shadow backdrop-blur-md ${expiry.color}`}>
                          {expiry.label}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => toggleSaveDeal(deal.id)}
                      className="absolute bottom-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white text-sm hover:scale-110 transition"
                    >
                      {isSaved ? '❤️' : '🤍'}
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-3 flex-1 flex flex-col justify-between">
                    <div className="space-y-2.5">
                      {/* Store Identity, Verified Badge & Live Map Trigger */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={deal.logo_url || 'https://cdn-icons-png.flaticon.com/512/869/869636.png'}
                            alt={deal.business}
                            className="w-7 h-7 rounded-full object-cover border border-slate-700/80 flex-shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-bold text-xs uppercase tracking-wide truncate ${
                                isDarkMode ? 'text-slate-200' : 'text-slate-800'
                              }`}>
                                {deal.business}
                              </span>
                              {deal.is_verified_merchant && (
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                                  ✓ Verified
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => setMapModalDeal(deal)}
                          className="flex-shrink-0 text-[11px] font-semibold text-sky-400 hover:text-white bg-sky-500/10 hover:bg-sky-500/25 border border-sky-500/25 px-2.5 py-1 rounded-lg transition-all flex items-center gap-1 whitespace-nowrap shadow-sm"
                        >
                          <span>📍</span>
                          <span>Map</span>
                        </button>
                      </div>

                      {/* Ratings & GPS Distance Distance Ticker */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => openReviews(deal)}
                          className="text-xs text-amber-400 font-semibold hover:underline flex items-center gap-1"
                        >
                          ⭐ {deal.rating || 5.0}{' '}
                          <span className={isDarkMode ? 'text-slate-500 font-normal' : 'text-slate-400 font-normal'}>
                            ({deal.review_count || 12} reviews)
                          </span>
                        </button>

                        {distanceKm !== null && (
                          <span className="text-[11px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                            📍 {distanceKm} km away
                          </span>
                        )}
                      </div>

                      <h3 className={`text-sm sm:text-base font-bold leading-snug ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                        {deal.title}
                      </h3>
                      <p className={`text-xs line-clamp-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                        {deal.description}
                      </p>
                    </div>

                    {/* Bottom Pricing & Action Controls */}
                    <div className={`pt-2 border-t space-y-2.5 ${isDarkMode ? 'border-slate-800/80' : 'border-slate-100'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-lg font-black text-emerald-500">
                            {deal.deal_price ? `₹${deal.deal_price}` : deal.discount}
                          </span>
                          {deal.original_price && (
                            <span className="text-xs text-slate-500 line-through">₹{deal.original_price}</span>
                          )}
                        </div>

                        {(deal.inquiries_count || 0) > 0 && (
                          <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                            🔥 {deal.inquiries_count} claimed
                          </span>
                        )}
                      </div>

                      {/* Store Address Trigger */}
                      {deal.store_address && (
                        <button
                          onClick={() => setMapModalDeal(deal)}
                          className={`text-[11px] flex items-center gap-1.5 truncate group text-left w-full transition ${
                            isDarkMode ? 'text-slate-400 hover:text-sky-300' : 'text-slate-600 hover:text-sky-600'
                          }`}
                        >
                          <span className="text-slate-500 group-hover:text-sky-400 transition">🏬</span>
                          <span className="truncate underline decoration-slate-700/60 group-hover:decoration-sky-400 underline-offset-2">
                            {deal.store_address}
                          </span>
                        </button>
                      )}

                      {/* Share, Phone Call & Direct WhatsApp Voucher Claim */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleShareDeal(deal)}
                          className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-center ${
                            isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                          title="Share Deal Link"
                        >
                          🔗
                        </button>

                        {deal.phone && (
                          <a
                            href={`tel:${deal.phone.replace(/[^0-9]/g, '')}`}
                            className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition flex items-center justify-center ${
                              isDarkMode ? 'bg-slate-800 hover:bg-emerald-600/20 text-emerald-400 border-slate-700' : 'bg-slate-100 hover:bg-emerald-50 text-emerald-600 border-slate-200'
                            }`}
                            title="Call Store Directly"
                          >
                            📞
                          </a>
                        )}

                        <button
                          disabled={expiry?.isExpired}
                          onClick={() => handleClaimVoucher(deal)}
                          className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 ${
                            expiry?.isExpired
                              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                          }`}
                        >
                          {expiry?.isExpired ? 'Offer Expired' : 'Claim Voucher →'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Voucher Confirmation Dialog */}
      {claimVoucherDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className={`border rounded-3xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4 ${
            isDarkMode ? 'bg-[#0e1626] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <span className="text-3xl">🎉</span>
            <h3 className="text-base font-extrabold">Voucher Generated!</h3>
            <p className="text-xs opacity-75">
              Present this code at {claimVoucherDeal.business} to redeem your special discount in-store:
            </p>

            <div className="p-4 bg-blue-600/10 border-2 border-dashed border-blue-500 rounded-2xl">
              <span className="text-2xl font-black tracking-widest text-blue-500 font-mono">
                {generatedVoucher}
              </span>
            </div>

            <p className="text-[11px] opacity-60">
              A pre-filled WhatsApp message has opened so the merchant has your record on file.
            </p>

            <button
              onClick={() => setClaimVoucherDeal(null)}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Interactive Map Modal */}
      {mapModalDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                📍 {mapModalDeal.business} Location
              </h3>
              <button onClick={() => setMapModalDeal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="h-56 w-full rounded-xl overflow-hidden border border-slate-800">
              <iframe
                title="Store Map"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(mapModalDeal.lng || 78.14) - 0.01}%2C${
                  (mapModalDeal.lat || 8.81) - 0.01
                }%2C${(mapModalDeal.lng || 78.14) + 0.01}%2C${
                  (mapModalDeal.lat || 8.81) + 0.01
                }&layer=mapnik&marker=${mapModalDeal.lat || 8.81}%2C${mapModalDeal.lng || 78.14}`}
              />
            </div>

            <p className="text-xs text-slate-400">
              {mapModalDeal.store_address || `${mapModalDeal.location}, Tamil Nadu`}
            </p>

            <a
              href={
                mapModalDeal.google_maps_url ||
                `https://maps.google.com/?q=${encodeURIComponent(
                  `${mapModalDeal.business} ${mapModalDeal.location || ''}`
                )}`
              }
              target="_blank"
              rel="noreferrer"
              className="block text-center py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl"
            >
              Open Route in Google Maps ↗
            </a>
          </div>
        </div>
      )}

      {/* Verified Reviews Modal */}
      {reviewModalDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h3 className="text-sm font-bold text-white">⭐ Customer Reviews</h3>
              <button onClick={() => setReviewModalDeal(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddReview} className="space-y-3 bg-[#080d16] p-3.5 rounded-xl border border-slate-800">
              <div className="text-xs font-semibold text-white">Add Your Verified Review</div>
              <input
                type="text"
                required
                placeholder="Your Name"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="w-full bg-[#0e1626] border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Rating:</span>
                <select
                  value={ratingInput}
                  onChange={(e) => setRatingInput(Number(e.target.value))}
                  className="bg-[#0e1626] border border-slate-800 rounded-lg p-1 text-xs text-amber-400"
                >
                  <option value={5}>⭐⭐⭐⭐⭐ (5/5)</option>
                  <option value={4}>⭐⭐⭐⭐ (4/5)</option>
                  <option value={3}>⭐⭐⭐ (3/5)</option>
                  <option value={2}>⭐⭐ (2/5)</option>
                  <option value={1}>⭐ (1/5)</option>
                </select>
              </div>
              <textarea
                rows={2}
                placeholder="Share your experience with this offer/store..."
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="w-full bg-[#0e1626] border border-slate-800 rounded-lg p-2 text-xs text-white"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
              >
                {submittingReview ? 'Submitting...' : 'Post Review'}
              </button>
            </form>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400">All Reviews ({reviewsList.length})</div>
              {reviewsLoading ? (
                <div className="text-xs text-slate-500 py-4 text-center">Loading reviews...</div>
              ) : reviewsList.length === 0 ? (
                <div className="text-xs text-slate-500 py-4 text-center">No reviews yet. Be the first to review!</div>
              ) : (
                reviewsList.map((rev) => (
                  <div key={rev.id} className="p-3 bg-[#080d16] border border-slate-800/80 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-white">{rev.reviewer_name}</span>
                      <span className="text-amber-400">{'⭐'.repeat(rev.rating)}</span>
                    </div>
                    {rev.comment && <p className="text-[11px] text-slate-300">{rev.comment}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#070b14] text-slate-500 p-8 text-center text-sm">Loading marketplace...</div>}>
      <DealsContent />
    </Suspense>
  );
}