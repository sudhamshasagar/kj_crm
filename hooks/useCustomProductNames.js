import { useState, useEffect } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { useAuth } from "../AuthContext";

export const useCustomProductNames = () => {
  const { db } = useAuth();
  const [names, setNames] = useState([]);

  useEffect(() => {
    if (!db) return;

    const ref = collection(db, "CUSTOM_PRODUCT_NAMES");
    const q = query(ref, orderBy("name", "asc"));

    const unsub = onSnapshot(q, snap => {
      setNames(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
      );
    });

    return () => unsub();
  }, [db]);

  return { names };
};
