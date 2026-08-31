'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import QRCode from 'react-qr-code';

interface Deal {
  id: number;
  user_id?: string;
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

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLocation, setSelectedLocation] = useState('All');
  const [sortBy, setSortBy] = useState('latest');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedDealIds, setSavedDealIds] = useState<number[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [showMyDealsOnly, setShowMyDealsOnly] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);

  // Modals
  const [mapDeal, setMapDeal] = useState<Deal | null>(null);
  const [qrDeal, setQrDeal] = useState<Deal | null>(null);
  const [reviewDeal, setReviewDeal] = useState<Deal | null>(null);

  // Review Form State
  const [reviewsList, setReviewsList] = useState<Review[]>([]);
  const [reviewName, setReviewName] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Post/Edit Modal State
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
    is_featured: false,
    store_address: '',
    google_maps_url: '',
    lat: 8.8053,
    lng: 78.145,
  });

  useEffect(() => {
    fetchDeals();

    try {
      const stored = localStorage.getItem('saved_deal_ids');
      if (stored) setSavedDealIds(JSON.parse(stored));
    } catch (e) {
      console.error(e);
    }

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
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, inquiries_count: (d.inquiries_count || 0) + 1 } : d))
      );
    } catch (e) {
      console.error('Inquiry increment failed', e);
    }
  };

  // Review System Handlers
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

      // Recalculate average rating
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
      alert(`Failed to post review: ${err.message}`);
    } finally {
      setSubmittingReview(false);
    }
  };

  // Admin Verification Toggle
  const toggleVerificationStatus = async (dealId: number, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('deals')
        .update({ is_verified_merchant: !currentStatus })
        .eq('id', dealId);
      if (error) throw error;
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? { ...d, is_verified_merchant: !currentStatus } : d))
      );
    } catch (err: any) {
      alert(`Admin action failed: ${err.message}`);
    }
  };

  const sanitizeWhatsAppNumber = (phoneStr?: string) => {
    if (!phoneStr) return '';
    let clean = phoneStr.replace(/[^0-9]/g, '');
    if (clean.length === 10) clean = `91${clean}`;
    return clean;
  };

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
    setShowMyDealsOnly(false);
    setIsAdminView(false);
  };

  const handleImageUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit. Please upload a smaller image.');
      return;
    }

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
      const payload: any = {
        title: formData.title,
        business: formData.business,
        discount: formData.discount || 'Special Offer',
        original_price: formData.original_price ? Number(formData.original_price) : null,
        deal_price: formData.deal_price ? Number(formData.deal_price) : null,
        category: formData.category,
        location: formData.location || 'Main Bazaar',
        phone: formData.phone || '',
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
        is_featured: false,
        store_address: '',
        google_maps_url: '',
        lat: 8.8053,
        lng: 78.145,
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
      is_featured: deal.is_featured || false,
      store_address: deal.store_address || '',
      google_maps_url: deal.google_maps_url || '',
      lat: deal.lat || 8.8053,
      lng: deal.lng || 78.145,
      image: deal.image,
      description: deal.description,
    });
    setIsModalOpen(true);
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
      if (showMyDealsOnly && user && deal.user_id !== user.id) return false;

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
    <div className="min-h-screen bg-[#070b14] text-slate-100 antialiased font-sans">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-[#0a101d]/60 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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
            {user && (
              <>
                <button
                  onClick={() => {
                    setShowMyDealsOnly(!showMyDealsOnly);
                    setIsAdminView(false);
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                    showMyDealsOnly
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/20'
                      : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span>📦</span>
                  <span>My Listings</span>
                </button>
                <button
                  onClick={() => {
                    setIsAdminView(!isAdminView);
                    setShowMyDealsOnly(false);
                  }}
                  className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition flex items-center gap-1.5 ${
                    isAdminView
                      ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800/40 text-slate-400 border-slate-800 hover:text-white'
                  }`}
                >
                  <span>🛡️</span>
                  <span>Admin Panel</span>
                </button>
              </>
            )}
          </div>

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
                      is_featured: false,
                      store_address: '',
                      google_maps_url: '',
                      lat: 8.8053,
                      lng: 78.145,
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {/* Admin Verification Control Panel */}
        {isAdminView && user && (
          <section className="bg-[#0e1626] border border-amber-500/30 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                  🛡️ Super-Admin Verification Panel
                </h2>
                <p className="text-xs text-slate-400">
                  Toggle merchant verification badges to maintain platform trust.
                </p>
              </div>
              <span className="text-xs font-mono bg-slate-800 px-3 py-1 rounded text-slate-300">
                Total Deals: {deals.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5">Business Name</th>
                    <th className="py-2.5">Deal Title</th>
                    <th className="py-2.5">Location</th>
                    <th className="py-2.5">Status</th>
                    <th className="py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {deals.map((d) => (
                    <tr key={`admin-${d.id}`} className="hover:bg-slate-800/30">
                      <td className="py-3 font-semibold text-white">{d.business}</td>
                      <td className="py-3 text-slate-300">{d.title}</td>
                      <td className="py-3 text-slate-400">{d.location}</td>
                      <td className="py-3">
                        {d.is_verified_merchant ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
                            ✓ Verified Store
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-zinc-400 bg-zinc-500/10 border border-zinc-500/20 px-2 py-0.5 rounded">
                            Unverified
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => toggleVerificationStatus(d.id, Boolean(d.is_verified_merchant))}
                          className={`text-xs px-3 py-1 rounded transition font-medium ${
                            d.is_verified_merchant
                              ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {d.is_verified_merchant ? 'Revoke Badge' : 'Verify Store'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Featured Deals Spotlight Carousel */}
        {featuredDeals.length > 0 && !showSavedOnly && !showMyDealsOnly && !isAdminView && (
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
        {!isAdminView && (
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 rounded-full border border-blue-500/20">
              {user ? `Merchant Active: ${user.email}` : '100% Genuine Local Offers'}
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
              Discover Verified Local Discounts & Services
            </h1>
            <p className="text-slate-400 text-base sm:text-lg">
              Shop directly from verified neighborhood businesses with interactive map directions and printable QR flyers.
            </p>
          </div>
        )}

        {/* Search & Sort Row */}
        {!isAdminView && (
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
        )}

        {/* Category & Location Filters */}
        {!isAdminView && (
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
        )}

        {/* Listings Grid */}
        {!isAdminView && (
          loading ? (
            <div className="text-center py-20 text-slate-500">Loading live deals...</div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-20 bg-[#0a101d] rounded-2xl border border-slate-800/60 p-8">
              <p className="text-slate-400 text-base">
                {showMyDealsOnly
                  ? "You haven't posted any deals yet. Click '+ Post a Deal' above to publish your first offer!"
                  : showSavedOnly
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
                const isOwner = user && deal.user_id === user.id;

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
                        {/* Bookmark Button */}
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

                        {/* Store Reviews Rating & Quick Actions */}
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
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setQrDeal(deal)}
                              className="text-[11px] font-medium text-slate-400 hover:text-white flex items-center gap-0.5"
                            >
                              📱 QR
                            </button>
                            <button
                              onClick={() => setMapDeal(deal)}
                              className="text-[11px] font-medium text-blue-400 hover:text-blue-300 flex items-center gap-0.5"
                            >
                              🗺️ Map
                            </button>
                          </div>
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

                        <p className="text-sm text-slate-400 line-clamp-2 mb-2">
                          {deal.description || 'Visit store to claim this offer.'}
                        </p>

                        {deal.store_address && (
                          <p className="text-[11px] text-slate-500 mb-2 truncate">
                            🏬 {deal.store_address}
                          </p>
                        )}

                        {/* Merchant Analytics Indicator */}
                        {isOwner && (
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

                      {/* Owner-Only Controls */}
                      {isOwner && (
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
          )
        )}
      </main>

      {/* Printable Counter-Stand QR Flyer Modal */}
      {qrDeal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-blue-400 uppercase">
                Printable Counter Flyer
              </span>
              <button
                onClick={() => setQrDeal(null)}
                className="text-slate-400 hover:text-white text-lg"
              >
                ✕
              </button>
            </div>

            <div id="printable-flyer" className="bg-white p-5 rounded-2xl text-slate-900 space-y-3 shadow-inner">
              <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
                {qrDeal.business}
              </div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {qrDeal.title}
              </h3>
              <div className="inline-block bg-rose-100 text-rose-700 font-extrabold text-sm px-3 py-1 rounded-full">
                {qrDeal.discount}
              </div>

              {/* QR Code */}
              <div className="p-3 bg-white border-2 border-dashed border-slate-300 rounded-xl inline-block">
                <QRCode
                  value={`https://wa.me/${sanitizeWhatsAppNumber(qrDeal.phone)}?text=${encodeURIComponent(
                    `Hi! I scanned the QR flyer at ${qrDeal.business} for "${qrDeal.title}".`
                  )}`}
                  size={160}
                />
              </div>

              <p className="text-[11px] font-semibold text-slate-500">
                Scan with your phone camera to claim this offer instantly on WhatsApp!
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow-lg transition"
              >
                🖨️ Print Counter Stand
              </button>
              <button
                onClick={() => setQrDeal(null)}
                className="px-4 py-2.5 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Reviews Submission Modal */}
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
              <button
                onClick={() => setReviewDeal(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {/* Write a Review Form */}
            <form onSubmit={handleAddReview} className="space-y-3 bg-[#080d16] p-4 rounded-xl border border-slate-800">
              <h3 className="text-xs font-semibold text-slate-300">Write a Verified Review</h3>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Your Name (e.g. Ramesh K.)"
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  className="bg-[#0e1626] border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="bg-[#0e1626] border border-slate-800 rounded-lg p-2 text-xs text-amber-400 focus:outline-none focus:border-blue-500"
                >
                  <option value={5}>★★★★★ (5 Stars - Excellent)</option>
                  <option value={4}>★★★★☆ (4 Stars - Good)</option>
                  <option value={3}>★★★☆☆ (3 Stars - Average)</option>
                  <option value={2}>★★☆☆☆ (2 Stars - Poor)</option>
                  <option value={1}>★☆☆☆☆ (1 Star - Terrible)</option>
                </select>
              </div>

              <textarea
                rows={2}
                required
                placeholder="Share your honest shopping experience with this store..."
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

            {/* Existing Reviews Feed */}
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold text-slate-400">
                Verified Feedback ({reviewsList.length})
              </h4>
              {reviewsList.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-3 text-center">
                  No reviews yet. Be the first customer to leave feedback!
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

      {/* Live Map Modal */}
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
              <button
                onClick={() => setMapDeal(null)}
                className="text-slate-400 hover:text-white text-xl p-1"
              >
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
                    onChange={(e) => handleLocationChange(e.target.value)}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    {LOCATIONS.filter((l) => l.name !== 'All').map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name}
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
                    placeholder="e.g. 9876543210"
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

              {/* Physical Store Address & Maps URL */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Physical Store Address</label>
                  <input
                    type="text"
                    placeholder="e.g. 14, Main Road, Thoothukudi"
                    value={formData.store_address}
                    onChange={(e) => setFormData({ ...formData, store_address: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Google Maps Link</label>
                  <input
                    type="url"
                    placeholder="https://maps.google.com/?q=..."
                    value={formData.google_maps_url}
                    onChange={(e) => setFormData({ ...formData, google_maps_url: e.target.value })}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Spotlight Option */}
              <div className="flex items-center gap-2 p-2.5 bg-[#080d16] border border-slate-800 rounded-lg">
                <input
                  type="checkbox"
                  id="is_featured"
                  checked={Boolean(formData.is_featured)}
                  onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                  className="rounded border-slate-700 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="is_featured" className="text-xs text-slate-300">
                  Pin as <span className="text-amber-400 font-semibold">Featured Spotlight Offer</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deal Image (Max 2MB)</label>
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
                  placeholder="Describe your offer, warranty, and store billing terms..."
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