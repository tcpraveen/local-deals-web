'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Deal, isDealActive, normalizeDeal } from '@/lib/deals';

const CUSTOM_DEALS_STORAGE_KEY = 'ldh_custom_deals';
const CATEGORIES = ['Fashion', 'Services', 'Venues', 'Food', 'Retail'];
const LOCATIONS = [
  { name: 'Main Bazaar', lat: 8.81, lng: 78.14 },
  { name: 'Anna Nagar', lat: 8.812, lng: 78.132 },
  { name: 'Beach Road', lat: 8.818, lng: 78.147 },
  { name: 'North Authoor', lat: 8.8053, lng: 78.145 },
  { name: 'Bryant Nagar', lat: 8.799, lng: 78.135 },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return String(error);
}

function withTimeout<T>(operation: PromiseLike<T>, milliseconds: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Supabase timeout')), milliseconds);
  });

  try {
    return Promise.race([Promise.resolve(operation), timeoutPromise]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    return Promise.reject(error);
  }
}

function readStoredCustomDeals(): Deal[] {
  try {
    const stored = localStorage.getItem(CUSTOM_DEALS_STORAGE_KEY);
    if (!stored) return [];
    const records: unknown = JSON.parse(stored);
    if (!Array.isArray(records)) return [];
    return records
      .filter((record): record is Record<string, unknown> => Boolean(record) && typeof record === 'object')
      .map((record) => normalizeDeal(record));
  } catch (error) {
    console.error('Unable to read locally saved offers:', getErrorMessage(error));
    return [];
  }
}

function writeStoredCustomDeal(deal: Deal): void {
  const stored = readStoredCustomDeals();
  const nextDeals = [deal, ...stored.filter((existing) => String(existing.id) !== String(deal.id))];
  localStorage.setItem(CUSTOM_DEALS_STORAGE_KEY, JSON.stringify(nextDeals));
}

function removeStoredCustomDeal(id: Deal['id']): void {
  const nextDeals = readStoredCustomDeals().filter((deal) => String(deal.id) !== String(id));
  localStorage.setItem(CUSTOM_DEALS_STORAGE_KEY, JSON.stringify(nextDeals));
}

function mergeMerchantDeals(databaseDeals: Deal[], localDeals: Deal[]): Deal[] {
  const merged = new Map<string, Deal>();
  for (const deal of [...databaseDeals, ...localDeals]) {
    const duplicate = [...merged.values()].some(
      (existing) => existing.business === deal.business && existing.title === deal.title
    );
    if (!merged.has(String(deal.id)) && !duplicate) merged.set(String(deal.id), deal);
  }
  return [...merged.values()];
}

function parseCoordinates(value: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d+\.\d+),(-?\d+\.\d+)/,
    /[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/,
    /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/,
  ];

  for (const pattern of patterns) {
    const match = value.trim().match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
  }

  return null;
}

