// src/hooks/useB2BEmployees.js
import { useEffect, useState } from "react";
import { onSnapshot, query, orderBy } from "firebase/firestore";
import { getEmployeeListCollection } from "../firebaseConfig";

export const useB2BEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const colRef = getEmployeeListCollection("B2B");
    const q = query(colRef, orderBy("name"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()            // 🔥 IMPORTANT: includes email
      }));
      setEmployees(list);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  return { employees, isLoading };
};
