import { NextResponse } from "next/server";
import { bearerToken, userFromBearer } from "@/lib/supabase/bearer";

const TOPICS = new Set(["event_reminder", "community_announcement", "guide", "general"]);
const CHANNELS = new Set(["email", "push"]);
const SCOPES = new Set(["global", "event", "community"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authenticated(request: Request) {
  const token = bearerToken(request);
  if (!token) return null;
  try {
    return await userFromBearer(token);
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const user = await authenticated(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await user.supabase
    .from("notification_preferences")
    .select("topic, channel, scope_type, scope_id, enabled, updated_at")
    .eq("user_id", user.id)
    .order("topic");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ contractVersion: "2026-11-17", preferences: data ?? [] });
}

export async function PUT(request: Request) {
  const user = await authenticated(request);
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    preferences?: Array<{
      topic?: string;
      channel?: string;
      scopeType?: string;
      scopeId?: string | null;
      enabled?: boolean;
    }>;
  } | null;
  const requested = body?.preferences;
  if (!Array.isArray(requested) || requested.length > 100) {
    return NextResponse.json({ error: "Send up to 100 preferences." }, { status: 400 });
  }
  const rows = requested.map((item) => {
    const topic = String(item.topic ?? "");
    const channel = String(item.channel ?? "");
    const scopeType = String(item.scopeType ?? "");
    const scopeId = item.scopeId ? String(item.scopeId) : null;
    if (
      !TOPICS.has(topic) ||
      !CHANNELS.has(channel) ||
      !SCOPES.has(scopeType) ||
      (scopeType === "global" ? scopeId !== null : !scopeId || !UUID.test(scopeId))
    ) {
      throw new Error("Invalid notification preference.");
    }
    return {
      user_id: user.id,
      topic,
      channel,
      scope_type: scopeType,
      scope_id: scopeId,
      enabled: Boolean(item.enabled),
      updated_at: new Date().toISOString(),
    };
  });
  try {
    for (const row of rows) {
      let removal = user.supabase
        .from("notification_preferences")
        .delete()
        .eq("user_id", user.id)
        .eq("topic", row.topic)
        .eq("channel", row.channel)
        .eq("scope_type", row.scope_type);
      removal = row.scope_id ? removal.eq("scope_id", row.scope_id) : removal.is("scope_id", null);
      const removed = await removal;
      if (removed.error) throw new Error(removed.error.message);
    }
    if (rows.length) {
      const { error } = await user.supabase.from("notification_preferences").insert(rows);
      if (error) throw new Error(error.message);
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save preferences." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, contractVersion: "2026-11-17" });
}
