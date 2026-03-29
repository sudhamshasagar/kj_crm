// EstimationDetailAudit.jsx — UPDATED WITH INVOICE & HSN

import React, { useState, useEffect } from "react";
import { useAuth } from "../../AuthContext";
import { ESTIMATION_LOGS } from "../../firebaseConfig";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
  runTransaction
} from "firebase/firestore";

import {
  ArrowLeft,
  Trash2,
  ChevronDown,
  Lock,
  Printer,
  Check,
  PenLine,
  ShoppingBag,
  CheckCircle,
  IndianRupee,
  AlertCircle
} from "lucide-react";

import { useB2JEmployees } from "../../hooks/useB2JEmployees";
import { fifoOut, checkStockAvailability } from "../../hooks/fifoEngine";
import toast from "react-hot-toast";


const COMPANY_DETAILS = {
  name: "elv8 Jewellers",
  subName: "elv8.works",
  address: "India",
  phone: "7975073574",
  email: "elv8.works@gmail.vom",
  pan: "ABCDP1234C",
  cin: "U00000000000C339",
  gstin: "29AARCKLM2G1Z3",
  bankName: "elv8 Bank",
  accNo: "0906",
  ifsc: "elv80000906"
};

const noSpinnerStyle = `
  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
    -webkit-appearance: none; 
    margin: 0; 
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
`;

const calculateRowCost = (p) => {
  const TAX = 1.03;
  const qty = Number(p.quantity || 0);
  const rate = Number(p.rate || 0); 
  
  const base = rate * qty;
  let mc = 0;
  
  if (p.makingChargesType === "Grams") {
     mc = Number(p.makingCharges || 0) * qty;
  } else {
     mc = base * (Number(p.makingCharges || 0) / 100);
  }

  const stone = Number(p.stoneCharges || 0);
  const final = (base + mc + stone) * TAX;

  return {
      ...p,
      totalMakingCharges: mc,
      finalCost: final || 0
  };
};

// 2. Reverse: Total Cost -> Adjust MC & Stone Proportionally
const recalculateRowFromTotal = (p, newTotal) => {
  const TAX = 1.03;
  const qty = Number(p.quantity || 0);
  const rate = Number(p.rate || 0);
  
  // Target Net Value (before tax)
  const targetNet = newTotal / TAX;
  
  // Base Cost (Fixed)
  const baseCost = rate * qty;
  
  // What remains for Services (MC + Stone)
  let availableForServices = targetNet - baseCost;

  // SAFETY: If available is negative (Total < Gold Rate), floor to 0
  if (availableForServices < 0) availableForServices = 0;

  // Current ratios
  const currentMC = p.totalMakingCharges || 0;
  const currentStone = p.stoneCharges || 0;
  const currentTotalServices = currentMC + currentStone;

  let newMC = 0;
  let newStone = 0;

  if (currentTotalServices === 0) {
      // If no existing services, dump everything into MC (Default behavior)
      newMC = availableForServices;
      newStone = 0;
  } else {
      // Scale proportionally
      const ratio = availableForServices / currentTotalServices;
      newMC = currentMC * ratio;
      newStone = currentStone * ratio;
  }

  // Update Display Fields
  let displayMC = 0;
  if(p.makingChargesType === "Grams") {
      displayMC = qty > 0 ? newMC / qty : 0;
  } else {
      displayMC = baseCost > 0 ? (newMC / baseCost) * 100 : 0;
  }

  return {
      ...p,
      makingCharges: parseFloat(displayMC.toFixed(2)),
      stoneCharges: parseFloat(newStone.toFixed(2)),
      totalMakingCharges: newMC,
      finalCost: Number(newTotal) || 0
  };
};

// ============================================================================
// INVOICE GENERATOR (HTML PRINT)
// ============================================================================

