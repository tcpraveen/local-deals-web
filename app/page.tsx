'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

interface Deal {
  id: number;
  title: string;
  business: string;
  discount: string;
  original_price?: number | string;
  deal_price?: number | string;
  category: string;
  location?: string;
  phone?: string;
  expires_at?: string;
  image: string;
  description: string;
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

interface Review {
  id: number;
  deal_id: number;
  author_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

const CATEGORIES = ['All', 'Fashion', 'Services', 'Venues', 'Food', 'Retail'];
const LOCATIONS = [
  { name: 'All', lat: 8.8053, lng: 78.145 },
  { name: 'Main Bazaar', lat: 8.81, lng: 78.14 },
  { name: 'Anna Nagar', lat: 8.812, lng: 78.132 },
  { name: 'Beach Road', lat: 8.818, lng: 78.147 },
  { name: 'North Authoor', lat: 8.8053, lng: 78.145 },
  { name: 'Bryant Nagar', lat: 8.799, lng: 78.135 },
];

const SORT_OPTIONS = [
  { label: 'Latest Added', value: 'latest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Biggest Discount', value: 'discount' },
  { label: 'Ending Soon', value: 'expiry' },
];

export default function ConsumerStorefront() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedDealIds, setSavedDealIds] = useState<number[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

  // Modals
  const [mapDeal, setMapDeal] = useState<Deal | null>(null);
  const [reviewDeal, setReviewDeal] = useState<Deal | null>(null);

  // Review System State
  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchDeals();

    try {
      const stored = localStorage.getItem('saved_deal_ids');
      if (stored) setSavedDealIds(JSON.parse(stored));
    } catch (e) {
      console.error(e);
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

  const toggleSaveDeal = (id: number) => {
    let next: number[];
    if (savedDealIds.includes(id)) {
      next = savedDealIds.filter((item) => item !== id);
    } else {
      next = [...savedDealIds, id];
    }
    setSavedDealIds(next);
    localStorage.setItem('saved_deal_ids', JSON.stringify(next));
  };

  const trackInquiry = async (dealId: number) => {
    try {
      await supabase.rpc('increment_deal_metric', { deal_id: dealId, metric_type: 'inquiry' });
    } catch (e) {
      console.error('Inquiry tracker error', e);
    }
  };

  const sanitizeWhatsAppNumber = (phoneStr?: string) => {
    if (!phoneStr) return '';
    let clean = phoneStr.replace(/[^0-9]/g, '');
    if (clean.length === 10) clean = `91${clean}`;
    return clean;
  };

  const openReviewsModal = async (deal: Deal) => {
    setReviewDeal(deal);
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('deal_id', deal.id)
      .order('created_at', { ascending: false });
    setReviewsList(data || []);
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewDeal || !reviewName.trim() || !reviewComment.trim()) return;

    try {
      setSubmittingReview(true);
      const newReview = {
        deal_id: reviewDeal.id,
        author_name: reviewName,
        rating: reviewRating,
        comment: reviewComment,
      };

      const { error } = await supabase.from('reviews').insert([newReview]);
      if (error) throw error;

      const { data: allReviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('deal_id', reviewDeal.id);

      if (allReviews && allReviews.length > 0) {
        const avg = (allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length).toFixed(1);
        await supabase
          .from('deals')
          .update({ rating: parseFloat(avg), review_count: allReviews.length })
          .eq('id', reviewDeal.id);
      }

      setReviewName('');
      setReviewComment('');
      await fetchDeals();
      await openReviewsModal(reviewDeal);
    } catch (err: any) {
      alert(`Error submitting feedback: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  const getExpiryBadge = (dateStr?: string) => {
    if (!dateStr) return null;
    const expiry = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Expired', color: 'bg-zinc-700 text-zinc-300' };
    if (diffDays === 0) return { text: 'Ends Today', color: 'bg-rose-600 text-white animate-pulse' };
    if (diffDays === 1) return { text: 'Ends Tomorrow', color: 'bg-amber-600 text-white' };
    return { text: `${diffDays} days left`, color: 'bg-amber-500/20 text-amber-300 border border-amber-500/30' };
  };

  const featuredDeals = deals.filter((d) => d.is_featured);

  const filteredDeals = deals
    .filter((deal) => {
      if (showSavedOnly && !savedDealIds.includes(deal.id)) return false;
      if (showVerifiedOnly && !deal.is_verified_merchant) return false;

      const matchesCategory =
        selectedCategory === 'All' ||
        deal.category?.toLowerCase() === selectedCategory.toLowerCase();

      const matchesLocation =
        selectedLocation === 'All' ||
        deal.location?.toLowerCase() === selectedLocation.toLowerCase();

      const matchesSearch =
        deal.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.business?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        deal.location?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesLocation && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === 'price_asc') return (Number(a.deal_price) || 0) - (Number(b.deal_price) || 0);
      if (sortBy === 'price_desc') return (Number(b.deal_price) || 0) - (Number(a.deal_price) || 0);
      if (sortBy === 'discount') {
        const getPct = (d: Deal) => parseInt(d.discount?.replace(/[^0-9]/g, '') || '0') || 0;
        return getPct(b) - getPct(a);
      }
      if (sortBy === 'expiry') {
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      }
      return 0;
    });

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 antialiased font-sans flex flex-col justify-between">
      {/* Shopper Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0a101d]/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              🏷️ Local Deals Hub
            </span>
            <button
              onClick={() => setShowSavedOnly(!showSavedOnly)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                showSavedOnly
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                  : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <span>{showSavedOnly ? '❤️' : '🤍'}</span>
              <span>Saved ({savedDealIds.length})</span>
            </button>
            <button
              onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                showVerifiedOnly
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              <span>✓</span>
              <span>Verified Only</span>
            </button>
          </div>

          <Link
            href="/merchant"
            className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm px-4 py-2 rounded-xl transition shadow-lg shadow-blue-500/20 flex items-center gap-1.5"
          >
            <span>🏬</span>
            <span>Merchant Portal →</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10 flex-1 w-full">
        {/* Featured Spotlight Carousel */}
        {featuredDeals.length > 0 && !showSavedOnly && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-2">
              ✨ Featured Spotlight Offers
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredDeals.slice(0, 2).map((deal) => (
                <div
                  key={`feat-${deal.id}`}
                  className="bg-gradient-to-r from-blue-950/40 via-[#0e1626] to-[#0e1626] border border-blue-500/30 rounded-2xl p-4 flex gap-4 items-center shadow-lg relative overflow-hidden"
                >
                  <img
                    src={deal.image}
                    alt={deal.title}
                    className="w-28 h-28 object-cover rounded-xl border border-slate-700 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded">
                        {deal.business}
                      </span>
                      {deal.is_verified_merchant && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                          ✓ Verified
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white truncate mt-1">{deal.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      {deal.deal_price && (
                        <span className="text-emerald-400 font-bold text-sm">₹{deal.deal_price}</span>
                      )}
                      <span className="text-xs text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded">
                        {deal.discount}
                      </span>
                    </div>
                  </div>
                  <a
                    href={`https://wa.me/${sanitizeWhatsAppNumber(deal.phone)}?text=${encodeURIComponent(
                      `Hi! I saw your Featured Deal "${deal.title}" on Local Deals Hub.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackInquiry(deal.id)}
                    className="self-center bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-md whitespace-nowrap"
                  >
                    Claim →
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20">
            100% Genuine Local Offers
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Discover Verified Local Discounts & Services
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">
            Shop directly from verified neighborhood businesses with interactive map directions and store billing.
          </p>
        </div>

        {/* Search & Sort Row */}
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search deals, stores, or areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-4 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-sm"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-[#0e1626] border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Category & Location Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                    : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-slate-500 self-center mr-1">Area:</span>
            {LOCATIONS.map((loc) => (
              <button
                key={loc.name}
                onClick={() => setSelectedLocation(loc.name)}
                className={`px-3 py-1 rounded-md text-xs transition ${
                  selectedLocation === loc.name
                    ? 'bg-slate-700 text-white font-medium border border-slate-600'
                    : 'bg-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                {loc.name}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading live deals...</div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-20 bg-[#0a101d] rounded-2xl border border-slate-800/60 p-8">
            <p className="text-slate-400 text-base">
              {showSavedOnly
                ? 'No saved deals yet. Click the heart icon on any card to save it.'
                : 'No deals found for this selection.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeals.map((deal) => {
              const expiryBadge = getExpiryBadge(deal.expires_at);
              const cleanPhone = sanitizeWhatsAppNumber(deal.phone);
              const priceText = deal.deal_price ? ` at ₹${deal.deal_price}` : '';
              const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                `Hi! I saw your deal "${deal.title}"${priceText} on Local Deals Hub and would like to claim it.`
              )}`;
              const isSaved = savedDealIds.includes(deal.id);

              return (
                <div
                  key={deal.id}
                  className="bg-[#0e1626] border border-slate-800 rounded-2xl overflow-hidden shadow-xl hover:border-slate-700 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="relative h-48 w-full bg-slate-900 overflow-hidden">
                      <img
                        src={deal.image}
                        alt={deal.title}
                        className="w-full h-full object-cover"
                      />
                      {deal.discount && (
                        <span className="absolute top-3 right-3 bg-red-500/90 text-white font-bold text-xs px-2.5 py-1 rounded-full shadow">
                          {deal.discount}
                        </span>
                      )}
                      <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-slate-300 text-xs px-2.5 py-1 rounded-full border border-white/10">
                        {deal.category}
                      </span>
                      {expiryBadge && (
                        <span
                          className={`absolute bottom-3 left-3 text-xs px-2.5 py-0.5 rounded-full font-semibold backdrop-blur-md ${expiryBadge.color}`}
                        >
                          {expiryBadge.text}
                        </span>
                      )}
                      <button
                        onClick={() => toggleSaveDeal(deal.id)}
                        className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-md p-2 rounded-full border border-white/10 text-sm transition"
                        title={isSaved ? 'Remove from saved' : 'Save deal'}
                      >
                        {isSaved ? '❤️' : '🤍'}
                      </button>
                    </div>

                    <div className="p-5">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-blue-400 uppercase tracking-wider">
                            {deal.business}
                          </span>
                          {deal.is_verified_merchant && (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                              ✓ Verified Store
                            </span>
                          )}
                        </div>
                        {deal.location && (
                          <span className="text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
                            📍 {deal.location}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs mb-1">
                        <button
                          onClick={() => openReviewsModal(deal)}
                          className="flex items-center gap-1 text-amber-400 hover:underline"
                        >
                          <span>★ {deal.rating || 4.8}</span>
                          <span className="text-slate-500 text-[11px]">
                            ({deal.review_count || 0} reviews)
                          </span>
                        </button>
                        <button
                          onClick={() => setMapDeal(deal)}
                          className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                        >
                          🗺️ Live Map
                        </button>
                      </div>

                      <h3 className="text-lg font-bold text-white mb-1">
                        {deal.title}
                      </h3>

                      {deal.deal_price && (
                        <div className="flex items-baseline gap-2 mb-2">
                          <span className="text-lg font-extrabold text-emerald-400">
                            ₹{deal.deal_price}
                          </span>
                          {deal.original_price && Number(deal.original_price) > Number(deal.deal_price) && (
                            <span className="text-xs text-slate-500 line-through">
                              ₹{deal.original_price}
                            </span>
                          )}
                        </div>
                      )}

                      <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                        {deal.description || 'Visit store to claim this offer.'}
                      </p>

                      {deal.store_address && (
                        <p className="text-[11px] text-slate-500 mb-2 truncate">
                          🏬 {deal.store_address}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-5 pt-0">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackInquiry(deal.id)}
                      className="block text-center w-full bg-slate-800/80 hover:bg-emerald-600 text-slate-200 hover:text-white font-semibold text-sm py-2.5 rounded-xl transition"
                    >
                      Claim via WhatsApp →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Reviews Modal */}
      {reviewDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white">
                  Customer Reviews — {reviewDeal.business}
                </h2>
                <p className="text-xs text-slate-400">{reviewDeal.title}</p>
              </div>
              <button onClick={() => setReviewDeal(null)} className="text-slate-400 hover:text-white text-xl">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddReview} className="space-y-3 bg-[#080d16] p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-300">Write a Verified Review</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Your Name"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  className="bg-[#0e1626] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="bg-[#0e1626] border border-slate-800 rounded-lg p-2 text-xs text-amber-400 focus:outline-none focus:border-blue-500"
                >
                  <option value={5}>★★★★★ (5 Stars)</option>
                  <option value={4}>★★★★☆ (4 Stars)</option>
                  <option value={3}>★★★☆☆ (3 Stars)</option>
                  <option value={2}>★★☆☆☆ (2 Stars)</option>
                  <option value={1}>★☆☆☆☆ (1 Star)</option>
                </select>
              </div>

              <textarea
                rows={2}
                required
                placeholder="Share your shopping experience..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="w-full bg-[#0e1626] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs rounded-lg transition"
              >
                {submittingReview ? 'Submitting...' : 'Post Customer Review'}
              </button>
            </form>

            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-slate-400">
                Verified Feedback ({reviewsList.length})
              </h4>
              {reviewsList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-3 text-center">
                  No reviews yet. Be the first to leave feedback!
                </p>
              ) : (
                reviewsList.map((r) => (
                  <div key={r.id} className="p-3 bg-[#080d16] border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{r.author_name}</span>
                      <span className="text-amber-400">{'★'.repeat(r.rating)}</span>
                    </div>
                    <p className="text-xs text-slate-400">{r.comment}</p>
                    <span className="text-[10px] text-slate-600 block">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Map Modal */}
      {mapDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  📍 {mapDeal.business}
                </h2>
                <p className="text-xs text-slate-400">{mapDeal.store_address || mapDeal.location || 'Local Business'}</p>
              </div>
              <button onClick={() => setMapDeal(null)} className="text-slate-400 hover:text-white text-xl p-1">
                ✕
              </button>
            </div>

            <div className="w-full h-72 rounded-xl overflow-hidden border border-slate-800 bg-slate-900 relative">
              <iframe
                title="Store Map"
                width="100%"
                height="100%"
                loading="lazy"
                className="border-0 w-full h-full"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${(mapDeal.lng || 78.145) - 0.01}%2C${(mapDeal.lat || 8.8053) - 0.01}%2C${(mapDeal.lng || 78.145) + 0.01}%2C${(mapDeal.lat || 8.8053) + 0.01}&layer=mapnik&marker=${mapDeal.lat || 8.8053}%2C${mapDeal.lng || 78.145}`}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-slate-400">
                Offer: <span className="text-emerald-400 font-bold">₹{mapDeal.deal_price || mapDeal.discount}</span>
              </div>
              <a
                href={
                  mapDeal.google_maps_url ||
                  `https://www.google.com/maps/search/?api=1&query=${mapDeal.lat || 8.8053},${mapDeal.lng || 78.145}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg transition"
              >
                Get Google Maps Directions →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#060910] py-8 text-center text-xs text-slate-500 space-y-2">
        <div>© 2026 Local Deals Hub — Connecting Neighborhood Shoppers & Stores</div>
        <div>
          Are you a business owner?{' '}
          <Link href="/merchant" className="text-blue-400 hover:underline font-semibold">
            Partner with us & list your deals →
          </Link>
        </div>
      </footer>
    </div>
  );
}