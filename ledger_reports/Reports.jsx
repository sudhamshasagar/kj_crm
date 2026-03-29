// ---------------------------------------------
// REPORTS.jsx
// ---------------------------------------------

import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  FileText,
  Loader2,
  X,
  Calendar,
  Users,
  Briefcase,
  UserCheck,
  ArrowRightLeft,
  PieChart,
  ClipboardList,
  Download
} from "lucide-react";

import { useAuth } from "../../AuthContext";
import { B2B_MASTER_LOG, B2J_MASTER_LOG } from "../../firebaseConfig";
import { getDocs, query, orderBy } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Theme color & Accents
const BLUE = "#0f172a";
const BLUE_LIGHT = "#fdf8f6";
const BLUE_HOVER = "#965d36";

// ---------------------------------------------
// Helpers (UNCHANGED)
// ---------------------------------------------
export const num = (v) => {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
};

export const safe = (v) => (v ? String(v) : "");

export const formatDateTime = (ts) => {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

// ---------------------------------------------
// Modal Wrapper (STYLED)
// ---------------------------------------------
const ModalWrapper = ({ open, onClose, children }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 relative overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b bg-slate-50">
          <h3 className="font-bold text-lg text-slate-800">Configuration</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};

// ---------------------------------------------
// REPORT GENERATION POPUP (UNCHANGED LOGIC)
// ---------------------------------------------
export const ReportPopup = ({
  open,
  onClose,
  employees,
  onGenerate,
  loading,
}) => {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [reportType, setReportType] = useState("ASSIGNMENT");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleGenerate = () => {
    if (!selectedEmployee) return alert("Select employee");
    onGenerate({
      employeeName: selectedEmployee,
      type: reportType,
      from: dateFrom,
      to: dateTo,
    });
  };

  return (
    <ModalWrapper open={open} onClose={onClose}>
      {/* EMPLOYEE */}
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Employee</label>
      <div className="border border-slate-300 rounded-lg px-3 py-2 bg-white flex items-center mb-5 hover:border-slate-400 transition-colors focus-within:ring-2 focus-within:ring-orange-100">
        <Users className="w-4 h-4 mr-2 text-slate-400" />
        <select
          className="w-full bg-transparent outline-none text-sm text-slate-700"
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
        >
          <option value="">Select employee...</option>
          {employees.map((emp) => (
            <option key={emp} value={emp}>
              {emp}
            </option>
          ))}
        </select>
      </div>

      {/* TYPE */}
      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">Report Type</label>
      <div className="border border-slate-300 rounded-lg px-3 py-2 bg-white flex items-center mb-5 hover:border-slate-400 transition-colors focus-within:ring-2 focus-within:ring-orange-100">
        <FileText className="w-4 h-4 mr-2 text-slate-400" />
        <select
          className="w-full bg-transparent outline-none text-sm text-slate-700"
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
        >
          <option value="ASSIGNMENT">Assignment Report</option>
          <option value="RETURN">Return Report</option>
          <option value="SUMMARY">Summary Report</option>
        </select>
      </div>

      {/* DATE RANGE */}
      <div className="grid grid-cols-2 gap-4 mb-2">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">From</label>
          <div className="border border-slate-300 rounded-lg px-3 py-2 flex items-center bg-white hover:border-slate-400 transition-colors">
            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
            <input
              type="date"
              className="w-full outline-none text-sm text-slate-700"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 block">To</label>
          <div className="border border-slate-300 rounded-lg px-3 py-2 flex items-center bg-white hover:border-slate-400 transition-colors">
            <Calendar className="w-4 h-4 mr-2 text-slate-400" />
            <input
              type="date"
              className="w-full outline-none text-sm text-slate-700"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ACTIONS */}
      <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-100">
        <button
          className="px-5 py-2.5 rounded-lg text-slate-600 font-medium hover:bg-slate-100 transition-colors text-sm"
          onClick={onClose}
        >
          Cancel
        </button>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold flex items-center gap-2 shadow-lg shadow-orange-900/10 hover:shadow-orange-900/20 transform active:scale-95 transition-all"
          style={{ backgroundColor: BLUE }}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </button>
      </div>
    </ModalWrapper>
  );
};

