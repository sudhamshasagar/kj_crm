
import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Phone, MapPin, Edit3, Loader2,
  Banknote, Calendar, ShieldCheck, Briefcase,
  Coins, Clock, Hash, Save, X,ArrowUpRight
} from "lucide-react";
import { db, ESTIMATION_LOGS } from "../firebaseConfig";
import {
  collection, query, where, getDocs,
  doc, updateDoc, serverTimestamp, getDoc,increment, limit, orderBy
} from "firebase/firestore";

import toast from "react-hot-toast";

/* ---------------- HELPERS ---------------- */

const formatDate = (ts) => {
  if (!ts) return "N/A";
  try { return ts.toDate().toLocaleDateString(); }
  catch { return "N/A"; }
};

/* ---------------- MAIN ---------------- */

export default function CustomerProfilePage() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [records, setRecords] = useState([]);
  const [investments, setInvestments] = useState([]);

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [editForm, setEditForm] = useState({
  name: "",
  mobile: "",
  secondaryMobile: "",
  email: "",
  city: "",
  address: "",
  dob: "",
  panNumber: "",
  aadhaarNumber: "",
});
  const [modalMode, setModalMode] = useState("all");

  /* -------------------------------------------------- */
  /* LOAD DATA — PARALLEL & FAST                        */
  /* -------------------------------------------------- */

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // 1️⃣ Get customer (new system → fallback old system)
        let snap = await getDoc(doc(db, "CUSTOMERS", customerId));
        let data = null;

        if (snap.exists()) {
          data = { docId: snap.id, ...snap.data() };
        } else {
          const q = query(collection(db, "CUSTOMERS"), where("customerId", "==", customerId));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) data = { docId: qSnap.docs[0].id, ...qSnap.docs[0].data() };
        }

        if (!data) return setLoading(false);

        setCustomer(data);
        setEditForm({
            name: data.name || "",
            mobile: data.mobile || "",
            secondaryMobile: data.secondaryMobile || "",
            email: data.email || "",
            city: data.city || "",
            address: data.address || "",
            dob: data.dob || "",
            panNumber: data.panNumber || "",
            aadhaarNumber: data.aadhaarNumber || "",
        });

        // 2️⃣ Parallel fetch → MUCH faster
        const [logsSnap, invSnap] = await Promise.all([
        getDocs(query(
            ESTIMATION_LOGS,
            where("customerId", "==", data.customerId),
            orderBy("timestamp", "desc"),   // ✅ ensures correct latest order
            limit(20)                       // ✅ prevents large download
        )),
        getDocs(query(
        collection(db, "INVESTMENTS"),
        where("customerId", "==", data.customerId)
        )),
        ]);

        setRecords(
          logsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
        );

        setInvestments(invSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // 3️⃣ Non-blocking visit update
        updateDoc(doc(db, "CUSTOMERS", data.docId), {
        lastVisit: serverTimestamp(),
        totalVisits: increment(1),   // ✅ race-safe
        });

      } catch (e) {
        console.error("Customer load error:", e);
      }

      setLoading(false);
    })();
  }, [customerId]);

  /* -------------------------------------------------- */
  /* UPDATE PROFILE                                     */
  /* -------------------------------------------------- */

  const handleUpdate = async () => {
    if (!editForm.name || !editForm.mobile) {
      return toast.error("Required fields missing");
    }

    await updateDoc(doc(db, "CUSTOMERS", customer.docId), editForm);

    setCustomer(prev => ({ ...prev, ...editForm }));
    setIsEditing(false);
    toast.success("Profile Updated");
  };

  /* -------------------------------------------------- */
  /* DERIVED DATA                                       */
  /* -------------------------------------------------- */

  const activeInvestments = useMemo(
    () => investments.filter(i => i.status === "ACTIVE").length,
    [investments]
  );

  const latestInvoices = records.slice(0, 20); // safe render limit

  /* -------------------------------------------------- */
  /* LOADING / EMPTY                                    */
  /* -------------------------------------------------- */

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!customer) {
    return <div className="h-screen flex items-center justify-center">Customer Not Found</div>;
  }

  const { name, mobile, city, lifetimeValue, highestPurchase, lastVisit } = customer;

  /* -------------------------------------------------- */
  /* UI                                                 */
  /* -------------------------------------------------- */

