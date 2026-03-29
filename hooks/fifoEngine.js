import { 
  collection, addDoc, doc, getDoc, getDocs, updateDoc, 
  serverTimestamp, query, where, orderBy, setDoc 
} from "firebase/firestore";

/**
 * 1. FIFO IN: Adds a new stock layer and updates the summary.
 */
export const fifoIn = async (db, itemName, quantity, cost, hsn, purity) => {
  const qty = Number(quantity);
  await addDoc(collection(db, "STOCK_FIFO_LAYERS"), {
    itemName,
    quantity: qty,
    remaining: qty,
    cost: Number(cost),
    hsn: hsn || "",
    purity: purity || "",
    createdAt: serverTimestamp(),
  });

  await updateStockSummary(db, itemName, hsn, purity);
};

/**
 * 2. PRE-CHECK: Validates stock based on the summary document.
 * Matches p.stockItemKey directly to the STOCK_SUMMARY document ID.
 */
export const checkStockAvailability = async (db, cartProducts) => {
  const errors = [];

  for (const p of cartProducts) {
    const summaryRef = doc(db, "STOCK_SUMMARY", p.stockItemKey);
    const snap = await getDoc(summaryRef);

    if (!snap.exists()) {
      errors.push(`${p.stockItemKey}: Item not found in inventory.`);
      continue;
    }

    const available = Number(snap.data().closingStock || 0);
    if (available < p.quantity) {
      errors.push(
        `${p.stockItemKey}: Insufficient Stock (Available: ${available}g, Required: ${p.quantity}g)`
      );
    }
  }

  return errors;
};

/**
 * 3. FIFO OUT: Deducts from layers and updates the summary.
 */
export const fifoOut = async (db, itemName, qtyNeeded, referenceId) => {
  let remainingToDeduct = Number(qtyNeeded);

  const q = query(
    collection(db, "STOCK_FIFO_LAYERS"),
    where("itemName", "==", itemName),
    where("remaining", ">", 0),
    orderBy("createdAt", "asc")
  );

  const snap = await getDocs(q);

  for (const layerDoc of snap.docs) {
    if (remainingToDeduct <= 0) break;
    const data = layerDoc.data();
    const take = Math.min(data.remaining, remainingToDeduct);

    await updateDoc(doc(db, "STOCK_FIFO_LAYERS", layerDoc.id), {
      remaining: data.remaining - take
    });

    remainingToDeduct -= take;
  }

  await updateStockSummary(db, itemName);
};

/**
 * 4. UPDATE SUMMARY: Recalculates total stock for an item.
 */
export const updateStockSummary = async (db, itemName, hsn = null, purity = null) => {
  const q = query(
    collection(db, "STOCK_FIFO_LAYERS"),
    where("itemName", "==", itemName),
    where("remaining", ">", 0)
  );

  const snap = await getDocs(q);
  let totalStock = 0;

  snap.forEach(d => {
    totalStock += Number(d.data().remaining || 0);
  });

  await setDoc(doc(db, "STOCK_SUMMARY", itemName), {
    itemName,
    closingStock: Number(totalStock.toFixed(3)),
    lastUpdated: serverTimestamp(),
    ...(hsn ? { hsn } : {}),
    ...(purity ? { purity } : {})
  }, { merge: true });
};

export const resetToSingleLayer = async (db, itemName, newQty, avgCost) => {
  // 1. Find all existing layers with stock for this item
  const q = query(
    collection(db, "STOCK_FIFO_LAYERS"),
    where("itemName", "==", itemName),
    where("remaining", ">", 0)
  );
  const snap = await getDocs(q);

  // 2. Set all old layers to 0
  const batchUpdates = snap.docs.map((d) => 
      updateDoc(doc(db, "STOCK_FIFO_LAYERS", d.id), { remaining: 0 })
  );
  await Promise.all(batchUpdates);

  // 3. Create a fresh Audit layer
  await addDoc(collection(db, "STOCK_FIFO_LAYERS"), {
    itemName,
    quantity: Number(newQty),
    remaining: Number(newQty),
    cost: Number(avgCost) || 0,
    hsn: "AUDIT", 
    purity: "STD",
    createdAt: serverTimestamp(),
  });

  // 4. Sync the STOCK_SUMMARY
  await updateStockSummary(db, itemName);
};