import { useState } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../AuthContext";

export const useAdminPasscode = () => {
  const { db } = useAuth();
  const [loading, setLoading] = useState(false);

  const verifyPasscode = async (enteredPass) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, "system_configs"),
        where("type", "==", "admin_security")
      );

      const snap = await getDocs(q);

      if (!snap.empty) {
        const realPass = snap.docs[0].data().passcode;
        return enteredPass === realPass;
      }

      return false;
    } catch (e) {
      console.error("Passcode fetch error", e);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { verifyPasscode, loading };
};