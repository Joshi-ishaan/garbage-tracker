import { useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function QRScanner({ onScanSuccess }) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
  "reader",
  { fps: 20, qrbox: 250 }, // increase fps
  false
);

    scanner.render(
      (decodedText) => {
        onScanSuccess(decodedText);
        scanner.clear();
      },
      (error) => {
        // ignore errors
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return <div id="reader"></div>;
}