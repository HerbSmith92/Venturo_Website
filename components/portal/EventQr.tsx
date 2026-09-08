"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function EventQr({ url, label }: { url: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: { dark: "#2A2D35", light: "#EBEBF3" },
    })
      .then((data) => {
        if (!cancelled) setSrc(data);
      })
      .catch(() => {
        if (!cancelled) setError("Could not draw the QR.");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (error) return <p className="error">{error}</p>;
  if (!src) return <p className="muted">Drawing the QR…</p>;

  return (
    <figure className="ticket-qr">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`QR code for ${label}`} width={220} height={220} />
      <figcaption>Scan to open the event page</figcaption>
    </figure>
  );
}
