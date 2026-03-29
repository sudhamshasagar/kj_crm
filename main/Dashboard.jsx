import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  onSnapshot, 
  query, 
  limit, 
  orderBy, 
  updateDoc, 
  doc, 
  where, 
  getDocs,
  serverTimestamp, 
  Timestamp,
  setDoc,
  runTransaction,
} from "firebase/firestore";
import {
  ShoppingBag, Zap, FileText, List, Lock, ShieldCheck, 
  Wifi, Clock, CheckCircle2, Search,Package, PlusCircle, ArrowRight, RotateCcw, CalendarDays, X, LogOut,
  ChevronDown, Layers, Briefcase, Calculator, PieChart, AlertCircle,Loader2,
  Bitcoin,
  FlameKindlingIcon
} from "lucide-react";
import { useAuth } from '../../AuthContext';
import { db } from '../../firebaseConfig'; 
import toast from 'react-hot-toast';

// Sub-page imports
import FormsPage from '../forms/FormsPage';
import ManagementHub from '../ledger_reports/ManagementHub';
import EstimationGenerator from '../estimation_sales/EstimationGenerator';
import EstimationLogsPage from '../estimation_sales/EstimationLogsPage';
import EmployeeTransactionProfile from '../ledger_reports/EmployeeTransactionProfile';
import OrdersPage from '../orders/OrdersPage';
import InvestmentsPage from '../investments/Investments';
import { useB2BEmployees } from '../../hooks/useB2BEmployees';
import { useB2JEmployees } from '../../hooks/useB2JEmployees';  
import CustomersPage from '../customers/CustomersPage';
import { useActiveUsers } from "../../hooks/useActiveUsers";
import { useAutoBackup } from "../../hooks/useAutoBackup";
import PaymentsPage from '../payments/PaymentsPage';
import StockOverview from '../new_stock/StockOverview';
import ItemList from '../new_stock/ItemList';
import ItemMasterForm from '../new_stock/ItemMasterForm';
import ItemHistory from '../new_stock/ItemHistory';
import DirectSaleEstimation from '../estimation_sales/DirectSalesEstimation';
import CustomOrderEstimation from '../estimation_sales/CustomerOrderEstimation';
import DraftEstimationGenerator from '../estimation_sales/DraftGenerator';
import Reports from '../ledger_reports/Reports';
import InvoicesPage from '../../pages/InvoicesPage';
import ViewInvoice from "../../pages/invoices/ViewInvoice";

// 0. HELPERS & MODALS

