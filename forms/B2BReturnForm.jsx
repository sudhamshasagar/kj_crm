// src/components/B2BReturnForm.jsx
import React, { useState, useEffect } from "react";
import { Zap } from "lucide-react";
import { B2B_MASTER_LOG } from "../../firebaseConfig";
import {
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

import { useB2BEmployees } from "../../hooks/useB2BEmployees";

const B2BReturnForm = ({ onFormSuccess }) => {
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  
  // Limits for dropdowns
  const [maxQty, setMaxQty] = useState(0);

  const { employees } = useB2BEmployees();
  const [loading, setLoading] = useState(false);

  const [returnData, setReturnData] = useState({
    returnedWeight: "",
    wastage: "",
    returnedQuantityNos: "",
    stoneCharges: "",
    remarks: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setReturnData((p) => ({ ...p, [name]: value }));
  };

  /* 1. Fetch Open Assignments for Employee */
  useEffect(() => {
    setAssignments([]);
    setSelectedAssignment(null);
    setMaxQty(0);

    if (selectedEmployee) {
      const fetchData = async () => {
        try {
          const q = query(
            B2B_MASTER_LOG,
            where("employeeName", "==", selectedEmployee),
            where("transactionType", "==", "ASSIGNMENT"),
            where("isClosed", "==", false)
          );
          const snap = await getDocs(q);
          const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setAssignments(data);
        } catch (err) {
          console.error("Assignment fetch error:", err);
        }
      };
      fetchData();
    }
  }, [selectedEmployee]);

  /* 2. When Assignment Selected, Set Limits */
  useEffect(() => {
    if (selectedAssignment) {
      // Logic: If 'remainingQuantity' exists, use it. Otherwise fallback to original quantityNos.
      const remaining = selectedAssignment.remainingQuantity !== undefined 
        ? Number(selectedAssignment.remainingQuantity) 
        : Number(selectedAssignment.quantityNos);

      setMaxQty(remaining);
      
      // Reset form fields
      setReturnData({
        returnedWeight: "",
        wastage: "",
        returnedQuantityNos: "",
        stoneCharges: "",
        remarks: "",
      });
    }
  }, [selectedAssignment]);

  /* 3. Submit Return */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedAssignment) {
      alert("Please select an assignment.");
      return;
    }

    if (!returnData.returnedQuantityNos || !returnData.returnedWeight) {
      alert("Quantity and Weight are required.");
      return;
    }

    setLoading(true);

    try {
      // -- INPUTS --
      const retQty = Number(returnData.returnedQuantityNos);
      const retWeight = Number(returnData.returnedWeight);
      const wastage = Number(returnData.wastage || 0);

      // -- PREVIOUS VALUES FROM ASSIGNMENT --
      const prevRemQty = selectedAssignment.remainingQuantity !== undefined 
        ? Number(selectedAssignment.remainingQuantity) 
        : Number(selectedAssignment.quantityNos);

      const prevRemWeight = selectedAssignment.remainingWeight !== undefined
        ? Number(selectedAssignment.remainingWeight)
        : Number(selectedAssignment.rawMaterialWeight);

      // -- CALCULATE NEW BALANCES (Specific to this Order) --
      const newRemQty = prevRemQty - retQty;
      
      // Logic: Pending Weight = Previous Pending - (Returned + Wastage)
      // Example: Assigned 25g. Returned 15g. Wastage 0. New Pending = 10g.
      const newRemWeight = prevRemWeight - (retWeight + wastage);

      const isFullClose = newRemQty <= 0 && newRemWeight <= 0.1; // Tolerance for weight

      const returnId = `RTN-${Date.now()}`;

      /* A. CREATE RETURN LOG */
      await addDoc(B2B_MASTER_LOG, {
        orderId: returnId,
        transactionType: isFullClose ? "RETURN_CLOSED" : "RETURN_PARTIAL",
        employeeName: selectedEmployee,

        // Linked Data
        linkedAssignmentId: selectedAssignment.id,
        linkedAssignmentOrderId: selectedAssignment.orderId,
        ornamentCategory: selectedAssignment.ornamentCategory,
        purity: selectedAssignment.purity,

        // Return Data
        returnedWeight: retWeight,
        wastage: wastage,
        returnedQuantityNos: retQty,
        stoneCharges: Number(returnData.stoneCharges || 0),
        remarks: returnData.remarks,

        // Snapshot of Balance at this moment
        remainingQuantityAfterReturn: newRemQty,
        remainingWeightAfterReturn: newRemWeight,

        assignedDate: serverTimestamp(),
      });

      /* B. UPDATE THE ORIGINAL ASSIGNMENT DOC */
      const ref = doc(B2B_MASTER_LOG.firestore, B2B_MASTER_LOG.path, selectedAssignment.id);

      await updateDoc(ref, {
        remainingQuantity: newRemQty,
        remainingWeight: newRemWeight,
        isClosed: isFullClose, // Close if Qty is 0 (or add logic to require weight 0 too)
        lastUpdated: serverTimestamp(),
      });

      alert(`Return Successful! Remaining: ${newRemWeight}g / ${newRemQty} Nos`);
      onFormSuccess?.();
      
      // Refresh list
      setSelectedAssignment(null);
      setAssignments((prev) => prev.filter(a => a.id !== selectedAssignment.id)); // Optimistic update
      
    } catch (err) {
      console.error("B2B return error:", err);
      alert("Error submitting return.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border p-6">

      {/* Employee Picker */}
      <div className="mb-4">
        <label className="text-sm font-semibold">Select Goldsmith</label>
        <select
          className="w-full p-3 border rounded-lg bg-gray-50 mt-1"
          value={selectedEmployee}
          onChange={(e) => setSelectedEmployee(e.target.value)}
        >
          <option value="">-- Select --</option>
          {employees.map((e) => (
            <option key={e.id} value={e.name}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      {/* Open Assignments */}
      {assignments.length > 0 && (
        <div className="p-4 bg-yellow-50 rounded-lg border mb-4">
          <p className="font-semibold text-yellow-800 flex items-center mb-2">
            <Zap className="w-4 h-4 mr-2" /> Select Order to Return
          </p>

          <div className="flex gap-2 flex-wrap">
            {assignments.map((a) => {
               // Calculate display values
               const currWt = a.remainingWeight !== undefined ? a.remainingWeight : a.rawMaterialWeight;
               const currQty = a.remainingQuantity !== undefined ? a.remainingQuantity : a.quantityNos;

               return (
                <button
                  key={a.id}
                  className={`px-3 py-2 rounded-lg text-sm border text-left transition ${
                    selectedAssignment?.id === a.id
                      ? "bg-amber-700 text-white shadow-md border-amber-800"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
                  }`}
                  onClick={() => setSelectedAssignment(a)}
                >
                  <div className="font-bold">{a.orderId}</div>
                  <div className="text-xs opacity-90">
                    Bal: {Number(currWt).toFixed(2)}g | {currQty} Nos
                  </div>
                </button>
               )
            })}
          </div>
        </div>
      )}

      {/* Return Form */}
      {selectedAssignment && (
        <form onSubmit={handleSubmit} className="space-y-4 border-t pt-4">
          <div className="text-sm font-bold text-gray-800 bg-gray-100 p-2 rounded">
             Return for: {selectedAssignment.ornamentCategory} ({selectedAssignment.purity}%)
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Quantity Dropdown */}
            <div>
              <label className="text-sm font-medium text-gray-600">Returned Qty (Nos)</label>
              <select
                name="returnedQuantityNos"
                value={returnData.returnedQuantityNos}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg bg-white mt-1 focus:ring-2 focus:ring-amber-500"
              >
                <option value="">-- Qty --</option>
                {[...Array(maxQty)].map((_, i) => (
                  <option value={i + 1} key={i}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </div>

            {/* Returned Weight */}
            <div>
              <label className="text-sm font-medium text-gray-600">Ret. Weight (g)</label>
              <input
                type="number"
                name="returnedWeight"
                value={returnData.returnedWeight}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-amber-500"
                placeholder="Ex: 15.0"
              />
            </div>

            {/* Wastage */}
            <div>
              <label className="text-sm font-medium text-gray-600">Wastage (g)</label>
              <input
                type="number"
                name="wastage"
                value={returnData.wastage}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-amber-500"
                placeholder="Ex: 0.5"
              />
            </div>

            {/* Stone Charges */}
            <div>
              <label className="text-sm font-medium text-gray-600">Stone/Labor (₹)</label>
              <input
                type="number"
                name="stoneCharges"
                value={returnData.stoneCharges}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-amber-500"
              />
            </div>
          </div>
          
           <div>
              <label className="text-sm font-medium text-gray-600">Remarks</label>
              <input
                type="text"
                name="remarks"
                value={returnData.remarks}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg mt-1 focus:ring-2 focus:ring-amber-500"
              />
            </div>

          {/* Submit */}
          <button
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-amber-700 to-amber-900 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
          >
            {loading ? "Processing..." : "Submit Return & Update Balance"}
          </button>

        </form>
      )}
    </div>
  );
};

export default B2BReturnForm;