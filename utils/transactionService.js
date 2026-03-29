// ---------------------------------------------------------
// TRANSACTION SERVICE (TOP-LEVEL COLLECTION)
// INVESTMENT_TRANSACTIONS
// ---------------------------------------------------------

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

export const TRANSACTION_COLLECTION = collection(db, "INVESTMENT_TRANSACTIONS");

// ---------------------------------------------------------
// 1. ADD INSTALLMENT PAYMENT
// ---------------------------------------------------------
export async function addInvestmentTransaction({
  investmentId,
  installmentNumber,
  amount,
  mode,
}) {
  const txn = {
    investmentId,
    installmentNumber,
    amount,
    mode,
    timestamp: new Date().toISOString(),
  };

  await addDoc(TRANSACTION_COLLECTION, txn);

  return txn;
}

// ---------------------------------------------------------
// 2. GET TRANSACTIONS FOR AN ACCOUNT
// ---------------------------------------------------------
export async function getInvestmentTransactions(investmentId) {
  const q = query(
    TRANSACTION_COLLECTION,
    where("investmentId", "==", investmentId),
    orderBy("installmentNumber", "asc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  }));
}
