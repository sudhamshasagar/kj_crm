// ---------------------------------------------------------
// CUSTOMER SERVICE MODULE (GLOBAL CRM LOGIC)
// ---------------------------------------------------------
// This file handles:
// 1. Customer ID generation
// 2. Duplicate prevention (based on mobile)
// 3. Persistent customer stats
// 4. Monthly visit & purchase analytics
// 5. Linking customer to estimation
// 6. Updating metrics on every estimation saved
//
// FORMAT:  <INITIALS>-<SERIAL>
// EX: SS-00001, MS-00002, RK-00003
// ---------------------------------------------------------

import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  where,
  increment,
} from "firebase/firestore";
import { db } from "../firebaseConfig";

// 🔹 Master customers collection
export const CUSTOMERS_COLLECTION = collection(db, "CUSTOMERS");

// ---------------------------------------------------------
// 1. Extract Initials
// ---------------------------------------------------------
export function getInitials(name = "") {
  const parts = name.trim().toUpperCase().split(" ");

  if (parts.length === 1) {
    return parts[0].substring(0, 2); // "RAJU" → "RA"
  }
  return parts[0][0] + parts[1][0]; // "RAM KUMAR" → "RK"
}

// ---------------------------------------------------------
// 2. Get Next Customer Serial
// ---------------------------------------------------------
export async function getNextCustomerSerial() {
  const q = query(CUSTOMERS_COLLECTION, orderBy("serial", "desc"), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) return 1;

  return (snap.docs[0].data().serial || 0) + 1;
}

// ---------------------------------------------------------
// 3. Generate Customer ID
// ---------------------------------------------------------
export async function generateCustomerId(fullName) {
  const initials = getInitials(fullName);
  const nextSerial = await getNextCustomerSerial();

  const paddedSerial = String(nextSerial).padStart(5, "0");

  return {
    customerId: `${initials}-${paddedSerial}`,
    initials,
    serial: nextSerial,
  };
}

// ---------------------------------------------------------
// 4. Find Customer by Mobile
// ---------------------------------------------------------
export async function findCustomerByMobile(mobile) {
  if (!mobile) return null;

  const q = query(CUSTOMERS_COLLECTION, where("mobile", "==", mobile), limit(1));
  const snap = await getDocs(q);

  if (snap.empty) return null;

  return {
    docId: snap.docs[0].id,
    ...snap.docs[0].data(),
  };
}

// ---------------------------------------------------------
// 5. Create New Customer
// ---------------------------------------------------------
export async function createNewCustomer({ name, mobile, city }) {
  const { customerId, initials, serial } = await generateCustomerId(name);

  const now = new Date().toISOString();

  const baseCustomer = {
    customerId,
    initials,
    serial,
    name,
    mobile,
    city: city || "",

    // Persistent tracking
    totalVisits: 0,
    totalExchanges: 0,
    lifetimeValue: 0,
    highestPurchase: 0,
    firstVisit: null,
    lastVisit: null,

    // Monthly stats (Jan–Dec)
    monthlyVisitStats: {
      Jan: 0,
      Feb: 0,
      Mar: 0,
      Apr: 0,
      May: 0,
      Jun: 0,
      Jul: 0,
      Aug: 0,
      Sep: 0,
      Oct: 0,
      Nov: 0,
      Dec: 0,
    },

    monthlyPurchaseStats: {
      Jan: 0,
      Feb: 0,
      Mar: 0,
      Apr: 0,
      May: 0,
      Jun: 0,
      Jul: 0,
      Aug: 0,
      Sep: 0,
      Oct: 0,
      Nov: 0,
      Dec: 0,
    },

    createdAt: now,
    lastUpdated: now,
  };

  const docRef = await addDoc(CUSTOMERS_COLLECTION, baseCustomer);

  return {
    docId: docRef.id,
    ...baseCustomer,
  };
}

// ---------------------------------------------------------
// 6. Update Customer Stats When Estimation is Saved
// ---------------------------------------------------------
export async function updateCustomerStats(customerDocId, estimation) {
  const ref = doc(CUSTOMERS_COLLECTION, customerDocId);

  const {
    summary: { grandTotal },
    billing,
    timestamp,
  } = estimation;

  const dt = timestamp?.toDate?.() || new Date();
  const month = dt.toLocaleString("default", { month: "short" });

  const updates = {
    totalVisits: increment(1),
    lifetimeValue: increment(grandTotal),
    lastUpdated: new Date().toISOString(),
    [`monthlyVisitStats.${month}`]: increment(1),
    [`monthlyPurchaseStats.${month}`]: increment(grandTotal),
  };

  // Exchanges
  if (billing?.isExchange) {
    updates.totalExchanges = increment(1);
  }

  // First visit fix
  // (we set firstVisit only when it is null)
  updates.firstVisit = estimation.firstVisit || null;

  await updateDoc(ref, updates);

  return true;
}

// ---------------------------------------------------------
// 7. Attach Customer to Estimation
//    - Prevent duplicates
//    - Create new if needed
//    - Update stats
// ---------------------------------------------------------
export async function attachCustomerToEstimation({ name, mobile, city }, estimation) {
  // Try existing customer by mobile
  const existing = await findCustomerByMobile(mobile);

  if (existing) {
    await updateCustomerStats(existing.docId, estimation);
    return existing;
  }

  // Create new
  const newCustomer = await createNewCustomer({ name, mobile, city });

  // First visit = this estimation timestamp
  estimation.firstVisit = estimation.timestamp?.toDate?.()?.toISOString() || new Date().toISOString();

  await updateCustomerStats(newCustomer.docId, estimation);

  return newCustomer;
}
