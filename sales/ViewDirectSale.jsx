import React, { useEffect, useState, useMemo } from "react";
import {
  doc, getDoc, updateDoc, serverTimestamp,
  where, getDocs, query, collection, addDoc, onSnapshot,limit
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { QrCode, Trash2, User, X, RefreshCw,Info, ChevronRight } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import ExchangeDeclarationPDF from "../common/ExchangeDeclarationPDF";
import PaymentModal from "../common/PaymentModal";
import GSTInvoiceA5 from "../common/GSTInvoiceA5";
import PasscodeModal from "../common/PasscodeModal";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";
import { toast } from "react-hot-toast";

export default function ViewDirectSale() {
  const { estimationId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  // Billing State
  const [billing, setBilling] = useState({
    useInvestment: false,
    investmentId: "",
    redeemAmount: 0,
    manualDiscount: 0,
    exchangeGold: {
      confirmed: false,
      items: [] // Initialized empty for better logic
    }
  });
  const [investments, setInvestments] = useState([]);
  const [selectedInv, setSelectedInv] = useState(null);
  const [showInvModal, setShowInvModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState({ type: "Cash", amountPaid: 0 });
  const [consentStatus, setConsentStatus] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const isClosed = data?.status === "CLOSED";
  const canEditInvoice =
  data?.invoice &&
  !data.invoice.locked &&
  Date.now() < data.invoice.editableUntil;
  const isLocked = !canEditInvoice; // future: add admin 30-day logic here
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState(null);
  const [showPasscode, setShowPasscode] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editCustomer, setEditCustomer] = useState(null);
  const [fullCustomer, setFullCustomer] = useState(null);
  const [editMode, setEditMode] = useState("TRANSACTION"); 
  const baseCustomer = fullCustomer || data?.customer || {};

  const customer = {
    ...baseCustomer,
    panNumber: baseCustomer.panNumber || baseCustomer.pan,
    aadharNumber: baseCustomer.aadhaarNumber || baseCustomer.aadhar,
    address: baseCustomer.address || baseCustomer.city
  };
  /* --- CALCULATIONS --- */
  const calculateItemTotal = (item) => {
    const net = Number(item.netWeight || 0);
    const rate = Number(item.rate || 0);
    const mc = Number(item.makingChargeValue || 0);
    const stones = Number(item.stoneCharges || 0);
    let total = net * rate;
    if (item.makingChargeType === "GM" || item.makingChargeType === "GRAM") total = (net + mc) * rate;
    else if (item.makingChargeType === "PERCENT") total += total * (mc / 100);
    return (total + stones) * 1.03;
  };

  const metrics = useMemo(() => {
    if (!data) return { subtotal: 0, savings: 0, final: 0, rounded: 0 };
    const gross = data.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const exValue = billing.exchangeGold.items.reduce((s, i) => s + Number(i.value || 0), 0);
    const savings = Number(billing.redeemAmount || 0) + exValue + Number(billing.manualDiscount || 0);
    const net = gross - savings;
    return {
      subtotal: gross,
      savings,
      final: net,
      rounded: Math.ceil(net / 10) * 10
    };
  }, [data, billing]);

  /* --- ACTIONS --- */

useEffect(() => {
  if (!estimationId || !data?.id) return;

  const q = query(
    collection(db, "INVESTMENT_REDEMPTION_REQUESTS"),
    where("estimationId", "==", estimationId)
  );

  const unsub = onSnapshot(q, (snap) => {
    if (snap.empty) {
      setConsentStatus(null);
      return;
    }

    const requestDoc = snap.docs[0];
    const requestData = requestDoc.data();
    setConsentStatus(requestData);

    // ✅ PERMANENT SYNC: If approved but not yet saved in the sale doc, update Firestore
   const alreadyApplied =
    data?.investmentRedemption?.requestId === requestDoc.id;

    if (requestData.status === "APPROVED" && !alreadyApplied) {
      updateDoc(doc(db, "sales_estimations", data.id), {
        investmentRedemption: {
          requestId: requestDoc.id,
          investmentId: requestData.investmentId,
          amount: Number(requestData.amount),
          approvedAt: serverTimestamp()
        }
      }).catch(err =>
        console.error("Failed to save redemption to sale:", err)
      );
    }
    });

  return () => unsub();
}, [estimationId, data?.id]);

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

const confirmPlanRedemption = async () => {
  if (!selectedInv || processing) return; // Prevent double-clicks

  setProcessing(true);
  try {
    const createRequest = httpsCallable(functions, "createRedemptionRequest");
    const res = await createRequest({
      estimationId,
      investmentId: selectedInv.id,
      customerName: customer.name,
      customerMobile: customer.mobile,
      amount: selectedInv.bal
    });

    setRequestId(res.data.requestId);
    // DO NOT close the modal here anymore. 
    // We want to keep the UI visible so the staff sees "Waiting..."
  } catch (err) {
    console.error(err);
    alert("Failed to send consent request");
    setProcessing(false); // Re-enable button on error
  }
};
// useEffect(() => {
//   if (!requestId) return;

//   const unsub = onSnapshot(
//     doc(db, "INVESTMENT_REDEMPTION_REQUESTS", requestId),
//     (snap) => {

//       if (!snap.exists()) return;

//       const docData = snap.data();
//       setConsentStatus(docData);

//       if (docData.status === "APPROVED") {

//         // SAVE redemption permanently
//         updateDoc(doc(db, "sales_estimations", estimationId), {
//           investmentRedemption: {
//             requestId,
//             investmentId: docData.investmentId,
//             amount: Number(docData.amount),
//             approvedAt: serverTimestamp()
//           }
//         });

//         setBilling(prev => ({
//           ...prev,
//           useInvestment: true,
//           investmentId: docData.investmentId,
//           redeemAmount: Number(docData.amount)
//         }));
//       }

//       if (docData.status === "REJECTED") {
//         setTimeout(() => {
//           setShowInvModal(false);
//         }, 2000);
//       }
//     }
//   );

//   return () => unsub();
// }, [requestId]);

/* --- 1. MAIN DATA LISTENER (Restores data on refresh) --- */
useEffect(() => {
  if (!estimationId) return;

  const q = query(
    collection(db, "sales_estimations"),
    where("estimationId", "==", estimationId),
    limit(1)
  );

  const unsub = onSnapshot(q, (snap) => {
    if (!snap.empty) {
      const docSnap = snap.docs[0];
      const docData = docSnap.data();

      // Update the main data state
      setData({ id: docSnap.id, ...docData });

      // ✅ RESTORE REDEMPTION: Check if a redemption was already saved to this sale
      if (docData.investmentRedemption) {
        setBilling(prev => ({
          ...prev,
          useInvestment: true,
          investmentId: docData.investmentRedemption.investmentId,
          redeemAmount: Number(docData.investmentRedemption.amount)
        }));
      } else {
        // Reset if no redemption is found (prevents data leaking between sales)
        setBilling(prev => ({ ...prev, useInvestment: false, redeemAmount: 0 }));
      }
      
      setLoading(false);
    } else {
      // Fallback for direct document ID
      getDoc(doc(db, "sales_estimations", estimationId)).then((directSnap) => {
        if (directSnap.exists()) {
          const directData = directSnap.data();
          setData({ id: directSnap.id, ...directData });
          if (directData.investmentRedemption) {
            setBilling(prev => ({
              ...prev,
              useInvestment: true,
              investmentId: directData.investmentRedemption.investmentId,
              redeemAmount: Number(directData.investmentRedemption.amount)
            }));
          }
          setLoading(false);
        } else {
          setLoading(false);
          toast.error("Sale record not found");
        }
      });
    }
  }, (err) => {
    console.error("Database error:", err);
    setLoading(false);
  });

  return () => unsub();
}, [estimationId]);

useEffect(() => {
  if (!data?.customer?.id) return;
  const fetchCustomer = async () => {
    try {
      const snap = await getDoc(doc(db, "CUSTOMERS", data.customer.id));
      if (snap.exists()) setFullCustomer({ id: snap.id, ...snap.data() });
    } catch (e) {
      console.error("Customer fetch failed", e);
    }
  };
  fetchCustomer();
}, [data?.customer?.id]);

// useEffect(() => {
//   if (!consentStatus?.tokenExpiry) return;
//   const expiryTime = consentStatus.tokenExpiry.seconds
//     ? consentStatus.tokenExpiry.seconds * 1000
//     : consentStatus.tokenExpiry;
//   const timer = setInterval(() => {
//     const now = Date.now();
//     if (now > expiryTime && consentStatus.status !== "APPROVED" && consentStatus.status !== "REJECTED") {
//       setConsentStatus(prev => ({
//         ...prev,
//         status: "EXPIRED"
//       }));
//       clearInterval(timer);
//     }
//   }, 2000);
//   return () => clearInterval(timer);
// }, [consentStatus?.tokenExpiry]);

const handleConfirmedDelete = async () => {
  if (pendingDeleteIndex === null) return;
  // LAST ITEM → delete entire estimation
  if (data.items.length === 1) {
    alert("Entire estimation should be deleted from Firestore.");
    return;
  }
  // REMOVE ONLY ONE ITEM (UI state)
  setData((prev) => ({
    ...prev,
    items: prev.items.filter((_, idx) => idx !== pendingDeleteIndex),
  }));
  setPendingDeleteIndex(null);
};

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

const handleRemoveInvestment = async () => {
  if (!data?.id) return;

  try {
    // 🔥 Remove from Firestore
    await updateDoc(doc(db, "sales_estimations", data.id), {
      investmentRedemption: null
    });

    // 🔥 Reset UI state
    setBilling(prev => ({
      ...prev,
      useInvestment: false,
      investmentId: "",
      redeemAmount: 0
    }));

    // 🔥 Optional: clear consent tracking
    setConsentStatus(null);
    setRequestId(null);

    toast.success("Investment removed");

  } catch (err) {
    console.error(err);
    toast.error("Failed to remove investment");
  }
};

const getKycStatus = () => {
  if (!data?.customer) return null;
  const hasPan = !!customer.panNumber;
  const highValue = metrics?.rounded > 200000;
  if (highValue && !hasPan)
    return { label: "PAN REQUIRED", color: "red" };
  if (hasPan)
    return { label: "KYC VERIFIED", color: "emerald" };
  return { label: "BASIC CUSTOMER", color: "amber" };
};

 if (loading) return <div className="h-screen flex items-center justify-center text-slate-900 font-medium">Loading Sale Records...</div>;
 return (
    <div className="h-screen bg-[#F9F9F9] font-sans antialiased text-[#0F172A] flex flex-col overflow-hidden">
      {/* HEADER: Branded & Compact */}
      <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-4 lg:px-12 shrink-0 z-50">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="font-bold text-[10px] lg:text-xs uppercase tracking-[0.2em] leading-none text-[#0F172A]">Billing Terminal</h1>
          </div>
        </div>
      </header>
      {/* MAIN CONTENT: Responsive Grid */}
      <main className="flex-1 overflow-y-auto lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 p-4 lg:p-10"> 
        {/* LEFT COLUMN: Client & Inventory */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-4 lg:gap-8 overflow-visible lg:overflow-hidden">
          {/* CLIENT CARD */}
          <section className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              
              {/* LEFT — Identity */}
              <div className="flex items-center gap-3 min-w-0">
                
                {/* Avatar */}
                <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-[#BFA75D] border border-[#BFA75D]/20 shrink-0">
                  <User size={18} />
                </div>

                {/* Name + Details */}
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base lg:text-xl font-bold text-[#0F172A] uppercase tracking-tight truncate max-w-[240px]">
                      {customer.name}
                    </h2>

                    {getKycStatus() && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider
                          ${
                            getKycStatus().color === "emerald"
                              ? "bg-emerald-50 text-emerald-700"
                              : getKycStatus().color === "red"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                      >
                        {getKycStatus().label}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-mono text-slate-500 truncate">
                    {customer.mobile}
                  </p>

                  {/* Inline Compact Details */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-slate-600 mt-1">
                    {customer.panNumber && (
                      <span>
                        PAN: <span className="font-semibold text-slate-800">{customer.panNumber}</span>
                      </span>
                    )}
                    {customer.aadharNumber && (
                      <span>
                        AADHAR: <span className="font-semibold text-slate-800">{customer.aadharNumber}</span>
                      </span>
                    )}
                    {customer.dob && (
                      <span>
                        DOB:{" "}
                        <span className="font-semibold text-slate-800">
                          {new Date(customer.dob).toLocaleDateString("en-IN")}
                        </span>
                      </span>
                    )}
                    {customer.address && (
                      <span className="truncate max-w-[220px]">
                        {customer.address}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* RIGHT — GST + Edit */}
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => {
                    setEditCustomer(customer);
                    setEditMode("TRANSACTION");
                    setShowEditCustomer(true);
                  }}
                  className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition"
                >
                  Edit
                </button>
              </div>
            </div>
          </section>
          {/* INVENTORY: Table on Desktop, Cards on Mobile */}
          <section className="dashboard-bg rounded-2xl border border-slate-200/60 shadow-sm flex flex-col lg:flex-1 overflow-hidden">
            {/* HEADER */}
            <div className="px-6 py-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/30 sticky top-0 z-10">
              <span className="text-[10px] font-extrabold text-amber-900 uppercase tracking-[0.2em]">
                Transaction Inventory
              </span>
              <span className="text-[10px] font-bold text-amber-900 uppercase tracking-widest">
                {data.items.length} Units
              </span>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* ================= DESKTOP TABLE ================= */}
              <table className="hidden lg:table w-full table-fixed border-collapse">
                {/* HEADER */}
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-slate-800 border-b border-slate-200 bg-white">
                    <th className="text-left px-4 py-3 font-semibold w-[22%]">Item</th>
                    <th className="text-center px-3 py-3 font-semibold w-[8%]">Gross</th>
                    <th className="text-center px-3 py-3 font-semibold w-[8%]">Stone</th>
                    <th className="text-center px-3 py-3 font-semibold w-[8%]">Net</th>
                    <th className="text-right px-3 py-3 font-semibold w-[12%]">Rate</th>
                    <th className="text-right px-3 py-3 font-semibold w-[12%]">Making</th>
                    <th className="text-right px-3 py-3 font-semibold w-[12%]">Stone ₹</th>
                    <th className="text-right px-4 py-3 font-semibold w-[18%]">Value</th>
                  </tr>
                </thead>

                {/* BODY */}
                <tbody className="divide-y divide-slate-100">
                  {data.items.map((item, i) => (
                    <tr key={i} className="hover:bg-amber-50 transition group">

                      {/* ITEM */}
                      <td className="px-4 py-4 truncate">
                        <p className="font-semibold text-slate-900 truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          HSN {item.hsnCode || "7113"} • HUID {item.huid || "-"}
                        </p>
                      </td>

                      {/* WEIGHTS */}
                      <td className="px-3 py-4 text-center font-mono text-sm text-amber-900">
                        {item.grossWeight}
                      </td>
                      <td className="px-3 py-4 text-center font-mono text-sm text-amber-900">
                        {item.stoneWeight}
                      </td>
                      <td className="px-3 py-4 text-center font-mono text-sm font-semibold text-amber-900">
                        {item.netWeight}
                      </td>

                      {/* CHARGES */}
                      <td className="px-3 py-4 text-right font-mono text-sm">
                        ₹{item.rate}
                      </td>
                      <td className="px-3 py-4 text-right text-sm text-amber-900">
                        {item.makingChargeValue}
                        {item.makingChargeType === "PERCENT" ? "%" : "/g"}
                      </td>
                      <td className="px-3 py-4 text-right text-sm text-amber-900">
                        ₹{item.stoneCharges}
                      </td>

                      {/* VALUE + DELETE */}
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-semibold text-slate-900 whitespace-nowrap">
                            ₹{calculateItemTotal(item).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                            })}
                          </span>

                          <button
                            onClick={() => {
                              setPendingDeleteIndex(i);
                              setShowPasscode(true);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>

                    </tr>
                  ))}
                </tbody>
              </table>
              {/* ================= MOBILE / TABLET CARDS ================= */}
              <div className="lg:hidden divide-y divide-slate-100">
                {data.items.map((item, i) => (
                  <div key={i} className="p-5 flex flex-col gap-4">
                    {/* TOP */}
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-xs text-[#0F172A] uppercase tracking-tight">
                          {item.productName}
                        </h4>
                        <p className="text-[9px] text-slate-900 font-bold uppercase">
                          HSN {item.hsnCode || "7113"}
                        </p>
                      </div>
                      <p className="font-mono font-black text-sm text-[#0F172A]">
                        ₹{calculateItemTotal(item).toLocaleString()}
                      </p>
                    </div>
                    {/* DETAILS */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-200 rounded-xl p-2.5 border border-slate-100 text-center">
                        <p className="text-[8px] text-slate-900 font-black uppercase mb-1">Gross Weight</p>
                        <p className="text-xs font-mono font-bold">{item.grossWeight}g</p>
                      </div>
                      <div className="bg-slate-200 rounded-xl p-2.5 border border-slate-100 text-center">
                        <p className="text-[8px] text-slate-900 font-black uppercase mb-1">Stone Weight</p>
                        <p className="text-xs font-mono font-bold">{item.stoneWeight}g</p>
                      </div>
                      <div className="bg-slate-200 rounded-xl p-2.5 border border-slate-100 text-center">
                        <p className="text-[8px] text-slate-900 font-black uppercase mb-1">Net Weight</p>
                        <p className="text-xs font-mono font-bold text-amber-900">{item.netWeight}g</p>
                      </div>
                      <div className="bg-[#f7c257] rounded-xl p-2.5 border border-slate-100 text-center">
                        <p className="text-[8px] text-slate-900 font-black uppercase mb-1">Rate</p>
                        <p className="text-xs font-mono font-extrabold text-slate-950">{item.rate} Rs/gm</p>
                      </div>

                      <div className="bg-slate-200 rounded-xl p-2.5 border border-slate-100 text-center">
                        <p className="text-[8px] text-slate-900 font-black uppercase mb-1">Making Charge</p>
                        <p className="text-xs font-mono font-bold">
                          {item.makingChargeValue}
                          {item.makingChargeType === "PERCENT" ? "%" : "/g"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
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
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold">
                      −₹{billing.redeemAmount.toLocaleString()}
                    </span>

                    {!isClosed && (
                      <button
                        onClick={handleRemoveInvestment}
                        className="text-red-500 hover:text-red-700"
                        title="Remove Investment"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
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
                <span>₹{Math.round(metrics.final / 1.03).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-extrabold text-amber-900">
                <span>CGST · 1.5%</span>
                <span>₹{Math.round(metrics.final * 0.015).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-extrabold text-amber-900">
                <span>SGST · 1.5%</span>
                <span>₹{Math.round(metrics.final * 0.015).toLocaleString()}</span>
              </div>
              <div className="border-t border-dashed border-slate-400 my-2" />
              <div className="flex justify-between font-extrabold text-[18px]  text-slate-900">
                <span>NET PAYABLE</span>
                <span>₹{metrics.rounded.toLocaleString()}</span>
              </div>
              <div className="flex justify-end">
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
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
                    className="bg-slate-900 hover:bg-amber-900 text-white py-3 rounded-xl font-black text-[11px] tracking-widest shadow-sm hover:opacity-90"
                  >
                    Invoice
                  </button>
                  <button
                    onClick={() => setShowDeclaration(true)}
                    className="border hover:bg-yellow-900 hover:text-white border-slate-300 py-3 rounded-xl font-black text-[11px] tracking-widest"
                  >
                    SOG
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    if (metrics.rounded > 200000 && !customer.pan) {
                      alert("PAN required for billing above ₹2,00,000");
                      return;
                    }
                    setShowPaymentModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-slate-900 to-slate-800 text-white py-4 rounded-xl font-black text-[12px] tracking-[0.38em] shadow-lg hover:scale-[1.01] active:scale-[0.99] transition"
                >
                  SECURE CHECKOUT
                </button>
              )}
            </div>
          </div>
        </aside>
      </main>
      {/* --- MODALS --- */}
      {showExchangeModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Exchange Ornaments</h3>
              <button onClick={() => {
                  setShowExchangeModal(false);
                  setShowDeclaration(true);
                }}
                className="p-1 rounded-full hover:bg-slate-100"><X size={20}/>
              </button>
            </div>
            <div className="space-y-4">
              {/* INPUT CARD */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <input
                  id="ex_desc"
                  placeholder="Item Name (e.g. Old Chain)"
                  className="w-full border-b border-slate-200 p-2 text-sm font-bold outline-none"
                />
                <div className="grid grid-cols-3 gap-3">
                  <input id="ex_weight" type="number" placeholder="Weight (g)" className="border rounded-xl p-2 text-sm font-bold" />
                  <input id="ex_purity" type="number" placeholder="Purity %" className="border rounded-xl p-2 text-sm font-bold" />
                  <input id="ex_value" type="number" placeholder="Exchange ₹" className="border rounded-xl p-2 text-sm font-bold" />
                </div>
                {/* ADD ITEM */}
                <button
                  onClick={() => {
                    const desc = document.getElementById("ex_desc").value;
                    const weight = Number(document.getElementById("ex_weight").value || 0);
                    const purity = Number(document.getElementById("ex_purity").value || 0);
                    const value = Number(document.getElementById("ex_value").value || 0);
                    if (!desc || !weight || !purity || !value) {
                      alert("Fill all exchange details");
                      return;
                    }
                    setBilling((p) => ({
                      ...p,
                      exchangeGold: {
                        confirmed: true,
                        items: [
                          ...p.exchangeGold.items,
                          { description: desc, weight, purity, value }
                        ],
                      },
                    }));
                    // clear inputs
                    document.getElementById("ex_desc").value = "";
                    document.getElementById("ex_weight").value = "";
                    document.getElementById("ex_purity").value = "";
                    document.getElementById("ex_value").value = "";
                  }}
                  className="w-full bg-indigo-600 text-white rounded-xl py-2 font-bold text-sm"
                >
                  Add Another Item
                </button>
              </div>
              {/* LIST OF ITEMS */}
              {billing.exchangeGold.items.length > 0 && (
                <div className="space-y-2">
                  {billing.exchangeGold.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center text-xs bg-white border rounded-xl p-2">
                      <span>{it.description} • {it.weight}g • {it.purity}%</span>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">₹{Math.round(it.value)}</span>
                        {!isLocked && (
                          <button
                            onClick={() => {
                              setBilling(p => ({
                                ...p,
                                exchangeGold: {
                                  ...p.exchangeGold,
                                  items: p.exchangeGold.items.filter((_, i) => i !== idx)
                                }
                              }));
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* FINAL APPLY BUTTON */}
              <button
                onClick={() => {
                  setShowExchangeModal(false);

                  setTimeout(() => {
                    setShowDeclaration(true);
                  }, 150);
                }}
                className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold"
              >
                Apply Exchange & Generate Declaration
              </button>
            </div>
          </div>
        </div>
      )}
      {/* INVESTMENT MODAL */}
      {showInvModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => {
            if (!requestId) {
              setShowInvModal(false);
            }
          }}
        >
          <div
            className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">
                {requestId ? "Consent Status" : "Select Active Plan"}
              </h3>

             <button
                  onClick={() => {
                    if (
                      requestId &&
                      !["APPROVED", "REJECTED", "EXPIRED"].includes(consentStatus?.status)
                    ) return;

                    setShowInvModal(false);
                    setRequestId(null);
                  }}
                  className="p-1 hover:bg-slate-100 rounded-full"
                >
                  <X size={20}/>
                </button>
            </div>

            {!requestId ? (

              /* ================================
                PHASE 1 — SELECT PLAN
              ================================= */

              <div className="space-y-3">
                {investments.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => setSelectedInv(inv)}
                    className={`p-4 rounded-2xl border-2 cursor-pointer ${
                      selectedInv?.id === inv.id
                        ? "border-indigo-600 bg-indigo-50"
                        : "border-slate-100"
                    }`}
                  >
                    <p className="font-bold text-sm">{inv.schemeName}</p>
                    <p className="text-xs text-indigo-600 font-bold">
                      Available: ₹{inv.bal.toLocaleString()}
                    </p>
                  </div>
                ))}

                <button
                  onClick={confirmPlanRedemption}
                  disabled={processing || !selectedInv}
                  className={`w-full py-4 rounded-xl font-bold mt-6 text-sm flex items-center justify-center gap-2 transition
                  ${
                    processing
                      ? "bg-slate-400 cursor-not-allowed"
                      : "bg-slate-900 text-white"
                  }`}
                >
                  {processing ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    "Request Consent"
                  )}
                </button>
              </div>
            ) : (

              /* ================================
                PHASE 2 — LIVE TRACKER
              ================================= */

              <div className="text-left py-2">

                {/* ICON */}
                <div className="flex justify-center mb-4">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center
                    ${
                      consentStatus?.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-600"
                        : consentStatus?.status === "REJECTED"
                        ? "bg-red-100 text-red-600"
                        : "bg-amber-100 text-amber-600"
                    }`}
                  >
                    <RefreshCw
                      size={22}
                      className={
                        consentStatus?.status === "PENDING"
                          ? "animate-spin"
                          : ""
                      }
                    />
                  </div>
                </div>

                {/* STATUS TEXT */}
                <p className="text-center text-sm font-bold text-slate-800 mb-4">
                  {consentStatus?.status === "PENDING" &&
                    "Waiting for Customer Approval"}
                  {consentStatus?.status === "OPENED" &&
                    "Customer Reviewing Request"}
                  {consentStatus?.status === "APPROVED" &&
                    "Customer Approved Redemption"}
                  {consentStatus?.status === "REJECTED" &&
                    "Customer Rejected Redemption"}
                  {consentStatus?.status === "EXPIRED" &&
                    "Consent Link Expired"}
                </p>

                <p className="text-center text-[11px] text-slate-500 mb-6">
                  WhatsApp message sent to {customer.mobile}
                </p>

                {/* LIVE TRACKER */}

                <div className="space-y-2 text-xs font-semibold">

                  <div
                    className={`flex items-center gap-2 ${
                      consentStatus?.status
                        ? "text-emerald-600"
                        : "text-slate-400"
                    }`}
                  >
                    ✓ Request Sent
                  </div>

                  <div
                    className={`flex items-center gap-2 ${
                      ["OPENED", "APPROVED", "REJECTED"].includes(
                        consentStatus?.status
                      )
                        ? "text-emerald-600"
                        : "text-slate-400"
                    }`}
                  >
                    ✓ Customer Opened Link
                  </div>

                  <div
                    className={`flex items-center gap-2 ${
                      consentStatus?.status === "APPROVED"
                        ? "text-emerald-600"
                        : consentStatus?.status === "REJECTED"
                        ? "text-red-600"
                        : "text-slate-400"
                    }`}
                  >
                    {consentStatus?.status === "APPROVED"
                      ? "✓ Approved"
                      : consentStatus?.status === "REJECTED"
                      ? "✕ Rejected"
                      : "Waiting for Approval"}
                  </div>
                </div>

                {/* ACTION */}

                {consentStatus?.status === "APPROVED" && (
                  <button
                    onClick={() => {
                      setShowInvModal(false);
                      setRequestId(null);
                    }}
                    className="mt-6 w-full bg-emerald-600 text-white py-3 rounded-xl font-bold"
                  >
                    Apply & Close
                  </button>
                )}

                {consentStatus?.status === "REJECTED" && (
                  <button
                    onClick={() => {
                      setShowInvModal(false);
                      setRequestId(null);
                    }}
                    className="mt-6 w-full bg-red-600 text-white py-3 rounded-xl font-bold"
                  >
                    Close
                  </button>
                )}

                {consentStatus?.status === "EXPIRED" && (
                  <button
                    onClick={() => {
                      setShowInvModal(false);
                      setRequestId(null);
                    }}
                    className="mt-6 w-full bg-slate-700 text-white py-3 rounded-xl font-bold"
                  >
                    Close
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      {/* {showQRModal && requestId && (
        <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-8 shadow-2xl text-center">
            <h3 className="text-lg font-bold mb-4">Customer Consent Required</h3>
            <p className="text-xs text-slate-500 mb-6">
              Ask customer to scan this QR and approve redemption.
            </p>
            <div className="flex justify-center mb-6">
              <QRCodeSVG
                value={`${window.location.origin}/redeem-consent/${requestId}`}
                size={180}
              />
            </div>
            <p className="text-[11px] text-slate-900 break-all mb-6">
              {`${window.location.origin}/redeem-consent/${requestId}`}
            </p>
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )} */}
      {showDeclaration && (
        <ExchangeDeclarationPDF
          customer={customer}
          items={billing.exchangeGold.items}
          onClose={() => setShowDeclaration(false)}
        />
      )}
      {showPaymentModal && (
        <PaymentModal
          open={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          estimationId={estimationId}
          totalAmount={metrics.rounded}
          exchangeItems={billing.exchangeGold.items}
          investmentAmount={billing.redeemAmount}
          onSuccess={(finalRef) => {
            setShowPaymentModal(false);
            setData((prev) => ({
              ...prev,
              status: "CLOSED",
              payment: {
                ...(prev.payment || {}),
                reference: finalRef,
              },
            }));

            setShowInvoice(true);
          }}
        />
      )}
      {showInvoice && data && (
        <GSTInvoiceA5
          customer={customer}
          items={data?.invoice?.items || []}
          adjustments={data?.invoice?.adjustments || {}}
          totals={data?.invoice?.totals || {}}
          paymentLedger={data?.invoice?.paymentLedger}
          invoiceNo={data?.invoice?.number}
          generatedAt={data?.invoice?.generatedAt}
          onClose={() => setShowInvoice(false)}
        />
      )}
      <PasscodeModal
        open={showPasscode}
        onClose={() => setShowPasscode(false)}
        actionTitle={
          pendingDeleteIndex !== null
            ? "delete this item"
            : "update customer permanently"
        }
        onSuccess={async () => {
          // CASE 1 — item delete
          if (pendingDeleteIndex !== null) {
            await handleConfirmedDelete();
            setPendingDeleteIndex(null); 
            setShowPasscode(false);
            return;
          }
          // CASE 2 — permanent customer update
          try {
            await updateDoc(doc(db, "customers", editCustomer.id), {
              ...editCustomer,
              lastUpdated: serverTimestamp(),
            });
            setFullCustomer(editCustomer);
            setData((prev) => ({ ...prev, customer: editCustomer }));
            setShowEditCustomer(false);
          } catch (e) {
            alert("Customer update failed");
          }
          setShowPasscode(false);
        }}
      />
      {showEditCustomer && editCustomer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[1000]">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200">
            <h3 className="text-sm font-black uppercase tracking-widest mb-4">
              Edit Customer
            </h3>
            <div className="space-y-3">
              <div className="flex gap-2 mb-4 text-xs font-bold">
                <button
                  onClick={() => setEditMode("TRANSACTION")}
                  className={`flex-1 py-2 rounded-lg border ${
                    editMode === "TRANSACTION"
                      ? "bg-slate-900 text-white"
                      : "border-slate-200"
                  }`}
                >
                  This Transaction Only
                </button>
                <button
                  onClick={() => setEditMode("PERMANENT")}
                  className={`flex-1 py-2 rounded-lg border ${
                    editMode === "PERMANENT"
                      ? "bg-indigo-600 text-white"
                      : "border-slate-200"
                  }`}
                >
                  Permanent Update
                </button>
              </div>
              <input
                value={editCustomer.name || ""}
                onChange={(e) =>
                  setEditCustomer((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Customer Name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={editCustomer.mobile || ""}
                onChange={(e) =>
                  setEditCustomer((p) => ({ ...p, mobile: e.target.value }))
                }
                placeholder="Mobile"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                value={editCustomer.pan || ""}
                onChange={(e) =>
                  setEditCustomer((p) => ({ ...p, pan: e.target.value.toUpperCase() }))
                }
                placeholder="PAN"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm uppercase"
              />
              <textarea
                value={editCustomer.address || ""}
                onChange={(e) =>
                  setEditCustomer((p) => ({ ...p, address: e.target.value }))
                }
                placeholder="Address"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => {
                  setShowEditCustomer(false);
                  setEditCustomer(null);
                }}
                className="flex-1 py-2 rounded-lg border border-slate-200 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                    if (editMode === "PERMANENT") {
                      setShowPasscode(true);
                      return;
                    }
                    // Transaction-only update
                    setData((prev) => ({
                      ...prev,
                      customer: editCustomer,
                    }));
                    setShowEditCustomer(false);
                  }}
                className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}