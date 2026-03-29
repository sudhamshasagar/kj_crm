import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";

/**
 * Jewellery Piece-Based Stock Hook
 * - Each piece = 1 stock_items document
 * - Ledger written server-side
 */
export function useStock() {
  const [loading, setLoading] = useState(false);

  const addStockEntry = async ({
    itemId,
    pieces,
    totalWeight,
    metal,
    category,
    purity,
    remarks = ""
  }) => {
    if (!itemId || !pieces || !totalWeight) {
      throw new Error("Missing required fields");
    }

    setLoading(true);
    try {
      const addStock = httpsCallable(functions, "secureAddStock");

      await addStock({
        itemId,
        pieces: Number(pieces),
        totalWeight: Number(totalWeight),
        metal,
        category,
        purity,
        remarks
      });

    } finally {
      setLoading(false);
    }
  };

  return { addStockEntry, loading };
}