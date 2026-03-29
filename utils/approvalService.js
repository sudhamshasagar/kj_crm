// --------------------------------------------------------------------------
// APPROVAL SERVICE — Handles customer-side investment requests
// Collections:
//   - INVESTMENT_APPROVALS
//   - INVESTMENT_ACCOUNTS (when approved)
// --------------------------------------------------------------------------

import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  getDoc,
  doc,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

// COLLECTION REFERENCE
const APPROVALS_COLLECTION = collection(db, "INVESTMENT_APPROVALS");
const ACCOUNTS_COLLECTION = collection(db, "INVESTMENT_ACCOUNTS");

// --------------------------------------------------------------------------
// CREATE REQUEST (Customer-side future use)
// --------------------------------------------------------------------------
export async function createApprovalRequest({
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
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(APPROVALS_COLLECTION, data);
  return { requestId: ref.id, ...data };
}

// --------------------------------------------------------------------------
// GET ALL PENDING APPROVAL REQUESTS
// --------------------------------------------------------------------------
export async function getPendingApprovals() {
  const q = query(
    APPROVALS_COLLECTION,
    where("status", "==", "PENDING"),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    requestId: d.id,
    ...d.data(),
  }));
}

// --------------------------------------------------------------------------
// APPROVE REQUEST → Converts request → ACTIVE ACCOUNT
// --------------------------------------------------------------------------
export async function approveRequest(requestId) {
  const ref = doc(db, "INVESTMENT_APPROVALS", requestId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();

  // Create investment account (ACTIVE)
  await addDoc(ACCOUNTS_COLLECTION, {
    customerId: data.customerId,
    schemeId: data.schemeId,
    monthlyAmount: data.monthlyAmount,
    durationMonths: data.durationMonths,
    startDate: data.startDate,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
    totalPaid: 0,
    nextDueDate: data.startDate,
    endDate: calculateEndDate(data.startDate, data.durationMonths),
  });

  // Mark approval as approved
  await updateDoc(ref, { status: "APPROVED" });

  return true;
}

// --------------------------------------------------------------------------
// REJECT REQUEST
// --------------------------------------------------------------------------
export async function rejectRequest(requestId, reason = "Not Eligible") {
  const ref = doc(db, "INVESTMENT_APPROVALS", requestId);
  await updateDoc(ref, {
    status: "REJECTED",
    rejectedAt: new Date().toISOString(),
    reason,
  });
  return true;
}

// --------------------------------------------------------------------------
// HELPER → CALCULATE END DATE
// --------------------------------------------------------------------------
function calculateEndDate(startDate, durationMonths) {
  const d = new Date(startDate);
  d.setMonth(d.getMonth() + Number(durationMonths));
  return d.toISOString().slice(0, 10);
}
