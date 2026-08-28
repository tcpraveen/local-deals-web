'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface Deal {
  id?: string | number;
  title: string;
  business: string;
  discount: string;
  category: string;
  image: string;
  description: string;
  phone?: string;
  user_id?: string;
}

const CATEGORIES = ['All', 'Fashion', 'Services', 'Venues', 'Food', 'Retail'];

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Post Deal Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<Deal>({
    title: '',
    business: '',
    discount: '',
    category: 'Retail',
    image: '',
    description: '',
    phone: '',
  });

  // Track Auth State & Fetch Deals
  useEffect(() => {
    fetchDeals();

    // Check current auth session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // Listen for auth changes
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

  // Auth Handlers
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        alert('Registration successful! You can now log in or check your email for confirmation.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
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

  // Upload image to Supabase Storage
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

  // Create Deal (Authenticated)
  const handleCreateDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert('You must be logged in as a merchant to post a deal.');
      setIsAuthModalOpen(true);
      return;
    }

    if (!formData.title || !formData.business) {
      alert('Please fill out the deal title and business name.');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('deals').insert([
        {
          title: formData.title,
          business: formData.business,
          discount: formData.discount || 'Special Offer',
          category: formData.category,
          image: formData.image || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80',
          description: formData.description,
        },
      ]);

      if (error) throw error;

      setFormData({
        title: '',
        business: '',
        discount: '',
        category: 'Retail',
        image: '',
        description: '',
        phone: '',
      });
      setIsModalOpen(false);
      await fetchDeals();
    } catch (err: any) {
      alert(`Error saving deal: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter deals
  const filteredDeals = deals.filter((deal) => {
    const matchesCategory =
      selectedCategory === 'All' ||
      deal.category?.toLowerCase() === selectedCategory.toLowerCase();

    const matchesSearch =
      deal.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.business?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      deal.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 antialiased font-sans">
      {/* Navigation */}
      <header className="border-b border-slate-800/80 bg-[#0a101d]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight text-white">
            Local Deals Hub
          </span>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={() => setIsModalOpen(true)}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20">
            {user ? `Logged In as Merchant (${user.email})` : 'Supabase Authenticated'}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Discover Verified Local Discounts & Services
          </h1>
          <p className="text-slate-400 text-base sm:text-lg">
            Browse active promotions from top-rated neighborhood stores, studios, and venues.
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-xl mx-auto mb-8">
          <input
            type="text"
            placeholder="Search deals or store names..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0e1626] border border-slate-800 rounded-xl px-4 py-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-[#0f172a] text-slate-400 hover:text-white border border-slate-800/80 hover:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="text-center py-20 text-slate-500">Loading live deals...</div>
        ) : filteredDeals.length === 0 ? (
          <div className="text-center py-20 bg-[#0a101d] rounded-2xl border border-slate-800/60 p-8">
            <p className="text-slate-400 text-base">No deals found. Sign in as a merchant to publish new listings!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeals.map((deal) => (
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
                    <span className="absolute top-3 right-3 bg-red-500/90 text-white font-bold text-xs px-2.5 py-1 rounded-full shadow">
                      {deal.discount}
                    </span>
                    <span className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-slate-300 text-xs px-2.5 py-1 rounded-full border border-white/10">
                      {deal.category}
                    </span>
                  </div>

                  <div className="p-5">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">
                      {deal.business}
                    </span>
                    <h3 className="text-lg font-bold text-white mt-1 mb-2">
                      {deal.title}
                    </h3>
                    <p className="text-sm text-slate-400 line-clamp-2">
                      {deal.description || 'Visit store to claim this offer.'}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `Hi! I saw your deal "${deal.title}" on Local Deals Hub and would like to claim it.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center w-full bg-slate-800/80 hover:bg-emerald-600 text-slate-200 hover:text-white font-semibold text-sm py-2.5 rounded-xl transition"
                  >
                    Claim via WhatsApp →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Auth Modal (Sign In / Sign Up) */}
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

      {/* Post Deal Modal (Authenticated) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Post New Local Deal</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateDeal} className="space-y-4 text-sm">
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Discount Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. 30% OFF"
                    value={formData.discount}
                    onChange={(e) => setFormData({ ...formData, discount: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
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
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deal Image (File Upload)</label>
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
                  <p className="text-xs text-emerald-400 mt-1">Image uploaded successfully!</p>
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
                  {submitting ? 'Publishing...' : 'Publish Deal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}