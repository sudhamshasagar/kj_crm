// src/hooks/useActiveUsers.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { useAuth } from "../AuthContext";

export const useActiveUsers = () => {
  const { db } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, "ACTIVE_USERS"),
      orderBy("lastActive", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(list);
    });

    return () => unsub();
  }, [db]);

  return users;
};
