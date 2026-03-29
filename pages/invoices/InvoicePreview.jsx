import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useParams, useNavigate } from "react-router-dom"; // Added useNavigate
import { useEffect, useState } from "react";
import GSTInvoiceA5 from "../../components/common/GSTInvoiceA5";

export default function InvoicePreview() {
  const { id } = useParams();
  const navigate = useNavigate(); // Navigation hook
  const [data, setData] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "sales_estimations", id), (snap) => {
      if (snap.exists()) {
        setData(snap.data());
      }
    });
    return () => unsub();
  }, [id]);

  if (!data) return (
    <div className="h-screen flex items-center justify-center dashboard-bg">
      <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <GSTInvoiceA5
      customer={data.customer}
      items={data.invoice.items}
      totals={data.invoice.totals}
      adjustments={data.invoice.adjustments}
      paymentLedger={data.invoice.paymentLedger || []}
      invoiceNo={data.invoice.number}
      date={data.closedAt?.seconds * 1000}
      onClose={() => navigate(-1)} // Corrected: Navigates back to the list
    />
  );
}