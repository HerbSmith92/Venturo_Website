import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  const form = await request.formData().catch(() => null);
  const next = safeNext(form?.get("next") ?? "/");
  return NextResponse.redirect(new URL(next, request.url), { status: 303 });
}
