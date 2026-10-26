import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canHost, HOST_MEMBERSHIP_REQUIRED } from "@/lib/host-access";
import { isEventHost, parseOrganiserProfileInput, saveOrganiserProfile } from "@/lib/host-profile";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }
  if (!canHost(user) && !(await isEventHost(user.id))) {
    return NextResponse.json({ error: HOST_MEMBERSHIP_REQUIRED }, { status: 403 });
  }

  try {
    const body = await request.json();
    const profile = parseOrganiserProfileInput(body);
    await saveOrganiserProfile(user.id, profile);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save host details." },
      { status: 400 },
    );
  }
}
