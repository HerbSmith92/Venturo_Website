import { readFile } from "fs/promises";
import path from "path";
import { createElement } from "react";
import { ImageResponse } from "next/og";
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

const displayFont = '"Social Gothic Rough", "Arial Black", sans-serif';
const bodyFont = 'Nunito, "Trebuchet MS", sans-serif';

let socialGothicFont: Buffer | null = null;

async function loadSocialGothic() {
  if (!socialGothicFont) {
    socialGothicFont = await readFile(path.join(process.cwd(), "public/brand/fonts/SocialGothic-Rough.otf"));
  }
  return socialGothicFont;
}

/** Draw a heading in Social Gothic so it survives clients that drop web fonts. */
async function roughHeading(text: string, fontSize: number) {
  const font = await loadSocialGothic();
  const width = 520;
  const perLine = fontSize >= 32 ? 34 : 40;
  const lines = Math.max(1, Math.ceil([...text].length / perLine));
  const height = lines * Math.round(fontSize * 1.35) + 8;
  const image = new ImageResponse(
    createElement(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "flex-start",
          width: "100%",
          height: "100%",
          background: "#2A2D35",
          color: "#EBEBF3",
          fontFamily: "Social Gothic Rough",
          fontSize,
          lineHeight: 1.15,
          letterSpacing: "0.02em",
        },
      },
      text,
    ),
    {
      width,
      height,
      fonts: [{ name: "Social Gothic Rough", data: font, weight: 400, style: "normal" }],
    },
  );
  const png = Buffer.from(await image.arrayBuffer());
  return { content: png.toString("base64"), width, height };
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
  const siteUrl = getPublicSiteUrl();
  const ticketsUrl = `${siteUrl}/account/tickets`;
  const title = event.title?.trim() || "Your event";
  const logoPng = await readFile(path.join(process.cwd(), "public/brand/logos/venturo-horizontal-light.png"));
  const titleImage = await roughHeading(title, 34).catch((error: unknown) => {
    console.error("ticket title image", error instanceof Error ? error.message : "render failed");
    return null;
  });
  const ticketNames = await Promise.all(
    tickets.map(async (ticket) => {
      const image = await roughHeading(ticket.name, 22).catch(() => null);
      return { code: ticket.code, image };
    }),
  );
  const ticketNameByCode = new Map(ticketNames.map((row) => [row.code, row.image]));

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
      const nameImage = ticketNameByCode.get(ticket.code);
      const nameBlock = nameImage
        ? `<img src="cid:ticket-name-${cid}" alt="${escapeHtml(ticket.name)}" width="${nameImage.width}" height="${nameImage.height}" style="display:block;width:100%;max-width:${nameImage.width}px;height:auto;border:0;margin:0 0 8px;" />`
        : `<p style="margin:0 0 8px;font-family:${displayFont};font-weight:400;font-size:22px;line-height:1.1;letter-spacing:0.02em;color:#EBEBF3;">${escapeHtml(ticket.name)}</p>`;
      return `
        <tr>
          <td align="left" style="padding:20px 0 4px;">
            <p style="margin:0 0 4px;font-family:${bodyFont};font-weight:200;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#F3BF4A;">Ticket</p>
            ${nameBlock}
            <p style="margin:0 0 12px;font-family:${bodyFont};font-weight:200;font-size:16px;line-height:1.55;color:#EBEBF3;">Code <strong style="font-weight:400;">${escapeHtml(ticket.code)}</strong></p>
            <img src="cid:${cid}" alt="QR code for ${escapeHtml(ticket.code)}" width="180" height="180" style="display:block;border-radius:12px;background:#EBEBF3;" />
            <p style="margin:8px 0 0;font-family:${bodyFont};font-weight:200;font-size:14px;line-height:1.55;color:#EBEBF3;">Show this at the door.</p>
          </td>
        </tr>`;
    })
    .join("");

  const fontCss = `@font-face{font-family:"Social Gothic Rough";font-style:normal;font-weight:400;src:url("${siteUrl}/brand/fonts/SocialGothic-Rough.otf") format("opentype");}
@font-face{font-family:"Nunito";font-style:normal;font-weight:200;src:url("${siteUrl}/brand/fonts/Nunito-ExtraLight.ttf") format("truetype");}
@font-face{font-family:"Nunito";font-style:normal;font-weight:400;src:url("${siteUrl}/brand/fonts/Nunito-Regular.ttf") format("truetype");}`;

  const titleBlock = titleImage
    ? `<img src="cid:event-title" alt="${escapeHtml(title)}" width="${titleImage.width}" height="${titleImage.height}" style="display:block;width:100%;max-width:${titleImage.width}px;height:auto;border:0;margin:0 0 16px;" />`
    : `<h1 style="margin:0 0 16px;font-family:${displayFont};font-weight:400;font-size:32px;line-height:1.1;letter-spacing:0.02em;color:#EBEBF3;">${escapeHtml(title)}</h1>`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <style>${fontCss}</style>
  </head>
  <body style="margin:0;padding:0;background:#2A2D35;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#2A2D35;background-image:linear-gradient(#2A2D35,#2A2D35);padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td align="left" style="padding:0 0 22px;">
                <img src="cid:venturo-logo" width="180" alt="Venturo" style="display:block;width:180px;max-width:70%;height:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td align="left" style="font-family:${bodyFont};font-weight:200;color:#EBEBF3;">
                <p style="margin:0 0 10px;font-family:${bodyFont};font-weight:200;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#F3BF4A;">You're in</p>
                ${titleBlock}
                <p style="margin:0 0 4px;font-family:${bodyFont};font-weight:200;font-size:16px;line-height:1.55;color:#EBEBF3;">${escapeHtml(when)}</p>
                ${place ? `<p style="margin:0 0 4px;font-family:${bodyFont};font-weight:200;font-size:16px;line-height:1.55;color:#EBEBF3;">${escapeHtml(place)}</p>` : ""}
                ${address ? `<p style="margin:0 0 16px;font-family:${bodyFont};font-weight:200;font-size:14px;line-height:1.55;color:#EBEBF3;">${escapeHtml(address)}</p>` : ""}
                <p style="margin:0;font-family:${bodyFont};font-weight:200;font-size:16px;line-height:1.55;color:#EBEBF3;">Your ticket is below. Keep this email for the door.</p>
              </td>
            </tr>
            ${ticketBlocks}
            <tr>
              <td align="left" style="padding-top:8px;">
                <a href="${escapeHtml(ticketsUrl)}" style="display:inline-block;background:#F3BF4A;color:#2A2D35;text-decoration:none;font-family:${bodyFont};font-weight:400;font-size:16px;line-height:1;padding:14px 20px;border-radius:12px;">Open My Tickets</a>
              </td>
            </tr>
            <tr>
              <td align="left" style="padding-top:22px;">
                <p style="margin:0;font-family:${bodyFont};font-weight:200;font-size:13px;line-height:1.55;color:#EBEBF3;">Quality time is our love language.</p>
              </td>
            </tr>
          </table>
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
      attachments: [
        {
          filename: "venturo-logo.png",
          content: logoPng.toString("base64"),
          content_id: "venturo-logo",
        },
        ...(titleImage
          ? [{ filename: "event-title.png", content: titleImage.content, content_id: "event-title" }]
          : []),
        ...tickets.flatMap((ticket) => {
          const image = ticketNameByCode.get(ticket.code);
          if (!image) return [];
          const cid = `ticket-${ticket.code.toLowerCase()}`;
          return [{ filename: `ticket-name-${cid}.png`, content: image.content, content_id: `ticket-name-${cid}` }];
        }),
        ...attachments,
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body.slice(0, 300) || "Resend refused the ticket email.");
  }
}
