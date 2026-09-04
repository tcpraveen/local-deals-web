import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Local Deals Hub — Best Neighborhood Discounts & Offers',
  description: 'Discover verified local deals, exclusive discounts, and connect directly on WhatsApp & phone.',
  metadataBase: new URL('https://local-deals-web.vercel.app'),
  openGraph: {
    title: 'Local Deals Hub — Verified Neighborhood Offers & Discounts',
    description: 'Find real local discounts, exclusive services, and live store map directions.',
    url: 'https://local-deals-web.vercel.app',
    siteName: 'Local Deals Hub',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&h=630&q=80',
        width: 1200,
        height: 630,
        alt: 'Local Deals Hub Marketplace',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Deals Hub — Neighborhood Discounts',
    description: 'Find genuine verified local offers and claim via WhatsApp.',
    images: ['https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&h=630&q=80'],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}