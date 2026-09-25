'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
import { Deal, getVouchersLeft, isDealActive, normalizeDeal, SAMPLE_DEALS, slugifyStoreName } from '@/lib/deals';

export default function StorePage() {
  const params = useParams<{ slug: string }>();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStore = async () => {
      if (!isSupabaseConfigured) {
        setDeals(SAMPLE_DEALS.filter((deal) => slugifyStoreName(deal.business) === params.slug));
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from('deals').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading store offers:', error.message);
        setDeals(SAMPLE_DEALS.filter((deal) => slugifyStoreName(deal.business) === params.slug));
      } else {
        const storeDeals = (data || []).map((deal: Record<string, unknown>) => normalizeDeal(deal)).filter((deal: Deal) =>
          slugifyStoreName(deal.business) === params.slug && isDealActive(deal)
        );
        setDeals(storeDeals);
      }
      setLoading(false);
    };
    loadStore();
  }, [params.slug]);

  const store = deals[0];

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-100 px-4 py-8 sm:px-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <Link href="/" className="text-sm text-slate-400 hover:text-white">← Back to all deals</Link>
        {loading ? <p className="text-slate-400">Loading store offers...</p> : !store ? (
          <div className="rounded-3xl border border-slate-800 bg-[#0e1626] p-8 text-center">
            <h1 className="text-xl font-bold text-white">Store not found</h1>
            <p className="mt-2 text-sm text-slate-400">This store has no active offers right now.</p>
          </div>
        ) : (
          <>
            <header className="rounded-3xl border border-slate-800 bg-[#0e1626] p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <img src={store.logo_url || 'https://cdn-icons-png.flaticon.com/512/869/869636.png'} alt={store.business} className="h-16 w-16 rounded-2xl object-cover" />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Verified local merchant</p>
                  <h1 className="text-2xl font-black text-white">{store.business}</h1>
                  <p className="text-sm text-slate-400">{store.store_address || `${store.location || 'Local area'}, Thoothukudi`}</p>
                </div>
              </div>
            </header>
            <section className="grid gap-5 md:grid-cols-2">
              {deals.map((deal) => (
                <article key={deal.id} className="rounded-3xl border border-slate-800 bg-[#0e1626] p-5">
                  <img src={deal.image} alt={deal.title} className="h-48 w-full rounded-2xl object-cover" />
                  <div className="mt-4 space-y-3">
                    <span className="inline-block rounded-full bg-rose-600 px-2.5 py-1 text-[11px] font-bold text-white">{deal.discount}</span>
                    <h2 className="text-lg font-bold text-white">{deal.title}</h2>
                    <p className="text-sm text-slate-400">{deal.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-amber-400">🔥 {getVouchersLeft(deal)} vouchers left</span>
                      <a href={deal.phone ? `tel:${deal.phone}` : undefined} className="rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white">☎ Call store</a>
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
