import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";

// Add FIFO Stock Entry (Stock IN)
export async function fifoStockIn(db, itemName, quantity, unitCost) {
  await addDoc(collection(db, "STOCK_FIFO"), {
    itemName,
    quantity,
    remaining: quantity,
    unitCost,
    createdAt: serverTimestamp(),
  });
}

// Auto FIFO Stock OUT when sale is done
export async function fifoStockOut(db, itemName, qtyNeeded) {
  const q = query(
    collection(db, "STOCK_FIFO"),
    where("itemName", "==", itemName),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);

  let qty = qtyNeeded;

  for (const docSnap of snap.docs) {
    if (qty <= 0) break;

    const data = docSnap.data();
    const remaining = data.remaining;

    if (remaining <= 0) continue;

    const toDeduct = Math.min(remaining, qty);

    await updateDoc(doc(db, "STOCK_FIFO", docSnap.id), {
      remaining: remaining - toDeduct,
    });

    qty -= toDeduct;
  }

  if (qty > 0) {
    console.warn("⚠ FIFO WARNING: Stock insufficient for:", itemName);
  }
}
