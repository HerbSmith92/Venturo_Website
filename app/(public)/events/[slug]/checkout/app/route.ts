/** Paystack lands here, then the phone hands the order back to the app. */
export async function GET(request: Request) {
  const order = new URL(request.url).searchParams.get("order") ?? "";
  const target = `venturo://tickets?order=${encodeURIComponent(order)}`;
  const html = `<!doctype html>
<html lang="en-ZA">
<head>
  <meta charset="utf-8">
  <title>Back to Venturo</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;background:#2A2D35;color:#EBEBF3;font-family:sans-serif;padding:32px">
  <p>Returning to Venturo…</p>
  <p><a href="${target}" style="color:#F3BF4A">Open Venturo</a></p>
  <script>location.replace(${JSON.stringify(target)})</script>
</body>
</html>`;
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
