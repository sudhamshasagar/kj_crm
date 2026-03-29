import React from "react";

// Reusable Divider using Tailwind
const Divider = ({ thick = false }) => (
  <div className={`w-full my-3 ${thick ? 'border-t-2 border-black' : 'border-t border-dashed border-black'}`} />
);

export default function ThermalSlip({ customer, items = [], grandTotal = 0, estimationId }) {
  const now = new Date();

  return (
    <div className="w-[80mm] p-4 bg-white text-black font-mono leading-relaxed mx-auto">
      
      {/* HEADER: Centered */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold uppercase tracking-tight">
          Keshava Jewellers, Sagara
        </h2>
        <p className="text-sm">📞 +91 94485 19501</p>
        <div className="inline-block mt-2 px-4 py-1 border border-black text-xs font-bold tracking-widest">
          ESTIMATION SLIP
        </div>
      </div>

      <Divider thick />

      {/* CUSTOMER INFO: Left Aligned */}
      <div className="text-left text-[13px] space-y-1 uppercase">
        <p><span className="font-bold">CUSTOMER:</span> {customer?.name || "Sudhamsha Sagar"}</p>
        <p><span className="font-bold">MOBILE  :</span> {customer?.mobile || "7975073574"}</p>
      </div>

      <Divider />

      {/* ITEMS LIST: Left Aligned with Right-Aligned Subtotal */}
      <div className="text-left space-y-4">
        {items.map((item, i) => (
          <div key={i} className="text-[12px]">
            <div className="font-bold border-b border-gray-100 pb-1 mb-1 uppercase italic">
              {i + 1}. {item.display || item.item || "MANGAL SUTRA"}
            </div>
            
            <div className="pl-2 space-y-0.5">
              <div className="flex justify-between">
                <span>WEIGHT:</span>
                <span className="font-bold">{item.gross || "52"} g</span>
              </div>
              <div className="flex justify-between">
                <span>RATE:</span>
                <span>₹{Number(item.rate || 17600).toLocaleString()}/g</span>
              </div>
              <div className="flex justify-between text-[11px] text-gray-800">
                <span>CHARGES:</span>
                <span>
                  {item.mcType || "Percentage"}: {item.mcValue || "10"}% | ST: ₹{item.stoneCharges || "0.00"}
                </span>
              </div>
            </div>

            <div className="text-right font-bold text-[14px] mt-1">
              SUBTOTAL: ₹{Number(item.total || 946009.68).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </div>
          </div>
        ))}
      </div>

      <Divider thick />

      {/* GRAND TOTAL: Centered */}
      <div className="text-center py-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-gray-600">Grand Total</p>
        <h3 className="text-2xl font-bold">
          ₹{Math.round(grandTotal || 946010).toLocaleString("en-IN")}
        </h3>
        <p className="text-[9px] italic text-gray-500 mt-1">(Rounded Off | Inclusive of GST)</p>
      </div>

      <Divider />

      {/* FOOTER: Centered */}
      <div className="text-center text-[10px] space-y-2">
        <p className="font-bold">ID: {estimationId || "SS-00002-20260228-344"}</p>
        <p>{now.toLocaleDateString()} | {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        
        <div className="mt-4 p-2 border border-dashed border-gray-400 font-medium">
          * Estimation valid for 24 hours only *
        </div>
        
        <p className="mt-4 font-bold text-[7px] tracking-[0.3em]">THANK YOU</p>
      </div>
      
    </div>
  );
}