const ReturnDateModal = ({ isOpen, onClose, onConfirm }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm animate-in zoom-in-95 duration-200">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-800">Confirm Return</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">Please select the date when the goldsmith returned this item.</p>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500 uppercase">Return Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-gray-800 focus:ring-2 focus:ring-amber-500 outline-none"/>
          </div>
        </div>
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">Cancel</button>
          <button onClick={() => onConfirm(date)} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm transition-colors flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Confirm Return</button>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// CORRECTION APPROVAL MODAL (ADMIN)
// ============================================================
const CorrectionApprovalModal = ({ open, request, onClose, onApprove }) => {
  if (!open || !request) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-4 bg-red-600 text-white flex justify-between items-center">
          <h3 className="font-bold text-sm">Correction Approval</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5 opacity-80 hover:opacity-100" />
          </button>
        </div>
        {/* BODY */}
        <div className="p-6 space-y-4">
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold">Employee</p>
            <p className="font-semibold text-gray-800">{request.employeeName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase font-bold mb-2">
              Requested Changes
            </p>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left">Field</th>
                    <th className="px-4 py-2 text-right">Current</th>
                    <th className="px-4 py-2 text-right">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(request.requestedChanges || {}).map(
                    ([field, val]) => (
                      <tr key={field} className="border-t">
                        <td className="px-4 py-2 font-medium text-gray-700">
                          {field}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-500">
                          {val.old}
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-red-600">
                          {val.new}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {request.reason && (
            <div>
              <p className="text-xs text-gray-500 uppercase font-bold">Reason</p>
              <p className="text-sm text-gray-700 mt-1">{request.reason}</p>
            </div>
          )}
        </div>
        {/* FOOTER */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onApprove(request)}
            className="px-4 py-2 text-sm font-bold text-white bg-green-600 hover:bg-green-700 rounded-lg"
          >
            Approve Correction
          </button>
        </div>
      </div>
    </div>
  );
};

const numberToWords = (num) => {
  const a = ['','One ','Two ','Three ','Four ', 'Five ','Six ','Seven ','Eight ','Nine ','Ten ','Eleven ','Twelve ','Thirteen ','Fourteen ','Fifteen ','Sixteen ','Seventeen ','Eighteen ','Nineteen '];
  const b = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  if ((num = num.toString()).length > 9) return 'overflow';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; var str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str + "Only";
};

// 1. UPDATED QUICK ACTION GROUP (BORDERLESS & CLEAN)

const QuickActionGroup = ({ title, icon: Icon, colorClass, items }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null); // Reference to the button
  const menuRef = useRef(null);   // Reference to the menu
  const navigate = useNavigate();

  // Toggle and Calculate Position
  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setMenuPos({
        top: rect.bottom + 8, 
        left: rect.left
      });
    }
    setIsOpen(!isOpen);
  };

  // Close on Click Outside
  useEffect(() => {
    const handleGlobalClick = (event) => {
      // If clicking outside button AND menu
      if (
        buttonRef.current && 
        !buttonRef.current.contains(event.target) && 
        menuRef.current && 
        !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    const handleScroll = () => {
      if(isOpen) setIsOpen(false); // Close menu on scroll to prevent detachment
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleGlobalClick);
      window.addEventListener("scroll", handleScroll, true); // Capture scroll
    }
    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  return (
    <>
      {/* The Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all group min-w-[130px] justify-between shrink-0 ${isOpen ? 'bg-gray-50 border-gray-100' : ''}`}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md ${colorClass} bg-opacity-20`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="font-bold text-xs text-gray-700 group-hover:text-gray-900">{title}</span>
        </div>
        <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div 
          ref={menuRef}
          style={{ top: menuPos.top, left: menuPos.left }}
          className="fixed w-48 bg-white rounded-xl shadow-xl border border-gray-100 p-1.5 z-[9999] animate-in fade-in zoom-in-95 duration-100"
        >
          {items.map((item, idx) => (
            <div 
              key={idx}
              onClick={() => {
                setIsOpen(false);
                navigate(item.path);
              }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors group/item"
            >
              <div className={`p-1.5 rounded-md bg-gray-50 group-hover/item:bg-white group-hover/item:shadow-sm border border-transparent group-hover/item:border-gray-100 transition-all`}>
                <item.icon className="w-3.5 h-3.5 text-gray-500 group-hover/item:text-gray-800" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">{item.label}</p>
                <p className="text-[9px] text-gray-400 leading-none mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

const Avatar = ({ name }) => (
  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 border border-amber-300 flex items-center justify-center text-amber-800 text-xs font-bold shadow-sm">
    {name ? name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'NA'}
  </div>
);

// --- Helper: Skeleton Loader ---
const TableSkeleton = () => (
  <div className="animate-pulse space-y-4 p-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="flex items-center space-x-4">
        <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    ))}
  </div>
);

// ... [B2JEmployeeStatusPanel] ...
const B2JEmployeeStatusPanel = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(""); // Local search state
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  // --- Logic ---
  const initiateReturn = (orderId) => { setSelectedOrderId(orderId); setModalOpen(true); };

  const handleConfirmReturn = async (dateStr) => {
    if (!selectedOrderId) return;
    try {
      const orderRef = doc(db, "ORDERS", selectedOrderId);
      const returnDate = new Date(dateStr);
      returnDate.setHours(12, 0, 0, 0);
      await updateDoc(orderRef, { status: 'ready', returnedOn: Timestamp.fromDate(returnDate), timeline: [] });
      toast.success("Inventory Marked as Returned");
      setModalOpen(false); setSelectedOrderId(null);
    } catch (error) { console.error("Error:", error); toast.error("Update failed"); }
  };

  useEffect(() => {

  const q = query(
    collection(db, "orders"),
    orderBy("audit.lastUpdatedAt", "desc"),
    limit(100)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {

    const rows = [];

    snapshot.docs.forEach((docSnap) => {
      const order = docSnap.data();
      const orderId = docSnap.id;
      (order.items || []).forEach((item) => {
        if (!item.karigarId) return;
        rows.push({
          id: `${order.estimationId}_${item.karigarId}_${item.display}`,
          orderId: order.estimationId,
          karigarName: item.karigarName || "",
          itemName: item.display || item.item || "",
          deliveryDate: item.deliveryDate || null,
          netWeight: item.netWeight,
          gross: item.gross,
          stoneWeight: item.stoneWeight,
          status: item.status || order.status,
          assignedAt: item.assignedAt,
          sentAt: item.sentAt,
          returnedAt: item.returnedAt
        });
      });
    });

    setOrders(rows);
    setLoading(false);

  });

  return () => unsubscribe();

}, []);

  // Filter Logic
const filteredOrders = orders.filter((o) => {
  const karigar = (o.karigarName || "").toLowerCase();
  const item = (o.itemName || "").toLowerCase();
  const order = (o.orderId || "").toLowerCase();
  const q = (search || "").toLowerCase();

  return (
    karigar.includes(q) ||
    item.includes(q) ||
    order.includes(q)
  );
});

  return (
    <>
      <div className="dashboard-bg  rounded-2xl shadow-sm border border-gray-200 flex flex-col h-full overflow-hidden">
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white relative z-0">
          <div className=''>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <div className="bg-amber-100 p-1.5 rounded-lg text-amber-700"><ShoppingBag className="w-5 h-5" /></div>
              Work Order Status
            </h3>
            <p className="text-xs text-gray-500 mt-1 font-medium ml-1">Tracking assigned inventory & returns</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search employee or item..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none transition-all w-full sm:w-64"
                />
            </div>
            <span className="hidden sm:inline-flex bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl text-xs font-bold border border-gray-200">
               {orders.length} Active
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto premium-scroll bg-gray-50/30">
          {loading ? (
             <TableSkeleton />
          ) : filteredOrders.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Package className="w-12 h-12 mb-3 opacity-20"/>
                <p className="text-sm font-medium">No active orders found.</p>
             </div>
          ) : (
            <>
              {/* === DESKTOP TABLE  */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="text-xs font-bold text-gray-500 uppercase bg-gray-50 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4">Order ID</th>
                  <th className="px-6 py-4">Karigar</th>
                  <th className="px-6 py-4">Item</th>
                  <th className="px-6 py-4">Details</th>
                  <th className="px-6 py-4">Delivery</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-xs font-bold text-gray-800">#{o.orderId}</td>
                    <td className="px-6 py-4 font-semibold text-gray-800">{o.karigarName}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{o.itemName}</td>
                    <td className="px-6 py-4 text-xs text-gray-600">
                      Gross {o.gross}g • Stone {o.stoneWeight}g • Net {o.netWeight}g
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-700">{o.deliveryDate || "--"}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${ "bg-gray-100 text-gray-600"}`}>
                        {o.status.replaceAll("_", " ").toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* === MOBILE & TABLET CARDS (Visible on Small and Medium screens) === */}
          <div className="lg:hidden p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((o) => (
              <div key={o.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">#{o.orderId}</span>
                    <h4 className="font-bold text-gray-900 mt-1">{o.itemName}</h4>
                    <p className="text-xs text-gray-500">{o.karigarName}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-[9px] font-bold ${"bg-gray-100 text-gray-600"}`}>
                    {o.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  Net: {o.netWeight}g | Delivery: {o.deliveryDate || 'N/A'}
                </div>
              </div>
            ))}
          </div>
            </>
          )}
        </div>
      </div>
      <ReturnDateModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConfirm={handleConfirmReturn} />
    </>
  );
};

// 2. UPDATED WIDGETS
const WidgetCard = ({ title, icon: Icon, children, className = "" }) => (
  <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 ${className}`}>
    <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h4>
      <Icon className="w-4 h-4 text-gray-400" />
    </div>
    {children}
  </div>
);
const GlobalStyles = () => (
  <style>{`
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;  /* IE and Edge */
      scrollbar-width: none;  /* Firefox */
    }
  `}</style>
);

const SystemPulseBar = ({ backupState }) => { 
  const [status, setStatus] = useState({ state: "good", label: "Excellent", bars: 3 });
  const [lastSync, setLastSync] = useState("Just now");

  // Determine text based on backupState
  const getBackupText = () => {
    switch (backupState) {
      case "checking": return "Checking Backup...";
      case "backing_up": return "Backing up Data...";
      case "completed": return "Backup: Just Now";
      case "up_to_date": return "Backup: Today";
      case "error": return "Backup Failed";
      default: return "Backup: Pending";
    }
  };

  const isBackingUp = backupState === "backing_up";

  useEffect(() => {
    const check = () => {
      const on = navigator.onLine;
      const conn = navigator.connection;
      if (!on) { setStatus({ state: "error", label: "Offline", bars: 0 }); setLastSync("Paused"); return; }
      if (conn && (conn.saveData || conn.effectiveType.includes('2g'))) {
         setStatus({ state: "warning", label: "Weak Signal", bars: 1 });
      } else {
         setStatus({ state: "good", label: "System Healthy", bars: 3 });
      }
      setLastSync("Just now");
    };
    window.addEventListener('online', check);
    window.addEventListener('offline', check);
    check();
    return () => { window.removeEventListener('online', check); window.removeEventListener('offline', check); };
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex items-center justify-between shrink-0 mb-4 transition-all">
       <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-8 h-8">
             <div className={`absolute inset-0 rounded-full opacity-20 animate-ping ${status.state === 'good' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
             <div className={`relative w-2.5 h-2.5 rounded-full ${status.state === 'good' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          </div>
          <div>
             <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                {status.label}
                <span className="text-[10px] font-normal text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">v2.4.0</span>
             </h4>
          </div>
       </div>
       <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
             <p className="text-[10px] text-gray-400 uppercase font-bold">Data Safety</p>
             <p className={`text-xs font-semibold flex items-center gap-1 justify-end ${isBackingUp ? 'text-amber-600 animate-pulse' : 'text-emerald-600'}`}>
                {/* Fixed Loader2 Usage */}
                {isBackingUp && <Loader2 className="w-3 h-3 animate-spin"/>}
                {getBackupText()}
             </p>
          </div>
          <div className="h-6 w-px bg-gray-100 hidden sm:block"></div>
          <div className="flex gap-0.5 items-end h-3">
              <div className={`w-1 rounded-sm ${status.bars >= 1 ? 'h-1.5 bg-slate-800' : 'h-1.5 bg-slate-200'}`}></div>
              <div className={`w-1 rounded-sm ${status.bars >= 2 ? 'h-2.5 bg-slate-800' : 'h-2.5 bg-slate-200'}`}></div>
              <div className={`w-1 rounded-sm ${status.bars >= 3 ? 'h-3.5 bg-slate-800' : 'h-3.5 bg-slate-200'}`}></div>
          </div>
       </div>
    </div>
  );
};

const ActiveUsersPanel = ({ currentRole }) => {
  const users = useActiveUsers();
  const { currentUser } = useAuth(); 
  const [processingId, setProcessingId] = useState(null);
  const isAdmin = currentRole === 'Admin' || currentRole === 'Developer'; 
  const handleForceLogout = async (targetUserId, targetUserName) => {
    if (!window.confirm(`Are you sure you want to force logout ${targetUserName}?`)) return;
    setProcessingId(targetUserId);
    try {
      await setDoc(doc(db, "USERS", targetUserId), { forceLogoutTrigger: true, lastForceLogoutBy: currentUser.uid, forceLogoutAt: serverTimestamp() }, { merge: true });
      toast.success(`${targetUserName} logged out.`);
    } catch (err) { console.error(err); toast.error("Failed to force logout."); } finally { setProcessingId(null); }
  };
  return (

    <WidgetCard title="Active Team" icon={Wifi} className="flex-1 flex flex-col">
      <div className="flex-1 overflow-y-auto premium-scroll space-y-2 pr-1 max-h-[220px]">
        {users.length === 0 && (
          <p className="text-gray-400 text-xs italic text-center py-4">
            No users online
          </p>
        )}
        {users.map((u) => {
          const lastSeen =
            u.lastActive?.toDate
              ? u.lastActive.toDate().toLocaleString([], { dateStyle: "short", timeStyle: "short" })
              : "—";
          return (
            <div
              key={u.id}
              className="flex items-center justify-between p-2.5 rounded-xl border border-gray-100 bg-white hover:bg-gray-50 group transition-all"
            >
              {/* LEFT SIDE */}
              <div className="flex items-center gap-3">
                {/* AVATAR */}
                <div className="relative">
                  <img
                    src={u.photoURL || "/default-user.png"}
                    className="w-9 h-9 rounded-full border border-gray-200 shadow-sm object-cover"
                    alt={u.name}
                  />
                  {/* ONLINE DOT */}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-white rounded-full ${
                      u.online ? "bg-green-500" : "bg-gray-300"
                    }`}
                  />
                </div>
                {/* USER INFO */}
                <div className="leading-tight">
                  <p
                    className={`text-sm font-semibold ${
                      u.online ? "text-gray-800" : "text-gray-400"
                    }`}
                  >
                    {u.name}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-400">
                    <span>{u.role || "Staff"}</span>
                    <span className="text-gray-300">•</span>
                    <span>
                      {u.online ? "Active now" : `Last seen ${lastSeen}`}
                    </span>
                  </div>
                  {/* CURRENT PAGE */}
                  {u.currentPage && (
                    <p className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[120px]">
                      {u.currentPage}
                    </p>
                  )}
                </div>
              </div>
              {/* RIGHT SIDE */}
              <div className="flex items-center gap-2">
                {/* SESSION TIME */}
                {u.sessionMinutes && (
                  <span className="text-[9px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                    {u.sessionMinutes}m
                  </span>
                )}
                {/* FORCE LOGOUT */}
                {isAdmin && currentUser?.uid !== u.id && (
                  <button
                    onClick={() => handleForceLogout(u.id, u.name)}
                    disabled={processingId === u.id || !u.online}
                    className={`transition-all p-1.5 rounded-full ${
                      !u.online
                        ? "opacity-20 cursor-not-allowed text-gray-300"
                        : "opacity-40 group-hover:opacity-100 hover:bg-red-50 text-gray-400 hover:text-red-600 cursor-pointer"
                    }`}
                    title={!u.online ? "User is already offline" : "Force Logout User"}
                  >
                    {processingId === u.id ? (
                      <span className="w-4 h-4 block rounded-full border-2 border-red-500 border-t-transparent animate-spin"></span>
                    ) : (
                      <LogOut className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
};

const CorrectionRequestsWidget = ({ onSelect }) => {
  const [requests, setRequests] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, "CORRECTION_REQUESTS"), 
      where("status", "==", "PENDING"),
      orderBy("requestedAt", "desc"),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRequests(list);
    });
    return () => unsubscribe();
  }, []);

  const handleClick = (req) => {
  onSelect(req);
};

  // ✅ NEW: Mark as Read Handler
  const handleMarkAsRead = async (e, reqId) => {
    e.stopPropagation(); 
    if(!window.confirm("Mark this request as read? It will disappear from this list.")) return;
    try {
      const reqRef = doc(db, "CORRECTION_REQUESTS", reqId);
      await updateDoc(reqRef, { 
        status: "REVIEWED",
        reviewedAt: serverTimestamp()
      });
      toast.success("Marked as read");
    } catch (error) {
      console.error("Error updating request:", error);
      toast.error("Failed to update status");
    }
  };

  return (
    <WidgetCard title="Action Required" icon={AlertCircle}>
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[200px]">
        {requests.length === 0 && (
          <div className="text-center py-6 text-gray-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-20 text-green-500"/>
            <p className="text-xs">All clear! No pending corrections.</p>
          </div>
        )}
        {requests.map((req) => (
          <div 
            key={req.id} 
            onClick={() => handleClick(req)}
            className="flex items-center gap-3 p-2.5 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 hover:border-red-200 cursor-pointer transition-all group relative pr-10"
          >
            <div className="p-1.5 bg-white rounded-full text-red-500 shadow-sm">
              <FileText className="w-3 h-3" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-800 truncate">{req.employeeName}</p>
              <p className="text-[10px] text-red-600 truncate">
                {Object.keys(req.requestedChanges || {}).join(", ")} update requested
              </p>
            </div>
            <ArrowRight className="w-3 h-3 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            <button
              onClick={(e) => handleMarkAsRead(e, req.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white rounded-full text-gray-400 hover:text-green-600 hover:bg-green-50 shadow-sm border border-gray-200 hover:border-green-200 transition-all z-10"
              title="Mark as Read"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      
    </WidgetCard>
  );
};


const QuickReceiptModal = ({ open, onClose }) => {
  const { db } = useAuth(); 
  const [step, setStep] = useState(1);
  const [searchQuery, setSearchQuery] = useState(""); // Changed from 'mobile' to 'searchQuery'
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState(null);
  const [investments, setInvestments] = useState([]);
  const [selectedInv, setSelectedInv] = useState(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState("CASH");
  const [reference, setReference] = useState(""); // New State for Payment Reference
  const [installment, setInstallment] = useState("");
  const [savedTrans, setSavedTrans] = useState(null); 
  const [accountPool, setAccountPool] = useState([]);
  const [loadingRef, setLoadingRef] = useState(false);
  const [autoRef, setAutoRef] = useState("");
  const [goldRate, setGoldRate] = useState("");
  const [cashPaid, setCashPaid] = useState("");

  useEffect(() => {
      if (open) {
        const fetchPool = async () => {
          // We only fetch minimal data: ID and AccountNumber
          const q = query(collection(db, "INVESTMENTS"), where("status", "==", "ACTIVE"));
          const snap = await getDocs(q);
          setAccountPool(snap.docs.map(d => ({ id: d.id, accNo: d.data().accountNumber, custId: d.data().customerId })));
        };
        fetchPool();
      }
  }, [open, db]);

  useEffect(() => {
        if (
          selectedInv &&
          selectedInv.schemeType !== "SIP" &&
          goldRate > 0 &&
          cashPaid > 0
        ) {
          const grams = Number(cashPaid) / Number(goldRate);
          setAmount(grams.toFixed(3));
        }
  }, [goldRate, cashPaid, selectedInv]);

  if (!open) return null;

  const handleSearch = async () => {
    const queryStr = searchQuery.trim();
    if (queryStr.length < 3) return toast.error("Enter at least 3 digits");
    
    setLoading(true);
    try {
      let foundCustomer = null;
      let activeInvestments = [];
      // --- LOGIC 1: Partial Account Number Search (Last 3 Digits) ---
      const partialMatches = accountPool.filter(item => 
        item.accNo && item.accNo.endsWith(queryStr)
      );
      if (partialMatches.length > 0) {
        // If multiple accounts end with same 3 digits, we fetch the first one's customer
        // and show all accounts linked to that customer in Step 2.
        const targetCustId = partialMatches[0].custId;
        const custDirectQ = query(collection(db, "CUSTOMERS"), where("customerId", "==", targetCustId));
        const custDirectSnap = await getDocs(custDirectQ);
        
        if (!custDirectSnap.empty) {
          foundCustomer = { id: custDirectSnap.docs[0].id, ...custDirectSnap.docs[0].data() };
          const invQ = query(collection(db, "INVESTMENTS"), where("customerId", "==", targetCustId), where("status", "==", "ACTIVE"));
          const invSnap = await getDocs(invQ);
          activeInvestments = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      } 
      
      // --- LOGIC 2: Fallback to Mobile Number Search if no partial match ---
      if (!foundCustomer) {
        const custQ = query(collection(db, "CUSTOMERS"), where("mobile", "==", queryStr));
        const custSnap = await getDocs(custQ);
        if (!custSnap.empty) {
          foundCustomer = { id: custSnap.docs[0].id, ...custSnap.docs[0].data() };
          const invQ = query(collection(db, "INVESTMENTS"), where("customerId", "==", foundCustomer.customerId), where("status", "==", "ACTIVE"));
          const invSnap = await getDocs(invQ);
          activeInvestments = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
      }

      if (!foundCustomer || activeInvestments.length === 0) {
        toast.error("No matching account found");
        setLoading(false);
        return;
      }

      setCustomer(foundCustomer);
      setInvestments(activeInvestments);
      setStep(2);
    } catch (e) {
      toast.error("Search system error");
    } finally {
      setLoading(false);
    }
  };

 const handleSave = async () => {
    const isSIP = selectedInv.schemeType === "SIP";
    if (!isSIP) {
      if (!goldRate || goldRate <= 0) return toast.error("Enter Gold Rate");
      if (!cashPaid || cashPaid <= 0) return toast.error("Enter Amount Paid");
      if (!amount || amount <= 0) return toast.error("Invalid Gold Weight");
    }
    if (isSIP) {
      if (!amount || amount <= 0) return toast.error("Invalid Amount");
      if (!installment) return toast.error("Select Installment Month");
    }
    if (isSIP && !installment) return toast.error("Select Installment Month");
    setLoading(true);
    try {
      const val = Number(amount);
      let finalTransData = null;
      await runTransaction(db, async (transaction) => {
        // --- CONTINUOUS P-REF LOGIC ---
        const counterRef = doc(db, "METADATA", "counters");
        const counterSnap = await transaction.get(counterRef);
        let nextNum = 500;
        if (counterSnap.exists() && counterSnap.data().pRef) {
          nextNum = counterSnap.data().pRef + 1;
        }
        const autoGen = `P${nextNum}`;
        // If user didn't change the reference, increment the counter
        if (reference === autoRef) {
          transaction.set(counterRef, { pRef: nextNum }, { merge: true });
        }

        const invRef = doc(db, "INVESTMENTS", selectedInv.id);
        const invDoc = await transaction.get(invRef);
        if (!invDoc.exists()) throw "Investment not found";
        const currentData = invDoc.data();
        const newTotalInvested = (currentData.totalInvestedAmount || 0) + (isSIP ? val : 0);
        const newTotalGrams = (currentData.totalGramsAccumulated || 0) + (!isSIP ? val : 0);
        const transRef = doc(collection(db, "INVESTMENT_TRANSACTIONS"));
        const transData = {
          investmentId: selectedInv.id,
          customerId: selectedInv.customerId,
          type: "CREDIT",
          amount: isSIP ? val : Number(cashPaid),
          grams: !isSIP ? val : 0,
          goldRate: !isSIP ? Number(goldRate) : null,
          mode: mode,
          reference: reference, // Auto or manually edited
          installment: isSIP ? installment : null,
          date: date,
          createdAt: serverTimestamp()
        };

        transaction.set(transRef, transData);
        // --- ADD TO GLOBAL PAYMENTS LEDGER ---
        const globalPayRef = doc(collection(db, "ALL_PAYMENTS"));
        transaction.set(globalPayRef, {
          ref: reference,
          source: "Investment",
          amount: val,
          customerName: customer.name,
          mode: mode,
          date: date,
          createdAt: serverTimestamp()
        });
        transaction.update(invRef, {
          totalInvestedAmount: newTotalInvested,
          totalGramsAccumulated: newTotalGrams,
          lastTransactionDate: serverTimestamp()
        });
        finalTransData = { id: transRef.id, ...transData };
      });
      setSavedTrans(finalTransData);
      toast.success("Saved Successfully");
      setStep(4);
    } catch (e) { toast.error("Transaction Failed"); } finally { setLoading(false); }
  };

  const handlePrint = () => {
    if (!savedTrans || !selectedInv) return;
    const t = savedTrans;
    const isSIP = selectedInv.schemeType === "SIP";
    const amountVal = isSIP ? t.amount : t.grams;
    const amountLabel = isSIP ? `₹${amountVal}` : `${amountVal} g`;
    const amountInWords = isSIP ? numberToWords(amountVal) : `${amountVal} Grams Only`;
    const printWindow = window.open('', '', 'width=400,height=600');
    printWindow.document.write(`<html><head><title>Receipt #${t.id.slice(0,6)}</title><style>@page { size: 80mm auto; margin: 0; } body { font-family: 'Courier New', monospace; width: 72mm; margin: 2mm auto; color: #000; font-size: 12px; line-height: 1.2; } .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 5px; } .title { font-size: 16px; font-weight: bold; margin: 0; } .sub-title { font-size: 10px; margin: 2px 0; } .receipt-info { text-align: center; margin: 5px 0; font-weight: bold; font-size: 14px; } .divider { border-bottom: 1px dashed #000; margin: 8px 0; } .row { display: flex; justify-content: space-between; margin-bottom: 4px; } .label { font-weight: bold; white-space: nowrap; padding-right: 5px; } .value { text-align: right; word-wrap: break-word; max-width: 60%; } .amount-box { border: 2px solid #000; padding: 5px; text-align: center; font-size: 16px; font-weight: bold; margin: 10px 0; } .footer { margin-top: 20px; text-align: center; font-size: 10px; } .sign { margin-top: 30px; border-top: 1px solid #000; display: inline-block; padding-top: 2px; width: 80%; } </style></head><body><div class="header"><div class="title">KESHAV JEWELLERS</div><div class="sub-title">MKS JEWELS PRIVATE LIMITED</div><div class="sub-title">Tilak Road, Sagara - 577401</div><div class="sub-title">Ph: +91 9448319501</div><div class="sub-title">GSTIN: 29AARCM3452G1Z3</div></div><div class="receipt-info">PAYMENT RECEIPT</div><div style="text-align: center; font-size: 11px;">#${t.id.slice(0,6).toUpperCase()}</div><div class="divider"></div><div class="row"><span class="label">Date:</span><span class="value">${t.date}</span></div><div class="row"><span class="label">Received From:</span><span class="value">${customer.name}</span></div><div class="row"><span class="label">Scheme:</span><span class="value">${selectedInv.schemeName}</span></div><div class="row"><span class="label">Acc No:</span><span class="value">${selectedInv.accountNumber || 'N/A'}</span></div><div class="divider"></div><div class="row"><span class="label">Ref:</span><span class="value">${t.reference || '-'}</span></div><div class="row"><span class="label">Mode:</span><span class="value">${t.mode || 'CASH'}</span></div>${t.installment ? `<div class="row"><span class="label">Installment:</span><span class="value">Month ${t.installment}</span></div>` : ''}<div class="amount-box">${amountLabel}</div><div style="font-size: 10px; font-style: italic; text-align: center;">(${amountInWords})</div><div class="footer"><div class="sign">AUTHORIZED SIGNATORY</div><div style="margin-top: 5px;">Thank you for investing with us!</div></div><script>window.print();</script></body></html>`);
    printWindow.document.close();
  };

  const handleClose = () => { 
    setStep(1); 
    setSearchQuery(""); 
    setCustomer(null); 
    setInvestments([]); 
    setSelectedInv(null); 
    setAmount(""); 
    setReference("");
    setInstallment(""); 
    setSavedTrans(null); 
    setGoldRate("");
    setCashPaid("");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gray-50 px-6 py-4 border-b flex justify-between items-center"><h3 className="font-bold text-gray-800">Quick Receipt</h3><button onClick={handleClose}><X className="w-5 h-5 text-gray-400"/></button></div>
        <div className="p-6">
          {/* STEP 1: DUAL SEARCH */}
          {step === 1 && ( 
            <div className="space-y-4">
              <label className="text-xs font-bold text-gray-500 uppercase">Search by Mobile or Acc No</label>
              <div className="flex gap-2">
                <input 
                  autoFocus 
                  placeholder="Mobile or Acc Number" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                  className="flex-1 p-2 border rounded-lg outline-none focus:border-amber-500"
                />
                <button 
                  onClick={handleSearch} 
                  disabled={loading} 
                  className="bg-amber-600 text-white px-4 py-2 rounded-lg font-bold text-sm"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin"/> : "Find"}
                </button>
              </div>
            </div> 
          )}
          {/* STEP 2: ACCOUNT SELECTION */}
          {step === 2 && ( 
            <div className="space-y-3">
              <p className="text-sm font-bold text-gray-700">Accounts for {customer.name}</p>
              <div className="max-h-60 overflow-y-auto space-y-2">
                {investments.map(inv => ( 
                  <div key={inv.id} onClick={() => { setSelectedInv(inv); setStep(3); }} className="p-3 border rounded-lg hover:bg-amber-50 cursor-pointer transition-colors">
                    <div className="flex justify-between">
                      <span className="font-bold text-sm">{inv.schemeName}</span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 font-semibold">{inv.schemeType}</span>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-gray-500 font-mono">ACC: {inv.accountNumber || inv.investmentId}</span>
                      <span className="text-xs font-bold text-amber-700">
                        {inv.schemeType === 'SIP' ? `₹${inv.monthlyAmount}` : `${inv.purchaseWeight}g`}
                      </span>
                    </div>
                  </div> 
                ))}
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-gray-500 underline mt-2">Back to Search</button>
            </div> 
          )}
          {/* STEP 3: TRANSACTION DETAILS */}
          {step === 3 && selectedInv && ( 
            <div className="space-y-4">
              <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
                <div className="text-xs text-amber-800 font-bold">{selectedInv.schemeName}</div>
                <div className="text-[10px] text-amber-600">Acc: {selectedInv.accountNumber || selectedInv.investmentId}</div>
              </div>
              {selectedInv.schemeType !== "SIP" ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Gold Rate (₹ / gram)
                    </label>
                    <input
                      type="number"
                      value={goldRate}
                      onChange={e => setGoldRate(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
                      placeholder="e.g. 6500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Amount Paid (₹)
                    </label>
                    <input
                      type="number"
                      value={cashPaid}
                      onChange={e => setCashPaid(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Gold Weight (g)
                      <span className="text-[10px] text-gray-400 ml-1">(auto, editable)</span>
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">
                      Amount (₹)
                    </label>
                    <input
                      type="number"
                      autoFocus
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={e => setDate(e.target.value)}
                      className="w-full mt-1 p-2 border rounded-lg outline-none"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Payment Reference</label>
                <input 
                  placeholder="UPI Ref, Chq No, etc." 
                  value={reference} 
                  onChange={e => setReference(e.target.value)} 
                  className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Mode</label>
                  <select value={mode} onChange={e => setMode(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white outline-none">
                    <option value="CASH">CASH</option>
                    <option value="UPI">UPI</option>
                    <option value="HDFC">HDFC</option>
                    <option value="CARD">CARD</option>
                  </select>
                </div>
                {selectedInv.schemeType === "SIP" && ( 
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase">Installment</label>
                    <select value={installment} onChange={e => setInstallment(e.target.value)} className="w-full mt-1 p-2 border rounded-lg bg-white outline-none">
                      <option value="">Month</option>
                      {Array.from({length: selectedInv.durationMonths || 12}, (_, i) => ( 
                        <option key={i+1} value={i+1}>M {i+1}</option> 
                      ))}
                    </select>
                  </div> 
                )}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setStep(2)} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-bold text-gray-600">Back</button>
                <button onClick={handleSave} disabled={loading} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700">
                  {loading ? "..." : "Save & Print"}
                </button>
              </div>
            </div> 
          )}
          {/* STEP 4: SUCCESS */}
          {step === 4 && ( 
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 className="w-8 h-8 text-green-600"/></div>
              <h3 className="text-lg font-bold text-gray-800">Success!</h3>
              <button onClick={handlePrint} className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg hover:bg-amber-700 flex items-center justify-center gap-2 mb-3">
                <FileText className="w-5 h-5"/> Print Receipt
              </button>
              <button onClick={handleClose} className="text-sm text-gray-500 hover:text-gray-800 underline">Close Window</button>
            </div> 
          )}
        </div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------
// 2. DASHBOARD CONTENT (REDESIGNED)
// ------------------------------------------------------------
export const DashboardContent = ({ role }) => {
  const navigate = useNavigate();
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [yearReviewOpen, setYearReviewOpen] = useState(false);
  const backupState = useAutoBackup(role);
  const [selectedReq, setSelectedReq] = useState(null);


  const approveCorrection = async (req) => {
  try {
    await runTransaction(db, async (t) => {
      const targetRef = doc(db, req.targetCollection, req.targetDocId);
      const snap = await t.get(targetRef);
      if (!snap.exists()) throw new Error("Target record missing");

      const updates = {};
      Object.entries(req.requestedChanges).forEach(([k, v]) => {
        updates[k] = v.new;
      });
      // 🔁 Recalculate if needed
      if (req.transactionType === "ASSIGNMENT") {
        const raw =
          updates.rawMaterialWeight ?? snap.data().rawMaterialWeight;
        const purity = updates.purity ?? snap.data().purity;
        updates.effectiveGoldAssigned = (raw * purity) / 100;
      }
      // Update main ledger record
      t.update(targetRef, {
        ...updates,
        correctionRequested: false,
        correctedByAdmin: true,          // ✅ NEW FLAG
        correctedAt: serverTimestamp(),  // ✅ OPTIONAL (future use)
        lastEdited: serverTimestamp(),
      });
      // Update request status
      t.update(doc(db, "CORRECTION_REQUESTS", req.id), {
        status: "APPROVED",
        approvedAt: serverTimestamp(),
      });
    });
    toast.success("Correction approved and applied");
  } catch (e) {
    console.error(e);
    toast.error("Approval failed");
  }
};

  return (
    <div className="h-screen w-full flex flex-col bg-[#F3F4F6] overflow-hidden">
      <GlobalStyles />
      <div className="flex-none bg-white border-b border-gray-200 px-6 py-4 shadow-sm z-20">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="shrink-0 max-w-xl">
            <div className="pl-3 border-l-2 border-amber-600">
              <p className="text-sm font-bold text-gray-900 tracking-wide">
                Keshav Jewellers — Internal Operations
              </p>
              <p className="text-[11px] text-gray-500">
                Gold • Inventory • Ledger • Investments
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 -mx-2 px-2 sm:mx-0 sm:px-0 sm:flex-wrap">
            <button onClick={() => navigate('/internal/forms')} className="flex items-center gap-2 px-3 py-2 rounded-lg shrink-0 hover:bg-gray-50">
              <Layers className="w-4 h-4 text-amber-700" />
              <span className="font-bold text-[11px] text-gray-700">Gold Ops</span>
            </button>

            <QuickActionGroup 
                title="Ledger" 
                icon={Briefcase} 
                colorClass="text-blue-700 bg-blue-100"
                items={[
                  { label: "Reports", desc: "Balances", icon: FileText, path: "/internal/ledger/reports" },
                  { label: "Manage", desc: "Corrections", icon: ShieldCheck, path: "/internal/ledger" }
                ]}
            />

            <QuickActionGroup 
                title="Estimates" 
                icon={Calculator} 
                colorClass="text-emerald-700 bg-emerald-100"
                items={[
                  { label: "New", desc: "Generator", icon: Zap, path: "/sales/estimations/generator" },
                  { label: "Logs", desc: "History", icon: List, path: "/sales/estimations/logs" }
                ]}
            />

            <button onClick={() => navigate('/sales/orders')} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
              <ShoppingBag className="w-4 h-4 " />
              <span className="font-bold text-[11px] text-gray-700">Orders</span>
            </button>
            <button onClick={() => navigate('/sales/investments')} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50">
              <FlameKindlingIcon className="w-4 h-4 text-yellow-500 " />
              <span className="font-bold text-[11px] text-gray-700">Investments</span>
            </button>
        </div>
        </div>
      </div>
      {/* MAIN LAYOUT */}
      <div className="flex-1 p-2 md:p-4 lg:p-6 overflow-y-auto lg:overflow-hidden premium-scroll bg-[#F3F4F6]">
        <div className="grid grid-cols-12 gap-4 lg:gap-6">
          
          {/* LEFT COLUMN: System Pulse & Main Panel */}
          <div className="col-span-12 lg:col-span-9 space-y-4">
            <SystemPulseBar backupState={backupState} />
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden min-h-[500px] lg:h-[calc(100vh-220px)] flex flex-col">
              <B2JEmployeeStatusPanel />
            </div>
          </div>

          {/* RIGHT COLUMN: Action Buttons & Widgets */}
          <div className="col-span-12 lg:col-span-3 space-y-4">
            
            {/* Primary Action Button - full width on mobile */}
            <button 
              onClick={() => setReceiptModalOpen(true)}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-xl shadow-md flex items-center justify-center gap-3 font-bold text-sm"
            >
              <PlusCircle className="w-5 h-5" />
              <span>New Investment Receipt</span>
            </button>

            {/* Responsive Widget Grid: 1 col on mobile, 2 cols on tablet (md), 1 col on desktop (lg) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
              <ActiveUsersPanel currentRole={role} />
              <CorrectionRequestsWidget onSelect={setSelectedReq} />
            </div>
            
          </div>
        </div>
      </div>
      <QuickReceiptModal open={receiptModalOpen} onClose={() => setReceiptModalOpen(false)} />
    </div>
  );
};
// Goldsmith Login Page
const GoldsmithLedgerPage = () => {
  const { user } = useAuth();
  const { employees: b2bEmployees, isLoading: loadingB2B } = useB2BEmployees();
  const { employees: b2jEmployees, isLoading: loadingB2J } = useB2JEmployees();
  const [found, setFound] = useState(null);
  useEffect(() => {
    if (!user?.email) return;
    if (loadingB2B || loadingB2J) return;
    const email = user.email.toLowerCase().trim();
    const matchB2J = (b2jEmployees || []).find(e => (e.email || "").toLowerCase() === email);
    if (matchB2J) { setFound({ id: matchB2J.id, name: matchB2J.name, type: "B2J", email }); return; }
    const matchB2B = (b2bEmployees || []).find(e => (e.email || "").toLowerCase() === email);
    if (matchB2B) { setFound({ id: matchB2B.id, name: matchB2B.name, type: "B2B", email }); return; }
    setFound(false);
  }, [user?.email, loadingB2B, loadingB2J, b2bEmployees, b2jEmployees]);
  if (found === null) return <div className="p-6 text-center text-gray-500">Loading your profile...</div>;
  if (found === false) return ( <div className="p-8 bg-white rounded-xl shadow text-center max-w-2xl mx-auto"><h3 className="text-lg font-bold mb-2">No mapped employee found</h3><p className="text-sm text-gray-600 mb-4">Your login email <strong>{user?.email}</strong> is not mapped yet.</p></div> );
  return ( <EmployeeTransactionProfile employeeId={found.id} employeeName={found.name} businessType={found.type} email={found.email} onBack={() => {}} /> );
};

const PageContent = ({ currentPage, role }) => {
  const rawPath = window.location.pathname || currentPage || "/";
  const path = rawPath.replace(/\/+$/, "");
  if (role === "Goldsmith") {
    if (path !== "/goldsmith-ledger") { window.history.replaceState(null, "", "/goldsmith-ledger"); }
    return <GoldsmithLedgerPage />;
  }

  const normalizedPath = (() => {
  // normalize stock ledger routes
  if (path.startsWith("/internal/stock/") && path.endsWith("/ledger")) {
    return "/internal/stock/ledger";
  }

  // ✅ normalize item history routes
  if (/^\/internal\/items\/[^/]+\/history$/.test(path)) {
    return "/internal/items/history";
  }

 if (path.startsWith("/finance/invoices/")) {
  return "/finance/invoices/view";
}

  return path;
})();

  const PageComponent = (() => {
    switch (path) {
      case "": case "/": case "/home": return DashboardContent;
      case "/internal/forms": return FormsPage;
      case "/internal/ledger/reports": return Reports;
      case "/internal/stock-inventory": return StockOverview;
      case "/internal/items": return ItemList;
      case "/internal/items/new":
      case "/internal/items/edit": return ItemMasterForm;
      case "/internal/items/history": return ItemHistory;
      case "/sales/estimations/generator": return EstimationGenerator;
      case "/sales/estimations/temp-generator": return DraftEstimationGenerator
      case "/sales/estimations/direct-sale": return DirectSaleEstimation;
      case "/sales/estimations/custom-order": return CustomOrderEstimation;
      case "/sales/estimations/logs": return EstimationLogsPage;
      case "/sales/orders": return OrdersPage;
      case "/sales/customers": return CustomersPage;
      case "/sales/investments": return InvestmentsPage;
      case "/finance/payments": return PaymentsPage;
      case "/finance/invoices": return InvoicesPage;
      case "/internal/ledger":
        if (role === "Admin" || role === "Developer") return ManagementHub;
        return () => ( <div className="p-8 text-center bg-white m-8 rounded-2xl shadow-lg"><Lock className="w-12 h-12 text-red-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-gray-800">Access Denied</h2><p className="text-gray-600">Admin/Developer access only.</p></div> );
      default:
        return () => ( <div className="p-8 text-center bg-white m-8 rounded-2xl shadow-lg"><FileText className="w-12 h-12 text-gray-500 mx-auto mb-4" /><h2 className="text-2xl font-bold text-gray-800">Page Not Found</h2><p className="text-gray-600 text-sm mt-2">Route: <strong>{path}</strong></p></div> );
    }
  })();
  return <PageComponent role={role} />;
};

export default PageContent;