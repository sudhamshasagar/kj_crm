import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

/*
  COLLECTIONS
  -----------
  counters/
    - directSale
    - customOrder

  sales_estimations/
*/

/* =====================================================
   ESTIMATION HOOK
===================================================== */
export function useEstimations() {

  /* ---------------------------------------------------
     Generate Sequential Estimation Number
     - KJDC001 (Direct Sale)
     - KJCO001 (Custom Order)
  --------------------------------------------------- */
  const generateEstimationNumber = async (type) => {
    const counterId = type === "DIRECT_SALE" ? "directSale" : "customOrder";
    const prefix = type === "DIRECT_SALE" ? "KJDC" : "KJCO";

    const counterRef = doc(db, "counters", counterId);

    const nextNumber = await runTransaction(db, async (tx) => {
      const snap = await tx.get(counterRef);
      const current = snap.exists() ? snap.data().current || 0 : 0;
      const next = current + 1;

      tx.set(counterRef, { current: next }, { merge: true });
      return next;
    });

    return `${prefix}${String(nextNumber).padStart(3, "0")}`;
  };

  /* ---------------------------------------------------
     Firestore-safe Deep Clean (CRITICAL)
  --------------------------------------------------- */
  const deepClean = (obj) =>
    Object.fromEntries(
      Object.entries(obj)
        .filter(([_, v]) => v !== undefined)
        .map(([k, v]) =>
          typeof v === "object" && v !== null && !Array.isArray(v)
            ? [k, deepClean(v)]
            : [k, v]
        )
    );

  /* ---------------------------------------------------
     Save Estimation (Direct Sale / Custom Order)
  --------------------------------------------------- */
  const saveEstimation = async (estimation) => {
    if (!estimation || !estimation.items?.length) {
      throw new Error("Invalid estimation data");
    }

    const estimationId = await generateEstimationNumber(estimation.type);

    const payload = deepClean({
      ...estimation,

      // 🔑 Required
      estimationId,

      // 🔒 Remove legacy field permanently
      employee: undefined,

      status: "OPEN",
      timestamp: serverTimestamp(),
    });

    const ref = await addDoc(
      collection(db, "sales_estimations"),
      payload
    );

    return ref.id;
  };

  /* ---------------------------------------------------
     Normalize Date (used by logs table)
  --------------------------------------------------- */
  const normalizeDate = (value) => {
    if (!value) return new Date();

    if (typeof value.toDate === "function") return value.toDate();
    if (value.seconds) return new Date(value.seconds * 1000);
    if (value instanceof Date) return value;
    if (typeof value === "string") return new Date(value);

    return new Date();
  };

  /* ---------------------------------------------------
     Fetch Estimation Logs
     - Used by EstimationLogs page
  --------------------------------------------------- */
  const fetchEstimations = async () => {
    const q = query(
      collection(db, "sales_estimations"),
      orderBy("timestamp", "desc")
    );

    const snap = await getDocs(q);

    return snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
  };

  /* ---------------------------------------------------
     Fetch Single Estimation (Invoice / Drawer)
  --------------------------------------------------- */
  const fetchEstimationById = async (id) => {
    const ref = doc(db, "sales_estimations", id);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  };

  return {
    saveEstimation,
    fetchEstimations,
    fetchEstimationById,
    normalizeDate,
  };
}
