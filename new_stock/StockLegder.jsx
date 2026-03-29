import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { X, Calendar, ArrowUpRight, Tag, Clock, PackagePlus, FileText, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function StockHistoryModal({ metal, category, onClose }) {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, "stock_ledger"),
      where("metal", "==", metal),
      where("category", "==", category),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe();
  }, [metal, category]);

  const eventStyles = {
    ADDED: { label: "Stock Added", color: "text-emerald-600", bg: "bg-emerald-50", dot: "bg-emerald-500", icon: <PackagePlus size={14}/> },
    RESERVED_DRAFT: { label: "Reserved", color: "text-amber-600", bg: "bg-amber-50", dot: "bg-amber-500", icon: <Clock size={14}/> },
    RELEASED_DRAFT: { label: "Released", color: "text-slate-500", bg: "bg-slate-50", dot: "bg-slate-400", icon: <Tag size={14}/> },
    RESERVED_QUOTATION: { label: "Locked", color: "text-orange-600", bg: "bg-orange-50", dot: "bg-orange-500", icon: <Tag size={14}/> },
    SOLD: { label: "Sold", color: "text-blue-600", bg: "bg-blue-50", dot: "bg-blue-500", icon: <FileText size={14}/> }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-end sm:items-center justify-center z-[100] p-0 sm:p-4">
      <div className="bg-white w-full max-w-5xl h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 duration-500">
        
        {/* HEADER: Clean & Minimal */}
        <div className="flex justify-between items-center px-6 py-5 sm:px-10 sm:py-8 border-b border-slate-50">
          <div className="flex items-center gap-4">
            <div className={`hidden sm:flex w-12 h-12 rounded-2xl items-center justify-center ${metal === 'GOLD' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
              <Clock size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tighter uppercase italic">
                {category} <span className="text-slate-300 not-italic font-light">Audit</span>
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metal} Vault History</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto px-4 py-2 sm:px-10 sm:py-6">
          
          {/* MOBILE VIEW: Lighter Timeline List */}
          <div className="block sm:hidden space-y-4 py-4">
            {rows.map((r) => {
              const style = eventStyles[r.eventType] || { label: r.eventType, color: "text-slate-500", dot: "bg-slate-300" };
              return (
                <div key={r.id} className="flex gap-4 group">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full mt-1.5 ring-4 ring-white ${style.dot}`} />
                    <div className="w-px h-full bg-slate-100 group-last:bg-transparent" />
                  </div>
                  <div className="flex-1 pb-6">
                    <div className="flex justify-between items-start mb-1">
                      <span className={`text-xs font-black uppercase tracking-tight ${style.color}`}>
                        {style.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {r.timestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                       <span className="font-mono text-[11px] text-slate-600">ID: {r.pieceBarcode}</span>
                       {r.referenceId && (
                         <button onClick={() => navigate(`/sales/invoice/${r.referenceId}`)} className="text-[10px] font-black text-blue-500 flex items-center gap-0.5">
                           INV <ChevronRight size={10} />
                         </button>
                       )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DESKTOP VIEW: Enhanced Grid */}
          <table className="hidden sm:table w-full text-left">
            <thead>
              <tr className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">
                <th className="pb-6">Date & Time</th>
                <th className="pb-6">Transaction Type</th>
                <th className="pb-6">Piece Identity</th>
                <th className="pb-6 text-right">Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((r) => {
                const style = eventStyles[r.eventType] || { label: r.eventType, color: "text-slate-600", bg: "bg-slate-100", icon: <Tag size={12}/> };
                return (
                  <tr key={r.id} className="group hover:bg-slate-50/50 transition-all">
                    <td className="py-5">
                      <div className="text-sm font-bold text-slate-700">
                        {r.timestamp ? r.timestamp.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : "-"}
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase">
                         {r.timestamp ? r.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                      </div>
                    </td>
                    <td className="py-5">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border border-transparent font-black text-[10px] uppercase tracking-wider ${style.bg} ${style.color}`}>
                        {style.icon}
                        {style.label}
                      </div>
                    </td>
                    <td className="py-5 font-mono text-xs font-bold text-slate-500">
                      {r.pieceBarcode}
                    </td>
                    <td className="py-5 text-right">
                      {r.referenceId ? (
                        <button onClick={() => navigate(`/sales/invoice/${r.referenceId}`)} className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all">
                          <ArrowUpRight size={16} />
                        </button>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase">Internal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {rows.length === 0 && (
            <div className="py-20 text-center text-slate-300 font-bold uppercase text-xs tracking-widest">
              No ledger entries found
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="hidden sm:flex px-10 py-6 bg-slate-50/50 border-t border-slate-100 justify-between items-center">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Entries: {rows.length}</span>
          <button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-slate-900/10">
            Exit Audit
          </button>
        </div>
      </div>
    </div>
  );
}