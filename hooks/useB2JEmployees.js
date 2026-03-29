// src/hooks/useB2JEmployees.js
import { useEffect, useState } from "react";
import { onSnapshot, query, orderBy } from "firebase/firestore";
import { getEmployeeListCollection } from "../firebaseConfig";

export const useB2JEmployees = () => {
  const [employees, setEmployees] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const colRef = getEmployeeListCollection("B2J");
    const q = query(colRef, orderBy("name"));

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()            // 🔥 FIXED — now includes email + all fields
      }));
      setEmployees(list);
      setIsLoading(false);
    });

    return () => unsub();
  }, []);

  return { employees, isLoading };
};
