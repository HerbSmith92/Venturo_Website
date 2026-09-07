import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { resolveAuthUserId, setRevenueCatAccess } from "@/lib/member-access";

const ACTIVATE_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "PRODUCT_CHANGE",
]);

type RevenueCatEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
  expiration_at_ms?: number | null;
  environment?: string;
};

function headerMatchesSecret(header: string, secret: string) {
  const candidates = [secret, `Bearer ${secret}`];
  const incoming = header.trim();
  return candidates.some((expected) => {
    const a = Buffer.from(incoming);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  });
}

function webhookAuthorized(request: Request) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return headerMatchesSecret(header, secret);
}

function allowSandbox() {
  return process.env.REVENUECAT_WEBHOOK_ALLOW_SANDBOX === "true";
}

function periodEndFromEvent(event: RevenueCatEvent) {
  if (event.expiration_at_ms == null) return null;
  const ms = Number(event.expiration_at_ms);
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return new Date(ms).toISOString();
}

function stillEntitled(event: RevenueCatEvent) {
  if (event.expiration_at_ms == null) return true;
  const ms = Number(event.expiration_at_ms);
  if (!Number.isFinite(ms)) return true;
  return ms > Date.now();
}

function candidateIds(event: RevenueCatEvent) {
  return [
    event.app_user_id ?? "",
    event.original_app_user_id ?? "",
    ...(event.aliases ?? []),
  ];
}

export async function POST(request: Request) {
  if (!process.env.REVENUECAT_WEBHOOK_AUTH?.trim()) {
    return NextResponse.json({ error: "Webhook auth is not configured." }, { status: 503 });
  }
  if (!webhookAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let payload: { event?: RevenueCatEvent };
  try {
    payload = (await request.json()) as { event?: RevenueCatEvent };
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const event = payload.event;
  if (!event?.type) {
    return NextResponse.json({ error: "Missing event." }, { status: 400 });
  }

  if (event.environment === "SANDBOX" && !allowSandbox()) {
    return NextResponse.json({ ok: true, ignored: "sandbox" });
  }

  if (event.type === "CANCELLATION") {
    return NextResponse.json({ ok: true, ignored: "cancellation" });
  }

  if (event.type === "TRANSFER") {
    const fromIds = event.transferred_from ?? [];
    const toIds = event.transferred_to ?? [];
    for (const raw of fromIds) {
      const userId = await resolveAuthUserId([raw]);
      if (userId && !(await setRevenueCatAccess(userId, false))) {
        return NextResponse.json({ error: "Could not update member access." }, { status: 500 });
      }
    }
    for (const raw of toIds) {
      const userId = await resolveAuthUserId([raw]);
      if (userId && !(await setRevenueCatAccess(userId, true, periodEndFromEvent(event)))) {
        return NextResponse.json({ error: "Could not update member access." }, { status: 500 });
      }
    }
    return NextResponse.json({ ok: true, type: "TRANSFER" });
  }

  const userId = await resolveAuthUserId(candidateIds(event));
  if (!userId) {
    return NextResponse.json({ ok: true, ignored: "unknown_user" });
  }

  if (event.type === "EXPIRATION") {
    if (!(await setRevenueCatAccess(userId, false))) {
      return NextResponse.json({ error: "Could not update member access." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, type: event.type, userId });
  }

  if (ACTIVATE_TYPES.has(event.type)) {
    if (event.type === "PRODUCT_CHANGE" && !stillEntitled(event)) {
      return NextResponse.json({ ok: true, ignored: "not_entitled" });
    }
    if (!(await setRevenueCatAccess(userId, true, periodEndFromEvent(event)))) {
      return NextResponse.json({ error: "Could not update member access." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, type: event.type, userId });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
