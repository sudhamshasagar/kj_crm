import React, { useState } from "react";
import { Lock } from "lucide-react";
import toast from "react-hot-toast";
import { useAdminPasscode } from "../../hooks/useAdminPasscode";

const PasscodeModal = ({ open, onClose, onSuccess, actionTitle }) => {
  const [pass, setPass] = useState("");
  const { verifyPasscode, loading } = useAdminPasscode();

  if (!open) return null;

  const handleSubmit = async () => {
    if (!pass) return toast.error("Enter passcode");

    const ok = await verifyPasscode(pass);

    if (ok) {
      onSuccess();
      setPass("");
      onClose();
    } else {
      toast.error("Invalid Passcode");
      setPass("");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl max-w-xs w-full shadow-2xl">
        <div className="flex flex-col items-center mb-4">
          <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
            <Lock className="w-6 h-6 text-amber-600" />
          </div>

          <h3 className="text-lg font-bold text-gray-800">
            Admin Verification
          </h3>

          <p className="text-xs text-gray-500 text-center mt-1">
            Enter passcode to {actionTitle}
          </p>
        </div>

        <input
          type="password"
          autoFocus
          maxLength={6}
          placeholder="••••"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          className="w-full text-center text-2xl tracking-[0.5em] font-bold p-3 border-2 border-gray-200 rounded-xl focus:border-amber-500 outline-none mb-6"
        />

        <div className="flex gap-2">
          <button
            onClick={() => {
              setPass("");
              onClose();
            }}
            className="flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-lg text-sm hover:bg-gray-200"
          >
            Cancel
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 bg-amber-600 text-white font-bold rounded-lg text-sm hover:bg-amber-700 shadow-lg disabled:opacity-50"
          >
            {loading ? "Checking..." : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PasscodeModal;