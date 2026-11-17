import { NextResponse } from "next/server";
import { johannesburgDay } from "@/lib/portal-home";
import { isStaff } from "@/lib/roles";
import { appItemId, appItemKind, screenKey } from "@/lib/site-visit-path";
import { bearerToken, identityFromBearer } from "@/lib/supabase/bearer";
import { createServiceClient } from "@/lib/supabase/admin";
import { platformFeatures } from "@/lib/platform-features";

const ACTIONS = new Set(["screen_view", "click", "rsvp", "purchase", "calendar_add", "notification_open"]);

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return NextResponse.json({ error: "Log in to count this screen." }, { status: 401 });

  const identity = await identityFromBearer(token);
  if (!identity) return NextResponse.json({ error: "Log in to count this screen." }, { status: 401 });
  if (isStaff(identity.role)) return new NextResponse(null, { status: 204 });

  const body = (await request.json().catch(() => null)) as {
    screen?: string;
    itemKind?: string;
    itemId?: string;
    action?: string;
    idempotencyKey?: string;
    properties?: Record<string, unknown>;
  } | null;
  const screen = screenKey(body?.screen);
  if (!screen) return NextResponse.json({ error: "Send a screen id." }, { status: 400 });
  const itemKind = appItemKind(body?.itemKind);
  const itemId = appItemId(body?.itemId);
  const action = ACTIONS.has(String(body?.action ?? "")) ? String(body?.action) : "screen_view";
  const idempotencyKey =
    typeof body?.idempotencyKey === "string" && /^[A-Za-z0-9:_-]{8,200}$/.test(body.idempotencyKey)
      ? body.idempotencyKey
      : null;

  const admin = createServiceClient();
  if (!admin) return new NextResponse(null, { status: 204 });

  const day = johannesburgDay();
  const properties = Object.fromEntries(
    Object.entries(body?.properties ?? {})
      .slice(0, 10)
      .map(([key, value]) => [
        key.slice(0, 50),
        typeof value === "string" ? value.slice(0, 200) : typeof value === "number" || typeof value === "boolean" ? value : null,
      ]),
  );
  if (platformFeatures.enhancedAnalytics) {
    const { error: engagementError } = await admin.from("app_engagement_events").insert({
      user_id: identity.id,
      name: action,
      screen,
      item_kind: itemKind,
      item_id: itemId,
      idempotency_key: idempotencyKey,
      properties,
    });
    if (engagementError && engagementError.code !== "23505") {
      console.error("[app engagement]", engagementError.message);
    }
  }
  if (action !== "screen_view") return new NextResponse(null, { status: 204 });
  const { error: uniqueError } = await admin.from("app_screen_uniques").insert({
    day,
    screen,
    user_id: identity.id,
  });
  const isNew = !uniqueError;
  if (uniqueError && uniqueError.code !== "23505") {
    console.error("[app screen unique]", uniqueError.message);
  }

  const { data: existing } = await admin
    .from("app_screen_days")
    .select("opens, visitors")
    .eq("day", day)
    .eq("screen", screen)
    .maybeSingle();

  const { error: dayError } = await admin.from("app_screen_days").upsert(
    {
      day,
      screen,
      opens: (existing?.opens ?? 0) + 1,
      visitors: (existing?.visitors ?? 0) + (isNew ? 1 : 0),
    },
    { onConflict: "day,screen" },
  );
  if (dayError) console.error("[app screen day]", dayError.message);

  if (itemKind && itemId) {
    const { error: itemUniqueError } = await admin.from("app_item_uniques").insert({
      day,
      kind: itemKind,
      item_id: itemId,
      user_id: identity.id,
    });
    const isNewItem = !itemUniqueError;
    if (itemUniqueError && itemUniqueError.code !== "23505") {
      console.error("[app item unique]", itemUniqueError.message);
    }
    const { data: existingItem } = await admin
      .from("app_item_days")
      .select("opens, visitors")
      .eq("day", day)
      .eq("kind", itemKind)
      .eq("item_id", itemId)
      .maybeSingle();
    const { error: itemError } = await admin.from("app_item_days").upsert(
      {
        day,
        kind: itemKind,
        item_id: itemId,
        opens: (existingItem?.opens ?? 0) + 1,
        visitors: (existingItem?.visitors ?? 0) + (isNewItem ? 1 : 0),
      },
      { onConflict: "day,kind,item_id" },
    );
    if (itemError) console.error("[app item day]", itemError.message);
  }

  return new NextResponse(null, { status: 204 });
}
