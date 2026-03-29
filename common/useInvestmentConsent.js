import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";

export default function useInvestmentConsent({
  estimationId,
  customerMobile,
  onApproved,
}) {
  const [consentDocId, setConsentDocId] = useState(null);
  const [consentLink, setConsentLink] = useState("");
  const [consentData, setConsentData] = useState(null);
  const [loading, setLoading] = useState(false);

  /* ================= CREATE CONSENT ================= */

  const createConsent = async ({ investmentId, redeemAmount }) => {
    setLoading(true);

    try {
      const token = crypto.randomUUID();

      const ref = await addDoc(collection(db, "investment_consents"), {
        estimationId,
        investmentId,
        customerMobile,
        redeemAmount,
        status: "PENDING",
        token,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: serverTimestamp(),
      });

      setConsentDocId(ref.id);
      setConsentLink(
        `${window.location.origin}/consent/investment/${ref.id}?token=${token}`
      );
    } finally {
      setLoading(false);
    }
  };

  /* ================= WATCH CONSENT ================= */

  useEffect(() => {
    if (!consentDocId) return;

    const unsub = onSnapshot(doc(db, "investment_consents", consentDocId), (s) => {
      if (!s.exists()) return;

      const data = s.data();
      setConsentData(data);

      if (data.status === "APPROVED") {
        onApproved?.(data); // notify parent safely
      }
    });

    return unsub;
  }, [consentDocId, onApproved]);

  return {
    createConsent,
    consentDocId,
    consentLink,
    consentData,
    loading,
  };
}