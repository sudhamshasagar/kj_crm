import React, { useState, useEffect, useRef } from "react";
import { db } from "../../firebaseConfig";
import { collection, query, where, getDocs,addDoc,serverTimestamp} from "firebase/firestore";
import { User, Package, ReceiptText, Printer, Save, RotateCcw, Plus, Trash2, ChevronDown, Search, CheckCircle2 } from "lucide-react";
import { ITEM_NAMES } from "../../utils/productMaster";
import { useCustomProductNames } from "../../hooks/useCustomProductNames";
import ThermalSlip from "../common/createThermalSlip";
import { handleThermalPrint } from "../../utils/printHelper";


export default function DraftEstimationGenerator() {
  const [customer, setCustomer] = useState({ mobile: "", name: "", city: "" });
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const dropdownRef = useRef(null);
  const { names: displayNames } = useCustomProductNames();
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false); 
  const [savedOrderId, setSavedOrderId] = useState(null);
  const printRef = useRef(null);
  const estimationId = `SS-${Date.now()}`;


  const [product, setProduct] = useState({
    item: "", display: "", hsn: "", gross: "",
    stoneWeight: "", rate: "", mcType: "%",
    mcValue: "", stoneCharges: "",
  });

  /* ---------------- CUSTOMER AUTO-FETCH ---------------- */
  useEffect(() => {
    if (customer.mobile.length === 10) {
      const fetchCustomer = async () => {
        setIsFetching(true);
        try {
          const q = query(collection(db, "CUSTOMERS"), where("mobile", "==", customer.mobile));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setCustomer(prev => ({ ...prev, name: data.name || "", city: data.city || "" }));
          }
        } catch (err) { console.error("Fetch error:", err); }
        finally { setIsFetching(false); }
      };
      fetchCustomer();
    }
  }, [customer.mobile]);

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
  // 1. Validation
  if (!product.item?.trim() || !product.gross || !product.rate) return;

  // 2. Prepare Numbers
  const r = Number(product.rate) || 0;
  const gross = Number(product.gross) || 0;
  const stoneWeight = Number(product.stoneWeight) || 0;
  const net = gross - stoneWeight;
  const stoneCharges = Number(product.stoneCharges) || 0;
  const mcValue = Number(product.mcValue) || 0;

  let goldValue = 0;

  // 3. Apply Making Charge Logic
  if (product.mcType === "Fixed") {
    // per gram MC logic
    goldValue = (net + mcValue) * r;
  } else if (product.mcType === "%") {
    const base = net * r;
    goldValue = base + (base * (mcValue / 100));
  }

  // 4. Subtotal
  const subtotal = goldValue + stoneCharges;

  // 5. GST + Round to nearest 10
  const finalTotal = Math.ceil((subtotal * 1.03) / 10) * 10;

  // 6. Update items
  setItems([
    ...items,
    {
      ...product,
      netWeight: net,
      total: finalTotal,
    },
  ]);

  // 7. Reset form
  setProduct({
    item: "",
    display: "",
    hsn: "",
    gross: "",
    stoneWeight: "",
    rate: "",
    mcType: "%",
    mcValue: "",
    stoneCharges: "",
  });

  setSearchTerm("");
  setIsSaved(false);
};

const grandTotal = items.reduce((sum, i) => sum + i.total, 0);

/* ---------- PRODUCT SEARCH (STATIC + FIREBASE) ---------- */
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

const handleConfirmAndPrint = async () => {
  try {
    // 1️⃣ Print First
    handleThermalPrint(printRef.current.innerHTML);

    // 2️⃣ Save Order After Confirm
    const orderData = {
      orderId: estimationId,
      customer,
      items,
      status: "OPEN",
      isDeleted: false,

      summary: {
        itemCount: items.length,
        totalAmount: grandTotal,
      },

      createdAt: serverTimestamp(),
      sortAt: serverTimestamp(),
    };

    await addDoc(collection(db, "orders"), orderData);

    // 3️⃣ Close Modal
    setShowPrintModal(false);

    // 4️⃣ Reset Everything
    setItems([]);
    setCustomer({ mobile: "", name: "", city: "" });
    setIsSaved(false);
    setSavedOrderId(null);

  } catch (err) {
    console.error("Save/Print error:", err);
    alert("Something went wrong.");
  }
};

