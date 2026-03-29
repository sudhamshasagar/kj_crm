// src/components/B2JAssignmentForm.jsx
import React, { useState, useEffect, useMemo } from "react";
import { Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../AuthContext";
import { useB2JEmployees } from "../../hooks/useB2JEmployees";
import { useOrnamentCategories } from "../../hooks/useOrnamentCategories";
import { B2J_MASTER_LOG } from "../../firebaseConfig";
import {
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";

/* ---------------- CONSTANTS ---------------- */

const PRESET_PURITY_VALUES = [91.7, 100, 83.5,75];

/* ---------------- REUSABLE INPUT ---------------- */

const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  unit = "",
  mandatory = false,
}) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700">
      {label} {mandatory && <span className="text-red-500">*</span>}
    </label>
    <div className="flex bg-gray-50 rounded-lg border border-gray-200 focus-within:border-amber-600">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full p-2.5 bg-transparent text-gray-800 focus:outline-none"
      />
      {unit && (
        <span className="px-3 flex items-center text-gray-500 bg-gray-100 rounded-r-lg text-sm">
          {unit}
        </span>
      )}
    </div>
  </div>
);

/* ---------------- FIRESTORE HELPERS ---------------- */

const getLastRemainingBalance = async (db, employeeName) => {
  try {
    const q = query(
      B2J_MASTER_LOG,
      where("employeeName", "==", employeeName),
      orderBy("assignedDate", "desc"),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return 0;
    return snap.docs[0].data().remainingBalance || 0;
  } catch (err) {
    console.error("Balance fetch error:", err);
    return 0;
  }
};

/* ---------------- MAIN COMPONENT ---------------- */

const B2JAssignmentForm = ({ onFormSuccess }) => {
  const { db } = useAuth();
  const { employees, isLoading: empLoading } = useB2JEmployees();
  useOrnamentCategories(); // retained for compatibility

  const [formData, setFormData] = useState({
    goldsmithName: "",
    rawMaterialWeight: "",
    rawMaterialPurity: "",
    advanceCashPaid: "",
    remarks: "",
  });

  const [orders] = useState([]);
  const [openReturns, setOpenReturns] = useState([]);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ---------------- LOAD OPEN RETURNS ---------------- */

  useEffect(() => {
    const loadReturns = async () => {
      setOpenReturns([]);
      setSelectedReturn(null);

      if (!formData.goldsmithName) return;

      const qR = query(
        B2J_MASTER_LOG,
        where("employeeName", "==", formData.goldsmithName),
        where("transactionType", "==", "RETURN"),
        where("isReconciled", "==", false)
      );

      const snap = await getDocs(qR);
      setOpenReturns(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };

    loadReturns();
  }, [formData.goldsmithName]);

  /* ---------------- HANDLERS ---------------- */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.goldsmithName ||
      !formData.rawMaterialWeight ||
      !formData.rawMaterialPurity
    ) {
      toast.error("Goldsmith, Raw Material Weight & Purity are required");
      return;
    }

    setLoading(true);

    try {
      const rawWt = Number(formData.rawMaterialWeight);
      const purityDecimal = Number(formData.rawMaterialPurity) / 100;
      const effectiveGold = rawWt * purityDecimal;

      const lastBalance = await getLastRemainingBalance(
        db,
        formData.goldsmithName
      );

      const newBalance = lastBalance + effectiveGold;

      const now = new Date();
      const dt = now.toLocaleDateString("en-IN").replace(/\//g, "");
      const tm = now
        .toLocaleTimeString("en-IN", { hour12: false })
        .replace(/:/g, "");

      const assignmentId = `B2J-${formData.rawMaterialPurity}-${dt}-${tm}`;

      if (selectedReturn) {
        const rRef = doc(
          B2J_MASTER_LOG.firestore,
          B2J_MASTER_LOG.path,
          selectedReturn.id
        );
        await updateDoc(rRef, {
          isReconciled: true,
          reconciledByAssignment: assignmentId,
          reconciliationDate: serverTimestamp(),
        });
      }

      await addDoc(B2J_MASTER_LOG, {
        assignmentId,
        transactionType: "ASSIGNMENT",
        employeeName: formData.goldsmithName,
        rawMaterialWeight: rawWt,
        rawMaterialPurity: Number(formData.rawMaterialPurity),
        effectiveGoldAssigned: effectiveGold,
        advanceCashPaid: Number(formData.advanceCashPaid || 0),
        remainingBalance: newBalance,
        assignedDate: serverTimestamp(),
        remarks: formData.remarks || "",
        orders,
        linkedReturnId: selectedReturn?.id || null,
      });

      toast.success("Assignment saved successfully");
      onFormSuccess?.(); // dashboard refresh only
      setFormData({
        goldsmithName: "",
        rawMaterialWeight: "",
        rawMaterialPurity: "",
        advanceCashPaid: "",
        remarks: "",
      });
      setSelectedReturn(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save assignment");
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-50 via-white to-amber-100 opacity-70" />

      <div className="relative bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-amber-200 p-6 max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* GRID – compact on large screens */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Goldsmith */}
            <div>
              <label className="text-sm font-semibold text-gray-800">
                Select Goldsmith <span className="text-red-500">*</span>
              </label>
              <select
                name="goldsmithName"
                value={formData.goldsmithName}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-gray-50 focus:ring-2 focus:ring-amber-600"
              >
                <option value="">
                  {empLoading ? "Loading..." : "-- Select Goldsmith --"}
                </option>
                {employees.map((e) => (
                  <option key={e.id} value={e.name}>
                    {e.name}
                  </option>
                ))}
              </select>
            </div>

            <InputField
              label="Raw Material Weight (gms)"
              name="rawMaterialWeight"
              value={formData.rawMaterialWeight}
              onChange={handleChange}
              type="number"
              mandatory
            />

            <InputField
              label="Advance Cash Paid"
              name="advanceCashPaid"
              value={formData.advanceCashPaid}
              onChange={handleChange}
              type="number"
              unit="₹"
            />
          </div>

          {/* Purity – full width but compact */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Raw Material Purity (%) <span className="text-red-500">*</span>
            </label>

            <div className="flex flex-wrap gap-2">
              {PRESET_PURITY_VALUES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      rawMaterialPurity: p,
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                    Number(formData.rawMaterialPurity) === p
                      ? "bg-amber-700 text-white"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>

            <div className="flex bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="number"
                name="rawMaterialPurity"
                value={formData.rawMaterialPurity}
                onChange={handleChange}
                placeholder="Manual purity"
                className="w-full p-2.5 bg-transparent text-gray-800 focus:outline-none"
              />
              <span className="px-3 flex items-center text-gray-500 bg-gray-100">
                %
              </span>
            </div>
          </div>

          <InputField
            label="Remarks"
            name="remarks"
            value={formData.remarks}
            onChange={handleChange}
          />

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2.5 bg-gradient-to-r from-amber-700 to-amber-900 text-white rounded-xl font-semibold shadow-lg disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Processing
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" /> Submit Assignment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default B2JAssignmentForm;
