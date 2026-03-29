import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useItems } from "./useItems";
import { 
  ArrowLeft, 
  Coins, 
  Database, 
  TrendingUp, 
  ChevronRight, 
  Scale, 
  History,
  Activity,
  Layers,
  ArrowUpRight,
  Search,
  ArrowRight
} from "lucide-react";
import StockHistoryModal from "./StockLegder";

export default function StockOverview() {
  const { items, loading } = useItems();
  const navigate = useNavigate();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeMetal, setActiveMetal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const openHistoryModal = (metal, category) => {
  setSelectedCategory(category);
  setActiveMetal(metal);
  setHistoryOpen(true);
};

  /* --------------------------------
     LOGIC & ANALYTICS
  -------------------------------- */
  const stockByMetal = useMemo(() => {
    const result = { GOLD: {}, SILVER: {} };
    items.forEach((item) => {
      if (!item.metal || !item.category || item.status === "SOLD") return;
      const { metal, category, grossWeight, purity } = item;
      if (!result[metal][category]) {
        result[metal][category] = { category, quantity: 0, grossWeight: 0, purityMap: {} };
      }
      result[metal][category].quantity += 1;
      result[metal][category].grossWeight += Number(grossWeight || 0);
      if (!result[metal][category].purityMap[purity]) result[metal][category].purityMap[purity] = true;
    });
    return result;
  }, [items]);

  const activeStats = useMemo(() => {
    if (!activeMetal) return { weight: 0, count: 0 };
    const cats = Object.values(stockByMetal[activeMetal]);
    return {
      weight: cats.reduce((acc, curr) => acc + curr.grossWeight, 0),
      count: cats.reduce((acc, curr) => acc + curr.quantity, 0)
    };
  }, [activeMetal, stockByMetal]);

  /* --------------------------------
     LEVEL 1: ENTRY HUB
  -------------------------------- */
  if (!activeMetal) {
    return (
      <div className=" dashboard-bg p-8 flex items-center justify-center">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8">
          {["GOLD", "SILVER"].map((metal) => (
            <button
              key={metal}
              onClick={() => setActiveMetal(metal)}
              className="group relative bg-white border border-slate-200 p-12 rounded-[3rem] text-left hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 overflow-hidden"
            >
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
                {metal === "GOLD" ? <Coins size={200} /> : <Database size={200} />}
              </div>
              <div className={`w-12 h-12 rounded-full mb-6 flex items-center justify-center ${metal === 'GOLD' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>
                <Activity size={24} />
              </div>
              <h2 className="text-4xl font-black text-slate-900 mb-2 italic tracking-tighter">{metal}</h2>
              <p className="text-slate-400 font-medium text-sm">Access Secure Inventory Ledger</p>
              <div className="mt-8 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 group-hover:text-slate-900">
                Unlock Vault <ArrowRight size={14} />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* --------------------------------
     LEVEL 2: PROFESSIONAL VAULT
  -------------------------------- */
  const filteredCategories = Object.values(stockByMetal[activeMetal]).filter(c => 
    c.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-h-[95vh] overflow-y-auto dashboard-bg p-4 md:p-8 lg:p-12 premium-scroll">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* TOP STATUS BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-8">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setActiveMetal(null)}
              className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"
            >
              <ArrowLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full animate-pulse ${activeMetal === 'GOLD' ? 'bg-green-700' : 'bg-green-950'}`} />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Vault Terminal</span>
              </div>
              <h1 className="text-3xl font-black text-slate-900 italic tracking-tight uppercase">
                {activeMetal} <span className="text-slate-300 not-italic font-light">Inventory</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <div className="relative group hidden sm:block">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-slate-900 outline-none w-64 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ANALYTICS STRIP */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Asset Count", value: activeStats.count, icon: Layers, unit: "Units" },
            { label: "Gross Vault Weight", value: activeStats.weight.toFixed(3), icon: Scale, unit: "grams" },
            { label: "Avg. Weight/Item", value: (activeStats.weight / activeStats.count || 0).toFixed(2), icon: TrendingUp, unit: "g/pc" },
            { label: "Active Categories", value: filteredCategories.length, icon: Activity, unit: "Sections" }
          ].map((stat, i) => (
            <div key={i} className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-white shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400"><stat.icon size={16} /></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{stat.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">{stat.value}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">{stat.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* VAULT CONTENT GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredCategories.map((cat) => (
            <div 
              key={cat.category}
              className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:border-slate-900 transition-all duration-300 group flex flex-col justify-between min-h-[320px]"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest px-3 py-1 bg-amber-50 rounded-full">Validated</span>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mt-4 leading-tight">
                    {cat.category}
                  </h3>
                </div>
                <button 
                  onClick={() => openHistoryModal(activeMetal, cat.category)}
                  className="p-3 rounded-2xl bg-slate-50 text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                >
                  <History size={18} />
                </button>
              </div>

              <div className="my-8 space-y-6">
                <div className="flex justify-between items-end border-b border-slate-50 pb-4">
                  <span className="text-xs font-bold text-slate-400">Total Net Weight</span>
                  <div className="text-right">
                    <span className="text-3xl font-black text-slate-900 leading-none">{cat.grossWeight.toFixed(2)}</span>
                    <span className="text-xs font-black text-slate-400 ml-1">G</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="font-bold text-slate-700">{cat.quantity} Items In-Stock</span>
                  </div>
                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest italic">
                    {((cat.grossWeight / activeStats.weight) * 100).toFixed(1)}% Share
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  const purity = Object.keys(cat.purityMap)[0];
                  navigate(`/internal/items?category=${cat.category}&purity=${purity}`);
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-2 group-hover:bg-amber-600 transition-all shadow-xl shadow-slate-900/10 active:scale-[0.98]"
              >
                Inspect Category <ArrowUpRight size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* EMPTY STATE */}
        {!loading && filteredCategories.length === 0 && (
          <div className="py-20 text-center bg-white/50 border border-dashed border-slate-200 rounded-[3rem]">
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No stock found in this sector.</p>
          </div>
        )}

        {historyOpen && (
          <StockHistoryModal
            metal={activeMetal}
            category={selectedCategory}
            onClose={() => setHistoryOpen(false)}
          />
        )}
      </div>
    </div>
  );
}