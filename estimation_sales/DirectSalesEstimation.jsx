import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search,Barcode,Plus,Trash2,Save,Printer,Lock,UserPlus,Loader2,
  CheckCircle2,User, Phone, ShoppingBag, MapPin,Info,  ArrowLeft,
  SaveOff} from "lucide-react";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  startAfter,
  startAt,
  endAt,
  doc,
  getDoc
} from "firebase/firestore";

import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { Html5Qrcode,Html5QrcodeSupportedFormats } from "html5-qrcode";
import { db, auth } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";
import { useNavigate } from "react-router-dom";

// Collections to fetch and save
const CUSTOMERS_COLLECTION = collection(db, "CUSTOMERS");
const ITEMS_COLLECTION = collection(db, "stock_items");
const ESTIMATION_TYPE = "DIRECT_SALE";

/* =========================================================
   THERMAL SLIP TEMPLATE
========================================================= */
const ThermalSlipTemplate = ({ customer, items, summary, estimationId }) => {
  const date = new Date().toLocaleString();
  return (
    <div id="thermal-slip-content" className="hidden">
      <div style={{ width: "72mm", padding: "6px", fontFamily: "monospace" }}>
        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "16px" }}>
          KESHAVA JEWELLERS
        </div>
        <div style={{ fontSize: "11px", marginTop: "6px" }}>
          ID: {estimationId || "DRAFT"}<br />
          Date: {date}<br />
          Customer: {customer.name}<br />
          Mobile: {customer.mobile}
        </div>
        <hr />
        {items.map((i, idx) => (
          <div key={idx} style={{ fontSize: "11px" }}>
            {idx + 1}. {i.productName} — ₹{i.total.toFixed(2)}
          </div>
        ))}
        <hr />
        <div style={{ fontWeight: "bold" }}>
          TOTAL: ₹{summary.totalAmount.toFixed(2)}
        </div>
        <div style={{ fontSize: "10px", marginTop: "10px", textAlign: "center" }}>
          * Estimation valid for 24 hours *
        </div>
      </div>
    </div>
  );
};

