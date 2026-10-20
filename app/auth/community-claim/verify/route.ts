import { NextResponse } from "next/server";
import { provisionMember } from "@/lib/member-auth";
import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const userId = data.user?.id;
  if (userId) await provisionMember(userId, firstName);

  const { error: passwordError } = await supabase.auth.updateUser({ password });
  if (passwordError) {
    return NextResponse.json({ error: passwordError.message }, { status: 400 });
  }

  const { error: claimError } = await supabase.rpc("claim_community", { p_community_id: communityId });
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 400 });
  }

  return NextResponse.json({ redirect: `/account/communities/${communityId}` });
}
