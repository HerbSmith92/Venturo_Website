import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { publicVisitPath } from "@/lib/site-visit-path";
import { createServiceClient } from "@/lib/supabase/admin";
import { platformFeatures } from "@/lib/platform-features";
import { johannesburgDay } from "@/lib/portal-home";
import {
  ANALYTICS_SESSION_COOKIE,
  ANALYTICS_SESSION_MINUTES,
  ANALYTICS_VISITOR_COOKIE,
  analyticsAttribution,
  analyticsCookie,
  analyticsSetCookie,
  classifyTraffic,
  coarseLocation,
  requestIpSignal,
} from "@/lib/website-analytics";

const ALLOWED_NAMES = new Set(["page_view", "active_time", "click", "rsvp", "purchase"]);
const BOT_UA = /bot|crawler|spider|crawling|preview|slurp|headless/i;

async function recordLegacy(
  admin: NonNullable<ReturnType<typeof createServiceClient>>,
  visitorKey: string,
  path: string,
  name: string,
  seconds: number,
) {
  const day = johannesburgDay();
  await admin.from("site_visit_presence").upsert({ visitor_key: visitorKey, last_seen: new Date().toISOString() });
  if (name === "page_view") {
    const unique = await admin.from("site_visit_uniques").insert({ day, visitor_key: visitorKey });
    const pageUnique = await admin.from("site_visit_page_uniques").insert({ day, path, visitor_key: visitorKey });
    const [{ data: dayRow }, { data: pageRow }] = await Promise.all([
      admin.from("site_visit_days").select("pageviews, visitors").eq("day", day).maybeSingle(),
      admin.from("site_visit_page_days").select("pageviews, visitors, dwell_seconds").eq("day", day).eq("path", path).maybeSingle(),
    ]);
    await Promise.all([
      admin.from("site_visit_days").upsert({
        day,
        pageviews: (dayRow?.pageviews ?? 0) + 1,
        visitors: (dayRow?.visitors ?? 0) + (!unique.error ? 1 : 0),
      }, { onConflict: "day" }),
      admin.from("site_visit_page_days").upsert({
        day,
        path,
        pageviews: (pageRow?.pageviews ?? 0) + 1,
        visitors: (pageRow?.visitors ?? 0) + (!pageUnique.error ? 1 : 0),
        dwell_seconds: pageRow?.dwell_seconds ?? 0,
      }, { onConflict: "day,path" }),
    ]);
  } else if (name === "active_time" && seconds > 0) {
    const { data } = await admin.from("site_visit_page_days").select("pageviews, visitors, dwell_seconds").eq("day", day).eq("path", path).maybeSingle();
    await admin.from("site_visit_page_days").upsert({
      day,
      path,
      pageviews: data?.pageviews ?? 0,
      visitors: data?.visitors ?? 0,
      dwell_seconds: (data?.dwell_seconds ?? 0) + seconds,
    }, { onConflict: "day,path" });
  }
}

