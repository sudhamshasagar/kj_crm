import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "../../AuthContext";
import { B2B_MASTER_LOG, B2J_MASTER_LOG, db } from "../../firebaseConfig";
import {
  getDocs,
  query,
  where,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,onSnapshot, orderBy, limit
} from "firebase/firestore";

import {
  User,
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle2,
  Save,
  X,
  Flag,
  MessageSquare,
  Mail,
  Package, 
  Scale,
  Calendar,
  IndianRupee,
  Briefcase,
  Download,
  Phone
} from "lucide-react";
import MobileTransactionCard from "../common/MobileTransactionCard";
import { exportEmployeeStatement } from "../../utils/operationalAuditService";
import toast from "react-hot-toast";
/* ============================================================
   1. TOAST NOTIFICATION
============================================================ */
const Toast = ({ message, type = "success", onClose }) => (
  <motion.div
    initial={{ opacity: 0, y: 50, scale: 0.9 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={{ opacity: 0, y: 50, scale: 0.9 }}
    className={`fixed bottom-6 left-1/2 -translate-x-1/2 md:left-auto md:right-6 md:translate-x-0 z-[100] px-6 py-3 rounded-2xl shadow-xl text-white flex items-center gap-3 min-w-[300px] ${
      type === "success" ? "bg-emerald-600" : "bg-red-600"
    }`}
  >
    <div className="p-1 bg-white/20 rounded-full">
        {type === "success" ? <CheckCircle2 className="w-5 h-5"/> : <MessageSquare className="w-5 h-5"/>}
    </div>
    <span className="font-medium text-sm flex-1">{message}</span>
    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors">
        <X className="w-4 h-4"/>
    </button>
  </motion.div>
);

/* ============================================================
   2. CORRECTION REQUEST MODAL
============================================================ */
// ============================================================
// FIELD-LEVEL CORRECTION REQUEST MODAL
// ============================================================
const CorrectionModal = ({ isOpen, item, onClose, onSubmit }) => {
  const [reason, setReason] = useState("");
  const [selected, setSelected] = useState({});
  const [values, setValues] = useState({});

  useEffect(() => {
    if (isOpen && item) {
      setReason("");
      setSelected({});
      setValues({});
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const FIELDS = [
    { key: "rawMaterialWeight", label: "Raw Weight (g)" },
    { key: "purity", label: "Purity (%)" },
    { key: "stoneCharges", label: "Stone Charges (₹)" },
    { key: "advanceCashPaid", label: "Advance Paid (₹)" },
  ];

  const handleSubmit = () => {
    const requestedChanges = {};

    Object.keys(selected).forEach((k) => {
      if (selected[k]) {
        requestedChanges[k] = {
          old: Number(item[k] || 0),
          new: Number(values[k]),
        };
      }
    });

    onSubmit(item, requestedChanges, reason);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="px-6 py-4 bg-blue-600 text-white font-bold rounded-t-2xl">
          Request Correction
        </div>

        <div className="p-6 space-y-4">
          {FIELDS.map(f => (
            <div key={f.key} className="border rounded-xl p-3">
              <label className="flex items-center gap-2 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={!!selected[f.key]}
                  onChange={(e) =>
                    setSelected(s => ({ ...s, [f.key]: e.target.checked }))
                  }
                />
                {f.label}
              </label>

              {selected[f.key] && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-gray-500">
                    Current: {item[f.key] ?? 0}
                  </p>
                  <input
                    type="number"
                    value={values[f.key] || ""}
                    onChange={(e) =>
                      setValues(v => ({ ...v, [f.key]: e.target.value }))
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="Enter new value"
                  />
                </div>
              )}
            </div>
          ))}

          <textarea
            placeholder="Reason for correction"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full border rounded-xl p-3 text-sm"
          />
        </div>

        <div className="p-4 bg-gray-50 flex gap-3 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!reason || Object.keys(selected).length === 0}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};


/* ============================================================
   1. FIXED EDIT MODAL
   - Allows clearing inputs (keeps values as strings while typing)
   - Converts to Number only on Save
============================================================ */
const EditModal = ({ isOpen, item, logCollection, onClose, onSave }) => {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (isOpen && item) {
      // Load data. If a value is 0, we want to show "0", if undefined, show ""
      setForm({ ...item });
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const type = item.transactionType;

  // KEY FIX: Just update the state as a string. Do NOT Number() wrap here.
  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    try {
      const ref = doc(logCollection, item.id); // Correct reference

      // CONVERT TO NUMBERS HERE (ON SAVE)
      const updates = {
        lastEdited: serverTimestamp(),
        remarks: form.remarks || "",
      };

      if (type === "ASSIGNMENT") {
        const rawWt = form.rawMaterialWeight === "" ? 0 : Number(form.rawMaterialWeight);
        const purity =
        form.purity !== ""
          ? Number(form.purity)
          : Number(form.rawMaterialPurity || 0);

        // Recalculate Logic
        const newEffective = (rawWt * purity) / 100;

        updates.rawMaterialWeight = rawWt;
        updates.rawMaterialPurity = purity;
        updates.purity = purity;
        updates.effectiveGoldAssigned = newEffective;
        updates.advanceCashPaid = form.advanceCashPaid === "" ? 0 : Number(form.advanceCashPaid);

        if (form.quantityNos !== undefined) {
          updates.quantityNos = form.quantityNos === "" ? 0 : Number(form.quantityNos);
        }
      } else if (type.includes("RETURN")) {
        const retWt = form.returnedWeight === "" ? 0 : Number(form.returnedWeight);
        const wastage = form.wastage === "" ? 0 : Number(form.wastage);
        const purity =
        form.purity !== ""
          ? Number(form.purity)
          : Number(form.rawMaterialPurity || 0);
        
        // Recalculate Logic
        const newEffective = ((retWt + wastage) * purity) / 100;

        updates.returnedWeight = retWt;
        updates.wastage = wastage;
        updates.rawMaterialPurity = purity;
        updates.purity = purity;
        updates.effectiveGoldReturned = newEffective;
        updates.stoneCharges = form.stoneCharges === "" ? 0 : Number(form.stoneCharges);
        updates.ornamentCategory = form.ornamentCategory || "";

        if (form.returnedQuantityNos !== undefined) {
          updates.returnedQuantityNos = form.returnedQuantityNos === "" ? 0 : Number(form.returnedQuantityNos);
        }
      }

      await updateDoc(ref, updates);
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to update record.");
    }
  };

  // Helper to ensure value is never undefined (react warning fix)
  const val = (v) => (v === undefined || v === null ? "" : v);

  const inputClass =
    "w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:bg-white outline-none text-sm transition-all font-medium text-gray-700";
  const labelClass =
    "text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[90] backdrop-blur-sm animate-in zoom-in-95 duration-200">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-amber-600 px-6 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-white font-bold text-lg flex items-center gap-2">
            <Edit className="w-5 h-5" /> Edit Record
          </h2>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white bg-white/10 p-1 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto premium-scroll">
          {type === "ASSIGNMENT" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Raw Wt (g)</label>
                  <input
                    type="number"
                    name="rawMaterialWeight"
                    value={val(form.rawMaterialWeight)}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Purity (%)</label>
                  <input
                    type="number"
                    name="purity"
                    value={val(form.purity || form.rawMaterialPurity)}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
              {form.quantityNos !== undefined && (
                <div>
                  <label className={labelClass}>Quantity (Nos)</label>
                  <input
                    type="number"
                    name="quantityNos"
                    value={val(form.quantityNos)}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              )}
              <div>
                <label className={labelClass}>Advance Cash (₹)</label>
                <input
                  type="number"
                  name="advanceCashPaid"
                  value={val(form.advanceCashPaid)}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {type.includes("RETURN") && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Returned (g)</label>
                  <input
                    type="number"
                    name="returnedWeight"
                    value={val(form.returnedWeight)}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Purity (%)</label>
                  <input
                    type="number"
                    name="purity"
                    value={val(form.purity || form.rawMaterialPurity)}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>
              
              {/* Wastage is editable here */}
              <div>
                  <label className={labelClass}>Wastage (g)</label>
                  <input
                    type="number"
                    name="wastage"
                    value={val(form.wastage)}
                    onChange={handleChange}
                    className={inputClass}
                  />
              </div>

              {form.returnedQuantityNos !== undefined && (
                <div>
                  <label className={labelClass}>Ret. Qty (Nos)</label>
                  <input
                    type="number"
                    name="returnedQuantityNos"
                    value={val(form.returnedQuantityNos)}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              )}
              
              <div>
                  <label className={labelClass}>Stone (₹)</label>
                  <input
                    type="number"
                    name="stoneCharges"
                    value={val(form.stoneCharges)}
                    onChange={handleChange}
                    className={inputClass}
                  />
              </div>
              <div>
                <label className={labelClass}>Ornament Details</label>
                <input
                  type="text"
                  name="ornamentCategory"
                  value={val(form.ornamentCategory)}
                  onChange={handleChange}
                  className={inputClass}
                />
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Remarks / Notes</label>
            <textarea
              name="remarks"
              value={val(form.remarks)}
              onChange={handleChange}
              className={`${inputClass} min-h-[80px] resize-none`}
            />
          </div>
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-3 shrink-0 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-200 rounded-xl text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-amber-600 text-white font-bold rounded-xl hover:bg-amber-700 shadow-lg shadow-amber-600/20 text-sm flex items-center justify-center gap-2 transition-all"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
/* ============================================================
   4. MOBILE TRANSACTION CARD (Responsive Design)
============================================================ */

/* ============================================================
   5. MAIN PAGE COMPONENT
============================================================ */
const EmployeeTransactionProfile = ({ employeeId, employeeName, businessType, onBack }) => {
  const { role, user } = useAuth();
  const canEdit = role === "Admin" || role === "Developer";
  const isGoldsmith = role === "Goldsmith";
  
  const [mapEmail, setMapEmail] = useState("");
  const [mappedEmail, setMappedEmail] = useState("");
  const [mapMobile, setMapMobile] = useState("");
  const [mappedMobile, setMappedMobile] = useState("");     
  const logCollection = businessType === "B2B" ? B2B_MASTER_LOG : B2J_MASTER_LOG;
  
  const [logs, setLogs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("assignments");
  const [toastData, setToastData] = useState(null);

  // Modal States
  const [editOpen, setEditOpen] = useState(false);
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);


  const handleExport = async () => {
    try {
        toast.loading("Generating Statement...", { id: "exp" });
        await exportEmployeeStatement(employeeName, businessType);
        toast.success("Statement Downloaded", { id: "exp" });
    } catch (e) {
        toast.error(e.message, { id: "exp" });
    }
};

  // --- 1. DATA FETCHING ---
  const fetchEmployeeContact = async () => {
  if (!businessType || !employeeName) return;

  try {
    const empListCollection =
      businessType === "B2B"
        ? "employees/B2B/list"
        : "employees/B2J/list";

    const q = query(
      collection(db, empListCollection),
      where("name", "==", employeeName)
    );

    const snap = await getDocs(q);

    if (!snap.empty) {
      const data = snap.docs[0].data();

      if (data?.email) {
        setMappedEmail(data.email);
      }

      if (data?.mobile) {
        setMappedMobile(data.mobile);
      }
    }
  } catch (err) {
    console.error(err);
  }
};

  const fetchData = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(logCollection);
      let arr = snap.docs.map(d => {
      const data = d.data();

      const purity =
        data.purity ??
        data.rawMaterialPurity ??
        0;

      return {
        id: d.id,
        ...data,

        // ✅ FORCE normalize once
        purity: Number(purity),
        rawMaterialPurity: Number(purity),

        wastage: Number(data.wastage || 0),
        returnedWeight: Number(data.returnedWeight || 0),
        rawMaterialWeight: Number(data.rawMaterialWeight || 0),

        displayDate:
          data.dateReturned ||
          data.assignedDate ||
          data.dateAssigned ||
          data.createdAt ||
          null,
      };
    });


      // Filter Logic
      if (isGoldsmith && user?.email) {
        const email = user.email.toLowerCase().trim();
        arr = arr.filter(row =>
          row.employeeName === employeeName
        );
      } else {
        arr = arr.filter(row => row.employeeName === employeeName);
      }

      arr.sort((a, b) => (b.displayDate?.seconds || 0) - (a.displayDate?.seconds || 0));
      setLogs(arr);
    } catch (err) {
      setToastData({ message: "Failed to load logs", type: "error" });
    }
    setLoading(false);
  };

 useEffect(() => {
  fetchEmployeeContact();
  fetchData();
  const unsubOrders = fetchOrders();
  return () => {
    if (unsubOrders) unsubOrders();
  };
}, [employeeId, user?.email, role, businessType, employeeName]);

const fetchOrders = () => {

  const q = query(
    collection(db, "orders"),
    orderBy("audit.lastUpdatedAt", "desc"),
    limit(100)
  );

  return onSnapshot(q, (snapshot) => {

    const rows = [];

    snapshot.docs.forEach((docSnap) => {
      const order = docSnap.data();
      const orderId = docSnap.id;

      (order.items || []).forEach((item, index) => {

        if (item.karigarName !== employeeName) return;

        rows.push({
          orderDocId: orderId,
          index,
          orderId: order.estimationId,
          itemName: item.display || item.item,
          netWeight: item.netWeight,
          deliveryDate: item.deliveryDate,
          status: item.status
        });

      });

    });

    setOrders(rows);

  });

};

const handleMapMobile = async () => {
  if (mapMobile.length < 10) {
    alert("Invalid Mobile Number");
    return;
  }

  try {
    const empListCollection =
      businessType === "B2B"
        ? "employees/B2B/list"
        : "employees/B2J/list";

    let targetId = employeeId;

    if (!targetId) {
      const q = query(
        collection(db, empListCollection),
        where("name", "==", employeeName)
      );

      const snap = await getDocs(q);

      if (snap.empty) throw new Error("Employee not found");

      targetId = snap.docs[0].id;
    }

    await updateDoc(
      doc(db, empListCollection, targetId),
      {
        mobile: mapMobile.trim(),
        updatedAt: serverTimestamp(),
      }
    );

    setMappedMobile(mapMobile);
    setMapMobile("");

    setToastData({ message: "Mobile number linked successfully" });
  } catch (err) {
    console.error(err);
    alert("Mobile mapping failed");
  }
};

  // --- 2. CALCULATIONS ---
  let amountBalance = 0;
  let b2jGoldBalance = 0;
  let b2bPendingWeight = 0;
  let b2bPendingQty = 0;
  let displayTotalAssigned = 0;
  let displayTotalReturned = 0;

  logs.forEach((row) => {
    if (row.transactionType === "ASSIGNMENT") amountBalance += Number(row.advanceCashPaid || 0);
    if (row.transactionType.includes("RETURN")) amountBalance -= Number(row.stoneCharges || 0);

    if (businessType === "B2J") {
        if (row.transactionType === "ASSIGNMENT") {
            const eff = Number(row.effectiveGoldAssigned || 0);
            b2jGoldBalance += eff;
            displayTotalAssigned += eff; 
        }
        if (row.transactionType.includes("RETURN")) {
            const rawB = row.effectiveGoldReturned ?? ((Number(row.returnedWeight)+Number(row.wastage)) * Number(row.purity))/100;
            b2jGoldBalance -= Number(rawB);
            displayTotalReturned += Number(rawB);
        }
    }
    if (businessType === "B2B") {
        if (row.transactionType === "ASSIGNMENT") {
            displayTotalAssigned += Number(row.rawMaterialWeight || 0);
            if(!row.isClosed) {
                b2bPendingWeight += (row.remainingWeight !== undefined ? Number(row.remainingWeight) : Number(row.rawMaterialWeight));
                b2bPendingQty += (row.remainingQuantity !== undefined ? Number(row.remainingQuantity) : Number(row.quantityNos));
            }
        }
        if (row.transactionType.includes("RETURN")) displayTotalReturned += (Number(row.returnedWeight) + Number(row.wastage));
    }
  });

  const assignmentRows = logs.filter((l) => l.transactionType === "ASSIGNMENT");
  const returnRows = logs.filter((l) => l.transactionType.includes("RETURN"));

  // --- 3. HANDLERS ---
  const handleMapEmail = async () => {
    if (!mapEmail.includes("@")) return alert("Invalid Email");
    try {
      const empListCollection = businessType === "B2B" ? "employees/B2B/list" : "employees/B2J/list";
      let targetId = employeeId;
      if (!targetId) {
         const q = query(collection(db, empListCollection), where("name", "==", employeeName));
         const snap = await getDocs(q);
         if(snap.empty) throw new Error("Emp not found");
         targetId = snap.docs[0].id;
      }
      await updateDoc(doc(db, empListCollection, targetId), { email: mapEmail.toLowerCase().trim(), updatedAt: serverTimestamp() });
      setMappedEmail(mapEmail);
      setMapEmail("");
      setToastData({ message: "Email mapped successfully" });
    } catch(e) { alert("Mapping failed"); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record permanently?")) return;
    try {
      await deleteDoc(doc(logCollection.firestore, logCollection.path, id));
      setToastData({ message: "Record Deleted" });
      fetchData();
    } catch (err) { setToastData({ message: "Delete failed", type: "error" }); }
  };

  const handleCorrectionRequest = async (item, requestedChanges, reason) => {
  try {
    await addDoc(collection(db, "CORRECTION_REQUESTS"), {
      targetCollection: logCollection.path,
      targetDocId: item.id,
      employeeName,
      businessType,
      transactionType: item.transactionType,
      requestedChanges,
      reason,
      status: "PENDING",
      requestedAt: serverTimestamp(),
      requestedBy: user?.email || null
    });

    await updateDoc(
      doc(logCollection.firestore, logCollection.path, item.id),
      { correctionRequested: true }
    );

    setToastData({ message: "Correction requested successfully" });
    fetchData();
  } catch (err) {
    console.error(err);
    setToastData({ message: "Request failed", type: "error" });
  }
};

const startWork = async (row) => {

  const ref = doc(db, "orders", row.orderDocId);
  const snap = await getDoc(ref);

  const data = snap.data();
  const items = [...data.items];

  items[row.index].status = "sent_to_karigar";
  items[row.index].sentAt = new Date(); // ✅ FIX

  await updateDoc(ref, {
    items,
    status: "sent_to_karigar",
    "audit.lastUpdatedAt": serverTimestamp() // allowed because not inside array
  });

};

const markReturned = async (row) => {

  const ref = doc(db, "orders", row.orderDocId);
  const snap = await getDoc(ref);

  const data = snap.data();
  const items = [...data.items];

  items[row.index].status = "returned";
  items[row.index].returnedAt = new Date(); // ✅ FIX

  await updateDoc(ref, {
    items,
    status: "returned",
    "audit.lastUpdatedAt": serverTimestamp()
  });

};


  // --- 4. RENDER HELPERS ---
  const renderActions = (r) => (
    <>
      {canEdit && (
        <>
          <button onClick={() => { setSelectedItem(r); setEditOpen(true); }} className="text-amber-600 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg transition-colors"><Edit className="w-4 h-4" /></button>
          <button onClick={() => handleDelete(r.id)} className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
        </>
      )}
      {isGoldsmith && !r.correctionRequested && !r.isClosed && (
          <button onClick={() => { setSelectedItem(r); setCorrectionOpen(true); }} className="text-xs text-blue-600 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 font-bold ml-auto transition-colors">Request Fix</button>
      )}
      {r.correctionRequested && (
        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-1 rounded font-bold">
          Pending Fix
        </span>
      )}
      {!r.correctionRequested && r.correctedByAdmin && (
        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded font-bold">
          Corrected
        </span>
      )}
    </>
  );

  if (loading) return <div className="h-96 flex flex-col items-center justify-center text-gray-400 gap-3"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div><span className="text-sm font-medium">Loading Profile...</span></div>;

  return (
  <div className="bg-[#F8FAFC] h-screen overflow-hidden font-sans text-slate-800 flex flex-col">
    
    {/* TOP FIXED SECTION (Header + Stats) */}
    <div className="flex-none p-4 md:p-6 lg:px-8 lg:pt-8">
      {/* Navigation & Export */}
      <div className="flex items-center justify-between gap-4 mb-6">
        {!isGoldsmith && (
          <button onClick={onBack} className="flex items-center px-4 py-2 text-sm font-bold text-slate-600 bg-white rounded-xl shadow-sm border border-slate-200 hover:border-amber-500 transition-all active:scale-95">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </button>
        )}
        <button onClick={handleExport} className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-200 active:scale-95 ml-auto">
          <Download className="w-4 h-4" /> <span>Statement</span>
        </button>
      </div>

      {/* HEADER PROFILE CARD */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-2xl text-amber-700"><User className="w-6 h-6" /></div>
            <div>
              <h2 className="text-xl font-black text-slate-900 leading-tight">{employeeName}</h2>
              <div className="flex gap-3 mt-1">
                {mappedEmail && <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3 text-amber-500"/> {mappedEmail}</span>}
                {mappedMobile && <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3 text-blue-500"/> {mappedMobile}</span>}
              </div>
            </div>
          </div>
          
          {/* STATS MINI-GRID */}
          <div className="flex flex-wrap gap-2">
            <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 min-w-[120px]">
              <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest">Type</p>
              <p className="text-xs font-bold text-slate-700">{businessType === 'B2B' ? 'Wholesale' : 'Job Work'}</p>
            </div>
            {businessType === "B2J" ? (
              <div className="bg-amber-50 px-4 py-2 rounded-xl border border-amber-100 min-w-[120px]">
                <p className="text-[9px] text-amber-700 uppercase font-black">Gold Bal</p>
                <p className={`text-sm font-black ${b2jGoldBalance > 0.001 ? 'text-red-600' : 'text-emerald-600'}`}>{Number(b2jGoldBalance).toFixed(3)}g</p>
              </div>
            ) : (
              <div className="bg-red-50 px-4 py-2 rounded-xl border border-red-100 min-w-[120px]">
                <p className="text-[9px] text-red-600 uppercase font-black">Pending Wt</p>
                <p className="text-sm font-black text-red-700">{b2bPendingWeight.toFixed(3)}g</p>
              </div>
            )}
            <div className="bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 min-w-[120px]">
              <p className="text-[9px] text-emerald-700 uppercase font-black">Cash Bal</p>
              <p className={`text-sm font-black ${amountBalance > 0 ? 'text-red-600' : 'text-emerald-700'}`}>₹{Number(amountBalance).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex overflow-x-auto no-scrollbar bg-slate-200/50 p-1 rounded-2xl border border-slate-200/40">
        {["assignments", "returns", "summary", "newOrders", "existingWork"].map((t) => (
          <button key={t} onClick={() => setActiveTab(t)} className={`flex-1 px-4 py-2 rounded-xl text-[11px] font-black tracking-wide whitespace-nowrap transition-all ${activeTab === t ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </div>

    {/* SCROLLABLE CONTENT AREA */}
    <div className={`flex-1 overflow-y-auto premium-scroll px-4 md:px-6 lg:px-8 pb-32`}>
      <div className="max-w-7xl mx-auto space-y-4 py-2">
        {/* SUMMARY TAB */}
        {activeTab === "summary" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-white p-5 rounded-2xl border shadow-sm flex items-center gap-4">
               <div className="p-3 bg-slate-50 rounded-xl text-slate-400"><Calendar className="w-5 h-5"/></div>
               <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase">Last Activity</p>
                  <p className="text-sm font-bold text-slate-700">{logs[0]?.displayDate?.seconds ? new Date(logs[0].displayDate.seconds * 1000).toLocaleString() : "None"}</p>
               </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-amber-500">
               <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Issued</p>
               <p className="text-2xl font-black text-slate-900">{Number(displayTotalAssigned).toFixed(3)} <span className="text-sm font-normal text-slate-400">g</span></p>
            </div>
            <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-emerald-500">
               <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Returned</p>
               <p className="text-2xl font-black text-slate-900">{Number(displayTotalReturned).toFixed(3)} <span className="text-sm font-normal text-slate-400">g</span></p>
            </div>
          </div>
        )}
        {/* ASSIGNMENTS / RETURNS CARDS (Mobile & Medium) */}
        {(activeTab === "assignments" || activeTab === "returns") && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in">
            {(activeTab === "assignments" ? assignmentRows : returnRows).map(r => (
              <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:border-amber-200 transition-all group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase">{activeTab === "assignments" ? "Weight Issued" : "Weight Returned"}</span>
                    <span className="text-xl font-black text-slate-900">{Number(activeTab === "assignments" ? r.rawMaterialWeight : r.returnedWeight).toFixed(2)}g</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase italic">{r.displayDate?.seconds ? new Date(r.displayDate.seconds * 1000).toLocaleDateString() : "-"}</span>
                    <p className="text-sm font-bold text-amber-600">{r.rawMaterialPurity || r.purity}% Purity</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-4 text-xs">
                  {activeTab === "assignments" ? (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                        Advance Cash Paid
                      </span>
                      <span className="font-black text-indigo-600">
                        ₹{Number(r.advanceCashPaid ?? 0).toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between w-full">
                        {/* Wastage */}
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            Wastage
                          </span>
                          <span className="font-black text-amber-600">
                            {Number(r.wastage ?? 0).toFixed(2)}g
                          </span>
                        </div>
                        {/* Stone Charges */}
                        <div className="flex flex-col text-right">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            Stone Charges
                          </span>
                          <span className="font-black text-indigo-600">
                            ₹{Number(r.stoneCharges ?? 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </>                 
                  )}
                </div>
                

                <div className="flex gap-2 justify-end opacity-90 group-hover:opacity-100 transition-opacity">
                  {renderActions(r)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ORDER ACTION CARDS (New Orders & Existing Work) */}
        {(activeTab === "newOrders" || activeTab === "existingWork") && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-in fade-in">
            {orders.filter(o => {
              if (activeTab === "newOrders") {
                return o.status === "assigned";
              }

              if (activeTab === "existingWork") {
                return o.status === "sent_to_karigar" || o.status === "returned";
              }

              return false;
            })
              .map(o => (
                <div key={o.orderId} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-4">
                     <span className="px-2 py-1 bg-slate-100 rounded-md font-mono text-xs font-bold text-slate-500">#{o.orderId}</span>
                     <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${
                      o.status === "returned"
                        ? "bg-emerald-100 text-emerald-700"
                        : activeTab === "newOrders"
                        ? "bg-yellow-50 text-yellow-700"
                        : "bg-blue-50 text-blue-700 animate-pulse"
                      }`}>
                      {activeTab === 'newOrders' ? 'Assigned' : 'In Progress'}
                     </span>
                  </div>
                  <h4 className="font-black text-slate-800 text-lg mb-1 leading-tight">{o.itemName}</h4>
                  <p className="text-sm text-slate-500 mb-6 flex items-center gap-1"><Scale className="w-3.5 h-3.5"/> {o.netWeight} g Target</p>
                  
                  {isGoldsmith ? (
                    <button onClick={() => activeTab === "newOrders" ? startWork(o) : markReturned(o)} className={`w-full py-3.5 rounded-xl text-xs font-black text-white shadow-lg transition-all active:scale-95 ${activeTab === 'newOrders' ? 'bg-blue-600 shadow-blue-100' : 'bg-emerald-600 shadow-emerald-100'}`}>
                      {activeTab === "newOrders" ? "START PRODUCTION" : "MARK AS RETURNED"}
                    </button>
                  ) : (
                    <div className="py-3 text-center text-[10px] font-black text-slate-300 border-2 border-dashed border-slate-100 rounded-xl uppercase tracking-widest">Awaiting Worker Action</div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </div>

    {/* MODALS & TOASTS (Overlay) */}
    <EditModal isOpen={editOpen} item={selectedItem} logCollection={logCollection} onClose={() => setEditOpen(false)} onSave={fetchData} />
    <CorrectionModal isOpen={correctionOpen} item={selectedItem} onClose={() => setCorrectionOpen(false)} onSubmit={handleCorrectionRequest} />
    <AnimatePresence>{toastData && <Toast {...toastData} onClose={() => setToastData(null)} />}</AnimatePresence>
  </div>
);
};

export default EmployeeTransactionProfile;