return (
    <div className=" overflow-hidden lg:max-h-[95vh] bg-[#F8FAFC] text-slate-900 font-sans selection:bg-amber-100">
      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)} 
            className="group p-2 hover:bg-slate-100 rounded-xl transition-all active:scale-95"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500 group-hover:text-slate-900" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-heavy tracking-tight text-slate-900">{name}</h1>
              <span className="px-2 py-0.5 rounded-full bg-amber-50 text-[10px] font-bold text-amber-700 uppercase tracking-wider border border-amber-100">
                {activeInvestments > 0 ? "Premium Member" : "Standard"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500 mt-0.5">
              <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {mobile}</span>
              <span className="h-3 w-[1px] bg-slate-200" />
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {city || "Location Not Set"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
        
        {/* STATS GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPI label="Lifetime Value" value={`₹${(lifetimeValue || 0).toLocaleString()}`} icon={Banknote} color="bg-emerald-50 text-emerald-600" />
          {/* <KPI label="Highest Order" value={`₹${(highestPurchase || 0).toLocaleString()}`} icon={Wallet} color="bg-blue-50 text-blue-600" /> */}
          <KPI label="Active Portfolios" value={activeInvestments} icon={Briefcase} color="bg-amber-50 text-amber-600" />
          <KPI label="Last Engagement" value={formatDate(lastVisit)} icon={Clock} color="bg-purple-50 text-purple-600" />
        </section>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* LEFT COLUMN: NAVIGATION & QUICK INFO */}
          <aside className="lg:w-64 flex-shrink-0 space-y-6">
            <button
            onClick={() => {
            setModalMode("all");
            setEditForm({ ...customer });
            setIsEditing(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-all shadow-sm active:ring-2 ring-slate-200"
            >
            <Edit3 className="w-4 h-4" /> Edit Profile
            </button>
            <nav className="flex flex-col gap-1">
              <Tab active={activeTab === "overview"} onClick={() => setActiveTab("overview")} label="Overview" icon={ShieldCheck} />
              <Tab active={activeTab === "investments"} onClick={() => setActiveTab("investments")} label="Investments" count={investments.length} icon={Coins} />
              <Tab active={activeTab === "orders"} onClick={() => setActiveTab("orders")} label="Invoice History" count={records.length} icon={Hash} />
            </nav>
          </aside>

          {/* RIGHT COLUMN: DYNAMIC CONTENT */}
          <section className="flex-1">
            <div className="bg-white border border-slate-200 rounded-3xl p-6 max-h-[70vh] overflow-y-auto premium-scrollbar shadow-sm">
              {activeTab === "overview" && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    
                    {/* IDENTITY GRID */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <InfoCard 
                        title="Date of Birth" 
                        value={customer.dob} 
                        icon={Calendar} 
                        onEdit={() => { setEditForm({...customer}); setIsEditing(true); }}
                    />
                    <InfoCard 
                        title="PAN Card" 
                        value={customer.panNumber || "Not Linked"} 
                        icon={ShieldCheck} 
                        onEdit={() => { setEditForm({...customer}); setModalMode("pan"); setIsEditing(true); }}
                    />
                    <InfoCard 
                        title="Aadhaar Number" 
                        value={customer.aadhaarNumber || "Not Linked"} 
                        icon={Hash} 
                        onEdit={() => {
                        setEditForm({ ...customer });
                        setModalMode("aadhaar");
                        setIsEditing(true);
                        }}
                    />
                    </div>

                    {/* CONTACT & EMAIL */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                    <InfoCard 
                        title="Secondary Mobile" 
                        value={customer.secondaryMobile || "No Backup Number"} 
                        icon={Phone} 
                        onEdit={() => {
                        setEditForm({ ...customer });
                        setModalMode("contact");
                        setIsEditing(true);
                        }}
                    />
                    <InfoCard 
                        title="Email Address" 
                        value={customer.email || "No Email Provided"} 
                        icon={Briefcase} 
                        onEdit={() => {
                        setEditForm({ ...customer });
                        setModalMode("contact");
                        setIsEditing(true);
                        }}
                    />
                    </div>

                    {/* COMPACT ADDRESS BOX */}
                    <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Registered Address</p>
                        </div>
                        <button
                            onClick={() => {
                                setEditForm({ ...customer });
                                setModalMode("address");
                                setIsEditing(true);
                            }}
                            className="text-[9px] font-bold text-amber-600 hover:underline"
                            >
                            EDIT ADDRESS
                        </button>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                        {customer.address || "No address provided. Adding an address helps in KYC verification."}
                    </p>
                    </div>
                </div>
                )}

              {activeTab === "investments" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-bold">Portfolio Holdings</h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {investments.length > 0 ? investments.map(inv => (
                      <div key={inv.id} className="group hover:border-amber-200 transition-colors bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                        <div className="flex justify-between items-start mb-3">
                          <p className="font-bold text-slate-800 uppercase text-xs tracking-tight">{inv.schemeName}</p>
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold">{inv.schemeType}</span>
                        </div>
                        <p className="text-2xl font-black text-slate-900">
                          {inv.schemeType === "SIP"
                            ? `₹${(inv.totalInvestedAmount || 0).toLocaleString()}`
                            : `${(inv.totalGramsAccumulated || 0).toFixed(3)}g`}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">{inv.investmentId}</p>
                      </div>
                    )) : (
                      <div className="col-span-full py-12 text-center text-slate-400">No active investments found.</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "orders" && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300 max-h-[60vh] overflow-y-auto premium-scrollbar">
                  <h3 className="text-lg font-bold">Transaction History</h3>
                  <div className="overflow-hidden rounded-2xl border border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                        <tr>
                          <th className="px-6 py-3">Date</th>
                          <th className="px-6 py-3">Transaction ID</th>
                          <th className="px-6 py-3 text-right">Amount</th>
                          <th className="px-6 py-3"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {latestInvoices.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4 text-sm text-slate-600">{formatDate(r.timestamp)}</td>
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{r.id.slice(0, 8)}...</td>
                            <td className="px-6 py-4 text-right font-bold text-slate-900">₹{(r.summary?.grandTotal || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => navigate(`/sales/estimations/logs?id=${r.id}`)}
                                className="p-2 rounded-lg hover:bg-amber-50 text-amber-600 transition-colors"
                              >
                                <ArrowUpRight className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {records.length === 20 && (
                    <button
                      onClick={() => navigate(`/sales/invoices?customer=${customerId}`)}
                      className="w-full py-4 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors uppercase tracking-widest"
                    >
                      Show Full Transaction Ledger ({records.length})
                    </button>
                  )}
                </div>
              )}

            </div>
          </section>
        </div>
      </main>

      {/* MODAL REDESIGN */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsEditing(false)} />
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* MODAL HEADER */}
            <div className="bg-slate-50 px-8 py-6 border-b border-slate-100">
                <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">
                    {modalMode === "address" ? "Update Address" : 
                    modalMode === "pan" ? "Link PAN Card" : 
                    modalMode === "aadhaar" ? "Link Aadhaar" : "Edit Profile"}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-1">Editing record for <span className="text-amber-600">{customer.name}</span></p>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                    <X className="w-5 h-5 text-slate-400" />
                </button>
                </div>
            </div>

            <div className="p-8">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                
                {/* DYNAMIC FIELD RENDERING */}
                {(modalMode === "all" || modalMode === "contact") && (
                    <>
                    <FormGroup label="Full Name" value={editForm.name} onChange={(val) => setEditForm({...editForm, name: val})} />
                    <FormGroup label="Primary Mobile" value={editForm.mobile} onChange={(val) => setEditForm({...editForm, mobile: val})} />
                    <FormGroup label="Secondary Mobile" value={editForm.secondaryMobile} onChange={(val) => setEditForm({...editForm, secondaryMobile: val})} />
                    <FormGroup label="Email ID" value={editForm.email} onChange={(val) => setEditForm({...editForm, email: val})} />
                    </>
                )}

                {modalMode === "pan" && (
                    <FormGroup label="PAN Card Number" placeholder="ABCDE1234F" value={editForm.panNumber} onChange={(val) => setEditForm({...editForm, panNumber: val.toUpperCase()})} />
                )}

                {modalMode === "aadhaar" && (
                    <FormGroup label="Aadhaar Card Number" placeholder="1234 5678 9012" value={editForm.aadhaarNumber} onChange={(val) => setEditForm({...editForm, aadhaarNumber: val})} />
                )}

                {modalMode === "address" && (
                    <>
                    <FormGroup label="City / Region" value={editForm.city} onChange={(val) => setEditForm({...editForm, city: val})} />
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Complete Address</label>
                        <textarea
                        rows={4}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all resize-none text-sm"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        placeholder="Street name, Building, Area, Pincode..."
                        />
                    </div>
                    </>
                )}

                {modalMode === "all" && (
                    <FormGroup label="Date of Birth" type="date" value={editForm.dob} onChange={(val) => setEditForm({...editForm, dob: val})} />
                )}
                </div>

                <button 
                onClick={handleUpdate} 
                className="w-full mt-8 py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                <Save className="w-5 h-5" /> Save Information
                </button>
            </div>
            </div>
        </div>
        )}
    </div>
  );
}

