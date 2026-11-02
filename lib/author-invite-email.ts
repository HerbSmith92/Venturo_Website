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

export async function sendAuthorInviteEmail(email: string, joinUrl: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false as const, error: "Add RESEND_API_KEY to send invite emails." };
  }

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#2A2D35;color:#EBEBF3;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#2A2D35;padding:32px 16px;">
      <tr>
        <td align="left">
          <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <tr>
              <td style="font-family:Nunito,'Trebuchet MS',sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#EBEBF3;">Guides</td>
            </tr>
            <tr>
              <td style="padding-top:12px;font-family:'Arial Black',sans-serif;font-size:28px;line-height:1.15;color:#EBEBF3;">Write with Venturo</td>
            </tr>
            <tr>
              <td style="padding-top:16px;font-family:Nunito,'Trebuchet MS',sans-serif;font-weight:200;font-size:16px;line-height:1.55;color:#EBEBF3;">
                Pick a username, we email you a one-time code, then you fill in your own Author card &amp; start your Guides.
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;">
                <a href="${escapeHtml(joinUrl)}" style="display:inline-block;background:#F3BF4A;color:#2A2D35;text-decoration:none;font-family:Nunito,'Trebuchet MS',sans-serif;font-size:16px;padding:14px 20px;border-radius:12px;">Open your invite</a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:22px;font-family:Nunito,'Trebuchet MS',sans-serif;font-weight:200;font-size:13px;line-height:1.55;color:#EBEBF3;">
                This link lasts 14 days. Venturo still publishes.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Write with Venturo",
    "Pick a username, we email you a one-time code, then you fill in your own Author card & start your Guides.",
    joinUrl,
    "This link lasts 14 days. Venturo still publishes.",
  ].join("\n\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: ticketEmailFrom(),
      to: [email],
      subject: "Write with Venturo",
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    return { ok: false as const, error: body || "Could not send that invite email." };
  }
  return { ok: true as const };
}