export async function POST(request: Request) {
  const ua = request.headers.get("user-agent") ?? "";
  const staff = await getStaffSession();
  const admin = createServiceClient();
  if (!admin) return new NextResponse(null, { status: 204 });

  let name = "page_view";
  let path: string | null = null;
  let seconds = 0;
  let properties: Record<string, string | number | boolean | null> = {};
  let attributionInput: { referrer?: unknown; source?: unknown; medium?: unknown; campaign?: unknown } = {};
  try {
    const body = (await request.json()) as {
      kind?: string;
      name?: string;
      path?: string;
      seconds?: number;
      properties?: Record<string, unknown>;
      referrer?: unknown;
      source?: unknown;
      medium?: unknown;
      campaign?: unknown;
    };
    const requestedName = body.name ?? (body.kind === "pulse" ? "active_time" : "page_view");
    if (ALLOWED_NAMES.has(requestedName)) name = requestedName;
    path = publicVisitPath(body.path);
    if (typeof body.seconds === "number" && Number.isFinite(body.seconds)) {
      seconds = Math.min(3600, Math.max(0, Math.round(body.seconds)));
    }
    properties = Object.fromEntries(
      Object.entries(body.properties ?? {})
        .slice(0, 10)
        .map(([key, value]) => [
          key.slice(0, 50),
          typeof value === "string" ? value.slice(0, 200) : typeof value === "number" || typeof value === "boolean" ? value : null,
        ]),
    );
    attributionInput = body;
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!path) return new NextResponse(null, { status: 204 });

  const existingVisitor = analyticsCookie(request, ANALYTICS_VISITOR_COOKIE);
  const existingSession = analyticsCookie(request, ANALYTICS_SESSION_COOKIE);
  const visitorKey = existingVisitor ?? crypto.randomUUID();
  const now = new Date().toISOString();
  if (!platformFeatures.enhancedAnalytics) {
    if (!(staff && isStaff(staff.role)) && !BOT_UA.test(ua)) {
      await recordLegacy(admin, visitorKey, path, name, seconds);
    }
    const response = new NextResponse(null, { status: 204 });
    if (!existingVisitor) response.headers.append("Set-Cookie", analyticsSetCookie(ANALYTICS_VISITOR_COOKIE, visitorKey, true));
    return response;
  }
  const staleBefore = new Date(Date.now() - ANALYTICS_SESSION_MINUTES * 60_000).toISOString();
  const { data: activeSession } = existingSession
    ? await admin
        .from("analytics_sessions")
        .select("id, last_seen_at")
        .eq("id", existingSession)
        .gte("last_seen_at", staleBefore)
        .maybeSingle()
    : { data: null };
  const sessionId = activeSession?.id ?? crypto.randomUUID();
  const ipSignal = requestIpSignal(request.headers);
  const minuteAgo = new Date(Date.now() - 60_000).toISOString();
  const [recent, repetitive] = await Promise.all([
    admin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("visitor_key", visitorKey)
      .gte("occurred_at", minuteAgo),
    admin
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("visitor_key", visitorKey)
      .eq("path", path)
      .eq("name", "page_view")
      .gte("occurred_at", minuteAgo),
  ]);
  const verifiedBotToken = process.env.ANALYTICS_VERIFIED_BOT_TOKEN?.trim();
  const verifiedBot =
    Boolean(verifiedBotToken) &&
    request.headers.get("x-venturo-verified-bot") === verifiedBotToken;
  const classification = classifyTraffic({
    userAgent: ua,
    verifiedBot,
    requestsLastMinute: recent.count ?? 0,
    samePathLastMinute: repetitive.count ?? 0,
  });

  if (!activeSession) {
    const { error } = await admin.from("analytics_sessions").insert({
      id: sessionId,
      visitor_key: visitorKey,
      user_id: staff?.id ?? null,
      entry_path: path,
      ...analyticsAttribution(attributionInput),
      ...coarseLocation(request.headers),
      traffic_class: classification.trafficClass,
      classification_reasons: classification.reasons,
      ip_signal: ipSignal,
      is_staff: Boolean(staff && isStaff(staff.role)),
    });
    if (error) {
      console.error("[analytics session]", error.message);
      return new NextResponse(null, { status: 204 });
    }
  } else {
    await admin
      .from("analytics_sessions")
      .update({
        last_seen_at: now,
        traffic_class: classification.trafficClass,
        classification_reasons: classification.reasons,
      })
      .eq("id", sessionId);
  }

  const { error: eventError } = await admin.from("analytics_events").insert({
    session_id: sessionId,
    visitor_key: visitorKey,
    user_id: staff?.id ?? null,
    name,
    path,
    active_seconds: name === "active_time" ? seconds : 0,
    properties,
  });
  if (eventError) console.error("[analytics event]", eventError.message);

  const response = new NextResponse(null, { status: 204 });
  if (!existingVisitor) response.headers.append("Set-Cookie", analyticsSetCookie(ANALYTICS_VISITOR_COOKIE, visitorKey, true));
  if (!activeSession) response.headers.append("Set-Cookie", analyticsSetCookie(ANALYTICS_SESSION_COOKIE, sessionId));
  return response;
}