/* ---------------- UI SMALL COMPONENTS ---------------- */

/* ---------------- UPDATED UI COMPONENTS ---------------- */

const KPI = ({ label, value, icon: Icon, color = "bg-amber-50 text-amber-600" }) => (
  <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const Tab = ({ active, onClick, label, count, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
      active 
        ? "bg-white text-slate-900 shadow-sm border border-slate-200" 
        : "text-slate-500 hover:bg-slate-100"
    }`}
  >
    <div className="flex items-center gap-3">
      {Icon && <Icon className={`w-4 h-4 ${active ? "text-amber-600" : "text-slate-400"}`} />}
      {label}
    </div>
    {count !== undefined && (
      <span className={`text-[10px] px-2 py-0.5 rounded-md ${active ? "bg-slate-100" : "bg-slate-200/50"}`}>
        {count}
      </span>
    )}
  </button>
);

const InfoCard = ({ title, value, icon: Icon, onEdit }) => {
  const isMissing = !value || value.toLowerCase().includes("not") || value.toLowerCase().includes("no");
  
  return (
    <div 
      onClick={isMissing && onEdit ? onEdit : undefined}
      className={`group border rounded-xl p-3 transition-all ${
        isMissing && onEdit 
          ? "bg-slate-50 border-dashed border-slate-300 cursor-pointer hover:border-amber-400 hover:bg-amber-50/30" 
          : "bg-white border-slate-100 shadow-sm"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`w-3.5 h-3.5 ${isMissing ? "text-slate-400" : "text-amber-600"}`} />}
          <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
        </div>
        {isMissing && (
          <span className="text-[9px] font-bold text-amber-600 opacity-0 group-hover:opacity-100 transition-opacity">
            CLICK TO ADD
          </span>
        )}
      </div>
      <p className={`text-xs font-semibold ${isMissing ? "text-slate-400 italic" : "text-slate-900"}`}>
        {value}
      </p>
    </div>
  );
};

const FormGroup = ({ label, value, onChange, type = "text", placeholder = "" }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 tracking-wider">{label}</label>
    <input
      type={type}
      placeholder={placeholder}
      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all text-sm font-medium"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);