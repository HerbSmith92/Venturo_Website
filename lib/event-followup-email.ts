import { getPublicSiteUrl } from "@/lib/site-url";

function ticketEmailFrom() {
  const from = process.env.TICKET_EMAIL_FROM?.trim();
  return from || "Venturo <noreply@venturo.co.za>";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendMail(input: { to: string; subject: string; heading: string; body: string; href: string; cta: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    console.error("event follow-up email skipped: add RESEND_API_KEY");
    return false;
  }

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#2A2D35;color:#EBEBF3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A2D35;padding:32px 16px;">
      <tr>
        <td align="left">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="font-family:Nunito,'Trebuchet MS',sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#EBEBF3;">After the event</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-family:'Arial Black',sans-serif;font-size:28px;line-height:1.15;color:#EBEBF3;">${escapeHtml(input.heading)}</td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-family:Nunito,'Trebuchet MS',sans-serif;font-weight:200;font-size:16px;line-height:1.55;color:#EBEBF3;">${escapeHtml(input.body)}</td>
            </tr>
            <tr>
              <td style="padding-top:24px;">
                <a href="${escapeHtml(input.href)}" style="display:inline-block;background:#F3BF4A;color:#2A2D35;text-decoration:none;font-family:Nunito,'Trebuchet MS',sans-serif;font-size:16px;padding:14px 20px;border-radius:12px;">${escapeHtml(input.cta)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ticketEmailFrom(),
      to: [input.to],
      subject: input.subject,
      html,
      text: `${input.heading}\n\n${input.body}\n\n${input.href}`,
    }),
  });
  if (!response.ok) {
    console.error("event follow-up email", await response.text());
    return false;
  }
  return true;
}

export async function sendHostFollowUpEmail(email: string, eventTitle: string, eventId: string) {
  const href = `${getPublicSiteUrl()}/portal/events/${eventId}/follow-up`;
  return sendMail({
    to: email,
    subject: `How did ${eventTitle} go?`,
    heading: "How did it go?",
    body: `${eventTitle} has ended. Tell us if it happened & how it went. That helps us confirm the night before we pay you out.`,
    href,
    cta: "Tell us how it went",
  });
}

export async function sendGuestReviewEmail(email: string, eventTitle: string, eventId: string) {
  const href = `${getPublicSiteUrl()}/account/reviews/event/${eventId}`;
  return sendMail({
    to: email,
    subject: `Review ${eventTitle}`,
    heading: "How was it?",
    body: `You had a ticket for ${eventTitle}. Leave a short review so other locals know what the night was like.`,
    href,
    cta: "Write a review",
  });
}