export default function MerchantPortal() {
  const [user, setUser] = useState<User | null>(null);
  const [myDeals, setMyDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  // Auth Form State
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetView, setIsResetView] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals & Scanner States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDealId, setEditingDealId] = useState<number | string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [locationCoordinatesLocked, setLocationCoordinatesLocked] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [qrDeal, setQrDeal] = useState<Deal | null>(null);

  // Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [redeemSuccess, setRedeemSuccess] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [redemptionError, setRedemptionError] = useState('');
  const [redemptionCount, setRedemptionCount] = useState(0);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const [formData, setFormData] = useState<Partial<Deal>>({
    title: '',
    business: '',
    logo_url: '',
    discount: '',
    original_price: '',
    deal_price: '',
    category: 'Retail',
    location: 'Main Bazaar',
    phone: '',
    expires_at: '',
    opening_time: '09:00',
    closing_time: '21:30',
    image: '',
    description: '',
    is_featured: false,
    store_address: '',
    google_maps_url: '',
  });

  useEffect(() => {
    void withTimeout(supabase.auth.getSession(), 3000)
      .then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        if (session?.user) void fetchMyDeals(session.user.id);
        else setLoading(false);
      })
      .catch((error: unknown) => {
        console.error('Unable to restore merchant session:', getErrorMessage(error));
        setLoading(false);
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

  const handleVoucherCodeRedeem = useCallback(async (code: string) => {
    const normalizedCode = code.trim().toUpperCase();
    setRedeemSuccess(false);
    setRedemptionError('');
    if (!/^LDH-\d{4}$/.test(normalizedCode) || !user) {
      setRedemptionError('Enter a valid voucher code in the LDH-1234 format.');
      return;
    }

    setScannedResult(normalizedCode);
    const { data: existing, error: lookupError } = await withTimeout(
      supabase
        .from('redemptions')
        .select('id')
        .eq('voucher_code', normalizedCode)
        .eq('merchant_id', user.id)
        .maybeSingle(),
      3000
    );

    if (lookupError) {
      setRedemptionError(`Unable to verify voucher: ${lookupError.message}`);
      return;
    }
    if (existing) {
      setRedemptionError('This voucher has already been redeemed.');
      return;
    }

    const { error } = await withTimeout(
      supabase.from('redemptions').insert([{
        voucher_code: normalizedCode,
        merchant_id: user.id,
      }]),
      3000
    );
    if (error) {
      setRedemptionError(`Unable to redeem voucher: ${error.message}`);
      return;
    }
    setVoucherCode('');
    setRedeemSuccess(true);
    setRedemptionCount((count) => count + 1);
  }, [user]);

  // Camera QR Scanner Lifecycle
  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        'reader',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scannerRef.current = scanner;
      scanner.render(
        (decodedText) => {
          handleVoucherCodeRedeem(decodedText);
          scanner.clear();
        },
        () => {}
      );

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(() => {});
        }
      };
    }
  }, [isScannerOpen, handleVoucherCodeRedeem]);

  async function fetchMyDeals(userId: string) {
    const localDeals = readStoredCustomDeals().filter(
      (deal) => deal.user_id === userId && isDealActive(deal)
    );
    setMyDeals(localDeals);
    setRedemptionCount(0);
    try {
      setLoading(true);
      const [dealResult, redemptionResult] = await withTimeout(
        Promise.all([
          supabase
            .from('deals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }),
          supabase
            .from('redemptions')
            .select('id', { count: 'exact', head: true })
            .eq('merchant_id', userId),
        ]),
        3000
      );

      if (dealResult.error) throw dealResult.error;
      const databaseDeals = (dealResult.data || []).filter((deal: Deal) =>
        isDealActive(deal) && Boolean(deal.business?.trim()) && Boolean(deal.title?.trim())
      );
      setMyDeals(mergeMerchantDeals(databaseDeals, localDeals));
      if (redemptionResult.error) {
        console.error('Error loading redemption analytics:', redemptionResult.error.message);
      } else {
        setRedemptionCount(redemptionResult.count || 0);
      }
    } catch (err: unknown) {
      console.error('Error fetching merchant deals:', getErrorMessage(err));
      setMyDeals(localDeals);
    } finally {
      setLoading(false);
    }
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      if (isSignUp) {
        const { error } = await withTimeout(supabase.auth.signUp({ email, password }), 4000);
        if (error) throw error;
        setAuthMessage({ type: 'success', text: 'Registration complete! Please sign in with your credentials.' });
        setIsSignUp(false);
      } else {
        const { error } = await withTimeout(supabase.auth.signInWithPassword({ email, password }), 4000);
        if (error) throw error;
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      const isNetworkFailure = /load failed|failed to fetch|network|timed out/i.test(message);
      setAuthMessage({
        type: 'error',
        text: isNetworkFailure
          ? 'Unable to reach the sign-in service right now. Please check your connection and try again.'
          : `Sign-in failed: ${message}`,
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const redirectTo = `${typeof window !== 'undefined' ? window.location.origin : ''}/merchant`;
      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, { redirectTo }),
        4000
      );
      if (error) throw error;
      setAuthMessage({ type: 'success', text: 'Password reset link sent to your email.' });
    } catch (error: unknown) {
      setAuthMessage({
        type: 'error',
        text: `Unable to send reset link: ${getErrorMessage(error)}`,
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handlePhoneBlur = () => {
    let clean = (formData.phone || '').replace(/[^0-9]/g, '');
    if (clean.startsWith('91') && clean.length === 12) clean = clean.substring(2);
    if (clean.startsWith('0') && clean.length === 11) clean = clean.substring(1);
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
    } catch (err: unknown) {
      alert(`Upload error: ${getErrorMessage(err)}`);
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
    setLocationCoordinatesLocked(false);
    setFormData((prev) => ({
      ...prev,
      location: locName,
    }));
  };

  const handleMapsLocationChange = (value: string) => {
    const coordinates = parseCoordinates(value);
    setLocationError('');
    setLocationCoordinatesLocked(Boolean(coordinates));
    setFormData((prev) => ({
      ...prev,
      google_maps_url: value,
      lat: coordinates?.lat,
      lng: coordinates?.lng,
    }));
  };

  const handleDetectShopLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location detection is not supported by this browser.');
      return;
    }

    setIsDetectingLocation(true);
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setFormData((prev) => ({
          ...prev,
          lat: coords.latitude,
          lng: coords.longitude,
          google_maps_url: `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`,
        }));
        setLocationCoordinatesLocked(true);
        setIsDetectingLocation(false);
      },
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. Enable it in your browser or paste a Maps link.'
            : error.code === error.TIMEOUT
              ? 'Could not detect your location in time. Please try again.'
              : 'Could not detect your location. Please try again or paste a Maps link.'
        );
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSaveDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.title || !formData.business) {
      alert('Title and Business name are required.');
      return;
    }
    if (typeof formData.lat !== 'number' || typeof formData.lng !== 'number') {
      alert('Paste a Google Maps link containing coordinates or detect your shop location before saving.');
      return;
    }

    setSubmitting(true);
    const cleanPhone = (formData.phone || '').replace(/[^0-9]/g, '');

    const payload = {
      title: formData.title,
      business: formData.business,
      logo_url: formData.logo_url || null,
      discount: formData.discount || '',
      original_price: formData.original_price ? Number(formData.original_price) : null,
      deal_price: formData.deal_price ? Number(formData.deal_price) : null,
      category: formData.category,
      location: formData.location || 'Main Bazaar',
      phone: cleanPhone,
      expires_at: formData.expires_at || null,
      opening_time: formData.opening_time || '09:00',
      closing_time: formData.closing_time || '21:30',
      is_featured: Boolean(formData.is_featured),
      store_address: formData.store_address || '',
      google_maps_url: formData.google_maps_url || '',
      lat: formData.lat,
      lng: formData.lng,
      image: formData.image || null,
      description: formData.description || '',
      user_id: user.id,
    };

    if (typeof editingDealId === 'number') {
      try {
        const { error } = await withTimeout(
          supabase.from('deals').update(payload).eq('id', editingDealId),
          3000
        );
        if (error) throw error;
        setIsModalOpen(false);
        setEditingDealId(null);
        await fetchMyDeals(user.id);
      } catch (error: unknown) {
        alert(`Error saving offer: ${getErrorMessage(error)}`);
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const optimisticId = typeof editingDealId === 'string' ? editingDealId : `local-${Date.now()}`;
    const optimisticDeal = normalizeDeal({
      ...payload,
      id: optimisticId,
      is_active: true,
      is_verified_merchant: true,
      vouchers_left: formData.vouchers_left ?? formData.vouchersCount ?? 0,
    });
    let localSaveError: unknown;
    try {
      writeStoredCustomDeal(optimisticDeal);
    } catch (error: unknown) {
      localSaveError = error;
      console.error('Unable to persist the new offer locally:', getErrorMessage(error));
    }

    setMyDeals((current) =>
      mergeMerchantDeals(
        current.filter((deal) => String(deal.id) !== String(optimisticId)),
        [optimisticDeal]
      )
    );
    setIsModalOpen(false);
    setEditingDealId(null);
    setSubmitting(false);
    setSaveNotice(
      localSaveError
        ? 'Offer is visible in this dashboard, but browser storage is unavailable.'
        : 'Offer published locally. Syncing it to your account…'
    );

    void withTimeout(
      supabase.from('deals').insert([payload]).select('*').single(),
      3000
    )
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data) throw new Error('Supabase did not return the saved offer.');
        const syncedDeal: Deal = { ...optimisticDeal, id: data.id };
        setMyDeals((current) =>
          mergeMerchantDeals(
            current.filter((deal) => String(deal.id) !== String(optimisticId)),
            [syncedDeal]
          )
        );
        try {
          if (String(optimisticId) !== String(syncedDeal.id)) {
            removeStoredCustomDeal(optimisticId);
          }
          writeStoredCustomDeal(syncedDeal);
          setSaveNotice('Offer saved to your account.');
        } catch (error: unknown) {
          console.error('Offer saved remotely, but local cache update failed:', getErrorMessage(error));
          setSaveNotice('Offer saved to your account, but browser storage could not be updated.');
        }
      })
      .catch((error: unknown) => {
        console.error('Unable to sync the locally published offer:', getErrorMessage(error));
        setSaveNotice(
          'Offer remains in this browser, but could not be synced to your account. Check your connection and try again.'
        );
      });
  };

  const handleDeleteDeal = async (id: Deal['id']) => {
    if (!confirm('Are you sure you want to remove this active deal?')) return;
    try {
      if (typeof id === 'string') {
        removeStoredCustomDeal(id);
        setMyDeals((current) => current.filter((deal) => String(deal.id) !== id));
        return;
      }
      const { error } = await withTimeout(supabase.from('deals').delete().eq('id', id), 3000);
      if (error) throw error;
      if (user) await fetchMyDeals(user.id);
    } catch (err: unknown) {
      alert(`Deletion error: ${getErrorMessage(err)}`);
    }
  };

  const openEdit = (deal: Deal) => {
    setEditingDealId(deal.id);
    setFormData({ ...deal });
    setLocationCoordinatesLocked(
      typeof deal.lat === 'number' && typeof deal.lng === 'number'
    );
    setLocationError('');
    setIsModalOpen(true);
  };

  const totalInquiries = myDeals.reduce((sum, d) => sum + (d.inquiries_count || 0), 0);
  const printStore = myDeals[0]?.business || '';
  const printStoreUrl = typeof window === 'undefined'
    ? '/'
    : `${window.location.origin}/store/${myDeals[0] ? myDeals[0].business.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') : ''}`;

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
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                {isResetView ? 'Reset Merchant Password' : 'Merchant Partner Sign In'}
              </h1>
              <p className="text-xs text-slate-400">
                Publish promotions, scan customer voucher codes, and track in-store analytics.
              </p>
            </div>

            {authMessage && (
              <div
                role="status"
                className={`rounded-xl border px-3 py-2.5 text-xs ${
                  authMessage.type === 'success'
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                {authMessage.text}
              </div>
            )}

            {isResetView ? (
              <form onSubmit={handlePasswordReset} className="space-y-4 text-xs sm:text-sm">
                <div>
                  <label className="block text-slate-400 mb-1">Business Email</label>
                  <input
                    type="email"
                    required
                    placeholder="store@domain.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-500/25"
                >
                  {authLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsResetView(false);
                    setAuthMessage(null);
                  }}
                  className="w-full text-xs text-slate-400 hover:text-white"
                >
                  Back to sign in
                </button>
              </form>
            ) : <form onSubmit={handleAuth} className="space-y-4 text-xs sm:text-sm">
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
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetView(true);
                      setAuthMessage(null);
                    }}
                    className="mt-2 text-xs text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-500/25"
              >
                {authLoading ? 'Verifying...' : isSignUp ? 'Register Business Account' : 'Access Merchant Workspace'}
              </button>
            </form>}

            {!isResetView && <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthMessage(null);
                }}
                className="text-xs text-blue-400 hover:underline"
              >
                {isSignUp ? 'Already registered? Sign In' : 'New store owner? Create merchant account'}
              </button>
            </div>}

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

            {/* In-Store Scanner Trigger */}
            <button
              onClick={() => {
                setScannedResult(null);
                setRedeemSuccess(false);
                setIsScannerOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs sm:text-sm px-3 sm:px-3.5 py-2 rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <span>📷</span>
              <span>Scan Voucher</span>
            </button>

            <button
              onClick={() => window.print()}
              className="bg-zinc-900 hover:bg-zinc-800 text-zinc-100 font-medium text-xs sm:text-sm px-3 sm:px-3.5 py-2 rounded-xl transition border border-zinc-800"
            >
              🖨️ Download/Print Counter QR Card
            </button>

            <button
              onClick={() => {
                setEditingDealId(null);
                setLocationCoordinatesLocked(false);
                setLocationError('');
                setFormData({
                  title: '',
                  business: '',
                  logo_url: '',
                  discount: '',
                  original_price: '',
                  deal_price: '',
                  category: 'Retail',
                  location: 'Main Bazaar',
                  phone: '',
                  expires_at: '',
                  opening_time: '09:00',
                  closing_time: '21:30',
                  image: '',
                  description: '',
                  is_featured: false,
                  store_address: '',
                  google_maps_url: '',
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
        {saveNotice && (
          <p
            role="status"
            className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200"
          >
            {saveNotice}
          </p>
        )}

        {/* KPI Performance Metrics */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-white">Quick Voucher Verification</h2>
            <p className="text-xs text-slate-400 mt-1">Enter a customer&apos;s LDH-XXXX code to apply the discount at the counter.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleVoucherCodeRedeem(voucherCode);
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <input
              value={voucherCode}
              onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
              placeholder="LDH-1234"
              pattern="LDH-[0-9]{4}"
              maxLength={8}
              aria-label="Voucher code"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-xs font-bold">
              Verify Voucher
            </button>
          </form>
          {redemptionError && <p role="alert" className="text-xs text-rose-400">{redemptionError}</p>}
          {redeemSuccess && (
            <p role="status" className="rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-bold text-emerald-300">
              ✓ Voucher Valid: Discount Applied
            </p>
          )}
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Active Promotions</span>
            <div className="text-2xl font-bold text-white">{myDeals.length}</div>
          </div>

          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-1">
            <span className="text-xs text-slate-400 font-medium">Total Inquiries & Claims</span>
            <div className="text-2xl font-bold text-emerald-400">{totalInquiries}</div>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-[#0e1626] px-5 py-4">
          <span className="text-xs text-slate-400">Redeemed at Counter</span>
          <span className="text-2xl font-black text-emerald-400">{redemptionCount}</span>
        </div>

        {/* Live Deals Section */}
        <div className="bg-[#0e1626] border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm sm:text-base font-bold text-white">Your Store Deals</h2>
            <span className="text-xs text-slate-400">{myDeals.length} Listings</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-xs sm:text-sm">Loading listings...</div>
          ) : myDeals.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <span className="text-3xl" aria-hidden="true">🏬</span>
              <h3 className="text-sm font-bold text-white">No active store promotions</h3>
              <p className="text-slate-400 text-xs sm:text-sm">
                Click &apos;+ Create Promotion&apos; to publish a verified neighborhood offer.
              </p>
              <button
                onClick={() => setIsModalOpen(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded-xl transition"
              >
                + Create Promotion
              </button>
            </div>
          ) : (
            <>
              {/* Mobile View */}
              <div className="block md:hidden space-y-3">
                {myDeals.map((deal) => (
                  <div key={deal.id} className="p-3.5 bg-[#080d16] border border-slate-800/80 rounded-xl space-y-3">
                    <div className="flex items-start gap-3">
                      {deal.logo_url && (
                        <img
                          src={deal.logo_url}
                          alt={deal.business}
                          className="w-10 h-10 rounded-full object-cover border border-slate-700 flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-white leading-tight truncate">{deal.title}</h4>
                        <p className="text-[11px] text-slate-400 truncate">
                          {deal.business} • {deal.location}
                        </p>
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

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-3">Brand & Title</th>
                      <th className="py-3">Category</th>
                      <th className="py-3">Deal Price</th>
                      <th className="py-3">Operating Hours</th>
                      <th className="py-3">Inquiries</th>
                      <th className="py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {myDeals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-slate-800/30">
                        <td className="py-3 flex items-center gap-3">
                          {deal.logo_url && (
                            <img
                              src={deal.logo_url}
                              alt={deal.business}
                              className="w-8 h-8 rounded-full object-cover border border-slate-700 flex-shrink-0"
                            />
                          )}
                          <div>
                            <div className="font-bold text-white truncate max-w-xs">{deal.title}</div>
                            <div className="text-[11px] text-slate-400">{deal.business}</div>
                          </div>
                        </td>
                        <td className="py-3 text-slate-300">{deal.category}</td>
                        <td className="py-3 font-bold text-emerald-400">
                          {deal.deal_price ? `₹${deal.deal_price}` : deal.discount}
                        </td>
                        <td className="py-3 text-slate-400">
                          {deal.opening_time || '09:00'} - {deal.closing_time || '21:30'}
                        </td>
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

      <section className="print-card hidden" aria-label="Printable table-top QR card">
        <div className="print-card-inner">
          {[0, 1].map((face) => (
            <div className={`print-card-face print-card-face-${face}`} key={face}>
              <div>
                <p className="print-card-kicker">LOCAL DEALS HUB</p>
                <h1>{printStore}</h1>
                <p>Scan to claim today&apos;s exclusive in-store walk-in offers - Powered by Local Deals Hub</p>
              </div>
              <QRCode value={printStoreUrl} size={150} />
            </div>
          ))}
        </div>
      </section>

      {/* Camera QR Scanner Dialog */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                📷 Scan Customer Voucher
              </span>
              <button
                onClick={() => {
                  if (scannerRef.current) scannerRef.current.clear().catch(() => {});
                  setIsScannerOpen(false);
                }}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div id="reader" className="w-full rounded-2xl overflow-hidden bg-black" />

            {redeemSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
                <span className="text-xs font-bold text-emerald-400">✓ Voucher Verified & Redeemed!</span>
                <p className="text-[11px] text-slate-300 font-mono">Code: {scannedResult}</p>
              </div>
            )}

            <button
              onClick={() => {
                if (scannerRef.current) scannerRef.current.clear().catch(() => {});
                setIsScannerOpen(false);
              }}
              className="w-full py-2.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-medium"
            >
              Close Camera
            </button>
          </div>
        </div>
      )}

      {/* Post / Edit Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#0e1626] border border-slate-800 rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-5 sm:p-6 bg-[#0e1626]">
              <h2 className="text-sm sm:text-base font-bold text-white">
                {editingDealId ? 'Update Promotion' : 'Publish New Store Promotion'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Form with Scrollable Body and Sticky Footer */}
            <form onSubmit={handleSaveDeal} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto p-5 sm:p-6 space-y-3 sm:space-y-4 text-xs flex-1">
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

                {/* Operating Hours */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Opening Time (24h)</label>
                    <input
                      type="time"
                      value={formData.opening_time}
                      onChange={(e) => setFormData({ ...formData, opening_time: e.target.value })}
                      className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Closing Time (24h)</label>
                    <input
                      type="time"
                      value={formData.closing_time}
                      onChange={(e) => setFormData({ ...formData, closing_time: e.target.value })}
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

                <div>
                  <label className="block text-slate-400 mb-1">Store Google Maps Location Link *</label>
                  <input
                    type="text"
                    required
                    placeholder="Paste Google Maps link (e.g., https://maps.app.goo.gl/... or share link)"
                    value={formData.google_maps_url || ''}
                    onChange={(event) => handleMapsLocationChange(event.target.value)}
                    className="w-full bg-[#080d16] border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                  {locationCoordinatesLocked &&
                    typeof formData.lat === 'number' &&
                    typeof formData.lng === 'number' && (
                      <p className="mt-1.5 inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                        ✓ GPS Coordinates locked: {formData.lat.toFixed(4)}, {formData.lng.toFixed(4)}
                      </p>
                    )}
                  {locationError && (
                    <p role="alert" className="mt-1.5 text-xs text-rose-400">{locationError}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleDetectShopLocation}
                    disabled={isDetectingLocation}
                    className="mt-2 flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-600/20 px-3 py-1.5 text-xs font-bold text-blue-300 transition hover:bg-blue-600/30 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isDetectingLocation ? '📍 Detecting shop location...' : '📍 Detect My Shop Location'}
                  </button>
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
              </div>

              {/* Fixed Sticky Action Footer */}
              <div className="border-t border-slate-800 bg-[#0a101d] px-5 sm:px-6 py-3.5 flex items-center justify-end gap-2.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 text-xs font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || logoUploading || submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg shadow-lg shadow-blue-500/20 text-xs transition"
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
                {qrDeal.logo_url && (
                  <img
                    src={qrDeal.logo_url}
                    alt={qrDeal.business}
                    className="w-12 sm:w-14 h-12 sm:h-14 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                  />
                )}
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