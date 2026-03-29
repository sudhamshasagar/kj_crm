// src/components/B2BAssignmentForm.jsx
import React, { useState, useEffect } from "react";
import { Save, AlertTriangle } from "lucide-react";
import { useAuth } from "../../AuthContext";
import { B2B_MASTER_LOG } from "../../firebaseConfig";
import { useOrnamentCategories } from "../../hooks/useOrnamentCategories";
import { useB2BEmployees } from "../../hooks/useB2BEmployees";
import {
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

// 🔹 Reusable Input Field
const InputField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  unit = "",
  mandatory = false,
  disabled = false,
}) => (
  <div className="space-y-1">
    <label className="text-sm font-medium text-gray-700 flex justify-between items-center">
      {label} {mandatory && <span className="text-red-500">*</span>}
    </label>
    <div className="flex bg-gray-50 rounded-lg border border-gray-200">
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        step={type === "number" ? "any" : undefined}
        className={`w-full p-3 bg-transparent focus:outline-none text-gray-800 rounded-lg ${
          disabled ? "text-gray-500 cursor-not-allowed" : ""
        }`}
        min={type === "number" ? 0 : undefined}
      />
      {unit && (
        <span className="p-3 text-gray-500 bg-gray-100 rounded-r-lg text-sm">
          {unit}
        </span>
      )}
    </div>
  </div>
);

const B2BAssignmentForm = ({ onFormSuccess }) => {
  const { role, ROLES } = useAuth();
  const { employees, isLoading: isLoadingEmployees } = useB2BEmployees();
  const { categories: ornamentCategories, isLoading: isLoadingOrnaments } =
    useOrnamentCategories();

  const [formData, setFormData] = useState({
    goldsmithName: "",
    ornamentCategory: "",
    rawMaterialWeight: "",
    purity: "",
    advanceCashPaid: "",
    quantityNos: "",
    stoneCharges: "",
    remarks: "",
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 🔹 Submit Assignment
  const handleAssign = async (e) => {
    e.preventDefault();

    if (!formData.goldsmithName || !formData.ornamentCategory) {
      alert("Fill all required fields");
      return;
    }

    if (Number(formData.rawMaterialWeight) <= 0) {
      alert("Raw Material Weight must be greater than 0");
      return;
    }

    setLoading(true);

    try {
      const {
        goldsmithName,
        ornamentCategory,
        rawMaterialWeight,
        purity,
        quantityNos,
        advanceCashPaid,
        stoneCharges,
      } = formData;

      // 1. Generate ID
      const prefix = ornamentCategory.substring(0, 4).toUpperCase();
      const orderId = `ORD-${prefix}-${Math.round(
        Number(purity)
      )}-${new Date().toLocaleDateString("en-IN").replace(/\//g, "")}`;

      const weight = Number(rawMaterialWeight);
      const qty = Number(quantityNos || 0);

      // 2. Create Firestore Doc
      // ⚠️ CHANGED LOGIC: 
      // remainingWeight starts equal to rawMaterialWeight. 
      // remainingQuantity starts equal to quantityNos.
      // We do NOT multiply by purity for the balance anymore.

      const newDoc = {
        orderId,
        transactionType: "ASSIGNMENT",
        employeeName: goldsmithName,
        
        // Input Data
        rawMaterialWeight: weight,
        purity: Number(purity),
        ornamentCategory,
        advanceCashPaid: Number(advanceCashPaid || 0),
        stoneCharges: Number(stoneCharges || 0),
        
        // Quantity Logic
        quantityNos: qty,
        remainingQuantity: qty, // Starts full

        // Weight Logic
        remainingWeight: weight, // Starts full
        
        remarks: formData.remarks,
        assignedDate: serverTimestamp(),
        
        isClosed: false,
      };

      await addDoc(B2B_MASTER_LOG, newDoc);

      alert(`Assignment Created: ${orderId}`);
      onFormSuccess();
    } catch (err) {
      console.error(err);
      alert("Failed to submit. Check console.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 w-full px-5 md:px-8 py-6 md:py-8">
      <form onSubmit={handleAssign} className="space-y-8">
        
        {/* Form Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm font-medium text-gray-600">
              Select Goldsmith <span className="text-red-500">*</span>
            </label>
            <select
              name="goldsmithName"
              value={formData.goldsmithName}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-400"
              disabled={loading || isLoadingEmployees}
            >
              <option value="">
                {isLoadingEmployees ? "Loading..." : "-- Select Goldsmith --"}
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-600">
              Ornament Category <span className="text-red-500">*</span>
            </label>
            <select
              name="ornamentCategory"
              value={formData.ornamentCategory}
              onChange={handleChange}
              className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:ring-2 focus:ring-amber-400"
              disabled={loading || isLoadingOrnaments}
            >
              <option value="">
                {isLoadingOrnaments ? "Loading..." : "-- Select Category --"}
              </option>
              {ornamentCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Weights & Cash */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">

          <InputField
            label="Raw Material Wt"
            name="rawMaterialWeight"
            value={formData.rawMaterialWeight}
            onChange={handleChange}
            type="number"
            unit="gms"
            mandatory
            disabled={loading}
          />

          <InputField
            label="Purity"
            name="purity"
            value={formData.purity}
            onChange={handleChange}
            type="number"
            step="0.1"
            unit="%"
            mandatory
            disabled={loading}
          />

          <InputField
            label="Quantity (Nos)"
            name="quantityNos"
            value={formData.quantityNos}
            onChange={handleChange}
            type="number"
            mandatory
            disabled={loading}
          />

          <InputField
            label="Advance Cash"
            name="advanceCashPaid"
            value={formData.advanceCashPaid}
            onChange={handleChange}
            type="number"
            unit="₹"
            disabled={loading}
          />

          <InputField
            label="Stone Charges"
            name="stoneCharges"
            value={formData.stoneCharges}
            onChange={handleChange}
            type="number"
            unit="₹"
            disabled={loading}
          />

        </div>

        <InputField label="Remarks" name="remarks" value={formData.remarks} onChange={handleChange} disabled={loading} />

        <button type="submit" disabled={loading || !formData.goldsmithName || formData.rawMaterialWeight <= 0 || !formData.ornamentCategory} className="w-full py-3 bg-amber-600 text-white rounded-xl font-bold text-lg hover:bg-amber-700 transition duration-300 shadow-md flex items-center justify-center disabled:bg-gray-400">
          {loading ? "Submitting..." : <><Save className="w-5 h-5 mr-2" /> Submit Assignment</>}
        </button>
      </form>
    </div>
  );
};

export default B2BAssignmentForm;