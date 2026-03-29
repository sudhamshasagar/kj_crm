import React, { useEffect, useState, useRef, useCallback } from "react";
import { 
  collection, query, where, orderBy, limit, 
  startAfter, getDocs, onSnapshot 
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { useNavigate } from "react-router-dom";
import { 
  Search, Filter, Eye, Download, Edit, FileText, 
  Clock, Calendar, ChevronRight, MoreHorizontal, 
  ArrowUpRight, History, Receipt
} from "lucide-react";

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  
  const navigate = useNavigate();
  const observer = useRef();

  // --- Logic: Initial Load & Real-time Sync ---
  useEffect(() => {
    setLoading(true);
    const q = query(
      collection(db, "sales_estimations"),
      where("status", "==", "CLOSED"),
      orderBy("closedAt", "desc"),
      limit(12)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 12);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Logic: Pagination ---
  const loadMore = async () => {
    if (!lastDoc || loading || !hasMore) return;
    setLoading(true);
    const nextQ = query(
      collection(db, "sales_estimations"),
      where("status", "==", "CLOSED"),
      orderBy("closedAt", "desc"),
      startAfter(lastDoc),
      limit(12)
    );
    const snap = await getDocs(nextQ);
    if (!snap.empty) {
      setInvoices(prev => [...prev, ...snap.docs.map(d => ({ id: d.id, ...d.data() }))]);
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 12);
    } else { setHasMore(false); }
    setLoading(false);
  };

  const lastElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) loadMore();
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, lastDoc]);

  const filteredInvoices = invoices.filter(inv => 
    inv.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.invoice?.number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col dashboard-bg overflow-hidden font-sans antialiased text-slate-900">
      
      {/* FIXED TOP NAVIGATION */}
      <nav className="px-6 py-5 border-b border-slate-200/60 bg-white/40 backdrop-blur-md z-20">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white">
              <Receipt size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tighter uppercase">Invoices</h1>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-72 group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search name or ID..." 
                className="w-full bg-white/60 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-semibold focus:ring-4 focus:ring-orange-500/10 focus:border-orange-300 outline-none transition-all"
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="p-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 shadow-sm"><Filter size={18}/></button>
          </div>
        </div>
      </nav>

      {/* SCROLLABLE GRID AREA */}
      <main className="flex-1 overflow-y-auto p-4 md:p-8 premium-scroll">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredInvoices.map((inv) => (
              <InvoiceCard 
                key={inv.id} 
                inv={inv} 
                isExpanded={expandedId === inv.id}
                onExpand={() => setExpandedId(expandedId === inv.id ? null : inv.id)}
                navigate={navigate}
              />
            ))}
          </div>

          {/* INFINITE SCROLL TARGET */}
          <div ref={lastElementRef} className="py-20 flex flex-col items-center justify-center">
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"/>
                <span className="text-[9px] font-black text-slate-400 uppercase">Fetching Ledger</span>
              </div>
            ) : !hasMore && (
              <div className="h-[1px] w-full max-w-xs bg-slate-200 relative">
                <span className="absolute left-1/2 -top-2 -translate-x-1/2 bg-transparent text-[9px] font-black text-slate-300 uppercase px-2 tracking-widest">End of Records</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function InvoiceCard({ inv, isExpanded, onExpand, navigate }) {
  // Restore all History logic
  const history = (() => {
    const rows = [{ type: "ESTIMATED", date: inv.createdAt, amount: inv.summary?.totalAmount }];
    if (inv.invoice?.paymentLedger) {
      inv.invoice.paymentLedger.forEach(p => rows.push({ type: "PAYMENT", date: p.createdAt, mode: p.method, ref: p.reference, amount: p.amount }));
    }
    if (inv.status === "CLOSED") rows.push({ type: "PURCHASED", date: inv.closedAt, ref: inv.invoice?.number, amount: inv.invoice?.totals?.grand });
    return rows.sort((a,b) => (a.date?.seconds || 0) - (b.date?.seconds || 0));
  })();

  return (
    <div className={`group bg-white/80 border border-white/60 rounded-[2rem] transition-all duration-500 flex flex-col shadow-sm hover:shadow-xl hover:shadow-orange-100/50 ${isExpanded ? 'ring-2 ring-orange-400/20 translate-y-[-4px]' : ''}`}>
      
      {/* HEADER SECTION */}
      <div className="p-6 pb-4 flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100 uppercase tracking-tighter">
              {inv.invoice?.number || 'DRAFT'}
            </span>
          </div>
          <h3 className="text-lg font-black text-slate-800 leading-tight">{inv.customer?.name}</h3>
          <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
            <Calendar size={12}/>
            {inv.closedAt?.seconds ? new Date(inv.closedAt.seconds * 1000).toLocaleDateString("en-IN") : "-"}
          </div>
        </div>
        <button onClick={onExpand} className={`p-2.5 rounded-xl transition-all ${isExpanded ? 'bg-orange-500 text-white shadow-lg' : 'bg-slate-100 text-slate-400 hover:text-slate-900'}`}>
          <Clock size={18}/>
        </button>
      </div>

      {/* FINANCE SECTION */}
      <div className="px-6 py-4 flex items-center justify-between bg-slate-50/40 border-y border-slate-100/50">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Settled Total</p>
          <div className="text-2xl font-black text-slate-900 leading-none mt-1">
            <span className="text-sm font-bold opacity-30 mr-1">₹</span>
            {inv.invoice?.totals?.grand?.toLocaleString("en-IN")}
          </div>
        </div>
       
      </div>

      {/* TIMELINE (ONLY IF EXPANDED) */}
      {isExpanded && (
        <div className="p-6 bg-slate-50/60 animate-in fade-in slide-in-from-top-2">
          <div className="space-y-4 relative">
             <div className="absolute left-[7px] top-2 bottom-2 w-[1px] bg-slate-200"/>
             {history.map((h, i) => (
                <div key={i} className="flex gap-4 relative z-10">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm mt-1 ${h.type === 'PAYMENT' ? 'bg-emerald-500' : 'bg-blue-500'}`}/>
                  <div className="flex-1 text-[11px]">
                    <div className="flex justify-between font-black text-slate-800 uppercase tracking-tighter">
                      <span>{h.type}</span>
                      <span className="text-slate-400">₹{Number(h.amount || 0).toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 font-bold">{h.mode !== "-" ? h.mode : (h.ref || "Initial Entry")}</p>
                  </div>
                </div>
             ))}
          </div>
        </div>
      )}

      {/* FOOTER ACTIONS - FULL WIDTH FOR MOBILE ACCESSIBILITY */}
      <div className="p-4 bg-white/40 border-t border-slate-100/50 grid grid-cols-2 gap-2 mt-auto">
         {/* <button onClick={() => navigate(`/invoice/${inv.id}`)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black bg-slate-900 text-white uppercase tracking-widest hover:opacity-90 transition-all">
            <FileText size={14}/> View Full Detail
         </button> */}
         <button onClick={() => navigate(`/invoice/${inv.id}?download=true`)} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black border border-emerald-200 text-emerald-600 bg-emerald-50 uppercase tracking-widest hover:bg-emerald-100 transition-all">
            <Download size={14}/> PDF Invoice
         </button>
          <div className="flex gap-1.5">
           <button onClick={() => navigate(`/invoice/${inv.id}/preview`)} title="Preview" className="w-10 h-10 bg-white border border-slate-200 text-slate-600 rounded-xl flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all shadow-sm"><Eye size={18}/></button>
           <button onClick={() => navigate(`/invoice/${inv.id}/edit`)} title="Edit" className="w-10 h-10 bg-white border border-slate-200 text-amber-600 rounded-xl flex items-center justify-center hover:bg-amber-500 hover:text-white transition-all shadow-sm"><Edit size={18}/></button>
        </div>
      </div>
    </div>
  );
}