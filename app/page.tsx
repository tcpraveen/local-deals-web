'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

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
  views_count?: number;
  inquiries_count?: number;
}

const CATEGORIES = ['All', 'Fashion', 'Services', 'Venues', 'Food', 'Retail'];
const LOCATIONS = ['All', 'Main Bazaar', 'Anna Nagar', 'Beach Road', 'North Authoor', 'Bryant Nagar'];
const SORT_OPTIONS = [
  { label: 'Latest Added', value: 'latest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Biggest Discount', value: 'discount' },
  { label: 'Ending Soon', value: 'expiry' },
];

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Post/Edit Deal Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Deal>>({
    title: '',
    business: '',
    discount: '',
    original_price: '',
    deal_price: '',
    category: 'Retail',
    location: 'Main Bazaar',
    phone: '',
    expires_at: '',
    image: '',
    description: '',
  });

  // Track Auth & Fetch Deals
  useEffect(() => {
    fetchDeals();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
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

  // Metrics Tracker Handler
  const trackInquiry = async (dealId: number) => {
    try {
      await supabase.rpc('increment_deal_metric', { deal_id: dealId, metric_type: 'inquiry' });
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, inquiries_count: (d.inquiries_count || 0) + 1 } : d))
      );
    } catch (e) {
      console.error('Inquiry increment failed', e);
    }
  };

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Registration successful! You can now log in.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      setIsAuthModalOpen(false);
      setEmail('');
      setPassword('');
    } catch (err: any) {
      alert(`Authentication error: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Image Upload Handler
  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('deal-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('deal-images')
        .getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, image: data.publicUrl }));
    } catch (err: any) {
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Price & Discount Calculator
  const handlePriceChange = (field: 'original_price' | 'deal_price', value: string) => {
    const updatedForm = { ...formData, [field]: value };
    const orig = parseFloat(String(field === 'original_price' ? value : formData.original_price));
    const deal = parseFloat(String(field === 'deal_price' ? value : formData.deal_price));

    if (orig > 0 && deal > 0 && orig > deal) {
      const discountPercent = Math.round(((orig - deal) / orig) * 100);
      updatedForm.discount = `${discountPercent}% OFF`;
    }

    setFormData(updatedForm);
  };

  // Create or Update Deal
  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('You must be logged in as a merchant.');
      setIsAuthModalOpen(true);
      return;
    }

    if (!formData.title || !formData.business) {
      alert('Please fill out the title and business name.');
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formData.title,
        business: formData.business,
        discount: formData.discount || 'Special Offer',
        original_price: formData.original_price ? Number(formData.original_price) : null,
        deal_price: formData.deal_price ? Number(formData.deal_price) : null,
        category: formData.category,
        location: formData.location || 'Main Bazaar',
        phone: formData.phone || '',
        expires_at: formData.expires_at || null,
        image: formData.image || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80',
        description: formData.description,
      };

      if (editingDealId) {
        const { error } = await supabase
          .from('deals')
          .update(payload)
          .eq('id', editingDealId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('deals')
          .insert([payload]);
        if (error) throw error;
      }

      setFormData({
        title: '',
        business: '',
        discount: '',
        original_price: '',
        deal_price: '',
        category: 'Retail',
        location: 'Main Bazaar',
        phone: '',
        expires_at: '',
        image: '',
        description: '',
      });
      setEditingDealId(null);
      setIsModalOpen(false);
      await fetchDeals();
    } catch (err: any) {
      alert(`Error saving deal: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Deal Handler
  const handleDeleteDeal = async (id: number) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;

    try {
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw error;
      await fetchDeals();
    } catch (err: any) {
      alert(`Error deleting deal: ${err.message}`);
    }
  };

  const openEditModal = (deal: Deal) => {
    setEditingDealId(deal.id);
    setFormData({
      title: deal.title,
      business: deal.business,
      discount: deal.discount,
      original_price: deal.original_price ?? '',
      deal_price: deal.deal_price ?? '',
      category: deal.category,
      location: deal.location || 'Main Bazaar',
      phone: deal.phone || '',
      expires_at: deal.expires_at || '',
      image: deal.image,
      description: deal.description,
    });
    setIsModalOpen(true);
  };

  // Calculate Urgency Badge
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

  // Filter & Sort Logic
  const filteredDeals = deals
    .filter((deal) => {
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
      if (sortBy === 'price_asc') {
        return (Number(a.deal_price) || 0) - (Number(b.deal_price) || 0);
      }
      if (sortBy === 'price_desc') {
        return (Number(b.deal_price) || 0) - (Number(a.deal_price) || 0);
      }
      if (sortBy === 'discount') {
        const getPct = (d: Deal) => {
          const num = parseInt(d.discount?.replace(/[^0-9]/g, '') || '0');
          return isNaN(num) ? 0 : num;
        };
        return getPct(b) - getPct(a);
      }
      if (sortBy === 'expiry') {
        if (!a.expires_at) return 1;
        if (!b.expires_at) return -1;
        return new Date(a.expires_at).getTime() - new Date(b.expires_at).getTime();
      }
      return 0; // Default latest order
    });

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 antialiased font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0a101d]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            Local Deals Hub
          </span>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => {
                    setEditingDealId(null);
                    setFormData({
                      title: '',
                      business: '',
                      discount: '',
                      original_price: '',
                      deal_price: '',
                      category: 'Retail',
                      location: 'Main Bazaar',
                      phone: '',
                      expires_at: '',
                      image: '',
                      description: '',
                    });
                    setIsModalOpen(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2 rounded-lg transition shadow-lg shadow-blue-500/20"
                >
                  + Post a Deal
                </button>
                <button
                  onClick={handleSignOut}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs px-3 py-2 rounded-lg transition"
                >
                  Log Out
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2 rounded-lg transition shadow-lg shadow-blue-500/20"
              >
                Merchant Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-8">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20">
            {user ? `Merchant Portal (${user.email})` : 'Live Local Marketplace'}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Discover Verified Local Discounts & Services
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">
            Browse active promotions from top-rated neighborhood stores, studios, and venues.
          </p>
        </div>

        {/* Search & Sort Row */}
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 mb-6">
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
        <div className="space-y-3 mb-8">
          {/* Categories */}
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

          {/* Locations */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs text-slate-500 self-center mr-1">Area:</span>
            {LOCATIONS.map((loc) => (
              <button
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                className={`px-3 py-1 rounded-md text-xs transition ${
                  selectedLocation === loc
                    ? 'bg-slate-700 text-white font-medium border border-slate-600'
                    : 'bg-transparent text-slate-400 hover:text-slate-300'
                }`}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading live deals...</div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-20 bg-[#0a101d] rounded-2xl border border-slate-800/60 p-8">
            <p className="text-slate-400 text-base">No deals found for this selection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeals.map((deal) => {
              const expiryBadge = getExpiryBadge(deal.expires_at);
              const cleanPhone = deal.phone?.replace(/[^0-9]/g, '') || '';
              const priceText = deal.deal_price ? ` at ₹${deal.deal_price}` : '';
              const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
                `Hi! I saw your deal "${deal.title}"${priceText} on Local Deals Hub and would like to claim it.`
              )}`;

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
                    </div>

                    <div className="p-5">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-blue-400 uppercase tracking-wider">
                          {deal.business}
                        </span>
                        {deal.location && (
                          <span className="text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded text-[11px]">
                            📍 {deal.location}
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-bold text-white mb-1">
                        {deal.title}
                      </h3>

                      {/* Pricing Display */}
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

                      <p className="text-sm text-slate-400 line-clamp-2 mb-3">
                        {deal.description || 'Visit store to claim this offer.'}
                      </p>

                      {/* Analytics Indicator (Visible to merchants) */}
                      {user && (
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 border-t border-slate-800/60 pt-2 mb-1">
                          <span>💬 {deal.inquiries_count || 0} Inquiries</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 pt-0 space-y-2">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackInquiry(deal.id)}
                      className="block text-center w-full bg-slate-800/80 hover:bg-emerald-600 text-slate-200 hover:text-white font-semibold text-sm py-2.5 rounded-xl transition"
                    >
                      Claim via WhatsApp →
                    </a>

                    {/* Merchant Controls */}
                    {user && (
                      <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                        <button
                          onClick={() => openEditModal(deal)}
                          className="flex-1 text-xs text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 py-1.5 rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteDeal(deal.id)}
                          className="flex-1 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 py-1.5 rounded-lg transition"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {isSignUp ? 'Merchant Registration' : 'Merchant Sign In'}
              </h2>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="store@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg transition"
              >
                {authLoading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-blue-400 hover:underline"
              >
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post / Edit Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editingDealId ? 'Edit Local Deal' : 'Post New Local Deal'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDeal} className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Deal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 30% Off Menswear"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Max Fashion"
                    value={formData.business}
                    onChange={(e) => setFormData({ ...formData, business: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Discount Tag (Auto/Custom)</label>
                  <input
                    type="text"
                    placeholder="e.g. 30% OFF"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Original & Deal Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1999"
                    value={formData.original_price}
                    onChange={(e) => handlePriceChange('original_price', e.target.value)}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Offer Price (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 1399"
                    value={formData.deal_price}
                    onChange={(e) => handlePriceChange('deal_price', e.target.value)}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Area / Location</label>
                  <select
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    {LOCATIONS.filter((l) => l !== 'All').map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    placeholder="e.g. 919876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Offer Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expires_at}
                    onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deal Image (Upload)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file);
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer bg-[#080d16] border border-slate-800 rounded-lg p-1.5"
                />
                {uploading && <p className="text-xs text-blue-400 mt-1">Uploading image...</p>}
                {formData.image && !uploading && (
                  <p className="text-xs text-emerald-400 mt-1">Image ready!</p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Describe your offer, terms, and conditions..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg"
                >
                  {submitting ? 'Saving...' : editingDealId ? 'Update Deal' : 'Publish Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}