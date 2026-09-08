import { createClient } from "@/lib/supabase/server";
import { campaignPublicUrl, invitePublicUrl } from "@/lib/event-links";

export type EventPromoter = {
  id: string;
  name: string;
  email: string;
  incentivePct: number;
  networkId: string | null;
};

export type EventPromoterNetwork = {
  id: string;
  name: string;
};

export type EventPromoCode = {
  id: string;
  code: string;
  kind: "percent" | "amount" | "hidden_ticket";
  value: number | null;
  hiddenTicketTypeId: string | null;
  promoterId: string | null;
  networkId: string | null;
};

export type EventCampaign = {
  id: string;
  name: string;
  slug: string;
  views: number;
};

export type EventInviteStatus =
  | "pending"
  | "opened"
  | "booked"
  | "claimed"
  | "accepted"
  | "revoked";

export type EventInvite = {
  id: string;
  kind: "invite" | "rsvp";
  email: string;
  name: string;
  token: string;
  status: EventInviteStatus;
  createdAt: string;
};

export type PastAttendee = {
  name: string;
  email: string;
};

export type EventMarketingData = {
  promoters: EventPromoter[];
  networks: EventPromoterNetwork[];
  codes: EventPromoCode[];
  campaigns: EventCampaign[];
  invites: EventInvite[];
  pastAttendees: PastAttendee[];
};

function asInviteStatus(value: string | null | undefined): EventInviteStatus {
  if (
    value === "opened" ||
    value === "booked" ||
    value === "claimed" ||
    value === "accepted" ||
    value === "revoked"
  ) {
    return value;
  }
  return "pending";
}

function emptyMarketing(): EventMarketingData {
  return {
    promoters: [],
    networks: [],
    codes: [],
    campaigns: [],
    invites: [],
    pastAttendees: [],
  };
}

export async function getEventMarketing(eventId: string): Promise<EventMarketingData> {
  const supabase = await createClient();
  if (!supabase) return emptyMarketing();

  try {
    const [promoters, networks, codes, campaigns, invites, past] = await Promise.all([
      supabase
        .from("event_promoters")
        .select("id, name, email, incentive_pct, network_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_promoter_networks")
        .select("id, name")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_promo_codes")
        .select("id, code, kind, value, hidden_ticket_type_id, promoter_id, network_id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_campaigns")
        .select("id, name, slug, visits, unique_visits")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_invites")
        .select("id, kind, email, name, token, status, created_at")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false }),
      supabase.rpc("list_event_door_guests", { p_event_id: eventId }),
    ]);

    const campaignRows = campaigns.data ?? [];
    const viewMap = new Map<string, number>();
    if (campaignRows.length) {
      const hits = await supabase
        .from("event_campaign_hits")
        .select("campaign_id, views")
        .in(
          "campaign_id",
          campaignRows.map((row) => row.id),
        );
      for (const row of hits.data ?? []) {
        viewMap.set(row.campaign_id, (viewMap.get(row.campaign_id) ?? 0) + (Number(row.views) || 0));
      }
    }

    const pastSeen = new Set<string>();
    const pastAttendees: PastAttendee[] = [];
    for (const row of (past.data as { guest_email?: string | null; guest_name?: string | null }[]) ?? []) {
      const email = (row.guest_email ?? "").trim().toLowerCase();
      if (!email || pastSeen.has(email)) continue;
      pastSeen.add(email);
      pastAttendees.push({ name: (row.guest_name ?? "").trim(), email });
    }

    return {
      promoters: (promoters.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        incentivePct: Number(row.incentive_pct) || 0,
        networkId: row.network_id,
      })),
      networks: (networks.data ?? []).map((row) => ({ id: row.id, name: row.name })),
      codes: (codes.data ?? []).map((row) => ({
        id: row.id,
        code: row.code,
        kind: row.kind,
        value: row.value,
        hiddenTicketTypeId: row.hidden_ticket_type_id,
        promoterId: row.promoter_id,
        networkId: row.network_id,
      })),
      campaigns: campaignRows.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        views: viewMap.get(row.id) || Number(row.visits) || Number(row.unique_visits) || 0,
      })),
      invites: (invites.data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind === "rsvp" ? "rsvp" : "invite",
        email: row.email,
        name: row.name ?? "",
        token: row.token,
        status: asInviteStatus(row.status),
        createdAt: row.created_at,
      })),
      pastAttendees,
    };
  } catch {
    return emptyMarketing();
  }
}

export async function listEventInvites(
  eventId: string,
  kind?: "invite" | "rsvp",
): Promise<EventInvite[]> {
  const data = await getEventMarketing(eventId);
  if (!kind) return data.invites;
  return data.invites.filter((invite) => invite.kind === kind);
}

export { campaignPublicUrl, invitePublicUrl };
