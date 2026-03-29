import { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../../firebaseConfig";

/**
 * useItems
 * Inventory hook
 * Stock mutations happen ONLY via Cloud Functions
 */

export function useItems() {

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  /* --------------------------------
     REAL-TIME STOCK LIST
  -------------------------------- */

  useEffect(() => {

    const unsub = onSnapshot(
      collection(db, "stock_items"),
      (snap) => {

        const list = snap.docs.map((d) => ({
          id: d.id,
          pieceBarcode: d.data().pieceBarcode || d.id,
          ...d.data()
        }));

        setItems(list);
        setLoading(false);
      }
    );

    return () => unsub();

  }, []);

  /* --------------------------------
     Get Single Item
  -------------------------------- */

  const getItemById = async (stockItemId) => {

    if (!stockItemId) return null;

    const ref = doc(db, "stock_items", stockItemId);
    const snap = await getDoc(ref);

    if (!snap.exists()) return null;

    return {
      id: snap.id,
      pieceBarcode: snap.data().pieceBarcode || snap.id,
      ...snap.data()
    };

  };

  /* --------------------------------
     Create Stock Pieces (SECURE)
     Calls Cloud Function
  -------------------------------- */

  const createArticles = async ({
 metal,
 category,
 purity,
 hsnCode,
 items
}) => {

 const addStock = httpsCallable(functions,"secureAddStock");

 const res = await addStock({
  metal,
  category,
  purity,
  hsnCode,
  items
 });

 return res.data.items;

};

  return {
    items,
    loading,
    getItemById,
    createArticles
  };

}