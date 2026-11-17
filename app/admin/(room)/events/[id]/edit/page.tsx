import { EventStudio } from "@/components/events/EventStudio";
import { requireStaff } from "@/lib/auth";
import { getEventById, getPlatformFees } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function AdminEditEventPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaff();
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) notFound();
  const fees = await getPlatformFees();
  const supabase = await createClient();
  let hasPayout = false;
  if (supabase) {
    const { data } = await supabase
      .from("organiser_payout_profiles")
      .select("user_id")
      .eq("user_id", event.organiserId)
      .maybeSingle();
    hasPayout = Boolean(data);
  }

  const bookingLabel =
    event.bookingMethod === "external"
      ? `External · ${event.externalProviderName || "provider"}`
      : event.bookingMethod === "free_rsvp"
        ? "Free RSVP"
        : "Venturo Ticketing";

  return (
    <section>
      <p className="eyebrow">Control Room · Edit event</p>
      <h1>{event.title || "Untitled event"}</h1>
      <p className="muted">
        <span className={`status-pill ${event.status}`}>{event.status}</span>
        {" · "}
        {bookingLabel}
        {event.organiserDisplayName ? ` · Organised by ${event.organiserDisplayName}` : ""}
      </p>
      <p className="hero-actions" style={{ marginTop: 16 }}>
        <a className="btn btn-secondary" href={`/admin/events/${event.id}`}>
          Review page
        </a>
        <a className="btn btn-secondary" href="/admin/events?status=draft">
          All drafts
        </a>
        {event.slug ? (
          <a className="btn btn-secondary" href={`/events/${event.slug}`} target="_blank" rel="noreferrer">
            Public page
          </a>
        ) : null}
      </p>
      <div style={{ marginTop: 28 }}>
        <EventStudio event={event} isStaff hasPayout={hasPayout} fees={fees} stay="admin" focus="full" />
      </div>
    </section>
  );
}
