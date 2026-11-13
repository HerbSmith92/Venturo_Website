import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { johannesburgDay } from "@/lib/portal-home";
import { isStaff } from "@/lib/roles";
import { publicVisitPath } from "@/lib/site-visit-path";
import { createServiceClient } from "@/lib/supabase/admin";

const VISITOR_COOKIE = "venturo_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT_UA =
  /bot|crawler|spider|crawling|preview|slurp|facebookexternalhit|whatsapp|telegram|discord|embedly/i;
const PULSE_SECONDS = 45;

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
  let path: string | null = null;
  let seconds = PULSE_SECONDS;
  try {
    const body = (await request.json()) as { kind?: string; path?: string; seconds?: number };
    if (body.kind === "pulse") kind = "pulse";
    path = publicVisitPath(body.path);
    if (typeof body.seconds === "number" && Number.isFinite(body.seconds)) {
      seconds = Math.min(60, Math.max(0, Math.round(body.seconds)));
    }
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
  const day = johannesburgDay();

  await admin.from("site_visit_presence").upsert({
    visitor_key: visitorKey,
    last_seen: now,
  });

  if (kind === "view") {
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

    if (path) {
      const { error: pageUniqueError } = await admin.from("site_visit_page_uniques").insert({
        day,
        path,
        visitor_key: visitorKey,
      });
      const isNewOnPage = !pageUniqueError;
      if (pageUniqueError && pageUniqueError.code !== "23505") {
        console.error("[site visit page unique]", pageUniqueError.message);
      }
      const { data: existingPage } = await admin
        .from("site_visit_page_days")
        .select("pageviews, visitors, dwell_seconds")
        .eq("day", day)
        .eq("path", path)
        .maybeSingle();
      const { error: pageError } = await admin.from("site_visit_page_days").upsert(
        {
          day,
          path,
          pageviews: (existingPage?.pageviews ?? 0) + 1,
          visitors: (existingPage?.visitors ?? 0) + (isNewOnPage ? 1 : 0),
          dwell_seconds: existingPage?.dwell_seconds ?? 0,
        },
        { onConflict: "day,path" },
      );
      if (pageError) console.error("[site visit page]", pageError.message);
    }
  } else if (path && seconds > 0) {
    const { data: existingPage } = await admin
      .from("site_visit_page_days")
      .select("pageviews, visitors, dwell_seconds")
      .eq("day", day)
      .eq("path", path)
      .maybeSingle();
    const { error: dwellError } = await admin.from("site_visit_page_days").upsert(
      {
        day,
        path,
        pageviews: existingPage?.pageviews ?? 0,
        visitors: existingPage?.visitors ?? 0,
        dwell_seconds: (existingPage?.dwell_seconds ?? 0) + seconds,
      },
      { onConflict: "day,path" },
    );
    if (dwellError) console.error("[site visit dwell]", dwellError.message);
  }

  const response = new NextResponse(null, { status: 204 });
  if (!visitorFromCookie(existing)) {
    response.headers.set("Set-Cookie", cookieHeader(visitorKey));
  }
  return response;
}
