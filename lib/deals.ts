export interface Deal {
  id: number;
  user_id?: string;
  title: string;
  business: string;
  price?: number | string;
  originalPrice?: number | string;
  vouchersCount?: number;
  address?: string;
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

export interface StorefrontDeal extends Deal {
  price: number | string;
  originalPrice: number | string;
  vouchersCount: number;
  address: string;
  lat: number;
  lng: number;
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
    scarcityText: '🔥 Only 4 vouchers left today',
    lat: 8.8053,
    lng: 78.145,
  },
  {
    id: -2,
    title: 'Electrical service and appliance care',
    business: 'Cool Care Electricals',
    discount: 'Special Offer',
    category: 'Services',
    location: 'Anna Nagar',
    phone: '',
    opening_time: '09:00',
    closing_time: '21:00',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=900&q=80',
    description: 'A sample local offer. Connect Supabase to publish live merchant deals.',
    scarcityText: '⚡ Claimed by 14 people nearby',
  },
  {
    id: -3,
    title: 'Classic Men Trends special offer',
    business: 'Classic Men Trends',
    discount: 'Special Offer',
    category: 'Fashion',
    location: 'Beach Road',
    phone: '',
    opening_time: '09:00',
    closing_time: '21:00',
    image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=900&q=80',
    description: 'A sample local offer. Connect Supabase to publish live merchant deals.',
    scarcityText: '⏳ Deal ends Sunday',
  },
];

const AREA_COORDINATES: Record<string, [number, number]> = {
  'Main Bazaar': [8.81, 78.14],
  'Anna Nagar': [8.812, 78.132],
  'Beach Road': [8.818, 78.147],
};

export const DEALS: StorefrontDeal[] = SAMPLE_DEALS.filter(isDealActive).map((deal) => {
  const [areaLat, areaLng] = AREA_COORDINATES[deal.location || ''] || [8.8053, 78.145];
  return {
    ...deal,
    price: deal.deal_price ?? 'Special',
    originalPrice: deal.original_price ?? deal.deal_price ?? 'Special',
    vouchersCount: getVouchersLeft(deal),
    address: deal.store_address || `${deal.location || 'Local area'}, Thoothukudi`,
    lat: deal.lat ?? areaLat,
    lng: deal.lng ?? areaLng,
  };
});

export function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function normalizeDeal(record: Record<string, unknown>): Deal {
  const rawBusiness = String(record.business || record.shop_name || 'Local merchant');
  const business = rawBusiness.toLowerCase() === 'mj taders' ? 'MJ TRADERS' : rawBusiness;
  const scarcityByBusiness: Record<string, string> = {
    'mj traders': '🔥 Only 4 vouchers left today',
    'cool care electricals': '⚡ Claimed by 14 people nearby',
    'classic men trends': '⏳ Deal ends Sunday',
  };
  return {
    ...record,
    id: Number(record.id),
    title: String(record.title || 'Local offer'),
    business,
    discount: String(record.discount || record.discount_badge || 'Special Offer'),
    deal_price: (record.deal_price ?? record.discount_price) as Deal['deal_price'],
    location: String(record.location || record.area || ''),
    opening_time: String(record.opening_time || record.open_time || '09:00'),
    closing_time: String(record.closing_time || record.close_time || '21:00'),
    scarcityText: scarcityByBusiness[business.toLowerCase()] || String(
      record.scarcityText ||
      record.scarcity_text ||
      ''
    ) || undefined,
  } as Deal;
}

export const FALLBACK_LOCATIONS = ['All', 'Main Bazaar', 'Anna Nagar', 'Beach Road'];
export const LOCATIONS = FALLBACK_LOCATIONS;

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