// ------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------

export default function Reports() {
  const { db } = useAuth();

  // MAIN UI STATE
  const [topTab, setTopTab] = useState("B2B"); // B2B / B2J
  const [subTab, setSubTab] = useState("ASSIGNMENT"); // ASSIGNMENT / RETURN / SUMMARY

  const [loading, setLoading] = useState(false);

  // RAW DATA FROM FIREBASE
  const [b2bData, setB2bData] = useState([]);
  const [b2jData, setB2jData] = useState([]);

  // SEARCH & FILTERS
  const [search, setSearch] = useState("");

  const [filterOpen, setFilterOpen] = useState(false);
  const [filterEmployee, setFilterEmployee] = useState("");
  const [filterPurity, setFilterPurity] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // REPORT POPUP
  const [reportPopupOpen, setReportPopupOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const getFlexibleDate = (row) => {
  return row.dateReturned || row.assignedDate || row.dateAssigned || row.createdAt || null;
};
  // ------------------------------------------------------
  // FETCH LOGIC (UNCHANGED)
  // ------------------------------------------------------
  const loadB2B = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(B2B_MASTER_LOG);
      const arr = snap.docs.map((d) => {
        const data = d.data();
        const fDate = getFlexibleDate(data);
        return {
          id: d.id,
          ...data,
          assignedDate: fDate, // Standardizes the date field for the table
          timestamp: fDate?.seconds || 0,
        };
      });
      // Sort manually to ensure absolute latest is on top
      arr.sort((a, b) => b.timestamp - a.timestamp);
      setB2bData(arr);
    } catch (e) {
      console.error("B2B Load Error", e);
    } finally {
      setLoading(false);
    }
  };

  const loadB2J = async () => {
    try {
      setLoading(true);
      const snap = await getDocs(B2J_MASTER_LOG);
      const raw = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const flat = [];

      raw.forEach((row) => {
        const employee = (row.employeeName || "Unknown").trim();
        const tType = row.transactionType || "";
        const fDate = getFlexibleDate(row);

        if (tType === "ASSIGNMENT") {
          // Handle nested orders or flat structure
          const orderList = (row.orders && row.orders.length > 0) ? row.orders : [{}];
          orderList.forEach((o) => {
            flat.push({
              ...row,
              transactionType: "ASSIGNMENT",
              employeeName: employee,
              orderId: o.orderId || row.assignmentId || row.orderId || "N/A",
              ornamentCategory: o.ornamentCategory || row.ornamentCategory || "N/A",
              purity: Number(o.purity || row.purity || row.rawMaterialPurity || 0),
              rawMaterialWeight: Number(o.weight || row.rawMaterialWeight || 0),
              assignedDate: fDate,
              timestamp: fDate?.seconds || 0
            });
          });
        } else if (tType.includes("RETURN")) {
          flat.push({
            ...row,
            transactionType: "RETURN",
            employeeName: employee,
            orderId: row.linkedAssignmentOrderId || row.returnId || row.orderId || "N/A",
            assignedDate: fDate,
            timestamp: fDate?.seconds || 0
          });
        }
      });
      flat.sort((a, b) => b.timestamp - a.timestamp);
      setB2jData(flat);
    } catch (e) {
      console.error("B2J Load Error", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadB2B();
    loadB2J();
  }, []);

  // ------------------------------------------------------
  // DROPDOWNS & FILTER LOGIC (UNCHANGED)
  // ------------------------------------------------------
  const employees = useMemo(() => {
    const src = topTab === "B2B" ? b2bData : b2jData;
    const list = src
      .map((x) => x.employeeName?.trim())
      .filter((x) => x && x !== "undefined" && x !== "null");
    return [...new Set(list)].sort();
  }, [topTab, b2bData, b2jData]);

  const purities = useMemo(() => {
    const src = topTab === "B2B" ? b2bData : b2jData;
    return [...new Set(src.map((x) => num(x.purity)))].filter((x) => x > 0);
  }, [topTab, b2bData, b2jData]);

  const categories = useMemo(() => {
    const src = topTab === "B2B" ? b2bData : b2jData;
    return [...new Set(src.map((x) => safe(x.ornamentCategory)))].filter(
      Boolean
    );
  }, [topTab, b2bData, b2jData]);

  const filteredData = useMemo(() => {
    let src = topTab === "B2B" ? b2bData : b2jData;

    if (subTab === "ASSIGNMENT") {
      src = src.filter((x) => x.transactionType === "ASSIGNMENT");
    } else if (subTab === "RETURN") {
      src = src.filter((x) => x.transactionType?.includes("RETURN"));
    }

    if (filterEmployee) src = src.filter((x) => x.employeeName === filterEmployee);
    if (filterPurity) src = src.filter((x) => num(x.purity) === num(filterPurity));
    if (filterCategory) src = src.filter((x) => safe(x.ornamentCategory) === filterCategory);

    // DATE RANGE LOGIC
    if (dateFrom) {
      const start = new Date(dateFrom);
      start.setHours(0, 0, 0, 0);
      src = src.filter((x) => (x.timestamp * 1000) >= start.getTime());
    }
    if (dateTo) {
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999); // Inclusion fix
      src = src.filter((x) => (x.timestamp * 1000) <= end.getTime());
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      src = src.filter(
        (x) =>
          safe(x.employeeName).toLowerCase().includes(s) ||
          safe(x.orderId).toLowerCase().includes(s) ||
          safe(x.ornamentCategory).toLowerCase().includes(s)
      );
    }
    return src;
  }, [topTab, subTab, search, filterEmployee, filterPurity, filterCategory, dateFrom, dateTo, b2bData, b2jData]);

  const summary = useMemo(() => {
    const src = topTab === "B2B" ? b2bData : b2jData;
    const map = {};
    src.forEach((row) => {
      const emp = row.employeeName || "Unknown";
      if (!map[emp]) map[emp] = { assigned: 0, returned: 0 };
      if (topTab === "B2B") {
        if (row.transactionType?.includes("ASSIGNMENT")) {
           map[emp].assigned += num(row.rawMaterialWeight);
        }
        if (row.transactionType?.includes("RETURN")) {
           map[emp].returned += num(row.returnedWeight) + num(row.wastage);
        }
      } else {
        if (row.transactionType?.includes("ASSIGNMENT")) {
          const eff = row.effectiveGoldAssigned || (num(row.rawMaterialWeight) * num(row.purity)) / 100;
          map[emp].assigned += num(eff);
        }
        if (row.transactionType?.includes("RETURN")) {
          const eff = row.effectiveGoldReturned || (num(row.returnedWeight) * num(row.purity)) / 100;
          map[emp].returned += num(eff);
        }
      }
    });
    return map;
  }
  , [topTab, subTab, search, filterEmployee, filterPurity, filterCategory, dateFrom, dateTo, b2bData, b2jData]);
  const openReportPopup = () => setReportPopupOpen(true);

  // ------------------------------------------------------
  // UI RENDER
  // ------------------------------------------------------
  return (
  <div className="dashboard-bg h-screen overflow-hidden font-sans text-slate-800 flex flex-col">
    
    {/* 1. TOP FIXED SECTION (Navigation & Global Switcher) */}
    <div className="flex-none p-4 md:p-6 lg:px-8 lg:pt-8 space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm mt-1 flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-500" />
            Manage assignments, returns, and balances.
          </p>
        </div>
        <button
          onClick={openReportPopup}
          className="px-6 py-3 bg-slate-900 hover:bg-black rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-slate-200 transition-all active:scale-95"
        >
          <FileText className="w-4 h-4" />
          Generate PDF
        </button>
      </header>

      {/* GLOBAL CONTEXT SWITCHER (B2B / B2J) */}
      <div className="flex justify-center">
        <div className="bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200 inline-flex items-center gap-1 backdrop-blur-sm shadow-inner">
          <button
            onClick={() => setTopTab("B2B")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
              topTab === "B2B" 
                ? "bg-white text-slate-900 shadow-md ring-1 ring-black/5" 
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <Briefcase className={`w-4 h-4 ${topTab === "B2B" ? "text-blue-600" : ""}`} />
            <span>B2B Operations</span>
          </button>
          <button
            onClick={() => setTopTab("B2J")}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black transition-all duration-300 ${
              topTab === "B2J" 
                ? "bg-white text-slate-900 shadow-md ring-1 ring-black/5" 
                : "text-slate-500 hover:text-slate-800 hover:bg-white/40"
            }`}
          >
            <UserCheck className={`w-4 h-4 ${topTab === "B2J" ? "text-blue-600" : ""}`} />
            <span>B2J (Job Work)</span>
          </button>
        </div>
      </div>
    </div>

    {/* 2. SUB-TOOLBAR (Pills & Search) - Fixed */}
    <div className="flex-none px-4 md:px-6 lg:px-8 pb-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-col lg:flex-row gap-4 justify-between items-center">
        
        {/* Sub-tab Pills */}
        <div className="flex gap-1 bg-slate-100/80 p-1 rounded-xl w-full lg:w-auto overflow-x-auto no-scrollbar">
          {[
            { id: "ASSIGNMENT", label: "Assignments", icon: ArrowRightLeft },
            { id: "RETURN", label: "Returns", icon: ArrowRightLeft },
            { id: "SUMMARY", label: "Balance Summary", icon: PieChart },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                subTab === tab.id
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              {subTab === tab.id && <tab.icon className="w-3.5 h-3.5 text-amber-600" />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Filter Bar */}
        <div className="flex gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-72 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
            <input
              type="text"
              placeholder="Search reports..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-300 rounded-xl outline-none text-xs transition-all"
            />
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
              filterEmployee || filterCategory || filterPurity || dateFrom 
                ? "bg-amber-50 border-amber-200 text-amber-700 shadow-inner" 
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50 shadow-sm"
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    {/* 3. INTERNAL SCROLLABLE CONTENT AREA */}
    <div className="flex-1 overflow-y-auto premium-scroll px-4 md:px-6 lg:px-8 pb-32">
      <div className="max-w-[1600px] mx-auto">
        
        {/* === DESKTOP TABLE VIEW === */}
        <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/80 sticky top-0 z-10 backdrop-blur-md shadow-sm border-b border-slate-100">
              <tr>
                {subTab === "ASSIGNMENT" && (
                  <>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Date</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Employee</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Order ID</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Category</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Raw Wt (g)</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Purity (%)</th>
                    {topTab === "B2J" && <th className="p-4 font-black text-amber-800 text-[10px] uppercase tracking-widest text-right bg-amber-50/50">Effective (g)</th>}
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Cash</th>
                  </>
                )}
                {subTab === "RETURN" && (
                  <>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Date</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Employee</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Order ID</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Return (g)</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Wastage (g)</th>
                    <th className="p-4 font-black text-amber-800 text-[10px] uppercase tracking-widest text-right bg-amber-50/50">Net Wt (g)</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Stone (Rs)</th>
                  </>
                )}
                {subTab === "SUMMARY" && (
                  <>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest">Employee Name</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Total Assigned</th>
                    <th className="p-4 font-black text-slate-500 text-[10px] uppercase tracking-widest text-right">Total Returned</th>
                    <th className="p-4 font-black text-amber-800 text-[10px] uppercase tracking-widest text-right bg-amber-50/50">Pending Balance</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subTab === "ASSIGNMENT" && filteredData.map((r) => (
                <tr key={r.id + r.orderId} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-500 font-medium">{formatDateTime(r.assignedDate)}</td>
                  <td className="p-4 font-bold text-slate-900">{r.employeeName}</td>
                  <td className="p-4 text-slate-600"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">#{r.orderId}</span></td>
                  <td className="p-4 text-slate-600 text-xs font-bold uppercase">{r.ornamentCategory}</td>
                  <td className="p-4 text-right text-slate-900 font-black">{num(r.rawMaterialWeight).toFixed(3)}</td>
                  <td className="p-4 text-right text-slate-600 font-bold">{num(r.purity || r.rawMaterialPurity)}</td>
                  {topTab === "B2J" && <td className="p-4 text-right font-black text-amber-700 bg-amber-50/30">{num(r.effectiveGoldAssigned || (num(r.rawMaterialWeight) * num(r.purity || r.rawMaterialPurity)) / 100).toFixed(3)}</td>}
                  <td className="p-4 text-right text-emerald-600 font-bold">₹{r.advanceCashPaid || 0}</td>
                </tr>
              ))}

              {subTab === "RETURN" && filteredData.map((r) => (
                <tr key={r.id + r.orderId} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-slate-500 font-medium">{formatDateTime(r.assignedDate)}</td>
                  <td className="p-4 font-bold text-slate-900">{r.employeeName}</td>
                  <td className="p-4 text-slate-600"><span className="bg-slate-100 px-2 py-1 rounded text-xs font-mono">#{r.orderId}</span></td>
                  <td className="p-4 text-right text-slate-900 font-black">{num(r.returnedWeight).toFixed(3)}</td>
                  <td className="p-4 text-right text-red-500 font-bold">+{num(r.wastage).toFixed(3)}</td>
                  <td className="p-4 text-right font-black text-amber-700 bg-amber-50/30">{(num(r.returnedWeight) + num(r.wastage)).toFixed(3)}</td>
                  <td className="p-4 text-right text-slate-600 font-bold">₹{r.stoneCharges || 0}</td>
                </tr>
              ))}

              {subTab === "SUMMARY" && Object.keys(summary).map((emp) => {
                const bal = summary[emp].assigned - summary[emp].returned;
                return (
                  <tr key={emp} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-black text-slate-900">{emp}</td>
                    <td className="p-4 text-right text-slate-600 font-bold">{summary[emp].assigned.toFixed(3)}</td>
                    <td className="p-4 text-right text-slate-600 font-bold">{summary[emp].returned.toFixed(3)}</td>
                    <td className={`p-4 text-right font-black bg-amber-50/30 ${bal > 0 ? "text-red-600" : "text-emerald-600"}`}>{bal.toFixed(3)} g</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* === MOBILE & MEDIUM GRID CARDS === */}
        <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
          {subTab !== "SUMMARY" ? filteredData.map((r) => (
            <div key={r.id + r.orderId} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDateTime(r.assignedDate)}</span>
                <span className="bg-slate-100 px-2 py-1 rounded text-[10px] font-mono font-bold text-slate-600">#{r.orderId}</span>
              </div>
              <h4 className="font-black text-slate-900 text-lg leading-tight mb-1">{r.employeeName}</h4>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-tighter mb-5">{r.ornamentCategory}</p>
              
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-xl">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{subTab === "ASSIGNMENT" ? "Raw Wt" : "Return Wt"}</p>
                  <p className="text-base font-black text-slate-900">{num(r.rawMaterialWeight || r.returnedWeight).toFixed(3)}g</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">{subTab === "ASSIGNMENT" ? "Purity" : "Net Wt"}</p>
                  <p className="text-base font-black text-slate-900">
                    {subTab === "ASSIGNMENT" ? `${num(r.purity || r.rawMaterialPurity)}%` : `${(num(r.returnedWeight) + num(r.wastage)).toFixed(3)}g`}
                  </p>
                </div>
              </div>
            </div>
          )) : Object.keys(summary).map((emp) => (
            <div key={emp} className="bg-white p-5 rounded-2xl border-l-4 border-l-amber-500 shadow-sm">
              <h4 className="font-black text-slate-900 text-lg mb-4">{emp}</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase">Total Issued</span>
                  <span className="font-black text-slate-700">{summary[emp].assigned.toFixed(3)}g</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-400 uppercase">Total Returned</span>
                  <span className="font-black text-slate-700">{summary[emp].returned.toFixed(3)}g</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="font-black text-amber-800 text-[10px] uppercase">Balance</span>
                  <span className={`text-lg font-black ${(summary[emp].assigned - summary[emp].returned) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {(summary[emp].assigned - summary[emp].returned).toFixed(3)}g
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filteredData.length === 0 && subTab !== "SUMMARY" && (
            <div className="col-span-full py-20 text-center text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <ClipboardList className="w-12 h-12 opacity-10" />
                <p className="font-bold text-sm">No records found for current filters.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* MODALS & OVERLAYS */}
    {filterOpen && (
      <ModalWrapper open={filterOpen} onClose={() => setFilterOpen(false)}>
        <div className="p-2">
          <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2">
            <Filter className="w-5 h-5 text-blue-600" /> Filter Reports
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Select Employee</label>
                  <select
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                  >
                    <option value="">All Personnel</option>
                    {employees.map((e) => (<option key={e} value={e}>{e}</option>))}
                  </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Purity (%)</label>
                <select
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={filterPurity}
                    onChange={(e) => setFilterPurity(e.target.value)}
                  >
                    <option value="">All Purities</option>
                    {purities.map((p) => (<option key={p} value={p}>{p}%</option>))}
                  </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Item Category</label>
                <select
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                  >
                    <option value="">All Categories</option>
                    {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">From Date</label>
                <input type="date" className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">To Date</label>
                <input type="date" className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 text-sm font-bold outline-none" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
          </div>
          <div className="flex justify-end gap-3 mt-10 pt-6 border-t border-slate-100">
            <button
              onClick={() => { setFilterEmployee(""); setFilterPurity(""); setFilterCategory(""); setDateFrom(""); setDateTo(""); setFilterOpen(false); }}
              className="px-6 py-2.5 text-slate-400 hover:text-red-600 text-xs font-black uppercase transition-colors"
            >
              Reset
            </button>
            <button
              className="px-8 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-blue-200 active:scale-95 transition-all"
              onClick={() => setFilterOpen(false)}
            >
              Apply Filters
            </button>
          </div>
        </div>
      </ModalWrapper>
    )}

    <ReportPopup
      open={reportPopupOpen}
      onClose={() => setReportPopupOpen(false)}
      employees={employees}
      loading={pdfLoading}
      onGenerate={async (opts) => {
          const emp = opts.employeeName;
          const assigned = summary[emp]?.assigned || 0;
          const returned = summary[emp]?.returned || 0;
          setPdfLoading(true);
          await handleGenerateReport({
              ...opts,
              dataB2B: b2bData,
              dataB2J: b2jData,
              topTab,
              summaryAssigned: assigned,
              summaryReturned: returned,
          });
          setPdfLoading(false);
          setReportPopupOpen(false);
      }}
    />
  </div>
);
}

// ------------------------------------------------------
// PDF GENERATOR (EXACT SAME AS ORIGINAL)
// ------------------------------------------------------

const LOGO_PATH = "/kc2.png";

const dt = (ts) => {
  if (!ts?.seconds) return "—";
  return new Date(ts.seconds * 1000).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

export async function handleGenerateReport({
  employeeName,
  type,
  from,
  to,
  dataB2B,
  dataB2J,
  topTab,
  summaryAssigned,
  summaryReturned,
}) {
  const src = topTab === "B2B" ? dataB2B : dataB2J;

  let logs = src.filter((x) => x.employeeName === employeeName);

  if (type !== "SUMMARY") {
    logs = logs.filter((x) => x.transactionType?.includes(type));
  }

  if (from) {
    const t = new Date(from).getTime();
    logs = logs.filter((x) => x.assignedDate?.seconds * 1000 >= t);
  }

  if (to) {
    const t = new Date(to).getTime();
    logs = logs.filter((x) => x.assignedDate?.seconds * 1000 <= t);
  }

  if (logs.length === 0) {
    alert("No logs found for this filter.");
    return;
  }

  logs.sort(
    (a, b) => (b.assignedDate?.seconds || 0) - (a.assignedDate?.seconds || 0)
  );

  const pdf = new jsPDF("p", "mm", "a4");

  pdf.setTextColor(230, 230, 230);
  pdf.setFontSize(38);
  pdf.text("Keshava Jewellers", 35, 150, {
    angle: 45,
  });

  pdf.setTextColor(0, 0, 0);

  let logo;
  try {
    const img = await fetch(LOGO_PATH);
    const blob = await img.blob();
    logo = await convertBlobToBase64(blob);
  } catch (err) {
    console.warn("Logo not found. Skipping.");
  }

  pdf.setFontSize(14);
  pdf.text(`Employee: ${employeeName}`, 14, 50);
  pdf.text(`Report Type: ${type} (${topTab})`, 14, 58);
  pdf.text(`Generated On: ${new Date().toLocaleString("en-IN")}`, 14, 66);

  pdf.setLineWidth(0.5);
  pdf.line(14, 72, 196, 72);

  let tableHeaders = [];
  let tableRows = [];

  if (type === "ASSIGNMENT") {
    if (topTab === "B2B") {
      tableHeaders = [
        "Date Time",
        "Order",
        "Category",
        "Raw Wt (g)",
        "Purity (%)",
        "Advance Cash",
      ];
      tableRows = logs.map((r) => [
        dt(r.assignedDate),
        r.orderId,
        r.ornamentCategory,
        num(r.rawMaterialWeight).toFixed(3),
        r.purity || r.rawMaterialPurity || 0,
        "Rs." + (r.advanceCashPaid || 0),
      ]);
    } else {
      tableHeaders = [
        "Date Time",
        "Order",
        "Category",
        "Raw Wt (g)",
        "Purity (%)",
        "Effective (g)",
        "Advance Cash",
      ];
      tableRows = logs.map((r) => {
        const rawWt = num(r.rawMaterialWeight);
        const pur = num(r.rawMaterialPurity || r.purity);
        const eff = r.effectiveGoldAssigned ?? ((rawWt * pur) / 100);
        return [
          dt(r.assignedDate),
          r.orderId,
          r.ornamentCategory,
          rawWt.toFixed(3),
          pur,
          num(eff).toFixed(3),
          "Rs." + (r.advanceCashPaid || 0),
        ];
      });
    }
  }

  if (type === "RETURN") {
    if (topTab === "B2B") {
      tableHeaders = [
        "Date",
        "Order",
        "Category",
        "Purity",
        "Returned (g)",
        "Wastage (g)",
        "Net Weight (g)",
        "Stone",
      ];
      tableRows = logs.map((r) => {
        const retWt = num(r.returnedWeight);
        const wastage = num(r.wastage);
        const netWt = retWt + wastage;
        return [
          dt(r.assignedDate),
          r.orderId,
          r.ornamentCategory,
          r.purity,
          retWt.toFixed(3),
          wastage.toFixed(3),
          netWt.toFixed(3),
          "Rs." + (r.stoneCharges || 0),
        ];
      });
    } else {
      tableHeaders = [
        "Date",
        "Order",
        "Category",
        "Purity",
        "Returned (g)",
        "Effective (g)",
        "Stone",
      ];
      tableRows = logs.map((r) => {
        const retWt = num(r.returnedWeight);
        const pur = num(r.purity);
        const eff = r.effectiveGoldReturned ?? ((retWt * pur) / 100);
        return [
          dt(r.assignedDate),
          r.orderId,
          r.ornamentCategory,
          pur,
          retWt.toFixed(3),
          num(eff).toFixed(3),
          "Rs." + (r.stoneCharges || 0),
        ];
      });
    }
  }

  if (type === "SUMMARY") {
      if (topTab === "B2B") {
        tableHeaders = [
           "Date Time",
           "Order",
           "Category",
           "Assigned (g)",
           "Returned + Wastage (g)"
        ];
        tableRows = logs.map(r => {
           let assigned = 0;
           let returned = 0;
           if (r.transactionType?.includes("ASSIGNMENT")) assigned = num(r.rawMaterialWeight);
           if (r.transactionType?.includes("RETURN")) returned = num(r.returnedWeight) + num(r.wastage);

           return [
              dt(r.assignedDate || r.dateReturned),
              r.orderId || "-",
              r.ornamentCategory || "-",
              assigned ? assigned.toFixed(3) : "-",
              returned ? returned.toFixed(3) : "-"
           ];
        });
      } 
      else {
        tableHeaders = [
          "Date Time",
          "Order",
          "Category",
          "Assigned (Eff g)",
          "Returned (Eff g)"
       ];
       tableRows = logs.map(r => {
          let assigned = 0;
          let returned = 0;
          const pur = num(r.purity || r.rawMaterialPurity);
          
          if (r.transactionType?.includes("ASSIGNMENT")) {
             assigned = r.effectiveGoldAssigned || ((num(r.rawMaterialWeight) * pur) / 100);
          }
          if (r.transactionType?.includes("RETURN")) {
             returned = r.effectiveGoldReturned || ((num(r.returnedWeight) * pur) / 100);
          }

          return [
             dt(r.assignedDate || r.dateReturned),
             r.orderId || "-",
             r.ornamentCategory || "-",
             assigned ? num(assigned).toFixed(3) : "-",
             returned ? num(returned).toFixed(3) : "-"
          ];
       });
      }
  }

  autoTable(pdf, {
    startY: 75,
    head: [tableHeaders],
    body: tableRows,
    styles: { fontSize: 10 },
    headStyles: {
      fillColor: [123, 75, 42],
      textColor: 255,
    },
  });

  const totalAssigned = num(summaryAssigned);
  const totalReturned = num(summaryReturned);
  const balance = totalAssigned - totalReturned;
  const finalY = pdf.lastAutoTable.finalY + 10;

  pdf.setFontSize(12);
  pdf.text("Grand Totals", 14, finalY);

  pdf.setFontSize(10);
  if (topTab === "B2B") {
    pdf.text(`Total Assigned Weight: ${totalAssigned.toFixed(3)} g`, 14, finalY + 8);
    pdf.text(`Total Returned (incl. Wastage): ${totalReturned.toFixed(3)} g`, 14, finalY + 16);
    pdf.text(`Pending Balance: ${balance.toFixed(3)} g`, 14, finalY + 24);
  } else {
    pdf.text(`Total Effective Assigned: ${totalAssigned.toFixed(3)} g`, 14, finalY + 8);
    pdf.text(`Total Effective Returned: ${totalReturned.toFixed(3)} g`, 14, finalY + 16);
    pdf.text(`Pending Gold Balance: ${balance.toFixed(3)} g`, 14, finalY + 24);
  }

  pdf.text(`Amount Balance: Rs__________`, 14, finalY + 32);

  pdf.text("Owner Signature: ____________________", 14, finalY + 50);
  pdf.text("Employee Signature: ____________________", 14, finalY + 65);

  pdf.setFontSize(9);
  pdf.setTextColor(120);
  pdf.text("Reports Provided by Elv8", 105, 290, { align: "center" });

  pdf.save(`${employeeName}_${type}_${topTab}_report.pdf`);
}

function convertBlobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}