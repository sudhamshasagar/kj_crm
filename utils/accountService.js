// --------------------------------------------------------------------------
// ACCOUNT SERVICE — Handles customer enrollment & investment accounts
// Collections:
//   - INVESTMENT_ACCOUNTS
//   - INVESTMENT_APPROVALS (for future customer portal)
// IMPORTANT:
//   We use your existing CUSTOMERS collection (not creating new customers)
// --------------------------------------------------------------------------

import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  doc,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

// COLLECTION REFERENCES
const ACCOUNTS_COLLECTION = collection(db, "INVESTMENT_ACCOUNTS");
const APPROVALS_COLLECTION = collection(db, "INVESTMENT_APPROVALS");

// -------------------------------------------------------------
// ENROLL CUSTOMER (ADMIN SIDE)
// Creates ACTIVE account instantly
// -------------------------------------------------------------
export async function createInvestmentAccount({
  customerId,
  schemeId,
  monthlyAmount,
  durationMonths,
  startDate,
}) {
  const data = {
    customerId,
    schemeId,
    monthlyAmount,
    durationMonths,
    startDate,
    endDate: calculateEndDate(startDate, durationMonths),
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    totalPaid: 0,
    nextDueDate: startDate,
  };

  const ref = await addDoc(ACCOUNTS_COLLECTION, data);

  return { accountId: ref.id, ...data };
}

// -------------------------------------------------------------
// CUSTOMER-PORTAL ENROLLMENT (FUTURE USE)
// Creates PENDING_APPROVAL entry
// -------------------------------------------------------------
export async function requestInvestmentApproval({
  customerId,
  schemeId,
  monthlyAmount,
  durationMonths,
  startDate,
}) {
  const data = {
    customerId,
    schemeId,
    monthlyAmount,
    durationMonths,
    startDate,
    status: "PENDING_APPROVAL",
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(APPROVALS_COLLECTION, data);
  return { requestId: ref.id, ...data };
}

// -------------------------------------------------------------
// APPROVE A PENDING CUSTOMER INVESTMENT (ADMIN SIDE)
// Moves request → ACTIVE account
// -------------------------------------------------------------
export async function approveEnrollment(requestId) {
  const ref = doc(db, "INVESTMENT_APPROVALS", requestId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  // Create actual investment account
  await addDoc(ACCOUNTS_COLLECTION, {
    ...data,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    totalPaid: 0,
    nextDueDate: data.startDate,
    endDate: calculateEndDate(data.startDate, data.durationMonths),
  });

  // Mark approval request as approved
  await updateDoc(ref, { status: "APPROVED" });

  return true;
}

// -------------------------------------------------------------
// GET ALL ACCOUNTS UNDER A CUSTOMER
// -------------------------------------------------------------
export async function getAccountsByCustomer(customerId) {
  const q = query(
    ACCOUNTS_COLLECTION,
    where("customerId", "==", customerId)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    accountId: d.id,
    ...d.data(),
  }));
}

// -------------------------------------------------------------
// GET ALL ACCOUNTS UNDER A SCHEME
// -------------------------------------------------------------
export async function getAccountsByScheme(schemeId) {
  const q = query(
    ACCOUNTS_COLLECTION,
    where("schemeId", "==", schemeId)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    accountId: d.id,
    ...d.data(),
  }));
}

// -------------------------------------------------------------
// GET SINGLE INVESTMENT ACCOUNT BY ID
// -------------------------------------------------------------
export async function getAccountById(accountId) {
  const ref = doc(db, "INVESTMENT_ACCOUNTS", accountId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  return { accountId, ...snap.data() };
}

// -------------------------------------------------------------
// CLOSE ACCOUNT
// -------------------------------------------------------------
export async function closeInvestmentAccount(accountId) {
  const ref = doc(db, "INVESTMENT_ACCOUNTS", accountId);

  await updateDoc(ref, {
    status: "CLOSED",
    closedAt: new Date().toISOString(),
  });

  return true;
}

// -------------------------------------------------------------
// HELPER → CALCULATE END DATE
// -------------------------------------------------------------
function calculateEndDate(startDate, durationMonths) {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + Number(durationMonths));
  return d.toISOString().slice(0, 10);
}
