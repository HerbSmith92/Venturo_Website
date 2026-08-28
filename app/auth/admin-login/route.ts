import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { roleFromClaims } from "@/lib/roles";

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

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const { data } = await supabase.auth.getClaims();
  const role = roleFromClaims((data?.claims ?? null) as Record<string, unknown> | null);
  if (role !== "admin") {
    return NextResponse.json({ redirect: "/admin/denied" });
  }

  return NextResponse.json({ redirect: "/admin" });
}
