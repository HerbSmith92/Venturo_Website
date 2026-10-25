import { NextResponse } from "next/server";
import { provisionMember, safeNextPath } from "@/lib/member-auth";
import { tidyCellphone } from "@/lib/phone";
import { postAuthPathAfterProvision } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_REQUIRED, formHasConsent, recordMemberConsent } from "@/lib/policy-consent";

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Supabase is not connected yet." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const token = String(form.get("token") ?? "").trim();
  const firstName = String(form.get("firstName") ?? "").trim();
  const phoneRaw = String(form.get("phone") ?? "").trim();
  const phone = phoneRaw ? tidyCellphone(phoneRaw) : null;
  const next = safeNextPath(form.get("next"));
  if (phoneRaw && !phone) {
    return NextResponse.json({ error: "Add a cellphone number." }, { status: 400 });
  }

  if (!email || !token) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }
  const signup = String(form.get("mode") ?? "") === "signup" || Boolean(firstName);
  if (signup && !formHasConsent(form)) {
    return NextResponse.json({ error: CONSENT_REQUIRED }, { status: 400 });
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userId = data.user?.id;
  if (userId) {
    await provisionMember(userId, firstName, phone ?? undefined);
    if (formHasConsent(form)) await recordMemberConsent(userId, "signup");
  }

  return NextResponse.json({ redirect: await postAuthPathAfterProvision(next) });
}