const handleSaveOrder = async () => {
  if (items.length === 0) return alert("Please add at least one item.");

  setIsSaving(true);

  try {
    const orderData = {
      orderId: estimationId,
      customer,
      items,
      status: "OPEN",
      isDeleted: false,

      summary: {
        itemCount: items.length,
        totalAmount: grandTotal,
      },

      createdAt: serverTimestamp(),
      sortAt: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, "orders"), orderData);

    setSavedOrderId(docRef.id);   // store doc id
    setIsSaved(true);
    setShowPrintModal(true);      // open modal

  } catch (err) {
    console.error("Save error:", err);
    alert("Failed to save order.");
  } finally {
    setIsSaving(false);
  }
};

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col overflow-x-hidden">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 
      bg-white
      px-8 py-4 flex justify-between items-center">

        {/* Left Branding */}
        <div className="flex items-center gap-4">
          
          {/* Logo Circle */}
          <div className="w-10 h-10 rounded-xl 
          bg-gradient-to-br from-[#D4AF37] to-[#B8962E] 
          flex items-center justify-center shadow-md">
            <ReceiptText className="text-white w-5 h-5" />
          </div>

          {/* Brand Text */}
          <div className="leading-tight">
            <h1 className="text-[#2B2B2B] text-lg font-semibold tracking-wide">
              Keshav Jewellers
            </h1>
            <p className="text-[11px] text-[#9A8F7A] font-medium tracking-widest uppercase">
              POS Estimation Portal
            </p>
          </div>
        </div>

        {/* Right Actions */}
        <button
          onClick={() => {
            setItems([]);
            setCustomer({ mobile: "", name: "", city: "" });
          }}
          className="flex items-center gap-2 
          text-sm font-medium text-[#6B6456] 
          border border-[#E0D6C2] 
          bg-white/60 backdrop-blur-md 
          px-4 py-2 rounded-xl 
          hover:bg-white hover:shadow-sm 
          transition-all duration-200"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </button>
      </header>


      <main className="flex-1 p-4 lg:p-8 max-w-[1600px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT PANEL: DATA ENTRY */}
        <div className="lg:col-span-8 space-y-8">
          {/* 1. CUSTOMER SECTION */}
          <div className="bg-white backdrop-blur-md rounded-2xl 
          border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="dashboard-bg px-6 py-4 flex items-center gap-2">
              <User className="w-4 h-4 text-[#B89B5E]" />
              <h2 className="text-[11px] font-semibold text-amber-900 uppercase tracking-[0.18em]">
                Customer Validation
              </h2>
            </div>
            {/* Form */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="group">
                <label className="text-[11px] font-semibold text-[#8C7A5B] uppercase tracking-widest">
                  Mobile (10 Digits)
                </label>
                <div className="relative mt-2">
                  <input
                    className="w-full h-[46px] px-4 pr-10 rounded-xl
                    bg-white
                    focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]
                    text-sm font-medium text-[#2C2A25]
                    placeholder:text-[#B0A38A] transition"
                    maxLength={10}
                    placeholder="Type mobile..."
                    value={customer.mobile}
                    onChange={(e) =>
                      setCustomer({ ...customer, mobile: e.target.value.replace(/\D/g, "") })
                    }
                  />
                  {customer.mobile.length === 10 && !isFetching && (
                    <CheckCircle2 className="absolute right-3 top-3 w-4 h-4 text-emerald-500" />
                  )}
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#8C7A5B] uppercase tracking-widest">
                  Customer Name
                </label>
                <input
                  className="mt-2 w-full h-[46px] px-4 rounded-xl
                  bg-white border border-[#E6DCCB]
                  focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]
                  text-sm font-medium text-[#2C2A25]
                  placeholder:text-[#B0A38A] transition"
                  placeholder="Full Name"
                  value={customer.name}
                  onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                />
              </div>
              {/* City */}
              <div>
                <label className="text-[11px] font-semibold text-[#8C7A5B] uppercase tracking-widest">
                  City
                </label>
                <input
                  className="mt-2 w-full h-[46px] px-4 rounded-xl
                  bg-white border border-[#E6DCCB]
                  focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40 focus:border-[#D4AF37]
                  text-sm font-medium text-[#2C2A25]
                  placeholder:text-[#B0A38A] transition"
                  placeholder="City"
                  value={customer.city}
                  onChange={(e) => setCustomer({ ...customer, city: e.target.value })}
                />
              </div>
            </div>
          </div>
          {/* 2. PRODUCT SECTION */}
          <div className="bg-white border border-[#E4D9C6] rounded-2xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b dashboard-bg flex items-center gap-2">
              <Package className="w-4 h-4 text-[#8B6F3D]" />
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
        <div className="lg:col-span-4 flex flex-col gap-6 h-full min-h-[600px]">
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
                    onClick={handleSaveOrder}
                    disabled={isSaving || items.length === 0}
                    className="h-12 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 text-white font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Order to Print"}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPrintModal(true)}
                      className="flex-1 h-12 rounded-xl bg-slate-900 text-white font-semibold flex items-center justify-center gap-2"
                    >
                      <Printer className="w-4 h-4 text-[#D4AF37]" />
                      Print Slip
                    </button>
                    <button
                      onClick={() => setIsSaved(false)}
                      className="px-4 h-12 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </div>
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
                <p className="text-[10px] text-slate-400 leading-none">ID: {estimationId}</p>
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
                    estimationId={estimationId}
                  />
                </div>
              </div>
              <p className="mt-2 text-[10px] text-slate-400">Scroll to check full slip preview</p>
            </div>

            {/* FOOTER: Reduced padding and button height */}
            <div className="px-6 py-4 bg-white flex flex-col gap-2">
              <button
                onClick={handleConfirmAndPrint}
                className="w-full h-12 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-black active:scale-95 transition shadow-md"
              >
                <Printer className="w-4 h-4 text-[#D4AF37]" />
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
