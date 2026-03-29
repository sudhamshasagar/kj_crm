import React, { useRef } from "react";
import html2pdf from "html2pdf.js";
import { ArrowRight, Download, MoveRight, X } from "lucide-react";

const N = (v, d = 0) => {
  const n = Number(v);
  return isNaN(n) ? d : n;
};

const formatInvoiceDate = (dateVal) => {
  if (!dateVal) return "";
  try {
    const d = dateVal.seconds ? new Date(dateVal.seconds * 1000) : 
              dateVal.toDate ? dateVal.toDate() : 
              new Date(dateVal);
    
    return d.toLocaleDateString("en-IN", { 
      day: '2-digit', month: '2-digit', year: 'numeric' 
    });
  } catch (e) {
    return "Invalid Date";
  }
};

export default function GSTInvoiceA5({
  customer = {},
  items = [],
  totals = {},
  adjustments = {},
  invoiceNo,
  generatedAt,
  onClose
}) {
  const pdfRef = useRef();
  const [printMode, setPrintMode] = React.useState(false);

  const download = () => {
    const element = pdfRef.current;
    const opt = {
      margin: 0,
      filename: `Invoice_${invoiceNo}.pdf`,
      image: { type: 'jpeg', quality: 1 },
      html2canvas: { 
        scale: 3,
        useCORS: true,
        letterRendering: true
      },
      jsPDF: { unit: "mm", format: "a5", orientation: "portrait" },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };
    html2pdf().set(opt).from(element).save();
  };

  const numberToWords = (num) => {
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six',
    'Seven', 'Eight', 'Nine', 'Ten', 'Eleven',
    'Twelve', 'Thirteen', 'Fourteen', 'Fifteen',
    'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
             'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[n % 10];
    if (n < 1000)
      return a[Math.floor(n / 100)] + ' Hundred ' + inWords(n % 100);
    if (n < 100000)
      return inWords(Math.floor(n / 1000)) + ' Thousand ' + inWords(n % 1000);
    if (n < 10000000)
      return inWords(Math.floor(n / 100000)) + ' Lakh ' + inWords(n % 100000);
    return '';
  };

  return inWords(num) + ' Rupees Only';
};

