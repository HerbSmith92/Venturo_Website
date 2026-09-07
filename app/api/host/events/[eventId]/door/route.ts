import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  assertCanManageEventDoor,
  getEventDoorStats,
  listEventDoorGuests,
} from "@/lib/host-scanning";

export async function GET(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to open the door list." }, { status: 401 });
  }

  const { eventId } = await context.params;
  if (!eventId) {
    return NextResponse.json({ error: "Event required." }, { status: 400 });
  }

  try {
    await assertCanManageEventDoor(eventId, user.id, user.role);
    const [stats, guests] = await Promise.all([
      getEventDoorStats(eventId),
      listEventDoorGuests(eventId),
    ]);
    return NextResponse.json({ stats, guests });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load door data." },
      { status: 400 },
    );
  }
}
