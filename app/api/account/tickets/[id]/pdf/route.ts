import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/auth";
import { formatEventWindow } from "@/lib/event-types";
import { ticketQrPayload } from "@/lib/ticket-code";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function lines(value: string, size: number) {
  const width = size > 16 ? 28 : 42;
  const words = value.split(/\s+/);
  const rows: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      rows.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) rows.push(current);
  return rows.slice(0, 4);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in to download a ticket.", { status: 401 });

  const { id } = await params;
  const supabase = await createClient();
  if (!supabase) return new Response("Tickets are unavailable.", { status: 503 });

  const { data, error } = await supabase
    .from("event_tickets")
    .select(
      `
      id, code, occurrence_starts_at, occurrence_ends_at,
      events (
        title, starts_at, ends_at, timezone, venue_name, address_line1, city
      ),
      event_ticket_types ( name )
    `,
    )
    .eq("id", id)
    .eq("buyer_id", user.id)
    .maybeSingle();

  if (error || !data) return new Response("Ticket not found.", { status: 404 });

  const event = one(
    data.events as unknown as
      | {
          title: string | null;
          starts_at: string | null;
          ends_at: string | null;
          timezone: string | null;
          venue_name: string | null;
          address_line1: string | null;
          city: string | null;
        }
      | {
          title: string | null;
          starts_at: string | null;
          ends_at: string | null;
          timezone: string | null;
          venue_name: string | null;
          address_line1: string | null;
          city: string | null;
        }[]
      | null,
  );
  const type = one(data.event_ticket_types as { name: string | null } | { name: string | null }[] | null);
  const timezone = event?.timezone || "Africa/Johannesburg";
  const starts = data.occurrence_starts_at || event?.starts_at || "";
  const ends = data.occurrence_ends_at || event?.ends_at || "";
  const when = starts ? formatEventWindow(starts, ends, timezone) : "Date to follow";
  const place = [event?.venue_name, event?.address_line1, event?.city].filter(Boolean).join(", ") || "Venue to follow";
  const title = event?.title?.trim() || "Venturo ticket";
  const typeName = type?.name?.trim() || "Ticket";
  const png = await QRCode.toBuffer(ticketQrPayload(data.code), {
    type: "png",
    errorCorrectionLevel: "H",
    margin: 1,
    width: 280,
  });

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qr = await pdf.embedPng(png);
  const ink = rgb(0.165, 0.176, 0.208);
  page.drawRectangle({ x: 0, y: 0, width: 420, height: 595, color: rgb(0.922, 0.922, 0.953) });
  page.drawText("VENTURO", { x: 36, y: 548, size: 14, font: bold, color: ink });

  let y = 510;
  for (const row of lines(title, 22)) {
    page.drawText(row, { x: 36, y, size: 22, font: bold, color: ink });
    y -= 28;
  }
  y -= 8;
  for (const row of [when, place, typeName]) {
    for (const line of lines(row, 12)) {
      page.drawText(line, { x: 36, y, size: 12, font, color: ink });
      y -= 16;
    }
    y -= 6;
  }
  page.drawText(data.code, { x: 36, y: 250, size: 16, font: bold, color: ink });
  page.drawImage(qr, { x: 136, y: 48, width: 148, height: 148 });

  const bytes = await pdf.save();
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="venturo-ticket-${data.code}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
