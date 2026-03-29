import React from "react";

const MobileTransactionCard = ({ item, businessType, actions }) => {
  const isAssignment = item.transactionType === "ASSIGNMENT";
  const isReturn = item.transactionType?.includes("RETURN");

  const dateStr = item.displayDate?.seconds
    ? new Date(item.displayDate.seconds * 1000).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      })
    : "—";

  const purity = Number(item.rawMaterialPurity ?? item.purity ?? 0);
  const wastage = Number(item.wastage || 0);

  const weight = isAssignment
    ? Number(item.rawMaterialWeight || 0)
    : Number(item.returnedWeight || 0);

  const effective = isAssignment
    ? Number(item.effectiveGoldAssigned || 0)
    : Number(item.effectiveGoldReturned || 0);

  const cash = isAssignment
    ? Number(item.advanceCashPaid || 0)
    : Number(item.stoneCharges || 0);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {dateStr}
        </span>
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase ${
          isAssignment
            ? "bg-amber-50 text-amber-700"
            : "bg-blue-50 text-blue-700"
        }`}>
          {isAssignment ? "Given" : "Returned"}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-xl text-sm">
        <div>
          <p className="text-[9px] text-gray-400 font-bold uppercase">Wt</p>
          <p className="font-bold">{weight.toFixed(2)}g</p>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 font-bold uppercase">Purity</p>
          <p className="font-bold">{purity}%</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-400 font-bold uppercase">
            {businessType === "B2J" ? "Eff" : "Qty"}
          </p>
          <p className="font-bold">
            {businessType === "B2J"
              ? `${effective.toFixed(3)}g`
              : item.quantityNos || item.returnedQuantityNos || "-"}
          </p>
        </div>
      </div>

      {/* Cash */}
      <div className="flex justify-between mt-3 text-sm">
        <span className="text-gray-500">
          {isAssignment ? "Advance" : "Stone"}
        </span>
        <span className="font-bold">₹{cash}</span>
      </div>

      {/* ✅ WASTAGE — ALWAYS SHOW FOR RETURNS */}
      {isReturn && (
        <div className="mt-2 flex justify-between bg-orange-50 border border-orange-100 px-3 py-2 rounded-lg">
          <span className="text-[10px] font-bold text-orange-500 uppercase">
            Wastage
          </span>
          <span className="font-bold text-orange-700">
            +{wastage.toFixed(2)}g
          </span>
        </div>
      )}

      {/* Actions */}
      {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}
    </div>
  );
};

export default MobileTransactionCard;
