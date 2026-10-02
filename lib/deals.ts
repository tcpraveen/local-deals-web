export interface Deal {
  id: number | string;
  user_id?: string;
  title: string;
  business: string;
  is_active?: boolean;
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
  reviewsCount?: number;
  openTime?: string;
  closeTime?: string;
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

export const VERIFIED_REAL_DEALS: Deal[] = [
  {
    id: 'mj-traders-thoothukudi',
    business: 'MJ Traders',
    category: 'Retail',
    title: 'Up to 30% Off Commercial Brass & Cookware',
    address: 'Main Bazaar, Thoothukudi',
    store_address: 'Main Bazaar, Thoothukudi',
    location: 'Main Bazaar',
    lat: 8.8053,
    lng: 78.145,
    price: 499,
    originalPrice: 799,
    discount: '30% OFF',
    vouchersCount: 15,
    phone: '919842154321',
    rating: 4.8,
    reviewsCount: 32,
    openTime: '09:00',
    closeTime: '22:00',
    opening_time: '09:00',
    closing_time: '22:00',
    deal_price: 499,
    original_price: 799,
    image: '',
    description: '',
    is_verified_merchant: true,
  },
  {
    id: 'vrc-authoor',
    business: 'VRC Electronics',
    category: 'Retail',
    title: 'Flat 25% Off Inverters & Solar Battery Sets',
    address: 'North Car Street, Authoor',
    store_address: 'North Car Street, Authoor',
    location: 'Authoor',
    lat: 8.6232,
    lng: 78.0699,
    price: 999,
    originalPrice: 1499,
    discount: '25% OFF',
    vouchersCount: 10,
    phone: '919443123456',
    rating: 4.9,
    reviewsCount: 45,
    openTime: '09:00',
    closeTime: '21:30',
    opening_time: '09:00',
    closing_time: '21:30',
    deal_price: 999,
    original_price: 1499,
    image: '',
    description: '',
    is_verified_merchant: true,
  },
];

export function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

export function normalizeDeal(record: Record<string, unknown>): Deal {
  const businessValue = record.business ?? record.shop_name;
  const discountValue = record.discount ?? record.discount_badge;
  const locationValue = record.location ?? record.area;
  const openingTime = record.opening_time ?? record.open_time;
  const closingTime = record.closing_time ?? record.close_time;
  return {
    id: typeof record.id === 'number' || typeof record.id === 'string' ? record.id : '',
    title: typeof record.title === 'string' ? record.title : '',
    business: typeof businessValue === 'string' ? businessValue : '',
    discount: typeof discountValue === 'string' ? discountValue : '',
    deal_price: (record.deal_price ?? record.discount_price) as Deal['deal_price'],
    original_price: record.original_price as Deal['original_price'],
    category: typeof record.category === 'string' ? record.category : '',
    location: typeof locationValue === 'string' ? locationValue : '',
    area: typeof record.area === 'string' ? record.area : undefined,
    phone: typeof record.phone === 'string' ? record.phone : undefined,
    expires_at: typeof record.expires_at === 'string' ? record.expires_at : undefined,
    opening_time: typeof openingTime === 'string' ? openingTime : undefined,
    closing_time: typeof closingTime === 'string' ? closingTime : undefined,
    image: typeof record.image === 'string' ? record.image : '',
    description: typeof record.description === 'string' ? record.description : '',
    scarcityText:
      typeof record.scarcityText === 'string'
        ? record.scarcityText
        : typeof record.scarcity_text === 'string'
          ? record.scarcity_text
          : undefined,
    user_id: typeof record.user_id === 'string' ? record.user_id : undefined,
    is_active: typeof record.is_active === 'boolean' ? record.is_active : undefined,
    logo_url: typeof record.logo_url === 'string' ? record.logo_url : undefined,
    originalPrice: record.originalPrice as Deal['originalPrice'],
    vouchersCount: typeof record.vouchersCount === 'number' ? record.vouchersCount : undefined,
    price: record.price as Deal['price'],
    address: typeof record.address === 'string' ? record.address : undefined,
    views_count: typeof record.views_count === 'number' ? record.views_count : undefined,
    inquiries_count: typeof record.inquiries_count === 'number' ? record.inquiries_count : undefined,
    is_featured: typeof record.is_featured === 'boolean' ? record.is_featured : undefined,
    is_verified_merchant:
      typeof record.is_verified_merchant === 'boolean' ? record.is_verified_merchant : undefined,
    store_address: typeof record.store_address === 'string' ? record.store_address : undefined,
    google_maps_url: typeof record.google_maps_url === 'string' ? record.google_maps_url : undefined,
    lat: typeof record.lat === 'number' ? record.lat : undefined,
    lng: typeof record.lng === 'number' ? record.lng : undefined,
    rating: typeof record.rating === 'number' ? record.rating : undefined,
    review_count: typeof record.review_count === 'number' ? record.review_count : undefined,
    reviewsCount: typeof record.reviewsCount === 'number' ? record.reviewsCount : undefined,
    openTime: typeof record.openTime === 'string' ? record.openTime : undefined,
    closeTime: typeof record.closeTime === 'string' ? record.closeTime : undefined,
    vouchers_left: typeof record.vouchers_left === 'number' ? record.vouchers_left : undefined,
    voucher_limit: typeof record.voucher_limit === 'number' ? record.voucher_limit : undefined,
  };
}

export const FALLBACK_LOCATIONS = [
  'All',
  'Main Bazaar',
  'Anna Nagar',
  'Beach Road',
  'Authoor',
  'North Authoor',
];
export const LOCATIONS = FALLBACK_LOCATIONS;

export function slugifyStoreName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function isDealActive(deal: Deal): boolean {
  if (deal.is_active === false) return false;
  if (!deal.expires_at) return true;
  const expiry = new Date(`${deal.expires_at}T23:59:59`).getTime();
  return Number.isFinite(expiry) && expiry >= Date.now();
}

export function isVerifiedActiveDeal(deal: Deal): boolean {
  const containsTestLabel = /\b(?:test|sample|demo|dummy|placeholder)\b/i;
  const fillerDiscount = /^(?:special offer|discount|offer|n\/?a)$/i;

  return (
    deal.is_verified_merchant === true &&
    isDealActive(deal) &&
    Boolean(deal.business.trim()) &&
    Boolean(deal.title.trim()) &&
    Boolean(deal.discount.trim()) &&
    !fillerDiscount.test(deal.discount.trim()) &&
    !containsTestLabel.test(deal.business) &&
    !containsTestLabel.test(deal.title)
  );
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
  return typeof deal.vouchers_left === 'number' ? Math.max(0, deal.vouchers_left) : 0;
}
