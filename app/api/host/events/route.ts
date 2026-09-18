import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listCompanionDoorEvents } from "@/lib/companion-data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to open the companion." }, { status: 401 });
  }

  try {
    const events = await listCompanionDoorEvents(user.id);
    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load events." },
      { status: 400 },
    );
  }
}