const handlePrintInvoice = async (estimation, customer, products, billing, finalTotals) => {
  const missingHsn = products.some((p) => !p.hsnCode || p.hsnCode.length < 4);
  if (missingHsn) {
    toast.error("Cannot Print: Missing HSN Codes on some products.");
    return;
  }

  // Convert Logo
  let logoBase64 = "";
  try {
    const response = await fetch("/kc2.png");
    const blob = await response.blob();
    logoBase64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch (error) { console.error(error); }

  // Calculations
 const grandTotal = finalTotals.subTotal; 
  const exchange = Number(billing.exchangeValue || 0);
  
  // Back-calculating GST from the inclusive total
  const taxableValue = grandTotal / 1.03; 
  const totalGstAmount = grandTotal - taxableValue;
  const finalPayable = grandTotal - exchange;

  const numToWords = (price) => {
    const amount = Math.floor(price);
    return "Indian Rupees " + amount.toLocaleString('en-IN') + " Only";
  };

  const printWindow = window.open("", "_blank", "width=800,height=600");

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Tax Invoice - ${estimation.id}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Inter:wght@400;700&display=swap" rel="stylesheet">
        <style>
          @page { size: A5 landscape; margin: 5mm; }
          body { font-family: 'Inter', sans-serif; font-size: 8.5pt; color: #1a1a1a; margin: 0; padding: 0; line-height: 1.1; }
          .invoice-container { border: 1px solid #d4af37; padding: 12px; height: 138mm; box-sizing: border-box; position: relative; background: #fff; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #d4af37; padding-bottom: 5px; margin-bottom: 8px; }
          .brand h1 { font-family: 'Cinzel', serif; font-size: 16pt; color: #003366; margin: 0; }
          .brand p { font-size: 6.5pt; color: #555; margin: 1px 0; }
          .invoice-title { text-align: right; }
          .invoice-title h2 { font-size: 12pt; color: #d4af37; margin: 0; }
          .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 8px; background: #f9f9f9; padding: 4px; border-radius: 4px; }
          .meta-box span { display: block; font-size: 5.5pt; color: #888; text-transform: uppercase; }
          .meta-box b { font-size: 7.5pt; }
          .address-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 8px; }
          .addr-label { font-size: 6.5pt; color: #d4af37; font-weight: bold; border-bottom: 1px solid #eee; margin-bottom: 2px; display: block; }
          .addr-content { font-size: 7.5pt; line-height: 1.2; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
          th { background: #003366; color: #fff; font-size: 7.5pt; padding: 5px; text-align: left; }
          td { padding: 5px; border-bottom: 1px solid #eee; font-size: 7.5pt; vertical-align: top; }
          .desc-sub { font-size: 6.5pt; color: #555; margin-top: 2px; display: block; line-height: 1.3; }
          .text-right { text-align: right; }
          .footer { position: absolute; bottom: 12px; left: 12px; right: 12px; display: flex; justify-content: space-between; border-top: 2px solid #d4af37; padding-top: 8px; }
          .footer-left { width: 55%; }
          .footer-right { width: 40%; }
          .summary-row { display: flex; justify-content: space-between; font-size: 7.5pt; margin-bottom: 2px; }
          .total-box { background: #fdf8e6; padding: 6px; border: 1px solid #d4af37; margin-top: 4px; }
          .total-box b { font-size: 10pt; color: #003366; }
          .bank-info { font-size: 6.5pt; color: #666; margin-top: 5px; border: 1px dotted #ccc; padding: 3px; }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="brand">
              <h1>${COMPANY_DETAILS.name}</h1>
              <p>${COMPANY_DETAILS.address}</p>
              <p>GSTIN: ${COMPANY_DETAILS.gstin} | PAN: ${COMPANY_DETAILS.pan}</p>
            </div>
            <div class="invoice-title">
              <h2>TAX INVOICE</h2>
              <p style="font-size: 8pt; font-weight: bold;">#INV-${estimation.id.slice(-6).toUpperCase()}</p>
              ${logoBase64 ? `<img src="${logoBase64}" style="height: 25px;">` : ''}
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box"><span>Date</span><b>${new Date().toLocaleDateString('en-IN')}</b></div>
            <div class="meta-box"><span>Place of Supply</span><b>Karnataka (29)</b></div>
            <div class="meta-box"><span>Contact</span><b>${COMPANY_DETAILS.phone}</b></div>
            <div class="meta-box"><span>Reverse Charge</span><b>No</b></div>
          </div>

          <div class="address-section">
            <div class="addr-box">
              <span class="addr-label">Bill To</span>
              <div class="addr-content"><b>${customer.name}</b><br/>${customer.city} | Mobile: ${customer.mobile}</div>
            </div>
            <div class="addr-box"><span class="addr-label">Ship To</span><div class="addr-content">Counter Delivery</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="5%">#</th>
                <th width="40%">Item Description</th>
                <th width="10%">HSN</th>
                <th width="15%" class="text-right">Rate/g</th>
                <th width="15%" class="text-right">Stone (₹)</th>
                <th width="15%" class="text-right">Total (Incl)</th>
              </tr>
            </thead>
            <tbody>
              ${products.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td>
                    <b>${p.productName}</b> (${p.purity || 'Std'})
                    <span class="desc-sub">
                      Gross Wt: ${p.quantity}g | Stone Wt: ${p.stoneWeight || 0}g | Net Wt: ${(Number(p.quantity) - Number(p.stoneWeight || 0)).toFixed(3)}g
                    </span>
                  </td>
                  <td>${p.hsnCode}</td>
                  <td class="text-right">₹${Number(p.rate).toLocaleString('en-IN')}</td>
                  <td class="text-right">₹${Number(p.stoneCharges || 0).toLocaleString('en-IN')}</td>
                  <td class="text-right">₹${p.finalCost.toLocaleString('en-IN', {minimumFractionDigits: 2})}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>

          <div class="footer">
            <div class="footer-left">
              <div style="font-size: 7pt; font-weight: bold; color: #003366;">${numToWords(finalPayable)}</div>
              <div class="bank-info"><b>BANK:</b> ${COMPANY_DETAILS.bankName} | <b>A/C:</b> ${COMPANY_DETAILS.accNo} | <b>IFSC:</b> ${COMPANY_DETAILS.ifsc}</div>
              <div style="font-size: 6pt; color: #999; margin-top: 3px;">* Composition inclusive of GST. No additional tax applied.</div>
            </div>
            <div class="footer-right">
              <div class="summary-row"><span>Taxable Value (Incl):</span><span>₹${taxableValue.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
              <div class="summary-row"><span>GST Component (3%):</span><span>₹${totalGstAmount.toLocaleString('en-IN', {minimumFractionDigits: 2})}</span></div>
              ${exchange > 0 ? `<div class="summary-row" style="color: #d4af37;"><span>Exchange Less:</span><span>- ₹${exchange.toLocaleString('en-IN')}</span></div>` : ""}
              <div class="total-box"><div class="summary-row"><b>NET PAYABLE:</b><b>₹${finalPayable.toLocaleString('en-IN')}</b></div></div>
              <div style="text-align: right; margin-top: 12px; font-size: 7pt; font-weight: bold;">For ${COMPANY_DETAILS.name}<br/><br/><br/>Auth. Signatory</div>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); printWindow.close(); };
};

// ============================================================================
// REUSABLE UI COMPONENTS
// ============================================================================

const Field = ({ label, value, disabled, onChange, type = "text" }) => (
  <div className="space-y-1">
    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
      {label}
    </label>
    <input
      type={type}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 rounded-lg border text-sm outline-none transition-all ${
        disabled
          ? "bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed"
          : "bg-white border-gray-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
      }`}
    />
  </div>
);

// ============================================================================
// MODALS (Passcode, Order, Sale)
// ============================================================================

const PasscodeModal = ({ open, onClose, onSubmit }) => {
  const [pass, setPass] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm z-[9999]">
      <div className="bg-white p-6 rounded-2xl max-w-xs w-full shadow-2xl animate-in fade-in zoom-in duration-200">
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
          <Lock className="w-5 h-5 text-amber-600" /> Admin Confirmation
        </h2>
        <input type="password" maxLength={4} autoFocus value={pass} onChange={(e) => setPass(e.target.value)} className="border-2 border-gray-200 focus:border-amber-500 w-full p-3 rounded-xl text-center text-2xl tracking-[0.5em] outline-none font-mono" />
        <div className="flex justify-end mt-6 gap-2">
          <button className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg" onClick={onClose}>Cancel</button>
          <button className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg" onClick={() => onSubmit(pass)}>Authorize</button>
        </div>
      </div>
    </div>
  );
};

const OrderConfigModal = ({ open, onClose, employees, onProceed }) => {
  const [goldsmithId, setGoldsmithId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold mb-4">Configure Order</h2>
        <div className="space-y-4">
          <select className="w-full border rounded-lg p-2" value={goldsmithId} onChange={(e) => setGoldsmithId(e.target.value)}>
            <option value="">Select Goldsmith</option>
            {employees.filter(e => e.type === "B2J").map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <input type="date" className="w-full border rounded-lg p-2" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
          <button disabled={!goldsmithId || !deliveryDate} onClick={() => onProceed({ goldsmithId, deliveryDate })} className="px-6 py-2 bg-blue-600 text-white rounded-lg">Next</button>
        </div>
      </div>
    </div>
  );
};

const SaleConfigModal = ({ open, onClose, finalTotal, onProceed, defaultDate }) => {
  const [payType, setPayType] = useState("full");
  const [paid, setPaid] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(defaultDate || "");
  if (!open) return null;
  const amountPending = payType === "full" ? 0 : finalTotal - Number(paid || 0);
  const isValid = deliveryDate && (payType === "full" || (Number(paid) > 0 && Number(paid) < finalTotal));
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-xl w-full max-w-sm shadow-xl">
        <h2 className="text-lg font-bold mb-4">Close Sale</h2>
        <div className="space-y-4">
          <input type="date" className="w-full border rounded-lg p-2" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPayType("full")} className={`p-2 border rounded-lg ${payType === "full" ? "bg-green-50 border-green-500" : ""}`}>Full</button>
            <button onClick={() => setPayType("part")} className={`p-2 border rounded-lg ${payType === "part" ? "bg-amber-50 border-amber-500" : ""}`}>Part</button>
          </div>
          {payType === "part" && <input type="number" placeholder="Paid Amount" value={paid} onChange={(e) => setPaid(e.target.value)} className="w-full border rounded-lg p-2" />}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-100 rounded-lg">Cancel</button>
          <button disabled={!isValid} onClick={() => onProceed({ deliveryDate, paymentType: payType, amountPaid: payType === "full" ? finalTotal : Number(paid), amountPending })} className="px-6 py-2 bg-green-600 text-white rounded-lg">Complete</button>
        </div>
      </div>
    </div>
  );
};
// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function EstimationDetailAudit({ estimationId, onBack }) {
  const { db } = useAuth();
  const { employees } = useB2JEmployees();

  // Data States
  const [loading, setLoading] = useState(true);
  const [estimation, setEstimation] = useState(null);
  const [customer, setCustomer] = useState({ customerId: "", name: "", mobile: "", city: "", pan: "" });
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({ grandTotal: 0 });

  // Billing States
  const [exchangeValue, setExchangeValue] = useState(0);

  // Edit Mode States
  const [editProfile, setEditProfile] = useState(false);
  const [editProducts, setEditProducts] = useState(false);

  // Local State for "Payable" Input to prevent jumping
  const [payableInput, setPayableInput] = useState("");
  const [stockItems, setStockItems] = useState([]);

  // UI Flow States
  const [actionsOpen, setActionsOpen] = useState(false);
  const [modalState, setModalState] = useState({ type: null, payload: null });

  // ==========================
  // INITIAL DATA FETCH
  // ==========================
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(ESTIMATION_LOGS, estimationId));
        if (!snap.exists()) { toast.error("Not Found"); onBack(); return; }
        const d = snap.data();
        setEstimation({ id: estimationId, ...d });
        setCustomer({ ...d.customer, pan: d.customer?.pan || "" });
        
        const normProds = (d.products || []).map(p => {
          if (!p.stockItemName) {
            console.error("🚨 Missing stockItemName:", p);
            throw new Error(`Stock mapping missing for ${p.productName}`);
          }

          return {
            ...p,
            hsnCode: p.hsnCode || "",
            rate: p.rate || 0,
            purity: p.purity || p.purityName || "",
            stockItemName: p.stockItemName.trim() // 🔒 STRICT
          };
        });

        setProducts(normProds);
        setSummary(d.summary || { grandTotal: 0 });
        
        const exVal = d.billing ? Number(d.billing.exchangeValue || 0) : 0;
        setExchangeValue(exVal);
        
        const netPayable = (d.summary?.grandTotal || 0) - exVal;
        setPayableInput(Math.round(netPayable).toString());

        // Load Stock Items for Dropdown
        const stockQ = query(collection(db, "STOCK_SUMMARY"), orderBy("itemName"));
        const stockSnap = await getDocs(stockQ);
        setStockItems(stockSnap.docs.map(doc => doc.data().itemName));

      } catch (e) { console.error(e); } 
      finally { setLoading(false); }
    })();
  }, [estimationId]);

  useEffect(() => {
      if(!editProducts) {
          const finalP = Math.round(summary.grandTotal - exchangeValue);
          setPayableInput(finalP.toString());
      }
  }, [summary.grandTotal, exchangeValue, editProducts]);

  if (loading) return <div className="p-10 text-center">Loading Data...</div>;
  if (!estimation) return <div className="p-10 text-center">Estimation not found.</div>;


  // ==========================
  // COMPUTED VALUES
  // ==========================
  const isOrderPlaced = estimation?.isOrderPlaced === true;
  const isSaleClosed = estimation?.isSaleDone === true;
  const isLocked = isOrderPlaced || isSaleClosed;

  const finalTotalRaw = summary.grandTotal || 0;
  const exchangeAmount = Number(exchangeValue || 0);
  const finalPayable = finalTotalRaw - exchangeAmount;
  const finalPayableRounded = Math.round(finalPayable);

  const isHsnComplete = products.length > 0 && products.every(p => p.hsnCode && p.hsnCode.length > 3);

  // ==========================
  // HANDLERS - DATA EDITING
  // ==========================
  
  const saveCustomer = async () => {
    await updateDoc(doc(ESTIMATION_LOGS, estimationId), {
      customer: { ...customer },
      lastUpdated: serverTimestamp(),
    });
    setEditProfile(false);
    toast.success("Customer updated");
  };

  // AUTO SAVE FUNCTION FOR PRODUCTS
  const saveChangesToDB = async (updatedProducts = products, updatedSummary = summary) => {
    try {
      await updateDoc(doc(ESTIMATION_LOGS, estimationId), {
        products: normalizeProductsForInventory(updatedProducts),
        summary: updatedSummary,
        lastUpdated: serverTimestamp(),
      });
    } catch (e) {
      console.error("Auto-save failed", e);
    }
  };

  const handleProductChange = (index, field, value) => {
    const updatedProducts = [...products];
    updatedProducts[index] = { ...updatedProducts[index], [field]: value };
    
    // Reverse calc if total changed, else forward calc
    if (field === "finalCost") {
        updatedProducts[index] = recalculateRowFromTotal(updatedProducts[index], value);
    } else {
        updatedProducts[index] = calculateRowCost(updatedProducts[index]);
    }
    
    setProducts(updatedProducts);
    const newGrandTotal = updatedProducts.reduce((s, p) => s + (p.finalCost || 0), 0);
    const newSum = { ...summary, grandTotal: newGrandTotal };
    setSummary(newSum);
    
    // Update local input immediately to reflect row changes visually
    setPayableInput(Math.round(newGrandTotal - exchangeValue).toString());
  };

  // ✅ GLOBAL TOTAL COMMIT (Called on Blur/Enter)
  const commitGlobalTotalChange = () => {
      const newPayable = Number(payableInput);
      
      // Safety Checks
      if (isNaN(newPayable) || newPayable < 0) {
          setPayableInput(finalPayableRounded.toString()); // Revert if invalid
          return;
      }

      // Reverse to get GrandTotal (Payable + Exchange)
      const targetGrandTotal = newPayable + exchangeAmount;
      const currentTotal = summary.grandTotal;

      if (currentTotal === 0) {
          toast.error("Cannot scale from 0. Add product costs first.");
          return; 
      }

      const ratio = targetGrandTotal / currentTotal;
      
      const updatedProducts = products.map(p => {
          const newRowTotal = p.finalCost * ratio;
          return recalculateRowFromTotal(p, newRowTotal);
      });

      setProducts(updatedProducts);
      const newSum = { ...summary, grandTotal: targetGrandTotal };
      setSummary(newSum);
      
      saveChangesToDB(updatedProducts, newSum);
      toast.success("Recalculated successfully");
  };

  const normalizeProductsForInventory = (products) => {
  return products.map(p => ({
    ...p,
    stockItemName: p.stockItemName?.trim()
  }));
};

  // ==========================
  // HANDLERS - WORKFLOW
  // ==========================

  const initiatePlaceOrder = () => setModalState({ type: "ORDER_CONFIG", payload: null });
  const initiateCloseSale = () => {
    const today = new Date().toISOString().split('T')[0]; // Format YYYY-MM-DD
    setModalState({ 
      type: "SALE_CONFIG", 
      payload: { defaultDate: today } // Pass it to the modal
    });
  };
  const initiateDelete = () => setModalState({ type: "PASSCODE", payload: { action: "DELETE" } });
  const onOrderConfigured = (data) => setModalState({ type: "PASSCODE", payload: { action: "PLACE_ORDER", data } });
  const onSaleConfigured = (data) => setModalState({ type: "PASSCODE", payload: { action: "CLOSE_SALE", data } });

  const initiatePrint = () => {
      setActionsOpen(false);
      handlePrintInvoice(estimation, customer, products, { exchangeValue }, { subTotal: finalTotalRaw, finalPayable });
  };

// Inside EstimationDetailAudit.jsx -> handlePasscodeSubmit
/* In EstimationDetailAudit.jsx — Update handlePasscodeSubmit flags */
const handlePasscodeSubmit = async (code) => {
  if (code !== "0906") return toast.error("Invalid Passcode");
  const { action, data } = modalState.payload;
  const tId = toast.loading("Processing...");

  try {
    const estimationRef = doc(ESTIMATION_LOGS, estimationId);
    
    // 1. Logic for Place Order or Close Sale
    if (["PLACE_ORDER", "CLOSE_SALE"].includes(action)) {
      
      // A. Stock Check (Kept outside transaction for speed, or move inside if needed)
      const cartForCheck = products.map(p => ({
        stockItemKey: p.stockItemName.trim(),
        quantity: Number(p.quantity)
      }));

      const errs = await checkStockAvailability(db, cartForCheck);
      if (errs.length) {
        toast.dismiss(tId);
        errs.forEach(e => toast.error(e));
        return;
      }

      // B. Execution Block
      await runTransaction(db, async (transaction) => {
        
        // --- STEP 1: GENERATE AUTO REF (Only for Close Sale) ---
        let autoRef = null;
        if (action === "CLOSE_SALE") {
          const counterRef = doc(db, "METADATA", "counters");
          const counterSnap = await transaction.get(counterRef);
          let nextNum = 500;
          if (counterSnap.exists() && counterSnap.data().pRef) {
            nextNum = counterSnap.data().pRef + 1;
          }
          autoRef = `P${nextNum}`;
          transaction.set(counterRef, { pRef: nextNum }, { merge: true });
        }

        // --- STEP 2: FIFO STOCK DEDUCTION ---
        // Note: Ensure your fifoOut utility supports being part of a transaction 
        // if not, keep the original loop but transaction.update is safer.
        for (const p of products) {
           await fifoOut(db, p.stockItemName.trim(), Number(p.quantity), estimationId);
        }

        // --- STEP 3: PREPARE UPDATE FIELDS ---
        let updateFields = { 
          lastUpdated: serverTimestamp() 
        };

        if (action === "PLACE_ORDER") {
          updateFields.isOrderPlaced = true;
          updateFields.orderData = data;
        } else if (action === "CLOSE_SALE") {
          updateFields.isSaleDone = true;
          updateFields.saleData = data;
          updateFields.billing = {
            ...estimation.billing,
            exchangeValue: Number(exchangeValue),
            paymentRef: autoRef // Store the generated P-Ref in the invoice
          };

          // --- STEP 4: LOG TO CENTRAL ALL_PAYMENTS LEDGER ---
          const globalPayRef = doc(collection(db, "ALL_PAYMENTS"));
          transaction.set(globalPayRef, {
            ref: autoRef,
            source: "Sales", // Badge Label
            amount: Number(data.amountPaid), // From your sale modal
            customerName: customer.name,
            mode: data.paymentMode || "STORE", 
            date: data.deliveryDate,
            createdAt: serverTimestamp()
          });
        }

        // --- STEP 5: UPDATE THE ESTIMATION DOCUMENT ---
        transaction.update(estimationRef, updateFields);
      });
    } else {
      // Handle other actions like Delete if applicable
      await updateDoc(estimationRef, { lastUpdated: serverTimestamp() });
    }

    toast.success("Success", { id: tId });
    setModalState({ type: null, payload: null });
    onBack(); 

  } catch (e) {
    console.error(e);
    toast.error("Process Failed", { id: tId });
  }
};

  const canPrintInvoice = isHsnComplete && (isOrderPlaced || isSaleClosed);

  return (
    <div className=" bg-gray-50 flex flex-col font-sans text-gray-800 overflow-hidden h-screen">
      <style>{noSpinnerStyle}</style> 
      {/* HEADER */}
      <div className="bg-white px-6 py-4 shadow-sm border-b flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Estimation Audit</h1>
            <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {estimation.id}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-y-auto">
        
        {/* LEFT COLUMN: CUSTOMER */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800">Customer Details</h2>
              {!isLocked && (
                <button
                  onClick={() => editProfile ? saveCustomer() : setEditProfile(true)}
                  className={`text-xs px-3 py-1 rounded-md font-medium transition-colors ${editProfile ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  {editProfile ? "Save" : "Edit"}
                </button>
              )}
            </div>
            <div className="space-y-4">
              <Field label="Customer ID" value={customer.customerId} disabled={true} onChange={() => {}} />
              <Field label="Full Name" value={customer.name} disabled={isLocked || !editProfile} onChange={(v) => setCustomer({ ...customer, name: v })} />
              <Field label="Mobile Number" value={customer.mobile} disabled={isLocked || !editProfile} onChange={(v) => setCustomer({ ...customer, mobile: v })} />
              <Field label="City / Location" value={customer.city} disabled={isLocked || !editProfile} onChange={(v) => setCustomer({ ...customer, city: v })} />
              <Field label="PAN Number" value={customer.pan} disabled={isLocked || !editProfile} onChange={(v) => setCustomer({ ...customer, pan: v })} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: PRODUCTS & BILLING */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col ">
            
            {/* PRODUCT HEADER */}
            <div className="flex justify-between items-center mb-6 gap-x-2 ">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Product Summary</h2>
                {!isHsnComplete && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> HSN Codes required for Invoicing
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 relative">
                {isOrderPlaced && (
                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold border border-blue-200 flex items-center gap-1">
                    <ShoppingBag className="w-3 h-3" /> ORDER PLACED
                  </span>
                )}
                {isSaleClosed && (
                  <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-200 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> SALE CLOSED
                  </span>
                )}

                <div className="relative">
                  <button
                    onClick={() => setActionsOpen(!actionsOpen)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                  >
                    Actions <ChevronDown className="w-4 h-4" />
                  </button>
                  
                  {actionsOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden">
                      {/* ONLY SHOW PRINT OPTION IF PROCESSED (ORDER PLACED OR SALE CLOSED) */}
                      {(isOrderPlaced || isSaleClosed) && (
                        <>
                          <button
                            onClick={initiatePrint}
                            disabled={!canPrintInvoice}
                            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-2 ${
                              !canPrintInvoice
                                ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-50 text-gray-700"
                            }`}
                          >
                            <Printer className="w-4 h-4" /> 
                            {isSaleClosed ? "Create Tax Invoice" : "Print Work Order"}
                            {!canPrintInvoice && <AlertCircle className="w-3 h-3 text-red-400 ml-auto" />}
                          </button>
                          <div className="h-px bg-gray-100"></div>
                        </>
                      )}

                      <button
                        onClick={() => {
                          setActionsOpen(false);
                          initiateDelete();
                        }}
                        className="w-full text-left px-4 py-3 text-sm hover:bg-red-50 text-red-600 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" /> Delete Record
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PRODUCT TABLE */}
            <div className="overflow-x-auto border border-gray-100 rounded-xl mb-6">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">Item Details</th>
                    <th className="px-4 py-3 text-right w-24">Rate</th>
                    <th className="px-4 py-3 text-right w-20">Qty</th>
                    <th className="px-4 py-3 text-right w-24">MC</th>
                    <th className="px-4 py-3 text-right w-24">Stone</th>
                    <th className="px-4 py-3 text-right">Total</th>
                    {editProducts && !isLocked && <th className="px-4 py-3 text-center"></th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((p, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      
                      {/* COL 1: Name, Purity, HSN (Badges) */}
                      <td className="px-4 py-3 align-top">
                        {editProducts && !isLocked ? (
                            <div className="space-y-2">
                                <input 
                                    className="w-full p-1 border rounded text-xs font-bold"
                                    value={p.productName}
                                    onChange={(e) => handleProductChange(idx, "productName", e.target.value)}
                                    onBlur={() => saveChangesToDB()}
                                />
                                <div className="flex gap-2">
                                    <input 
                                        className="w-20 p-1 border rounded text-xs"
                                        placeholder="HSN"
                                        value={p.hsnCode || ""}
                                        onChange={(e) => handleProductChange(idx, "hsnCode", e.target.value)}
                                        onBlur={() => saveChangesToDB()}
                                    />
                                    <input 
                                        className="w-20 p-1 border rounded text-xs"
                                        placeholder="Purity"
                                        value={p.purity || ""} 
                                        onChange={(e) => handleProductChange(idx, "purity", e.target.value)}
                                        onBlur={() => saveChangesToDB()}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="font-bold text-gray-800">{p.productName}</div>
                                
                                {/* MASTER STOCK NAME (For Inventory) */}
                                {p.stockItemName && p.stockItemName !== p.productName && (
                                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                        Stock: {p.stockItemName}
                                    </div>
                                )}

                                <div className="flex flex-wrap gap-2 mt-1">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                                        HSN: {p.hsnCode || "N/A"}
                                    </span>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-100">
                                        {p.purity || p.purityName || "Std"}
                                    </span>
                                </div>
                            </div>
                        )}
                      </td>

                      {/* COL 2: Rate */}
                      <td className="px-4 py-3 text-right align-top">
                         {editProducts && !isLocked ? (
                             <input 
                                type="number"
                                className="w-full text-right p-1 border rounded text-xs"
                                value={p.rate}
                                onWheel={(e) => e.target.blur()}
                                onKeyDown={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && e.preventDefault()}
                                onChange={(e) => handleProductChange(idx, "rate", e.target.value)}
                                onBlur={() => saveChangesToDB()}
                             />
                         ) : (
                             <span>₹{Number(p.rate).toLocaleString()}</span>
                         )}
                      </td>

                      {/* COL 3: Quantity */}
                      <td className="px-4 py-3 text-right align-top">
                         {editProducts && !isLocked ? (
                             <input 
                                type="number"
                                className="w-full text-right p-1 border rounded text-xs font-bold"
                                value={p.quantity}
                                onWheel={(e) => e.target.blur()}
                                onKeyDown={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && e.preventDefault()}
                                onChange={(e) => handleProductChange(idx, "quantity", e.target.value)}
                                onBlur={() => saveChangesToDB()}
                             />
                         ) : (
                             <span className="font-mono">{p.quantity}</span>
                         )}
                      </td>

                      {/* COL 4: MC */}
                      <td className="px-4 py-3 text-right align-top">
                         {editProducts && !isLocked ? (
                             <div className="flex flex-col gap-1">
                                 <input 
                                    type="number"
                                    className="w-full text-right p-1 border rounded text-xs"
                                    value={p.makingCharges}
                                    onWheel={(e) => e.target.blur()}
                                    onKeyDown={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && e.preventDefault()}
                                    onChange={(e) => handleProductChange(idx, "makingCharges", e.target.value)}
                                    onBlur={() => saveChangesToDB()}
                                 />
                                 <select 
                                    className="text-[10px] border rounded p-0.5"
                                    value={p.makingChargesType}
                                    onChange={(e) => {
                                        handleProductChange(idx, "makingChargesType", e.target.value);
                                        saveChangesToDB(); 
                                    }}
                                 >
                                     <option value="Percentage">%</option>
                                     <option value="Grams">/g</option>
                                 </select>
                             </div>
                         ) : (
                             <div>
                                 <div className="font-medium">₹{p.totalMakingCharges?.toFixed(0)}</div>
                                 <div className="text-[10px] text-gray-500">
                                    {p.makingChargesType === "Percentage" ? `${p.makingCharges}%` : `₹${p.makingCharges}/g`}
                                 </div>
                             </div>
                         )}
                      </td>

                      {/* COL 5: Stone */}
                      <td className="px-4 py-3 text-right align-top">
                         {editProducts && !isLocked ? (
                             <input 
                                type="number"
                                className="w-full text-right p-1 border rounded text-xs"
                                value={p.stoneCharges}
                                onWheel={(e) => e.target.blur()}
                                onKeyDown={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && e.preventDefault()}
                                onChange={(e) => handleProductChange(idx, "stoneCharges", e.target.value)}
                                onBlur={() => saveChangesToDB()}
                             />
                         ) : (
                             <span>{Number(p.stoneCharges) > 0 ? `₹${Number(p.stoneCharges).toFixed(0)}` : "-"}</span>
                         )}
                      </td>

                      {/* COL 6: Total (EDITABLE for Reverse Calc) */}
                      <td className="px-4 py-3 text-right font-bold text-gray-900 align-top">
                        {editProducts && !isLocked ? (
                             <input 
                                type="number"
                                className="w-full text-right p-1 border border-blue-300 bg-blue-50 rounded text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                value={p.finalCost ? p.finalCost.toFixed(2) : ""}
                                onWheel={(e) => e.target.blur()}
                                onKeyDown={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && e.preventDefault()}
                                onChange={(e) => handleProductChange(idx, "finalCost", e.target.value)}
                                onBlur={() => saveChangesToDB()}
                             />
                         ) : (
                             <span>₹{p.finalCost?.toFixed(2)}</span>
                         )}
                      </td>

                      {/* COL 7: Delete */}
                      {editProducts && !isLocked && (
                        <td className="px-4 py-3 text-center align-top">
                          <button
                            onClick={async () => {
                                const newP = products.filter((_, i) => i !== idx);
                                setProducts(newP);
                                const newSum = { ...summary, grandTotal: newP.reduce((s, x) => s + (x.finalCost || 0), 0) };
                                setSummary(newSum);
                                await saveChangesToDB(newP, newSum);
                            }}
                            className="text-red-400 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      )}

                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ACTION BUTTON - TOGGLE EDIT */}
            {!isLocked && (
               <div className="flex justify-end mb-4">
                 <button
                   onClick={() => setEditProducts(!editProducts)}
                   className={`text-xs px-4 py-2 rounded-lg font-bold border transition-colors flex items-center gap-2 ${
                     editProducts
                       ? "bg-green-600 text-white border-green-600 hover:bg-green-700"
                       : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                   }`}
                 >
                   {editProducts ? (
                       <><Check className="w-3 h-3" /> Done Editing</>
                   ) : (
                       <><PenLine className="w-3 h-3" /> Edit Products</>
                   )}
                 </button>
               </div>
            )}

            {/* BILLING SECTION */}
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
              <div className="flex flex-col md:flex-row gap-8">
                
                {/* Left: Exchange Input */}
                <div className="flex-1 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Exchange Value (₹)</label>
                    <div className="relative mt-1">
                      <IndianRupee className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                      <input 
                        type="number" 
                        disabled={isLocked} 
                        value={exchangeValue} 
                        onChange={(e) => setExchangeValue(e.target.value)} 
                        onWheel={(e) => e.target.blur()}
                        onKeyDown={(e) => (e.key === "ArrowUp" || e.key === "ArrowDown") && e.preventDefault()}
                        className={`w-full pl-9 pr-3 py-2 rounded-lg border text-sm outline-none ${isLocked ? "bg-gray-100" : "bg-white border-gray-300"}`} 
                        placeholder="Exchange"
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Totals (EDITABLE PAYABLE) */}
                <div className="flex-1 border-t md:border-t-0 md:border-l border-gray-200 md:pl-8 pt-4 md:pt-0 flex flex-col justify-center space-y-2">
                  <div className="flex justify-between text-sm text-gray-500"><span>Subtotal (Sum of Items)</span><span>₹ {finalTotalRaw.toFixed(2)}</span></div>
                  
                  {exchangeAmount > 0 && (
                      <div className="flex justify-between text-sm text-amber-600"><span>Exchange</span><span>- ₹ {exchangeAmount.toFixed(2)}</span></div>
                  )}
                  
                  <div className="h-px bg-gray-200 my-2"></div>
                  
                  <div className="flex justify-between items-center text-xl font-bold text-gray-900">
                    <span>Payable</span>
                    
                    {/* EDITABLE PAYABLE FIELD (SAFE MODE) */}
                    {!isLocked && editProducts ? (
                        <div className="relative">
                            <span className="absolute left-2 top-1.5 text-sm text-gray-400">₹</span>
                            <input 
                                type="number"
                                className="w-32 py-1 pl-5 pr-2 border-2 border-blue-500 rounded-lg text-right outline-none bg-white text-gray-900"
                                // Bind to LOCAL state, not global state
                                value={payableInput}
                                onChange={(e) => setPayableInput(e.target.value)}
                                // Commit changes ONLY on Blur or Enter
                                onBlur={commitGlobalTotalChange}
                                onKeyDown={(e) => {
                                    if(e.key === "Enter") {
                                        e.currentTarget.blur();
                                        commitGlobalTotalChange();
                                    }
                                    if(e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                                }}
                                onWheel={(e) => e.target.blur()}
                            />
                        </div>
                    ) : (
                        <span>₹ {finalPayableRounded.toFixed(2)}</span>
                    )}
                  </div>
                  
                  {editProducts && !isLocked && (
                      <div className="text-[10px] text-right text-blue-600 mt-1">
                          * Click outside to recalculate. (Proportional)
                      </div>
                  )}
                </div>
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-end">
              {!isSaleClosed && (
                <button disabled={isOrderPlaced} onClick={initiatePlaceOrder} className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${isOrderPlaced ? "bg-blue-50 text-blue-600 border border-blue-100 opacity-100 cursor-default" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md"}`}>
                  {isOrderPlaced ? <><CheckCircle className="w-4 h-4" /> Order Placed</> : "Place Order"}
                </button>
              )}
              {!isOrderPlaced && (
                <button disabled={isSaleClosed} onClick={initiateCloseSale} className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition-all flex items-center justify-center gap-2 ${isSaleClosed ? "bg-green-50 text-green-600 border border-green-100 opacity-100 cursor-default" : "bg-green-600 text-white hover:bg-green-700 hover:shadow-md"}`}>
                  {isSaleClosed ? <><CheckCircle className="w-4 h-4" /> Sale Closed</> : "Close Sale"}
                </button>
              )}
            </div>
            
          </div>
        </div>
      </div>

      {/* MODAL LAYER */}
      <OrderConfigModal open={modalState.type === "ORDER_CONFIG"} employees={employees} onClose={() => setModalState({ type: null, payload: null })} onProceed={onOrderConfigured} />
      <SaleConfigModal 
        open={modalState.type === "SALE_CONFIG"} 
        finalTotal={finalPayable} 
        defaultDate={modalState.payload?.defaultDate} // <--- Pass it here
        onClose={() => setModalState({ type: null, payload: null })} 
        onProceed={onSaleConfigured} 
      />
      <PasscodeModal open={modalState.type === "PASSCODE"} onClose={() => setModalState({ type: null, payload: null })} onSubmit={handlePasscodeSubmit} />
    </div>
  );
}