const printInvoice = () => {
  setPrintMode(true);

  setTimeout(() => {
    window.print();
    setPrintMode(false);
  }, 200);
};

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[9999] overflow-auto flex flex-col items-center py-10">
      
      <div className="w-[148mm] mb-4 flex justify-end gap-3 print:hidden px-4">
        <button
          onClick={printInvoice}
          className="bg-emerald-600 text-white px-6 py-2 text-[10px] font-black rounded-md shadow-lg flex items-center gap-2 uppercase tracking-widest"
        >
          Print Invoice
        </button>
        <button onClick={download} className="bg-blue-600 text-white px-6 py-2 text-[10px] font-black rounded-md shadow-lg flex items-center gap-2 uppercase tracking-widest">
          <Download size={14} /> Download PDF
        </button>
        <button onClick={onClose} className="bg-white border text-black px-4 py-2 text-[10px] font-black rounded-md flex items-center gap-2 uppercase tracking-widest">
          <X size={14} /> Close
        </button>
      </div>

      <div
        ref={pdfRef}
        style={{ width: "148mm", minHeight: "210mm", backgroundColor: "#fff" }}
        className="mx-auto shadow-2xl p-[12mm] relative text-black font-sans"
      >
        {/* PAGE 1 */}
        <div className="min-h-[190mm] flex flex-col">
          
          {/* HEADER - CLEAN TOP */}
          <div className="flex justify-between items-start">
            {/* LEFT SIDE */}
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter leading-none mb-1">
                Keshav Jewellers
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-black-800">
                MKS Jewels Private Limited
              </p>
              <div className="text-[9px] leading-tight text-gray-600">
                <p>Asst No 209-209-190, Tilak Road, Sagara - 577401</p>
                <div className="flex gap-3 mt-1 font-bold text-black uppercase">
                  <span>PAN: AARCM3452G</span>
                  <span>CIN: U32111KA2023PTC179339</span>
                </div>
                <p className="font-black text-black mt-0.5">
                  GSTIN: 29AARCM3452G1Z3
                </p>
              </div>
            </div>
            {/* RIGHT SIDE */}
            <div className="flex flex-col items-end">
              <img
                src="/kc2.png"
                alt="Logo"
                className="w-28 h-auto object-contain"
              />
            </div>
          </div>
          <div className="text-center text-[16px] font-black uppercase tracking-widest mb-2">
              Tax Invoice
            </div>
          {/* COMBINED BILLING & INVOICE INFO BOX */}
          <div className="grid grid-cols-2 border border-black mb-4">
            {/* BILLED TO LEFT */}
            
            <div className="p-2 border-r border-black bg-gray-50">
              <p className="text-[8px] font-black uppercase text-gray-400">Billed To</p>
              <p className="text-[11px] font-black uppercase">{customer.name || "Walk-in Customer"}</p>
              <p className="text-[10px] font-bold">{customer.mobile}</p>
              <p className="text-[9px] text-gray-600 leading-tight">{customer.address}</p>
            </div>

            {/* INVOICE INFO RIGHT */}
            <div className="p-2 flex flex-col justify-center">
              <div className="text-[10px] space-y-0.5">
                <p className="flex justify-between">
                  <span className="font-bold text-gray-500">Invoice No:</span> 
                  <span className="font-mono font-black">{invoiceNo}</span>
                </p>
                <p className="flex justify-between">
                  <span className="font-bold text-gray-500">Date:</span> 
                  <span className="font-black">{formatInvoiceDate(generatedAt)}</span>
                </p>
                <p className="flex justify-between  pt-0.5 mt-0.5">
                  <span className="font-bold text-gray-500">Place of Supply:</span> 
                  <span className="font-bold text-black-800">Karnataka (29)</span>
                </p>
              </div>
            </div>
          </div>

          {/* TABLE */}
          <table className="w-full text-left mb-4">
            <thead>
              <tr className="border-t-2 border-b-2 border-black text-[9px] font-black uppercase">
                <th className="py-2">Description</th>
                <th className="py-2 text-center">Net Wt</th>
                <th className="py-2 text-center">VA</th>
                <th className="py-2 text-center">Rate</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 border-b border-black">
              {items.map((it, i) => (
                <tr key={i} className="text-[11px] align-top">
                  <td className="py-2">
                    <p className="font-bold uppercase">{it.productName} ({it.purity}) </p>
                    <p className="text-[8px] text-gray-800 uppercase font-medium">
                      G: {N(it.grossWeight).toFixed(3)}g | S: {N(it.stoneWeight).toFixed(3)}g | HSN: {it.hsnCode} | SC: {N(it.stoneCharge) ? `₹${N(it.stoneCharge).toLocaleString("en-IN")}` : "NA"}
                      {it.huid && ` | HUID: ${it.huid}`}
                    </p>
                  </td>
                  <td className="py-2 text-center font-bold">{N(it.netWeight).toFixed(3)} g</td>
                  <td className="py-2 text-center font-bold">{N(it.makingChargeValue)}{it.makingChargeType === "PERCENT" ? "%" : "/g"}</td>
                  <td className="py-2 text-center">₹{N(it.rate).toLocaleString("en-IN")}</td>
                  <td className="py-2 text-right font-black">{N(totals.taxable).toFixed(2).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
            {/* BANK DETAILS */}
          </table>
          

          {/* SUMMARY */}
         <div className="flex justify-end mb-6">
          <div className="flex flex-col items-end">
            {/* TOTALS BOX */}
            <div className="w-[220px] space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="font-bold text-gray-500">Sub Total</span>
                <span className="font-bold text-black font-mono">
                  ₹{N(totals.taxable).toFixed(2).toLocaleString("en-IN")}
                </span>
              </div><div className="flex justify-between text-[11px]">
                <span className="font-bold text-gray-500 italic">CGST (1.5%)</span>
                <span className="font-bold font-mono">
                  ₹{N(totals.cgst).toFixed(2).toLocaleString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="font-bold text-gray-500 italic">SGST (1.5%)</span>
                <span className="font-bold font-mono">
                  ₹{N(totals.sgst).toFixed(2).toLocaleString("en-IN")}
                </span>
              </div>
              {(N(adjustments.exchange) > 0 || N(adjustments.discount) > 0) && (
                <div className="border-y border-dashed py-1 text-red-700 font-bold text-[10px]">
                  {N(adjustments.exchange) > 0 && (
                    <div className="flex justify-between">
                      <span>OLD GOLD ADJ.</span>
                      <span>-₹{N(adjustments.exchange).toLocaleString("en-IN")}</span>
                    </div>
                  )}

                  {N(adjustments.discount) > 0 && (
                    <div className="flex justify-between">
                      <span>DISCOUNT</span>
                      <span>-₹{N(adjustments.discount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-between items-center pt-1 border-t-2 border-black">
                <span className="text-[12px] font-black uppercase">Grand Total</span>
                <span className="text-[16px] font-black">
                  ₹ {N(totals.grand).toFixed(2).toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            {/* AMOUNT IN WORDS */}
            <div className="flex justify-end">
              <div className="text-[10px] text-black-800 font-semibold mt-3 text-right w-full">
                Amount in Words: {numberToWords(Math.round(N(totals.grand)))}
              </div>
            </div>
          </div>
        </div>
           <div className="w-full text-center text-[9px] font-semibold mb-3">
              Bank: HDFC Bank – Sagara | A/C: 50200088170039 | IFSC: HDFC0003220
            </div>
          {/* FOOTER - PUSHED TO BOTTOM */}
          <div className="mt-auto pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-[9px] space-y-1">
                {/* BANK DETAILS */}
                {/* CONTACT */}
                <div className="mt-2">
                  <p className="text-[8px] font-black uppercase text-gray-500 mb-1">
                    Contact
                  </p>
                  <p>Ph: 9448319501</p>
                  <p>Email: mksjpvtltd@gmail.com</p>
                </div>
                {/* DECLARATION */}
                <div className="mt-3 text-[8px] italic text-gray-500 leading-snug">
                  <p>
                    Declaration: We declare that this invoice shows the actual price of the
                    goods described and that all particulars are true and correct.
                  </p>
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <div className="h-10 w-32 border-b border-black mb-1"></div>
                <p className="text-[9px] font-black uppercase">Authorized Signatory</p>
                <p className="text-[8px] text-gray-400 italic">For Keshav Jewellers</p>
              </div>
            </div>
          </div>
        </div>

        {/* PAGE 2 - SCHEMES */}
        <div className="page-break-before pt-10 border-t-2 border-dashed border-gray-200 mt-20">
          <div className="text-center mb-8">
            <h3 className="text-xl font-black text-black-800">ನಮ್ಮ ಉಳಿತಾಯ ಯೋಜನೆಗಳು</h3>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Our Savings Schemes</p>
          </div>
          <div className="grid grid-cols-1 gap-4 max-w-[400px] mx-auto">
            <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg">
              <p className="font-black text-black-900 mb-1"> 12+1 ಉಳಿತಾಯ ಯೋಜನೆ</p>
              <p className="text-[11px] leading-relaxed">ಪ್ರತಿ ತಿಂಗಳು 12 ತಿಂಗಳುಗಳ ಕಾಲ ಹಣ ಜಮಾ ಮಾಡಿ, 13ನೇ ತಿಂಗಳ ಕಂತನ್ನು ಸಂಸ್ಥೆಯಿಂದ ಉಚಿತವಾಗಿ ಪಡೆಯಿರಿ.</p>
            </div>
            <div className="border border-blue-200 bg-blue-50 p-4 rounded-lg">
              <p className="font-black text-black-900 mb-1"> ಸ್ವರ್ಣ ನಿಧಿ ಯೋಜನೆ</p>
              <p className="text-[11px] leading-relaxed">ಪ್ರತೀ ತಿಂಗಳು ಉಳಿತಾಯ ಮಾಡಿ, ಆ ದಿನದ ಉತ್ತಮ ಚಿನ್ನದ ದರದಲ್ಲಿ ಖರೀದಿ ಸೌಲಭ್ಯ ಪಡೆಯಿರಿ.</p>
            </div>
          </div>
          <div className="mt-20 text-center opacity-30 italic text-[10px]">
            <p>Visit us again for more exquisite collections</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .page-break-before {
            page-break-before: always;
            border-top: none;
            margin-top: 0;
            padding-top: 15mm;
          }
        }
          
      `}</style>
    </div>
  );
}