import { useEffect, useState, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  startAfter,
  limit,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

const PAGE_SIZE = 25;

export const useEstimationLogs = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasNext, setHasNext] = useState(true);

  const [filters, setFilters] = useState({
    type: "ALL",
    status: "ALL",
    search: "",
  });

  const fetchLogs = useCallback(async (reset = false) => {
    setLoading(true);

    try {
      let q = query(
        collection(db, "sales_estimations"),
        where("isDeleted", "==", false),
        orderBy("sortAt", "desc"),
        limit(PAGE_SIZE)
      );

      if (filters.type !== "ALL") {
        q = query(q, where("type", "==", filters.type));
      }

      if (filters.status !== "ALL") {
        q = query(q, where("status", "==", filters.status));
      }

      if (filters.search) {
        q = query(
          q,
          where("searchTokens", "array-contains", filters.search.toLowerCase())
        );
      }

      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);

      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      }));

      setRows(reset ? data : [...rows, ...data]);
      setLastDoc(snap.docs.at(-1) || null);
      setHasNext(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [filters, lastDoc, rows]);

  const resetAndFetch = () => {
    setLastDoc(null);
    fetchLogs(true);
  };

  const bulkDelete = async (ids: string[]) => {
    const batch = writeBatch(db);
    ids.forEach(id => {
      batch.update(doc(db, "sales_estimations", id), {
        isDeleted: true,
      });
    });
    await batch.commit();
    resetAndFetch();
  };

  useEffect(() => {
    resetAndFetch();
  }, [filters]);

  return {
    rows,
    loading,
    hasNext,
    fetchMore: fetchLogs,
    filters,
    setFilters,
    bulkDelete,
  };
};
