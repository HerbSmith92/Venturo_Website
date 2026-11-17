import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";

function verifySvix(raw: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  const unix = Number(timestamp);
  if (!Number.isFinite(unix) || Math.abs(Date.now() / 1000 - unix) > 5 * 60) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${raw}`).digest();
  return signatures.split(" ").some((part) => {
    const [, encoded] = part.split(",");
    if (!encoded) return false;
    const received = Buffer.from(encoded, "base64");
    return received.length === expected.length && timingSafeEqual(received, expected);
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifySvix(raw, request.headers)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }
  const payload = JSON.parse(raw) as {
    type?: string;
    created_at?: string;
    data?: { email_id?: string };
  };
  const messageId = payload.data?.email_id;
  const statusMap: Record<string, string> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.delivery_delayed": "failed",
    "email.opened": "opened",
    "email.clicked": "clicked",
  };
  const status = payload.type ? statusMap[payload.type] : null;
  if (!messageId || !status) return NextResponse.json({ ok: true, ignored: true });

  const service = createServiceClient();
  if (!service) return NextResponse.json({ error: "Service role unavailable." }, { status: 503 });
  const { data: accepted } = await service
    .from("notification_deliveries")
    .select("job_id")
    .eq("provider", "resend")
    .eq("provider_message_id", messageId)
    .eq("status", "accepted")
    .maybeSingle();
  if (accepted) {
    await service.from("notification_deliveries").upsert(
      {
        job_id: accepted.job_id,
        provider: "resend",
        provider_message_id: messageId,
        status,
        occurred_at: payload.created_at || new Date().toISOString(),
      },
      { onConflict: "provider,provider_message_id,status", ignoreDuplicates: true },
    );
  }
  return NextResponse.json({ ok: true });
}
