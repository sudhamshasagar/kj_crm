import React, { useState, useEffect } from "react";
import { 
  collection, query, orderBy, limit, startAfter, 
  getDocs, where, doc, updateDoc 
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { 
  Banknote, Search, ChevronLeft, ChevronRight, 
  Filter, Edit3, Loader2, Save, X 
} from "lucide-react";
import toast from "react-hot-toast";

const PAGE_SIZE = 25;

export default function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState(null); // Cursor for Next
  const [firstDoc, setFirstDoc] = useState(null); // Cursor for Previous
  const [pageStack, setPageStack] = useState([]); // To track history for "Back"
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  // 1. Core Fetch Function
  const fetchPayments = async (cursor = null, direction = 'next') => {
    setLoading(true);
    try {
      let q = query(
        collection(db, "ALL_PAYMENTS"),
        orderBy("createdAt", "desc"),
        limit(PAGE_SIZE)
      );

      if (cursor) {
        q = query(q, startAfter(cursor));
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      setPayments(docs);
      setFirstDoc(snap.docs[0]);
      setLastDoc(snap.docs[snap.docs.length - 1]);
    } catch (err) {
      console.error(err);
      toast.error("Error loading high-volume data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPayments(); }, []);

  // 2. Pagination Logic
  const handleNext = () => {
    setPageStack([...pageStack, firstDoc]);
    fetchPayments(lastDoc);
  };

  const handlePrevious = () => {
    const prevCursor = pageStack[pageStack.length - 1];
    const newStack = pageStack.slice(0, -1);
    setPageStack(newStack);
    fetchPayments(prevCursor, 'prev');
  };

  const handleManualEditRef = async (paymentId, newRef) => {
  const confirmChange = window.confirm("Are you sure you want to manually change this Reference Number?");
  if (confirmChange) {
    try {
      await updateDoc(doc(db, "ALL_PAYMENTS", paymentId), {
        ref: newRef,
        isManuallyEdited: true
      });
      toast.success("Reference updated manually");
    } catch (e) {
      toast.error("Failed to update reference");
    }
  }
};

  // 3. Inline Edit Reference (As requested)
  const handleUpdateRef = async (id) => {
    try {
      await updateDoc(doc(db, "ALL_PAYMENTS", id), { ref: editValue });
      setPayments(payments.map(p => p.id === id ? { ...p, ref: editValue } : p));
      setEditingId(null);
      toast.success("Reference Updated");
    } catch (e) { toast.error("Update failed"); }
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50 p-6 overflow-hidden font-sans">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0">
        <div>
          {/* <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <Banknote className="w-8 h-8 text-emerald-600" /> Financial Ledger
          </h1> */}
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Payments History</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" 
              placeholder="Search by exact Reference (e.g. P501)..."
              onKeyDown={(e) => e.key === 'Enter' && toast.info("Deep search triggered...")}
            />
          </div>
        </div>
      </div>

      {/* TABLE AREA */}
      <div className="flex-1 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <table className="w-full text-left border-collapse relative">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-100">
              <tr className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                <th className="px-6 py-4">Receipt Ref</th>
                <th className="px-6 py-4">Origin</th>
                <th className="px-6 py-4">Customer</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Mode</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center text-slate-400 italic">
                    <Loader2 className="animate-spin inline mr-2" /> Optimizing data stream...
                  </td>
                </tr>
              ) : payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4">
                    {editingId === p.id ? (
                      <div className="flex items-center gap-2">
                        <input 
                          className="border border-emerald-500 rounded px-2 py-1 text-sm font-bold w-24 outline-none"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                        />
                        <button onClick={() => handleUpdateRef(p.id)} className="text-emerald-600"><Save className="w-4 h-4"/></button>
                        <button onClick={() => setEditingId(null)} className="text-slate-400"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <span className="font-mono font-black text-blue-600 bg-blue-50 px-2 py-1 rounded-md border border-blue-100 text-xs">
                        {p.ref || 'UNLINKED'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                      p.source === 'Investment' 
                      ? 'bg-amber-100 text-amber-700 border-amber-200' 
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                    }`}>
                      {p.source}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{p.customerName}</div>
                    <div className="text-[10px] text-slate-400">{p.date}</div>
                  </td>
                  <td className="px-6 py-4 font-black text-slate-900">₹{p.amount?.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded uppercase">{p.mode || 'CASH'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button 
                      onClick={() => { setEditingId(p.id); setEditValue(p.ref); }}
                      className="opacity-0 group-hover:opacity-100 p-2 hover:bg-slate-200 rounded-full transition-all"
                    >
                      <Edit3 className="w-4 h-4 text-slate-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="px-6 py-4 bg-slate-50 border-t flex justify-between items-center shrink-0">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
            Showing {payments.length} records per page
          </div>
          <div className="flex gap-2">
            <button 
              disabled={pageStack.length === 0 || loading}
              onClick={handlePrevious}
              className="p-2 border rounded-xl bg-white hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              disabled={payments.length < PAGE_SIZE || loading}
              onClick={handleNext}
              className="p-2 border rounded-xl bg-white hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}