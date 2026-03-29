import { useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../firebaseConfig";
import GSTInvoiceA5 from "../../components/common/GSTInvoiceA5";
import { useEffect, useState } from "react";

export default function ViewInvoice() {
  const [showInvoice, setShowInvoice] = useState(false);
  const { id } = useParams();
  const [data, setData] = useState(null);

  useEffect(() => {

    const unsub = onSnapshot(
      doc(db, "sales_estimations", id),
      (snap) => {
        setData(snap.data());
      }
    );

    return () => unsub();

  }, [id]);

  if (!data) return null;

  return (
    <GSTInvoiceA5
      customer={data.customer || {}}
      items={data.items || []}
      totals={{
        taxable: Math.round((data.summary?.totalAmount || 0) / 1.03),
        cgst: Math.round((data.summary?.totalAmount || 0) * 0.015),
        sgst: Math.round((data.summary?.totalAmount || 0) * 0.015),
        grand: data.summary?.totalAmount || 0
      }}
      adjustments={{
        exchange: data.exchangeSummary?.total || 0,
        investment: data.investmentRedemption || 0,
        discount: 0
      }}
      invoiceNo={data.estimationId}
      date={
        data.closedAt?.seconds
          ? new Date(data.closedAt.seconds * 1000)
              .toLocaleDateString("en-IN")
          : ""
      }
      onClose={() => setShowInvoice(false)}
    />
  );
}