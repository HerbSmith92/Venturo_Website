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
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const firstName = String(form.get("firstName") ?? "");

  const origin = new URL(request.url).origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName },
      emailRedirectTo: `${origin}/directory`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user && firstName) {
    await supabase.from("profiles").update({ display_name: firstName }).eq("id", data.user.id);
  }

  return NextResponse.json({ redirect: "/directory" });
}
