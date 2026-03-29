import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs, getDoc, doc
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { ArrowLeft } from "lucide-react";

export default function ItemHistory() {
  const { itemId } = useParams();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [saleDetails, setSaleDetails] = useState({});

  const loadSaleDetails = async (estimationId) => {
  if (saleDetails[estimationId]) return; // cache

  const snap = await getDoc(doc(db, "sales_estimations", estimationId));
  if (!snap.exists()) return;

  setSaleDetails((prev) => ({
    ...prev,
    [estimationId]: snap.data()
  }));
};

  useEffect(() => {
    if (!itemId) return;

    const loadHistory = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "item_history"),
          where("itemId", "==", itemId),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        setRows(
          snap.docs.map((d) => ({
            id: d.id,
            ...d.data()
          }))
        );
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [itemId]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 border rounded-lg hover:bg-slate-100"
        >
          <ArrowLeft size={16} />
        </button>

        <h1 className="text-xl font-semibold">
          Item History – {itemId}
        </h1>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-slate-600">
            <tr>
              <th className="p-3 text-left">Date</th>
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">Reference</th>
              <th className="p-3 text-left">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <>
                {/* MAIN ROW */}
                <tr key={r.id} className="border-t">
                  <td className="p-3">
                    {r.createdAt?.toDate().toLocaleString()}
                  </td>

                  <td className="p-3 font-medium">
                    {r.action === "SALE" && (
                      <span className="px-2 py-1 rounded bg-red-50 text-red-600 text-xs font-bold">
                        SOLD
                      </span>
                    )}
                    {r.action === "STOCK_ADD" && (
                      <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-xs font-bold">
                        STOCK
                      </span>
                    )}
                  </td>

                  <td className="p-3 font-mono text-xs">
                    {r.reference || "-"}
                  </td>

                  <td className="p-3">
                    {r.action === "SALE" ? (
                      <button
                        onClick={async () => {
                          setExpanded(expanded === r.id ? null : r.id);
                          await loadSaleDetails(r.reference);
                        }}
                        className="text-blue-600 text-xs font-bold hover:underline"
                      >
                        {expanded === r.id ? "Hide Details" : "View Details"}
                      </button>
                    ) : (
                      r.remarks || "-"
                    )}
                  </td>
                </tr>

                {/* EXPANDED DETAILS ROW */}
                {expanded === r.id && saleDetails[r.reference] && (
                  <tr className="bg-slate-50 border-t">
                    <td colSpan={4} className="p-4 text-xs">
                      <div className="grid grid-cols-2 gap-4">

                        <div>
                          <span className="block text-slate-400 uppercase text-[10px]">
                            Customer
                          </span>
                          <span className="font-bold">
                            {saleDetails[r.reference].customer?.name || "—"}
                          </span>
                        </div>

                        <div>
                          <span className="block text-slate-400 uppercase text-[10px]">
                            Bill Amount
                          </span>
                          <span className="font-bold">
                            ₹ {saleDetails[r.reference].payment?.totalBill || 0}
                          </span>
                        </div>

                        <div>
                          <span className="block text-slate-400 uppercase text-[10px]">
                            Payment Mode
                          </span>
                          <span className="font-bold">
                            {saleDetails[r.reference].payment?.type || "—"}
                          </span>
                        </div>

                        <div className="flex items-end">
                          <button
                            onClick={() =>
                              navigate(`/sales/${r.reference}/invoice`)
                            }
                            className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-black"
                          >
                            Open Invoice
                          </button>
                        </div>

                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}

            {/* EMPTY / LOADING STATES */}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  No history found
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={4} className="p-6 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
          </tbody>

        </table>
      </div>
    </div>
  );
}
