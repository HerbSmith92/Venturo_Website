import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  assertCanManageEventDoor,
  scanEventTicket,
} from "@/lib/host-scanning";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to scan tickets." }, { status: 401 });
  }

  const body = (await request.json()) as { eventId?: string; code?: string };
  if (!body.eventId || !body.code?.trim()) {
    return NextResponse.json(
      { error: "Event and ticket code are required." },
      { status: 400 },
    );
  }

  try {
    await assertCanManageEventDoor(body.eventId, user.id, user.role);
    const result = await scanEventTicket(body.eventId, body.code);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Scan failed." },
      { status: 400 },
    );
  }
}
