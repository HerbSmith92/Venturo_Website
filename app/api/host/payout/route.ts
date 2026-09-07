import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { savePayoutProfile, type PayoutInput } from "@/lib/event-input";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const body = (await request.json()) as PayoutInput;
  try {
    await savePayoutProfile(user.id, user.firstName, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save bank details." },
      { status: 400 },
    );
  }
}
