// --------------------------------------------------------------------------
// PAYMENT SERVICE — Handles investment payments & receipts
// Collections:
//   - INVESTMENT_PAYMENTS
//   - INVESTMENT_ACCOUNTS
// --------------------------------------------------------------------------

import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

// COLLECTION REFERENCE
const PAYMENTS_COLLECTION = collection(db, "INVESTMENT_PAYMENTS");

// --------------------------------------------------------------------------
// ADD PAYMENT → used by Admin inside Account Details
// --------------------------------------------------------------------------
export async function addPayment({
  accountId,
  customerId,
  schemeId,
  amount,
  month, // format: "2025-01"
  mode = "CASH",
  collectedBy,
}) {
  const paymentData = {
    accountId,
    customerId,
    schemeId,
    amount,
    month,
    paidAt: new Date().toISOString(),
    mode,
    collectedBy,
    receiptNumber: generateReceiptNumber(),
  };

  // Save payment record
  const ref = await addDoc(PAYMENTS_COLLECTION, paymentData);

  // Update account totals
  const accountRef = doc(db, "INVESTMENT_ACCOUNTS", accountId);
  const accountSnap = await getDoc(accountRef);

  if (accountSnap.exists()) {
    const acc = accountSnap.data();

    const newTotalPaid = (acc.totalPaid || 0) + Number(amount);

    await updateDoc(accountRef, {
      totalPaid: newTotalPaid,
      nextDueDate: calculateNextMonth(acc.nextDueDate || acc.startDate),
    });
  }

  return { paymentId: ref.id, ...paymentData };
}

// --------------------------------------------------------------------------
// GET ALL PAYMENTS OF AN ACCOUNT
// --------------------------------------------------------------------------
export async function getPaymentsByAccount(accountId) {
  const q = query(
    PAYMENTS_COLLECTION,
    where("accountId", "==", accountId),
    orderBy("paidAt", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    paymentId: d.id,
    ...d.data(),
  }));
}

// --------------------------------------------------------------------------
// GET PAYMENTS BY MONTH (for Reports)
// --------------------------------------------------------------------------
export async function getPaymentsByMonth(month) {
  const q = query(
    PAYMENTS_COLLECTION,
    where("month", "==", month),
    orderBy("paidAt")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    paymentId: d.id,
    ...d.data(),
  }));
}

// --------------------------------------------------------------------------
// GENERATE UNIQUE RECEIPT NUMBER
// Example: RCPT-202501-XYZ123
// --------------------------------------------------------------------------
function generateReceiptNumber() {
  const dateCode = new Date().toISOString().slice(0, 7).replace("-", "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `RCPT-${dateCode}-${random}`;
}

// --------------------------------------------------------------------------
// HELPER → CALCULATE NEXT MONTH DUE DATE
// --------------------------------------------------------------------------
function calculateNextMonth(date) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}
