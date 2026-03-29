import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag, Package, ArrowRight, Clock, Search, Clock10Icon } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { collection, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function EstimationEntry() {
  const navigate = useNavigate();
  const { role, user } = useAuth();

  const [directLogs, setDirectLogs] = useState([]);
  const [orderLogs, setOrderLogs] = useState([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("ALL"); // ALL, DIRECT_SALE, CUSTOM_ORDER

  const maskMobile = (num) => {
    if (!num) return "";
    const s = num.toString();
    return s.slice(0, 3) + "••••" + s.slice(-2);
  };

  const formatDate = (ts) => {
    if (!ts?.seconds) return "";
    const date = new Date(ts.seconds * 1000);
    return date.toLocaleDateString("en-IN", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    if (role !== "Employee" || !user?.uid) {
      setLoadingRecent(false);
      return;
    }
    const last24hrs = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const unsub1 = onSnapshot(query(
      collection(db, "sales_estimations"),
      where("createdBy.uid", "==", user.uid),
      where("createdAt", ">=", last24hrs),
      orderBy("createdAt", "desc"),
      limit(20)
    ), (snap) => {
      setDirectLogs(snap.docs.map(d => ({ id: d.id, source: "DIRECT_SALE", ...d.data() })));
      setLoadingRecent(false);
    });

    const unsub2 = onSnapshot(query(
      collection(db, "orders"),
      where("createdBy.uid", "==", user.uid),
      where("sortAt", ">=", last24hrs),
      orderBy("sortAt", "desc"),
      limit(20)
    ), (snap) => {
      setOrderLogs(snap.docs.map(d => ({ id: d.id, source: "CUSTOM_ORDER", ...d.data() })));
      setLoadingRecent(false);
    });

    return () => { unsub1(); unsub2(); };
  }, [role, user]);

  const recentLogs = useMemo(() => {
    let merged = [...directLogs, ...orderLogs];
    
    // Filtering
    if (filterType !== "ALL") {
      merged = merged.filter(log => log.source === filterType);
    }
    
    // Searching
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      merged = merged.filter(log => 
        log.customer?.name?.toLowerCase().includes(s) || 
        log.customer?.mobile?.includes(s)
      );
    }

    return merged.sort((a, b) => ((b.createdAt || b.sortAt)?.seconds || 0) - ((a.createdAt || a.sortAt)?.seconds || 0));
  }, [directLogs, orderLogs, filterType, searchTerm]);

  return (
    <div className="h-screen bg-[#F1F5F9] font-sans text-slate-800 flex flex-col overflow-hidden">
      
      {/* 1. TOP BAR: NAVIGATION CARDS */}
      <div className="flex-none p-4 md:p-6 lg:p-8 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto">
          <header className="mb-6 hidden lg:block">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Estimation Generator and Overview</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Create New Estimation and View Your Estimations</p>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
            <button
              onClick={() => navigate("/sales/estimations/direct-sale")}
              className="group relative flex items-center justify-between p-5 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-3xl shadow-sm hover:shadow-md hover:border-amber-300 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-5">
                <div className="p-4 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200 group-hover:rotate-6 transition-transform">
                  <ShoppingBag size={24} />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-black text-slate-900">Direct Sale</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Existing Stock</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                <ArrowRight size={20} />
              </div>
            </button>

            <button
              onClick={() => navigate("/sales/estimations/custom-order")}
              className="group relative flex items-center justify-between p-5 bg-gradient-to-br from-white to-slate-50 border border-slate-200 rounded-3xl shadow-sm hover:shadow-md hover:border-blue-300 transition-all active:scale-[0.98]"
            >
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-200 group-hover:-rotate-6 transition-transform">
                  <Package size={24} />
                </div>
                <div className="text-left">
                  <h2 className="text-lg font-black text-slate-900">Custom Order</h2>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Bespoke Production</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <ArrowRight size={20} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* 2. ACTIVITY LOG AREA */}
      <div className="flex-1 flex flex-col min-h-0 dashboard-bg">
        
        {/* LOG HEADER & FILTERS */}
        <div className="flex-none px-4 md:px-6 lg:px-8 py-4 lg:py-6">
          <div className="max-w-7xl mx-auto flex flex-col gap-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                  <Clock size={16} />
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Activity</h3>
              </div>
              <span className="text-[10px] font-black text-slate-400 bg-white border border-slate-200 px-3 py-1 rounded-full uppercase">Last 24h</span>
            </div>

            {/* SEARCH & FILTER BAR */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1 group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search customer name or mobile..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all shadow-sm"
                />
              </div>
              
              <div className="flex p-1 bg-slate-200/50 rounded-2xl border border-slate-200/50">
                {["ALL", "DIRECT_SALE", "CUSTOM_ORDER"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${
                      filterType === type 
                        ? "bg-white text-slate-900 shadow-sm" 
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {type.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. LOG CONTENT: CARDS & TABLES */}
        <div className="flex-1 overflow-y-auto premium-scroll px-4 md:px-6 lg:px-8 pb-12">
          <div className="max-w-7xl mx-auto">
            
            {/* DESKTOP TABLE (Hidden on MD and below) */}
            <div className="hidden lg:block bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-8 py-5 text-slate-900">Customer</th>
                    <th className="px-8 py-5">Items Breakdown</th>
                    <th className="px-8 py-5 text-right">Value</th>
                    <th className="px-8 py-5 text-center">Reference</th>
                    <th className="px-8 py-5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingRecent ? (
                    <tr><td colSpan="5" className="py-20 text-center text-slate-400 animate-pulse font-bold">Scanning recent activity...</td></tr>
                  ) : recentLogs.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50/80 transition-colors group cursor-default">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs uppercase">
                            {e.customer?.name?.charAt(0) || "W"}
                          </div>
                          <div>
                            <p className="font-black text-slate-900">{e.customer?.name || "Walk-in"}</p>
                            <p className="text-[11px] font-bold text-slate-400 font-mono tracking-tighter">{maskMobile(e.customer?.mobile)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="flex flex-wrap gap-1">
                          {(e.items || []).slice(0, 2).map((item, i) => (
                            <span key={i} className="px-2 py-1 bg-slate-100 text-[10px] font-bold text-slate-500 rounded-lg">
                              {item.productName || item.name}
                            </span>
                          ))}
                          {e.items?.length > 2 && <span className="text-[10px] font-black text-blue-500 ml-1">+{e.items.length - 2} more</span>}
                        </div>
                      </td>
                      <td className="px-8 py-6 text-right font-black text-slate-900">
                        ₹{e.summary?.totalAmount?.toLocaleString("en-IN")}
                      </td>
                      <td className="px-8 py-6 text-center">
                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          e.source === "DIRECT_SALE" ? "bg-amber-50 text-amber-700 border-amber-100" : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}>
                          {e.source.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <p className="text-xs font-bold text-slate-400">{formatDate(e.createdAt || e.sortAt)}</p>
                        <Clock10Icon className="inline-block ml-2 w-4 h-4 text-slate-300 group-hover:translate-x-1 group-hover:text-blue-500 transition-all" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* RESPONSIVE CARDS (Visible on SM/MD/LG below 1024px) */}
            <div className="lg:hidden flex flex-col gap-3">
              {recentLogs.map((e) => (
                <div key={e.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm active:bg-slate-50 transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm ${e.source === "DIRECT_SALE" ? "bg-amber-500" : "bg-blue-600"}`}>
                        {e.source === "DIRECT_SALE" ? <ShoppingBag size={18} /> : <Package size={18} />}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm leading-tight">{e.customer?.name || "Walk-in"}</h4>
                        <p className="text-[10px] font-bold text-slate-400 tracking-tighter">{maskMobile(e.customer?.mobile)}</p>
                      </div>
                    </div>
                    <span className="text-xs font-black text-slate-900">₹{e.summary?.totalAmount?.toLocaleString("en-IN")}</span>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400">{formatDate(e.createdAt || e.sortAt)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* EMPTY STATE */}
            {!loadingRecent && recentLogs.length === 0 && (
              <div className="py-20 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-white rounded-full border border-slate-200 flex items-center justify-center text-slate-200 mb-6">
                  <Clock size={40} />
                </div>
                <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">Quiet in here...</h3>
                <p className="text-sm text-slate-400 font-medium">No activity matching your search in the last 24h.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 4. RECENTLY CREATED BANNER (Sticky Bottom Mobile) */}
      <div className="md:hidden flex-none p-3 bg-slate-900 text-white flex items-center justify-center gap-3">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-50">Live Sync Active</span>
        <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
      </div>

    </div>
  );
}