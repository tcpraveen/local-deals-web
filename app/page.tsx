export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl text-center space-y-6">
        <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-blue-900/50 text-blue-400 rounded-full border border-blue-700/50">
          Hyperlocal Marketplace
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white">
          Local Deals & Business Hub
        </h1>
        <p className="text-lg text-slate-400 max-w-xl mx-auto">
          Find exclusive discounts, support neighborhood stores, and discover top-rated local services in your area.
        </p>
        <div className="flex flex-wrap gap-4 justify-center pt-2">
          <button className="px-6 py-3 bg-blue-600 hover:bg-blue-500 font-semibold rounded-lg shadow-lg transition">
            Explore Deals
          </button>
          <button className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold rounded-lg transition">
            Register Your Business
          </button>
        </div>
      </div>
    </main>
  );
}
