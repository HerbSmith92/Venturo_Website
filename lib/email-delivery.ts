import "server-only";

type EmailMessage = {
  to: string;
  subject: string;
  heading: string;
  body: string;
  href: string;
  cta: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendVenturoEmail(message: EmailMessage) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  const from = process.env.TICKET_EMAIL_FROM?.trim() || "Venturo <noreply@venturo.co.za>";
  const html = `<!doctype html>
<html><body style="margin:0;background:#2A2D35;color:#EBEBF3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td><table role="presentation" width="560" style="max-width:560px">
<tr><td style="font-family:Nunito,Trebuchet MS,sans-serif;font-size:13px;letter-spacing:.12em;text-transform:uppercase">VENTURO</td></tr>
<tr><td style="padding-top:12px;font-family:Arial Black,sans-serif;font-size:30px;line-height:1.15">${escapeHtml(message.heading)}</td></tr>
<tr><td style="padding-top:16px;font-family:Nunito,Trebuchet MS,sans-serif;font-size:16px;line-height:1.55">${escapeHtml(message.body)}</td></tr>
<tr><td style="padding-top:24px"><a href="${escapeHtml(message.href)}" style="display:inline-block;background:#EBEBF3;color:#2A2D35;text-decoration:none;padding:14px 20px;border-radius:12px;font-family:Nunito,Trebuchet MS,sans-serif">${escapeHtml(message.cta)}</a></td></tr>
</table></td></tr></table></body></html>`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      html,
      text: `${message.heading}\n\n${message.body}\n\n${message.href}`,
    }),
  });
  const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!response.ok || !payload?.id) {
    throw new Error(payload?.message || `Resend returned ${response.status}.`);
  }
  return { provider: "resend", id: payload.id };
}
