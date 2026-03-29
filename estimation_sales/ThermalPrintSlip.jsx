export default function ThermalSlip({ customer, items = [], grandTotal = 0, estimationId }) {
  const now = new Date();
  
  // Reusable Divider Component for consistent professional spacing
  const Divider = ({ thick = false }) => (
    <div style={{ 
      borderTop: thick ? "2px solid #000" : "1px dashed #000", 
      margin: "12px 0", 
      width: "100%" 
    }} />
  );

  return (
    <div style={{ 
      width: "80mm", 
      padding: "10mm 5mm", 
      color: "#000", 
      background: "#fff", 
      fontFamily: "'Courier New', Courier, monospace", // Standard receipt font
      lineHeight: "1.5"
    }}>
      
      {/* SECTION 1: HEADER (Centered) */}
      <div style={{ textAlign: "center", marginBottom: "10px" }}>
        <div style={{ fontSize: "18px", fontWeight: "bold", textTransform: "uppercase" }}>
          Keshav Jewellers, Sagara [cite: 1]
        </div>
        <div style={{ fontSize: "10px" }}>📞 +91 94485 19501 [cite: 2]</div>
        <div style={{ 
          display: "inline-block", 
          marginTop: "8px", 
          padding: "2px 10px", 
          border: "1px solid #000", 
          fontSize: "12px", 
          fontWeight: "bold" 
        }}>
          ESTIMATION SLIP
        </div>
      </div>

      <Divider thick />

      {/* SECTION 2: CUSTOMER (Left Aligned) */}
      <div style={{ textAlign: "left", fontSize: "13px" }}>
        <div style={{ marginBottom: "2px" }}>
          <strong>CUSTOMER:</strong> {customer?.name?.toUpperCase() || "SUDHAMSHA SAGAR"} [cite: 3]
        </div>
        <div>
          <strong>MOBILE  :</strong> {customer?.mobile || "7975073574"} [cite: 4]
        </div>
      </div>

      <Divider />

      {/* SECTION 3: ITEMS (Left Aligned) */}
      <div style={{ textAlign: "left", width: "100%" }}>
        {items.map((item, i) => (
          <div key={i} style={{ marginBottom: "12px" }}>
            {/* Item Name & Index */}
            <div style={{ fontWeight: "bold", fontSize: "14px", borderBottom: "1px solid #eee", marginBottom: "4px" }}>
              {i + 1}. {item.display?.toUpperCase() || "MANGAL SUTRA"} [cite: 5]
            </div>
            
            {/* Standard Labeling Grid */}
            <div style={{ fontSize: "12px", paddingLeft: "5px" }}>
              <div style={{ display: "flex" }}>
                <span style={{ width: "80px" }}>WEIGHT:</span> 
                <span>{item.gross || "52"} g</span> [cite: 6]
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ width: "80px" }}>RATE:</span> 
                <span>₹{item.rate || "17,600"}/g</span> [cite: 7]
              </div>
              <div style={{ display: "flex" }}>
                <span style={{ width: "80px" }}>CHARGES:</span> 
                <span>{item.mcType === "%" ? "VA" : "MC"}: {item.mcValue || "10"}% | ST: ₹{item.stoneCharges || "0"}</span> [cite: 8, 9]
              </div>
            </div>

            {/* Subtotal Line */}
            <div style={{ textAlign: "right", fontWeight: "bold", fontSize: "14px", marginTop: "4px" }}>
              SUBTOTAL: ₹{Number(item.total || 946009).toLocaleString("en-IN", { minimumFractionDigits: 2 })} [cite: 10]
            </div>
          </div>
        ))}
      </div>

      <Divider thick />

      {/* SECTION 4: GRAND TOTAL (Centered) */}
      <div style={{ textAlign: "center", padding: "5px 0" }}>
        <div style={{ fontSize: "14px", textTransform: "uppercase", letterSpacing: "1px" }}>Grand Total</div>
        <div style={{ fontSize: "24px", fontWeight: "bold" }}>
          ₹{Math.round(grandTotal || 946010).toLocaleString("en-IN")} [cite: 11]
        </div>
        <div style={{ fontSize: "10px", fontStyle: "italic" }}>(Rounded Off)</div>
      </div>

      <Divider />

      {/* SECTION 5: FOOTER (Centered) */}
      <div style={{ textAlign: "center", fontSize: "11px", color: "#333" }}>
        <div style={{ fontWeight: "bold" }}>ID: {estimationId || "SS-00002-20260228"}</div>
        <div>{now.toLocaleDateString()} | {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        
        <div style={{ 
          marginTop: "15px", 
          fontSize: "10px", 
          lineHeight: "1.2",
          border: "1px dashed #ccc",
          padding: "5px"
        }}>
          * {item.validity || "Estimation valid for 24 hours only"} * [cite: 12]
        </div>
        
        <div style={{ marginTop: "15px", fontWeight: "bold", fontSize: "13px" }}>
          THANK YOU
        </div>
      </div>
      
    </div>
  );
}