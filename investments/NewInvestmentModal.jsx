import { useState, useMemo, useCallback } from "react";
import { useAuth } from "../../AuthContext";
import {
  collection,
  getDocs,
  addDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { X, ArrowRight, ArrowLeft, User, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import PasscodeModal from "../common/PasscodeModal";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../firebaseConfig";

const NewInvestmentModal = ({ onClose, onSuccess, schemes }) => {
  const { db } = useAuth();

  const [step, setStep] = useState(1);
  const [mobile, setMobile] = useState("");
  const [customer, setCustomer] = useState(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passcodeOpen, setPasscodeOpen] = useState(false);

  const [formData, setFormData] = useState({
    customerName: "",
    city: "",
    schemeId: "",
    amount: "",
    accountNumber: "",
    joinedDate: new Date().toISOString().split("T")[0],
  });

  const selectedSchemeObj = useMemo(
    () => schemes.find((s) => s.id === formData.schemeId),
    [formData.schemeId, schemes]
  );

  const checkCustomer = useCallback(async () => {
    if (mobile.length !== 10) return;

    setLoading(true);
    try {
      const q = query(collection(db, "CUSTOMERS"), where("mobile", "==", mobile));
      const snap = await getDocs(q);

      if (!snap.empty) {
        const docData = snap.docs[0].data();
        setCustomer({ id: snap.docs[0].id, ...docData });
        setFormData((p) => ({
          ...p,
          customerName: docData.name,
          city: docData.city || "",
        }));
        setIsNewCustomer(false);
      } else {
        setCustomer(null);
        setIsNewCustomer(true);
      }

      setStep(2);
    } catch (e) {
      console.error(e);
      toast.error("Customer lookup failed");
    } finally {
      setLoading(false);
    }
  }, [db, mobile]);

  const validateAndTriggerPasscode = () => {
    if (!formData.customerName || !formData.schemeId || !formData.amount) {
      return toast.error("Please fill all required fields");
    }
    setPasscodeOpen(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let finalCustomerId = customer?.customerId;
      let finalCustomerDocId = customer?.id;

      if (isNewCustomer) {
        const newCustId = "CUST" + Math.floor(1000 + Math.random() * 9000);

        const custRef = await addDoc(collection(db, "CUSTOMERS"), {
          customerId: newCustId,
          name: formData.customerName,
          mobile,
          city: formData.city,
          createdAt: serverTimestamp(),
          type: "INVESTOR",
        });

        finalCustomerId = newCustId;
        finalCustomerDocId = custRef.id;
      }

      const joined = new Date(formData.joinedDate);
      const maturity = new Date(joined);
      const duration = Number(selectedSchemeObj?.durationMonths || 0);

      if (duration > 0) maturity.setMonth(maturity.getMonth() + duration);
      else maturity.setFullYear(maturity.getFullYear() + 10);

      const investId = "INV" + Math.floor(10000 + Math.random() * 90000);

      const payload = {
        investmentId: investId,
        customerId: finalCustomerId,
        customerDocId: finalCustomerDocId,
        customerName: formData.customerName,
        customerMobile: mobile,
        schemeId: formData.schemeId,
        schemeName: selectedSchemeObj?.name || "Unknown",
        schemeType: selectedSchemeObj?.type || "SIP",
        accountNumber: formData.accountNumber || "",
        joinedDate: formData.joinedDate,
        maturityDate:
          duration > 0 ? maturity.toISOString().split("T")[0] : "N/A",
        status: "ACTIVE",
        createdAt: serverTimestamp(),
      };

      if (selectedSchemeObj?.type === "SIP") {
        payload.monthlyAmount = Number(formData.amount);
        payload.totalInvestedAmount = 0;
      } else {
        payload.purchaseWeight = Number(formData.amount);
        payload.totalGramsAccumulated = 0;
      }

      const investRef = await addDoc(collection(db, "INVESTMENTS"), payload);

      try {
        const sendWhatsApp = httpsCallable(functions, "sendAccountOpeningWhatsApp");

        await sendWhatsApp({
          mobile: mobile,
          customerName: formData.customerName,
          accountNumber: formData.accountNumber || investRef.id,
          schemeName: selectedSchemeObj?.name || "Scheme",
          openingAmount: formData.amount,
          date: formData.joinedDate,
          balance: formData.amount
        });

      } catch (err) {
        console.error("WhatsApp failed", err);
      }

      toast.success("Investment Created Successfully");
      onSuccess();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Failed to create investment");
    } finally {
      setLoading(false);
    }
    
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 ">
      <div className="w-full max-w-xl bg-white rounded-3xl overflow-hidden mt-10">

        {/* HEADER WITH STEPPER */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-amber-50 to-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900">New Enrollment</h3>
              <p className="text-xs text-gray-500">
                Step {step} of 2 · Investor onboarding
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* STEP BAR */}
          <div className="flex gap-2 mt-4">
            <div className={`h-1 flex-1 rounded ${step >= 1 ? "bg-amber-500" : "bg-gray-200"}`} />
            <div className={`h-1 flex-1 rounded ${step >= 2 ? "bg-amber-500" : "bg-gray-200"}`} />
          </div>
        </div>

        {/* BODY */}
        <div className="p-6 space-y-6">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="text-center space-y-5">
              <div className="mx-auto w-14 h-14 flex items-center justify-center bg-amber-100 rounded-full">
                <User className="w-7 h-7 text-amber-600" />
              </div>

              <div>
                <h4 className="font-semibold text-gray-900">Verify Customer</h4>
                <p className="text-sm text-gray-500">Enter mobile to continue</p>
              </div>

              <input
                value={mobile}
                onChange={(e) => {
                  if (/^\d*$/.test(e.target.value) && e.target.value.length <= 10)
                    setMobile(e.target.value);
                }}
                placeholder="9999999999"
                className="w-full p-3 border rounded-xl text-center tracking-widest text-lg focus:ring-2 focus:ring-amber-200"
              />

              {/* <button
                onClick={checkCustomer}
                disabled={mobile.length !== 10 || loading}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-semibold hover:bg-black disabled:opacity-50"
              >
                {loading ? "Checking..." : "Continue"}
              </button> */}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-6">

              {/* CUSTOMER CARD */}
              <div className="border rounded-2xl p-4 bg-gray-50 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Customer Details
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    placeholder="Full Name"
                    value={formData.customerName}
                    onChange={(e) =>
                      setFormData({ ...formData, customerName: e.target.value })
                    }
                    disabled={!isNewCustomer && customer}
                    className="p-2 border rounded-lg bg-white"
                  />
                  <input
                    placeholder="City"
                    value={formData.city}
                    onChange={(e) =>
                      setFormData({ ...formData, city: e.target.value })
                    }
                    disabled={!isNewCustomer && customer}
                    className="p-2 border rounded-lg bg-white"
                  />
                </div>
              </div>

              {/* INVESTMENT CARD */}
              <div className="border rounded-2xl p-4 space-y-3">
                <div className="text-sm font-semibold text-gray-700">
                  Investment Configuration
                </div>

                <input
                  placeholder="Account Number (optional)"
                  value={formData.accountNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, accountNumber: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg"
                />

                <select
                  value={formData.schemeId}
                  onChange={(e) =>
                    setFormData({ ...formData, schemeId: e.target.value })
                  }
                  className="w-full p-2 border rounded-lg"
                >
                  <option value="">Select Scheme</option>
                  {schemes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>

                {selectedSchemeObj && (
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder={selectedSchemeObj.type === "SIP" ? "Monthly ₹" : "Grams"}
                      value={formData.amount}
                      onChange={(e) =>
                        setFormData({ ...formData, amount: e.target.value })
                      }
                      className="p-2 border rounded-lg"
                    />
                    <input
                      type="date"
                      value={formData.joinedDate}
                      onChange={(e) =>
                        setFormData({ ...formData, joinedDate: e.target.value })
                      }
                      className="p-2 border rounded-lg"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}
        <div className="flex justify-between items-center px-6 py-4 border-t bg-gray-50">
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-gray-600"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          <button
            onClick={step === 1 ? checkCustomer : validateAndTriggerPasscode}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700"
          >
            {step === 1 ? "Next" : "Confirm Enrollment"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <PasscodeModal
        open={passcodeOpen}
        onClose={() => setPasscodeOpen(false)}
        onSuccess={handleSubmit}
        actionTitle="create investment"
      />
    </div>
  );
};

export default NewInvestmentModal;