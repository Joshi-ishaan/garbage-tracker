import { QRCodeCanvas } from "qrcode.react";

export default function QRCodeCard({ point }) {
  // 🔥 NEW: Encode lat/long in QR code
  const qrValue = JSON.stringify({
    id: point.id,
    name: point.name,
    latitude: point.latitude,
    longitude: point.longitude,
  });

  const downloadQR = () => {
    const canvas = document.getElementById(`qr-${point.id}-canvas`);
    if (canvas) {
      const qrCanvas = canvas.querySelector('canvas');
      if (qrCanvas) {
        const link = document.createElement('a');
        link.download = `pickup_${point.name.replace(/\s/g, '_')}.png`;
        link.href = qrCanvas.toDataURL();
        link.click();
      }
    }
  };

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
      <div id={`qr-${point.id}-canvas`}>
        <QRCodeCanvas value={qrValue} size={180} />
      </div>

      <h3 style={{ color: "black" }}>{point.name}</h3>

      {/* Show coordinates on card */}
      <div style={{ fontSize: "11px", color: "#555", marginTop: "5px" }}>
      Coordinates: {point.latitude?.toFixed(6)}, {point.longitude?.toFixed(6)}
      </div>


      <p style={{ fontSize: "12px", color: "black", marginTop: "10px" }}>
        Scan to mark garbage pickup
      </p>

      <p style={{ fontSize: "11px", color: "black", paddingTop: "10px" }}>
        Built by Ishaan Joshi
      </p>

      <p style={{ fontSize: "11px", color: "black" }}>
        linkedin.com/in/ishaan-joshi-121nazal/
      </p>
    </div>
  );
}