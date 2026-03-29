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
import { Search, Eye, ShoppingBag, User, Calendar, ChevronRight, Hash } from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const PAGE_SIZE = 20;

/* ================= BADGES ================= */
const StatusBadge = ({ status }) => {
  const map = {
    OPEN: "bg-[#F4EFE5] text-[#8A6F3C] border-[#E6DCCB]",
    ASSIGNED: "bg-blue-50 text-blue-600 border-blue-100",
    IN_PROGRESS: "bg-amber-50 text-amber-700 border-amber-100",
    READY: "bg-purple-50 text-purple-700 border-purple-100",
    COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <span
      className={`text-[10px] font-black px-2.5 py-1 rounded-lg border uppercase tracking-tighter ${
        map[status] || "bg-slate-100 text-slate-600 border-slate-200"
      }`}
    >
      {status?.replace("_", " ")}
    </span>
  );
};

export default function OrdersPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const [showExport,setShowExport] = useState(false);
const [startDate,setStartDate] = useState("");
const [endDate,setEndDate] = useState("");
const [exportRows,setExportRows] = useState([]);

  const fetchOrders = async (initial = true) => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "orders"),
        where("isDeleted", "==", false),
        orderBy("sortAt", "desc"),
        limit(PAGE_SIZE)
      );
      if (!initial && lastDoc) {
        q = query(
          collection(db, "orders"),
          where("isDeleted", "==", false),
          orderBy("sortAt", "desc"),
          startAfter(lastDoc),
          limit(PAGE_SIZE)
        );
      }
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRows((prev) => (initial ? data : [...prev, ...data]));
      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasNext(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("Orders fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(true);
  }, []);

  const filteredRows = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(
      (r) =>
        !s ||
        r.customer?.name?.toLowerCase().includes(s) ||
        r.customer?.mobile?.includes(s) ||
        r.orderId?.toLowerCase().includes(s) ||
        r.estimationId?.toLowerCase().includes(s)
    );
  }, [rows, search]);

  const loadMoreRef = React.useRef(null);

  useEffect(() => {
    if (!hasNext || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchOrders(false);
        }
      },
      { threshold: 0.1 }
    );
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasNext, loading]);

  // Export states

  const fetchExportData = async () => {
    if(!startDate || !endDate) return;
    const q = query(
      collection(db,"orders"),
      where("isDeleted","==",false)
    );
    const snap = await getDocs(q);
    const data = snap.docs.map(d=>({
      id:d.id,
      ...d.data()
    }));
    const filtered = data.filter(o=>{
      if(!o.createdAt?.seconds) return false;
      const d = new Date(o.createdAt.seconds*1000);
      return d >= new Date(startDate) && d <= new Date(endDate);
    });
    setExportRows(filtered);
  }

const buildReportData = () => {
  let report = [];
  let sNo = 1;
  let grandTotal = 0;
  exportRows.forEach(order=>{
    const customerName = order.customer?.name;
    const mobile = order.customer?.mobile;
    let subtotal = 0;
    order.items?.forEach((item,index)=>{
      const net = Number(item.netWeight || 0);
      const rate = Number(item.rate || 0);
      const stones = Number(item.stoneCharges || 0);
      const mc = Number(item.mcValue || 0);
      let total = net * rate + stones + mc;
      subtotal += total;
      report.push({
        "S.No": index===0 ? sNo : "",
        "Customer Name": index===0 ? customerName : "",
        "Mobile": index===0 ? mobile : "",
        "Item": item.display || item.item,
        "Gross Weight": item.gross,
        "Stone Weight": item.stoneWeight,
        "Net Weight": item.netWeight,
        "Rate": rate,
        "Total": total
      });
    });
    report.push({
      "Item":"SUBTOTAL",
      "Total": subtotal
    });
    grandTotal += subtotal;
    sNo++;
  });
  report.push({
    "Item":"GRAND TOTAL",
    "Total": grandTotal
  });
  return report;
}

const exportCSV = () => {
  const report = buildReportData();
  const ws = XLSX.utils.json_to_sheet(report);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Orders");
  const csv = XLSX.write(wb,{bookType:"csv",type:"array"});
  saveAs(new Blob([csv]),"orders_report.csv");
}

