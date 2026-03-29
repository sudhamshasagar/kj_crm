import { useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X } from "lucide-react";

export default function BarcodeScannerModal({ open, onClose, onScan }) {
  useEffect(() => {
    if (!open) return;

    const scanner = new Html5Qrcode("barcode-scanner");

    scanner
      .start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          onScan(decodedText);
          scanner.stop();
          onClose();
        }
      )
      .catch(() => {});

    return () => {
      scanner.stop().catch(() => {});
    };
  }, [open, onClose, onScan]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl w-[90%] max-w-md p-4 space-y-3 shadow-xl">
        
        {/* HEADER */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            Scan Barcode
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>

        {/* CAMERA */}
        <div
          id="barcode-scanner"
          className="w-full aspect-square rounded-xl overflow-hidden border border-slate-200"
        />

        <p className="text-xs text-center text-slate-500">
          Align the barcode within the frame
        </p>
      </div>
    </div>
  );
}
