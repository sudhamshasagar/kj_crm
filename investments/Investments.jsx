import React, { useState, useEffect, useMemo,Suspense } from "react";
import {
Briefcase, Settings, Trash2, X,Banknote, Coins, Edit2, TrendingUp, ShieldCheck,UploadCloud, Search, FileText, Plus,  ArrowRight,  Users, Save,
 ArrowLeft,MessageCircle,Loader2,ChevronRight, Share2,Award,Layers,XCircle,Printer,ChevronDown,EyeOff,Eye,
  User2,
  Upload} from "lucide-react";
import { useAuth } from "../../AuthContext";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where,
  serverTimestamp, onSnapshot, orderBy, runTransaction,getDoc,limit,startAfter
} from "firebase/firestore";
import toast from "react-hot-toast";
import { performInvestmentBackup } from "../../utils/backupService";
import { generateInvestorExcelReport, notifyAuditEmail } from "../../utils/investorAuditService";
import PasscodeModal from "../common/PasscodeModal";
import NewInvestmentModal from "./NewInvestmentModal";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import QRCode from "qrcode";

// ============================================================================
// CONFIGURATION
// ============================================================================
const COMPANY_DETAILS = {
  name: "KESHAV JEWELLERS",
  subName: "MKS JEWELS PRIVATE LIMITED", 
  address: "Tilak Road, Sagara - 577401",
  phone: "+91 9448319501",
  gstin: "29AARCM3452G1Z3",
  cin: "U32111KA2023PTC179339"
};

// ============================================================================
// 0. HELPER: NUMBER TO WORDS (Simple Version)
// ============================================================================
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

const generateQRCodeDataURL = async (text) => {
  try {
    return await QRCode.toDataURL(text, {
      width: 140,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff"
      }
    });
  } catch (err) {
    console.error("QR generation failed", err);
    return null;
  }
};


