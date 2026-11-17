import { NextResponse } from "next/server";
import { provisionMember } from "@/lib/member-auth";
import { tidyCellphone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_REQUIRED, formHasConsent, recordMemberConsent } from "@/lib/policy-consent";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not connected yet." }, { status: 503 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const token = String(form.get("token") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const firstName = String(form.get("firstName") ?? "").trim();
  const phone = tidyCellphone(String(form.get("phone") ?? ""));
  const communityId = String(form.get("communityId") ?? "");

  if (!email || !token) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Use a password of at least 8 characters." }, { status: 400 });
  }
  if (!UUID.test(communityId)) {
    return NextResponse.json({ error: "That community could not be claimed." }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Add a cellphone number." }, { status: 400 });
  }
  if (!formHasConsent(form)) {
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
  if (!userId) {
    return NextResponse.json({ error: "The verified account could not be loaded." }, { status: 400 });
  }
  if (userId) {
    await provisionMember(userId, firstName, phone ?? undefined);
    await recordMemberConsent(userId, "community-claim");
  }

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) {
    return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }

  const { error: claimError } = await supabase.from("community_claim_requests").upsert(
    {
      community_id: communityId,
      requested_by: userId,
      evidence: "Account and email verified during claim request.",
      status: "pending",
      reviewed_by: null,
      reviewed_at: null,
    },
    { onConflict: "community_id,requested_by" },
  );
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 400 });
  }

  return NextResponse.json({ redirect: "/account/communities?claim=requested" });
}
