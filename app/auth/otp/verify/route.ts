import { NextResponse } from "next/server";
import { provisionMember, safeNextPath } from "@/lib/member-auth";
import { postAuthPathAfterProvision } from "@/lib/onboarding";
import { createClient } from "@/lib/supabase/server";

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
  const next = safeNextPath(form.get("next"));

  if (!email || !token) {
    return NextResponse.json({ error: "Email and code are required." }, { status: 400 });
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
    await provisionMember(userId, firstName);
  }

  return NextResponse.json({ redirect: await postAuthPathAfterProvision(next) });
}
