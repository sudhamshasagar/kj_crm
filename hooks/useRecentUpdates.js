import { useEffect, useState } from "react";
import { 
  collection,
  orderBy,
  query,
  onSnapshot
} from "firebase/firestore";
import { useAuth } from "../AuthContext";

export const useRecentUpdates = () => {
  const { db } = useAuth();
  const [updates, setUpdates] = useState([]);

  useEffect(() => {
    if (!db) return;

    const q = query(
      collection(db, "RECENT_UPDATES"),
      orderBy("timestamp", "desc")   // FIXED field name
    );

    const unsub = onSnapshot(q, snap => {
      setUpdates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, [db]);

  return updates;
};
