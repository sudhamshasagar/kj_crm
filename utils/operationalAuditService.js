import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebaseConfig";
import * as XLSX from "xlsx";

export const exportEmployeeStatement = async (employeeName, businessType) => {
    const colName = businessType === "B2B" ? "b2b_master_log" : "b2j_master_log";
    const q = query(collection(db, colName), where("employeeName", "==", employeeName));
    const snap = await getDocs(q);

    if (snap.empty) throw new Error("No logs found for this employee.");

    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Separate data for tabs
    const assignments = logs.filter(l => l.transactionType === "ASSIGNMENT");
    const returns = logs.filter(l => l.transactionType?.includes("RETURN"));

    const wb = XLSX.utils.book_new();

    // 1. ASSIGNMENTS SHEET
    const assignRows = assignments.map(l => ({
        Date: l.assignedDate?.toDate ? l.assignedDate.toDate().toLocaleDateString() : "N/A",
        OrderID: l.orderId || "-",
        Category: l.ornamentCategory || "-",
        "Weight (g)": l.rawMaterialWeight || 0,
        "Purity (%)": l.purity || l.rawMaterialPurity || 0,
        "Advance (Rs)": l.advanceCashPaid || 0
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(assignRows), "Assignments");

    // 2. RETURNS SHEET
    const returnRows = returns.map(l => ({
        Date: (l.dateReturned || l.assignedDate)?.toDate ? (l.dateReturned || l.assignedDate).toDate().toLocaleDateString() : "N/A",
        OrderID: l.linkedAssignmentOrderId || l.orderId || "-",
        "Ret. Wt (g)": l.returnedWeight || 0,
        "Wastage (g)": l.wastage || 0,
        "Stone Charges": l.stoneCharges || 0
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(returnRows), "Returns");

    // 3. SUMMARY SHEET
    const totalAssigned = assignments.reduce((acc, curr) => acc + Number(curr.rawMaterialWeight || 0), 0);
    const totalReturned = returns.reduce((acc, curr) => acc + (Number(curr.returnedWeight || 0) + Number(curr.wastage || 0)), 0);
    
    const summaryRows = [
        { Metric: "Employee Name", Value: employeeName },
        { Metric: "Business Type", Value: businessType },
        { Metric: "Total Weight Assigned", Value: `${totalAssigned.toFixed(3)} g` },
        { Metric: "Total Weight Returned (incl Wastage)", Value: `${totalReturned.toFixed(3)} g` },
        { Metric: "NET PENDING BALANCE", Value: `${(totalAssigned - totalReturned).toFixed(3)} g` }
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Summary");

    // Generate and Download
    XLSX.writeFile(wb, `${employeeName}_Statement.xlsx`);
};