import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { 
  Search, 
  ChevronDown, 
  Eye, 
  Printer, 
  History, 
  User, 
  Hash, 
  ArrowRight 
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE = 20;

/* ================= BADGES ================= */

const TypeBadge = ({ type }) => {
  const map = {
    DIRECT_SALE: "bg-blue-50 text-blue-600 border-blue-100",
    ORDER: "bg-purple-50 text-purple-600 border-purple-100",
  };
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter ${map[type] || "bg-slate-100"}`}>
      {type?.replace("_", " ")}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    OPEN: "bg-slate-100 text-slate-600 border-slate-200",
    YET_TO_SALE: "bg-amber-50 text-amber-700 border-amber-100",
    CLOSED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter ${map[status]}`}>
      {status?.replace("_", " ")}
    </span>
  );
};

/* ================= MAIN ================= */

export default function EstimationLogs() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState("");

  const navigate = useNavigate();

  /* ================= FETCH LOGIC ================= */

  const fetchLogs = async (initial = true) => {
    setLoading(true);

    try {
      let q = query(
        collection(db, "sales_estimations"),
        where("isDeleted", "==", false),
        where("isLogVisible", "==", true),
        orderBy("sortAt", "desc"),
        limit(PAGE_SIZE)
      );

      if (!initial && lastDoc) {
        q = query(
          collection(db, "sales_estimations"),
          where("isDeleted", "==", false),
          where("isLogVisible", "==", true),
          orderBy("sortAt", "desc"),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }

      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      setRows((prev) => (initial ? data : [...prev, ...data]));
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasNext(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("Logs fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs(true);
  }, []);

  /* ================= FILTER & SEARCH ================= */

  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();

    return rows.filter(
      (r) =>
        !s ||
        r.customer?.name?.toLowerCase().includes(s) ||
        r.customer?.mobile?.includes(s) ||
        r.estimationId?.toLowerCase().includes(s)
    );
  }, [rows, search]);

  return (
    <div className="h-screen flex flex-col bg-[#F8FAFC] overflow-hidden font-sans text-slate-900">
      
      {/* 1. HEADER SECTION (Fixed) */}
      <div className="flex-none p-4 md:p-6 lg:px-8 lg:pt-8 bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                <History className="w-6 h-6 text-blue-600" /> Estimation Logs
              </h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
                Archive of Finalized Sales & Closed Orders
              </p>
            </div>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2 rounded-2xl">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Records Found:</span>
              <span className="text-sm font-black text-blue-600">{rows.length}</span>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              placeholder="Search by name, mobile, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTENT AREA (Scrollable) */}
      <div className="flex-1 overflow-y-auto premium-scroll p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          
          {/* DESKTOP TABLE VIEW */}
          <div className="hidden lg:block bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-8 py-5">Timestamp & ID</th>
                  <th className="px-8 py-5">Customer Profile</th>
                  <th className="px-8 py-5 text-center">Items</th>
                  <th className="px-8 py-5 text-right">Grand Total</th>
                  <th className="px-8 py-5 text-center">Category</th>
                  <th className="px-8 py-5 text-center">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900 mb-1">
                          {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString("en-IN") : "—"}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 w-fit px-2 py-0.5 rounded leading-none">
                          <Hash className="w-2.5 h-2.5" /> {r.estimationId}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-[10px]">
                          {r.customer?.name?.charAt(0) || <User size={14}/>}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 leading-none mb-1">{r.customer?.name || "Walk-in Customer"}</p>
                          <p className="text-[11px] font-bold text-slate-400 tracking-tighter">{r.customer?.mobile}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-black text-slate-600">
                        {r.summary?.itemCount || 0}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-right font-black text-slate-900 text-base">
                      ₹{r.summary?.totalAmount?.toLocaleString("en-IN")}
                    </td>
                    <td className="px-8 py-6 text-center">
                      <TypeBadge type={r.type} />
                    </td>
                    <td className="px-8 py-6 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex justify-end gap-2">
                        {/* FIX: Using estimationId ensures the details page finds the record */}
                        <button
                          onClick={() => navigate(`/sales/estimations/direct-sale/${r.estimationId}`)}
                          className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white hover:shadow-lg transition-all active:scale-90"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        <button
                          onClick={() => navigate(`/direct-sale/${r.estimationId}?print=true`)}
                          className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-amber-500 hover:text-white hover:shadow-lg transition-all active:scale-90"
                          title="Print Receipt"
                        >
                          <Printer size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE & TABLET CARD VIEW */}
          <div className="lg:hidden flex flex-col gap-4 pb-20">
            {filteredRows.map((r) => (
              <div key={r.id} className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm active:scale-[0.98] transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                      <User size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 leading-tight">{r.customer?.name || "Walk-in"}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{r.customer?.mobile}</span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-tighter">Total Amount</p>
                    <p className="text-sm font-black text-blue-600">₹{r.summary?.totalAmount?.toLocaleString("en-IN")}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-tighter">Estimation ID</p>
                    <p className="text-sm font-black text-slate-900">{r.estimationId}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                  <div className="flex gap-2">
                    <TypeBadge type={r.type} />
                    <span className="text-[10px] font-bold text-slate-400">{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : ""}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/sales/estimations/direct-sale/${r.estimationId}`)} className="p-2.5 rounded-xl bg-slate-100 text-slate-600"><Eye size={16}/></button>
                    <button onClick={() => navigate(`/direct-sale/${r.estimationId}?print=true`)} className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100"><Printer size={16}/></button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* EMPTY STATE */}
          {!loading && filteredRows.length === 0 && (
            <div className="py-32 text-center">
              <div className="inline-flex p-8 rounded-[2.5rem] bg-slate-100 text-slate-300 mb-6">
                <History size={64} strokeWidth={1} />
              </div>
              <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest">No Logs Found</h3>
              <p className="text-sm text-slate-400 mt-2">Adjust your filters or try a different search term.</p>
            </div>
          )}

          {/* LOAD MORE TRIGGER */}
          {hasNext && (
            <div className="flex justify-center pt-8 pb-12">
              <button
                onClick={() => fetchLogs(false)}
                disabled={loading}
                className="group flex items-center gap-3 px-10 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? "Syncing..." : <>Load More Activity <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" /></>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM GRADIENT */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white pointer-events-none z-10" />

    </div>
  );
}