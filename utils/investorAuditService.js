// src/utils/investorAuditService.js
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import * as XLSX from "xlsx";

/**
 * Generates a multi-sheet Excel file: One sheet per customer
 */
export const generateInvestorExcelReport = async () => {
  try {
    const [custSnap, invSnap, transSnap] = await Promise.all([
      getDocs(collection(db, "CUSTOMERS")),
      getDocs(collection(db, "INVESTMENTS")),
      getDocs(collection(db, "INVESTMENT_TRANSACTIONS"))
    ]);

    const customers = custSnap.docs.map(d => d.data());
    const investmentMap = invSnap.docs.reduce((acc, d) => ({ ...acc, [d.id]: d.data() }), {});
    const allTransactions = transSnap.docs.map(d => d.data());

    const wb = XLSX.utils.book_new();

    customers.forEach(cust => {
      const customerTrans = allTransactions
        .filter(t => t.customerId === cust.customerId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      if (customerTrans.length === 0) return;

      const rows = [
        ["CUSTOMER STATEMENT"],
        ["Name:", cust.name],
        ["Mobile:", cust.mobile],
        ["ID:", cust.customerId],
        [""], 
        ["Date", "Account/Scheme", "Reference", "Mode", "Installment", "Grams", "Amount (Rs)"]
      ];

      customerTrans.forEach(t => {
        const inv = investmentMap[t.investmentId] || {};
        rows.push([
          t.date || "N/A",
          `${inv.schemeName || "Unknown"} (${inv.accountNumber || "N/A"})`,
          t.reference || "-",
          t.mode || "CASH",
          t.installment || "-",
          t.grams || 0,
          t.amount || 0
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(rows);

      ws['!cols'] = [
        { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }
      ];

      // --- THE FIX: UNIQUE SHEET NAMES ---
      // 1. Remove illegal characters: \ / * ? : [ ]
      const cleanName = cust.name.replace(/[\\/*?:[\]]/g, "");
      
      // 2. Append last 4 digits of ID to ensure uniqueness if names are identical
      const shortId = cust.customerId.slice(-4);
      
      // 3. Excel limit is 31 chars. (Name max 25 + "-" + 4 digit ID + margin)
      const finalSheetName = `${cleanName.substring(0, 25)}-${shortId}`;

      XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
    });

    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  } catch (error) {
    console.error("Excel Generation Error:", error);
    throw error;
  }
};

/**
 * Triggers an email document to elv8.works@gmail.com
 * (Note: You can't attach files directly from client-side Firebase, 
 * so we notify that a new multi-sheet audit is available in Storage)
 */
export const notifyAuditEmail = async () => {
  const today = new Date().toLocaleDateString("en-IN");
  await addDoc(collection(db, "mail"), {
    to: "elv8.works@gmail.com",
    message: {
      subject: `INVESTOR MULTI-SHEET AUDIT: ${today}`,
      html: `
        <h3>Keshav Jewellers - Statement Export</h3>
        <p>A new Excel file with individual sheets for every customer has been generated.</p>
        <p>The admin has downloaded a local copy, and a version is synced to Firebase Storage.</p>
      `,
    },
    createdAt: serverTimestamp()
  });
};