const exportExcel = () => {
  const report = buildReportData();
  const ws = XLSX.utils.json_to_sheet(report);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,"Orders");
  const excel = XLSX.write(wb,{bookType:"xlsx",type:"array"});
  saveAs(new Blob([excel]),"orders_report.xlsx");
}

  return (
    <div className="h-screen flex flex-col dashboard-bg overflow-hidden font-sans text-slate-900">
      
      {/* 1. TOP HEADER SECTION (Fixed) */}
      <div className="flex-none p-4 md:p-6 lg:px-8 lg:pt-8 bg-white border-b border-slate-200 shadow-sm z-20">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Order Management</h1>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                <ShoppingBag className="w-3 h-3 text-blue-500" /> Track & Manage Custom Designs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowExport(true)}
                className="px-4 py-2 text-xs font-black bg-emerald-600 text-white rounded-xl"
              >
              Export Report
              </button>

              <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-full uppercase">
              Total: {rows.length}
              </span>
            </div>
          </div>

          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              placeholder="Search by Name, Mobile or Order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 outline-none transition-all text-sm font-medium"
            />
          </div>
        </div>
      </div>

      {/* 2. MAIN DATA AREA (Scrollable) */}
      <div className="flex-1 overflow-y-auto premium-scroll p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          
          {/* DESKTOP TABLE VIEW (lg: screens) */}
          <div className="hidden lg:block bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="px-6 py-5">Date & Reference</th>
                  <th className="px-6 py-5">Customer Profile</th>
                  <th className="px-6 py-5 text-center">Items</th>
                  <th className="px-6 py-5 text-right">Order Value</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  <th className="px-6 py-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredRows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-900 leading-none mb-1.5">
                          {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString("en-IN") : "—"}
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded">
                          <Hash className="w-2.5 h-2.5" /> {r.estimationId || r.orderId}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-xs">
                          {r.customer?.name?.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 leading-none mb-1">{r.customer?.name}</p>
                          <p className="text-[11px] font-bold text-slate-400 tracking-tighter">{r.customer?.mobile}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5 text-center">
                      <span className="px-3 py-1 rounded-full bg-slate-100 text-xs font-black text-slate-600">
                        {r.summary?.itemCount || 0}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-black text-slate-900">
                      ₹{r.summary?.totalAmount?.toLocaleString("en-IN")}
                    </td>
                    <td className="px-6 py-5 text-center">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => navigate(`/sales/orders/${r.id}`)}
                        className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white hover:shadow-lg hover:shadow-blue-200 transition-all active:scale-90"
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE & TABLET CARD VIEW (sm/md screens) */}
          <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 pb-12">
            {filteredRows.map((r) => (
              <div
                key={r.id}
                onClick={() => navigate(`/sales/orders/${r.id}`)}
                className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm active:scale-[0.98] transition-all flex flex-col justify-between"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white">
                      <User size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 leading-tight">{r.customer?.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{r.customer?.mobile}</p>
                    </div>
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4 p-4 bg-slate-50 rounded-2xl">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Items</p>
                    <p className="text-sm font-black text-slate-900">{r.summary?.itemCount || 0} Products</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Order Value</p>
                    <p className="text-sm font-black text-blue-600">₹{r.summary?.totalAmount?.toLocaleString("en-IN")}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar size={12} />
                    <span className="text-[10px] font-black uppercase">
                      {r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleDateString("en-IN") : "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase">
                    ID: {r.estimationId || r.orderId} <ChevronRight size={14} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* EMPTY STATE */}
          {!loading && filteredRows.length === 0 && (
            <div className="py-24 text-center">
              <div className="inline-flex p-6 rounded-full bg-slate-100 text-slate-300 mb-4">
                <ShoppingBag size={48} />
              </div>
              <h3 className="text-lg font-black text-slate-400 uppercase tracking-widest">No Orders Found</h3>
              <p className="text-sm text-slate-400 font-medium">Try adjusting your search filters.</p>
            </div>
          )}

          {/* 3. LOADING & PAGINATION TRIGGER (Fixed) */}
          <div ref={loadMoreRef} className="py-10 flex justify-center">
            {loading && (
              <div className="flex items-center gap-3">
                 <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]"></div>
                 <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]"></div>
                 <div className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></div>
              </div>
            )}
            {!hasNext && rows.length > 0 && (
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">End of Records</span>
            )}
          </div>
        </div>
      </div>
      
      {/* MOBILE BOTTOM GRADIENT (For better thumb scrolling) */}
      <div className="md:hidden fixed bottom-0 left-0 w-full h-12 bg-gradient-to-t from-white pointer-events-none" />
            {showExport && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
              <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100">
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-900">
                    Export Orders Report
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Select Date Range
                  </p>
                </div>
                {/* Body */}
                <div className="p-6 space-y-4">
                  {/* Start Date */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* End Date */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase text-slate-400">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {/* Fetch Button */}
                  <button
                    onClick={fetchExportData}
                    className="w-full py-3 rounded-xl bg-blue-600 text-white text-xs font-black uppercase tracking-widest hover:bg-blue-700 transition"
                  >
                    Fetch Records
                  </button>
                  {/* Records Found */}
                  {exportRows.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-xs font-bold text-slate-500 text-center">
                        {exportRows.length} records found
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={exportCSV}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition"
                        >
                          Export CSV
                        </button>
                        <button
                          onClick={exportExcel}
                          className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition"
                        >
                          Export Excel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100">
                  <button
                    onClick={() => setShowExport(false)}
                    className="w-full py-2 rounded-xl border border-slate-300 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}