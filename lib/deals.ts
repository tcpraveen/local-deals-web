export interface Deal {
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
  area?: string;
  phone?: string;
  expires_at?: string;
  opening_time?: string;
  closing_time?: string;
  image: string;
  description: string;
  scarcityText?: string;
  scarcity_text?: string;
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
  vouchers_left?: number;
  voucher_limit?: number;
}

export const SAMPLE_DEALS: Deal[] = [
  {
    id: -1,
    title: 'Everyday essentials at a special price',
    business: 'MJ TRADERS',
    discount: '20% OFF',
    original_price: 500,
    deal_price: 400,
    category: 'Retail',
    location: 'Main Bazaar',
    phone: '',
    opening_time: '09:00',
    closing_time: '21:00',
    image: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=900&q=80',
    description: 'A sample local offer. Connect Supabase to publish live merchant deals.',
    scarcity_text: '🔥 Sample offer',
    lat: 8.8053,
    lng: 78.145,
  },
];

export function normalizeDeal(record: Record<string, unknown>): Deal {
  return {
    ...record,
    id: Number(record.id),
    title: String(record.title || 'Local offer'),
    business: String(record.business || record.shop_name || 'Local merchant'),
    discount: String(record.discount || record.discount_badge || 'Special Offer'),
    deal_price: (record.deal_price ?? record.discount_price) as Deal['deal_price'],
    location: String(record.location || record.area || ''),
    opening_time: String(record.opening_time || record.open_time || '09:00'),
    closing_time: String(record.closing_time || record.close_time || '21:00'),
    scarcityText: String(record.scarcityText || record.scarcity_text || '') || undefined,
  } as Deal;
}

export const FALLBACK_LOCATIONS = ['All', 'Main Bazaar', 'Anna Nagar', 'Beach Road'];

export function slugifyStoreName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isDealActive(deal: Deal): boolean {
  if (!deal.expires_at) return true;
  const expiry = new Date(`${deal.expires_at}T23:59:59`).getTime();
  return Number.isNaN(expiry) || expiry >= Date.now();
}

export function getDealDistance(deal: Deal): number {
  if (typeof deal.lat === 'number' && typeof deal.lng === 'number') {
    const delta = Math.sqrt(Math.pow(deal.lat - 8.8053, 2) + Math.pow(deal.lng - 78.145, 2));
    return Math.max(0.4, Number((delta * 111).toFixed(1)));
  }

  return {
    'Main Bazaar': 1.2,
    'Anna Nagar': 2.4,
    'Beach Road': 3.1,
  }[deal.location || ''] || 2.8;
}

export function getVouchersLeft(deal: Deal): number {
  if (typeof deal.vouchers_left === 'number') return Math.max(0, deal.vouchers_left);
  const limit = deal.voucher_limit ?? 10;
  return Math.max(0, limit - (deal.inquiries_count || 0));
}
