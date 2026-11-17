import { createHmac } from "node:crypto";

export const ANALYTICS_VISITOR_COOKIE = "venturo_vid";
export const ANALYTICS_SESSION_COOKIE = "venturo_sid";
export const ANALYTICS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
export const ANALYTICS_SESSION_MINUTES = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KNOWN_BOT = /googlebot|bingbot|applebot|duckduckbot|yandexbot|baiduspider/i;
const BOT_SIGNAL = /bot|crawler|spider|crawling|preview|slurp|headless|facebookexternalhit|whatsapp|telegram|discord|embedly|curl|wget|python-requests|postmanruntime/i;
const BROWSER_SIGNAL = /mozilla\/5\.0|applewebkit|chrome|safari|firefox|edg\//i;

export type TrafficClass = "likely_human" | "verified_bot" | "suspected_bot" | "unknown";

export function analyticsCookie(request: Request, name: string) {
  const raw = request.headers.get("cookie") ?? "";
  const value = raw
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return value && UUID.test(value) ? value : null;
}

export function analyticsSetCookie(name: string, value: string, persistent = false) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = persistent ? `; Max-Age=${ANALYTICS_COOKIE_MAX_AGE}` : "";
  return `${name}=${value}; Path=/${maxAge}; SameSite=Lax; HttpOnly${secure}`;
}

function safeHeader(value: string | null, max = 100) {
  const cleaned = value?.trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return cleaned ? cleaned.slice(0, max) : null;
}

export function coarseLocation(headers: Headers) {
  return {
    country_code: safeHeader(headers.get("x-vercel-ip-country"), 2)?.toUpperCase() ?? null,
    region: safeHeader(headers.get("x-vercel-ip-country-region")) ?? null,
    city: safeHeader(headers.get("x-vercel-ip-city")) ?? null,
  };
}

export function requestIpSignal(headers: Headers) {
  const raw = headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const secret = process.env.ANALYTICS_IP_HASH_KEY?.trim();
  if (!raw || !secret) return null;
  const month = new Date().toISOString().slice(0, 7);
  const rotatingKey = createHmac("sha256", secret).update(month).digest();
  return createHmac("sha256", rotatingKey).update(raw).digest("hex").slice(0, 24);
}

export function classifyTraffic(input: {
  userAgent: string;
  verifiedBot: boolean;
  requestsLastMinute: number;
  samePathLastMinute: number;
}) {
  const reasons: string[] = [];
  if (input.verifiedBot) {
    return { trafficClass: "verified_bot" as const, reasons: ["trusted_host_verified_bot"] };
  }
  if (KNOWN_BOT.test(input.userAgent)) reasons.push("known_bot_user_agent");
  else if (BOT_SIGNAL.test(input.userAgent)) reasons.push("automation_user_agent");
  if (input.requestsLastMinute >= 30) reasons.push("rapid_repeated_requests");
  if (input.samePathLastMinute >= 12) reasons.push("repetitive_page_requests");
  if (reasons.length) return { trafficClass: "suspected_bot" as const, reasons };
  if (BROWSER_SIGNAL.test(input.userAgent)) {
    return { trafficClass: "likely_human" as const, reasons: ["interactive_browser"] };
  }
  return { trafficClass: "unknown" as const, reasons: ["insufficient_signals"] };
}

export function analyticsAttribution(input: {
  referrer?: unknown;
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
}) {
  let referrerHost: string | null = null;
  try {
    if (typeof input.referrer === "string" && input.referrer) {
      const url = new URL(input.referrer);
      if (url.protocol === "http:" || url.protocol === "https:") referrerHost = url.hostname.slice(0, 150);
    }
  } catch {
    referrerHost = null;
  }
  const clean = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, 100) : null;
  const explicitSource = clean(input.source);
  const social = referrerHost?.match(/(?:facebook|instagram|linkedin|tiktok|x\.com|twitter|youtube)/i)?.[0];
  return {
    referrer_host: referrerHost,
    source: explicitSource ?? (social ? social.toLowerCase() : referrerHost ? "referral" : "direct"),
    medium: clean(input.medium) ?? (referrerHost ? "referral" : "none"),
    campaign: clean(input.campaign),
  };
}
