import React, { useRef } from "react";
import html2pdf from "html2pdf.js";

export default function ExchangeDeclarationPDF({
  customer,
  items,
  onClose
}) {
  const pdfRef = useRef();

  const today = new Date().toLocaleDateString("en-IN");

  const totalValue = items.reduce((s, i) => s + Number(i.value || 0), 0);

  /* ---------- DOWNLOAD PDF ---------- */
  const handleDownload = () => {
    const element = pdfRef.current;

    html2pdf()
      .set({
        margin: 10,
        filename: `Exchange_Declaration_${customer.name}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
      })
      .from(element)
      .save();
  };

  return (
    <div className="fixed inset-0 bg-white z-[999] overflow-auto p-10 text-sm">

      {/* ACTION BUTTONS */}
      <div className="flex justify-end gap-3 mb-6">
        <button
          onClick={() => window.print()}
          className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold"
        >
          Print
        </button>

        <button
          onClick={handleDownload}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold"
        >
          Download PDF
        </button>

        <button
          onClick={onClose}
          className="bg-red-500 text-white px-4 py-2 rounded-lg font-bold"
        >
          Close
        </button>
      </div>

      {/* DECLARATION BODY */}
      <div ref={pdfRef} className="max-w-3xl mx-auto leading-relaxed">

        <h1 className="text-center font-bold text-lg mb-4">
          DECLARATION OF OWNERSHIP
        </h1>

        <p className="mb-4">
          I, <b>{customer.name}</b>, hereby declare that I am the lawful owner
          of the following gold ornaments and voluntarily selling them to
          <b> Keshava Jewellers, Sagara</b> for a mutually agreed price.
        </p>

        {/* TABLE */}
        <table className="w-full border text-xs mb-6">
          <thead>
            <tr className="border">
              <th className="border p-2">Sl No</th>
              <th className="border p-2">Description</th>
              <th className="border p-2">Weight (g)</th>
              <th className="border p-2">Purity</th>
              <th className="border p-2">Value (₹)</th>
            </tr>
          </thead>

          <tbody>
            {items.map((it, i) => (
              <tr key={i} className="border">
                <td className="border p-2 text-center">{i + 1}</td>
                <td className="border p-2">{it.description}</td>
                <td className="border p-2 text-center">{it.weight}</td>
                <td className="border p-2 text-center">{it.purity}%</td>
                <td className="border p-2 text-right">
                  ₹{Math.round(it.value)}
                </td>
              </tr>
            ))}

            <tr className="border font-bold">
              <td className="border p-2 text-right" colSpan={4}>
                Total
              </td>
              <td className="border p-2 text-right">
                ₹{Math.round(totalValue)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mb-6">
          I confirm that I have received the agreed amount in full and have no
          further claim over the said ornaments.
        </p>

        {/* SIGNATURE */}
        <div className="grid grid-cols-2 gap-10 mt-16">
          <div>
            <p>Date: {today}</p>
            <p>Place: Sagara</p>
          </div>

          <div className="text-right">
            <p className="mt-16">______________________</p>
            <p>Signature of Seller</p>
            <p>{customer.name}</p>
            <p>{customer.mobile}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
