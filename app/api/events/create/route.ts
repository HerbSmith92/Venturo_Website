import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createEventStub } from "@/lib/events";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const body = (await request.json()) as { title?: string; stay?: string };
  try {
    const event = await createEventStub(user.id, body.title ?? "");
    return NextResponse.json({
      id: event.id,
      slug: event.slug,
      redirect: body.stay === "portal" ? `/portal/events/${event.id}` : `/account/events/${event.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create event." },
      { status: 400 },
    );
  }
}
