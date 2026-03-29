import { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebaseConfig";
import { useItems } from "./useItems";

const MODES = [
  { key: "OPENING", label: "Opening Stock" },
  { key: "PURCHASE", label: "Purchase" },
  { key: "ADJUSTMENT", label: "Adjustment" },
];

export default function StockEntry() {
  const [mode, setMode] = useState("OPENING");
  const [articleId, setArticleId] = useState("");
  const [pieces, setPieces] = useState("");
  const [weight, setWeight] = useState("");
  const [remarks, setRemarks] = useState("");
  const [loading, setLoading] = useState(false);

  const { items } = useItems();

  const submitHandler = async () => {
    if (!articleId || !pieces || !weight) return;

    try {
      setLoading(true);

      const createStock = httpsCallable(functions, "secureCreateStockArticle");

      await createStock({
        articleId,
        pieces: Number(pieces),
        totalWeight: Number(weight),
        mode,
        remarks
      });

      alert("Stock Created Successfully");
      setPieces("");
      setWeight("");
      setRemarks("");
    } catch (err) {
      console.error(err);
      alert("Failed to save stock");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">
        Stock Entry
      </h1>

      <div className="bg-white border rounded-2xl p-6 space-y-5">

        <select
          value={articleId}
          onChange={(e) => setArticleId(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 text-sm"
        >
          <option value="">Select Article</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {i.sku} – {i.ornamentName}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={pieces}
          onChange={(e) => setPieces(e.target.value)}
          placeholder="Pieces"
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />

        <input
          type="number"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder="Total Weight (g)"
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />

        <textarea
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Remarks"
          className="w-full rounded-xl border px-3 py-2 text-sm"
        />

        <button
          onClick={submitHandler}
          disabled={loading}
          className="px-6 py-2 rounded-xl bg-amber-600 text-white"
        >
          {loading ? "Saving..." : "Create Stock"}
        </button>
      </div>
    </div>
  );
}