import React, { useState } from "react";
import { X, FileDown, CheckCircle } from "lucide-react";

export default function ExchangeAcknowledgeForm({
  isOpen,
  onClose,
  onAcknowledge,
  onGeneratePDF,
  customer
}) {
  if (!isOpen) return null;

  const [aadhar, setAadhar] = useState(customer?.aadhar || "");
  const [pan, setPan] = useState(customer?.pan || "");
  const [signature, setSignature] = useState("");

  const isValid =
    aadhar.length === 12 &&
    pan.length === 10 &&
    signature.trim().length > 2;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-2xl border border-gray-700 p-8 text-black shadow-xl">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold underline">DECLARATION OF OWNERSHIP</h2>
          <button onClick={onClose} className="text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Legal body */}
        <div className="space-y-4 text-[15px] leading-6">

          <p>
            I, <b>{customer?.name || "_____________"}</b>, residing at
            <span className="ml-1 underline">{customer?.city || "_______________________________"}</span>,
            hereby declare and affirm the following:
          </p>

          <ol className="list-decimal list-inside space-y-2">
            <li>I am the sole and lawful owner of the gold items being exchanged.</li>
            <li>The said items are self-acquired and not stolen, pledged, or under any legal dispute.</li>
            <li>
              I agree that my identification details will be stored as per legal requirements.
            </li>
          </ol>

          {/* User fields */}
          <div className="mt-6 space-y-4">
            <div>
              <label className="font-semibold">Aadhaar Number:</label>
              <input
                type="number"
                value={aadhar}
                onChange={(e) => setAadhar(e.target.value)}
                className="border border-gray-600 w-full p-2 mt-1"
                placeholder="Enter 12-digit Aadhaar"
              />
            </div>

            <div>
              <label className="font-semibold">PAN Number:</label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value.toUpperCase())}
                className="border border-gray-600 w-full p-2 mt-1"
                placeholder="ABCDE1234F"
              />
            </div>

            <div>
              <label className="font-semibold">Signature (Full Name):</label>
              <input
                type="text"
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                className="border border-gray-600 w-full p-2 mt-1"
                placeholder="Type your full name"
              />
            </div>
          </div>

          {/* Footer Block */}
          <div className="border-t border-gray-700 mt-6 pt-6">
            <p>Date: __________________</p>
            <p>Place: SAGARA</p>

            <div className="mt-6">
              <p><b>Signature of Seller:</b> ________________________</p>
              <p>Name: {customer?.name}</p>
              <p>Contact Number: {customer?.mobile}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between mt-8">

          <button
            onClick={() => onGeneratePDF({ aadhar, pan, signature })}
            className="px-4 py-2 border border-gray-700 text-black font-semibold flex items-center gap-2"
          >
            <FileDown className="w-5 h-5" /> Download PDF
          </button>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-700 font-semibold"
            >
              Cancel
            </button>

            <button
              disabled={!isValid}
              onClick={() =>
                onAcknowledge({ aadhar, pan, signature, acknowledged: true })
              }
              className={`px-4 py-2 font-semibold flex items-center gap-2 text-white ${
                isValid ? "bg-red-700" : "bg-red-300 cursor-not-allowed"
              }`}
            >
              <CheckCircle className="w-5 h-5" /> Acknowledge
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
