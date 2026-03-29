import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { Lock, Briefcase, Calendar, ShieldCheck, AlertCircle, Loader2, ArrowUpRight, History, Fingerprint } from "lucide-react";
import { db } from "../../firebaseConfig"; 

export default function InvestmentPublicPortal() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [mobileInput, setMobileInput] = useState("");
  const [investment, setInvestment] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
  const fetchInvestmentMetadata = async () => {
    try {
      // 1️⃣ Read PUBLIC token document
      const pubRef = doc(db, "PUBLIC_INVESTMENTS", token);
      const pubSnap = await getDoc(pubRef);

      if (!pubSnap.exists()) {
        setError("Invalid or Expired Link");
        return;
      }

      const { investmentId, expiresAt } = pubSnap.data();

      // 2️⃣ Expiry validation (if expiry exists)
      if (expiresAt && expiresAt.toDate() < new Date()) {
        setError("Link Expired");
        return;
      }

      // 3️⃣ Fetch real investment securely
      const invRef = doc(db, "INVESTMENTS", investmentId);
      const invSnap = await getDoc(invRef);

      if (!invSnap.exists()) {
        setError("Investment Not Found");
        return;
      }

      setInvestment({ id: investmentId, ...invSnap.data() });

    } catch (err) {
      setError("Network Error");
    } finally {
      setLoading(false);
    }
  };

  fetchInvestmentMetadata();
}, [token]);

  const handleVerify = async () => {
  // 🛡 Prevent crash if investment not loaded yet
  if (!investment) {
    alert("Please wait… loading details.");
    return;
  }

  // 🛡 Mobile match check
  if (mobileInput !== investment.customerMobile) {
    alert("Mobile number mismatch");
    return;
  }

  setLoading(true);

  try {
    const q = query(
      collection(db, "INVESTMENT_TRANSACTIONS"),
      where("investmentId", "==", investment.id), // ✅ use real ID
      orderBy("date", "desc")
    );

    const transSnap = await getDocs(q);
    setTransactions(transSnap.docs.map(d => ({ id: d.id, ...d.data() })));

    setVerified(true);
  } catch (e) {
    alert("Error loading transactions");
  } finally {
    setLoading(false);
  }
};

if (error) {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0A0A0B] text-white">
      <div className="text-center">
        <p className="text-lg font-bold">{error}</p>
        <p className="text-sm text-gray-500 mt-2">
          Please contact Keshav Jewellers.
        </p>
      </div>
    </div>
  );
}

  if (loading && !verified) return (
    <div className="h-screen w-full flex items-center justify-center bg-[#0A0A0B]">
      <Loader2 className="animate-spin text-amber-500 w-6 h-6" />
    </div>
  );

  if (!verified) return (
    <div className="h-screen w-full bg-[#0A0A0B] flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <Fingerprint className="w-10 h-10 text-amber-500" />
          </div>
          <h2 className="text-3xl font-bold tracking-tighter">Secure Sign-in</h2>
          <p className="text-gray-500 mt-2 text-sm uppercase tracking-widest">Keshav Jewellers Portal</p>
        </div>
        <input 
          type="tel" 
          placeholder="Registered Mobile Number"
          className="w-full bg-[#161618] border-none rounded-2xl py-5 px-6 text-center text-xl font-bold text-white focus:ring-2 focus:ring-amber-500 transition-all mb-4"
          value={mobileInput}
          onChange={e => setMobileInput(e.target.value.replace(/\D/g, ''))}
        />
        <button onClick={handleVerify} className="w-full bg-white text-black py-5 rounded-2xl font-black text-lg active:scale-95 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.1)]">
          Authorize Access
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#0A0A0B] flex flex-col overflow-hidden text-white font-sans">
      
      {/* 1. Header Area: Branding Only */}
      <header className="px-6 pt-8 pb-4 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-black text-black text-xs">KJ</div>
          <h1 className="text-sm font-bold tracking-widest uppercase opacity-60">Gold Ledger</h1>
        </div>
        <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold">LIVE</span>
        </div>
      </header>

      {/* 2. Floating Portfolio Card */}
      <div className="px-6 py-4 shrink-0">
        <div className="bg-gradient-to-br from-[#1C1C1E] to-[#121214] border border-white/5 rounded-[2.5rem] p-8 shadow-2xl">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Total Net Value</p>
          <div className="flex items-end justify-between">
            <div>
              {investment.schemeType === 'SIP' ? (
                <h2 className="text-5xl font-bold tracking-tighter italic">₹{(investment.totalInvestedAmount || 0).toLocaleString()}</h2>
              ) : (
                <>
                  <h2 className="text-5xl font-bold tracking-tighter italic">
                    {(investment.totalGramsAccumulated || 0).toFixed(3)}<span className="text-xl ml-1 text-amber-500">g</span>
                  </h2>
                  <p className="text-xs text-emerald-500 mt-2 font-medium tracking-wide">Total Paid: ₹{(investment.totalAmountPaid || 0).toLocaleString()}</p>
                </>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Status</p>
              <p className="text-amber-500 font-black text-sm uppercase">{investment.status}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Horizontal Stats Scroll (Optional Info) */}
      <div className="flex gap-4 px-6 py-2 shrink-0 overflow-x-auto no-scrollbar">
        <div className="px-5 py-3 bg-[#1C1C1E] rounded-2xl min-w-[140px] border border-white/5">
          <p className="text-[9px] text-gray-500 font-bold uppercase">Scheme</p>
          <p className="text-xs font-bold truncate">{investment.schemeName}</p>
        </div>
        <div className="px-5 py-3 bg-[#1C1C1E] rounded-2xl min-w-[140px] border border-white/5">
          <p className="text-[9px] text-gray-500 font-bold uppercase">Account</p>
          <p className="text-xs font-mono opacity-80">{investment.accountNumber || "—"}</p>
        </div>
      </div>

      {/* 4. Transactions List: The ONLY scrollable part */}
      <main className="flex-1 mt-6 flex flex-col min-h-0 bg-white rounded-t-[3rem]">
        <div className="px-8 pt-10 pb-4 flex items-center justify-between shrink-0 text-black">
          <h3 className="text-sm font-black uppercase tracking-widest opacity-40">Recent Activity</h3>
          <History className="w-4 h-4 opacity-40" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-10">
          {transactions.map((t, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl transition-all active:bg-gray-100 group">
              <div className="flex items-center gap-4">
                <div className="w-full h-12 rounded-xl flex flex-col items-center justify-center  group-hover:scale-95 transition-transform">
                  <span className="text-[8px] font-black text-gray-400 uppercase leading-none">{t.date?.split(' ')[1]}</span>
                  <span className="text-base font-black text-black leading-none">{t.date?.split(' ')[0]}</span>
                </div>
                <div>
                  <p className="text-xs font-black text-black">Deposit</p>
                  <p className="text-[10px] text-amber-900 font-bold uppercase tracking-tighter">Ref: {t.reference?.slice(-6) || 'CASH'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-black italic">
                  +{investment.schemeType === 'SIP' ? `₹${t.amount}` : `${t.grams}g`}
                </p>
                {t.installment && <span className="text-[8px] bg-black text-white px-2 py-0.5 rounded-md font-bold uppercase">M{t.installment}</span>}
              </div>
            </div>
          ))}
          
          <div className="pt-10 text-center">
            <p className="text-[10px] text-amber-900 font-medium px-8 leading-relaxed">
              Secure digital ledger provided by <b>Keshav Jewellers</b>. Verified Transaction.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}