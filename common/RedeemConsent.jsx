import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, functions } from "../../firebaseConfig";
import { httpsCallable } from "firebase/functions";
import { CheckCircle, ShieldCheck, XCircle, AlertCircle, Clock, Loader2 } from "lucide-react";

export default function RedeemConsent() {
  const { requestId, token } = useParams();
  const [searchParams] = useSearchParams();

  // Support both path params and query params
  const finalRequestId = requestId || searchParams.get("requestId");
  const finalToken = token || searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState(null);
  const [estimation, setEstimation] = useState(null);
  const [mobileInput, setMobileInput] = useState("");
  const [verified, setVerified] = useState(false);
  const [processing, setProcessing] = useState(false);

  const normalizeMobile = (m) => String(m).replace(/\D/g, "").slice(-10);

  useEffect(() => {
    const loadData = async () => {
      if (!finalRequestId) {
        setLoading(false);
        return;
      }

      try {
        const reqRef = doc(db, "INVESTMENT_REDEMPTION_REQUESTS", finalRequestId);
        const reqSnap = await getDoc(reqRef);

        if (!reqSnap.exists()) {
          setLoading(false);
          return;
        }

        const reqData = reqSnap.data();
        const now = Date.now();

        // --- BULLETPROOF EXPIRY LOGIC ---
        let expiryMs = 0;

        if (reqData.tokenExpiry) {
          if (reqData.tokenExpiry.seconds) {
            expiryMs = reqData.tokenExpiry.seconds * 1000;
          } else if (reqData.tokenExpiry.toMillis) {
            expiryMs = reqData.tokenExpiry.toMillis();
          } else {
            expiryMs = reqData.tokenExpiry;
          }
        }

      //  if (expiryMs > 0 && Date.now() > expiryMs) {
      //     setRequest({ ...reqData, status: "EXPIRED" });
      //     setLoading(false);
      //     return;
      //   }

        // --- UPDATE STATUS IF VALID ---
        if (reqData.status === "PENDING") {
          await updateDoc(reqRef, { 
            status: "OPENED", 
            openedAt: serverTimestamp() 
          });

          reqData.status = "OPENED";
        }

        setRequest(reqData);

        if (reqData.estimationId) {
          const estSnap = await getDoc(doc(db, "sales_estimations", reqData.estimationId));
          if (estSnap.exists()) {
            setEstimation(estSnap.data());
          }
        }
      } catch (err) {
        console.error("Redemption load error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [finalRequestId]);

  const handleAction = async (actionType) => {
    if (!verified || processing) return;
    setProcessing(true);

    try {
      const approveFn = httpsCallable(functions, "approveRedemptionConsent");
      
      // Ensure we use the exact field names expected by your Cloud Function
      await approveFn({
        requestId: finalRequestId,
        token: finalToken,
        mobile: normalizeMobile(mobileInput),
        action: actionType
      });

      // Refresh local state from DB
      const snap = await getDoc(doc(db, "INVESTMENT_REDEMPTION_REQUESTS", finalRequestId));
      setRequest({ id: snap.id, ...snap.data() });
    } catch (err) {
      console.error(err);
      alert(err.message || "Authorization failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // --- RENDERING LOGIC ---

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white p-6">
      <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
      <p className="mt-4 text-slate-500 font-medium">Securing connection...</p>
    </div>
  );

  if (!request) return (
  <StatusCard 
    icon={<AlertCircle className="w-16 h-16 text-red-500" />}
    title="Invalid Request"
    message="This redemption request could not be found."
  />
  );

  if (request.status === "APPROVED") return (
    <StatusCard 
      icon={<CheckCircle className="w-16 h-16 text-green-500" />}
      title="Payment Authorized"
      message={`You have approved the redemption of ₹${Number(request.amount).toLocaleString('en-IN')}. The store can now finalize your invoice.`}
      isSuccess
    />
  );

  if (request.status === "REJECTED") return (
    <StatusCard 
      icon={<XCircle className="w-16 h-16 text-red-500" />}
      title="Request Declined"
      message="You have chosen not to authorize this redemption. No changes have been made to your investment account."
    />
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans leading-relaxed">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100 transition-all">
        
        {/* Brand Header */}
        <div className="bg-slate-900 p-8 text-center text-white">
          <div className="flex justify-center mb-4">
            <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md">
              <ShieldCheck className="w-8 h-8 text-amber-400" />
            </div>
          </div>
          <h1 className="text-xl font-bold tracking-tight">Keshava Jewellers</h1>
          <p className="text-slate-400 text-[10px] mt-1 uppercase tracking-[0.2em]">Secure Redemption Portal</p>
        </div>

        <div className="p-8 space-y-8">
          {/* Amount Branding */}
          <div className="text-center">
            <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mb-1">Redeem Amount</p>
            <h2 className="text-4xl font-black text-slate-900">
              ₹{Number(request.amount).toLocaleString('en-IN')}
            </h2>
          </div>

          {/* Info Section */}
          <div className="bg-slate-50 rounded-3xl p-6 space-y-4">
            <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-3">
              <span className="text-slate-500">Account Holder</span>
              <span className="font-bold text-slate-800">{request.customerName}</span>
            </div>
            {estimation && (
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Purchase Summary</p>
                {estimation.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-xs py-1">
                    <span className="text-slate-600">{item.productName || item.category}</span>
                    <span className="font-bold text-slate-800">{item.netWeight}g</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Area */}
          {!verified ? (
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <p className="text-sm font-bold text-slate-800">Identity Verification</p>
                <p className="text-xs text-slate-500">Enter your mobile number to view details</p>
              </div>
              <input
                type="tel"
                placeholder="Registered Mobile Number"
                value={mobileInput}
                onChange={(e) => setMobileInput(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center text-xl font-bold focus:border-amber-500 focus:ring-0 transition-all outline-none"
              />
              <button 
                onClick={() => {
                  if (normalizeMobile(mobileInput) === normalizeMobile(request.customerMobile)) setVerified(true);
                  else alert("The mobile number entered does not match our records.");
                }}
                className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl active:scale-[0.98] transition-all"
              >
                Verify & Unlock
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex items-start gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-800 leading-normal">
                  I confirm that I am redeeming <b>₹{request.amount}</b> from my investment account towards the purchase of jewelry at Keshava Jewellers.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  disabled={processing}
                  onClick={() => handleAction("REJECTED")}
                  className="py-4 rounded-2xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  disabled={processing}
                  onClick={() => handleAction("APPROVED")}
                  className="py-4 rounded-2xl font-bold text-white bg-green-600 shadow-lg shadow-green-100 hover:bg-green-700 disabled:opacity-50 flex items-center justify-center"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : "Approve"}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 text-center">
          <p className="text-[9px] text-slate-400 uppercase tracking-[0.3em] font-bold">Encrypted Authorization</p>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, title, message }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-[3rem] p-12 text-center shadow-2xl border border-slate-100">
        <div className="flex justify-center mb-8">{icon}</div>
        <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">{title}</h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-10">{message}</p>
        <button 
          onClick={() => window.close()} 
          className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] bg-slate-900 text-white shadow-lg active:scale-95 transition-all"
        >
          Close Page
        </button>
      </div>
    </div>
  );
}