import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Plus, Printer, History, Search, 
  PackageOpen, ChevronLeft, ChevronRight, 
  Coins, Database, X, Calendar, Filter, Info,
  Tag, Scale, Layers
} from "lucide-react";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "firebase/firestore";

import { db } from "../../firebaseConfig";
import { useItems } from "./useItems";

const PAGE_SIZE = 24;

export default function ItemList() {
  const { items, loading } = useItems();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const category = searchParams.get("category");
  const purity = searchParams.get("purity");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [bulkPrintOpen, setBulkPrintOpen] = useState(false);
  const [itemLogs, setItemLogs] = useState([]);
  const [historyItem, setHistoryItem] = useState(null);
  const [availability, setAvailability] = useState("");
  const [metalFilter, setMetalFilter] = useState("");
  const [purityFilter, setPurityFilter] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const [bulkFilters, setBulkFilters] = useState({
    category: "",
    purity: "",
    fromDate: "",
    toDate: ""
  });

  // Filtering Logic
  const filteredItems = useMemo(() => {
      let list = items;
      if (search.trim()) {
        const q = search.toLowerCase();
        list = list.filter((i) =>
          (i.category || "").toLowerCase().includes(q) ||
          (i.pieceBarcode || "").toLowerCase().includes(q) ||
          (i.id || "").toLowerCase().includes(q)
        );
      }
      if (availability) {
        list = list.filter(i =>
          availability === "INSTOCK"
            ? i.status !== "SOLD"
            : i.status === "SOLD"
        );
      }
      if (metalFilter) {
        list = list.filter(i => i.metal === metalFilter);
      }
      if (purityFilter) {
        list = list.filter(i => i.purity === purityFilter);
      }
      return list;
    }, [items, search, availability, metalFilter, purityFilter]);

  useEffect(() => { setPage(1); }, [search]);

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const getBulkItems = () => {
    let list = items;
    if (bulkFilters.category) list = list.filter(i => i.category === bulkFilters.category);
    if (bulkFilters.purity) list = list.filter(i => i.purity === bulkFilters.purity);
    if (bulkFilters.fromDate) {
      const from = new Date(bulkFilters.fromDate);
      list = list.filter(i => i.createdAt && new Date(i.createdAt.seconds * 1000) >= from);
    }
    if (bulkFilters.toDate) {
      const to = new Date(bulkFilters.toDate);
      list = list.filter(i => i.createdAt && new Date(i.createdAt.seconds * 1000) <= to);
    }
    return list;
  };

  const openHistory = async (item) => {
    setHistoryItem(item);
    setItemLogs([]); // Reset logs while loading
    const q = query(
      collection(db, "stock_ledger"),
      where("stockItemId", "==", item.id),
      orderBy("timestamp", "desc")
    );
    const snap = await getDocs(q);
    const logs = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));
    setItemLogs(logs);
  };

  /* --------------------------------
      BARCODE TAG STYLES
  -------------------------------- */
  const tagStyles = `
    @page { size: 2in 0.5in; margin:0; }
    body { margin:0; padding:0; font-family: Arial, sans-serif; background: white; }
    .tag-container { width: 2in; height: 0.5in; display: flex; align-items: center; page-break-after: always; }
    .side-front { width: 1in; height: 0.5in; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 1px 0; box-sizing: border-box; position: relative; }
    .logo-img { height: 40px; width: auto; object-fit: cover; z-index: 1; }
    .id-text { font-size: 8px; font-weight: 900; position: absolute; bottom: 1px; width: 100%; text-align: center; z-index: 2; }
    .side-back { width: 1in; height: 0.5in; display: flex; flex-direction: column; justify-content: center; padding: 0 4px 0 10px; box-sizing: border-box; border-left: 0.5px dashed #bbb; }
    .data-row { font-size: 8.5px; font-weight: 800; display: flex; justify-content: space-between; width: 100%; margin: -1px 0; }
  `;

  const printBarcode = (item) => {
    const itemId = item.pieceBarcode || item.id || "TEMP";
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><style>${tagStyles}</style></head>
      <body>
        <div class="tag-container">
          <div class="side-front"><img src="/kc2.png" class="logo-img" /><div class="id-text">${itemId}</div></div>
          <div class="side-back">
            <div class="data-row"><span>GW:</span><span>${Number(item.grossWeight).toFixed(3)}</span></div>
            <div class="data-row"><span>SW:</span><span>${Number(item.stoneWeight || 0).toFixed(3)}</span></div>
            <div class="data-row"><span>NW:</span><span>${Number(item.netWeight).toFixed(3)}</span></div>
            <div class="data-row"><span>SC:</span><span>₹ ${Number(item.stoneCharge || 0)}</span></div>
          </div>
        </div>
        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 200); }</script>
      </body></html>
    `);
    win.document.close();
  };

  const printBulkBarcodes = () => {
    const selectedItems = getBulkItems();
    if (!selectedItems.length) return alert("No items found");
    const win = window.open("", "_blank");
    const labels = selectedItems.map(item => {
      const itemId = item.pieceBarcode || item.id || "TEMP";
      return `
        <div class="tag-container">
          <div class="side-front"><img src="/kc2.png" class="logo-img" /><div class="id-text">${itemId}</div></div>
          <div class="side-back">
            <div class="data-row"><span>GW:</span><span>${Number(item.grossWeight).toFixed(3)}</span></div>
            <div class="data-row"><span>SW:</span><span>${Number(item.stoneWeight || 0).toFixed(3)}</span></div>
            <div class="data-row"><span>NW:</span><span>${Number(item.netWeight).toFixed(3)}</span></div>
            <div class="data-row"><span>SC:</span><span>₹ ${Number(item.stoneCharge || 0)}</span></div>
          </div>
        </div>`;
    }).join("");
    win.document.write(`<html><head><style>${tagStyles}</style></head><body>${labels}<script>window.onload=()=>{setTimeout(()=>{window.print();window.close();},600);}</script></body></html>`);
    win.document.close();
  };

  const availableCategories = useMemo(() => Array.from(new Set(items.map(i => i.category).filter(Boolean))).sort(), [items]);
  const availablePurities = useMemo(() => Array.from(new Set(items.map(i => i.purity).filter(Boolean))).sort(), [items]);

  return (
    <div className="flex flex-col h-screen bg-[#F8FAFC] overflow-hidden">
      {/* HEADER SECTION */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
          
          {/* 1. Brand/Stats - Hidden on very small screens to save space, or kept minimal */}
          <div className="flex items-center gap-3 shrink-0">
            <div>
              <h1 className="text-base md:text-lg font-black text-slate-900 leading-none">Inventory</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">{items.length} Items</p>
              </div>
            </div>
          </div>

          {/* 2. Search - Flex-grow to take up remaining middle space */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/10 outline-none text-xs transition-all"
            />
          </div>

          {/* 3. Action Group */}
          <div className="flex items-center gap-2">
            
            {/* Filters Popover */}
            <div className="relative">
              <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center p-2 md:px-3 md:py-2 bg-white border rounded-xl transition-all ${isOpen ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-slate-200'}`}
              >
                <Filter size={16} className="text-amber-600" />
                <span className="hidden md:block ml-2 text-[10px] font-black text-slate-700 uppercase">Filters</span>
                {(availability || metalFilter || purityFilter) && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 border-2 border-white rounded-full" />
                )}
              </button>

              {isOpen && (
                <div className="absolute right-0 mt-2 z-50 w-48 bg-white border border-slate-200 rounded-xl shadow-xl p-3 flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                      {[
                        { label: 'Stock', value: availability, setter: setAvailability, options: [['', 'All'], ['INSTOCK', 'In Stock'], ['SOLD', 'Sold']] },
                        { label: 'Metal', value: metalFilter, setter: setMetalFilter, options: [['', 'All'], ['GOLD', 'Gold'], ['SILVER', 'Silver']] }
                      ].map((f) => (
                        <div key={f.label} className="flex flex-col">
                          <span className="text-[8px] font-black text-slate-400 uppercase mb-1 leading-none">{f.label}</span>
                          <select 
                            value={f.value} 
                            onChange={(e) => f.setter(e.target.value)}
                            className="w-full px-2 py-1.5 border border-slate-100 bg-slate-50 rounded-lg text-[10px] font-bold outline-none"
                          >
                            {f.options.map(opt => <option key={opt[0]} value={opt[0]}>{opt[1]}</option>)}
                          </select>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bulk Print - Icon only on mobile */}
            <button
              onClick={() => setBulkPrintOpen(true)}
              className="p-2 md:px-4 md:py-2 bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
              title="Bulk Print"
            >
              <Printer size={16} />
              {/* <span className="hidden md:inline ml-2 text-[10px] font-black uppercase">Print</span> */}
            </button>

            {/* New Asset - Icon only on mobile */}
            <button
              onClick={() => navigate("/internal/items/new")}
              className="p-2 md:px-4 md:py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 shadow-md transition-all flex items-center"
            >
              <Plus size={18} />
              <span className="hidden md:inline ml-1 text-[10px] font-black uppercase tracking-tight">New</span>
            </button>

          </div>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 overflow-y-auto premium-scroll p-4 md:p-8">
        <div className="max-w-[1600px] mx-auto">
          {/* GRID: 1 col on mobile, 2 on tablet, 1 Row-style-card on XL desktops */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
            {paginatedItems.map((item) => (
              <div 
                key={item.id} 
                className={`group relative bg-white border border-slate-200 rounded-3xl p-5 hover:border-amber-400 hover:shadow-2xl hover:shadow-amber-900/5 transition-all duration-300 ${item.status === "SOLD" ? "opacity-60 grayscale" : ""}`}
              >
                {/* Availability Ribbon */}
              <div
                className={`absolute -top-2 -right-2 px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-bl-xl rounded-tr-2xl shadow-md
                ${item.status === "SOLD"
                  ? "bg-red-500 text-white"
                  : "bg-emerald-500 text-white"
                }`}
              >
                {item.status === "SOLD" ? "Sold Out" : "In Stock"}
              </div>
                {/* Status Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${item.metal === 'GOLD' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-500'}`}>
                    {item.metal === 'GOLD' ? <Coins size={22}/> : <Database size={22}/>}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Reference</p>
                    <p className="font-mono text-sm font-bold text-slate-900">{item.pieceBarcode || item.id}</p>
                  </div>
                </div>

                <div className="mb-5">
                  <h3 className="text-lg font-black text-slate-900 uppercase leading-none mb-1">{item.category}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md">{item.purity}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.metal}</span>
                    
                  </div>
                </div>

                <div className="flex items-center gap-0 mb-6 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                {/* Weights Group */}
                <div className="flex flex-1 p-2.5 items-center justify-around">
                  <div className="text-center px-2">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter">Gross</span>
                    <span className="text-xs font-bold text-slate-700">{Number(item.grossWeight).toFixed(3)}g</span>
                  </div>
                  
                  <div className="text-slate-300 font-light text-sm">-</div>
                  
                  <div className="text-center px-2">
                    <span className="block text-[8px] font-black text-slate-400 uppercase tracking-tighter">Stone</span>
                    <span className="text-xs font-bold text-slate-700">{Number(item.stoneWeight || 0).toFixed(3)}g</span>
                  </div>

                  <div className="h-8 w-[1px] bg-slate-200 mx-2" />

                  <div className="text-center px-2">
                    <span className="block text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Net Weight</span>
                    <span className="text-xs font-bold text-emerald-600 italic tracking-tight">{Number(item.netWeight || 0).toFixed(3)}g</span>
                  </div>
                </div>
              </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => item.status !== "SOLD" && printBarcode(item)}
                    disabled={item.status === "SOLD"}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <Printer size={14} /> Tag
                  </button>
                  <button 
                    onClick={() => openHistory(item)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider border border-slate-200 hover:border-blue-500 hover:text-blue-600 transition-all"
                  >
                    <History size={14} /> Logs
                  </button>
                </div>
              </div>
            ))}
          </div>

          {!loading && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400">
              <div className="p-6 bg-slate-100 rounded-full mb-4">
                <PackageOpen size={48} strokeWidth={1.5} />
              </div>
              <p className="text-sm font-bold uppercase tracking-widest">No articles found in inventory</p>
            </div>
          )}
        </div>
      </main>

      {/* FOOTER / PAGINATION */}
      {totalPages > 1 && (
        <footer className="bg-white border-t border-slate-200 px-8 py-4 flex items-center justify-between z-30">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-20 transition-all"
          >
            <ChevronLeft size={16} /> Previous
          </button>
          <div className="hidden sm:flex items-center gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button 
                key={i} 
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-lg text-[10px] font-bold transition-all ${page === i + 1 ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button 
            disabled={page === totalPages} 
            onClick={() => setPage(p => p + 1)} 
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:bg-slate-100 disabled:opacity-20 transition-all"
          >
            Next <ChevronRight size={16} />
          </button>
        </footer>
      )}

      {/* MODAL: ITEM HISTORY SIDEBAR */}
      {historyItem && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Stock Ledger</h2>
                <p className="text-xs text-slate-500 font-mono">#{historyItem.pieceBarcode || historyItem.id}</p>
              </div>
              <button onClick={() => setHistoryItem(null)} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto premium-scroll p-6 space-y-6">
              {itemLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 opacity-60">
                   <History size={40} className="mb-2" />
                   <p className="text-xs font-bold uppercase">No logs recorded</p>
                </div>
              ) : (
                itemLogs.map((log, idx) => (
                  <div key={log.id} className="relative pl-8 border-l-2 border-slate-100 pb-2">
                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${idx === 0 ? 'bg-blue-500 ring-4 ring-blue-50' : 'bg-slate-300'}`} />
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-slate-200 transition-colors">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-slate-900 text-sm uppercase">{log.eventType}</span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mb-3">
                        {log.timestamp?.seconds ? new Date(log.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                      
                      {log.referenceType === "SALE" && (
                        <button
                          onClick={() => navigate(`/internal/sales/${log.referenceId}`)}
                          className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-widest bg-white px-3 py-2 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all w-full justify-center"
                        >
                          View Sale Invoice
                        </button>
                      )}
                      {log.referenceType === "ESTIMATION" && (
                        <div className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md inline-block">Ref: {log.referenceId}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK PRINT */}
      {bulkPrintOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-lg border border-slate-100 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Bulk Tag Print</h2>
                <p className="text-xs text-slate-400 font-bold">Generate barcodes for specific batches</p>
              </div>
              <button onClick={() => setBulkPrintOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={24} className="text-slate-400" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><Layers size={12}/> Category</label>
                <select
                  value={bulkFilters.category}
                  onChange={(e)=>setBulkFilters({...bulkFilters,category:e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-200 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">All Articles</option>
                  {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><Tag size={12}/> Purity</label>
                <select
                  value={bulkFilters.purity}
                  onChange={(e)=>setBulkFilters({...bulkFilters,purity:e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-200 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">All Purity</option>
                  {availablePurities.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-6 space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> Date Range Filter</label>
              <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <input type="date" value={bulkFilters.fromDate} onChange={(e)=>setBulkFilters({...bulkFilters,fromDate:e.target.value})} className="flex-1 bg-transparent p-2 text-xs font-bold outline-none" />
                <div className="h-4 w-[1px] bg-slate-200" />
                <input type="date" value={bulkFilters.toDate} onChange={(e)=>setBulkFilters({...bulkFilters,toDate:e.target.value})} className="flex-1 bg-transparent p-2 text-xs font-bold outline-none" />
              </div>
            </div>

            <div className="mt-10 flex flex-col sm:flex-row gap-3">
              <button onClick={() => setBulkPrintOpen(false)} className="flex-1 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Cancel</button>
              <button 
                onClick={printBulkBarcodes} 
                className="flex-[2] bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print Batch Tags
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}