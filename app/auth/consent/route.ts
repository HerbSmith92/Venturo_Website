import { NextResponse } from "next/server";
import { CONSENT_COOKIE, consentCookieValue } from "@/lib/policy-consent";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(CONSENT_COOKIE, consentCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 30,
  });
  return response;
}
