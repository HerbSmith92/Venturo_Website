import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { onboardingPlanCookie, parseOnboardingPlan } from "@/lib/onboarding-shared";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to choose a plan." }, { status: 401 });
  }

  const body = (await request.json()) as { plan?: unknown };
  const plan = parseOnboardingPlan(body.plan);
  if (!plan) {
    return NextResponse.json({ error: "Pick Free or Subscribe." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true, plan });
  const cookie = onboardingPlanCookie(plan);
  response.cookies.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    sameSite: cookie.sameSite,
    path: cookie.path,
    maxAge: cookie.maxAge,
  });
  return response;
}
