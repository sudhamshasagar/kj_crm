import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import GSTInvoiceA5 from "../../components/common/GSTInvoiceA5";
import { Save, ArrowLeft, User, Package, Calculator, Info, CheckCircle, Loader2 } from "lucide-react";

export default function EditInvoice() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoiceData, setInvoiceData] = useState(null);
  const [form, setForm] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sales_estimations", id), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setInvoiceData(data);
      setForm({
        customer: { ...data.customer },
        items: [...data.invoice.items],
        adjustments: { ...data.invoice.adjustments },
        totals: { ...data.invoice.totals }
      });
    });
    return () => unsub();
  }, [id]);

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...form.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    if (field === "grossWeight" || field === "stoneWeight") {
      const g = field === "grossWeight" ? value : (updatedItems[index].grossWeight || 0);
      const s = field === "stoneWeight" ? value : (updatedItems[index].stoneWeight || 0);
      updatedItems[index].netWeight = parseFloat((g - s).toFixed(3));
    }
    setForm({ ...form, items: updatedItems });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const editInvoice = httpsCallable(functions, "editInvoice");
      await editInvoice({
        estimationId: id,
        updates: { items: form.items, customer: form.customer, adjustments: form.adjustments }
      });
      alert("Success: Invoice updated!");
    } catch (e) {
      alert("Error: Could not save changes.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!form) return <div className="h-screen flex items-center justify-center font-bold text-gray-400">Loading Editor...</div>;

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      
      {/* 1. TOP NAV */}
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full"><ArrowLeft size={20}/></button>
          <div>
            <h1 className="text-xs font-black uppercase tracking-widest text-slate-800">Edit Invoice</h1>
            <p className="text-[10px] text-blue-600 font-mono">{invoiceData.invoice.number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
          <CheckCircle size={12}/> LIVE SYNC ACTIVE
        </div>
      </nav>

      <main className="flex-1 flex overflow-hidden">
        
        {/* LEFT COLUMN: SCROLLABLE FORM */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-8 bg-[#F8FAFC]">
          
          {/* Customer Info */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <User size={14}/> Customer Profile
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <InputField label="Full Name" value={form.customer.name} onChange={(v) => setForm({...form, customer:{...form.customer, name: v}})} />
              <InputField label="Contact Number" value={form.customer.mobile} onChange={(v) => setForm({...form, customer:{...form.customer, mobile: v}})} />
            </div>
          </section>

          {/* Items Section */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Package size={14}/> Inventory & Weights
            </h2>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[9px] font-black text-slate-400 uppercase tracking-wider">
                    <th className="px-6 py-4">Item Details</th>
                    <th className="px-4 py-4 text-center">Gross (g)</th>
                    <th className="px-4 py-4 text-center">Stone (g)</th>
                    <th className="px-4 py-4 text-center">Net (g)</th>
                    <th className="px-6 py-4 text-right">Rate /g</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {form.items.map((item, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <input value={item.category} onChange={(e)=>handleItemChange(i, "category", e.target.value)} className="font-bold text-slate-700 bg-transparent outline-none w-full"/>
                        <input value={item.huid || ""} placeholder="HUID" onChange={(e)=>handleItemChange(i, "huid", e.target.value)} className="text-[10px] text-slate-400 bg-transparent outline-none w-full block mt-0.5"/>
                      </td>
                      <td className="px-4 py-4"><input type="number" value={item.grossWeight} onChange={(e)=>handleItemChange(i,"grossWeight", Number(e.target.value))} className="w-full text-center font-mono font-bold outline-none bg-transparent"/></td>
                      <td className="px-4 py-4"><input type="number" value={item.stoneWeight} onChange={(e)=>handleItemChange(i,"stoneWeight", Number(e.target.value))} className="w-full text-center font-mono font-bold text-orange-500 outline-none bg-transparent"/></td>
                      <td className="px-4 py-4 text-center font-mono font-black text-blue-600 bg-blue-50/30">{item.netWeight}</td>
                      <td className="px-6 py-4"><input type="number" value={item.rate} onChange={(e)=>handleItemChange(i,"rate", Number(e.target.value))} className="w-full text-right font-mono font-bold text-emerald-600 outline-none bg-transparent"/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Adjustments */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <Calculator size={14}/> Financials
            </h2>
            <div className="grid grid-cols-2 gap-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <InputField label="Old Gold Exchange (₹)" color="amber" type="number" value={form.adjustments.exchange} onChange={(v)=>setForm({...form, adjustments:{...form.adjustments, exchange: Number(v)}})} />
              <InputField label="Discount (₹)" color="emerald" type="number" value={form.adjustments.discount} onChange={(v)=>setForm({...form, adjustments:{...form.discount, discount: Number(v)}})} />
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: PREVIEW & COMPACT SUMMARY */}
        <aside className="hidden lg:flex w-[400px] bg-slate-100 border-l border-slate-200 flex-col overflow-hidden">
          
          {/* Action Card (Compact Summary) */}
          <div className="p-5 bg-white border-b border-slate-200 space-y-4 shadow-sm z-10">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Net Payable</span>
                <div className="text-3xl font-black text-slate-900 leading-none">
                  ₹{form.totals?.grand?.toLocaleString('en-IN')}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[9px] font-bold text-slate-400 block">TAX INCL.</span>
                <span className="text-[11px] font-mono font-bold text-slate-600">GST 3%</span>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full bg-slate-900 hover:bg-black text-white py-3.5 rounded-xl font-black tracking-tight text-sm shadow-lg shadow-slate-200 transition-all active:scale-95 disabled:bg-slate-300 flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18}/> : <><Save size={18}/> SAVE CHANGES</>}
            </button>
          </div>

          {/* Scrollable Preview Area */}
          <div className="flex-1 overflow-y-auto p-6 flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-4">
              <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase">Live PDF Preview</span>
              <span className="px-2 py-0.5 bg-slate-200 rounded text-[9px] font-bold text-slate-600">A5</span>
            </div>
            
            <div className="bg-white shadow-xl rounded-sm border border-slate-300 overflow-hidden transform scale-[0.85] origin-top">
               <GSTInvoiceA5 {...form} invoiceNo={invoiceData.invoice.number} date={invoiceData.closedAt?.seconds*1000} />
            </div>

            <div className="mt-4 flex gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
               <Info className="text-blue-500 shrink-0" size={16}/>
               <p className="text-[10px] text-blue-800/70 leading-relaxed font-medium">
                 Verify weights and rates. Totals update automatically in the sidebar summary above.
               </p>
            </div>
          </div>
        </aside>

      </main>

      {/* MOBILE ONLY ACTION BAR (Hidden on LG) */}
      <div className="lg:hidden p-4 bg-white border-t border-slate-200 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase">Payable</span>
            <span className="text-xl font-black text-slate-900">₹{form.totals?.grand?.toLocaleString('en-IN')}</span>
          </div>
          <button onClick={handleSave} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center gap-2">
            <Save size={16}/> Save
          </button>
      </div>

    </div>
  );
}

function InputField({ label, value, onChange, type = "text", color = "blue" }) {
  const colors = {
    blue: "focus:border-blue-500",
    amber: "focus:border-amber-500 text-amber-700",
    emerald: "focus:border-emerald-500 text-emerald-700",
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">{label}</label>
      <input 
        type={type}
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        className={`w-full text-base font-bold outline-none border-b border-slate-200 py-1 transition-all bg-transparent ${colors[color]}`}
      />
    </div>
  );
}