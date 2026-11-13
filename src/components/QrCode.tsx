"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Drawn as SVG so it stays sharp at any size and prints cleanly.
export function QrCode({ value, size = 220, label }: { value: string; size?: number; label: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let live = true;
    QRCode.toString(value, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#010d58", light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [value]);
  return <div className="qr" style={{ width: size, height: size }} role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: svg }} />;
}
