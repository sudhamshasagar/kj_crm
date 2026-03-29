import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, query, collection, onSnapshot
} from "firebase/firestore";
import { db, functions } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import {
  User, Hammer, CheckCircle2,
  UserPlus, RefreshCw, Box, Zap, Target,
  QrCode, Edit3, X, Info
} from "lucide-react";

// Components
import ExchangeDeclarationPDF from "../common/ExchangeDeclarationPDF";
import PaymentModal from "../common/PaymentModal";
import GSTInvoiceA5 from "../common/GSTInvoiceA5";


// Hooks
import { useB2BEmployees } from "../../hooks/useB2BEmployees";
import { useB2JEmployees } from "../../hooks/useB2JEmployees";

export default function OrderDetailsPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  // --- STATE MANAGEMENT ---
  const [data, setData] = useState(null); // The Order Document
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Production/Karigar State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKarigar, setSelectedKarigar] = useState(null);
  const [adminComments, setAdminComments] = useState("");
  const [selectedItems, setSelectedItems] = useState([]);

  // Billing & Investment State
  const [billing, setBilling] = useState({
    useInvestment: false,
    investmentId: "",
    redeemAmount: 0,
    manualDiscount: 0,
    exchangeGold: { confirmed: false, items: [] }
  });
  const [investments, setInvestments] = useState([]);
  const [selectedInv, setSelectedInv] = useState(null);
  const [showInvModal, setShowInvModal] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [consentStatus, setConsentStatus] = useState(null);

  // Modals/Flow State
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);


  // Customer Management
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [editMode, setEditMode] = useState("TRANSACTION");

  const { employees: b2bEmployees } = useB2BEmployees();
  const { employees: b2jEmployees } = useB2JEmployees();
  const [bulkKarigar, setBulkKarigar] = useState("");
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  
  // --- DERIVED DATA ---
  const karigars = useMemo(() => [
    ...b2bEmployees.map(e => ({ ...e, type: "B2B" })),
    ...b2jEmployees.map(e => ({ ...e, type: "B2J" }))
  ], [b2bEmployees, b2jEmployees]);

  const allKarigarAssigned = data?.items?.every(i => i.karigarId);
  const allItemsReturned = data?.items?.every(i => i.status === "returned");
  const anyKarigarSelected = data?.items?.some(i => i.karigarId);
  const allDeliveryDatesSet = data?.items?.every(i => i.deliveryDate);
  const customer = useMemo(() => {
    const base = data?.customer || {};
    return {
      ...base,
      pan: base.pan || base.panNumber,
      mobile: base.mobile,
      address: base.address || base.city
    };
  }, [data]);

  const isClosed = data?.status === "CLOSED";

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, "orders", orderId), (snap) => {
      if (snap.exists()) {
        const orderData = snap.data();
        setData({ id: snap.id, ...orderData });
        setAdminComments(orderData.production?.adminComments || "");
        if (orderData.items?.length === 1) setSelectedItems([0]);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [orderId]);

const karigarDispatchList = useMemo(() => {

  if (!data?.items) return [];

  const map = {};

  data.items.forEach(item => {

    if (!item.karigarId) return;

    const karigar = karigars.find(k => k.id === item.karigarId);

    if (!map[item.karigarId]) {
      map[item.karigarId] = {
        name: karigar?.name || item.karigarName,
        mobile: karigar?.mobile || "",
        items: []
      };
    }

    map[item.karigarId].items.push(item);

  });

  return Object.values(map);

}, [data, karigars]);

const metrics = useMemo(() => {
  if (!data || !data.items) return { subtotal: 0, savings: 0, final: 0, rounded: 0, gst: 0, taxable: 0 };
  
  // 1. Gross is the sum of pre-calculated totals from Firestore (which include 3% GST)
  const gross = data.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  
  // 2. Deductions
  const exValue = billing.exchangeGold.items.reduce((s, i) => s + (Number(i.value) || 0), 0);
  const redeemAmount = Number(billing.redeemAmount || 0);
  const manualDiscount = Number(billing.manualDiscount || 0);

  const savings = redeemAmount + exValue + manualDiscount;
  const net = gross - savings;
  
  // 3. Reverse GST Calculation (since total = taxable * 1.03)
  // Taxable = Total / 1.03
  const taxableValue = net / 1.03;
  const gstValue = net - taxableValue;

  return {
    subtotal: gross,
    savings,
    final: net,
    rounded: Math.ceil(net / 10) * 10,
    taxable: taxableValue,
    gst: gstValue
  };
}, [data, billing]);

  const toggleItemSelection = (idx) => {
    setSelectedItems(prev => 
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  const updateItemAssignment = async (index, field, value) => {
  const updatedItems = [...data.items];

  if (field === "karigar") {
    const selected = karigars.find(k => k.id === value);

    updatedItems[index] = {
      ...updatedItems[index],
      karigarId: selected?.id || "",
      karigarName: selected?.name || "",
      karigarType: selected?.type || "",
      status: value ? "assigned" : "unassigned"
    };

  } else {
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
  }

  const newStatus = updatedItems.every(i => i.karigarId) ? "assigned" : "unassigned";

  await updateDoc(doc(db, "orders", orderId), {
    items: updatedItems,
    status: newStatus,
    "audit.lastUpdatedAt": serverTimestamp()
  });
};


  // --- KARIGAR LOGIC ---
  const handleAssignKarigar = async () => {
    if (!selectedKarigar || selectedItems.length === 0) return;
    try {
      const updatedItems = data.items.map((item, index) => {
        if (selectedItems.includes(index)) {
          return {
            ...item,
            karigarId: selectedKarigar.id,
            karigarName: selectedKarigar.name,
            karigarType: selectedKarigar.type,
            status: "assigned",
            assignedAt: new Date().toISOString()
          };
        }
        return item;
      });

      const productionUpdate = {
        "production.goldsmith": selectedItems.length === data.items.length ? selectedKarigar.name : "Multiple",
        "production.adminComments": adminComments,
        status: "assigned",
        items: updatedItems,
        "audit.lastUpdatedAt": serverTimestamp()
      };

      await updateDoc(doc(db, "orders", orderId), productionUpdate);
      setIsModalOpen(false);
    } catch (err) {
      alert("Assignment Failed");
    }
  };

  // --- INVESTMENT CONSENT LOGIC ---
  const handleLinkPlan = async () => {
    const q = query(collection(db, "INVESTMENTS"), 
      where("customerMobile", "==", customer.mobile), 
      where("status", "==", "ACTIVE")
    );
    const snap = await getDocs(q);
    setInvestments(snap.docs.map(d => ({ 
      id: d.id, 
      ...d.data(), 
      bal: (d.data().totalAmountPaid || 0) - (d.data().redeemedAmount || 0) 
    })));
    setShowInvModal(true);
  };
  useEffect(() => {
  if (!consentStatus?.tokenExpiry) return;
  const timer = setInterval(() => {
    if (Date.now() > consentStatus.tokenExpiry) {
      setConsentStatus(prev => ({ ...prev, status: "EXPIRED" }));
      clearInterval(timer);
    }
  }, 5000);
  return () => clearInterval(timer);
}, [consentStatus]);

const formatClosedDate = (ts) => {
  if (!ts) return "";
  try {
    // Firestore Timestamp object
    if (ts.seconds) {
      return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    // JS Date or string fallback
    return new Date(ts).toLocaleString("en-IN");
  } catch {
    return "";
  }
};

  const confirmPlanRedemption = async () => {
    if (!selectedInv || processing) return;
    setProcessing(true);
    try {
      const createRequest = httpsCallable(functions, "createRedemptionRequest");
      const res = await createRequest({
        estimationId: orderId,
        investmentId: selectedInv.id,
        customerName: customer.name,
        customerMobile: customer.mobile,
        amount: selectedInv.bal
      });
      setRequestId(res.data.requestId);
    } catch (err) {
      alert("Failed to send request");
      setProcessing(false);
    }
  };

  // Listen for consent approval
  useEffect(() => {
    if (!requestId) return;
    const unsub = onSnapshot(doc(db, "INVESTMENT_REDEMPTION_REQUESTS", requestId), (snap) => {
      if (!snap.exists()) return;
      const statusData = snap.data();
      setConsentStatus(statusData);
      if (statusData.status === "APPROVED") {
        setBilling(prev => ({
          ...prev,
          useInvestment: true,
          investmentId: statusData.investmentId,
          redeemAmount: statusData.amount
        }));
      }
    });
    return () => unsub();
  }, [requestId]);

  // --- RENDER HELPERS ---
 const steps = [
  { id: "unassigned", label: "Intake", icon: <Box size={18}/> },
  { id: "assigned", label: "Karigar", icon: <User size={18}/> },
  { id: "sent_to_karigar", label: "Crafting", icon: <Hammer size={18}/> },
  { id: "returned", label: "QC", icon: <Target size={18}/> },
  { id: "delivered", label: "Ready", icon: <Zap size={18}/> }
];

const sendKarigarWhatsApp = async () => {
  try {

    const sendMessage = httpsCallable(functions, "sendKarigarOrder");

    await sendMessage({
      orderId,
      karigars: karigarDispatchList
    });

    const updatedItems = data.items.map(i => ({
      ...i,
      status: "sent_to_karigar",
      sentAt: new Date().toISOString()
    }));

    await updateDoc(doc(db, "orders", orderId), {
      status: "sent_to_karigar",
      items: updatedItems,
      "audit.lastUpdatedAt": serverTimestamp()
    });

    setShowDispatchModal(false);

  } catch (err) {
    alert("Failed to send order");
  }
};

  if (loading) return <div className="h-screen bg-white flex items-center justify-center font-bold text-xs tracking-widest animate-pulse">SYNCHRONIZING TERMINAL...</div>;

  return (
    <div className="h-screen bg-[#F9F9F9] font-sans text-[#0F172A] flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 lg:px-12 shrink-0 z-50">
        <div className="flex flex-col">
          <h1 className="font-bold text-[10px] uppercase tracking-[0.2em] text-slate-400">Order Management</h1>
          <p className="text-sm font-bold text-slate-900">Session #{data?.estimationId}</p>
        </div>
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-50 rounded-full transition"><X size={20}/></button>
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-8">
        
        {/* LEFT COLUMN: Production & Items */}
        <div className="lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">
          
          {/* CLIENT CARD */}
          <section className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-amber-500 shrink-0"><User size={24}/></div>
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight">{customer.name}</h2>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
                  <span>{customer.mobile}</span>
                  {customer.pan && <span className="bg-slate-100 px-2 py-0.5 rounded uppercase">PAN: {customer.pan}</span>}
                </div>
              </div>
            </div>
            <button onClick={() => { setEditCustomer(customer); setShowEditCustomer(true); }} className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"><Edit3 size={18}/></button>
          </section>
          {data.status === "assigned" && (
            <section className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3">
              <User className="text-blue-700" size={20}/>
              <div>
                <p className="text-xs font-bold uppercase text-blue-900">
                  Karigar Selected
                </p>
                <p className="text-[10px] text-blue-700">
                  Kindly place the order to send job details to Karigar
                </p>
              </div>
            </section>
          )}

          {data.status === "sent_to_karigar" && (
            <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
              <Hammer className="text-amber-700" size={20}/>
              <div>
                <p className="text-xs font-bold uppercase text-amber-900">
                  Production in Progress
                </p>
                <p className="text-[10px] text-amber-700">
                  Order has been sent to Karigar
                </p>
              </div>
            </section>
          )}
          {!isClosed && data.status !== "sent_to_karigar" && (
            <section className="bg-white rounded-2xl p-4 border border-orange-100 flex items-center justify-between shadow-sm mb-2">
              <div className="text-right hidden md:block">
                {anyKarigarSelected ? (
                  <>
                    <p className="text-[9px] font-bold text-red-400 uppercase italic">
                      Bulk Assign Disabled
                    </p>
                    <p className="text-[10px] font-black text-red-600 uppercase">
                      Karigar already selected, proceed to order placing
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[9px] font-bold text-slate-400 uppercase italic">
                      Quick Assign Mode
                    </p>
                    <p className="text-[10px] font-black text-orange-600 uppercase">
                      Apply one karigar to all items
                    </p>
                  </>
                )}
              </div>
              <div className="text-right hidden md:block">
                <p className="text-[9px] font-bold text-slate-400 uppercase italic">Quick Assign Mode</p>
              </div>
            </section>
          )}
          {/* ITEM TABLE */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-50 dashboard-bg flex justify-between items-center font-black text-[10px] uppercase text-amber-900">
              <span>Transaction Inventory</span>
              <span>{data.items?.length || 0} Items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] uppercase text-slate-400 bg-white">
                  <tr>
                    <th className="px-6 py-3 font-bold">Article</th>
                    <th className="text-center px-3 py-3 font-bold">Gross Wt</th>
                    <th className="text-center px-3 py-3 font-bold">Stone Wt</th>
                    <th className="text-center px-3 py-3 font-bold">Net Wt</th>
                    <th className="px-3 py-3 font-bold text-center">Assign Karigar</th>
                    <th className="px-3 py-3 font-bold text-center">Delivery Date</th>
                    <th className="text-right px-6 py-3 font-bold">Total (3% GST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dashboard-bg">
                  {data.items && data.items.map((item, i) => {
                    // Calculate the total correctly based on your Firestore keys
                    const net = Number(item.netWeight || item.gross || 0);
                    const rate = Number(item.rate || 0);
                    const mc = Number(item.mcValue || 0);
                    const stones = Number(item.stoneCharges || 0);
                    let baseTotal = net * rate;
                    
                    if (item.mcType === "Fixed" || item.mcType === "GM") {
                      baseTotal = (net + mc) * rate;
                    } else if (item.mcType === "PERCENT" || item.mcType === "%") {
                      baseTotal += baseTotal * (mc / 100);
                    }
                    
                    const totalWithGst = (baseTotal + stones) * 1.03;

                    return (
                      <tr key={i} className="hover:bg-slate-50 transition group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-2">
                            {/* 1. Item Identification */}
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{item.display || item.item}</p>
                              <div className="flex gap-2 text-[9px] text-slate-400 uppercase font-medium">
                                <span>HUID: {item.huid || 'NA'}</span>
                                <span>•</span>
                                <span>MC: {item.mcValue}{item.mcType === "%" ? "%" : "/g"}</span>
                              </div>
                            </div>

                            {/* 2. Compact Production Flow */}
                            <div className="flex items-center gap-1.5 py-1">
                              {steps.map((step, idx) => {
                                const active = idx <= steps.findIndex(s => s.id === (item.status || data.status));
                                const isCurrent = (item.status || data.status) === step.id;
                                
                                return (
                                  <React.Fragment key={step.id}>
                                    <div 
                                      className={`flex items-center justify-center rounded-md transition-all
                                        ${active ? 'text-amber-600' : 'text-slate-200'}
                                        ${isCurrent ? 'bg-amber-50 ring-1 ring-amber-200 p-0.5' : ''}
                                      `}
                                      title={step.label}
                                    >
                                      {React.cloneElement(step.icon, { size: 12 })}
                                    </div>
                                    
                                    {idx < steps.length - 1 && (
                                      <div className={`h-[1px] w-3 rounded-full ${active ? 'bg-amber-400' : 'bg-slate-100'}`} />
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </div>
                          </div>
                        </td>
                        {/* Use item.gross as seen in your Firestore image */}
                        <td className="px-3 py-4 text-center font-mono text-sm text-amber-900 font-bold">
                          {item.gross}g
                        </td>
                        <td className="px-3 py-4 text-center font-mono text-sm text-amber-900 font-bold">
                          {item.stoneWeight}g
                        </td>
                        <td className="px-3 py-4 text-center font-mono text-sm text-amber-900 font-bold">
                          {item.netWeight}g
                        </td>
                        <td className="px-3 py-4">
                          <select 
                            disabled={isClosed}
                            value={item.karigarId || ""} 
                            onChange={(e) => updateItemAssignment(i, 'karigar', e.target.value)}
                            className="text-[10px] font-bold uppercase bg-slate-50 border-none rounded-lg p-2 outline-none w-full focus:ring-1 focus:ring-orange-500"
                          >
                            <option value="">Select...</option>
                            {karigars.map(k => (
                              <option key={k.id} value={k.id}>{k.name}</option>
                            ))}
                          </select>
                        </td>

                        <td className="px-3 py-4">
                          <input 
                            type="date" 
                            disabled={isClosed}
                            value={item.deliveryDate || ""}
                            onChange={(e) => updateItemAssignment(i, 'deliveryDate', e.target.value)}
                            className="text-[10px] font-mono bg-slate-50 border-none rounded-lg p-2 outline-none w-full"
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">
                          ₹{totalWithGst.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: Settlement Terminal */}
        <aside className="col-span-1 lg:col-span-4 flex flex-col h-full">
          <div className="dashboard-bg relative rounded-[1.5rem] shadow-sm flex flex-col h-full border border-slate-200 overflow-hidden bg-white">
            {/* ================= TERMINAL HEADER ================= */}
            <div className="px-7 pt-6 pb-5 border-b border-slate-200 text-center">
              {isClosed ? (
              <div className="inline-flex flex-col items-center justify-center border-2 border-amber-950 text-slate-900 font-extrabold px-4 py-1 rounded-md  bg-white/80 backdrop-blur-sm shadow-sm">
                  <span className="text-[10px] font-black tracking-[0.35em]">
                    SALE CLOSED
                  </span>
                  <span className="text-[9px] font-mono mt-0.5">
                    {formatClosedDate(data?.closedAt)}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] font-black tracking-[0.38em] text-slate-900">
                  SECURE SETTLEMENT TERMINAL
                </p>
              )}
              <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent w-28 mx-auto mt-2" />
              {/* Gross value */}
              <div className="mt-6 flex items-end justify-between">
                <span className="text-[14px] font-bold text-amber-900 uppercase tracking-wide">
                  Payable
                </span>
                <span className="text-[28px] font-mono font-black text-slate-900 tracking-tight">
                  ₹{metrics.subtotal.toLocaleString()}
                </span>
              </div>
              {/* Item meta */}
              <div className="mt-2 flex justify-between text-[11px] font-extrabold text-slate-900">
                <span>{data.items.length} Item{data.items.length !== 1 && "s"}</span>
                <span>
                  SubTotal ₹
                  {data.items.length
                    ? Math.round(metrics.subtotal / data.items.length).toLocaleString()
                    : 0}
                </span>
              </div>
            </div>
            {/* ================= ADJUSTMENTS ================= */}
            <div className="px-7 py-5 space-y-3 bg-slate-50/40 font-mono text-[12px]">
              {/* Investment */}
              <div className={`flex justify-between ${isClosed && "opacity-40"}`}>
                <span className="flex items-center gap-2">
                  <QrCode size={14} /> Investment
                </span>
                {billing.useInvestment ? (
                  <span className="text-emerald-600 font-bold">
                    −₹{billing.redeemAmount.toLocaleString()}
                  </span>
                ) : (
                  <button
                    onClick={handleLinkPlan}
                    disabled={isClosed}
                    className="text-indigo-600 font-bold"
                  >
                    Link
                  </button>
                )}
              </div>
              {/* Exchange */}
              <div className={`flex justify-between ${isClosed && "opacity-40"}`}>
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} /> Exchange
                </span>
                {billing.exchangeGold.items.length > 0 ? (
                  <span className="text-blue-600 font-bold">
                    −₹
                    {billing.exchangeGold.items
                      .reduce((s, i) => s + Number(i.value), 0)
                      .toLocaleString()}
                  </span>
                ) : (
                  <button
                    onClick={() => setShowExchangeModal(true)}
                    disabled={isClosed}
                    className="text-indigo-600 font-bold"
                  >
                    Add
                  </button>
                )}
              </div>
              {/* Manual adjustment */}
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  <Info size={14} /> Adjustment
                </span>
                <input
                  type="number"
                  className="w-20 text-right bg-transparent border-b border-slate-300 outline-none font-bold"
                  value={billing.manualDiscount}
                  onChange={(e) =>
                    setBilling((p) => ({ ...p, manualDiscount: e.target.value }))
                  }
                  disabled={isClosed}
                />
              </div>
            </div>
            {/* ================= RECEIPT BREAKDOWN ================= */}
            <div className="px-7 py-5 border-t border-dashed border-slate-300 font-mono text-[12px] space-y-2">
              <div className="flex justify-between font-extrabold text-amber-900">
                <span>Taxable Value</span>
                <span>₹{metrics.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-extrabold text-amber-900">
                <span>GST (3%)</span>
                <span>₹{metrics.gst.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              
              <div className="border-t border-dashed border-slate-400 my-2" />
              
              <div className="flex justify-between font-extrabold text-[18px] text-slate-900">
                <span>NET PAYABLE</span>
                <span>₹{metrics.rounded.toLocaleString("en-IN")}</span>
              </div>
              
              <div className="flex justify-end">
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                  Saved ₹{metrics.savings.toLocaleString()}
                </span>
              </div>
            </div>
            {/* ================= ACTION ================= */}
            <div className="mt-auto p-6 border-t border-slate-200 bg-white">
              {isClosed ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setShowInvoice(true)}
                    className="bg-slate-900 hover:bg-amber-900 text-white py-3 rounded-xl font-black text-[11px] tracking-widest"
                  >
                    Invoice
                  </button>
                  <button
                    onClick={() => setShowDeclaration(true)}
                    className="border border-slate-300 py-3 rounded-xl font-black text-[11px] tracking-widest"
                  >
                    SOG
                  </button>
                </div>
              ) : allKarigarAssigned && allDeliveryDatesSet && data.status === "assigned" ? (
                <button
                  onClick={() => setShowDispatchModal(true)}
                  disabled={!allKarigarAssigned || !allDeliveryDatesSet}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-[12px] tracking-widest disabled:opacity-40"
                >
                  PLACE ORDER
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (!allItemsReturned) {
                      alert("Items not received from Karigar");
                      return;
                    }
                    if (metrics.rounded > 200000 && !customer.pan) {
                      alert("PAN required for billing above ₹2,00,000");
                      return;
                    }
                    setShowPaymentModal(true);
                  }}
                  disabled={!allItemsReturned}
                  className={`w-full py-4 rounded-xl font-black text-[12px] tracking-[0.38em] shadow-lg transition
                  ${allItemsReturned 
                    ? "bg-gradient-to-r from-slate-900 to-slate-800 text-white" 
                    : "bg-slate-300 text-slate-500 cursor-not-allowed"}`}
                >
                  SECURE CHECKOUT
                </button>
              )}
            </div>
          </div>
        </aside>
      </main>

      {/* --- MODALS SECTION --- */}

      {/* KARIGAR MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white w-full max-w-xl rounded-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-[#FFFBF7]">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Assign Karigar</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase italic">Workflow Configurator</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-orange-50 rounded-full text-slate-400"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 block">1. Select Professional</label>
                <div className="grid grid-cols-2 gap-3">
                  {karigars.map((emp) => (
                    <button key={emp.id} onClick={() => setSelectedKarigar(emp)} className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedKarigar?.id === emp.id ? "border-orange-500 bg-orange-50" : "border-slate-50 bg-slate-50 hover:border-slate-200"}`}>
                      <p className="text-xs font-black uppercase text-slate-800">{emp.name}</p>
                      <span className={`text-[8px] font-black px-2 py-0.5 rounded mt-2 inline-block ${emp.type === "B2B" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{emp.type}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 block">2. Assignment Scope</label>
                {data.items?.length === 1 ? (
                  <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <Info size={18} className="text-blue-500" />
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-tight">Direct Assignment: <span className="underline">{data.items[0].productName}</span></p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1"><span className="text-[10px] font-bold text-slate-500 uppercase italic">{selectedItems.length} Selected</span><button onClick={() => setSelectedItems(selectedItems.length === data.items.length ? [] : data.items.map((_, i) => i))} className="text-[9px] font-black uppercase text-orange-600 hover:underline">Select All</button></div>
                    <div className="grid grid-cols-1 gap-2">
                      {data.items.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => toggleItemSelection(idx)}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedItems.includes(idx)
                              ? "border-orange-200 bg-orange-50/50"
                              : "border-slate-100 bg-white hover:border-slate-200"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            
                            {/* Checkbox */}
                            <div
                              className={`h-4 w-4 rounded border flex items-center justify-center transition-all ${
                                selectedItems.includes(idx)
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-slate-200"
                              }`}
                            >
                              {selectedItems.includes(idx) && (
                                <CheckCircle2 size={12} className="text-white" />
                              )}
                            </div>

                            {/* Item Details */}
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] font-bold uppercase text-slate-800">
                                {item.display || item.item || "Jewellery Item"}
                              </span>

                              <span className="text-[9px] text-slate-400 font-mono">
                                Net: {item.netWeight || 0}g
                              </span>
                            </div>
                          </div>

                          {/* Weight */}
                          <span className="text-[9px] font-black text-slate-500">
                            {item.netWeight || 0}g
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-3 block">3. Special Instructions</label>
                <textarea className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-medium outline-none h-20 resize-none" placeholder="Notes..." value={adminComments} onChange={(e) => setAdminComments(e.target.value)} />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400">Cancel</button>
              <button onClick={handleAssignKarigar} disabled={!selectedKarigar || selectedItems.length === 0} className="flex-[2] bg-[#1A1C1E] text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-xl disabled:opacity-30 transition-all">Confirm Assignment</button>
            </div>
          </div>
        </div>
      )}
      {/* INVESTMENT MODAL */}
      {showInvModal && (
        <div className="fixed inset-0 z-[120] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">{requestId ? "Consent Status" : "Select Active Plan"}</h3>
              <button onClick={() => { if (requestId && !["APPROVED", "REJECTED", "EXPIRED"].includes(consentStatus?.status)) return; setShowInvModal(false); setRequestId(null); }} className="p-1 hover:bg-slate-100 rounded-full"><X size={20}/></button>
            </div>

            {!requestId ? (
              <div className="space-y-3">
                {investments.map((inv) => (
                  <div key={inv.id} onClick={() => setSelectedInv(inv)} className={`p-4 rounded-2xl border-2 cursor-pointer transition-all ${selectedInv?.id === inv.id ? "border-indigo-600 bg-indigo-50" : "border-slate-100"}`}>
                    <p className="font-bold text-sm">{inv.schemeName}</p>
                    <p className="text-xs text-indigo-600 font-bold">Available: ₹{inv.bal.toLocaleString()}</p>
                  </div>
                ))}
                <button onClick={confirmPlanRedemption} disabled={processing || !selectedInv} className={`w-full py-4 rounded-xl font-bold mt-6 text-sm flex items-center justify-center gap-2 ${processing ? "bg-slate-400" : "bg-slate-900 text-white"}`}>
                  {processing ? <RefreshCw className="animate-spin" size={16} /> : "Request Consent"}
                </button>
              </div>
            ) : (
              <div className="text-left py-2">
                <div className="flex justify-center mb-4">
                  <div className={`h-12 w-12 rounded-full flex items-center justify-center ${consentStatus?.status === "APPROVED" ? "bg-emerald-100 text-emerald-600" : consentStatus?.status === "REJECTED" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"}`}>
                    <RefreshCw size={22} className={consentStatus?.status === "PENDING" ? "animate-spin" : ""} />
                  </div>
                </div>
                <p className="text-center text-sm font-bold mb-1">{consentStatus?.status === "PENDING" ? "Waiting for Customer..." : `Status: ${consentStatus?.status}`}</p>
                <p className="text-center text-[11px] text-slate-500 mb-6 font-mono">OTP/Link sent to {customer.mobile}</p>
                <div className="space-y-2 text-[11px] font-bold uppercase tracking-tight">
                  <div className={consentStatus?.status ? "text-emerald-600" : "text-slate-400"}>✓ WhatsApp Request Sent</div>
                  <div className={["OPENED", "APPROVED", "REJECTED"].includes(consentStatus?.status) ? "text-emerald-600" : "text-slate-400"}>✓ Customer Viewed Request</div>
                  <div className={consentStatus?.status === "APPROVED" ? "text-emerald-600" : consentStatus?.status === "REJECTED" ? "text-red-600" : "text-slate-400"}>
                    {consentStatus?.status === "APPROVED" ? "✓ Approved" : consentStatus?.status === "REJECTED" ? "✕ Rejected" : "Waiting for Click..."}
                  </div>
                </div>
                {["APPROVED", "REJECTED", "EXPIRED"].includes(consentStatus?.status) && (
                  <button onClick={() => { setShowInvModal(false); setRequestId(null); }} className="mt-6 w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Apply & Close</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* EXCHANGE MODAL */}
      {showExchangeModal && (
        <div className="fixed inset-0 z-[200] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Exchange Ornaments</h3>
              <button onClick={() => setShowExchangeModal(false)} className="p-1 rounded-full hover:bg-slate-100"><X size={20}/></button>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <input id="ex_desc" placeholder="Item Name" className="w-full border-b border-slate-200 p-2 text-sm font-bold outline-none" />
                <div className="grid grid-cols-3 gap-3">
                  <input id="ex_weight" type="number" placeholder="Weight" className="border rounded-xl p-2 text-sm font-bold" />
                  <input id="ex_purity" type="number" placeholder="Purity" className="border rounded-xl p-2 text-sm font-bold" />
                  <input id="ex_value" type="number" placeholder="Value" className="border rounded-xl p-2 text-sm font-bold" />
                </div>
                <button onClick={() => {
                   const desc = document.getElementById("ex_desc").value;
                   const weight = document.getElementById("ex_weight").value;
                   const purity = document.getElementById("ex_purity").value;
                   const val = document.getElementById("ex_value").value;
                   if(!desc || !weight || !val) return alert("Fill details");
                   setBilling(p => ({ ...p, exchangeGold: { ...p.exchangeGold, items: [...p.exchangeGold.items, { description: desc, weight, purity, value: val }] } }));
                   document.getElementById("ex_desc").value = "";
                }} className="w-full bg-indigo-600 text-white rounded-xl py-2 font-bold text-sm">Add Item</button>
              </div>
              <button onClick={() => setShowExchangeModal(false)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Apply & Close</button>
            </div>
          </div>
        </div>
      )}

      {/* OTHER MODALS (PAYMENT, INVOICE, DECLARATION) */}
      {showPaymentModal && (
        <PaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          estimationId={data?.estimationId} // Ensure orderId is passed here
          totalAmount={metrics.rounded}
          exchangeItems={billing.exchangeGold.items}
          investmentAmount={billing.redeemAmount}
          onSuccess={(finalRef) => {
            setShowPaymentModal(false);
            // Immediately set status locally so UI switches to 'CLOSED'
            setData((prev) => ({
              ...prev,
              status: "CLOSED",
              payment: { reference: finalRef },
            }));
            setShowInvoice(true);
          }}
        />
      )}
      {showDispatchModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden">

            <div className="p-6 border-b">
              <h2 className="text-sm font-black uppercase tracking-widest">
                Dispatch Order
              </h2>
              <p className="text-xs text-slate-500 font-mono">
                Order ID: {data?.estimationId}
              </p>
            </div>

            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">

              {karigarDispatchList.map((k, idx) => (
                <div key={idx} className="border rounded-xl p-4 bg-slate-50">

                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold text-sm">{k.name}</p>
                      <p className="text-xs text-slate-500">{k.mobile}</p>
                    </div>

                    <span className="text-[10px] font-bold uppercase text-slate-400">
                      {k.items.length} items
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-600 space-y-1">
                    {k.items.map((item, i) => (
                      <p key={i}>
                        • {item.display || item.item} ({item.netWeight}g)
                      </p>
                    ))}
                  </div>

                </div>
              ))}

            </div>

            <div className="p-6 border-t flex gap-3">
              <button
                onClick={() => setShowDispatchModal(false)}
                className="flex-1 py-3 rounded-xl border font-bold text-xs"
              >
                Cancel
              </button>

              <button
                onClick={sendKarigarWhatsApp}
                className="flex-1 py-3 rounded-xl bg-green-600 text-white font-bold text-xs"
              >
                Send Order Details
              </button>
            </div>

          </div>
        </div>
        )}
      {showDeclaration && <ExchangeDeclarationPDF customer={customer} items={billing.exchangeGold.items} onClose={() => setShowDeclaration(false)}/>}
      {showInvoice && data && <GSTInvoiceA5 customer={customer} items={data.items} invoiceNo={data.invoice?.number} date={new Date().toLocaleDateString()} onClose={() => setShowInvoice(false)}/>}
    </div>
  );
}