import { NextResponse } from "next/server";
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
  const nextRaw = String(form.get("next") ?? "/directory");
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/directory";

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
    if (firstName) {
      await supabase.auth.updateUser({ data: { first_name: firstName } });
      await supabase.from("profiles").update({ display_name: firstName }).eq("id", userId);
    }
    await supabase.rpc("ensure_member_role", { target: userId });
  }

  return NextResponse.json({ redirect: next });
}
