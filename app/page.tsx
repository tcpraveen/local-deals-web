"use client";

import { useState } from "react";

interface Deal {
  id: number;
  title: string;
  business: string;
  category: string;
  discount: string;
  description: string;
  image: string;
}

const INITIAL_DEALS: Deal[] = [
  {
    id: 1,
    title: "Flat 30% Off on All Menswear",
    business: "Max Fashion Store",
    category: "Fashion",
    discount: "30% OFF",
    description: "Get 30% off on premium regular fit shirts, trousers, and casual wear this weekend.",
    image: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
  },
  {
    id: 2,
    title: "Special Portrait Photography Package",
    business: "Jebin Studio",
    category: "Services",
    discount: "20% OFF",
    description: "Full studio portrait sessions, candid event shoots, and album design discounts.",
    image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80",
  },
  {
    id: 3,
    title: "Event Booking & Banquet Hall Discount",
    business: "Veerabahu Mahal",
    category: "Venues",
    discount: "Flat ₹5,000 OFF",
    description: "Special early reservation discounts for wedding receptions, parties, and corporate events.",
    image: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=800&q=80",
  },
];

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS);
  const [activeCategory, setActiveCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [business, setBusiness] = useState("");
  const [category, setCategory] = useState("Retail");
  const [discount, setDiscount] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");

  const categories = ["All", "Fashion", "Services", "Venues", "Food", "Retail"];

  const handleAddDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !business) return;

    const newDeal: Deal = {
      id: Date.now(),
      title,
      business,
      category,
      discount: discount || "Special Offer",
      description: description || "Exclusive local deal available now.",
      image: image || "https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?w=800&q=80",
    };

    setDeals([newDeal, ...deals]);
    setTitle("");
    setBusiness("");
    setDiscount("");
    setDescription("");
    setImage("");
    setIsModalOpen(false);
  };

  const handleDeleteDeal = (id: number) => {
    setDeals(deals.filter((d) => d.id !== id));
  };

  const filteredDeals = deals.filter((d) => {
    const matchesCategory = activeCategory === "All" || d.category === activeCategory;
    const matchesSearch =
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.business.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 antialiased">
      {/* Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Local Deals Hub
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 rounded-lg shadow transition"
          >
            + Post a Deal
          </button>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="py-12 px-4 sm:px-6 text-center max-w-4xl mx-auto space-y-4">
        <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-blue-900/40 text-blue-400 rounded-full border border-blue-700/50">
          Hyperlocal Marketplace
        </span>
        <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white">
          Discover Verified Local Discounts & Services
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm sm:text-base">
          Browse active promotions from top-rated neighborhood stores, studios, and venues.
        </p>

        {/* Search Bar */}
        <div className="pt-4 max-w-lg mx-auto">
          <input
            type="text"
            placeholder="Search deals or store names..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
                activeCategory === cat
                  ? "bg-blue-600 text-white shadow"
                  : "bg-slate-900 hover:bg-slate-800 text-slate-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* Deals Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
        {filteredDeals.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-2xl border border-slate-800/80">
            <p className="text-slate-400">No deals match your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDeals.map((deal) => (
              <div
                key={deal.id}
                className="bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden hover:border-slate-700 transition flex flex-col group"
              >
                <div className="relative h-48 w-full bg-slate-800 overflow-hidden">
                  <img
                    src={deal.image}
                    alt={deal.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                  <span className="absolute top-3 right-3 bg-blue-600 text-white font-bold text-xs px-2.5 py-1 rounded-md shadow">
                    {deal.discount}
                  </span>
                  <span className="absolute top-3 left-3 bg-slate-950/80 text-slate-300 text-xs px-2 py-0.5 rounded backdrop-blur">
                    {deal.category}
                  </span>
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <p className="text-xs text-blue-400 font-semibold uppercase">{deal.business}</p>
                    <h3 className="text-lg font-bold text-white mt-1 leading-snug">{deal.title}</h3>
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{deal.description}</p>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
                    <button className="text-blue-400 hover:text-blue-300 font-semibold">
                      Claim Deal →
                    </button>
                    <button
                      onClick={() => handleDeleteDeal(deal.id)}
                      className="text-red-400 hover:text-red-300 transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add Deal Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-lg font-bold text-white">Post New Local Deal</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>
            <form onSubmit={handleAddDeal} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Deal Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 20% Off Weekend Special"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jebin Studio"
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Discount Tag</label>
                  <input
                    type="text"
                    placeholder="e.g. 30% OFF"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Fashion">Fashion</option>
                    <option value="Services">Services</option>
                    <option value="Venues">Venues</option>
                    <option value="Food">Food</option>
                    <option value="Retail">Retail</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Photo Link (URL)</label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Describe your deal details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-1/2 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-lg font-semibold text-slate-300 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold text-white transition"
                >
                  Publish Deal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}