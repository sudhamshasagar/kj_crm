// src/components/B2JReturnForm.jsx
import React, { useState } from "react";
import { Save, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { useAuth } from "../../AuthContext";
import { B2J_MASTER_LOG } from "../../firebaseConfig";
import {
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { useB2JEmployees } from "../../hooks/useB2JEmployees";
import { useOrnamentCategories } from "../../hooks/useOrnamentCategories";

/* ---------------- CONSTANTS ---------------- */

const PRESET_PURITY_VALUES = [91.70, 75.00, 83.50];

/* ---------------- HELPERS ---------------- */

const getLastRemainingBalance = async (db, employeeName) => {
  try {
    const qBal = query(
      B2J_MASTER_LOG,
      where("employeeName", "==", employeeName),
      orderBy("dateReturned", "desc")
    );

    const snap = await getDocs(qBal);
    if (snap.empty) return 0;

    for (let docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.remainingBalance !== undefined) {
        return Number(data.remainingBalance);
      }
    }
    return 0;
  } catch (err) {
    console.error("Balance fetch error:", err);
    return 0;
  }
};

/* ---------------- COMPONENT ---------------- */

const B2JReturnForm = ({ onFormSuccess }) => {
  const { db } = useAuth();

  const { employees, isLoading: empLoading } = useB2JEmployees();
  const { categories } = useOrnamentCategories();

  const [formData, setFormData] = useState({
    goldsmithName: "",
    returnedWeight: "",
    wastage: "",
    rawMaterialPurity: "",
    stoneCharges: "",
    ornamentCategory: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(false);

  /* ---------------- HANDLERS ---------------- */

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  /* ---------------- SUBMIT ---------------- */

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.goldsmithName) {
      toast.error("Select a Goldsmith");
      return;
    }

    const returnedWt = Number(formData.returnedWeight || 0);
    const wastage = Number(formData.wastage || 0);
    const purityDecimal = Number(formData.rawMaterialPurity || 0) / 100;

    if (!returnedWt || !purityDecimal) {
      toast.error("Returned Weight and Purity are required");
      return;
    }

    const effectiveGoldReturned = (returnedWt + wastage) * purityDecimal;

    setLoading(true);

    try {
      const lastBalance = await getLastRemainingBalance(
        db,
        formData.goldsmithName
      );

      const newRemaining = lastBalance - effectiveGoldReturned;

      const now = new Date();
      const dt = now.toLocaleDateString("en-IN").replace(/\//g, "");
      const tm = now
        .toLocaleTimeString("en-IN", { hour12: false })
        .replace(/:/g, "");

      const returnId = `RET-${dt}-${tm}`;

      await addDoc(B2J_MASTER_LOG, {
        returnId,
        transactionType: "RETURN",
        employeeName: formData.goldsmithName,

        returnedWeight: returnedWt,
        wastage,
        rawMaterialPurity: Number(formData.rawMaterialPurity),
        effectiveGoldReturned,

        stoneCharges: Number(formData.stoneCharges || 0),
        ornamentCategory: formData.ornamentCategory || "",
        remarks: formData.remarks || "",

        lastBalance,
        remainingBalance: newRemaining,

        dateReturned: serverTimestamp(),
      });

      toast.success("Return submitted successfully");
      onFormSuccess?.();

      // Auto reset for next entry
      setFormData({
        goldsmithName: "",
        returnedWeight: "",
        wastage: "",
        rawMaterialPurity: "",
        stoneCharges: "",
        ornamentCategory: "",
        remarks: "",
      });
    } catch (err) {
      console.error(err);
      toast.error("Error submitting return");
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

          {/* GRID */}
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

            <div>
              <label className="text-sm font-medium text-gray-700">
                Returned Weight (gms)
              </label>
              <input
                type="number"
                name="returnedWeight"
                value={formData.returnedWeight}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Wastage (gms)
              </label>
              <input
                type="number"
                name="wastage"
                value={formData.wastage}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
              />
            </div>
          </div>

          {/* Purity */}
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

          {/* Extras */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className="text-sm font-medium text-gray-700">
                Stone Charges (₹)
              </label>
              <input
                type="number"
                name="stoneCharges"
                value={formData.stoneCharges}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">
                Ornament Category
              </label>
              <select
                name="ornamentCategory"
                value={formData.ornamentCategory}
                onChange={handleChange}
                className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
              >
                <option value="">-- Select Category --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Remarks
            </label>
            <input
              type="text"
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              className="w-full p-2.5 rounded-lg border border-gray-300 bg-white"
            />
          </div>

          {/* Submit */}
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
                  <Save className="w-5 h-5" /> Submit Return
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default B2JReturnForm;
