import QRCode from "qrcode";
import { eventAddressText, formatEventWindow } from "@/lib/event-types";
import { ticketQrPayload } from "@/lib/ticket-code";
import { getPublicSiteUrl } from "@/lib/site-url";
import { createServiceClient } from "@/lib/supabase/admin";

type Named = { name?: string | null };
type TicketPass = { code: string; name: string };

function one<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ticketEmailFrom() {
  const from = process.env.TICKET_EMAIL_FROM?.trim();
  return from || "Venturo <noreply@venturo.co.za>";
}

/** Send the buyer's ticket email once. A missing mailer does not undo the sale. */
export async function sendTicketEmail(orderId: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("ticket email skipped: add RESEND_API_KEY");
    return;
  }

  const service = createServiceClient();
  if (!service) return;

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await service
    .from("event_orders")
    .update({ ticket_email_sent_at: claimedAt })
    .eq("id", orderId)
    .eq("status", "paid")
    .is("ticket_email_sent_at", null)
    .select("id, buyer_id, event_id");

  if (claimError) {
    console.error("ticket email claim", claimError.message);
    return;
  }
  const order = claimed?.[0];
  if (!order) return;

  try {
    await deliverTicketEmail(service, order.buyer_id, order.event_id, orderId, apiKey);
  } catch (error) {
    await service
      .from("event_orders")
      .update({ ticket_email_sent_at: null })
      .eq("id", orderId)
      .eq("ticket_email_sent_at", claimedAt);
    console.error("ticket email", error instanceof Error ? error.message : "send failed");
  }
}

async function deliverTicketEmail(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  buyerId: string,
  eventId: string,
  orderId: string,
  apiKey: string,
) {
  const [{ data: userData, error: userError }, { data: event, error: eventError }, { data: passes, error: passError }] =
    await Promise.all([
      service.auth.admin.getUserById(buyerId),
      service
        .from("events")
        .select(
          "title, slug, starts_at, ends_at, timezone, venue_name, address_line1, address_line2, city, postal_code, country",
        )
        .eq("id", eventId)
        .maybeSingle(),
      service
        .from("event_tickets")
        .select("code, event_ticket_types ( name )")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true }),
    ]);

  if (userError) throw new Error(userError.message);
  if (eventError) throw new Error(eventError.message);
  if (passError) throw new Error(passError.message);

  const email = userData.user?.email?.trim();
  if (!email) throw new Error("Buyer has no email.");
  if (!event) throw new Error("Event not found.");

  const tickets: TicketPass[] = (passes ?? []).map((row) => {
    const type = one(row.event_ticket_types as Named | Named[] | null);
    return { code: row.code, name: type?.name?.trim() || "Ticket" };
  });
  if (!tickets.length) throw new Error("No tickets on this order.");

  const timezone = event.timezone || "Africa/Johannesburg";
  const when = formatEventWindow(event.starts_at ?? "", event.ends_at ?? "", timezone);
  const place = [event.venue_name, event.city].filter(Boolean).join(" · ");
  const address = eventAddressText({
    venueName: event.venue_name,
    addressLine1: event.address_line1,
    addressLine2: event.address_line2,
    city: event.city,
    postalCode: event.postal_code,
    country: event.country,
  });
  const ticketsUrl = `${getPublicSiteUrl()}/account/tickets`;
  const title = event.title?.trim() || "Your event";

  const attachments = await Promise.all(
    tickets.map(async (ticket) => {
      const png = await QRCode.toBuffer(ticketQrPayload(ticket.code), {
        type: "png",
        errorCorrectionLevel: "M",
        margin: 1,
        width: 280,
        color: { dark: "#2A2D35", light: "#EBEBF3" },
      });
      return {
        filename: `ticket-${ticket.code}.png`,
        content: png.toString("base64"),
        content_id: `ticket-${ticket.code.toLowerCase()}`,
      };
    }),
  );

  const ticketBlocks = tickets
    .map((ticket) => {
      const cid = `ticket-${ticket.code.toLowerCase()}`;
      return `
        <tr>
          <td style="padding:16px 0;border-top:1px solid #d8d8e4;">
            <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7340;">Ticket</p>
            <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#2A2D35;">${escapeHtml(ticket.name)}</p>
            <p style="margin:0 0 12px;font-size:16px;color:#2A2D35;">Code <strong>${escapeHtml(ticket.code)}</strong></p>
            <img src="cid:${cid}" alt="QR code for ${escapeHtml(ticket.code)}" width="180" height="180" style="display:block;border-radius:12px;" />
            <p style="margin:8px 0 0;font-size:14px;color:#5c5f69;">Show this at the door.</p>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#2A2D35;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A2D35;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#EBEBF3;border-radius:16px;padding:28px 24px;">
            <tr>
              <td>
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#8a7340;">You're in</p>
                <h1 style="margin:0 0 16px;font-size:28px;line-height:1.1;color:#2A2D35;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 4px;font-size:16px;color:#2A2D35;">${escapeHtml(when)}</p>
                ${place ? `<p style="margin:0 0 4px;font-size:16px;color:#2A2D35;">${escapeHtml(place)}</p>` : ""}
                ${address ? `<p style="margin:0 0 16px;font-size:14px;color:#5c5f69;">${escapeHtml(address)}</p>` : ""}
                <p style="margin:0 0 8px;font-size:16px;color:#2A2D35;">Your ticket is below. Keep this email for the door.</p>
              </td>
            </tr>
            ${ticketBlocks}
            <tr>
              <td style="padding-top:8px;">
                <a href="${escapeHtml(ticketsUrl)}" style="display:inline-block;background:#F3BF4A;color:#2A2D35;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;">Open My Tickets</a>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:13px;color:#EBEBF3;">Quality time is our love language.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "You're in.",
    title,
    when,
    place,
    address,
    "",
    ...tickets.flatMap((ticket) => [`${ticket.name}`, `Code ${ticket.code}`, "Show this at the door.", ""]),
    `Open My Tickets: ${ticketsUrl}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ticketEmailFrom(),
      to: [email],
      subject: `Your ticket · ${title}`,
      html,
      text,
      attachments,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body.slice(0, 300) || "Resend refused the ticket email.");
  }
}
