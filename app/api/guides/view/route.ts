import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { johannesburgDay } from "@/lib/portal-home";
import { isStaff } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

const VISITOR_COOKIE = "venturo_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[4-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_UA =
  /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|whatsapp|telegram|discord|embedly/i;

function visitorFromCookie(value: string | undefined) {
  if (!value || !UUID.test(value)) return null;
  return value;
}

function cookieHeader(visitorKey: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${VISITOR_COOKIE}=${visitorKey}; Path=/; Max-Age=${VISITOR_MAX_AGE}; SameSite=Lax; HttpOnly${secure}`;
}

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  if (!ua || BOT_UA.test(ua)) return new NextResponse(null, { status: 204 });

  const staff = await getStaffSession();
  if (staff && isStaff(staff.role)) return new NextResponse(null, { status: 204 });

  let kind = "";
  let id = "";
  try {
    const body = (await request.json()) as { kind?: string; id?: string };
    kind = body.kind === "events" ? "events" : body.kind === "activities" ? "activities" : "";
    id = typeof body.id === "string" ? body.id : "";
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (!kind || !UUID.test(id)) return new NextResponse(null, { status: 204 });

  const admin = createServiceClient();
  if (!admin) return new NextResponse(null, { status: 204 });

  const table = kind === "events" ? "curated_event_guides" : "curated_guides";
  const { data: live } = await admin
    .from(table)
    .select("id, status, publish_at, expire_at")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!live) return new NextResponse(null, { status: 204 });
  const now = Date.now();
  if (live.publish_at && new Date(live.publish_at).getTime() > now) return new NextResponse(null, { status: 204 });
  if (live.expire_at && new Date(live.expire_at).getTime() <= now) return new NextResponse(null, { status: 204 });

  const cookieHeaderValue = request.headers.get("cookie") ?? "";
  const existing = cookieHeaderValue
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  const visitorKey = visitorFromCookie(existing) ?? crypto.randomUUID();

  const { error } = await admin.rpc("record_guide_view", {
    p_kind: kind,
    p_guide_id: id,
    p_visitor_key: visitorKey,
    p_viewed_on: johannesburgDay(),
  });
  if (error) console.error("[guide view]", error.message);

  const response = new NextResponse(null, { status: 204 });
  if (!visitorFromCookie(existing)) {
    response.headers.set("Set-Cookie", cookieHeader(visitorKey));
  }
  return response;
}
