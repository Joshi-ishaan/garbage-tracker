import { QRCodeCanvas } from "qrcode.react";

export default function QRCodeCard({ point }) {
  return (
    <div
      id={`qr-${point.id}`}
      style={{
        background: "#ffffff",
        padding: "20px",
        borderRadius: "12px",
        textAlign: "center",
        width: "260px",
      }}
    >
      <QRCodeCanvas value={point.id} size={180} />

      <h3 style={{ color: "black" }}>{point.name}</h3>

      <p style={{ fontSize: "12px", color: "black" }}>
        ID: {point.id}
      </p>

      <p style={{ fontSize: "12px", color: "black" }}>
        Scan to mark garbage pickup
      </p>

      <p style={{ fontSize: "11px", color: "gray" }}>
        Built by Ishaan Joshi
      </p>

      <p style={{ fontSize: "11px", color: "gray" }}>
        Built by: Ishaan Joshi
  linkedin.com/in/ishaan-joshi-121nazal/
      </p>
    </div>
  );
}

 