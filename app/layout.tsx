import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Local Deals Hub — Best Neighborhood Discounts & Offers',
  description: 'Discover verified promotions, exclusive discounts, and services from top-rated local merchants and stores.',
  openGraph: {
    title: 'Local Deals Hub — Verified Local Discounts',
    description: 'Find exclusive deals from top stores in your neighborhood. Claim instantly on WhatsApp!',
    url: 'https://local-deals-web.vercel.app',
    siteName: 'Local Deals Hub',
    images: [
      {
        url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&h=630&q=80',
        width: 1200,
        height: 630,
        alt: 'Local Deals Hub Preview',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local Deals Hub — Best Neighborhood Discounts & Offers',
    description: 'Discover verified promotions and exclusive discounts in your area.',
    images: ['https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1200&h=630&q=80'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#070b14] text-slate-100 min-h-screen font-sans antialiased selection:bg-blue-600 selection:text-white">
        {children}
      </body>
    </html>
  );
}