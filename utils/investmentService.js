// ---------------------------------------------------------
// INVESTMENT SERVICE (SCHEMES + ACCOUNTS)
// ---------------------------------------------------------

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

// MAIN COLLECTIONS
export const SCHEMES_COLLECTION = collection(db, "INVESTMENT_SCHEMES");
export const INVESTMENTS_COLLECTION = collection(db, "INVESTMENTS");

// ---------------------------------------------------------
// 1. CREATE NEW INVESTMENT SCHEME
// ---------------------------------------------------------
export async function createInvestmentScheme({ schemeName, durationMonths, minMonthlyAmount }) {
  const scheme = {
    schemeName,
    durationMonths,
    minMonthlyAmount,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(SCHEMES_COLLECTION, scheme);

  return { schemeId: ref.id, ...scheme };
}

// ---------------------------------------------------------
// 2. GET ALL SCHEMES
// ---------------------------------------------------------
export async function getAllSchemes() {
  const snap = await getDocs(SCHEMES_COLLECTION);
  return snap.docs.map((d) => ({ schemeId: d.id, ...d.data() }));
}

// ---------------------------------------------------------
// 3. GET SCHEME BY ID
// ---------------------------------------------------------
export async function getSchemeById(schemeId) {
  const ref = doc(db, "INVESTMENT_SCHEMES", schemeId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { schemeId, ...snap.data() };
}

// ---------------------------------------------------------
// 4. ADD CUSTOMER TO SCHEME (CREATE NEW INVESTMENT ACCOUNT)
// ---------------------------------------------------------
export async function createInvestmentAccount({
  schemeId,
  customerId,
  customerName,
  mobile,
  monthlyAmount,
  durationMonths,
  accountIndex,
}) {
  const account = {
    schemeId,
    customerId,
    customerName,
    mobile,
    monthlyAmount,
    durationMonths,
    accountIndex,
    status: "ACTIVE",
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(INVESTMENTS_COLLECTION, account);

  return { investmentId: ref.id, ...account };
}

// ---------------------------------------------------------
// 5. GET ALL CUSTOMERS INSIDE A SCHEME
// ---------------------------------------------------------
export async function getCustomersInScheme(schemeId) {
  const q = query(
    INVESTMENTS_COLLECTION,
    where("schemeId", "==", schemeId)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    investmentId: d.id,
    ...d.data(),
  }));
}

// ---------------------------------------------------------
// 6. GET ALL ACCOUNTS OF A CUSTOMER (ACROSS ALL SCHEMES)
// ---------------------------------------------------------
export async function getCustomerInvestmentAccounts(customerId) {
  const q = query(
    INVESTMENTS_COLLECTION,
    where("customerId", "==", customerId)
  );

  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    investmentId: d.id,
    ...d.data(),
  }));
}

// ---------------------------------------------------------
// 7. GET INVESTMENT ACCOUNT BY ID
// ---------------------------------------------------------
export async function getInvestmentById(investmentId) {
  const ref = doc(db, "INVESTMENTS", investmentId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return { investmentId, ...snap.data() };
}

// ---------------------------------------------------------
// 8. CLOSE INVESTMENT ACCOUNT
// ---------------------------------------------------------
export async function closeInvestmentAccount(investmentId) {
  const ref = doc(db, "INVESTMENTS", investmentId);
  await updateDoc(ref, { status: "CLOSED", closedAt: new Date().toISOString() });
  return true;
}