const TableInput = ({ value, onChange, disabled }) => {
  return (
    <input
      type="number"
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="
        w-full
        h-9
        px-2
        text-sm
        text-center
        rounded-lg
        border border-transparent
        bg-[#FAF7F2]
        text-[#2C2C2C]
        transition-all duration-150
        focus:outline-none
        focus:border-[#C9B48C]
        focus:bg-white
        disabled:opacity-60
        disabled:cursor-not-allowed
      "
    />
  );
};


// Main Component
export default function DirectSalesEstimation() {
  const [user, setUser] = useState(null);
  // const [loadingStock, setLoadingStock] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const searchInputRef = useRef(null);
  // const calculateEstimationFn = httpsCallable(functions, "calculateEstimation");
  const deleteDraftFn = httpsCallable(functions, "deleteDraft");
  const reserveItemFn = httpsCallable(functions, "reserveItem");
  const [reservingIds, setReservingIds] = useState({});
  const releaseItemFn = httpsCallable(functions, "releaseItem");
  const [userDrafts, setUserDrafts] = useState([]);
  const navigate = useNavigate();



  const [customer, setCustomer] = useState({
    mobile: "",
    name: "",
    city: "",
    id: "",
    exists: false
  });
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 20;
  const [stockItems, setStockItems] = useState([]); 
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [savedEstimationId, setSavedEstimationId] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const html5QrCodeRef = useRef(null);
  const scannerRunningRef = useRef(false);
  const dropdownRef = useRef(null);
  const [draftEstimationId] = useState(() => `DRAFT-${Date.now()}`);
  const [showDraftPanel, setShowDraftPanel] = useState(false);
  const scanLockRef = useRef(false);

  /* ================= AUTH ================= */
  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);
  const loadItemsPage = async (reset = false) => {
  if (!user) return;

  let q;

  if (reset || !lastDoc) {
    q = query(
      ITEMS_COLLECTION,
      orderBy("pieceBarcode"),
      limit(PAGE_SIZE)
    );
  } else {
    q = query(
      ITEMS_COLLECTION,
      orderBy("pieceBarcode"),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );
  }

  const snap = await getDocs(q);
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  setStockItems(prev => (reset ? list : [...prev, ...list]));
  setLastDoc(snap.docs[snap.docs.length - 1] || null);
  setHasMore(snap.docs.length === PAGE_SIZE);
};

  // Stock Loading
  useEffect(() => {
  if (user) loadItemsPage(true);
  }, [user]);

const normalizeBarcode = (value) => {
  let v = String(value)
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .trim();

  // convert JK916001 → JK-916-001
  if (/^[A-Z]{2}\d{6}$/.test(v)) {
    v = `${v.slice(0,2)}-${v.slice(2,5)}-${v.slice(5)}`;
  }

  return v;
};

// const fetchItemByCode = async (code) => {

//   const cleanCode = normalizeBarcode(code);

//   const q = query(
//     collection(db, "stock_items"),
//     where("pieceBarcode", "==", cleanCode),
//     limit(1)
//   );

//   const snap = await getDocs(q);
//   console.log("Searching barcode:", cleanCode);

//   if (snap.empty) {
//     console.warn("Barcode not found:", cleanCode);
//     return null;
//   }

//   const docSnap = snap.docs[0];
//   const data = docSnap.data();

//   if (
//     data.status === "IN_STOCK" ||
//     data.reservedByEstimationId === draftEstimationId
//   ) {
//     return { id: docSnap.id, ...data };
//   }

//   alert(`Item ${cleanCode} is currently ${data.status}`);
//   return null;
// };

  useEffect(() => {
  searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
  const handleClickOutside = (e) => {
    if (!dropdownRef.current) return;


    if (!dropdownRef.current.contains(e.target)) {
      setShowDropdown(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);
  return () => document.removeEventListener("mousedown", handleClickOutside);
}, []);


  // Fetch Customer
  useEffect(() => {
    if (customer.mobile.length !== 10 || !user) return;
    const lookup = async () => {
      setSearchingCustomer(true);
      try {
        const q = query(
          CUSTOMERS_COLLECTION,
          where("mobile", "==", customer.mobile)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const data = snap.docs[0].data();
          setCustomer(c => ({
            ...c,
            name: data.name,
            city: data.city,
            id: data.customerId,
            dob: data.dob,
            pan: data.panNumber,
            aadhar: data.aadhaarNumber,
            exists: true
          }));
        }
      } finally {
        setSearchingCustomer(false);
      }
    };
    const t = setTimeout(lookup, 400);
    return () => clearTimeout(t);
  }, [customer.mobile, user]);

  // Item freeze alert on page close
  useEffect(() => {
  const handleBeforeUnload = (e) => {
    if (items.length > 0 && !isLocked) {
      e.preventDefault();
      e.returnValue = "";
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);

  return () => {
    window.removeEventListener("beforeunload", handleBeforeUnload);
  };
}, [items, isLocked]);

// Draft Estimations

useEffect(() => {
  if (!user) return;

  const loadDrafts = async () => {
    const q = query(
      collection(db, "draft_estimations"),
      where("uid", "==", user.uid),
      where("status", "==", "DRAFT")
    );

    const snap = await getDocs(q);

    setUserDrafts(
      snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
    );
  };

  loadDrafts();
}, [user]);

// dRAFT dESIGN

const loadDraft = async (draft) => {
  if (!draft) return;

  try {
    // 1️⃣ Release current reserved items first (important)
    for (const item of items) {
      await releaseItemFn({
        stockItemId: item.stockItemId,
        estimationId: draftEstimationId,
      });
    }

    // 2️⃣ Reset current state
    setItems([]);
    setIsLocked(false);
    setSavedEstimationId("");

    // 3️⃣ Load customer
    setCustomer({
      mobile: draft.customer?.mobile || "",
      name: draft.customer?.name || "",
      city: draft.customer?.city || "",
      id: draft.customer?.id || "",
      dob: draft.customer?.dob || null,
      pan: draft.customer?.pan || null,
      aadhar: draft.customer?.aadhar || null,
      exists: true
    });

    // 4️⃣ Load items properly (recalculate totals locally)
    const rebuiltItems = draft.items.map(item => {
      const base = {
        ...item,
        uid: crypto.randomUUID(),
      };

      return {
        ...base,
        total: calculateLocalTotal(base),
      };
    });

    setItems(rebuiltItems);

    setShowDraftPanel(false);

  } catch (err) {
    console.error("Draft load failed:", err);
    alert("Failed to load draft safely.");
  }
};


  // Summary Calculation
  
  const summary = useMemo(() => {
    const totalAmount = items.reduce((s, i) => s + (i.total || 0), 0);
    return { itemCount: items.length, totalAmount };
  }, [items]);
  const isAlreadyAdded = (stockItemId) =>
    items.some(i => i.stockItemId === stockItemId);

// Item CRUD Operations Add, Remove, Update
  const addItem = async (stock) => {
  if (isAlreadyAdded(stock.id) || isLocked) return;
  if (reservingIds[stock.itemId]) return;
  setReservingIds(prev => ({ ...prev, [stock.itemId]: true }));

  try {
    // 🔒 1. Reserve on server FIRST
    await reserveItemFn({
      stockItemId: stock.id,
      estimationId: draftEstimationId,
    });

    const mcFromStock = stock.makingCharge || {};

    let makingChargeType = null;
    let makingChargeValue = 0;

    const grams = Number(mcFromStock.grams);
    const percent = Number(mcFromStock.percent);

    if (!isNaN(grams) && grams > 0) {
      makingChargeType = "GRAM";
      makingChargeValue = grams;
    } else if (!isNaN(percent) && percent > 0) {
      makingChargeType = "PERCENT";
      makingChargeValue = percent;
    }

    const base = {
      uid: crypto.randomUUID(),
      stockItemId: stock.id,
      productId: stock.pieceBarcode || stock.id,
      productName: stock.ornamentName || stock.category,

      grossWeight: Number(stock.grossWeight) || 0,
      stoneWeight: Number(stock.stoneWeight) || 0,
      netWeight:
        Number(stock.grossWeight || 0) - Number(stock.stoneWeight || 0),

      stoneCharges: Number(stock.stoneCharge) || 0,
      purity: stock.purity || stock.goldPurity || "22KT",
      makingChargeType,
      makingChargeValue,
      rate: 0,
      hsnCode: stock.hsnCode || "7113",
      huid: stock.huid || null,
    };

    const total = calculateLocalTotal(base);

    setItems((prev) => [...prev, { ...base, total }]);

    setSearchTerm("");
    setShowDropdown(false);
  } catch (err) {
    alert(err.message || "Item is reserved by another staff");
  } finally {
    setReservingIds(prev => {
      const copy = { ...prev };
      delete copy[stock.itemId];
      return copy;
    });
  }
};

  const updateItem = (idx, field, value) => {
  setItems(prev => {
    const copy = [...prev];

    copy[idx][field] = value;

    // Recalculate net weight (convert safely)
    if (field === "grossWeight" || field === "stoneWeight") {
      const gross = Number(copy[idx].grossWeight) || 0;
      const stone = Number(copy[idx].stoneWeight) || 0;
      copy[idx].netWeight = gross - stone;
    }

    copy[idx].total = calculateLocalTotal(copy[idx]);

    return copy;
  });
};



  const removeItem = async (index) => {
  const itemToRemove = items[index];

  try {
    await releaseItemFn({
      stockItemId: itemToRemove.stockItemId,
      estimationId: draftEstimationId,
    });
  } catch (err) {
    console.error("Release failed:", err);
  }

  setItems(prev => prev.filter((_, i) => i !== index));
};


// Save
  const saveAndLock = async () => {
  // 🛑 Prevent double click
  if (saving) return;

  // 1️⃣ Basic Validation
  if (!user || !items.length || !customer.name) {
    alert("Please ensure customer name and items are added before saving.");
    return;
  }

  if (!draftEstimationId) {
    alert("Draft session expired. Please re-add items.");
    return;
  }

  setSaving(true);

  try {
    const secureSaveFn = httpsCallable(functions, "secureSaveEstimation");

    // 2️⃣ Prepare Payload
    const payload = {
      draftEstimationId,
      estimationType: ESTIMATION_TYPE,

      createdBy: {
        uid: user.uid,
        email: user.email || null,
        name: user.displayName || null,
      },

      customer: {
        id: customer.id || "",
        name: customer.name,
        mobile: customer.mobile,
        city: customer.city,
        dob: customer.dob || null,
        panNumber: customer.pan || null,
        aadharNumber: customer.aadhar || null,
      },

      items: items.map(item => ({
        productName: item.productName,
        purity: item.purity,
        stockItemId: item.stockItemId,
        rate: Number(item.rate),
        grossWeight: Number(item.grossWeight),
        stoneWeight: Number(item.stoneWeight),
        netWeight: Number(item.netWeight),
        stoneCharges: Number(item.stoneCharges),
        makingChargeType: item.makingChargeType,
        makingChargeValue: Number(item.makingChargeValue),
        hsnCode: item.hsnCode || "7113",
        huid: item.huid || null,
      })),
    };

    // 3️⃣ Call Cloud Function
    const response = await secureSaveFn(payload);

    if (!response.data?.success) {
      throw new Error("Backend reported failure");
    }

    // 4️⃣ Lock UI
    setSavedEstimationId(response.data.estimationId);
    setIsLocked(true);

    // 5️⃣ Refresh Draft List (removes deleted draft from UI)
    const draftSnap = await getDocs(
      query(
        collection(db, "draft_estimations"),
        where("uid", "==", user.uid),
        where("status", "==", "DRAFT")
      )
    );

    setUserDrafts(
      draftSnap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }))
    );

    // 6️⃣ Refresh Stock Items (to reflect RESERVED_QUOTATION)
    await loadItemsPage(true);

  } catch (err) {
    console.error("Secure Save Error:", err);
    alert(`Legal Verification Failed: ${err.message}`);
  } finally {
    setSaving(false);
  }
};




  // Rest and Print
  const resetAll = async () => {
  try {
    for (const item of items) {
      await releaseItemFn({
        itemId: item.id,
        estimationId: draftEstimationId,
      });
    }
  } catch (err) {
    console.error("Bulk release error:", err);
  }

  setCustomer({ mobile: "", name: "", city: "", id: "", exists: false });
  setItems([]);
  setSearchTerm("");
  setShowDropdown(false);
  setIsLocked(false);
  setSavedEstimationId("");
};

const handleDeleteDraft = async (draftId) => {
  await deleteDraftFn({ draftId });

  setUserDrafts(prev => prev.filter(d => d.id !== draftId));
};

  const printSlip = () => {
    const content = document.getElementById("thermal-slip-content");
    if (!content) return;
    const win = window.open("", "_blank", "width=360,height=600");
    win.document.write(`<html><body>${content.innerHTML}</body></html>`);
    win.document.close();
    win.print();
    win.close();
  };

  const barcodeBuffer = useRef("");
  const lastKeyTime = useRef(Date.now());

// useEffect(() => {
//   const handleGlobalKeyDown = async (e) => {
//     if (isLocked) return;

//     const now = Date.now();
//     if (now - lastKeyTime.current > 200) { // Reduced from 500ms to 50ms for faster hardware scanners
//       barcodeBuffer.current = "";
//     }
//     lastKeyTime.current = now;

//     if (e.key.length === 1) {
//       barcodeBuffer.current += e.key;
//     }

//     if (e.key === "Enter") {
//       e.preventDefault();
//       const scannedCode = barcodeBuffer.current.trim();
//       barcodeBuffer.current = "";

//       if (scannedCode) {
//         const match = await fetchItemByCode(scannedCode);
//         if (match) {
//           addItem(match);
//         }
//       }
//     }
//   };

//   window.addEventListener("keydown", handleGlobalKeyDown);
//   return () => window.removeEventListener("keydown", handleGlobalKeyDown);
// }, [isLocked, items, customer]); // Added items/customer to ensure the latest state is captured


const startCameraScan = () => {
  if (isLocked) return;
  scanLockRef.current = false;
  setCameraOpen(true);
};

// useEffect(() => {
//   if (!cameraOpen) return;

//   const start = async () => {
//     try {

//       // Wait for DOM render
//       await new Promise(res => setTimeout(res, 200));

//       if (!html5QrCodeRef.current) {
//         html5QrCodeRef.current = new Html5Qrcode("camera-scanner");
//       }

//       await html5QrCodeRef.current.start(
//         { facingMode: "environment" },
//         {
//           fps: 10,
//           qrbox: { width: 420, height: 120 },
//           formatsToSupport: [
//             Html5QrcodeSupportedFormats.CODE_128,
//             Html5QrcodeSupportedFormats.CODE_39,
//             Html5QrcodeSupportedFormats.CODE_93,
//             Html5QrcodeSupportedFormats.EAN_13,
//             Html5QrcodeSupportedFormats.EAN_8,
//             Html5QrcodeSupportedFormats.UPC_A,
//             Html5QrcodeSupportedFormats.UPC_E,
//             Html5QrcodeSupportedFormats.ITF
//           ]
//         },
              
//         async (decodedText) => {
//           // prevent multiple scans
//           if (scanLockRef.current) return;
//           scanLockRef.current = true;
//            console.log("RAW SCAN:", decodedText);
//           const code = normalizeBarcode(decodedText);
//           console.log("NORMALIZED:", code);
//           console.log("SCANNED:", code);
//           const match = await fetchItemByCode(code);
//           if (!match) {
//             alert("Item not found for barcode: " + code);
//             scanLockRef.current = false;
//             return;
//           }
//           if (!isLocked) {
//             addItem(match);
//           }
//           stopCameraScan();
//         }
//       );

//       scannerRunningRef.current = true;

//     } catch (err) {
//       console.error("Camera start failed:", err);
//       scannerRunningRef.current = false;
//       setCameraOpen(false);
//     }
//   };

//   start();

//   return () => {
//     stopCameraScan();
//   };

// }, [cameraOpen]);



// const stopCameraScan = async () => {
//   if (
//     html5QrCodeRef.current &&
//     scannerRunningRef.current
//   ) {
//     try {
//       await html5QrCodeRef.current.stop();
//       await html5QrCodeRef.current.clear();
//     } catch (e) {
//       console.warn("Stop skipped:", e.message);
//     }
//   }
//   scannerRunningRef.current = false;
//   setCameraOpen(false);
// };

// const handleSearchKeyDown = async (e) => {

//   // prevent hardware scanner double trigger
//   if (barcodeBuffer.current.length > 0) {
//     return;
//   }

//   if (e.key === "Enter") {
//     e.preventDefault();

//     const code = normalizeBarcode(searchTerm);
//     if (!code) return;

//     const match = await fetchItemByCode(code);

//     if (match && !isLocked) {
//       addItem(match);
//     }

//     setSearchTerm("");
//     setShowDropdown(false);
//   }
// };


const searchItems = async (term) => {
  if (!term) {
    setLastDoc(null);
    setHasMore(true);
    return loadItemsPage(true);
  }

  const q = query(
    ITEMS_COLLECTION,
    orderBy("pieceBarcode"),
    startAt(term),
    endAt(term + "\uf8ff"),
    limit(20)
  );

  const snap = await getDocs(q);

  setStockItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  setLastDoc(null);
  setHasMore(false);
};



const MobileInput = ({ label, value, onChange, disabled }) => (
  <div>
    <p className="text-[10px] font-bold text-slate-400 uppercase">
      {label}
    </p>
    <input
      type="number"
      disabled={disabled}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="mobile-input"
    />
  </div>
);


const calculateLocalTotal = (item) => {
  const r = Number(item.rate) || 0;
  const net = Number(item.netWeight) || 0;
  const stone = Number(item.stoneCharges) || 0;
  const mc = Number(item.makingChargeValue) || 0;

  let goldValue = 0;

  if (item.makingChargeType === "GRAM") {
    goldValue = (net + mc) * r;
  } else if (item.makingChargeType === "PERCENT") {
    const base = net * r;
    goldValue = base + (base * (mc / 100));
  } else {
    // 🔥 IMPORTANT FALLBACK
    goldValue = net * r;
  }

  const subtotal = goldValue + stone;
  const total = Math.ceil((subtotal * 1.03) / 10) * 10;

  return total;
};

const maskAadhar = (value) =>
  value ? "XXXX-XXXX-" + value.slice(-4) : "";

const maskPan = (value) =>
  value ? value.slice(0, 2) + "XXXXX" + value.slice(-1) : "";

const maskDob = (value) =>
  value ? "XX/XX/" + new Date(value).getFullYear() : "";

  return (
    <div className="max-h-[90vh] bg-[#F8FAFC] p-4 md:p-8 font-sans text-slate-900 selection:bg-indigo-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="sticky top-0 z-40 bg-white px-5 py-3 border-b border-[#E7E1D7] flex items-center justify-between">
          {/* LEFT */}
          <div className="flex items-center gap-4">
            <button
            onClick={() => navigate("/sales/estimations/generator")}
            className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[#E2D6C2] bg-white hover:bg-[#F6F1E6] transition"
          >
            <ArrowLeft className="w-4 h-4 text-slate-900" />
            <span className="text-xs font-semibold text-slate-700 hidden md:block">
              Back
            </span>
          </button>
            <button
              onClick={() => setShowDraftPanel(true)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-lg bg-[#F9F6F0] justify-center border border-[#E2D6C2]"
            >
              <SaveOff className="w-5 h-5 text-slate-900"/>

              {userDrafts.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {userDrafts.length}
                </span>
              )}
            </button>
            {/* Logo */}
            <div className="w-10 h-10 rounded-lg bg-[#F9F6F0] flex items-center justify-center border border-[#E2D6C2]">
              <ShoppingBag className="w-5 h-5 text-slate-900" />
            </div>
            {/* Title + Tags */}
            <div className="flex items-center gap-3">
              {/* <span className="px-3 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide
                              bg-[#F9F6F0] text-slate-900 border border-[#E2D6C2]">
                Direct Sale
              </span> */}
              {isLocked && (
                <span className="flex items-center gap-1 px-3 py-1 rounded-md text-[10px] font-semibold uppercase tracking-wide
                                bg-[#F3E4D2] text-[#8B5E34] border border-[#E6D3BD]">
                  <Lock className="w-3 h-3" />
                  Locked
                </span>
              )}

              <span className="text-[11px] text-slate-500">
                Draft ID: <span className="font-mono">{draftEstimationId}</span>
              </span>
            </div>
          </div>
        </header>
        {showDraftPanel && (
          <div className="fixed inset-0 z-50 flex">

            {/* Overlay */}
            <div
              className="flex-1 bg-black/30"
              onClick={() => setShowDraftPanel(false)}
            />

            {/* Panel */}
            <div className="w-[420px] bg-white h-full shadow-2xl p-6 overflow-y-auto">

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold">Saved Drafts</h3>
                <button
                  onClick={() => setShowDraftPanel(false)}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Close
                </button>
              </div>

              {userDrafts.length === 0 && (
                <p className="text-sm text-slate-400">No drafts available</p>
              )}

              {userDrafts.map(draft => (
                <div
                  key={draft.id}
                  className="border border-slate-200 rounded-lg p-4 mb-4 hover:shadow-sm transition"
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-xs text-slate-500">
                      {draft.id}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(draft.savedAt).toLocaleString("en-IN")}
                    </span>
                  </div>

                  {/* Customer */}
                  <div className="mb-2">
                    <p className="text-sm font-semibold">
                      {draft.customer?.name || "Walk-in Customer"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {draft.customer?.mobile}
                    </p>
                  </div>

                  {/* Product Summary */}
                  <div className="text-xs text-slate-600 space-y-1 mb-3">
                    {draft.items?.slice(0, 2).map((item, i) => (
                      <p key={i}>
                        • {item.productName} — ₹{calculateLocalTotal(item).toLocaleString("en-IN")}
                      </p>
                    ))}

                    {draft.items?.length > 2 && (
                      <p className="text-slate-400">
                        +{draft.items.length - 2} more items
                      </p>
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs text-slate-500">Total</span>
                    <span className="font-semibold text-sm">
                      ₹{
                        draft.items
                          ?.reduce((s, i) => s + calculateLocalTotal(i), 0)
                          ?.toLocaleString("en-IN")
                      }
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadDraft(draft)}
                      className="flex-1 py-1.5 text-xs rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
                    >
                      Load
                    </button>

                    <button
                      onClick={() => handleDeleteDraft(draft.id)}
                      className="flex-1 py-1.5 text-xs rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition"
                    >
                      Delete
                    </button>
                  </div>

                </div>
              ))}
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <section className="dashboard-bg border border-[#E7E1D7] rounded-xl p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-md bg-white border border-[#E2D6C2] flex items-center justify-center">
                    <UserPlus className="w-4 h-4 text-slate-900" />
                  </div>
                  <h2 className="text-sm font-semibold text-[#2C2C2C]">
                    Customer Details
                  </h2>
                </div>

                {searchingCustomer && (
                  <Loader2 className="w-4 h-4 animate-spin text-[#8B6A2F]" />
                )}
              </div>

              {/* Base Fields — Always Visible */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Mobile */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    Mobile
                  </label>
                  <input
                    type="tel"
                    disabled={isLocked}
                    placeholder="10 digits"
                    value={customer.mobile}
                    onChange={e =>
                      setCustomer({
                        ...customer,
                        mobile: e.target.value.replace(/\D/g, "").slice(0, 10),
                      })
                    }
                    className="w-full px-3 py-2 rounded-md border border-[#E2D6C2] bg-white text-sm focus:outline-none focus:border-[#C9B48C]"
                  />
                </div>

                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    Name
                  </label>
                  <input
                    type="text"
                    disabled={isLocked || customer.exists}
                    value={customer.name}
                    onChange={e =>
                      setCustomer({ ...customer, name: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border border-[#E2D6C2] bg-white text-sm focus:outline-none focus:border-[#C9B48C]"
                  />
                </div>

                {/* Location */}
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                    Location
                  </label>
                  <input
                    type="text"
                    disabled={isLocked || customer.exists}
                    value={customer.city}
                    onChange={e =>
                      setCustomer({ ...customer, city: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-md border border-[#E2D6C2] bg-white text-sm focus:outline-none focus:border-[#C9B48C]"
                  />
                </div>

              </div>

              {/* 🔐 SECURE FIELDS — ONLY IF AVAILABLE */}
              {(customer.pan || customer.aadhar || customer.dob) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 border-t border-[#E7E1D7] pt-4">

                  {customer.pan && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                        PAN (Secured)
                      </label>
                      <input
                        type="text"
                        value={maskPan(customer.pan)}
                        disabled
                        className="w-full px-3 py-2 rounded-md border border-[#E2D6C2] bg-slate-100 text-sm font-mono text-slate-700"
                      />
                    </div>
                  )}

                  {customer.aadhar && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                        Aadhar (Secured)
                      </label>
                      <input
                        type="text"
                        value={maskAadhar(customer.aadhar)}
                        disabled
                        className="w-full px-3 py-2 rounded-md border border-[#E2D6C2] bg-slate-100 text-sm font-mono text-slate-700"
                      />
                    </div>
                  )}

                  {customer.dob && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                        DOB (Secured)
                      </label>
                      <input
                        type="text"
                        value={maskDob(customer.dob)}
                        disabled
                        className="w-full px-3 py-2 rounded-md border border-[#E2D6C2] bg-slate-100 text-sm font-mono text-slate-700"
                      />
                    </div>
                  )}

                </div>
              )}
            </section>
            {!isLocked && (
              <section className="bg-[#FFFFFF] border border-[#E7E1D7] rounded-2xl p-4 flex flex-col md:flex-row gap-3">
                {/* ================= SEARCH ================= */}
                <div className="relative flex-1" ref={dropdownRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5A88E]" />
                  <input
                    type="text"
                    placeholder="Search ornament or item ID..."
                    value={searchTerm}
                    // onKeyDown={handleSearchKeyDown}
                    onFocus={() => setShowDropdown(true)}
                    onChange={e => {
                      const v = e.target.value;
                      setSearchTerm(v);
                      searchItems(v);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#E2D6C2] bg-white
                              text-sm text-[#2C2C2C] placeholder:text-[#B5A88E]
                              focus:outline-none focus:border-[#C9B48C]"
                  />
                  {showDropdown && stockItems.length > 0 && (
                    <div
                      className="absolute z-50 mt-2 w-full bg-white border border-[#E2D6C2] rounded-xl shadow-sm max-h-72 overflow-y-auto"
                      onScroll={(e) => {
                        const el = e.target;
                        if (
                          hasMore &&
                          el.scrollTop + el.clientHeight >= el.scrollHeight - 10
                        ) {
                          loadItemsPage(false);
                        }
                      }}
                    >
                      {stockItems.map(item => {
                        const isReserving = reservingIds[item.id];
                        const isReserved = item.status === "RESERVED_DRAFT" || item.status === "RESERVED_QUOTATION";
                        const alreadyAdded = isAlreadyAdded(item.id);

                        const disabled =
                          isReserving ||
                          isReserved ||
                          alreadyAdded;

                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (disabled || reservingIds[item.id]) return;
                              addItem(item);
                            }}
                            className={`
                              px-4 py-3 flex justify-between items-center
                              ${disabled
                                ? "opacity-50 cursor-not-allowed"
                                : "hover:bg-[#F6F1E6] cursor-pointer"}
                            `}
                          >
                            <div>
                              <p className="text-sm font-medium text-[#2C2C2C]">
                                {item.ornamentName}
                              </p>
                              <p className="text-[11px] text-slate-900 uppercase">
                                {item.pieceBarcode || item.id} • {item.purity}
                              </p>

                              {alreadyAdded && (
                                <span className="text-[10px] text-green-600 font-semibold">
                                  ✓ Added to estimation
                                </span>
                              )}

                              {!alreadyAdded && isReserved && (
                                <span className="text-[10px] text-red-500 font-semibold">
                                  Reserved by another staff
                                </span>
                              )}
                            </div>

                            {isReserving ? (
                              <div className="flex items-center gap-1 text-xs text-amber-600">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                Processing...
                              </div>
                            ) : alreadyAdded ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <Plus className="w-4 h-4 text-[#8B6A2F]" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                {/* ================= SCAN BUTTON ================= */}
                {/* <button
                  onClick={startCameraScan}
                  className="md:w-56 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold
                            hover:bg-[#7A5B24] transition-colors flex items-center justify-center gap-2"
                >
                  <Barcode className="w-4 h-4" />
                  Scan Barcode
                </button> */}

                {/* Hidden input for scanner */}
                {/* <input
                  ref={searchInputRef}
                  type="text"
                  className="absolute opacity-0 pointer-events-none"
                /> */}
              </section>
            )}
            <div className="hidden lg:block">
              <section className="bg-white border border-[#E7E1D7] rounded-2xl overflow-hidden">

                {/* ================= HEADER ================= */}
                <div className="grid grid-cols-[2.2fr_0.8fr_0.8fr_0.9fr_1fr_1.1fr_0.9fr_1.1fr_40px]
                                px-5 py-3 text-[11px] font-semibold text-slate-900
                                uppercase tracking-wide dashboard-bg border-b border-[#E7E1D7]">
                  <div>Item</div>
                  <div>Gross</div>
                  <div>Stone</div>
                  <div>Net</div>
                  <div>Rate</div>
                  <div>Making</div>
                  <div>Stone ₹</div>
                  <div className="text-right">Total</div>
                  <div />
                </div>

                {/* ================= ROWS ================= */}
                <div className="max-h-[460px] overflow-y-auto">
                  {items.map((item, idx) => (
                    <div
                      key={item.uid}
                      className="grid grid-cols-[2.2fr_0.8fr_0.8fr_0.9fr_1fr_1.1fr_0.9fr_1.1fr_40px]
                                items-center px-5 py-3 text-sm border-b border-[#F1ECE3]"
                    >
                      <div>
                        <p className="font-medium text-[#2C2C2C] truncate">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-slate-900 uppercase">
                          {item.productId}
                        </p>
                      </div>
                      <TableInput
                        value={item.grossWeight}
                        disabled={isLocked}
                        onChange={v => updateItem(idx, "grossWeight", v)}
                        className="mr-5"
                      />

                      <TableInput
                        value={item.stoneWeight}
                        disabled={isLocked}
                        onChange={v => updateItem(idx, "stoneWeight", v)}
                      />
                      <div className="text-center font-semibold text-[#8B6A2F]">
                        {item.netWeight}
                      </div>
                      <TableInput
                        value={item.rate}
                        disabled={isLocked}
                        onChange={v => updateItem(idx, "rate", v)}
                      />
                      <div className="text-center text-[#2C2C2C] text-sm">
                        {item.makingChargeType === "GRAM"
                          ? `${item.makingChargeValue} GM`
                          : item.makingChargeType === "PERCENT"
                          ? `${item.makingChargeValue}%`
                          : "—"}
                      </div>
                      <TableInput
                        value={item.stoneCharges}
                        disabled={isLocked}
                        onChange={v => updateItem(idx, "stoneCharges", v)}
                      />
                      <div className="text-right font-semibold text-[#2C2C2C]">
                        ₹{Math.round(item.total).toLocaleString("en-IN")}
                      </div>
                      {!isLocked ? (
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-[#C9B48C] hover:text-red-500 flex justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  ))}
                  {items.length === 0 && (
                    <div className="py-16 text-center text-slate-900 text-sm">
                      No items added to estimation
                    </div>
                  )}
                </div>
              </section>
            </div>
            <div className="block lg:hidden space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.uid}
                  className="bg-white border border-[#E7E1D7] rounded-2xl p-4 space-y-4"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3 items-center">
                      <div className="w-9 h-9 rounded-lg bg-[#F1E9DA] border border-[#E2D6C2] flex items-center justify-center text-[#8B6A2F] text-xs font-semibold">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#2C2C2C]">
                          {item.productName}
                        </p>
                        <p className="text-[11px] text-slate-900 uppercase">
                          {item.productId}
                        </p>
                      </div>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="text-[#C9B48C] hover:text-red-500"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <MobileInput
                      label="Gross"
                      value={item.grossWeight}
                      disabled={isLocked}
                      onChange={v => updateItem(idx, "grossWeight", v)}
                    />
                    <MobileInput
                      label="Stone"
                      value={item.stoneWeight}
                      disabled={isLocked}
                      onChange={v => updateItem(idx, "stoneWeight", v)}
                    />
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-slate-900 uppercase">
                        Net
                      </p>
                      <div className="h-[36px] flex items-center justify-center rounded-lg bg-[#F6F1E6] text-[#8B6A2F] text-sm font-semibold border border-[#E2D6C2]">
                        {item.netWeight}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <MobileInput
                      label="Rate / g"
                      value={item.rate}
                      disabled={isLocked}
                      onChange={v => updateItem(idx, "rate", v)}
                    />
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-slate-900 uppercase">
                        Making
                      </p>
                      <div className="h-[36px] flex items-center justify-between px-2 rounded-lg bg-[#FAF7F2] border border-[#E2D6C2] text-sm text-[#2C2C2C]">
                        <span className="text-[11px] text-slate-900">
                          {item.makingChargeType === "GRAM"
                            ? "GM"
                            : item.makingChargeType === "PERCENT"
                            ? "%"
                            : "—"}
                        </span>
                        <input
                          type="number"
                          disabled
                          value={item.makingChargeType ? item.makingChargeValue : ""}
                          className="bg-transparent border-none outline-none text-right w-full"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t border-[#EFE7DA]">
                    <span className="text-[11px] text-slate-900 uppercase font-semibold">
                      Item Total
                    </span>
                    <span className="text-lg font-semibold text-[#2C2C2C]">
                      ₹{Math.round(item.total).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 space-y-5">
            <div className="sticky top-24 space-y-5">
              <section className="dashboard-bg border border-[#E7E1D7] rounded-2xl p-6 space-y-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      Total Payable
                    </p>
                    <h2 className="text-4xl font-semibold tracking-tight text-[#2C2C2C] mt-1">
                      ₹{Math.round(summary.totalAmount).toLocaleString("en-IN")}
                    </h2>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-white border border-[#E2D6C2] flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-slate-900" />
                  </div>
                </div>
                <div className="border border-[#EFE7DA] rounded-lg p-3 flex justify-between items-center bg-white">
                  <span className="text-[11px] uppercase font-semibold text-slate-900">
                    Quantity
                  </span>
                  <span className="text-sm font-semibold text-[#2C2C2C]">
                    {summary.itemCount} Units
                  </span>
                </div>
                <div className="flex items-start gap-2 text-slate-900 text-[11px]">
                  <Info className="w-4 h-4 mt-[1px]" />
                  <p>Rates calculated based on current gold market price.</p>
                </div>
              </section>
              <div className="space-y-3">
                {!isLocked ? (
                  <button
                    onClick={saveAndLock}
                    disabled={saving || items.length === 0}
                    className="
                      w-full py-3 rounded-lg
                      bg-slate-900 text-white
                      text-sm font-semibold
                      hover:bg-[#7A5B24]
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                      flex items-center justify-center gap-2
                    "
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Estimation
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-[#F6F1E6] border border-[#E2D6C2] rounded-lg p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-md bg-[#EADFCB] flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-[#8B6A2F]" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-slate-900 font-semibold">
                          Entry ID
                        </p>
                        <p className="text-sm font-semibold text-[#2C2C2C]">
                          {savedEstimationId}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={printSlip}
                      className="
                        w-full py-3 rounded-lg
                        border border-[#E2D6C2]
                        bg-white text-[#2C2C2C]
                        text-sm font-semibold
                        hover:bg-[#F7F3EA]
                        transition-colors
                        flex items-center justify-center gap-2
                      "
                    >
                      <Printer className="w-4 h-4" />
                      Print Slip
                    </button>
                    <button
                      onClick={resetAll}
                      className="
                        w-full py-2 text-[11px]
                        text-slate-900 font-semibold uppercase
                        hover:text-[#2C2C2C]
                        transition-colors
                        flex items-center justify-center gap-1
                      "
                    >
                      <Plus className="w-3 h-3" />
                      New Estimation
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        
        body {
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .table-input:focus {
          background: white !important;
          box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
          border: 1px solid rgba(79, 70, 229, 0.3) !important;
        }

        ::-webkit-scrollbar {
          width: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #E2E8F0;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #CBD5E1;
        }

        @media print {
          body * { visibility: hidden; }
          #thermal-slip-content, #thermal-slip-content * { visibility: visible; }
          #thermal-slip-content { position: absolute; left: 0; top: 0; width: 72mm; }
          .no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}