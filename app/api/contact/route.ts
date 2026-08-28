import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const form = await request.formData();
  const kind = String(form.get("kind") ?? "person");
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const businessName = String(form.get("businessName") ?? "").trim();
  const area = String(form.get("area") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!name || !email || !message) {
    return NextResponse.json({ error: "Name, email & message are required." }, { status: 400 });
  }

  const payload = {
    kind,
    name,
    email,
    phone,
    business_name: businessName || null,
    area: area || null,
    message,
  };

  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.from("enquiries").insert(payload);
    if (error) {
      return NextResponse.json(
        { error: "We received that, but could not save it yet. Email us if this keeps happening." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
