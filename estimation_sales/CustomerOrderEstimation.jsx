import React, { useState, useEffect, useRef } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs,addDoc,serverTimestamp } from "firebase/firestore";
import { User, Package, ReceiptText, Printer,  RotateCcw, Plus, Trash2, Loader2,UserPlus,ArrowLeft } from "lucide-react";
import { ITEM_NAMES } from "../../utils/productMaster";
import { useCustomProductNames } from "../../hooks/useCustomProductNames";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import ThermalSlip from "../common/createThermalSlip";
import { handleThermalPrint } from "../../utils/printHelper";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";




export default function DraftEstimationGenerator() {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [savedOrderId, setSavedOrderId] = useState(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false); // New: Track save status
  const [isSaving, setIsSaving] = useState(false); // New: Loading state for save
  const dropdownRef = useRef(null);
  const { names: displayNames } = useCustomProductNames();
  const navigate = useNavigate();
  const user = getAuth().currentUser;
  const estimationIdRef = useRef(`SS-${Date.now()}`);
  const estimationId = estimationIdRef.current;
  const printRef = useRef(null);
  const [searchingCustomer, setSearchingCustomer] = useState(false);
  const CUSTOMERS_COLLECTION = collection(db, "CUSTOMERS");
  const [isLocked, setIsLocked] = useState(false);
  const [generatedOrderId, setGeneratedOrderId] = useState(null);
  
  

  const [customer, setCustomer] = useState({
      mobile: "",
      name: "",
      city: "",
      id: "",
      exists: false
  });

  const [list, setList] = useState([]);
  const [product, setProduct] = useState({
    item: "", display: "", hsn: "", gross: "",
    stoneWeight: "", rate: "", mcType: "%",
    mcValue: "", stoneCharges: "",
  });

  /* ---------------- CUSTOMER AUTO-FETCH ---------------- */
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

  useEffect(() => {
  const handleClickOutside = (event) => {
    if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
      setShowDropdown(false);
    }
  };

  document.addEventListener("mousedown", handleClickOutside);

  return () => {
    document.removeEventListener("mousedown", handleClickOutside);
  };
}, []);

  const addItem = () => {
    if (!product.item?.trim() || !product.gross || !product.rate) return;

    const netWeight = Number(product.gross || 0) - Number(product.stoneWeight || 0);
    const metalValue = netWeight * Number(product.rate || 0);
    const mc = product.mcType === "%" ? (metalValue * Number(product.mcValue || 0)) / 100 : Number(product.mcValue || 0) * Number(product.rate || 0);
    const total = metalValue + mc + Number(product.stoneCharges || 0);

    setItems([...items, { ...product, total }]);
    setProduct({ item: "", display: "", hsn: "", gross: "", stoneWeight: "", rate: "", mcType: "%", mcValue: "", stoneCharges: "" });
    setSearchTerm("");
  };

  const grandTotal = items.reduce((sum, i) => sum + i.total, 0);

  const filteredItems = React.useMemo(() => {
    const allProducts = [
      ...ITEM_NAMES,
      ...displayNames.map((d) => d.name),
    ];
  
    const uniqueProducts = [...new Set(allProducts)];
  
    return uniqueProducts.filter((name) =>
      name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [displayNames, searchTerm]);

// const handleConfirmAndPrint = async () => {
//   try {
//     // 1️⃣ Print First
//     handleThermalPrint(printRef.current.innerHTML);

//     // 2️⃣ Save Order After Confirm
//     const orderData = {
//       orderId: estimationId,
//       customer,
//       items,
//       status: "OPEN",
//       isDeleted: false,

//       summary: {
//         itemCount: items.length,
//         totalAmount: grandTotal,
//       },

//       createdAt: serverTimestamp(),
//       sortAt: serverTimestamp(),
//     };

//     await addDoc(collection(db, "orders"), orderData);

//     // 3️⃣ Close Modal
//     setShowPrintModal(false);

//     // 4️⃣ Reset Everything
//     setItems([]);
//     setCustomer({ mobile: "", name: "", city: "" });
//     setIsSaved(false);
//     setSavedOrderId(null);

//   } catch (err) {
//     console.error("Save/Print error:", err);
//     alert("Something went wrong.");
//   }
// };

// const handleSaveOrder = async () => {
//   if (!customer.mobile || items.length === 0) {
//     toast.error("Missing customer or items");
//     return;
//   }

//   // If the print modal isn't open yet, open it first for preview
//   if (!showPrintModal) {
//     setShowPrintModal(true);
//     return;
//   }

//   try {
//     setIsSaving(true);

//     const secureSaveEstimation = httpsCallable(functions, "secureSaveEstimation");

//     // This payload matches the keys in your Firestore screenshot exactly
//     const response = await secureSaveEstimation({
//       estimationType: "CUSTOM_ORDER",
//       draftEstimationId: estimationId,   // ⭐ IMPORTANT

//       customer: {
//         name: customer.name,
//         mobile: customer.mobile,
//         city: customer.city,
//         id: customer.id || "",
//       },

//       items: items.map((item) => ({
//         item: item.item,
//         display: item.display || "",
//         hsn: item.hsn || "711319",
//         gross: item.gross,
//         stoneWeight: item.stoneWeight || "",
//         netWeight: Number(item.gross) - Number(item.stoneWeight || 0),
//         rate: item.rate,
//         makingChargeType: item.mcType === "%" ? "PERCENT" : "GRAM",
//         makingChargeValue: item.mcValue,
//         stoneCharges: item.stoneCharges || "",
//       })),
//     });

//    const newOrderId = response.data.estimationId;

//     setGeneratedOrderId(newOrderId);

//     if (printRef.current) {
//       handleThermalPrint(printRef.current.innerHTML);
//     }

//     toast.success(`Order Saved: ${newOrderId}`);

//     // Cleanup state
//     setShowPrintModal(false);
//     setItems([]);
//     setCustomer({ mobile: "", name: "", city: "", id: "", exists: false });
    
//     // Optional: Redirect to the details page we just built
//     navigate(`/orders/${newOrderId}`);

//   } catch (error) {
//     console.error("Save Error:", error);
//     toast.error("Failed to save order. Check console.");
//   } finally {
//     setIsSaving(false);
//   }
// };


const handleSaveAndPrint = async () => {
  // 1. Validation
  if (!customer.mobile || items.length === 0) {
    toast.error("Missing customer or items");
    return;
  }

  try {
    setIsSaving(true);
    const secureSaveEstimation = httpsCallable(functions, "secureSaveEstimation");

    // 2. Call Cloud Function (This generates the KJCO ID)
    const response = await secureSaveEstimation({
      estimationType: "CUSTOM_ORDER",
      draftEstimationId: estimationId, 
      customer: {
        name: customer.name,
        mobile: customer.mobile,
        city: customer.city,
        id: customer.id || "",
      },
      items: items.map((item) => ({
        item: item.item,
        display: item.display || "",
        hsn: item.hsn || "711319",
        gross: item.gross,
        stoneWeight: item.stoneWeight || "",
        netWeight: Number(item.gross) - Number(item.stoneWeight || 0),
        rate: item.rate,
        makingChargeType: item.mcType === "%" ? "PERCENT" : "GRAM",
        makingChargeValue: item.mcValue,
        stoneCharges: item.stoneCharges || "",
      })),
    });

    // 3. Capture the real ID
    const newOrderId = response.data.estimationId;
    setGeneratedOrderId(newOrderId);
    setIsSaved(true);

    // 4. Open the modal so the user sees the preview with the KJCO ID
    setShowPrintModal(true);
    toast.success(`Order Created: ${newOrderId}`);

  } catch (error) {
    console.error("Save Error:", error);
    toast.error(error.message || "Failed to save order");
  } finally {
    setIsSaving(false);
  }
};

// 5. Separate final print trigger (called from the Modal)
const triggerThermalPrint = () => {
  if (printRef.current) {
    handleThermalPrint(printRef.current.innerHTML);
    
    // Optional: Auto-reset and navigate after printing
    setItems([]);
    setCustomer({ mobile: "", name: "", city: "", id: "", exists: false });
    setShowPrintModal(false);
    navigate(`/orders/${generatedOrderId}`);
  }
};

const maskAadhar = (value) =>
  value ? "XXXX-XXXX-" + value.slice(-4) : "";

const maskPan = (value) =>
  value ? value.slice(0, 2) + "XXXXX" + value.slice(-1) : "";

const maskDob = (value) =>
  value ? "XX/XX/" + new Date(value).getFullYear() : "";

  return (
    <div className=" bg-[#F8FAFC] text-slate-900 font-sans flex flex-col overflow-x-hidden">
      
      {/* HEADER */}
      <header className="sticky top-0 z-[100] h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shadow-sm">
        {/* Left Section: Navigation & Title */}
        <div className="flex items-center gap-3 md:gap-6">
          {/* Back Button */}
          <button
            onClick={() => navigate("/sales/estimations/generator")}
            className="group flex items-center justify-center w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 hover:bg-white hover:border-slate-900 hover:text-slate-900 transition-all duration-200 active:scale-90"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="h-8 w-[1px] bg-slate-200 hidden sm:block" />

          {/* Branding/Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200">
              <ReceiptText className="text-white w-5 h-5" />
            </div>
            <div className="flex flex-col leading-tight">
              {/* <h1 className="text-sm md:text-base font-black text-slate-900 uppercase tracking-tighter">
                Custom <span className="text-blue-600">Estimation</span>
              </h1> */}
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                Order Creation Portal
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Global Actions */}
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => {
              setItems([]);
              setCustomer({ mobile: "", name: "", city: "", id: "", exists: false });
              toast.success("Session reset successfully");
            }}
            className="flex items-center gap-2 px-3 md:px-5 py-2 rounded-xl bg-red-50 text-red-600 border border-red-100 text-xs font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all duration-300 active:scale-95 shadow-sm"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Form</span>
            <span className="sm:hidden text-[9px]">Reset</span>
          </button>
        </div>
      </header>


      <main className="flex-1 p-4 lg:p-8 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 bg-white">
        {/* LEFT PANEL: DATA ENTRY */}
        <div className="lg:col-span-8 space-y-8">
          {/* 1. CUSTOMER SECTION */}
          <div className="bg-white backdrop-blur-md rounded-2xl 
          border shadow-sm overflow-hidden">
            {/* Header */}
            {/* <div className="dashboard-bg px-6 py-4 flex items-center gap-2">
              <User className="w-4 h-4 text-slate-900" />
              <h2 className="text-[11px] font-semibold text-slate-900 uppercase tracking-[0.18em]">
                Customer Validation
              </h2>
            </div> */}
            {/* Form */}
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
              
          </div>
          {/* 2. PRODUCT SECTION */}
          <div className="bg-white border border-[#E4D9C6] rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b dashboard-bg flex items-center gap-2">
              <Package className="w-4 h-4 text-slate-900" />
              <h2 className="text-sm font-semibold tracking-wide text-[#5C4A2E]">
                ADD NEW ITEM
              </h2>
            </div>
            {/* Form */}
            <div className="p-5 md:p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { label: "Item Name", value: product.item, key: "item", placeholder: "Gold Ring" },
                  { label: "Display Name", value: product.display, key: "display", placeholder: "Fancy Ring" },
                  { label: "HSN Code", value: product.hsn, key: "hsn", placeholder: "7113" },
                ].map((f) => (
                  <div key={f.key} className="space-y-1">
                    <label className="text-xs font-medium text-[#6E5A3A]">{f.label}</label>
                    {f.key === "item" ? (
                      <div className="relative " ref={dropdownRef}>
                        <input
                          className="w-full h-11 px-3 rounded-lg border border-[#D8CDB7] bg-white
                          focus:outline-none focus:ring-2 focus:ring-[#C6A55B]/40 focus:border-[#C6A55B]
                          text-sm"
                          placeholder={f.placeholder}
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setShowDropdown(true);
                          }}
                          onFocus={() => setShowDropdown(true)}
                        />

                        {showDropdown && filteredItems.length > 0 && (
                          <div className="absolute z-50 w-full bg-white border border-[#E6DCCB] rounded-lg mt-1 shadow-lg max-h-48 overflow-y-auto">
                            {filteredItems.map((name, idx) => {
                              const displayMatch = displayNames.find(d => d.name === name);

                              return (
                                <div
                                  key={idx}
                                  onClick={() => {
                                    setProduct(prev => ({
                                      ...prev,
                                      item: name,
                                      display: displayMatch?.display || "",
                                      hsn: displayMatch?.hsn || "711319",
                                    }));
                                    setSearchTerm(name);
                                    setShowDropdown(false);
                                  }}
                                  className="px-3 py-2 hover:bg-[#F4EFE5] cursor-pointer text-sm"
                                >
                                  {name}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <input
                        className="w-full h-11 px-3 rounded-lg border border-[#D8CDB7] bg-white
                        focus:outline-none focus:ring-2 focus:ring-[#C6A55B]/40 focus:border-[#C6A55B]
                        text-sm"
                        placeholder={f.placeholder}
                        value={f.value}
                        onChange={(e) => setProduct({ ...product, [f.key]: e.target.value })}
                      />
                    )}

                  </div>
                ))}
                {/* Rate */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#6E5A3A]">Rate / gm</label>
                  <input
                    type="number"
                    className="w-full h-11 px-3 rounded-lg border border-[#D8CDB7] bg-white focus:ring-2 focus:ring-[#C6A55B]/40 focus:border-[#C6A55B] outline-none text-sm"
                    value={product.rate}
                    onChange={(e) => setProduct({ ...product, rate: e.target.value })}
                  />
                </div>
                {/* Stone Charge */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#6E5A3A]">Stone Charge</label>
                  <input
                    type="number"
                    className="w-full h-11 px-3 rounded-lg border border-[#D8CDB7] bg-white focus:ring-2 focus:ring-[#C6A55B]/40 focus:border-[#C6A55B] outline-none text-sm"
                    value={product.stoneCharges}
                    onChange={(e) => setProduct({ ...product, stoneCharges: e.target.value })}
                  />
                </div>
              </div>

              {/* === WEIGHT + MC GRID === */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                {/* Gross */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#6E5A3A]">
                    Gross Weight
                  </label>
                  <input
                    type="number"
                    className="w-full h-11 px-3 rounded-lg border border-[#D8CDB7] bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#C6A55B]/40 focus:border-[#C6A55B]
                    text-sm"
                    value={product.gross}
                    onChange={(e) => setProduct({ ...product, gross: e.target.value })}
                    placeholder="0.000"
                  />
                </div>
                {/* Stone Weight */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#6E5A3A]">
                    Stone Weight
                  </label>
                  <input
                    type="number"
                    className="w-full h-11 px-3 rounded-lg border border-[#D8CDB7] bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#C6A55B]/40 focus:border-[#C6A55B]
                    text-sm"
                    value={product.stoneWeight}
                    onChange={(e) => setProduct({ ...product, stoneWeight: e.target.value })}
                    placeholder="0.000"
                  />
                </div>
                {/* Net Weight */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-[#6E5A3A]">
                    Net Weight
                  </label>
                  <input
                    readOnly
                    className="w-full h-11 px-3 rounded-lg border border-[#C6A55B]
                    bg-[#F4EFE5] text-sm font-semibold text-[#3E3320]
                    cursor-not-allowed"
                    value={(Number(product.gross) || 0) - (Number(product.stoneWeight) || 0)}
                  />
                </div>
                {/* Making Charges */}
                <div className="lg:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-[#6E5A3A]">Making Charges</label>
                  <div className="flex h-11 border border-[#D8CDB7] rounded-lg overflow-hidden bg-white">
                    <select
                      className="px-3 bg-[#F4EFE5] border-r border-[#D8CDB7] text-sm outline-none"
                      value={product.mcType}
                      onChange={(e) => setProduct({ ...product, mcType: e.target.value })}
                    >
                      <option value="%">%</option>
                      <option value="Fixed">₹</option>
                    </select>
                    <input
                      type="number"
                      placeholder="Value"
                      className="flex-1 px-3 outline-none text-sm"
                      value={product.mcValue}
                      onChange={(e) => setProduct({ ...product, mcValue: e.target.value })}
                    />
                  </div>
                </div>
                {/* Add Button */}
                <div className="lg:col-span-1">
                  <button
                    onClick={addItem}
                    className="w-full h-11 rounded-xl bg-[#0F172A] text-white
                    flex items-center justify-center gap-2 text-sm font-semibold
                    hover:opacity-90 active:scale-95 transition"
                  >
                    <Plus className="w-4 h-4 text-[#D4AF37]" />
                    Add Item
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* RIGHT PANEL: TABLE & SUMMARY */}
        <div className="lg:col-span-4 flex flex-col gap-6 h-[80vh]">
          <div className="dashboard-bg backdrop-blur-md rounded-2xl 
          border border-[#E6DCCB] shadow-md flex-1 flex flex-col overflow-hidden">
            {/* HEADER */}
            <div className="px-6 py-4 flex justify-between items-center
              dashboard-bg border-b border-[#E8DDC8]">
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#6E5A3A]">
                Estimation Slip
              </h3>
              <span className="bg-gradient-to-br from-[#D4AF37] to-[#B8962E]
              text-white px-3 py-1 rounded-md text-[10px] font-bold tracking-widest">
                {items.length} Items
              </span>
            </div>
            {/* PRODUCT LIST */}
            <div className="flex-1 overflow-y-auto p-4 bg-white">
              {items.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-[#C9BFAE]">
                  <ReceiptText className="w-14 h-14 opacity-40" />
                  <p className="text-xs font-semibold uppercase mt-4 tracking-widest">
                    Draft Empty
                  </p>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0">
                    <tr>
                      <th className="py-2 text-[10px] font-semibold text-[#9C8B6B] uppercase tracking-wider">
                        Description
                      </th>
                      <th className="py-2 text-[10px] font-semibold text-[#9C8B6B] uppercase tracking-wider text-right">
                        Amount (₹)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F5EFE4]">
                    {items.map((item, idx) => (
                      <tr key={idx} className="group">
                        <td className="py-4">
                          <div className="flex items-start gap-3">
                            <button
                              onClick={() => setItems(items.filter((_, i) => i !== idx))}
                              className="text-[#D6CDBD] hover:text-red-500 mt-0.5 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div>
                              <p className="font-semibold text-sm text-[#2F2A23] leading-none">
                                {item.display || item.item}
                              </p>
                              <p className="text-[10px] font-medium text-[#A3957B] mt-1">
                                {item.gross}g × ₹{item.rate}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 text-right font-semibold text-[#2F2A23]">
                          ₹{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {/* TOTALS */}
            <div className="p-6 dashboard-bg">
              <div className="flex justify-between items-end mb-6">
                <div>
                  <p className="text-[10px] font-semibold text-[#9C8B6B] uppercase tracking-widest">
                    Net Payable
                  </p>
                  <p className="text-[10px] font-medium text-emerald-600 mt-1">
                    GST 3% Included
                  </p>
                </div>
                <p className="text-4xl font-light text-[#2C2A25] tracking-tight">
                  ₹{grandTotal.toLocaleString("en-IN")}
                </p>
              </div>
              {/* ACTION BUTTONS */}
              <div className="grid grid-cols-1 gap-3">
                {!isSaved ? (
                  <button
                    onClick={handleSaveAndPrint}
                    disabled={isSaving || items.length === 0}
                    className={`
                      relative overflow-hidden group
                      flex items-center justify-center gap-3 h-14 rounded-2xl
                      text-sm font-black uppercase tracking-[0.15em]
                      transition-all duration-300
                      ${
                        isSaving || items.length === 0
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                          : "bg-slate-900 text-white shadow-xl shadow-slate-200 hover:bg-blue-600 hover:-translate-y-0.5 active:scale-[0.97]"
                      }
                    `}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <Package className={`w-5 h-5 transition-transform group-hover:scale-110 ${items.length === 0 ? 'opacity-50' : 'text-amber-400'}`} />
                        <span>Save Order to Print</span>
                      </>
                    )}
                    
                    {/* Subtle shine effect on hover for enabled state */}
                    {!isSaving && items.length > 0 && (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowPrintModal(true)}
                    className="
                      group flex items-center justify-center gap-3 h-14 rounded-2xl
                      bg-emerald-600 text-white text-sm font-black uppercase tracking-[0.15em]
                      shadow-xl shadow-emerald-100
                      hover:bg-emerald-700 hover:-translate-y-0.5 active:scale-[0.97]
                      transition-all duration-300
                    "
                  >
                    <Printer className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                    <span>Review & Print Slip</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2">
          <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-[480px] overflow-hidden animate-in zoom-in duration-200 flex flex-col">
            
            {/* HEADER: Compact height */}
            <div className="px-5 py-3 border-b flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="text-xs font-bold text-slate-800">Final Confirmation</h3>
                <p className="text-[10px] text-slate-400 leading-none">ID: {generatedOrderId || estimationId}</p>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* BODY: Scrolled preview only if slip is too long */}
            <div className="px-4 py-4 bg-slate-100 flex flex-col items-center">
              <div 
                className="shadow-lg overflow-y-auto max-h-[40vh] bg-white rounded-sm custom-scrollbar"
                style={{ width: "100mm" }}
              >
                <div ref={printRef}>
                  <ThermalSlip
                    customer={customer}
                    items={items}
                    grandTotal={grandTotal}
                    estimationId={generatedOrderId || estimationId}
                  />
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">Scroll to check full slip preview</p>
            </div>

            {/* FOOTER: Reduced padding and button height */}
            <div className="px-6 py-4 bg-white flex flex-col gap-2">
              <button
                onClick={triggerThermalPrint} // Point to the final print trigger
                className="..."
              >
                <Printer className="..." />
                Confirm & Print Slip
              </button>
              <button
                onClick={() => setShowPrintModal(false)}
                className="w-full py-1 text-[11px] font-bold text-slate-400 hover:text-red-500 transition uppercase tracking-wider"
              >
                Go Back to Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}