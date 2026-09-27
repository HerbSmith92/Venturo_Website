import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { johannesburgDay } from "@/lib/portal-home";
import { isStaff } from "@/lib/roles";
import { createServiceClient } from "@/lib/supabase/admin";

const VISITOR_COOKIE = "venturo_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
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
  if (!ua || BOT_UA.test(ua)) {
    return new NextResponse(null, { status: 204 });
  }

  const staff = await getStaffSession();
  if (staff && isStaff(staff.role)) {
    return new NextResponse(null, { status: 204 });
  }

  const admin = createServiceClient();
  if (!admin) return new NextResponse(null, { status: 204 });

  let kind: "view" | "pulse" = "view";
  try {
    const body = (await request.json()) as { kind?: string };
    if (body.kind === "pulse") kind = "pulse";
  } catch {
    kind = "view";
  }

  const cookieHeaderValue = request.headers.get("cookie") ?? "";
  const existing = cookieHeaderValue
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
    ?.slice(VISITOR_COOKIE.length + 1);
  const visitorKey = visitorFromCookie(existing) ?? crypto.randomUUID();
  const now = new Date().toISOString();

  await admin.from("site_visit_presence").upsert({
    visitor_key: visitorKey,
    last_seen: now,
  });

  if (kind === "view") {
    const day = johannesburgDay();
    const { error: uniqueError } = await admin.from("site_visit_uniques").insert({
      day,
      visitor_key: visitorKey,
    });
    const isNewVisitor = !uniqueError;
    if (uniqueError && uniqueError.code !== "23505") {
      console.error("[site visit unique]", uniqueError.message);
    }

    const { data: existingDay } = await admin
      .from("site_visit_days")
      .select("pageviews, visitors")
      .eq("day", day)
      .maybeSingle();

    const { error: dayError } = await admin.from("site_visit_days").upsert(
      {
        day,
        pageviews: (existingDay?.pageviews ?? 0) + 1,
        visitors: (existingDay?.visitors ?? 0) + (isNewVisitor ? 1 : 0),
      },
      { onConflict: "day" },
    );
    if (dayError) console.error("[site visit day]", dayError.message);
  }

  const response = new NextResponse(null, { status: 204 });
  if (!visitorFromCookie(existing)) {
    response.headers.set("Set-Cookie", cookieHeader(visitorKey));
  }
  return response;
}
