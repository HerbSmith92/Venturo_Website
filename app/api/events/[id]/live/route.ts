import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requirePaidPayout } from "@/lib/event-input";
import { eventReadyToGoLive, goLiveEvent, saveEventDraft, type CreateEventInput } from "@/lib/events";
import { isStaff } from "@/lib/roles";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as CreateEventInput & { stay?: string };
  const ready = eventReadyToGoLive({
    title: body.title ?? "",
    description: body.description ?? "",
    venueName: body.venueName ?? "",
    startsAt: body.startsAt,
    endsAt: body.endsAt,
    ticketTypes: body.ticketTypes,
  });
  if (ready) {
    return NextResponse.json({ error: ready }, { status: 400 });
  }

  try {
    await requirePaidPayout(user.id, body.ticketTypes ?? []);
    const staff = isStaff(user.role);
    await saveEventDraft(user.id, id, body, staff);
    const live = await goLiveEvent(user.id, id, staff);
    const stayInPortal = body.stay === "portal";
    return NextResponse.json({
      slug: live.slug,
      status: live.status,
      ...(stayInPortal
        ? {}
        : { redirect: staff ? `/events/${live.slug}` : "/account/events" }),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not go live." },
      { status: 400 },
    );
  }
}
