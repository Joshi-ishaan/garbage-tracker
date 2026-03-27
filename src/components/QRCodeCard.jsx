import { QRCodeCanvas } from "qrcode.react";

export default function QRCodeCard({ point }) {
  return (
    <div
      id={`qr-${point.id}`}
      style={{
        padding: "20px",
        background: "white",
        width: "260px",
        textAlign: "center",
        border: "1px solid #ccc",
        borderRadius: "12px",
      }}
    >
      <QRCodeCanvas
        value={point.id.toString()}
        size={180}
      />

      <h3 style={{ color: "black" }}>{point.name}</h3>

<p style={{fontSize:"15px", color:"black"}}>ID: {point.id}</p>

<p style={{ fontSize: "12px", color:"black" }}>
  Scan to mark garbage pickup
</p>
<br />

<p style={{ fontSize: "11px", color: "slategray" }}>
  Built by: Ishaan Joshi
  linkedin.com/in/ishaan-joshi-121nazal/
</p>
    </div>
  );
}