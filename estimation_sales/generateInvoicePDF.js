import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

/* ---------- FONT LOADER ---------- */
async function loadFontAsBase64(url) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/* ---------- AMOUNT TO WORDS ---------- */
function priceToWords(amount) {
  const a = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
    "Seventeen","Eighteen","Nineteen"];
  const b = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n/10)] + " " + a[n%10];
    if (n < 1000) return a[Math.floor(n/100)] + " Hundred " + inWords(n%100);
    if (n < 100000) return inWords(Math.floor(n/1000)) + " Thousand " + inWords(n%1000);
    if (n < 10000000) return inWords(Math.floor(n/100000)) + " Lakh " + inWords(n%100000);
    return inWords(Math.floor(n/10000000)) + " Crore " + inWords(n%10000000);
  };

  return `Indian Rupees ${inWords(Math.floor(amount)).trim()} Only`;
}

/* ---------- MAIN PDF ---------- */
export async function generateInvoicePDF({ sale, billMetrics }) {

  const doc = new jsPDF("p","mm","a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 12;
  const billing = sale.billing || {};

  /* ---------- FONT ---------- */
  const fontBase64 = await loadFontAsBase64("/fonts/Roboto-Regular.ttf");
  doc.addFileToVFS("Roboto-Regular.ttf", fontBase64);
  doc.addFont("Roboto-Regular.ttf","Roboto","normal");
  doc.setFont("Roboto","normal");

  /* ---------- HEADER ---------- */
  doc.setFontSize(12).setFont("Roboto","bold");
  doc.text("TAX INVOICE", margin, y);

  const qr = await QRCode.toDataURL(`UPI://pay?pa=mksjpvtltd@hdfcbank&am=${billMetrics.rounded}`);
  doc.addImage(qr,"PNG",pageWidth-34,y-4,22,22);

  y += 8;
  doc.setFontSize(14);
  doc.text("KESHAVA JEWELLERS", margin, y);

  doc.setFontSize(8).setFont("Roboto","normal");
  doc.text([
    "MKS JEWELS PRIVATE LIMITED",
    "Asst No 209-209-190, Tilak Road, Sagara – 577401",
    "GSTIN: 29AARCM3452G1Z3 | PAN: AARCM3452G",
    "CIN: U32111KA2023PTC179339 | Ph: 9448319501"
  ], margin, y+5);

  y += 28;

  /* ---------- BILL / INVOICE BOX ---------- */
  doc.setDrawColor(180);
  doc.rect(margin,y,pageWidth-margin*2,22);

  doc.setFontSize(9).setFont("Roboto","bold");
  doc.text("Bill To",margin+3,y+6);
  doc.text("Invoice Details",pageWidth/2+3,y+6);

  doc.setFont("Roboto","normal");
  doc.text([
    sale.customer?.name || "N/A",
    sale.customerDetails?.address || "Sagara"
  ],margin+3,y+12);

  doc.text([
    `Invoice No : ${sale.payment?.refNo || "N/A"}`,
    `Invoice Date : ${new Date().toLocaleDateString("en-GB")}`,
    "Place of Supply : Karnataka (29)"
  ],pageWidth/2+3,y+12);

  y += 28;

  /* ---------- PRODUCT TABLE ---------- */
  autoTable(doc,{
    startY:y,
    margin:{left:margin,right:margin},
    head:[[
      "#","Product / Item Description","HSN","HUID","Purity",
      "Orn Wt","Stone Wt","Gross Wt","Stone Charges","Making Charges"
    ]],
    body:sale.items.map((it,i)=>[
      i+1,
      it.productName,
      it.hsnCode || "7113",
      it.huid || "—",
      it.purity || "—",
      Number(it.ornamentWeight||0).toFixed(3),
      Number(it.stoneWeight||0).toFixed(3),
      Number(it.grossWeight||0).toFixed(3),
      it.stoneCharges ? `₹ ${Number(it.stoneCharges).toLocaleString("en-IN")}` : "—",
      it.makingChargeType ? `${it.makingChargeType} @ ${it.makingChargeValue}` : "—"
    ]),
    styles:{fontSize:7,cellPadding:2},
    headStyles:{fillColor:[235,235,235]}
  });

  y = doc.lastAutoTable.finalY + 8;

  /* ---------- INVESTMENT DISCLOSURE ---------- */
  if (billing.useInvestment) {
    doc.setFillColor(245,245,245);
    doc.rect(margin,y,pageWidth-margin*2,14,"F");

    doc.setFontSize(8).setFont("Roboto","bold");
    doc.text("INVESTMENT ADJUSTMENT DISCLOSURE",margin+3,y+5);

    doc.setFontSize(7).setFont("Roboto","normal");
    doc.text(
      doc.splitTextToSize(
        `An amount of ₹ ${Number(billing.redeemAmount).toLocaleString("en-IN")} has been redeemed from Investment Account ID ${billing.investmentId || "N/A"} with customer consent and adjusted against this invoice.`,
        pageWidth-margin*2-6
      ),
      margin+3,y+10
    );
    y += 20;
  }

  /* ---------- SUMMARY PANEL ---------- */
  const labelX = pageWidth - 95;
  const valueX = pageWidth - margin;

  const summaryRow = (label,value) => {
    doc.text(label,labelX,y);
    doc.text(value,valueX,y,{align:"right"});
    y += 6;
  };

  doc.setFontSize(9);
  summaryRow("Taxable Value",`₹ ${billMetrics.subtotal.toLocaleString("en-IN",{minimumFractionDigits:2})}`);
  summaryRow("CGST @1.5%",`₹ ${billMetrics.cgst.toLocaleString("en-IN",{minimumFractionDigits:2})}`);
  summaryRow("SGST @1.5%",`₹ ${billMetrics.sgst.toLocaleString("en-IN",{minimumFractionDigits:2})}`);

  if (billing.useInvestment) {
    doc.line(labelX,y-2,valueX,y-2);
    doc.setFont("Roboto","bold");
    summaryRow("Less : Investment Redemption",`(-) ₹ ${Number(billing.redeemAmount).toLocaleString("en-IN")}`);
    doc.setFont("Roboto","normal");
  }

  /* ---------- FINAL PAYABLE BAND ---------- */
  y += 2;
  doc.setFillColor(230,230,230);
  doc.rect(labelX-3,y,valueX-labelX+3,10,"F");

  doc.setFontSize(11).setFont("Roboto","bold");
  doc.text("FINAL PAYABLE AMOUNT",labelX,y+7);
  doc.text(`₹ ${billMetrics.rounded.toLocaleString("en-IN")}`,valueX,y+7,{align:"right"});

  y += 18;

  /* ---------- FOOTER ---------- */
  doc.setFontSize(9).setFont("Roboto","bold");
  doc.text("Amount in Words:",margin,y);
  doc.setFont("Roboto","normal");
  doc.text(priceToWords(billMetrics.rounded),margin,y+6);

  y += 16;
  doc.setFontSize(8);
  doc.text([
    "Bank : HDFC BANK, SAGARA",
    "A/c No : 50200088170039 | IFSC : HDFC0003220",
    "Certified that the particulars given above are true and correct."
  ],margin,y);

  doc.setFont("Roboto","bold");
  doc.text("Authorised Signatory",pageWidth-margin,y+10,{align:"right"});

  doc.save(`Tax_Invoice_${sale.payment?.refNo || "Draft"}.pdf`);
}
