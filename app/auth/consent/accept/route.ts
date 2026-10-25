import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/member-auth";
import { bodyHasConsent, CONSENT_REQUIRED, recordMemberConsent } from "@/lib/policy-consent";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await request.json()) as { acceptTerms?: boolean; acceptPrivacy?: boolean; next?: string };
  if (!bodyHasConsent(body)) {
    return NextResponse.json({ error: CONSENT_REQUIRED }, { status: 400 });
  }
  await recordMemberConsent(user.id, "social");
  return NextResponse.json({ redirect: safeNextPath(body.next) });
}
