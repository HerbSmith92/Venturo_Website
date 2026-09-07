import QRCode from "qrcode";
import { ticketQrPayload } from "@/lib/host-scanning";

export async function TicketQr({ code }: { code: string }) {
  const payload = ticketQrPayload(code);
  const dataUrl = await QRCode.toDataURL(payload, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
    color: {
      dark: "#2A2D35",
      light: "#EBEBF3",
    },
  });

  return (
    <figure className="ticket-qr">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={`QR code for ticket ${code}`} width={220} height={220} />
      <figcaption>
        Show this at the door · <strong>{code}</strong>
      </figcaption>
    </figure>
  );
}
