import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Users,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Phone,
  MessageCircle,
  MoreVertical,
  ArrowUpRight,
  TrendingUp,
  UserCheck
} from "lucide-react";

import {
  query,
  orderBy,
  where,
  startAfter,
  limit,
  endBefore,
  limitToLast,
  onSnapshot,
  getCountFromServer,
} from "firebase/firestore";

import { CUSTOMERS_COLLECTION } from "../../utils/customerService";
import { useNavigate } from "react-router-dom";
import _ from "lodash";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";

const PAGE_SIZE = 15;
const MIN_SEARCH = 2;

const toProperCase = (str = "") =>
  str.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [firstDoc, setFirstDoc] = useState(null);
  const [lastDoc, setLastDoc] = useState(null);
  const [totalCustomers, setTotalCustomers] = useState(0);

  const unsubscribeRef = useRef(null);

  /* ---------- FIREBASE LOGIC (Unchanged) ---------- */
  const buildQuery = (direction = "next", term = "", first = null, last = null) => {
    if (term && term.length >= MIN_SEARCH) {
      const normalized = term.trim();
      const isPhoneSearch = /^\d+$/.test(normalized);
      if (isPhoneSearch) {
        return query(CUSTOMERS_COLLECTION, orderBy("phone"), where("phone", ">=", normalized), where("phone", "<=", normalized + "\uf8ff"), limit(PAGE_SIZE));
      } else {
        return query(CUSTOMERS_COLLECTION, orderBy("name"), where("name", ">=", normalized), where("name", "<=", normalized + "\uf8ff"), limit(PAGE_SIZE));
      }
    }
    if (direction === "next") {
      return last ? query(CUSTOMERS_COLLECTION, orderBy("lastVisit", "desc"), startAfter(last), limit(PAGE_SIZE)) : query(CUSTOMERS_COLLECTION, orderBy("lastVisit", "desc"), limit(PAGE_SIZE));
    }
    return query(CUSTOMERS_COLLECTION, orderBy("lastVisit", "desc"), endBefore(first), limitToLast(PAGE_SIZE));
  };

  const startListener = (direction = "next", term = "", first = null, last = null) => {
    setLoading(true);
    if (unsubscribeRef.current) unsubscribeRef.current();
    const q = buildQuery(direction, term, first, last);
    unsubscribeRef.current = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCustomers(list);
      setFirstDoc(snap.docs[0] || null);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setLoading(false);
    });
  };

  useEffect(() => {
    const fetchTotal = async () => {
      const snapshot = await getCountFromServer(CUSTOMERS_COLLECTION);
      setTotalCustomers(snapshot.data().count);
    };
    fetchTotal();
  }, []);

  const debouncedSearch = useMemo(() => _.debounce((term) => {
    setCurrentPage(1);
    startListener("next", term);
  }, 400), []);

  useEffect(() => {
    debouncedSearch(search);
    return () => debouncedSearch.cancel();
  }, [search, debouncedSearch]);

  const handleNext = () => { setCurrentPage((p) => p + 1); startListener("next", search, null, lastDoc); };
  const handlePrev = () => { setCurrentPage((p) => Math.max(1, p - 1)); startListener("prev", search, firstDoc, null); };

  const handleSendSelected = async () => {
    if (!window.confirm("Send to selected numbers?")) return;
    const fn = httpsCallable(functions, "sendMarketingToSelected");
    await fn({ numbers: ["79795073574"] });
    alert("Campaign Sent");
  };

  return (
    <div className="h-screen flex flex-col dashboard-bg overflow-hidden">
      
      {/* HEADER SECTION */}
      <header className="bg-white/80 backdrop-blur-md border-b border-orange-100/50 px-6 py-4">
        <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800">Directory</h1>
            <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">
              {totalCustomers} Clients
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-orange-500 transition-colors" size={16} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search phone or name..."
                className="w-full md:w-80 pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-4 focus:ring-orange-500/10 outline-none transition-all text-sm"
              />
            </div>
            
            <div className="flex bg-white rounded-xl border border-slate-200 p-1">
              <button onClick={handlePrev} disabled={currentPage === 1} className="p-1.5 hover:bg-slate-50 disabled:opacity-20 transition-all rounded-lg"><ChevronLeft size={18}/></button>
              <button onClick={handleNext} disabled={customers.length < PAGE_SIZE} className="p-1.5 hover:bg-slate-50 disabled:opacity-20 transition-all rounded-lg"><ChevronRight size={18}/></button>
            </div>

            <button onClick={handleSendSelected} className="hidden lg:flex items-center gap-2 px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-lg active:scale-95">
              Broadcast
            </button>
          </div>
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="flex-1 overflow-hidden p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto w-full flex flex-col">
        
        {loading ? (
          <SkeletonLoader />
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            
            {/* DESKTOP TABLE (Hidden on Small/Medium) */}
            <div className="hidden lg:block flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden relative">
              <div className="absolute inset-0 overflow-y-auto premium-scroll">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50/90 backdrop-blur-md z-10 border-b">
                    <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      <th className="px-8 py-5">Customer Identity</th>
                      <th className="px-8 py-5">Contact Details</th>
                      <th className="px-8 py-5">Location</th>
                      {/* <th className="px-8 py-5 text-right">LTV (Revenue)</th> */}
                      <th className="px-8 py-5 text-center">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {customers.map((c) => (
                      <tr key={c.id} onClick={() => navigate(`/sales/customers/${c.id}`)} className="group hover:bg-orange-50/30 cursor-pointer transition-all">
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 group-hover:bg-green-600 group-hover:text-white transition-all uppercase">
                              {c.name?.[0] || "C"}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{toProperCase(c.name)}</p>
                              {c.lifetimeValue > 500000 && <span className="text-[8px] font-black text-orange-600 uppercase tracking-tighter bg-orange-100 px-1.5 py-0.5 rounded">VIP</span>}
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-4 font-mono text-xs text-slate-600 font-medium">
                          {c.mobile || c.phone || "—"}
                        </td>
                        <td className="px-8 py-4">
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <MapPin size={14} className="opacity-40" />
                            {c.city || "Sagara"}
                          </div>
                        </td>
                        {/* <td className="px-8 py-4 text-right">
                          <span className="text-sm font-black text-slate-900">₹{Number(c.lifetimeValue || 0).toLocaleString()}</span>
                        </td> */}
                        <td className="px-8 py-4 text-center">
                          <div className="flex justify-center gap-2">
                            <a href={`tel:${c.mobile}`} onClick={(e) => e.stopPropagation()} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><Phone size={16}/></a>
                            <a href={`https://wa.me/${c.mobile}`} onClick={(e) => e.stopPropagation()} className="p-2 text-slate-300 hover:text-emerald-500 transition-colors"><MessageCircle size={16}/></a>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* MOBILE/TABLET CARDS (Hidden on Large screens) */}
            <div className="lg:hidden flex-1 overflow-y-auto space-y-4 pb-20">
              {customers.map((c) => (
                <div key={c.id} onClick={() => navigate(`/sales/customers/${c.id}`)} className="bg-white border border-slate-200 rounded-[2rem] p-6 shadow-sm active:scale-[0.98] transition-all">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase">
                        {c.name?.[0] || "C"}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900">{toProperCase(c.name)}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{c.city || "Sagara"}</p>
                      </div>
                    </div>
                    {c.lifetimeValue > 50000 && <span className="bg-orange-100 text-orange-600 p-2 rounded-xl"><UserCheck size={18}/></span>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Lifetime Value</span>
                      <span className="text-sm font-black text-slate-700">₹{Number(c.lifetimeValue || 0).toLocaleString()}</span>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <span className="block text-[9px] uppercase font-black text-slate-400 mb-1">Contact</span>
                      <span className="text-sm font-black text-slate-700">{c.mobile || "—"}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                     <a href={`tel:${c.mobile}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-[10px] uppercase tracking-widest">Call</a>
                     <a href={`https://wa.me/${c.mobile}`} onClick={(e) => e.stopPropagation()} className="flex-1 flex items-center justify-center py-3 rounded-xl bg-emerald-50 text-emerald-600 font-bold text-[10px] uppercase tracking-widest">WhatsApp</a>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </main>

    </div>
  );
}

/* ---------------- HELPERS ---------------- */

function SkeletonLoader() {
  return (
    <div className="flex-1 bg-white border border-slate-100 rounded-3xl p-8 animate-pulse">
      <div className="h-6 w-1/4 bg-slate-50 rounded-lg mb-8" />
      <div className="space-y-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
      <Users size={64} strokeWidth={1} className="opacity-20 mb-4" />
      <p className="font-bold uppercase tracking-widest text-xs">No Clients Matched</p>
    </div>
  );
}