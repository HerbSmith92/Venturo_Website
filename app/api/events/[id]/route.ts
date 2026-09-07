import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveEventDraft, type CreateEventInput } from "@/lib/events";
import { isStaff } from "@/lib/roles";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Log in first." }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as CreateEventInput;
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Give the event a name." }, { status: 400 });
  }

  try {
    const event = await saveEventDraft(user.id, id, body, isStaff(user.role));
    return NextResponse.json({ id: event.id, slug: event.slug });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save event." },
      { status: 400 },
    );
  }
}
