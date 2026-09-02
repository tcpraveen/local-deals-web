'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import QRCode from 'react-qr-code';

interface Deal {
  id: number;
  user_id?: string;
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

const CATEGORIES = ['Fashion', 'Services', 'Venues', 'Food', 'Retail'];
const LOCATIONS = [
  { name: 'Main Bazaar', lat: 8.81, lng: 78.14 },
  { name: 'Anna Nagar', lat: 8.812, lng: 78.132 },
  { name: 'Beach Road', lat: 8.818, lng: 78.147 },
  { name: 'North Authoor', lat: 8.8053, lng: 78.145 },
  { name: 'Bryant Nagar', lat: 8.799, lng: 78.135 },
];

export default function MerchantPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qrDeal, setQrDeal] = useState<Deal | null>(null);

  const [formData, setFormData] = useState<Partial<Deal>>({
    title: '',
    business: '',
    logo_url: 'https://cdn-icons-png.flaticon.com/512/869/869636.png',
    discount: '',
    original_price: '',
    deal_price: '',
    category: 'Retail',
    location: 'Main Bazaar',
    phone: '',
    expires_at: '',
    image: '',
    description: '',
    is_featured: false,
    store_address: '',
    google_maps_url: '',
    lat: 8.8053,
    lng: 78.145,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMyDeals(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchMyDeals(session.user.id);
      else {
        setMyDeals([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMyDeals = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('deals')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMyDeals(data || []);
    } catch (err: any) {
      console.error('Error fetching merchant deals:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Registration complete! Please sign in with your credentials.');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      alert(`Authentication failed: ${err.message}`);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Auto-clean & format merchant phone numbers
  const handlePhoneBlur = () => {
    let clean = (formData.phone || '').replace(/[^0-9]/g, '');
    if (clean.startsWith('91') && clean.length === 12) {
      clean = clean.substring(2);
    }
    if (clean.startsWith('0') && clean.length === 11) {
      clean = clean.substring(1);
    }
    setFormData((prev) => ({ ...prev, phone: clean }));
  };

  const handleImageUpload = async (file: File, type: 'deal' | 'logo') => {
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit.');
      return;
    }

    try {
      if (type === 'deal') setUploading(true);
      else setLogoUploading(true);

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

      if (type === 'deal') {
        setFormData((prev) => ({ ...prev, image: data.publicUrl }));
      } else {
        setFormData((prev) => ({ ...prev, logo_url: data.publicUrl }));
      }
    } catch (err: any) {
      alert(`Upload error: ${err.message}`);
    } finally {
      if (type === 'deal') setUploading(false);
      else setLogoUploading(false);
    }
  };

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

  const handleLocationChange = (locName: string) => {
    const found = LOCATIONS.find((l) => l.name === locName);
    setFormData((prev) => ({
      ...prev,
      location: locName,
      lat: found?.lat || 8.8053,
      lng: found?.lng || 78.145,
    }));
  };

  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.title || !formData.business) {
      alert('Title and Business name are required.');
      return;
    }

    try {
      setSubmitting(true);
      const cleanPhone = (formData.phone || '').replace(/[^0-9]/g, '');

      const payload: any = {
        title: formData.title,
        business: formData.business,
        logo_url: formData.logo_url || 'https://cdn-icons-png.flaticon.com/512/869/869636.png',
        discount: formData.discount || 'Special Offer',
        original_price: formData.original_price ? Number(formData.original_price) : null,
        deal_price: formData.deal_price ? Number(formData.deal_price) : null,
        category: formData.category,
        location: formData.location || 'Main Bazaar',
        phone: cleanPhone,
        expires_at: formData.expires_at || null,
        is_featured: Boolean(formData.is_featured),
        store_address: formData.store_address || '',
        google_maps_url: formData.google_maps_url || '',
        lat: formData.lat || 8.8053,
        lng: formData.lng || 78.145,
        image: formData.image || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80',
        description: formData.description,
        user_id: user.id,
      };

      if (editingDealId) {
        const { error } = await supabase.from('deals').update(payload).eq('id', editingDealId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('deals').insert([payload]);
        if (error) throw error;
      }

      setIsModalOpen(false);
      setEditingDealId(null);
      await fetchMyDeals(user.id);
    } catch (err: any) {
      alert(`Error saving offer: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDeal = async (id: number) => {
    if (!confirm('Are you sure you want to remove this active deal?')) return;
    try {
      const { error } = await supabase.from('deals').delete().eq('id', id);
      if (error) throw error;
      if (user) await fetchMyDeals(user.id);
    } catch (err: any) {
      alert(`Deletion error: ${err.message}`);
    }
  };

  const openEdit = (deal: Deal) => {
    setEditingDealId(deal.id);
    setFormData({ ...deal });
    setIsModalOpen(true);
  };

  const totalInquiries = myDeals.reduce((sum, d) => sum + (d.inquiries_count || 0), 0);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between">
        <header className="border-b border-slate-800 bg-[#0a101d]/80 px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link href="/" className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-white flex items-center gap-1.5">
            ← Storefront
          </Link>
          <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full font-bold">
            Merchant Center
          </span>
        </header>

        <div className="max-w-md w-full mx-auto p-4 sm:p-6 my-auto">
          <div className="bg-[#0e1626] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <span className="text-3xl">🏬</span>
              <h1 className="text-xl sm:text-2xl font-bold text-white">Merchant Partner Sign In</h1>
              <p className="text-xs text-slate-400">
                Publish promotions, generate branded QR counter stands, and track WhatsApp leads.
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block text-slate-400 mb-1">Business Email</label>
                <input
                  type="email"
                  required
                  placeholder="store@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
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
                  className="w-full bg-[#080d16] border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-500/25"
              >
                {authLoading ? 'Verifying...' : isSignUp ? 'Register Business Account' : 'Access Merchant Workspace'}
              </button>
            </form>

            <div className="text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-blue-400 hover:underline"
              >
                {isSignUp ? 'Already registered? Sign In' : 'New store owner? Create merchant account'}
              </button>
            </div>
          </div>
        </div>

        <footer className="text-center py-6 text-xs text-slate-600 border-t border-slate-900">
          Local Deals Hub Partner Infrastructure
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans antialiased">
      <header className="border-b border-slate-800 bg-[#0a101d] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-0 sm:h-16 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
              🏬 Merchant Central
            </span>
            <Link
              href="/"
              className="sm:hidden text-[11px] text-slate-400 hover:text-white bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-700"
            >
              ← Storefront
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="hidden sm:inline-block text-xs text-slate-400 hover:text-white bg-slate-800/60 px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              ← View Live Storefront
            </Link>
            <button
              onClick={() => {
                setEditingDealId(null);
                setFormData({
                  title: '',
                  business: '',
                  logo_url: 'https://cdn-icons-png.flaticon.com/512/869/869636.png',
                  discount: '',
                  original_price: '',
                  deal_price: '',
                  category: 'Retail',
                  location: 'Main Bazaar',
                  phone: '',
                  expires_at: '',
                  image: '',
                  description: '',
                  is_featured: false,
                  store_address: '',
                  google_maps_url: '',
                  lat: 8.8053,
                  lng: 78.145,
                });
                setIsModalOpen(true);
              }}
              className="flex-1 sm:flex-none text-center bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm px-3.5 py-2 rounded-xl transition shadow-lg shadow-blue-500/20"
            >
              + Create Promotion
            </button>
            <button
              onClick={handleSignOut}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-2 rounded-xl transition"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Active Promotions</span>
            <div className="text-2xl font-bold text-white">{myDeals.length}</div>
          </div>
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total WhatsApp Inquiries</span>
            <div className="text-2xl font-bold text-emerald-400">{totalInquiries}</div>
          </div>
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Partner Tier</span>
            <div className="text-2xl font-bold text-blue-400">Verified Seller</div>
          </div>
        </div>

        <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm sm:text-base font-bold text-white">Your Live Store Deals</h2>
            <span className="text-xs text-slate-400">{myDeals.length} Listings</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs sm:text-sm">Loading your store listings...</div>
          ) : myDeals.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <p className="text-slate-400 text-xs sm:text-sm">You have not posted any active deals yet.</p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-xl transition"
              >
                Publish Your First Deal
              </button>
            </div>
          ) : (
            <>
              {/* Mobile View: Cards */}
              <div className="block md:hidden space-y-3">
                {myDeals.map((deal) => (
                  <div
                    key={deal.id}
                    className="p-3.5 bg-[#080d16] border border-slate-800/80 rounded-xl space-y-3"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={deal.logo_url || 'https://cdn-icons-png.flaticon.com/512/869/869636.png'}
                        alt={deal.business}
                        className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white leading-tight truncate">{deal.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate">{deal.business} • {deal.location}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-xs font-bold text-emerald-400">
                            {deal.deal_price ? `₹${deal.deal_price}` : deal.discount}
                          </span>
                          <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                            {deal.category}
                          </span>
                          <span className="text-[10px] text-slate-300">
                            💬 {deal.inquiries_count || 0} leads
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => setQrDeal(deal)}
                        className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition"
                      >
                        📱 QR Stand
                      </button>
                      <button
                        onClick={() => openEdit(deal)}
                        className="flex-1 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-medium transition"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteDeal(deal.id)}
                        className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-3">Brand & Title</th>
                      <th className="py-3">Category</th>
                      <th className="py-3">Deal Price</th>
                      <th className="py-3">Location</th>
                      <th className="py-3">Inquiries</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {myDeals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-slate-800/30">
                        <td className="py-3 flex items-center gap-3">
                          <img
                            src={deal.logo_url || 'https://cdn-icons-png.flaticon.com/512/869/869636.png'}
                            alt={deal.business}
                            className="w-8 h-8 rounded-full object-cover border border-slate-700 flex-shrink-0"
                          />
                          <div>
                            <div className="font-bold text-white truncate max-w-xs">{deal.title}</div>
                            <div className="text-[11px] text-slate-400">{deal.business}</div>
                          </div>
                        </td>
                        <td className="py-3 text-slate-300">{deal.category}</td>
                        <td className="py-3 font-bold text-emerald-400">
                          {deal.deal_price ? `₹${deal.deal_price}` : deal.discount}
                        </td>
                        <td className="py-3 text-slate-400">{deal.location}</td>
                        <td className="py-3 text-slate-300">💬 {deal.inquiries_count || 0}</td>
                        <td className="py-3 text-right space-x-2">
                          <button
                            onClick={() => setQrDeal(deal)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition"
                          >
                            📱 QR Stand
                          </button>
                          <button
                            onClick={() => openEdit(deal)}
                            className="px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteDeal(deal.id)}
                            className="px-2.5 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Post/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm sm:text-base font-bold text-white">
                {editingDealId ? 'Update Promotion' : 'Publish New Store Promotion'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white text-xl">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDeal} className="space-y-3 sm:space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Deal Headline *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Flat 30% Off Men Cotton Shirts"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Store / Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Classic Men Trends"
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

              <div>
                <label className="block text-slate-400 mb-1">Store Brand Logo (Optional, Max 2MB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'logo');
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-700 file:text-white hover:file:bg-slate-600 cursor-pointer bg-[#080d16] border border-slate-800 rounded-lg p-1.5"
                />
                {logoUploading && <p className="text-xs text-blue-400 mt-1">Uploading logo...</p>}
                {formData.logo_url && !logoUploading && <p className="text-xs text-emerald-400 mt-1">✓ Logo linked</p>}
              </div>

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
                    {CATEGORIES.map((cat) => (
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
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    {LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">WhatsApp Contact (10 Digits)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 9876543210"
                    value={formData.phone}
                    onBlur={handlePhoneBlur}
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
                <label className="block text-slate-400 mb-1">Physical Store Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 42, Main Bazaar Road"
                  value={formData.store_address}
                  onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deal Image (Max 2MB)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImageUpload(file, 'deal');
                  }}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer bg-[#080d16] border border-slate-800 rounded-lg p-1.5"
                />
                {uploading && <p className="text-xs text-blue-400 mt-1">Uploading deal photo...</p>}
                {formData.image && !uploading && <p className="text-xs text-emerald-400 mt-1">✓ Deal photo ready</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Offer Description & Conditions</label>
                <textarea
                  rows={2}
                  placeholder="Terms, sizing, validity details..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || logoUploading || submitting}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg shadow-lg text-xs"
                >
                  {submitting ? 'Saving...' : editingDealId ? 'Update Promotion' : 'Publish Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Counter Stand Print Modal */}
      {qrDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-sm w-full p-5 sm:p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-[11px] sm:text-xs font-semibold text-blue-400 uppercase tracking-wider">
                Official Counter Stand
              </span>
              <button onClick={() => setQrDeal(null)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </div>

            <div className="bg-white p-5 sm:p-6 rounded-2xl text-slate-900 space-y-3 shadow-inner">
              <div className="flex flex-col items-center gap-2">
                <img
                  src={qrDeal.logo_url || 'https://cdn-icons-png.flaticon.com/512/869/869636.png'}
                  alt={qrDeal.business}
                  className="w-12 sm:w-14 h-12 sm:h-14 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                />
                <div className="text-xs font-black uppercase tracking-wider text-blue-700">
                  {qrDeal.business}
                </div>
              </div>

              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                {qrDeal.title}
              </h3>

              <div className="inline-block bg-rose-50 text-rose-600 border border-rose-200 font-black text-xs sm:text-sm px-3.5 py-1 rounded-full">
                {qrDeal.discount}
              </div>

              <div className="p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl inline-block mt-1">
                <QRCode
                  value={`https://wa.me/${qrDeal.phone?.replace(/[^0-9]/g, '') || ''}?text=${encodeURIComponent(
                    `Hi! I scanned the QR counter stand at ${qrDeal.business} for "${qrDeal.title}".`
                  )}`}
                  size={140}
                />
              </div>

              <p className="text-[10px] sm:text-[11px] font-medium text-slate-500">
                Point camera to chat & claim directly on WhatsApp
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow-lg transition"
              >
                🖨️ Print Stand
              </button>
              <button
                onClick={() => setQrDeal(null)}
                className="px-4 py-2 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}