// ============================================================================
// 1. ADD TRANSACTION MODAL (Updated)
// ============================================================================
const AddTransactionModal = ({ open, onClose, investment, onConfirm, existingTransactions = [] }) => {
  const { db } = useAuth();
  const [val, setVal] = useState("");
  const [cashPaid, setCashPaid] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [mode, setMode] = useState("CASH");
  const [installment, setInstallment] = useState("");
  const [reference, setReference] = useState(""); // This holds the suggestion or manual entry
  const [loadingId, setLoadingId] = useState(false);
  const [goldRate, setGoldRate] = useState("");


  const isSIP = investment?.schemeType === "SIP";
  const duration = investment?.durationMonths || 12;
  const installmentOptions = Array.from({ length: duration }, (_, i) => i + 1);

  // --- STEP 1: FETCH NEXT P-REF ONLY ON OPEN ---
  useEffect(() => {
    if (open) {
      const getRef = async () => {
        setLoadingId(true);
        try {
          const counterRef = doc(db, "METADATA", "counters");
          const counterSnap = await getDoc(counterRef);
          let nextNum = 500;
          if (counterSnap.exists() && counterSnap.data().pRef) {
            nextNum = counterSnap.data().pRef + 1;
          }
          // Pre-fill the reference state with the suggestion
          setReference(`P${nextNum}`);
        } catch (e) {
          console.error("Failed to fetch P-Ref counter", e);
        } finally {
          setLoadingId(false);
        }
      };
      getRef();
    } else {
      // Reset fields when closing
      setVal("");
      setCashPaid("");
      setReference("");
    }
  }, [open, db]);
    useEffect(() => {
    if (!open) {
      setGoldRate("");
    }
  }, [open]);

  useEffect(() => {
  if (!isSIP && goldRate > 0 && cashPaid > 0) {
    const grams = Number(cashPaid) / Number(goldRate);
    setVal(grams.toFixed(3)); // auto-fill grams
  }
}, [goldRate, cashPaid, isSIP]);


  // --- STEP 2: AUTO INSTALLMENT ---
  useEffect(() => {
    if (open && isSIP) {
      let maxInst = 0;
      if (existingTransactions?.length > 0) {
        existingTransactions.forEach(t => {
          const instNum = Number(t.installment);
          if (!isNaN(instNum) && instNum > maxInst) maxInst = instNum;
        });
      }
      setInstallment(maxInst + 1);
    }
  }, [open, isSIP, existingTransactions]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!isSIP) {
      if (!goldRate || goldRate <= 0) {
        return toast.error("Enter Today's Gold Rate");
      }
      if (!cashPaid || cashPaid <= 0) {
        return toast.error("Enter Amount Paid");
      }
      if (!val || val <= 0) {
        return toast.error("Invalid Gold Weight");
      }
    }

    if (isSIP) {
      if (!val || val <= 0) return toast.error("Invalid Amount");
      if (!installment) return toast.error("Select Installment Month");
    }

    const payload = {
      primaryVal: Number(val),
      cashPaid: isSIP ? Number(val) : Number(cashPaid),
      date,
      mode,
      installment: isSIP ? installment : null,
      reference
    };

    onConfirm(payload);
  };


  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-[2rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header - Reduced Padding */}
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-50">
          <h3 className="font-black text-gray-800 tracking-tight">
            Add {isSIP ? "Payment" : "Gold Credit"}
          </h3>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-gray-400"/>
          </button>
        </div>
        <div className="p-5 space-y-3">
          {/* Reference: Compact Box */}
          <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 focus-within:border-amber-400 transition-all">
            <div className="flex justify-between items-center mb-0.5">
              <label className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Receipt Reference</label>
              {loadingId && <Loader2 className="w-3 h-3 animate-spin text-amber-600" />}
            </div>
            <div className="relative flex items-center">
              <Edit2 className="w-3.5 h-3.5 text-amber-400 absolute left-0" />
              <input
                type="text"
                className="w-full bg-transparent pl-5 border-none outline-none font-mono font-bold text-amber-800 text-sm"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>
          </div>
          {!isSIP && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Gold Rate</label>
                <input
                  type="number"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-sm focus:border-amber-500 outline-none transition-all"
                  value={goldRate}
                  onChange={e => setGoldRate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Cash Paid</label>
                <input
                  type="number"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-sm focus:border-amber-500 outline-none transition-all"
                  value={cashPaid}
                  onChange={e => setCashPaid(e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter flex justify-between">
                  Weight (Grams)
                  <span className="text-amber-600 font-medium">auto</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-black text-amber-700 outline-none focus:border-amber-500 transition-all"
                  value={val}
                  onChange={e => setVal(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Mode</label>
              <select 
                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-xs outline-none focus:border-amber-500 appearance-none bg-white" 
                value={mode} 
                onChange={e => setMode(e.target.value)}
              >
                <option value="CASH">CASH</option>
                <option value="UPI">UPI</option>
                <option value="HDFC">BANK</option>
              </select>
            </div>
            
            {isSIP ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Month</label>
                <select 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-xs outline-none focus:border-amber-500 appearance-none bg-white" 
                  value={installment} 
                  onChange={e => setInstallment(e.target.value)}
                >
                  {installmentOptions.map(num => <option key={num} value={num}>M-{num}</option>)}
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Date</label>
                <input 
                  type="date" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-[11px] outline-none" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                />
              </div>
            )}
          </div>
          {isSIP && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Amount (₹)</label>
                <input
                  type="number"
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-black text-sm outline-none focus:border-amber-500 transition-all"
                  value={val}
                  onChange={e => setVal(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Date</label>
                <input 
                  type="date" 
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg font-bold text-[11px] outline-none" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                />
              </div>
            </div>
          )}
        </div>
        {/* Action Buttons - Compact */}
        <div className="flex p-4 pt-2 gap-2">
          <button 
            onClick={onClose} 
            className="flex-1 py-2.5 bg-gray-50 text-gray-400 rounded-xl text-[11px] font-black uppercase tracking-wider hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit} 
            className="flex-[2] py-2.5 bg-amber-600 text-white rounded-xl text-[11px] font-black uppercase tracking-wider shadow-md hover:bg-amber-700 active:scale-95 transition-all"
          >
            Confirm Payment
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. EDIT TRANSACTION MODAL
// ============================================================================
const EditTransactionModal = ({ open, onClose, transaction, investment, onConfirm }) => {
  const [val, setVal] = useState("");
  const [cashPaid, setCashPaid] = useState("");
  const [date, setDate] = useState("");
  const [mode, setMode] = useState("CASH");
  const [installment, setInstallment] = useState("");
  const [reference, setReference] = useState("");

  const isSIP = investment?.schemeType === "SIP";
  const duration = investment?.durationMonths || 12;
  const installmentOptions = Array.from({ length: duration }, (_, i) => i + 1);

  useEffect(() => {
    if (transaction && open) {
      setVal(isSIP ? transaction.amount : transaction.grams);
      setCashPaid(transaction.amountPaid || "");
      setDate(transaction.date);
      setMode(transaction.mode);
      setInstallment(transaction.installment || "");
      setReference(transaction.reference || "");
    }
  }, [transaction, open, isSIP]);

  if (!open || !transaction) return null;

  const handleSubmit = () => {
    if (!val || val <= 0) return toast.error(isSIP ? "Invalid Amount" : "Invalid Weight");
    if (!isSIP && (!cashPaid || cashPaid <= 0)) return toast.error("Enter Amount Paid");

    const payload = {
      id: transaction.id,
      oldData: transaction,
      primaryVal: Number(val),
      cashPaid: isSIP ? Number(val) : Number(cashPaid),
      date,
      mode,
      installment: isSIP ? installment : null,
      reference: reference
    };

    onConfirm(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-200">
        <h3 className="font-bold text-lg mb-4 text-gray-800">Edit Transaction</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">
              {isSIP ? "Installment Amount (₹)" : "Weight (Grams)"}
            </label>
            <input
              type="number"
              autoFocus
              className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
              value={val}
              onChange={e => setVal(e.target.value)}
            />
          </div>

          {!isSIP && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Amount Paid (₹)</label>
              <input
                type="number"
                className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
                value={cashPaid}
                onChange={e => setCashPaid(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">
              Payment Reference / ID
            </label>
            <input
              type="text"
              placeholder="e.g. UPI Ref"
              className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500"
              value={reference}
              onChange={e => setReference(e.target.value)}
            />
          </div>

          {isSIP && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Installment Month</label>
              <select className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500 bg-white" value={installment} onChange={e => setInstallment(e.target.value)}>
                <option value="">Select Month</option>
                {installmentOptions.map(num => (
                  <option key={num} value={num}>Month {num}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Payment Mode</label>
            <select className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500 bg-white" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="CASH">CASH</option>
              <option value="UPI">UPI</option>
              <option value="HDFC">HDFC BANK</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
            <input type="date" className="w-full mt-1 p-2 border rounded-lg outline-none focus:border-amber-500" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-200">Cancel</button>
          <button onClick={handleSubmit} className="flex-1 py-2 bg-amber-600 text-white rounded-lg text-sm font-bold hover:bg-amber-700 shadow-md">
            Update
          </button>
        </div>
      </div>
    </div>
  );
};

const BulkImportModal = ({ open, onClose, investment, onConfirm }) => {
  const [mode, setMode] = useState("SELECT");
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (open) {
      setMode("SELECT");
      // Initialize with reference field
      setRows([{ date: "", val: "", cashPaid: "", mode: "CASH", installment: "", reference: "" }]);
    }
  }, [open]);

  if (!open) return null;

  const isSIP = investment.schemeType === "SIP";

  const addRow = () => setRows([...rows, { date: "", val: "", cashPaid: "", mode: "CASH", installment: "", reference: "" }]);

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;
    setRows(newRows);
  };

  const removeRow = (index) => {
    const newRows = rows.filter((_, i) => i !== index);
    setRows(newRows);
  };

  // --- CSV HANDLERS ---
  const downloadTemplate = () => {
    const headers = isSIP
      ? "Date,Amount,Mode,InstallmentMonth,Reference"
      : "Date,Weight_Grams,Amount_Paid,Mode,Reference";

    const sample = isSIP
      ? `2023-10-01,5000,CASH,1,REF123\n2023-11-01,5000,UPI,2,UPI987`
      : `2023-10-01,1.5,8500,CASH,BILL001\n2023-11-05,2.0,11000,UPI,UPI456`;

    const blob = new Blob([`${headers}\n${sample}`], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template_${isSIP ? 'SIP' : 'GOLD'}.csv`;
    a.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l);

      const parsedRows = lines.slice(1).map(line => {
        const cols = line.split(",");
        if (isSIP) {
          // CSV: Date, Amount, Mode, Month, Reference
          return {
            date: cols[0] || "",
            val: cols[1] || "",
            cashPaid: "",
            mode: cols[2]?.toUpperCase() || "CASH",
            installment: cols[3] || "",
            reference: cols[4] || "" // Parsing Ref
          };
        } else {
          // CSV: Date, Weight, Paid, Mode, Reference
          return {
            date: cols[0] || "",
            val: cols[1] || "",
            cashPaid: cols[2] || "",
            mode: cols[3]?.toUpperCase() || "CASH",
            installment: "",
            reference: cols[4] || "" // Parsing Ref
          };
        }
      });

      setRows(parsedRows);
      setMode("CSV_PREVIEW");
    };
    reader.readAsText(file);
  };

  const handleSubmit = () => {
    const validRows = rows.filter(r => r.date && r.val > 0);
    if (validRows.length === 0) return toast.error("No valid data found to import");

    const payload = validRows.map(r => ({
      primaryVal: Number(r.val),
      cashPaid: isSIP ? Number(r.val) : Number(r.cashPaid || 0),
      date: r.date,
      mode: r.mode || "CASH",
      installment: isSIP ? r.installment : null,
      reference: r.reference || "" // Include in payload
    }));

    onConfirm(payload);
  };

  // --- RENDER CONTENT BASED ON MODE ---
  const renderContent = () => {
    if (mode === "SELECT") {
      return (
        <div className="flex flex-col gap-4 py-8">
          <button
            onClick={() => setMode("MANUAL")}
            className="flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-amber-500 hover:bg-amber-50 transition-all group text-left"
          >
            <div className="bg-amber-100 p-3 rounded-full mr-4 group-hover:bg-amber-200">
              <Edit2 className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">Manual Entry</h4>
              <p className="text-xs text-gray-500">Fill details row by row manually.</p>
            </div>
            <ArrowRight className="ml-auto w-5 h-5 text-gray-300 group-hover:text-amber-600" />
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400">OR</span></div>
          </div>

          <div className="flex items-center p-4 border-2 border-gray-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group text-left relative cursor-pointer">
            <input
              type="file"
              accept=".csv"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={handleFileUpload}
            />
            <div className="bg-blue-100 p-3 rounded-full mr-4 group-hover:bg-blue-200">
              <UploadCloud className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <h4 className="font-bold text-gray-800">Upload CSV File</h4>
              <p className="text-xs text-gray-500">Import from Excel/Sheets (Comma separated).</p>
            </div>
            <ArrowRight className="ml-auto w-5 h-5 text-gray-300 group-hover:text-blue-600" />
          </div>

          <div className="text-center mt-2">
            <button onClick={downloadTemplate} className="text-xs text-blue-600 underline hover:text-blue-800">
              Download Sample Template
            </button>
          </div>
        </div>
      );
    }

    // SHARED TABLE VIEW (For Manual & CSV Preview)
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-amber-50 p-2 text-xs text-amber-800 rounded mb-2 flex justify-between items-center">
          <span>{mode === "CSV_PREVIEW" ? "Review imported data before saving." : "Add rows manually."}</span>
          {mode === "CSV_PREVIEW" && <span className="font-bold">{rows.length} Rows Loaded</span>}
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 font-bold text-xs uppercase sticky top-0 z-10">
              <tr>
                <th className="p-2">Date (YYYY-MM-DD)</th>
                <th className="p-2">{isSIP ? 'Amount (₹)' : 'Weight (g)'}</th>
                {!isSIP && <th className="p-2">Paid (₹)</th>}
                <th className="p-2">Mode</th>
                <th className="p-2">Reference</th>
                {isSIP && <th className="p-2">Month</th>}
                <th className="p-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row, idx) => (
                <tr key={idx}>
                  <td className="p-2"><input type="text" placeholder="YYYY-MM-DD" value={row.date} onChange={e => updateRow(idx, 'date', e.target.value)} className="w-full border rounded p-1" /></td>
                  <td className="p-2"><input type="number" placeholder="0.00" value={row.val} onChange={e => updateRow(idx, 'val', e.target.value)} className="w-full border rounded p-1" /></td>

                  {!isSIP && (
                    <td className="p-2"><input type="number" placeholder="₹ Paid" value={row.cashPaid} onChange={e => updateRow(idx, 'cashPaid', e.target.value)} className="w-full border rounded p-1 bg-green-50" /></td>
                  )}

                  <td className="p-2">
                    <select value={row.mode} onChange={e => updateRow(idx, 'mode', e.target.value)} className="w-full border rounded p-1 bg-white">
                      <option value="CASH">CASH</option>
                      <option value="UPI">UPI</option>
                      <option value="HDFC">HDFC</option>
                    </select>
                  </td>
                  <td className="p-2"><input type="text" placeholder="Optional" value={row.reference} onChange={e => updateRow(idx, 'reference', e.target.value)} className="w-full border rounded p-1" /></td>
                  {isSIP && (
                    <td className="p-2"><input type="number" placeholder="1" value={row.installment} onChange={e => updateRow(idx, 'installment', e.target.value)} className="w-full border rounded p-1" /></td>
                  )}
                  <td className="p-2 text-center"><button onClick={() => removeRow(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addRow} className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-600 hover:bg-amber-50 px-3 py-2 rounded-lg transition-colors w-full justify-center border border-dashed border-amber-300">
            <Plus className="w-4 h-4" /> Add Row
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl w-full max-w-4xl p-6 shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4 shrink-0">
          <div className="flex items-center gap-3">
            {mode !== "SELECT" && (
              <button onClick={() => setMode("SELECT")} className="p-1 hover:bg-gray-100 rounded-full"><ArrowLeft className="w-5 h-5 text-gray-500" /></button>
            )}
            <div>
              <h3 className="font-bold text-lg text-gray-800">Bulk Import Transactions</h3>
              <p className="text-xs text-gray-500">{investment.schemeName} ({investment.schemeType})</p>
            </div>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {renderContent()}

        {mode !== "SELECT" && (
          <div className="flex gap-2 mt-6 pt-4 border-t shrink-0">
            <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-200">Cancel</button>
            <button onClick={handleSubmit} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 shadow-md">
              Import {rows.length} Records
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Extra Added Component(Edit Customer: 30-01-2026 Fix)
const EditCustomerModal = ({ open, onClose, customer, onSave }) => {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [city, setCity] = useState("");
  const [dob, setDob] = useState("");

  useEffect(() => {
    if (customer && open) {
      setName(customer.name || "");
      setMobile(customer.mobile || "");
      setCity(customer.city || "");
      setDob(customer.dob || "");
    }
  }, [customer, open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!name || mobile.length !== 10) {
      return toast.error("Valid name & mobile required");
    }

    onSave({
      name,
      mobile,
      city,
      dob
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
        <h3 className="font-bold text-lg mb-4">Edit Customer</h3>

        <div className="space-y-4">
          <input
            className="w-full p-2 border rounded-lg"
            placeholder="Customer Name"
            value={name}
            onChange={e => setName(e.target.value)}
          />

          <input
            className="w-full p-2 border rounded-lg"
            placeholder="Mobile Number"
            value={mobile}
            maxLength={10}
            onChange={e => /^\d*$/.test(e.target.value) && setMobile(e.target.value)}
          />

          <input
            className="w-full p-2 border rounded-lg"
            placeholder="City"
            value={city}
            onChange={e => setCity(e.target.value)}
          />

          <input
            type="date"
            className="w-full p-2 border rounded-lg"
            value={dob}
            onChange={e => setDob(e.target.value)}
          />
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 py-2 bg-gray-100 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 bg-amber-600 text-white rounded-lg"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};


// ============================================================================
// 3. INVESTMENT DETAIL VIEW (Manage Customer)

const InvestmentDetailView = ({  customerId, focusAccountId, onBack }) => {
  const { db, role } = useAuth();
  const [customer, setCustomer] = useState(null);
  const [schemes, setSchemes] = useState([]);
  const [selectedScheme, setSelectedScheme] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  // Modals & Logic State
  const [transModalOpen, setTransModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [transactionToEdit, setTransactionToEdit] = useState(null);
  const [editCustomerOpen, setEditCustomerOpen] = useState(false);
  const [portfolioMenuOpen, setPortfolioMenuOpen] = useState(false);


  const canEdit = role === "Admin";

  // 1. Fetch Customer Profile
  useEffect(() => {
    const fetchCustomer = async () => {
      const q = query(collection(db, "CUSTOMERS"), where("customerId", "==", customerId));
      const snap = await getDocs(q);
      if (!snap.empty) setCustomer({ id: snap.docs[0].id, ...snap.docs[0].data() });
    };
    fetchCustomer();
  }, [customerId, db]);

  // 2. Fetch All Investments
  useEffect(() => {
    const q = query(collection(db, "INVESTMENTS"), where("customerId", "==", customerId));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setSchemes(list);
      
      // Auto-select the first scheme on desktop if none selected
      if (!selectedScheme && list.length > 0) {
        setSelectedScheme(list[0]);
      }
    });
    return () => unsub();
  }, [customerId, db]); // added selectedScheme dependency 

  // Account Badge appears immediately after saving, without needing a refresh
  useEffect(() => {
    if (selectedScheme) {
      const updated = schemes.find(s => s.id === selectedScheme.id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedScheme)) {
        setSelectedScheme(updated);
      }
    }
  }, [schemes, selectedScheme]);


  // 3. Fetch Transactions
  useEffect(() => {
    if (!selectedScheme) return;
    const q = query(
      collection(db, "INVESTMENT_TRANSACTIONS"),
      where("investmentId", "==", selectedScheme.id),
      orderBy("date", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [selectedScheme, db]);

  const sortedTransactions = useMemo(() => {
    let items = [...transactions];
    items.sort((a, b) => {
      const valA = a[sortConfig.key] || "";
      const valB = b[sortConfig.key] || "";
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [transactions, sortConfig]);

  useEffect(() => {
  if (focusAccountId && schemes.length) {
    const account = schemes.find(s => s.id === focusAccountId);
    if (account) setSelectedScheme(account);
  }
}, [focusAccountId, schemes]);

  // --- NEW: PREVIOUS BALANCE LOGIC ---
  

  const handleGenerateCertificate = async () => {
  const baseUrl = window.location.origin;
  const secureLink = `${baseUrl}/view/${selectedScheme.id}`;

  const qrImage = await generateQRCodeDataURL(secureLink);
  if (!qrImage) {
    toast.error("QR Code generation failed");
    return;
  }

  const win = window.open("", "", "width=900,height=1000");

  win.document.write(`
      <html>
        <head>
          <title>Investment Assurance Certificate</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              color: #1f2937;
            }
            .card {
              border: 2px solid #d1d5db;
              border-radius: 16px;
              padding: 32px;
              max-width: 720px;
              margin: auto;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 16px;
            }
            .company h1 {
              margin: 0;
              color: #92400e;
            }
            .meta {
              margin-top: 24px;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
              font-size: 14px;
            }
            .meta div span {
              color: #6b7280;
              font-size: 12px;
            }
            .qr {
              text-align: center;
              margin-top: 24px;
            }
            .terms {
              margin-top: 28px;
              font-size: 13px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 16px;
              border-top: 1px dashed #9ca3af;
              font-size: 11px;
              color: #374151;
            }
          </style>
        </head>

        <body>
          <div class="card">
            <div class="header">
              <div class="company">
                <h1>${COMPANY_DETAILS.name}</h1>
                <p>${COMPANY_DETAILS.address}<br/>
                Ph: ${COMPANY_DETAILS.phone}</p>
                <p style="font-size:11px;">
                  GSTIN: ${COMPANY_DETAILS.gstin}<br/>
                  CIN: ${COMPANY_DETAILS.cin}
                </p>
              </div>
              <div>
                <strong>INVESTMENT ASSURANCE CARD</strong><br/>
                <span style="font-size:11px;">Issued on ${new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <div class="meta">
              <div><span>Customer Name</span><br/><b>${customer.name}</b></div>
              <div><span>Mobile</span><br/><b>XXXXXX${customer.mobile.slice(-4)}</b></div>
              <div><span>Scheme</span><br/><b>${selectedScheme.schemeName}</b></div>
              <div><span>Account No</span><br/><b>${selectedScheme.accountNumber || "N/A"}</b></div>
              <div><span>Investment ID</span><br/><b>${selectedScheme.investmentId}</b></div>
              <div><span>Status</span><br/><b>${selectedScheme.status}</b></div>
            </div>

            <div class="qr">
              <img src="${qrImage}" />
              <p style="font-size:11px; margin-top:6px;">
                Scan to view live statement
              </p>
            </div>

            <div class="terms">
              <strong>Terms & Conditions</strong>
              <ul>
                ${(selectedScheme.terms || [
                  "Investment subject to company policy",
                  "Early closure subject to store rules",
                  "Non-transferable investment"
                ]).map(t => `<li>${t}</li>`).join("")}
              </ul>
            </div>

            <div class="footer">
              <b>Validity Disclaimer</b><br/>
              This investment is subject to company policy and prevailing business conditions.
              This document is not a government security.
              <br/><br/>
              This is a digitally generated certificate and does not require a physical signature.
            </div>
          </div>

          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };


  // Edit modal for customer details
  const handleCustomerUpdate = async (payload) => {
  try {
    const newMobile = payload.mobile;

    // 1️⃣ Check if another customer already has this mobile
    const q = query(collection(db, "CUSTOMERS"), where("mobile", "==", newMobile));
    const snap = await getDocs(q);

    let targetCustomer = null;

    if (!snap.empty) {
      const existing = snap.docs[0];

      // If same customer → normal update
      if (existing.id === customer.id) {
        targetCustomer = { id: existing.id, ...existing.data() };
      } else {
        // 🔴 DIFFERENT CUSTOMER → MERGE REQUIRED
        targetCustomer = { id: existing.id, ...existing.data() };

        // 2️⃣ Move all investments to existing customer
        const invQ = query(
          collection(db, "INVESTMENTS"),
          where("customerId", "==", customer.customerId)
        );

        const invSnap = await getDocs(invQ);

        const updates = invSnap.docs.map(d =>
          updateDoc(doc(db, "INVESTMENTS", d.id), {
            customerId: targetCustomer.customerId,
            customerDocId: targetCustomer.id,
            customerName: targetCustomer.name,
            customerMobile: targetCustomer.mobile
          })
        );

        await Promise.all(updates);

        // 3️⃣ Delete duplicate customer
        await deleteDoc(doc(db, "CUSTOMERS", customer.id));

        toast.success("Customer merged with existing mobile");

        // Refresh UI → switch to merged customer
        setCustomer(targetCustomer);
        setEditCustomerOpen(false);
        return;
      }
    }

    // 4️⃣ NORMAL UPDATE (mobile unique)
    await updateDoc(doc(db, "CUSTOMERS", customer.id), {
      name: payload.name,
      mobile: payload.mobile,
      city: payload.city,
      dob: payload.dob || null,
      updatedAt: serverTimestamp()
    });

    // 5️⃣ Sync INVESTMENTS snapshot fields
    const invQ = query(
      collection(db, "INVESTMENTS"),
      where("customerId", "==", customer.customerId)
    );
    const invSnap = await getDocs(invQ);

    const batchUpdates = invSnap.docs.map(d =>
      updateDoc(doc(db, "INVESTMENTS", d.id), {
        customerName: payload.name,
        customerMobile: payload.mobile
      })
    );

    await Promise.all(batchUpdates);

    // 6️⃣ Update local state
    setCustomer(prev => ({
      ...prev,
      name: payload.name,
      mobile: payload.mobile,
      city: payload.city,
      dob: payload.dob || null
    }));

    toast.success("Customer updated");
    setEditCustomerOpen(false);

  } catch (e) {
    console.error(e);
    toast.error("Update failed");
  }
};

  // --- NEW: GENERATE STATEMENT REPORT ---
  const generateStatement = () => {
    const printWindow = window.open('', '', 'width=800,height=900');
    const isSIP = selectedScheme.schemeType === 'SIP';
    
    const rows = sortedTransactions.map(t => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${t.date}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${t.reference || '-'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${t.mode} ${t.installment ? '(Month '+t.installment+')' : ''}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">
          ${t.type === "DEBIT"
            ? "-" + (isSIP ? '₹' + Number(t.amount).toLocaleString() : Number(t.grams).toFixed(3) + ' g')
            : (isSIP ? '₹' + Number(t.amount).toLocaleString() : Number(t.grams).toFixed(3) + ' g')}
        </td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Statement - ${customer.name}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; border-bottom: 2px solid #444; padding-bottom: 20px; }
            .company h1 { margin: 0; color: #b45309; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th { background: #f8f9fa; text-align: left; padding: 12px; border: 1px solid #ddd; font-size: 13px; }
            .summary { margin-top: 40px; width: 350px; margin-left: auto; background: #fefce8; padding: 15px; border-radius: 8px; border: 1px solid #fef08a; }
            .summary-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #fde047; }
            .grand-total { font-weight: bold; font-size: 18px; border: none; color: #92400e; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company">
              <h1>${COMPANY_DETAILS.name}</h1>
              <p>${COMPANY_DETAILS.address}<br>Ph: ${COMPANY_DETAILS.phone}</p>
            </div>
            <div style="text-align: right">
              <h2 style="margin:0">Account Statement</h2>
              <p>Customer: <b>${customer.name}</b><br>Acc No: ${selectedScheme.accountNumber || 'N/A'}</p>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Ref Number</th>
                <th>Description</th>
                <th style="text-align: right">Credit (${isSIP ? 'Amount' : 'Weight'})</th>
              </tr>
            </thead>
            <tbody>
              ${selectedScheme.openingBalance ? `
                <tr style="background: #fafafa; font-style: italic;">
                  <td style="padding: 8px; border: 1px solid #ddd;">-</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">OPENING</td>
                  <td style="padding: 8px; border: 1px solid #ddd;">${selectedScheme.openingBalanceNote || 'Previous Balance'}</td>
                  <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${isSIP ? '₹' : ''}${selectedScheme.openingBalance}${isSIP ? '' : ' g'}</td>
                </tr>
              ` : ''}
              ${rows}
            </tbody>
          </table>
          <div class="summary">
            <div class="summary-row"><span>Opening Balance:</span><span>${isSIP ? '₹' : ''}${selectedScheme.openingBalance || 0}</span></div>
            <div class="summary-row"><span>Scheme Total:</span><span>${isSIP ? '₹'+(selectedScheme.totalInvestedAmount || 0).toLocaleString() : (selectedScheme.totalGramsAccumulated || 0) + ' g'}</span></div>
            <div class="summary-row grand-total"><span>Total Balance:</span><span>${isSIP ? '₹'+((selectedScheme.totalInvestedAmount || 0) + (selectedScheme.openingBalance || 0)).toLocaleString() : ((selectedScheme.totalGramsAccumulated || 0) + (selectedScheme.openingBalance || 0)).toFixed(3) + ' g'}</span></div>
          </div>
          <p style="margin-top: 50px; text-align: center; font-size: 12px; color: #666;">This is a computer-generated account statement.</p>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareLink = async () => {
  try {
    const baseUrl = window.location.origin;

    // 1️⃣ Create secure public token document
    const ref = await addDoc(collection(db, "PUBLIC_INVESTMENTS"), {
      investmentId: selectedScheme.id,
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days expiry
    });

    // 2️⃣ Build secure public URL using token
    const shareUrl = `${baseUrl}/view/${ref.id}`;

    // 3️⃣ Copy to clipboard
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Secure Link Copied! (Valid for 7 days)");

    // 4️⃣ Pre-filled WhatsApp message
    const message =
      `Hello ${customer.name},\n\n` +
      `Your live statement for ${selectedScheme.schemeName} is ready.\n\n` +
      `View securely here: ${shareUrl}\n\n` +
      `⚠️ This link expires in 7 days.\n` +
      `Verify using your registered mobile number.`;

    window.open(
      `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(message)}`,
      "_blank"
    );

  } catch (error) {
    console.error("Public link generation failed:", error);
    toast.error("Failed to generate secure link.");
  }
};

  // --- ACTIONS ---
  const handleAddTransactionClick = () => setTransModalOpen(true);

  const handleFormConfirm = (payload) => {
    setTransModalOpen(false);
    setPendingAction({ type: "ADD_TRANSACTION", payload });
    setPasscodeOpen(true);
  };

  const handleEditClick = (trans) => {
    setTransactionToEdit(trans);
    setEditModalOpen(true);
  };

  const handleEditConfirm = (payload) => {
    setEditModalOpen(false);
    setPendingAction({ type: "EDIT_TRANSACTION", payload });
    setPasscodeOpen(true);
  };

  const handleDeleteClick = (trans) => {
    setPendingAction({ type: "DELETE_TRANSACTION", payload: trans });
    setPasscodeOpen(true);
  };

  const handleCloseAccountClick = () => {
    setPendingAction({ type: "CLOSE_ACCOUNT" });
    setPasscodeOpen(true);
  };

  const handleBulkImportClick = () => setBulkImportOpen(true);
  const handleBulkImportConfirm = (payload) => { setBulkImportOpen(false); setPendingAction({ type: "BULK_IMPORT", payload }); setPasscodeOpen(true); };

  const handleWhatsApp = (t) => {
    const isSIP = selectedScheme.schemeType === 'SIP';
    const val = isSIP ? `₹${t.amount}` : `${t.grams}g`;
    const text = `*${COMPANY_DETAILS.name}*\nPayment Receipt\n\nDate: ${t.date}\nScheme: ${selectedScheme.schemeName}\nAccount: ${selectedScheme.accountNumber || 'N/A'}\n\nReceived: *${val}*\nMode: ${t.mode}\n\nThank you!`;
    const url = `https://wa.me/91${customer.mobile}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

const executeAction = async () => {
  if (!selectedScheme) return;
  try {
    const isSIP = selectedScheme.schemeType === "SIP";

    // ==========================================================
    // 1. ADD SINGLE TRANSACTION
    // ==========================================================
    if (pendingAction.type === "ADD_TRANSACTION") {
      const { primaryVal, cashPaid, date, mode, installment, reference } = pendingAction.payload;

      await runTransaction(db, async (transaction) => {
        // --- STEP 1: ALL READS MUST HAPPEN FIRST ---
        const counterRef = doc(db, "METADATA", "counters");
        const invRef = doc(db, "INVESTMENTS", selectedScheme.id);
        
        // Execute all reads
        const counterSnap = await transaction.get(counterRef);
        const invDoc = await transaction.get(invRef);

        if (!invDoc.exists()) throw "Investment document does not exist!";

        // --- STEP 2: CALCULATIONS (Logic) ---
        let nextNum = 500;
        if (counterSnap.exists() && counterSnap.data().pRef) {
          nextNum = counterSnap.data().pRef + 1;
        }
        const autoGeneratedRef = `P${nextNum}`;

        const currentData = invDoc.data();
        const newTotalInvested = (currentData.totalInvestedAmount || 0) + (isSIP ? primaryVal : 0);
        const newTotalGrams = (currentData.totalGramsAccumulated || 0) + (!isSIP ? primaryVal : 0);
        const newTotalPaid = (currentData.totalAmountPaid || 0) + cashPaid;

        // --- STEP 3: ALL WRITES MUST HAPPEN LAST ---
        
        // 3a. Update Counter IF user used the auto-gen ref
        if (reference === autoGeneratedRef) {
          transaction.set(counterRef, { pRef: nextNum }, { merge: true });
        }

        // 3b. Save to INVESTMENT_TRANSACTIONS
        const transRef = doc(collection(db, "INVESTMENT_TRANSACTIONS"));
        transaction.set(transRef, {
          investmentId: selectedScheme.id,
          customerId: selectedScheme.customerId,
          type: "CREDIT",
          amount: isSIP ? primaryVal : 0,
          grams: !isSIP ? primaryVal : 0,
          amountPaid: cashPaid,
          mode: mode,
          installment: installment,
          reference: reference, // Use the reference from modal
          date: date,
          createdAt: serverTimestamp()
        });

        // 3c. Save to ALL_PAYMENTS
        const globalPayRef = doc(collection(db, "ALL_PAYMENTS"));
        transaction.set(globalPayRef, {
          ref: reference,
          source: "Investment",
          amount: cashPaid,
          customerName: customer.name,
          mode: mode,
          date: date,
          createdAt: serverTimestamp()
        });

        // 3d. Update Investment Master document
        transaction.update(invRef, {
          totalInvestedAmount: newTotalInvested,
          totalGramsAccumulated: newTotalGrams,
          totalAmountPaid: newTotalPaid,
          lastTransactionDate: serverTimestamp()
        });
      });
      toast.success("Transaction Added");
      try {
        const sendWhatsApp = httpsCallable(functions, "sendInvestmentReceiptWhatsApp");

        const receiptUrl = await generateAndUploadReceipt({
          id: "temp",
          reference: pendingAction.payload.reference,
          date: pendingAction.payload.date,
          amountPaid: pendingAction.payload.cashPaid,
          mode: pendingAction.payload.mode,
          installment: pendingAction.payload.installment,
          grams: pendingAction.payload.primaryVal
        });

        const result = await sendWhatsApp({
          mobile: customer.mobile,
          customerName: customer.name,
          transactionId: pendingAction.payload.reference,
          accountNumber: selectedScheme.accountNumber,
          schemeName: selectedScheme.schemeName,
          installmentMonth: pendingAction.payload.installment || "-",
          paymentMode: pendingAction.payload.mode,
          amountPaid: pendingAction.payload.cashPaid,
          totalInvested: (selectedScheme.totalInvestedAmount || 0) + pendingAction.payload.cashPaid,
          receiptUrl
        });

        console.log("WHATSAPP RESULT:", result);

      } catch (err) {
        console.error("WhatsApp failed", err);
      }
    }

    // ==========================================================
    // 2. BULK IMPORT (Fixed Read/Write Order)
    // ==========================================================
    if (pendingAction.type === "BULK_IMPORT") {
      const rows = pendingAction.payload;
      await runTransaction(db, async (transaction) => {
        // READS FIRST
        const counterRef = doc(db, "METADATA", "counters");
        const invRef = doc(db, "INVESTMENTS", selectedScheme.id);
        
        const counterSnap = await transaction.get(counterRef);
        const invDoc = await transaction.get(invRef);
        
        const currentData = invDoc.data();
        let currentPRef = counterSnap.exists() && counterSnap.data().pRef ? counterSnap.data().pRef : 499;

        let totalInv = currentData.totalInvestedAmount || 0;
        let totalGrams = currentData.totalGramsAccumulated || 0;
        let totalPaid = currentData.totalAmountPaid || 0;

        // WRITES LAST
        rows.forEach(r => {
          currentPRef++; 
          const autoRef = `P${currentPRef}`;
          
          totalInv += (isSIP ? r.primaryVal : 0);
          totalGrams += (!isSIP ? r.primaryVal : 0);
          totalPaid += r.cashPaid;

          const transRef = doc(collection(db, "INVESTMENT_TRANSACTIONS"));
          transaction.set(transRef, {
            investmentId: selectedScheme.id,
            customerId: selectedScheme.customerId,
            type: "CREDIT",
            amount: isSIP ? r.primaryVal : 0, 
            grams: !isSIP ? r.primaryVal : 0, 
            amountPaid: r.cashPaid,
            mode: r.mode, 
            installment: r.installment, 
            date: r.date,
            reference: autoRef,
            createdAt: serverTimestamp()
          });

          const globalPayRef = doc(collection(db, "ALL_PAYMENTS"));
          transaction.set(globalPayRef, {
            ref: autoRef,
            source: "Investment",
            amount: r.cashPaid,
            customerName: customer.name,
            mode: r.mode,
            date: r.date,
            createdAt: serverTimestamp()
          });
        });

        transaction.update(counterRef, { pRef: currentPRef });
        transaction.update(invRef, { 
          totalInvestedAmount: totalInv, 
          totalGramsAccumulated: totalGrams, 
          totalAmountPaid: totalPaid, 
          lastTransactionDate: serverTimestamp() 
        });
      });
      toast.success(`Imported ${rows.length} records`);
    }

      if (pendingAction.type === "EDIT_TRANSACTION") {
        const { id, oldData, primaryVal, cashPaid, date, mode, installment, reference } = pendingAction.payload;
        await runTransaction(db, async (transaction) => {
          const invRef = doc(db, "INVESTMENTS", selectedScheme.id);
          const invDoc = await transaction.get(invRef);
          if (!invDoc.exists()) throw "Error";
          const currentData = invDoc.data();

          let runningInvested = (currentData.totalInvestedAmount || 0) - (isSIP ? oldData.amount : 0);
          let runningGrams = (currentData.totalGramsAccumulated || 0) - (!isSIP ? oldData.grams : 0);
          let runningPaid = (currentData.totalAmountPaid || 0) - (oldData.amountPaid || 0);

          runningInvested += (isSIP ? primaryVal : 0);
          runningGrams += (!isSIP ? primaryVal : 0);
          runningPaid += cashPaid;

          const transRef = doc(db, "INVESTMENT_TRANSACTIONS", id);
          transaction.update(transRef, {
            amount: isSIP ? primaryVal : 0,
            grams: !isSIP ? primaryVal : 0,
            amountPaid: cashPaid,
            mode: mode,
            installment: installment,
            date: date,
            reference: reference || null
          });

          transaction.update(invRef, {
            totalInvestedAmount: runningInvested,
            totalGramsAccumulated: runningGrams,
            totalAmountPaid: runningPaid
          });
        });
        toast.success("Transaction Updated");
      }

      if (pendingAction.type === "DELETE_TRANSACTION") {
        const trans = pendingAction.payload;
        await runTransaction(db, async (transaction) => {
          const invRef = doc(db, "INVESTMENTS", selectedScheme.id);
          const invDoc = await transaction.get(invRef);
          if (!invDoc.exists()) throw "Error";
          const currentData = invDoc.data();

          const newTotalInvested = (currentData.totalInvestedAmount || 0) - (isSIP ? trans.amount : 0);
          const newTotalGrams = (currentData.totalGramsAccumulated || 0) - (!isSIP ? trans.grams : 0);
          const newTotalPaid = (currentData.totalAmountPaid || 0) - (trans.amountPaid || 0);

          const transRef = doc(db, "INVESTMENT_TRANSACTIONS", trans.id);
          transaction.delete(transRef);

          transaction.update(invRef, {
            totalInvestedAmount: newTotalInvested > 0 ? newTotalInvested : 0,
            totalGramsAccumulated: newTotalGrams > 0 ? newTotalGrams : 0,
            totalAmountPaid: newTotalPaid > 0 ? newTotalPaid : 0
          });
        });
        toast.success("Transaction Deleted");
      }

      if (pendingAction.type === "CLOSE_ACCOUNT") {
        await updateDoc(doc(db, "INVESTMENTS", selectedScheme.id), {
          status: "CLOSED",
          closedDate: serverTimestamp()
        });
        toast.success("Account Closed");
      }

    } catch (e) {
      console.error(e);
      toast.error("Operation Failed");
    } finally {
      setPendingAction(null);
    }
  };

  const handlePrintReceipt = (t) => {
  const printWindow = window.open('', '', 'width=400,height=600');
  const isSIP = selectedScheme.schemeType === 'SIP';
  const cashVal = t.amountPaid || (isSIP ? t.amount : 0);
  const amountInWords = numberToWords(cashVal);
  const currentBalanceSIP = selectedScheme.totalInvestedAmount || 0;
  const currentWeightGold = selectedScheme.totalGramsAccumulated || 0;
  const currentPaidGold = selectedScheme.totalAmountPaid || 0;

  if (t.type === "DEBIT") {
  alert("Receipt not available for redemption transactions");
  return;
}

  printWindow.document.write(`
    <html>
      <head>
        <title>Receipt #${t.id.slice(0, 6)}</title>
        <style>
          @page { size: 72mm auto; margin: 0; }

          body {
            font-family: Arial, Helvetica, sans-serif;
            width: 70mm;
            margin: 5mm auto;
            font-size: 12px;
            font-weight: 600;
            color: #000;
            text-align: center;
          }

          .logo {
            margin-bottom: 6px;
          }

          .logo img {
            max-width: 60px;
          }

          .header {
            margin-bottom: 8px;
            border-bottom: 2px dashed #000;
            padding-bottom: 6px;
          }

          .title {
            font-size: 15px;
            font-weight: 800;
            letter-spacing: 0.5px;
          }

          .sub-title {
            font-size: 10px;
            font-weight: 600;
            margin-top: 2px;
          }

          .receipt-title {
            margin: 6px 0;
            font-size: 12px;
            font-weight: 800;
            text-decoration: underline;
          }

          .content {
            text-align: left;
            margin-top: 8px;
          }

          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 11px;
          }

          .label {
            font-weight: 700;
          }

          .value {
            font-weight: 700;
            text-align: right;
          }

          .divider {
            border-top: 2px dashed #000;
            margin: 8px 0;
          }

          .amount-box {
            border: 2px solid #000;
            padding: 6px;
            margin: 10px 0;
            font-size: 14px;
            font-weight: 900;
            text-align: center;
          }

          .amount-words {
            font-size: 9px;
            font-style: italic;
            text-align: center;
            margin-bottom: 6px;
          }

          .balance-section {
            margin-top: 8px;
            border-top: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 6px 0;
          }

          .balance-title {
            text-align: center;
            font-size: 11px;
            font-weight: 800;
            margin-bottom: 4px;
          }

          .footer {
            margin-top: 18px;
            font-size: 10px;
            font-weight: 600;
            text-align: center;
          }

          .sign {
            margin-top: 22px;
            border-top: 1px solid #000;
            width: 80%;
            margin-left: auto;
            margin-right: auto;
            padding-top: 4px;
            font-weight: 700;
          }
        </style>
      </head>

      <body>
        <div class="logo">
          <img src="/kc2.png" alt="Company Logo" />
        </div>

        <div class="header">
          <div class="title">${COMPANY_DETAILS.name}</div>
          <div class="sub-title">${COMPANY_DETAILS.subName}</div>
          <div class="sub-title">${COMPANY_DETAILS.address}</div>
          <div class="sub-title">Ph: ${COMPANY_DETAILS.phone}</div>
        </div>

        <div class="receipt-title">PAYMENT RECEIPT</div>
        <div style="font-size:10px; font-weight:700;">Trans ID: #${t.id.slice(0, 8).toUpperCase()}</div>

        <div class="content">
          <div class="row"><span class="label">Date</span><span class="value">${t.date}</span></div>
          <div class="row"><span class="label">Name</span><span class="value">${customer.name}</span></div>
          <div class="row"><span class="label">Scheme</span><span class="value">${selectedScheme.schemeName}</span></div>
          <div class="row"><span class="label">Acc No</span><span class="value">${selectedScheme.accountNumber || 'N/A'}</span></div>

          <div class="divider"></div>

          <div class="row"><span class="label">Ref No</span><span class="value">${t.reference || '-'}</span></div>

          ${isSIP ? `
            <div class="row"><span class="label">Installment</span><span class="value">Month ${t.installment}</span></div>
            <div class="row"><span class="label">Mode</span><span class="value">${t.mode}</span></div>
          ` : `
            <div class="row"><span class="label">Gold Purchased</span><span class="value">${Number(t.grams).toFixed(3)} g</span></div>
            <div class="row"><span class="label">Rate / Paid</span><span class="value">₹${t.amountPaid}</span></div>
            <div class="row"><span class="label">Mode</span><span class="value">${t.mode}</span></div>
          `}

          <div class="amount-box">RECEIVED ₹${cashVal}</div>
          <div class="amount-words">(${amountInWords})</div>

          <div class="balance-section">
            <div class="balance-title">TOTAL ACCOUNT BALANCE</div>
            ${isSIP ? `
              <div class="row"><span class="label">Total Invested</span><span class="value">₹${currentBalanceSIP}</span></div>
            ` : `
              <div class="row"><span class="label">Total Gold</span><span class="value">${Number(currentWeightGold).toFixed(3)} g</span></div>
              <div class="row"><span class="label">Total Paid</span><span class="value">₹${currentPaidGold}</span></div>
            `}
          </div>
        </div>

        <div class="footer">
          <div class="sign">Digital Receipt Provided by elv8.works</div>
          <div style="margin-top:4px;">Thank you!</div>
        </div>

        <script>
          window.print();
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
};

const generateAndUploadReceipt = async (t) => {

  const isSIP = selectedScheme.schemeType === "SIP";
  const cashVal = t.amountPaid || (isSIP ? t.amount : 0);
  const amountInWords = numberToWords(cashVal);

  const currentBalanceSIP = selectedScheme.totalInvestedAmount || 0;
  const currentWeightGold = selectedScheme.totalGramsAccumulated || 0;
  const currentPaidGold = selectedScheme.totalAmountPaid || 0;

  const receiptDiv = document.createElement("div");

  receiptDiv.style.position = "fixed";
  receiptDiv.style.left = "-9999px";
  receiptDiv.style.background = "#fff";

  receiptDiv.innerHTML = `
  <div style="
      font-family: Arial, Helvetica, sans-serif;
      width:270px;
      font-size:12px;
      text-align:center;
      color:#000;
      padding:10px
  ">

    <div style="margin-bottom:6px">
      <img src="/kc2.png" style="width:60px"/>
    </div>

    <div style="border-bottom:2px dashed #000;padding-bottom:6px">
      <div style="font-size:16px;font-weight:800">${COMPANY_DETAILS.name}</div>
      <div style="font-size:10px">${COMPANY_DETAILS.subName}</div>
      <div style="font-size:10px">${COMPANY_DETAILS.address}</div>
      <div style="font-size:10px">Ph: ${COMPANY_DETAILS.phone}</div>
    </div>

    <div style="margin:6px 0;font-weight:800;font-size:13px;text-decoration:underline">
      PAYMENT RECEIPT
    </div>

    <div style="font-size:10px;font-weight:700">
      Trans ID: #${t.id.slice(0,8).toUpperCase()}
    </div>

    <div style="text-align:left;margin-top:8px">

      <div style="display:flex;justify-content:space-between">
        <span>Date</span>
        <span>${t.date}</span>
      </div>

      <div style="display:flex;justify-content:space-between">
        <span>Name</span>
        <span>${customer.name}</span>
      </div>

      <div style="display:flex;justify-content:space-between">
        <span>Scheme</span>
        <span>${selectedScheme.schemeName}</span>
      </div>

      <div style="display:flex;justify-content:space-between">
        <span>Acc No</span>
        <span>${selectedScheme.accountNumber || "N/A"}</span>
      </div>

      <div style="border-top:1px dashed #000;margin:6px 0"></div>

      <div style="display:flex;justify-content:space-between">
        <span>Ref No</span>
        <span>${t.reference || "-"}</span>
      </div>

      ${
        isSIP
        ? `
        <div style="display:flex;justify-content:space-between">
          <span>Installment</span>
          <span>Month ${t.installment}</span>
        </div>

        <div style="display:flex;justify-content:space-between">
          <span>Mode</span>
          <span>${t.mode}</span>
        </div>
        `
        : `
        <div style="display:flex;justify-content:space-between">
          <span>Gold Purchased</span>
          <span>${Number(t.grams).toFixed(3)} g</span>
        </div>

        <div style="display:flex;justify-content:space-between">
          <span>Rate / Paid</span>
          <span>₹${t.amountPaid}</span>
        </div>

        <div style="display:flex;justify-content:space-between">
          <span>Mode</span>
          <span>${t.mode}</span>
        </div>
        `
      }

      <div style="
          border:2px solid #000;
          padding:6px;
          margin:10px 0;
          font-weight:900;
          font-size:14px;
          text-align:center
      ">
        RECEIVED ₹${cashVal}
      </div>

      <div style="font-size:9px;font-style:italic;text-align:center">
        (${amountInWords})
      </div>

      <div style="margin-top:8px;border-top:2px solid #000;border-bottom:2px solid #000;padding:6px 0">

        <div style="text-align:center;font-weight:800;margin-bottom:4px">
          TOTAL ACCOUNT BALANCE
        </div>

        ${isSIP ? `
              <div class="row"><span class="label">Total Invested</span><span class="value">₹${currentBalanceSIP}</span></div>
            ` : `
              <div class="row"><span class="label">Total Gold</span><span class="value">${Number(currentWeightGold).toFixed(3)} g</span></div>
              <div class="row"><span class="label">Total Paid</span><span class="value">₹${currentPaidGold}</span></div>
            `}

      </div>

    </div>

    <div style="margin-top:18px;font-size:10px">
      Digital Receipt Provided by elv8.works<br/>
      Thank you!
    </div>

  </div>
  `;

  document.body.appendChild(receiptDiv);

  const canvas = await html2canvas(receiptDiv, {
    scale: 3,
    useCORS: true
  });

  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [72, 200]
  });

  const imgWidth = 72;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
  const pdfBlob = pdf.output("blob");

  const storage = getStorage();
  const fileRef = ref(storage, `receipts/${t.reference}.pdf`);

  await uploadBytes(fileRef, pdfBlob);

  const url = await getDownloadURL(fileRef);

  document.body.removeChild(receiptDiv);

  return url;
};


const ActionButton = ({ onClick, icon, label, color = "slate", primary = false, disabled = false }) => {
  const styles = {
    slate: "bg-white/60 border-white hover:bg-white hover:shadow-md text-slate-600",
    purple: "bg-purple-50/50 border-purple-100 hover:bg-purple-50 text-purple-600",
    emerald: "bg-emerald-50/50 border-emerald-100 hover:bg-emerald-50 text-emerald-600",
    red: "bg-red-50/50 border-red-100 hover:bg-red-50 text-red-600",
    black: "bg-slate-900 border-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-2.5 px-4 py-2.5 rounded-xl border 
        transition-all duration-200 active:scale-95 
        ${disabled ? "opacity-50 cursor-not-allowed grayscale" : styles[color] || styles.slate}
      `}
    >
      {/* Safety check for the icon */}
      {icon && (
        <span className={`${primary ? "opacity-100" : "opacity-70"} shrink-0`}>
          {React.isValidElement(icon) 
            ? React.cloneElement(icon, { size: 16, strokeWidth: 2.5 }) 
            : icon}
        </span>
      )}
      
      <span className="text-[10px] font-black uppercase tracking-[0.1em] whitespace-nowrap">
        {label}
      </span>
    </button>
  );
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { 
    day: '2-digit', month: 'short', year: 'numeric' 
  }).replace(/ /g, '-');
};

const TableIconBtn = ({ onClick, icon, danger }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-lg transition-all active:scale-90 border ${
      danger 
        ? 'bg-red-50 border-red-100 text-red-500 hover:bg-red-500 hover:text-white' 
        : 'bg-white border-slate-200 text-slate-400 hover:text-slate-900 hover:border-slate-300 shadow-sm'
    }`}
  >
    {React.cloneElement(icon, { size: 16 })}
  </button>
);


const PortfolioTab = ({ s, active, onClick }) => {
  const isClosed = s.status === 'CLOSED'; // Adjust based on your data key

  return (
    <button
      onClick={onClick}
      disabled={active}
      className={`
        group relative flex items-center justify-between gap-4 px-5 py-4 rounded-2xl transition-all duration-300 shrink-0 min-w-[220px] 
        border outline-none
        ${active 
          ? 'bg-white border-indigo-100 shadow-[0_8px_20px_-6px_rgba(79,70,229,0.15)] ring-1 ring-indigo-500/10 -translate-y-1' 
          : 'bg-slate-50/40 border-transparent hover:bg-white hover:border-slate-200'}
        ${isClosed && !active ? 'opacity-60 grayscale' : 'opacity-100'}
      `}
    >
      {/* Background Glows */}
      {active && (
        <div className={`absolute inset-0 rounded-2xl pointer-events-none bg-gradient-to-br ${
          isClosed ? 'from-slate-100 to-transparent' : 'from-indigo-50/50 to-transparent'
        }`} />
      )}

      {/* Left: Info Section */}
      <div className="flex-1 text-left min-w-0 relative z-10">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className={`
              text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md
              ${isClosed 
                ? 'bg-slate-200 text-slate-600' 
                : active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}
            `}>
              {s.schemeType}
            </span>
            <p className={`text-[12px] font-bold truncate tracking-tight ${
              isClosed ? 'text-slate-500 line-through decoration-slate-300' : active ? 'text-slate-900' : 'text-slate-600'
            }`}>
              {s.schemeName}
            </p>
          </div>
          
          <div className="flex items-center gap-1.5">
            <div className={`h-1.5 w-1.5 rounded-full ${
              isClosed ? 'bg-slate-300' : 'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.4)]'
            }`} />
            <p className="text-[10px] font-medium font-mono text-slate-400 tabular-nums uppercase">
              {isClosed ? 'Account Closed' : s.accountNumber || 'Active'}
            </p>
          </div>
        </div>
      </div>

      {/* Right: Balance Section */}
      <div className="text-right shrink-0 relative z-10 flex flex-col items-end">
        <p className={`text-sm font-black tabular-nums tracking-tight ${
          isClosed ? 'text-slate-400' : active ? 'text-indigo-600' : 'text-slate-900'
        }`}>
          {s.schemeType === "SIP" 
            ? `₹${(s.totalInvestedAmount || 0).toLocaleString()}` 
            : `${(s.totalGramsAccumulated || 0).toFixed(3)}g`}
        </p>
        <p className={`text-[9px] font-bold uppercase tracking-[0.1em] ${
          active ? 'text-indigo-300' : 'text-slate-300'
        }`}>
          {isClosed ? 'Final' : 'Balance'}
        </p>
      </div>

      {/* Bottom Indicator Line */}
      {active && (
        <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full ${
          isClosed ? 'bg-slate-400' : 'bg-indigo-500'
        }`} />
      )}
    </button>
  );
};

const TransactionCard = ({ t, isSIP, isDebit, actions }) => (
  <div className="bg-white/80 border border-white rounded-2xl p-4 shadow-sm mb-3">
    <div className="flex justify-between items-start mb-3">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">
          {formatDate(t.date)}
        </p>
        <p className="text-[9px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded w-fit uppercase">
          {t.reference || 'No Ref'}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-black ${isDebit ? 'text-red-500' : 'text-slate-900'}`}>
          {isSIP ? `₹${Number(t.amount || 0).toLocaleString()}` : `${Number(t.grams || 0).toFixed(3)}g`}
        </p>
        <p className="text-[9px] font-bold text-slate-400 italic">Paid: ₹{(t.amountPaid || 0).toLocaleString()}</p>
      </div>
    </div>
    <div className="flex justify-end gap-2 pt-3 border-t border-slate-50">
      {actions}
    </div>
  </div>
);

const handleSetOpeningBalance = async () => {
    if (!canEdit) return;
    const amount = prompt("Enter Previous Balance Amount (₹ or grams):", selectedScheme.openingBalance || "");
    const note = prompt("Enter a note for this balance:", selectedScheme.openingBalanceNote || "Brought Forward");
    
    if (amount !== null) {
      try {
        await updateDoc(doc(db, "INVESTMENTS", selectedScheme.id), {
          openingBalance: Number(amount),
          openingBalanceNote: note
        });
        toast.success("Previous Balance Updated");
      } catch (e) { toast.error("Failed to update"); }
    }
  };

  const openingBalance = Number(selectedScheme?.openingBalance || 0);

  if (!customer) return <div className="p-10 text-center">Loading Profile...</div>;

return (
  <div className="flex flex-col h-screen overflow-hidden dashboard-bg font-sans text-slate-900"> 
    <div className="lg:hidden px-4 py-3 flex items-center justify-between border-b bg-white">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="truncate">
          <p className="text-sm font-semibold truncate">
            {customer?.name}
          </p>

          <button
            onClick={() => setPortfolioMenuOpen(true)}
            className="text-xs text-indigo-600 font-semibold flex items-center gap-1"
          >
            {selectedScheme?.accountNumber || "Select Account"}
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex items-center gap-2 pr-14 md:pr-16 lg:pr-0">
        <button
          onClick={handleAddTransactionClick}
          className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-md"
        >
          Add
        </button>

        <button
          onClick={handleCloseAccountClick}
          className="px-3 py-1.5 text-xs font-semibold bg-red-100 text-red-700 rounded-md"
        >
          Close
        </button>
      </div>
    </div>
    <header className="hidden lg:block bg-white border-b border-slate-200 relative">
      {/* ambient glow */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-indigo-50 blur-[100px] -mr-40 -mt-40 pointer-events-none" />
      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6 relative">
        {/* ===== TOP ROW ===== */}
        <div className="flex items-center justify-between">
          {/* Left : Identity */}
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 rounded-lg border hover:bg-gray-50 transition"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900">
                  {customer?.name}
                </h1>
                <button
                  onClick={() => setEditCustomerOpen(true)}
                  className="text-gray-400 hover:text-indigo-600"
                >
                  <Edit2 size={14}/>
                </button>
              </div>
              <p className="text-xs text-amber-900 font-mono">
                Mobile Number • {customer?.mobile}
              </p>
            </div>
            
          </div>
          {/* Right : Quick Stats + Action */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-8 border-r pr-8">
              <div className="text-right">
                <p className="text-[10px] uppercase text-gray-400 font-semibold">
                  Paid
                </p>
                <p className="text-sm font-semibold">
                  ₹{(selectedScheme?.totalAmountPaid || 0).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase text-gray-400 font-semibold">
                  Target
                </p>
                <p className="text-sm font-semibold text-indigo-600">
                  {selectedScheme?.schemeType === "SIP"
                    ? `₹${selectedScheme?.monthlyAmount}`
                    : `${selectedScheme?.minGrams}g`}
                </p>
              </div>
            </div>
            {selectedScheme?.status !== "CLOSED" ? (
              <button
                onClick={handleAddTransactionClick}
                className="bg-gray-900 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-black transition"
              >
                Add Transaction
              </button>
            ) : (
              <span className="text-xs px-3 py-1 bg-gray-100 rounded-md text-gray-500 font-semibold">
                Account Closed
              </span>
            )}
          </div>
        </div>
        {/* ===== PORTFOLIO VALUE ===== */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 mb-1">
              Portfolio Value
            </p>
            <h2 className="text-4xl font-bold text-gray-900">
              {selectedScheme?.schemeType === "SIP"
                ? `₹${(selectedScheme?.totalInvestedAmount || 0).toLocaleString()}`
                : `${(selectedScheme?.totalGramsAccumulated || 0).toFixed(3)} g`}
            </h2>
          </div>
          {/* Opening Balance */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-full border text-xs">
            <span className="text-gray-400 font-semibold">
              Opening
            </span>
            <span className="font-mono text-gray-900">
              {selectedScheme?.schemeType === "SIP"
                ? `₹${openingBalance.toLocaleString()}`
                : `${openingBalance.toFixed(3)}g`}
            </span>
            {canEdit && (
              <button
                onClick={handleSetOpeningBalance}
                className="text-gray-400 hover:text-indigo-600"
              >
                <Edit2 size={12}/>
              </button>
            )}
          </div>
        </div>
        {/* ===== PORTFOLIOS + TOOLS ===== */}
        <div className="flex items-center justify-between gap-6">
          {/* portfolio selector */}
          <div className="flex gap-3 overflow-x-auto premium-scroll">
            {schemes.map(s => (
              <PortfolioTab
                key={s.id}
                s={s}
                active={selectedScheme?.id === s.id}
                onClick={() => setSelectedScheme(s)}
              />
            ))}
          </div>
          {/* tools */}
          <div className="flex items-center gap-2">
            <ActionButton
              onClick={generateStatement}
              icon={<FileText />}
              label="Statement"
            />
            <ActionButton
              onClick={handleGenerateCertificate}
              icon={<Award />}
              label="Certificate"
            />
            <ActionButton
              onClick={handleBulkImportClick}
              icon={<Upload />}
              label="Import"
            />
            <ActionButton
              onClick={handleShareLink}
              icon={<Share2 />}
              label="Share"
            />
            <ActionButton
              onClick={handleCloseAccountClick}
              icon={<XCircle />}
              label="Close"
              color="red"
              disabled={selectedScheme?.status === "CLOSED"}
            />
          </div>
        </div>
      </div>
    </header>
    {portfolioMenuOpen && (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-end lg:hidden">
        <div className="bg-white w-full rounded-t-3xl p-5 max-h-[70vh] overflow-y-auto premium-scroll">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold">Select Portfolio</h3>
            <button onClick={() => setPortfolioMenuOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="space-y-2">
            {schemes.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setSelectedScheme(s);
                  setPortfolioMenuOpen(false);
                }}
                className="w-full text-left p-4 rounded-xl border hover:bg-gray-50 flex justify-between items-center"
              >
                <div>
                  <p className="text-sm font-semibold">{s.schemeName}</p>
                  <p className="text-xs text-gray-400">
                    {s.accountNumber || "No Account"}
                  </p>
                </div>

                <span className="text-sm font-semibold">
                  {s.schemeType === "SIP"
                    ? `₹${(s.totalInvestedAmount || 0).toLocaleString()}`
                    : `${(s.totalGramsAccumulated || 0).toFixed(3)}g`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    )}

    <main className="flex-1 overflow-y-auto premium-scroll bg-slate-50/30 p-4 md:p-10 pb-24 lg:pb-10">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 bg-indigo-500 rounded-full" />
            <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.3em]">
              Timeline Activity
            </h4>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            {sortedTransactions.length} Records
          </span>
        </div>

        {/* Desktop View: Elegant Ledger */}
        <div className="hidden lg:block bg-white rounded-[1.5rem] border border-slate-200/60 shadow-sm overflow-hidden">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="pl-8 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-left">Date</th>
                <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-left">Reference</th>
                <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right">Cash Out</th>
                <th className="px-6 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right">Asset Gain</th>
                <th className="pr-8 py-4 text-[10px] uppercase font-bold text-slate-400 tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedTransactions.map((t) => (
                <tr key={t.id} className="group hover:bg-indigo-50/30 transition-colors">
                  <td className="pl-8 py-5">
                    <p className="text-sm font-bold text-slate-700">{formatDate(t.date)}</p>
                  </td>
                  <td className="px-6 py-5">
                    <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                      {t.reference || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <p className="text-sm font-semibold text-slate-500 tabular-nums">
                      ₹{(t.amountPaid || 0).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-base font-black tabular-nums ${t.type === 'DEBIT' ? 'text-red-500' : 'text-slate-900'}`}>
                        {t.type === 'DEBIT' ? '-' : '+'}
                        {selectedScheme.schemeType === "SIP" ? `₹${Number(t.amount || 0).toLocaleString()}` : `${Number(t.grams || 0).toFixed(3)}g`}
                      </span>
                    </div>
                  </td>
                  <td className="pr-8 py-5">
                    <div className="flex justify-end gap-1 md:opacity-0 group-hover:opacity-100 transition-all">
                      <TableIconBtn onClick={() => handlePrintReceipt(t)} icon={<Printer size={16} />} tooltip="Receipt" />
                      <TableIconBtn onClick={() => handleWhatsApp(t)} icon={<MessageCircle size={16} />} tooltip="WhatsApp" />
                      <TableIconBtn onClick={() => handleEditClick(t)} icon={<Edit2 size={16} />} tooltip="Edit" />
                      {canEdit && <TableIconBtn onClick={() => handleDeleteClick(t)} icon={<Trash2 size={16} />} danger tooltip="Delete" />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card System */}
        <div className="lg:hidden space-y-4">
          {sortedTransactions.map(t => (
            <div key={t.id} className="bg-white p-5 rounded-[2rem] border border-slate-200/70 shadow-sm active:scale-[0.98] transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{formatDate(t.date)}</p>
                  <p className="text-[11px] font-mono font-bold text-indigo-500 mt-0.5">{t.reference || 'NO REF'}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-black tabular-nums ${t.type === 'DEBIT' ? 'text-red-500' : 'text-slate-900'}`}>
                    {selectedScheme.schemeType === "SIP" ? `₹${Number(t.amount || 0).toLocaleString()}` : `${Number(t.grams || 0).toFixed(3)}g`}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 italic">Paid ₹{(t.amountPaid || 0).toLocaleString()}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                <div className="flex gap-2">
                  <TableIconBtn onClick={() => handlePrintReceipt(t)} icon={<Printer size={16} />} />
                  <TableIconBtn onClick={() => handleWhatsApp(t)} icon={<MessageCircle size={16} />} />
                </div>
                <div className="flex gap-2">
                  <TableIconBtn onClick={() => handleEditClick(t)} icon={<Edit2 size={16} />} />
                  {canEdit && <TableIconBtn onClick={() => handleDeleteClick(t)} icon={<Trash2 size={16} />} danger />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
     <AddTransactionModal open={transModalOpen} onClose={() => setTransModalOpen(false)} investment={selectedScheme} onConfirm={handleFormConfirm} existingTransactions={transactions} />
     <PasscodeModal open={passcodeOpen} onClose={() => { setPasscodeOpen(false); setPendingAction(null); }} actionTitle="confirm action" onSuccess={executeAction} />
     <EditTransactionModal open={editModalOpen} onClose={() => setEditModalOpen(false)} transaction={transactionToEdit} investment={selectedScheme} onConfirm={handleEditConfirm} />
     <BulkImportModal open={bulkImportOpen} onClose={() => setBulkImportOpen(false)} investment={selectedScheme} onConfirm={handleBulkImportConfirm} />
     <EditCustomerModal open={editCustomerOpen} onClose={() => setEditCustomerOpen(false)} customer={customer} onSave={handleCustomerUpdate} />
  </div>
);
};
// ============================================================================
// 1. SCHEME MANAGER COMPONENT (Admin Config - Updated UI & Logic)
// ============================================================================
const SchemeManager = ({ onClose }) => {
  const { db } = useAuth();
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [editingId, setEditingId] = useState(null); // ID of scheme being edited
  const [type, setType] = useState("SIP");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [interest, setInterest] = useState("");
  const [minGrams, setMinGrams] = useState("");

  // Passcode State
  const [passcodeState, setPasscodeState] = useState({ open: false, action: null, title: "" });

  useEffect(() => {
    // Realtime listener for schemes list
    const q = query(collection(db, "SCHEMES"));
    const unsub = onSnapshot(q, (snap) => {
      setSchemes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [db]);

  // Load data into form for editing
  const handleEditClick = (scheme) => {
    setEditingId(scheme.id);
    setType(scheme.type);
    setName(scheme.name);
    setDuration(scheme.durationMonths || "");
    if (scheme.type === "SIP") {
      setMinAmount(scheme.minAmount || "");
      setInterest(scheme.interest || "");
      setMinGrams("");
    } else {
      setMinGrams(scheme.minGrams || "");
      setMinAmount("");
      setInterest("");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setDuration("");
    setMinAmount("");
    setInterest("");
    setMinGrams("");
    setType("SIP");
  };

  const validateAndTriggerPasscode = (actionType, id = null) => {
    // 1. Basic Validation
    if (!name) return toast.error("Scheme Name is required");

    // SIP Validation
    if (type === "SIP") {
      if (!duration) return toast.error("Duration is required for SIP");
      if (!minAmount) return toast.error("Min Amount is required");
    }
    // Gold Validation
    else {
      if (!minGrams) return toast.error("Min Grams required");
      // Duration is optional for Gold as per request
    }

    // 2. Trigger Passcode
    if (actionType === "DELETE") {
      setPasscodeState({ open: true, action: { type: "DELETE", id }, title: "delete scheme" });
    } else {
      const title = editingId ? "update scheme" : "create scheme";
      setPasscodeState({ open: true, action: { type: "SAVE" }, title });
    }
  };

  // 3. ACTUAL DATABASE ACTION (Runs after passcode success)
  const executeDatabaseAction = async () => {
    setLoading(true);
    try {
      const { type: actionType, id } = passcodeState.action;

      if (actionType === "DELETE") {
        await deleteDoc(doc(db, "SCHEMES", id));
        toast.success("Scheme Deleted");
      }
      else if (actionType === "SAVE") {
        const payload = {
          name,
          type,
          durationMonths: duration ? Number(duration) : 0, // 0 if empty (for gold)
          updatedAt: serverTimestamp(),
        };

        if (type === "SIP") {
          payload.minAmount = Number(minAmount);
          payload.interest = Number(interest || 0);
          payload.minGrams = null; // Clear if switching types
        } else {
          payload.minGrams = Number(minGrams);
          payload.minAmount = null;
          payload.interest = null;
        }

        if (editingId) {
          // UPDATE
          await updateDoc(doc(db, "SCHEMES", editingId), payload);
          toast.success("Scheme Updated");
          handleCancelEdit();
        } else {
          // CREATE
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "SCHEMES"), payload);
          toast.success("Scheme Created");
          handleCancelEdit(); // Resets form
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Operation Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border h-full overflow-y-auto premium-scroll">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Scheme Configuration</h2>
          <p className="text-sm text-gray-500">Create, edit or delete investment plans.</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* FORM AREA (CREATE / EDIT) */}
      <div className={`p-6 rounded-xl mb-8 border transition-all ${editingId ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wide flex items-center gap-2">
            {editingId ? <Edit2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editingId ? "Edit Scheme Mode" : "Create New Scheme"}
          </h3>
          {editingId && (
            <button onClick={handleCancelEdit} className="text-xs text-red-600 font-bold hover:underline">Cancel Edit</button>
          )}
        </div>

        {/* TYPE TOGGLE */}
        <div className="flex gap-4 mb-5">
          <button
            onClick={() => setType("SIP")}
            className={`flex-1 py-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${type === "SIP"
                ? "bg-amber-600 text-white shadow-md border-amber-600"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
          >
            <Banknote className="w-4 h-4" /> SIP Structure
          </button>
          <button
            onClick={() => setType("GOLD")}
            className={`flex-1 py-3 rounded-lg border text-sm font-bold flex items-center justify-center gap-2 transition-all ${type === "GOLD"
                ? "bg-amber-600 text-white shadow-md border-amber-600"
                : "bg-white border-gray-200 text-gray-500 hover:bg-gray-100"
              }`}
          >
            <Coins className="w-4 h-4" /> Digital Gold
          </button>
        </div>

        {/* INPUTS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="md:col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase">Scheme Name</label>
            <input
              placeholder="e.g. Gold Plus Saver"
              className="w-full mt-1 p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">
              Duration (Months) {type === "GOLD" && <span className="text-gray-400 font-normal lowercase">(optional)</span>}
            </label>
            <input
              type="number"
              placeholder={type === "GOLD" ? "No limit" : "e.g. 11"}
              className="w-full mt-1 p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          {/* DYNAMIC INPUTS */}
          {type === "SIP" ? (
            <>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase">Min Amount (₹)</label>
                <input
                  type="number"
                  placeholder="e.g. 1000"
                  className="w-full mt-1 p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Interest (%) <span className="text-gray-400 font-normal lowercase">(optional)</span></label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  className="w-full mt-1 p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase">Min Grams</label>
              <input
                type="number"
                placeholder="e.g. 0.5"
                step="0.01"
                className="w-full mt-1 p-3 border rounded-lg text-sm outline-none focus:border-amber-500 bg-white"
                value={minGrams}
                onChange={(e) => setMinGrams(e.target.value)}
              />
            </div>
          )}
        </div>

        <button
          onClick={() => validateAndTriggerPasscode("SAVE")}
          disabled={loading}
          className={`w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all ${editingId ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-900 hover:bg-black text-white'}`}
        >
          {loading ? "Processing..." : (editingId ? <><Save className="w-4 h-4" /> Update Scheme</> : <><Plus className="w-4 h-4" /> Create Scheme</>)}
        </button>
      </div>

      {/* SCHEME LIST (CARDS UI) */}
      <div>
        <h3 className="text-sm font-bold text-gray-600 mb-4 uppercase">Available Schemes</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schemes.map((s) => (
            <div key={s.id} className="group relative border rounded-xl p-5 hover:shadow-md transition-all bg-white overflow-hidden">
              {/* Type Badge */}
              <div className={`absolute top-0 right-0 px-3 py-1 text-[10px] font-bold uppercase rounded-bl-xl ${s.type === 'SIP' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                {s.type}
              </div>

              <h4 className="font-bold text-gray-800 text-lg mb-1">{s.name}</h4>

              <div className="space-y-1 mt-3">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="bg-gray-100 p-1 rounded"><Briefcase className="w-3 h-3" /></span>
                  {s.durationMonths ? `${s.durationMonths} Months Duration` : 'No Fixed Duration'}
                </p>
                <p className="text-xs text-gray-500 flex items-center gap-2">
                  <span className="bg-gray-100 p-1 rounded">
                    {s.type === 'SIP' ? <Banknote className="w-3 h-3" /> : <Coins className="w-3 h-3" />}
                  </span>
                  {s.type === 'SIP' ? `Min ₹${s.minAmount}/mo` : `Min ${s.minGrams}g purchase`}
                </p>
                {s.type === 'SIP' && s.interest > 0 && (
                  <p className="text-xs text-green-600 font-bold flex items-center gap-2 ml-1">
                    📈 {s.interest}% Interest
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-5 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleEditClick(s)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-600 bg-gray-50 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center justify-center gap-1"
                >
                  <Edit2 className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => validateAndTriggerPasscode("DELETE", s.id)}
                  className="flex-1 py-1.5 rounded-lg text-xs font-bold text-gray-600 bg-gray-50 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {schemes.length === 0 && (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed rounded-xl bg-gray-50">
            <Briefcase className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p>No investment schemes found.</p>
          </div>
        )}
      </div>

      {/* PASSCODE MODAL */}
      <PasscodeModal
        open={passcodeState.open}
        actionTitle={passcodeState.title}
        onClose={() => setPasscodeState({ ...passcodeState, open: false })}
        onSuccess={executeDatabaseAction}
      />
    </div>
  );
};

// ============================================================================
// 2. INVESTMENT PAGE (Updated for SIP/GOLD)
// ============================================================================

export default function InvestmentsPage() {
  const { db,role } = useAuth();
  const [isBackingUp, setIsBackingUp] = useState(false);

  // View State
  const [activeTab, setActiveTab] = useState("DIRECTORY");
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [investments, setInvestments] = useState([]);
  const [schemes, setSchemes] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [sortKey, setSortKey] = useState("account");
  const [sortDir, setSortDir] = useState("asc");
  const PAGE_SIZE = 25;

  const [lastDoc, setLastDoc] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true)
  // Filters
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchLastDoc, setSearchLastDoc] = useState(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  // New Update scheme wise customer segementation
  const [allInvestments, setAllInvestments] = useState([]);
  const [focusAccountId, setFocusAccountId] = useState(null);
  const [showInsights, setShowInsights] = useState(false);

  const [schemeTab, setSchemeTab] = useState("ALL"); 
  const [dashboardStats, setDashboardStats] = useState({
  sipValue: 0,
  sipAccounts: 0,
  goldGms: 0,
  silverGms: 0
});

  const handleSort = (key) => {
  if (sortKey === key) {
    setSortDir(sortDir === "asc" ? "desc" : "asc");
  } else {
    setSortKey(key);
    setSortDir("asc");
  }
};

useEffect(() => {
  const fetchStats = async () => {
    const snap = await getDocs(collection(db, "INVESTMENTS"));

    let sipValue = 0;
    let sipAccounts = 0;
    let gold = 0;
    let silver = 0;

    snap.docs.forEach(d => {
      const inv = d.data();

      if (inv.schemeType === "SIP") {
        sipValue += inv.totalInvestedAmount || 0;
        if (inv.status === "ACTIVE") sipAccounts++;
      }

      if (inv.schemeName === "Swarna Nidhi") {
        gold += inv.totalGramsAccumulated || 0;
      }

      if (inv.schemeName === "Silver Nidhi") {
        silver += inv.totalGramsAccumulated || 0;
      }
    });

    setDashboardStats({
      sipValue,
      sipAccounts,
      goldGms: gold,
      silverGms: silver
    });
  };

  fetchStats();
}, [db]);

useEffect(() => {
  const fetchAllAccounts = async () => {
    const snap = await getDocs(collection(db, "INVESTMENTS"));

    const docs = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    setAllInvestments(docs);
  };

  fetchAllAccounts();
}, [db]);

  useEffect(() => {
    const runAutoBackup = async () => {
      if (role !== "Admin") return;
      
      const lastBackup = localStorage.getItem("last_inv_backup");
      const today = new Date().toISOString().split('T')[0];

      if (lastBackup !== today) {
        try {
          console.log("System: Triggering Daily Component Backup (Investments)...");
          // performInvestmentBackup is the utility we created to pull CUSTOMERS, INVESTMENTS, TRANSACTIONS
          await performInvestmentBackup("Auto-Daily");
          localStorage.setItem("last_inv_backup", today);
          toast.success("Investment Cloud Backup Secured", { position: 'bottom-right', icon: '☁️' });
        } catch (e) {
          console.error("Auto Backup Failed", e);
        }
      }
    };
    runAutoBackup();
  }, [role]);

  // 2. MANUAL BACKUP: Triggered by the button
  const handleManualBackup = async () => {
    const confirm = window.confirm("Create a 100% snapshot of all Investors and Transactions? This will be saved in 'investment_backups' folder.");
    if (!confirm) return;

    setIsBackingUp(true);
    const tid = toast.loading("Connecting to cloud... Fetching records...");
    
    try {
      const result = await performInvestmentBackup(`Manual (${role})`);
      
      // Log to BACKUP_LOGS for audit trail
      await addDoc(collection(db, "BACKUP_LOGS"), {
        type: "INVESTMENT_COMPONENT_FULL",
        createdAt: serverTimestamp(),
        fileUrl: result.url,
        stats: result.count,
        status: "SUCCESS",
        triggeredBy: role
      });

      toast.success(
        `Verified: ${result.count.customers} Investors & ${result.count.transactions} Trans. Secured!`, 
        { id: tid, duration: 5000 }
      );
    } catch (err) {
      console.error(err);
      toast.error("Backup process interrupted. Check connection.", { id: tid });
    } finally {
      setIsBackingUp(false);
    }
  };

  // CSV Export as a databackup

  const handleDailyAuditExport = async () => {
  const confirm = window.confirm("Generate Multi-Sheet Excel (Statement per Customer) and notify elv8?");
  if (!confirm) return;

  const tid = toast.loading("Processing individual customer sheets...");
  try {
    // 1. Generate the multi-sheet Blob
    const excelBlob = await generateInvestorExcelReport();

    // 2. Download locally
    const url = window.URL.createObjectURL(excelBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Investors_Statement_All_${new Date().toISOString().split('T')[0]}.xlsx`;
    a.click();

    // 3. Notify via email
    await notifyAuditEmail();

    toast.success("Individual statements exported to Excel!", { id: tid });
  } catch (error) {
    toast.error("Excel Export Failed", { id: tid });
  }
};

  // Fetch Investments Once
  useEffect(() => {
  const fetchFirstPage = async () => {
    const q = query(
      collection(db, "INVESTMENTS"),
      orderBy("createdAt", "desc"),
      limit(PAGE_SIZE)
    );

    const snap = await getDocs(q);

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setInvestments(docs);

    setLastDoc(snap.docs[snap.docs.length - 1] || null);
    setHasMore(snap.docs.length === PAGE_SIZE);
  };

  fetchFirstPage();
}, [db]);

const loadMoreInvestments = async () => {
  if (!lastDoc || loadingMore || !hasMore) return;

  setLoadingMore(true);

  const q = query(
    collection(db, "INVESTMENTS"),
    orderBy("createdAt", "desc"),
    startAfter(lastDoc),
    limit(PAGE_SIZE)
  );

  const snap = await getDocs(q);

  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  setInvestments(prev => [...prev, ...docs]);
  setLastDoc(snap.docs[snap.docs.length - 1] || null);
  setHasMore(snap.docs.length === PAGE_SIZE);

  setLoadingMore(false);
};

const runGlobalSearch = async (text) => {
  const clean = text.trim().toLowerCase();
  if (!clean) {
    setSearchResults([]);
    return;
  }

  setSearching(true);

  try {
    // 🔹 Fetch larger pool (not paginated)
    const q = query(
      collection(db, "INVESTMENTS"),
      limit(1000)   // safe for CRM scale
    );

    const snap = await getDocs(q);

    const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const t = text.toLowerCase();

    // 🔹 Client-side flexible filtering (same as old system)
    const filtered = allDocs.filter(inv =>
      inv.customerName?.toLowerCase().includes(clean) ||
      inv.customerMobile?.includes(clean) ||
      inv.accountNumber?.toLowerCase().includes(clean)
    );

    setSearchResults(filtered);

  } catch (e) {
    console.error("Search error:", e);
  }

  setSearching(false);
};

  // Real-time Schemes
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "SCHEMES"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSchemes(list);
    });
    return () => unsubscribe();
  }, [db]);

  const handleManageClick = (customerId) => {
    setSelectedCustomerId(customerId);
    setActiveTab("MANAGE_CUSTOMER");
  };

  const handleRefresh = async () => {
    const q = query(collection(db, "INVESTMENTS"));
    const snap = await getDocs(q);
    setInvestments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  // Grouping Logic
const groupedList = useMemo(() => {
  const groups = {};

  const sourceData = search ? searchResults : allInvestments;

sourceData.forEach(inv =>{
    // --- TAB FILTER ---
    if (schemeTab !== "ALL" && inv.schemeName !== schemeTab) return;

    if (!groups[inv.customerId]) {
      groups[inv.customerId] = {
        customerId: inv.customerId,
        customerName: inv.customerName,
        customerMobile: inv.customerMobile,
        accounts: []
      };
    }

    groups[inv.customerId].accounts.push({
      ...inv,
      status: inv.status || "ACTIVE"
    });
  });

  const filtered = Object.values(groups).filter(group => {
    const txt = search.toLowerCase();
    return (
      group.customerName?.toLowerCase().includes(txt) ||
      group.customerMobile?.includes(txt) ||
      group.customerId?.toLowerCase().includes(txt) ||
      group.accounts.some(acc =>
        acc.accountNumber?.toLowerCase().includes(txt)
      )
    );
  });

  return filtered;
}, [investments, search, schemeTab]);


// Handler for Direct Account Navigation
const handleDirectAccountClick = (customerId, accountId) => {
  setSelectedCustomerId(customerId);
  setFocusAccountId(accountId);
  setActiveTab("MANAGE_CUSTOMER");
};

const sortedGroups = [...groupedList].sort((a, b) => {
  let v1, v2;

  if (sortKey === "name") {
    v1 = a.customerName?.toLowerCase() || "";
    v2 = b.customerName?.toLowerCase() || "";
  }

  if (sortKey === "account") {
    v1 = a.accounts[0]?.accountNumber || "";
    v2 = b.accounts[0]?.accountNumber || "";
  }

  if (sortKey === "balance") {
    v1 = a.accounts.reduce(
      (s, x) =>
        s +
        (x.schemeType === "SIP"
          ? (x.totalInvestedAmount || 0)
          : (x.totalGramsAccumulated || 0)),
      0
    );

    v2 = b.accounts.reduce(
      (s, x) =>
        s +
        (x.schemeType === "SIP"
          ? (x.totalInvestedAmount || 0)
          : (x.totalGramsAccumulated || 0)),
      0
    );
  }

  if (sortKey === "status") {
    v1 = a.accounts.filter(x => x.status === "ACTIVE").length;
    v2 = b.accounts.filter(x => x.status === "ACTIVE").length;
  }

  if (v1 < v2) return sortDir === "asc" ? -1 : 1;
  if (v1 > v2) return sortDir === "asc" ? 1 : -1;
  return 0;
});

const EmptyState = () => (
  <div className="flex flex-col items-center justify-center py-20">
    <div className="bg-slate-50 p-8 rounded-[3rem] mb-6">
      <Users className="w-16 h-16 text-slate-200" />
    </div>
    <h3 className="text-lg font-bold text-slate-400 tracking-tight">Vault is currently empty</h3>
    <p className="text-sm text-slate-300">Start by adding your first investor enrollment</p>
  </div>
);

const PaginationControls = ({ hasMore, loading, onMore }) => {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center py-6 border-t border-slate-50">
      <button
        onClick={onMore}
        disabled={loading}
        className="px-8 py-3 rounded-xl bg-slate-900 text-white text-xs font-black uppercase tracking-widest hover:bg-black disabled:opacity-50 transition-all shadow-lg shadow-slate-200"
      >
        {loading ? "Loading..." : "Load More Records"}
      </button>
    </div>
  );
};
const InsightCard = ({ label, value, subtext, icon, color }) => (
  <div className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-5">
    <div className={`w-12 h-12 rounded-2xl bg-${color}-50 flex items-center justify-center`}>
      {React.cloneElement(icon, { size: 24 })}
    </div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-xl font-black text-slate-800 leading-none my-1">{value}</p>
      <p className="text-[10px] text-slate-500 font-medium">{subtext}</p>
    </div>
  </div>
);


const ModalWrapper = ({ children, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
    <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
      {children}
    </div>
  </div>
);



  // RENDER: DETAIL VIEW
  if (activeTab === "MANAGE_CUSTOMER") {
  return (
    <InvestmentDetailView
      customerId={selectedCustomerId}
      focusAccountId={focusAccountId}
      onBack={() => {
        setActiveTab("DIRECTORY");
        setFocusAccountId(null);
      }}
    />
  );
}
  // RENDER: MAIN LIST
  return (
  <div className="h-screen flex flex-col bg-[#f8fafc] overflow-hidden font-sans text-slate-900">
    
    {/* --- MODERN NAV BAR --- */}
    <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 md:px-6 py-3 flex items-center justify-between shrink-0 z-30 sticky top-0">
      {/* LEFT: Title */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg md:text-xl font-black tracking-tight text-slate-800">
          Investments<span className="text-amber-600"> Directory</span>
        </h1>
      </div>
      {/* RIGHT: Actions */}
      <div className="flex items-center gap-2 md:gap-3 pr-14 md:pr-14 lg:pr-0">
        {/* Settings */}
        <button
          onClick={() => setActiveTab(activeTab === "SCHEMES" ? "DIRECTORY" : "SCHEMES")}
          className="flex items-center justify-center p-2 md:p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 transition-all border border-slate-100"
          title="Scheme Settings"
        >
          <Settings
            className={`w-4 h-4 md:w-5 md:h-5 ${
              activeTab === "SCHEMES" ? "text-amber-600 rotate-90" : ""
            } transition-transform duration-500`}
          />
        </button>
        {/* Backup */}
        <button
          onClick={handleManualBackup}
          disabled={isBackingUp}
          className="flex items-center gap-1 md:gap-2 px-2 md:px-4 py-2 rounded-xl text-[11px] md:text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:border-slate-300 shadow-sm transition-all active:scale-95"
        >
          {isBackingUp ? (
            <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
          ) : (
            <UploadCloud className="w-4 h-4" />
          )}
          {/* Hide label on very small screens */}
          <span className="hidden sm:inline uppercase tracking-wider">
            Backup
          </span>
        </button>
      </div>
    </header>

    <main className="flex-1 overflow-y-auto premium-scroll p-4 md:p-6 lg:p-8 space-y-6">
      {activeTab === "SCHEMES" ? (
        <div className="max-w-7xl mx-auto h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <SchemeManager onClose={() => setActiveTab("DIRECTORY")} />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto flex flex-col gap-6">

          <div className="hidden lg:flex justify-end mb-2">
            <button
              onClick={() => setShowInsights(!showInsights)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              {showInsights ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4"/>}
            </button>
          </div>
          
          {/* === INSIGHTS DASHBOARD === */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <InsightCard 
              label="Total SIP Value" 
              value={showInsights ? `₹${dashboardStats.sipValue.toLocaleString()}` : "₹••••••"} 
              subtext={`${dashboardStats.sipAccounts} Active Plans`}
              icon={<TrendingUp className="text-emerald-600" />}
              color="emerald"
            />

            <InsightCard 
              label="Swarna Nidhi" 
              value={showInsights ? `${dashboardStats.goldGms.toFixed(3)} g` : "••• g"} 
              subtext="Total Gold Weight"
              icon={<Coins className="text-amber-600" />}
              color="amber"
            />

            <InsightCard 
              label="Silver Nidhi" 
              value={showInsights ? `${dashboardStats.silverGms.toFixed(3)} g` : "••• g"} 
              subtext="Total Silver Weight"
              icon={<ShieldCheck className="text-slate-400" />}
              color="slate"
            />

            <InsightCard 
              label="Total Portfolio" 
              value={showInsights ? groupedList.length : "•••"} 
              subtext="Enrolled Investors"
              icon={<Users className="text-blue-600" />}
              color="blue"
            />
          </div>

          {/* === ACTIONS & SEARCH === */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm">
             <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl w-full lg:w-auto">
              {["ALL", "12+1", "Swarna Nidhi"].map(tab => (
                <button
                  key={tab}
                  onClick={() => setSchemeTab(tab)}
                  className={`flex-1 lg:flex-none px-6 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition
                    ${schemeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  {tab === "ALL" ? "All" : tab}
                </button>
              ))}
            </div>

            <div className="relative w-full lg:max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
              <input
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  runGlobalSearch(e.target.value, false);
                }}
                placeholder="Search name, ID or mobile..."
                className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-xl text-sm outline-none focus:bg-white focus:ring-4 focus:ring-amber-500/10 focus:border-amber-500/50 transition-all"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <button
                onClick={handleDailyAuditExport}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-all border border-emerald-100 text-xs font-bold"
              >
                <FileText className="w-4 h-4" /> EXPORT
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4 text-amber-400" /> NEW INVESTOR
              </button>
            </div>
          </div>

          {/* === DATA VIEW === */}
          <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 overflow-hidden flex flex-col">
            
            {/* DESKTOP TABLE (Hidden on Small and Medium) */}
            <div className="hidden lg:block overflow-x-auto premium-scroll">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] uppercase tracking-[0.15em] text-slate-400 font-black bg-slate-50/50">
                    <th className="px-8 py-5 text-left cursor-pointer hover:text-slate-900" onClick={() => handleSort("name")}>
                      Investor {sortKey === "name" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      className="px-6 py-5 text-left cursor-pointer hover:text-slate-900"
                      onClick={() => handleSort("account")}
                    >
                      Accounts {sortKey === "account" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-6 py-5 text-right cursor-pointer hover:text-slate-900" onClick={() => handleSort("balance")}>
                      Net Worth {sortKey === "balance" && (sortDir === "asc" ? "↑" : "↓")}
                    </th>
                    <th className="px-6 py-5 text-left">
                      Last Activity
                    </th>
                    <th className="px-8 py-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {sortedGroups.map(group => {
                    const totalPortfolio = group.accounts.reduce((s, x) => s + (x.schemeType === "SIP" ? (x.totalInvestedAmount || 0) : (x.totalGramsAccumulated || 0)), 0);
                    return (
                      <tr key={group.customerId} className="group hover:bg-slate-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-black text-xs border border-slate-200 group-hover:border-amber-400 group-hover:bg-amber-50 transition-colors">
                              {group.customerName.charAt(0)}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 text-sm leading-tight">{group.customerName}</div>
                              <div className="text-[10px] font-mono text-slate-400">{group.customerMobile}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex flex-wrap gap-2">
                            {group.accounts.map(acc => (
                                <button
                                  key={acc.id}
                                  onClick={() => handleDirectAccountClick(group.customerId, acc.id)}
                                  className={`
                                    px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5
                                    ${acc.status === "CLOSED"
                                      ? "bg-red-50 border border-red-200 text-red-600"
                                      : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-amber-500 hover:text-amber-700"}
                                  `}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${acc.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                  {acc.accountNumber || "NO-ACC"}
                                </button>
                              ))}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-right font-black text-slate-700">
                          {group.accounts[0]?.schemeType === "SIP" 
                             ? `₹${totalPortfolio.toLocaleString()}` 
                             : `${totalPortfolio.toFixed(3)}g`}
                        </td>
                        <td className="px-6 py-5">
                          {(() => {
                            const latest = group.accounts
                              .map(a => a.lastTransactionDate?.toDate?.())
                              .filter(Boolean)
                              .sort((a,b)=>b-a)[0];

                            return latest ? (
                              <div className="flex flex-col text-right">
                                <span className="text-sm font-semibold text-slate-700">
                                  {latest.toLocaleDateString("en-GB")}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {latest.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-300">No activity</span>
                            );
                          })()}
                        </td>
                        <td className="px-8 py-5 text-right">
                          <button
                            onClick={() => handleManageClick(group.customerId)}
                            className="p-2.5 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white transition-all"
                          >
                            <ArrowRight className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE & TABLET VIEW (Cards) */}
            <div className="lg:hidden p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedList.map(group => (
                <div 
                  key={group.customerId}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-4 relative overflow-hidden"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex gap-3">
                       <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black text-sm">
                        {group.customerName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 text-sm">{group.customerName}</h3>
                        <p className="text-[10px] text-slate-400 font-mono">{group.customerMobile}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleManageClick(group.customerId)}
                      className="text-amber-600 text-[10px] font-black uppercase tracking-widest bg-amber-50 px-3 py-1.5 rounded-lg"
                    >
                      View Profile
                    </button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Linked Accounts</p>
                    <div className="flex flex-wrap gap-2">
                      {group.accounts.map(acc => (
                        <button
                          key={acc.id}
                          onClick={() => handleDirectAccountClick(group.customerId, acc.id)}
                          className={`
                            px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5
                            ${acc.status === "CLOSED"
                              ? "bg-red-50 border border-red-200 text-red-600"
                              : "bg-slate-50 border border-slate-200 text-slate-600 hover:border-amber-500 hover:text-amber-700"}
                          `}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${acc.status === 'ACTIVE' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {acc.accountNumber || "NO-ACC"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* EMPTY & PAGINATION COMPONENTS (Kept as requested) */}
            {groupedList.length === 0 && <EmptyState />}
            <PaginationControls hasMore={hasMore} loading={loadingMore} onMore={loadMoreInvestments} />
          </div>
        </div>
      )}
    </main>

    {/* MODAL (Kept as requested) */}
    {showAddModal && (
      <ModalWrapper onClose={() => setShowAddModal(false)}>
        <NewInvestmentModal 
          schemes={schemes} 
          onClose={() => setShowAddModal(false)} 
          onSuccess={handleRefresh} 
        />
      </ModalWrapper>
    )}
  </div>
);
}