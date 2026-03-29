// -------------------------------------------------------------
// SCHEME SERVICE — Handles creation & management of schemes
// Collections:
//   - INVESTMENT_SCHEMES
// -------------------------------------------------------------

import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";

import { db } from "../firebaseConfig";

// COLLECTION REFERENCE
const SCHEMES_COLLECTION = collection(db, "INVESTMENT_SCHEMES");

// -------------------------------------------------------------
// CREATE NEW SCHEME
// -------------------------------------------------------------
export async function createScheme({
  schemeName,
  durationMonths,
  minMonthlyAmount,
  interestRate,
  description = "",
}) {
  const data = {
    schemeName,
    durationMonths,
    minMonthlyAmount,
    interestRate,
    description,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(SCHEMES_COLLECTION, data);

  return { schemeId: ref.id, ...data };
}

// -------------------------------------------------------------
// GET ALL SCHEMES
// -------------------------------------------------------------
export async function getAllSchemes() {
  const snap = await getDocs(SCHEMES_COLLECTION);

  return snap.docs.map((d) => ({
    schemeId: d.id,
    ...d.data(),
  }));
}

// -------------------------------------------------------------
// GET SCHEME BY ID
// -------------------------------------------------------------
export async function getSchemeById(schemeId) {
  const ref = doc(db, "INVESTMENT_SCHEMES", schemeId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return { schemeId, ...snap.data() };
}

// -------------------------------------------------------------
// UPDATE / EDIT SCHEME
// -------------------------------------------------------------
export async function updateScheme(schemeId, updates) {
  const ref = doc(db, "INVESTMENT_SCHEMES", schemeId);
  await updateDoc(ref, {
    ...updates,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

// -------------------------------------------------------------
// DEACTIVATE SCHEME
// -------------------------------------------------------------
export async function deactivateScheme(schemeId) {
  const ref = doc(db, "INVESTMENT_SCHEMES", schemeId);
  await updateDoc(ref, {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
  return true;
}
