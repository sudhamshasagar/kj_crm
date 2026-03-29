import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Info, Save, ChevronDown, User } from "lucide-react";
import { useItems } from "./useItems";

/* ------------------ Constants ------------------ */
const METALS = ["GOLD", "SILVER"];
const INITIAL_CATEGORIES = ["Ring", "Bangle", "Chain", "Jhumki", "Necklace", "Bracelet"];
const INITIAL_HSN = ["711319", "711311", "711719"];
const PURITY_BY_METAL = {
  GOLD: ["24K", "22K", "18K", "14K"],
  SILVER: ["925", "999"]
};

export default function ItemMasterForm() {
  const { createArticles } = useItems();
  const navigate = useNavigate();
  const [createdItems,setCreatedItems] = useState([]);
const [showPrintModal,setShowPrintModal] = useState(false);

  // Persist categories in LocalStorage for "Permanent" feel without DB changes
  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem("custom_categories");
    return saved ? JSON.parse(saved) : INITIAL_CATEGORIES;
  });

  const [hsnOptions, setHsnOptions] = useState(() => {
    const saved = localStorage.getItem("custom_hsn");
    return saved ? JSON.parse(saved) : INITIAL_HSN;
  });

  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingHsn, setIsAddingHsn] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [newHsn, setNewHsn] = useState("");

  const [form, setForm] = useState({
    metal: "GOLD",
    category: "",
    purity: "22K",
    quantity: "1", // Default to 1
    hsnCode: "711319",
    vendor: "",
    items: []
  });

  const themeColor = form.metal === "GOLD" ? "amber" : "slate";

  // Persistent Storage Sync
  useEffect(() => {
    localStorage.setItem("custom_categories", JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem("custom_hsn", JSON.stringify(hsnOptions));
  }, [hsnOptions]);

  // Quantity Management
  useEffect(() => {
    const qty = Math.max(0, parseInt(form.quantity) || 0);
    setForm((f) => {
      const existingItems = [...f.items];
      const newItems = Array.from({ length: qty }, (_, i) => 
        existingItems[i] || {
          grossWeight: "",
          stoneWeight: "",
          netWeight: "0.000",
          stoneCharge: "",
          mcGrams: "",
          mcPercent: "",
          huid: ""
        }
      );
      return { ...f, items: newItems };
    });
  }, [form.quantity]);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const updateItem = (index, key, value) => {
    setForm((f) => {
      const items = [...f.items];
      items[index] = { ...items[index], [key]: value };
      const gross = parseFloat(items[index].grossWeight) || 0;
      const stone = parseFloat(items[index].stoneWeight) || 0;
      const net = Math.max(0, gross - stone);
      items[index].netWeight = net.toFixed(3);
      return { ...f, items };
    });
  };

  const handleAddCategory = () => {
    const val = newCategory.trim();
    if (val && !categories.includes(val)) {
      setCategories(prev => [...prev, val]);
      update("category", val);
      setNewCategory("");
      setIsAddingCategory(false);
    }
  };

  const handleAddHsn = () => {
    const val = newHsn.trim();
    if (val && !hsnOptions.includes(val)) {
      setHsnOptions(prev => [...prev, val]);
      update("hsnCode", val);
      setNewHsn("");
      setIsAddingHsn(false);
    }
  };

  const submitHandler = async () => {
    if (!form.category || !form.hsnCode) return alert("Category and HSN are required.");
    try {
      const created = await createArticles({
      ...form,
      items: form.items.map(i => ({
        ...i,
        makingCharge: { grams: i.mcGrams || null, percent: i.mcPercent || null }
      }))
      });

      setCreatedItems(created);
      setShowPrintModal(true);
    } catch (err) {
      alert("Error saving articles.");
    }
  };

  const getVendorInitials = (name) => {
    if(!name) return "";
    return name
      .split(" ")
      .map(w => w[0])
      .join("")
      .toUpperCase()
      .slice(0,3);
    };

  const tagStyles = `
@page { size: 2in 0.5in; margin:0; }

body {
  margin:0;
  padding:0;
  font-family: Arial, sans-serif;
  background: white;
}

.tag-container {
  width: 2in;
  height: 0.5in;
  display: flex;
  align-items: center;
  page-break-after: always;
  break-after: page;
}

.side-front {
  width: 1in;
  height: 0.5in;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start; /* Start from top to maximize logo scale */
  padding: 1px 0; 
  box-sizing: border-box;
  position: relative; /* Essential for the bottom text positioning */
}

.logo-img {
  /* Increased to 38px - this is the maximum safe height for a 0.5in (48px) tag 
     while leaving tiny sliver of room for text */
  height: 38px; 
  width: auto;
  object-fit: cover;
  z-index: 1;
}

.id-text {
  font-size: 8px; 
  font-weight: 900;
  letter-spacing: 0.3px;
  position: absolute;
  bottom: 1px; /* Glues the ID to the very bottom */
  background: rgba(255,255,255,0.8); /* Slight white fade in case logo overlaps */
  width: 100%;
  text-align: center;
  z-index: 2;
}

.side-back {
  width: 1in;
  height: 0.5in;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 4px 0 10px;
  box-sizing: border-box;
  border-left: 0.5px dashed #bbb;
}

.data-row {
  font-size: 8.5px; /* Slightly larger for readability */
  font-weight: 800;
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin: -1px 0; /* Tighter line spacing */
}
`;

  const printAllBarcodes = () => {

  const win = window.open("", "_blank");

  const labels = createdItems.map(item => {

    const itemId = item.pieceBarcode || item.id || "TEMP";

    const gross = Number(item.grossWeight || 0).toFixed(3);
    const stone = Number(item.stoneWeight || 0).toFixed(3);
    const net = Number(item.netWeight || 0).toFixed(3);
    const sc = Number(item.stoneCharge || 0);

    return `
      <div class="tag-container">

        <div class="side-front">
          <img src="/kc2.png" class="logo-img" />
          <div class="id-text">${itemId}</div>
        </div>

        <div class="side-back">
          <div class="data-row"><span>GW:</span><span>${gross}</span></div>
          <div class="data-row"><span>SW:</span><span>${stone}</span></div>
          <div class="data-row"><span>SC:</span><span>₹ ${sc}</span></div>
          <div class="data-row"><span>NW:</span><span>${net}</span></div>
        </div>

      </div>
    `;

  }).join("");

  win.document.write(`
    <html>
      <head>
        <title>Print Tags</title>
        <style>${tagStyles}</style>
      </head>

      <body>

        ${labels}

        <script>
          window.onload = function(){
            setTimeout(function(){
              window.print();
              window.close();
            },300);
          }
        </script>

      </body>
    </html>
  `);

  win.document.close();
};

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft size={22} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">New Inventory</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Stock Inward</p>
            </div>
          </div>
          <button
            onClick={submitHandler}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all shadow-md active:scale-95"
          >
            <Save size={18} />
            <span className="hidden sm:inline">Save Articles</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* CONFIGURATION SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: METAL & PURITY */}
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Info size={14} /> Product Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Select
                label="Metal Type"
                value={form.metal}
                options={METALS}
                onChange={(v) => {
                  update("metal", v);
                  update("purity", PURITY_BY_METAL[v][0]);
                }}
              />
              <Select
                label="Purity"
                value={form.purity}
                options={PURITY_BY_METAL[form.metal]}
                onChange={(v) => update("purity", v)}
              />

              {/* CATEGORY DROPDOWN WITH ADD OPTION */}
              <div className="space-y-2">
                {!isAddingCategory ? (
                  <div className="relative">
                    <Select
                      label="Category"
                      value={form.category}
                      options={categories}
                      onChange={(v) => update("category", v)}
                    />
                    <button 
                      onClick={() => setIsAddingCategory(true)}
                      className="absolute right-0 top-0 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-bl-lg border-b border-l border-slate-200"
                    >
                      + ADD NEW
                    </button>
                  </div>
                ) : (
                  <div className="animate-in fade-in slide-in-from-top-1">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5 ml-1">New Category</label>
                    <div className="flex gap-2">
                      <input 
                        autoFocus
                        className="flex-1 rounded-xl border border-blue-300 px-3 py-2 text-sm outline-none ring-2 ring-blue-50"
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        placeholder="e.g. Pendant"
                      />
                      <button onClick={handleAddCategory} className="bg-blue-600 text-white px-4 rounded-xl text-sm font-bold">Add</button>
                      <button onClick={() => setIsAddingCategory(false)} className="text-slate-400 px-2 text-xs">Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* HSN DROPDOWN WITH ADD OPTION */}
              <div className="space-y-2">
                {!isAddingHsn ? (
                  <div className="relative">
                    <Select
                      label="HSN Code"
                      value={form.hsnCode}
                      options={hsnOptions}
                      onChange={(v) => update("hsnCode", v)}
                    />
                    <button 
                      onClick={() => setIsAddingHsn(true)}
                      className="absolute right-0 top-0 text-[10px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-2 py-1 rounded-bl-lg border-b border-l border-slate-200"
                    >
                      + CUSTOM
                    </button>
                  </div>
                ) : (
                  <div className="animate-in fade-in">
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5 ml-1">New HSN Code</label>
                    <div className="flex gap-2">
                      <input 
                        autoFocus
                        className="flex-1 rounded-xl border border-blue-300 px-3 py-2 text-sm outline-none"
                        value={newHsn}
                        onChange={(e) => setNewHsn(e.target.value)}
                        placeholder="6-digit code"
                      />
                      <button onClick={handleAddHsn} className="bg-blue-600 text-white px-4 rounded-xl text-sm font-bold text-xs">Save</button>
                      <button onClick={() => setIsAddingHsn(false)} className="text-slate-400 px-2 text-xs">X</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: VENDOR & BATCH */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <User size={14} /> Source Info
              </h2>
              <Input 
                label="Vendor Identification" 
                placeholder="Supplier name or ID (Optional)" 
                value={form.vendor}
                onChange={(v) => update("vendor", v)}
              />
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5 ml-1">Batch Quantity</label>
                <div className="flex items-center gap-4">
                  <input 
                    type="number"
                    min="1"
                    className="w-full text-2xl font-bold text-slate-800 rounded-xl border-slate-200 border p-3 focus:ring-2 focus:ring-slate-100 outline-none"
                    value={form.quantity}
                    onChange={(v) => update("quantity", v.target.value)}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2 italic">* Generates individual entry rows below</p>
              </div>
            </div>
          </div>
        </div>

        {/* ITEM DETAILS TABLE-LIKE VIEW */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
               Article Breakdown 
               <span className="bg-slate-200 text-slate-700 text-xs px-2 py-0.5 rounded-full">{form.items.length}</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {form.items.map((item, idx) => (
              <div key={idx} className="group bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-amber-300 transition-all">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-50">
                   <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-900 text-white font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-700">Individual Piece Details</span>
                   </div>
                   <span className="text-[10px] font-mono text-slate-400">{form.metal}-{form.purity}-{idx + 101}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  <Input label="Gross (g)" type="number" value={item.grossWeight} onChange={(v) => updateItem(idx, "grossWeight", v)} />
                  <Input label="Stone (g)" type="number" value={item.stoneWeight} onChange={(v) => updateItem(idx, "stoneWeight", v)} />
                  <Input label="Net Weight" value={item.netWeight} readOnly className="bg-slate-50 font-bold text-slate-900" />
                  <Input label="Stone ₹" type="number" value={item.stoneCharge} onChange={(v) => updateItem(idx, "stoneCharge", v)} />
                  <Input 
                    label="MC (Fixed)" 
                    value={item.mcGrams} 
                    placeholder="per gm"
                    disabled={!!item.mcPercent}
                    onChange={(v) => updateItem(idx, "mcGrams", v)} 
                  />
                  <Input 
                    label="MC (%)" 
                    value={item.mcPercent} 
                    placeholder="%"
                    disabled={!!item.mcGrams}
                    onChange={(v) => updateItem(idx, "mcPercent", v)} 
                  />
                  <Input label="HUID" value={item.huid} placeholder="Optional" onChange={(v) => updateItem(idx, "huid", v)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white p-8 rounded-2xl w-[420px] text-center">
          <h2 className="text-lg font-bold mb-3">
          Articles Saved Successfully
          </h2>
          <p className="text-sm text-slate-500 mb-6">
          {createdItems.length} barcodes generated
          </p>
          <div className="flex gap-4">
          <button
            onClick={printAllBarcodes}
            className="flex-1 bg-slate-900 text-white py-3 rounded-xl"
          >
            Print Barcodes
          </button>
          <button
            onClick={()=>navigate(-1)}
            className="flex-1 border border-slate-300 py-3 rounded-xl"
          >
            Cancel
          </button>

          </div>

        </div>

        </div>

        )}
    </div>
  );
}

/* ------------------ Refined Components ------------------ */

function Input({ label, value, onChange, readOnly, type = "text", placeholder, className, disabled }) {
  return (
    <div className="w-full">
      <label className="block text-[11px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 ml-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        readOnly={readOnly}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition-all focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none disabled:opacity-50 disabled:bg-slate-50 ${className}`}
      />
    </div>
  );
}

function Select({ label, value, options, onChange }) {
  return (
    <div className="w-full relative">
      <label className="block text-[11px] font-bold uppercase tracking-tight text-slate-500 mb-1.5 ml-1">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm appearance-none cursor-pointer focus:ring-4 focus:ring-slate-100 focus:border-slate-400 outline-none"
        >
          <option value="">Select {label}</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      </div>
    </div>
  );
}