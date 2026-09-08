import { InviteAcceptForm } from "@/components/events/InviteAcceptForm";
import { InviteOpenBeacon } from "@/components/events/InviteOpenBeacon";
import { formatEventWindow } from "@/lib/event-types";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

type InvitePayload = {
  kind: string;
  status: string;
  email: string;
  name: string;
  complimentary?: boolean;
  eventTitle: string;
  eventSlug: string;
  startsAt: string | null;
  endsAt: string | null;
  venueName?: string | null;
  city?: string | null;
  timezone?: string | null;
};

function asInvite(data: unknown): InvitePayload | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (typeof row.eventSlug !== "string" || typeof row.eventTitle !== "string") return null;
  return {
    kind: String(row.kind ?? "invite"),
    status: String(row.status ?? "pending"),
    email: String(row.email ?? ""),
    name: String(row.name ?? ""),
    complimentary: Boolean(row.complimentary),
    eventTitle: row.eventTitle,
    eventSlug: row.eventSlug,
    startsAt: typeof row.startsAt === "string" ? row.startsAt : null,
    endsAt: typeof row.endsAt === "string" ? row.endsAt : null,
    venueName: typeof row.venueName === "string" ? row.venueName : null,
    city: typeof row.city === "string" ? row.city : null,
    timezone: typeof row.timezone === "string" ? row.timezone : null,
  };
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  if (!supabase) notFound();

  const { data } = await supabase.rpc("get_event_invite", { p_token: token });
  const invite = asInvite(data);
  if (!invite) notFound();

  const rsvp = invite.kind === "rsvp" || invite.complimentary;
  const windowLabel =
    invite.startsAt && invite.endsAt
      ? formatEventWindow(invite.startsAt, invite.endsAt, invite.timezone || "Africa/Johannesburg")
      : null;
  const place = [invite.venueName, invite.city].filter(Boolean).join(" · ");
  const done = ["booked", "claimed", "accepted"].includes(invite.status);

  return (
    <main className="shell section">
      {!rsvp && !done ? <InviteOpenBeacon token={token} /> : null}
      <p className="eyebrow">{rsvp ? "RSVP" : "You're Invited"}</p>
      <h1>{invite.eventTitle}</h1>
      {windowLabel ? <p className="lede">{windowLabel}</p> : null}
      {place ? <p className="muted">{place}</p> : null}

      {rsvp ? (
        <InviteAcceptForm token={token} invite={invite} />
      ) : done ? (
        <p className="notice">
          You&apos;re on the list. See you there.{" "}
          <a href={`/events/${invite.eventSlug}`}>Open the event</a>.
        </p>
      ) : (
        <div className="invite-landing">
          <p className="lede muted">
            {invite.email
              ? `This link is for you · ${invite.email.trim()}. Grab your ticket on the event page.`
              : "This link is for you. Grab your ticket on the event page."}
          </p>
          <a className="btn btn-primary" href={`/events/${invite.eventSlug}?invite=${encodeURIComponent(token)}#tickets`}>
            Get Tickets
          </a>
        </div>
      )}
    </main>
  );
}
