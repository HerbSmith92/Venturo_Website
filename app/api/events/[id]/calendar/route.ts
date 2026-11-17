import { NextResponse } from "next/server";
import { getEventBySlug } from "@/lib/events";
import { listOccurrences } from "@/lib/event-repeat";

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function utcStamp(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event || (event.status !== "approved" && event.status !== "cancelled")) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }
  const wanted = new URL(request.url).searchParams.get("on");
  const occurrences = listOccurrences(event.startsAt, event.endsAt, event.repeatEvery, event.repeatUntil);
  const occurrence =
    occurrences.find((item) => wanted && Math.abs(Date.parse(item.startsAt) - Date.parse(wanted)) < 1000) ??
    occurrences[0];
  if (!occurrence) return NextResponse.json({ error: "Event date is unavailable." }, { status: 404 });

  const location = [event.venueName, event.addressLine1, event.city, event.country].filter(Boolean).join(", ");
  const status = event.status === "cancelled" ? "CANCELLED" : "CONFIRMED";
  const body = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Venturo//Events//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${event.id}-${utcStamp(occurrence.startsAt)}@venturo.co.za`,
    `DTSTAMP:${utcStamp(new Date().toISOString())}`,
    `DTSTART:${utcStamp(occurrence.startsAt)}`,
    `DTEND:${utcStamp(occurrence.endsAt || occurrence.startsAt)}`,
    `SUMMARY:${escapeIcs(event.title)}`,
    `DESCRIPTION:${escapeIcs(event.description || "Venturo event")}`,
    `LOCATION:${escapeIcs(location)}`,
    `STATUS:${status}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
