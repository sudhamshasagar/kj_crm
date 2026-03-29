import React, { useEffect, useState, useMemo } from "react";
import { X, ShieldCheck, Plus, Trash2, Percent, Loader2, CreditCard, Banknote, Hash, Info } from "lucide-react";
import { functions } from "../../firebaseConfig";
import { useAdminPasscode } from "../../hooks/useAdminPasscode";
import { httpsCallable } from "firebase/functions";

// Types for better tracking
const PAYMENT_METHODS = [
  { id: "CASH", label: "Cash", icon: <Banknote size={14}/>, needsRef: false },
  { id: "UPI", label: "UPI/GPay", icon: <Hash size={14}/>, needsRef: true },
  { id: "NEFT", label: "Bank Transfer", icon: <CreditCard size={14}/>, needsRef: true },
];

export default function PaymentModal({ open, onClose, estimationId, totalAmount, exchangeItems, investmentAmount, onSuccess, adminUser }) {
  const { verifyPasscode, loading: verifying } = useAdminPasscode();
  
  const [mode, setMode] = useState("FULL"); // FULL | PARTIAL | SPLIT
  const [percentage, setPercentage] = useState(10);
  const [partialAmount, setPartialAmount] = useState(Math.round(totalAmount * 0.1));
  
  // Enterprise Split State: Tracking method, amount, and Reference IDs for audits
  const [splits, setSplits] = useState([
    { id: Date.now(), type: "CASH", amount: totalAmount, refNo: "" }
  ]);
  
  const [passcode, setPasscode] = useState("");
  const [verified, setVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Calculations ---
  const totalPaidInSplits = useMemo(() => splits.reduce((sum, s) => sum + Number(s.amount || 0), 0), [splits]);
  const difference = totalAmount - totalPaidInSplits;
  const isSplitValid = mode === "SPLIT" ? (difference === 0 && splits.every(s => s.type === 'CASH' || s.refNo.length > 3)) : true;

  const handlePercentChange = (val) => {
    const p = Math.min(100, Math.max(0, Number(val)));
    setPercentage(p);
    setPartialAmount(Math.round((p / 100) * totalAmount));
  };

  const updateSplit = (id, field, value) => {
    setSplits(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  // --- Audit-Safe Submission ---
  const handleAuthorizeSale = async () => {
  if (!verified) return;

  setIsSubmitting(true);

  try {

    /* ---------------- BUILD PAYMENT TRANSACTIONS ---------------- */

    let transactions = [];

    if (mode === "FULL") {
      transactions = [
        {
          amount: totalAmount,
          method: "CASH",
          reference: null
        }
      ];
    }

    if (mode === "PARTIAL") {
      transactions = [
        {
          amount: partialAmount,
          method: "CASH",
          reference: null
        }
      ];
    }

    if (mode === "SPLIT") {
      transactions = splits.map(s => ({
        amount: Number(s.amount),
        method: s.type,
        reference: s.refNo || null
      }));
    }

    /* ---------------- RECORD PAYMENT FIRST ---------------- */

    const recordPayment = httpsCallable(functions, "recordPayment");
    await recordPayment({
      estimationId,
      transactions
    });
    /* ---------------- CLOSE SALE ---------------- */
    const closeSale = httpsCallable(functions, "secureCloseSale");
    const exchangeValue = exchangeItems?.reduce(
  (sum, i) => sum + Number(i.value || 0),
  0
) || 0;

const paidAmount =
  mode === "SPLIT"
    ? totalPaidInSplits
    : mode === "PARTIAL"
    ? partialAmount
    : totalAmount;

const manualDiscount =
  Number(totalAmount || 0) -
  Number(paidAmount || 0) -
  Number(exchangeValue || 0) -
  Number(investmentAmount || 0);

    await closeSale({
      estimationId,
      exchangeValue,
      manualDiscount
    });
    onSuccess?.();
    onClose();
  } catch (e) {
    console.error("Sale Authorization Error:", e);
    alert(`Audit Failure: ${e.message}`);
  } finally {
    setIsSubmitting(false);
  }
};

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden border border-white/20">
        
        {/* Header: Audit Context */}
        <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
          <div>
            <h2 className="font-bold text-slate-800 text-lg">Settlement Registry</h2>
            <div className="flex gap-2 items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              <span>Ref: {estimationId?.slice(-8)}</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"/>
              <span>Admin: {adminUser?.name || 'Authorized Personnel'}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-all"><X size={20}/></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Amount Display */}
          <div className="bg-slate-900 rounded-3xl p-5 text-center text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10"><ShieldCheck size={60}/></div>
             <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Total Invoice Value</span>
             <div className="text-3xl font-black">₹{totalAmount.toLocaleString('en-IN')}</div>
          </div>

          {/* Mode Switcher */}
          <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-2xl">
            {["FULL", "PARTIAL", "SPLIT"].map(m => (
              <button key={m} onClick={() => setMode(m)} 
                className={`py-2 rounded-xl text-[10px] font-black transition-all ${mode === m ? "bg-white text-indigo-600 shadow-sm ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700"}`}>
                {m}
              </button>
            ))}
          </div>

          {/* Dynamic Forms */}
          <div className="min-h-[160px]">
            {mode === "PARTIAL" && (
              <div className="space-y-4 animate-in slide-in-from-bottom-2">
                <div className="flex items-end gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Advance Percent</label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-100 rounded-2xl px-4 py-3 mt-1 focus-within:border-indigo-500 transition-all">
                       <input type="number" value={percentage} onChange={(e) => handlePercentChange(e.target.value)} className="w-full bg-transparent font-bold text-xl outline-none" />
                       <Percent size={18} className="text-slate-400"/>
                    </div>
                  </div>
                  <div className="flex-1 bg-indigo-50 border-2 border-indigo-100 rounded-2xl px-4 py-3 text-center">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase">Receiving Now</label>
                    <div className="text-xl font-black text-indigo-700">₹{partialAmount.toLocaleString()}</div>
                  </div>
                </div>
                <input type="range" min="1" max="99" value={percentage} onChange={(e) => handlePercentChange(e.target.value)} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
                <div className="flex items-center gap-2 text-orange-600 bg-orange-50 p-3 rounded-xl">
                    <Info size={14}/>
                    <p className="text-[10px] font-medium leading-tight">This will create a ledger entry for the remaining ₹{(totalAmount - partialAmount).toLocaleString()} due.</p>
                </div>
              </div>
            )}

            {mode === "SPLIT" && (
              <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {splits.map((s) => (
                  <div key={s.id} className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex gap-2">
                      <select value={s.type} onChange={(e) => updateSplit(s.id, "type", e.target.value)} className="bg-white border rounded-lg px-2 py-1 text-[10px] font-bold outline-none ring-1 ring-slate-200">
                        {PAYMENT_METHODS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                      </select>
                      <input type="number" placeholder="Amount" value={s.amount} onChange={(e) => updateSplit(s.id, "amount", Number(e.target.value))} className="flex-1 bg-white border rounded-lg px-3 py-1 text-sm font-bold outline-none focus:ring-2 ring-indigo-500/20"/>
                      {splits.length > 1 && <button onClick={() => setSplits(splits.filter(x => x.id !== s.id))} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>}
                    </div>
                    {s.type !== "CASH" && (
                      <input type="text" placeholder="Transaction Reference (UTR/Ref No)" value={s.refNo} onChange={(e) => updateSplit(s.id, "refNo", e.target.value)} className="w-full bg-white border border-dashed border-slate-300 rounded-lg px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider focus:border-indigo-500 outline-none transition-all"/>
                    )}
                  </div>
                ))}
                <button onClick={() => setSplits([...splits, { id: Date.now(), type: "UPI", amount: 0, refNo: "" }])} className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-[10px] font-black text-slate-400 hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                  <Plus size={14}/> ADD PAYMENT CHANNEL
                </button>
              </div>
            )}

            {mode === "FULL" && (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-emerald-50/50 rounded-3xl border border-emerald-100">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-3"><Banknote/></div>
                <h4 className="text-xs font-black text-emerald-800 uppercase tracking-tighter">Instant Full Settlement</h4>
                <p className="text-[11px] text-emerald-600/70 mt-1 max-w-[200px]">Transaction will be marked as paid in full via Cash/Single Channel.</p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="space-y-4 pt-2">
            {mode === "SPLIT" && (
              <div className={`p-3 rounded-2xl text-center flex justify-between items-center transition-all ${difference === 0 ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <span className="text-[10px] font-black uppercase tracking-widest">Reconciliation</span>
                <span className="font-mono font-bold">{difference === 0 ? "BALANCED" : `DIFF: ₹${difference.toLocaleString()}`}</span>
              </div>
            )}

            {!verified ? (
              <div className="flex gap-2">
                <input type="password" placeholder="ADMIN PIN" value={passcode} onChange={(e) => setPasscode(e.target.value)} className="flex-1 bg-slate-100 rounded-2xl px-5 py-4 text-sm font-black tracking-[0.5em] outline-none border-2 border-transparent focus:border-indigo-500 transition-all"/>
                <button onClick={async () => (await verifyPasscode(passcode)) && setVerified(true)} className="bg-slate-900 text-white px-8 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all">
                  {verifying ? <Loader2 className="animate-spin" size={18}/> : "VERIFY"}
                </button>
              </div>
            ) : (
              <button onClick={handleAuthorizeSale} disabled={isSubmitting || !isSplitValid}
                className={`w-full py-5 rounded-3xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 transition-all shadow-xl ${
                  isSubmitting || !isSplitValid ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 text-white shadow-indigo-200 hover:scale-[1.02] active:scale-95'
                }`}>
                {isSubmitting ? <Loader2 className="animate-spin" size={20}/> : <><ShieldCheck size={20}/> Authorize & Log Sale</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}