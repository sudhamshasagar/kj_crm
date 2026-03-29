import React, { useEffect, useState } from "react";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useParams, useSearchParams } from "react-router-dom";

export default function ConsentInvestment() {
  const { consentId } = useParams();
  const [params] = useSearchParams();
  const tokenFromUrl = params.get("token");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [consent, setConsent] = useState(null);
  const [sale, setSale] = useState(null);
  const [mobile, setMobile] = useState("");
  const [verified, setVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const consentSnap = await getDoc(doc(db, "investment_consents", consentId));
        if (!consentSnap.exists()) throw new Error("Invalid consent link");

        const data = consentSnap.data();
        if (data.token !== tokenFromUrl) throw new Error("Invalid token");
        if (data.status !== "PENDING") throw new Error("Already processed");
        if (data.expiresAt.toDate() < new Date()) throw new Error("Link expired");

        setConsent({ id: consentSnap.id, ...data });

        const saleSnap = await getDoc(doc(db, "sales_estimations", data.estimationId));
        if (saleSnap.exists()) setSale(saleSnap.data());

        setLoading(false);
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    }
    load();
  }, [consentId, tokenFromUrl]);

  const approveConsent = async () => {
    setSubmitting(true);
    try {
      await updateDoc(doc(db, "investment_consents", consent.id), {
        status: "APPROVED",
        approvedAt: serverTimestamp(),
        consentDevice: navigator.userAgent,
        token: tokenFromUrl 
      });
      setDone(true);
    } catch (e) {
      setError("Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (done) return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center">
      <div className="bg-white p-8 rounded-xl shadow-lg border">
        <h2 className="text-2xl font-bold text-green-600">Approved!</h2>
        <p className="mt-2 text-slate-500">The transaction has been authorized successfully.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-slate-900 p-6 text-white text-center">
          <h2 className="text-xl font-bold">Keshava Jewellers</h2>
          <p className="text-xs text-slate-400 mt-1">Investment Redemption Consent</p>
        </div>

        <div className="p-6 space-y-6">
          {sale && (
            <div className="bg-slate-50 p-4 rounded-lg border border-dashed border-slate-300">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Redeem Amount</p>
              <p className="text-2xl font-black text-slate-800">₹ {consent.redeemAmount.toLocaleString("en-IN")}</p>
            </div>
          )}

          {!verified ? (
            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-500 uppercase">Verify Mobile</label>
              <input
                className="w-full border-2 rounded-xl p-3 text-lg font-bold outline-none focus:border-slate-900"
                placeholder="Mobile Number"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
              <button
                onClick={() => mobile === consent.customerMobile ? setVerified(true) : alert("Mismatch!")}
                className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold shadow-lg"
              >
                Verify to View Details
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div className="text-sm text-slate-600">
                I hereby authorize <strong>Keshava Jewellers</strong> to redeem <strong>₹{consent.redeemAmount}</strong> from my investment plan for Invoice <strong>#{consent.estimationId}</strong>.
              </div>
              <button
                onClick={approveConsent}
                disabled={submitting}
                className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-indigo-200 shadow-xl"
              >
                {submitting ? "Processing..." : "Confirm Approval"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}