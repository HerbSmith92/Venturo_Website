import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import {
  eventAddressText,
  eventFeedImage,
  eventHeroImage,
  eventImage,
  eventStoryImage,
  formatCents,
  formatEventFromPrice,
  formatEventWhen,
  formatEventWindow,
  remainingTickets,
  slugifyTitle,
  unitPriceCents,
  type EventStatus,
  type EventTicketType,
  type EventVisibility,
  type MemberDiscountKind,
  type PlatformFees,
  type TicketKind,
  type VenturoEvent,
  EVENT_CATEGORIES,
} from "@/lib/event-types";

export type {
  EventStatus,
  EventTicketType,
  EventVisibility,
  MemberDiscountKind,
  PlatformFees,
  TicketKind,
  VenturoEvent,
};
export {
  EVENT_CATEGORIES,
  eventAddressText,
  eventFeedImage,
  eventHeroImage,
  eventImage,
  eventStoryImage,
  formatCents,
  formatEventFromPrice,
  formatEventWhen,
  formatEventWindow,
  remainingTickets,
  slugifyTitle,
  unitPriceCents,
};

type EventRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  age_restriction: string | null;
  audience_gender: string | null;
  format: string | null;
  category: string | null;
  tags: string[] | null;
  banner_url: string | null;
  listing_image_url: string | null;
  story_image_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  venue_name: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  show_map: boolean;
  visibility: EventVisibility;
  status: EventStatus;
  organiser_id: string;
  review_note: string | null;
  parking: string | null;
  prohibited_items: string | null;
  event_ticket_types?: TicketTypeRow[] | null;
};

type TicketTypeRow = {
  id: string;
  event_id: string;
  name: string;
  kind: TicketKind;
  price_cents: number;
  member_price_cents: number | null;
  member_discount_kind: MemberDiscountKind | null;
  member_discount_value: number | string | null;
  members_only: boolean | null;
  pass_fees_to_buyer?: boolean | null;
  pass_commission_to_buyer?: boolean | null;
  quantity: number;
  sold_count: number;
  sort_order: number;
};

function mapTicket(row: TicketTypeRow): EventTicketType {
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    kind: row.kind,
    priceCents: row.price_cents,
    memberPriceCents: row.member_price_cents,
    memberDiscountKind: row.member_discount_kind ?? "none",
    memberDiscountValue:
      row.member_discount_value === null || row.member_discount_value === undefined
        ? null
        : Number(row.member_discount_value),
    membersOnly: Boolean(row.members_only),
    passFeesToBuyer: Boolean(row.pass_fees_to_buyer),
    passCommissionToBuyer: Boolean(row.pass_commission_to_buyer),
    quantity: row.quantity,
    soldCount: row.sold_count,
    sortOrder: row.sort_order,
  };
}

function mapEvent(row: EventRow): VenturoEvent {
  const ticketTypes = [...(row.event_ticket_types ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(mapTicket);

  const publicTickets = ticketTypes.filter((t) => !t.membersOnly);
  const publicPrices = publicTickets.map((t) => t.priceCents);
  const memberPrices = ticketTypes
    .map((t) => t.memberPriceCents)
    .filter((p): p is number => p !== null);
  const membersOnly =
    ticketTypes.length > 0 &&
    ticketTypes.some((t) => t.kind !== "free") &&
    ticketTypes.filter((t) => t.kind !== "free").every((t) => t.membersOnly);

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    ageRestriction: row.age_restriction,
    audienceGender: row.audience_gender || "Everyone",
    format: row.format,
    category: row.category,
    tags: row.tags ?? [],
    bannerUrl: row.banner_url,
    listingImageUrl: row.listing_image_url,
    storyImageUrl: row.story_image_url,
    startsAt: row.starts_at ?? "",
    endsAt: row.ends_at ?? "",
    timezone: row.timezone,
    venueName: row.venue_name,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    postalCode: row.postal_code,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
    showMap: row.show_map,
    visibility: row.visibility,
    status: row.status,
    organiserId: row.organiser_id,
    reviewNote: row.review_note,
    parking: row.parking,
    prohibitedItems: row.prohibited_items,
    fromPriceCents: publicPrices.length
      ? Math.min(...publicPrices)
      : membersOnly
        ? null
        : (ticketTypes[0]?.priceCents ?? null),
    memberFromPriceCents: memberPrices.length ? Math.min(...memberPrices) : null,
    membersOnly,
    ticketTypes,
  };
}

const EVENT_SELECT = `
  id, slug, title, description, age_restriction, audience_gender, format, category, tags,
  banner_url, listing_image_url, story_image_url,   starts_at, ends_at, timezone,
  venue_name, address_line1, address_line2, city, postal_code, country,
  latitude, longitude, show_map, visibility, status, organiser_id, review_note,
  parking, prohibited_items,
  event_ticket_types (
    id, event_id, name, kind, price_cents, member_price_cents,
    member_discount_kind, member_discount_value, members_only, pass_fees_to_buyer,
    pass_commission_to_buyer, quantity, sold_count, sort_order
  )
`;

export async function getPlatformFees(): Promise<PlatformFees> {
  const supabase = await createClient();
  if (!supabase) return { commissionPct: 0, bookingFeeCents: 0 };
  const { data } = await supabase
    .from("platform_fee_settings")
    .select("commission_pct, booking_fee_cents")
    .eq("id", 1)
    .maybeSingle();
  return {
    commissionPct: Number(data?.commission_pct ?? 0),
    bookingFeeCents: Number(data?.booking_fee_cents ?? 0),
  };
}

export async function listPublicEvents(options?: {
  category?: string;
  limit?: number;
}): Promise<VenturoEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("status", "approved")
    .eq("visibility", "public")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  if (options?.category && options.category !== "all") {
    query = query.eq("category", options.category);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as EventRow[]).map(mapEvent);
}

export async function featuredEvents(limit = 6): Promise<VenturoEvent[]> {
  return listPublicEvents({ limit });
}

export async function getEventBySlug(slug: string): Promise<VenturoEvent | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error || !data) return null;
  return mapEvent(data as EventRow);
}

export async function getEventById(id: string): Promise<VenturoEvent | null> {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return mapEvent(data as EventRow);
}

export async function listOrganiserEvents(userId: string): Promise<VenturoEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("organiser_id", userId)
    .order("starts_at", { ascending: false });

  if (error || !data) return [];
  return (data as EventRow[]).map(mapEvent);
}

export async function listAdminEvents(status?: EventStatus | "all"): Promise<VenturoEvent[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  let query = supabase
    .from("events")
    .select(EVENT_SELECT)
    .order("starts_at", { ascending: false });

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as EventRow[]).map(mapEvent);
}

export async function uniqueEventSlug(base: string) {
  const supabase = (await createClient()) ?? createServiceClient();
  if (!supabase) return `${base}-${Date.now()}`;

  const slug = base || `event-${Date.now()}`;
  for (let i = 0; i < 20; i += 1) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    const { data } = await supabase.from("events").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

export type CreateEventInput = {
  title: string;
  description: string;
  ageRestriction?: string;
  audienceGender?: string;
  format?: string;
  category?: string;
  tags?: string[];
  bannerUrl?: string;
  listingImageUrl?: string;
  storyImageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  timezone?: string;
  venueName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  showMap?: boolean;
  visibility?: EventVisibility;
  parking?: string;
  prohibitedItems?: string;
  ticketTypes?: {
    name: string;
    kind: TicketKind;
    priceCents: number;
    memberPriceCents?: number | null;
    memberDiscountKind?: MemberDiscountKind;
    memberDiscountValue?: number | null;
    membersOnly?: boolean;
    passFeesToBuyer?: boolean;
    passCommissionToBuyer?: boolean;
    quantity: number;
  }[];
  submitForReview?: boolean;
  isStaff?: boolean;
};

export async function createEventDraft(userId: string, input: CreateEventInput) {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const slug = await uniqueEventSlug(slugifyTitle(input.title));
  const status: EventStatus =
    input.isStaff && input.submitForReview
      ? "approved"
      : input.submitForReview
        ? "review"
        : "draft";

  const { data: event, error } = await supabase
    .from("events")
    .insert({
      slug,
      title: input.title.trim(),
      description: input.description.trim(),
      age_restriction: input.ageRestriction || null,
      audience_gender: input.audienceGender || "Everyone",
      format: input.format || null,
      category: input.category || null,
      tags: input.tags ?? [],
      banner_url: input.bannerUrl || null,
      listing_image_url: input.listingImageUrl || null,
      story_image_url: input.storyImageUrl || null,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      timezone: input.timezone || "Africa/Johannesburg",
      venue_name: (input.venueName ?? "").trim(),
      address_line1: input.addressLine1 || null,
      address_line2: input.addressLine2 || null,
      city: input.city || null,
      postal_code: input.postalCode || null,
      country: (input.country || "South Africa").trim(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      show_map: Boolean(input.showMap),
      visibility: input.visibility || "public",
      parking: input.parking?.trim() || null,
      prohibited_items: input.prohibitedItems?.trim() || null,
      status,
      organiser_id: userId,
      created_by: userId,
      published_by: status === "approved" ? userId : null,
    })
    .select("id, slug")
    .single();

  if (error || !event) throw new Error(error?.message ?? "Could not create event.");

  if (input.ticketTypes?.length) {
    const { error: ticketError } = await supabase.from("event_ticket_types").insert(
      input.ticketTypes.map((ticket, index) => ({
        event_id: event.id,
        name: ticket.name.trim(),
        kind: ticket.kind,
        price_cents: ticket.kind === "free" ? 0 : ticket.priceCents,
        member_price_cents:
          ticket.kind === "free" ? null : (ticket.memberPriceCents ?? null),
        member_discount_kind:
          ticket.kind === "free" ? "none" : (ticket.memberDiscountKind ?? "none"),
        member_discount_value:
          ticket.kind === "free" ? null : (ticket.memberDiscountValue ?? null),
        members_only: ticket.kind === "free" ? false : Boolean(ticket.membersOnly),
        pass_fees_to_buyer: ticket.kind === "paid" ? Boolean(ticket.passFeesToBuyer) : false,
        pass_commission_to_buyer: ticket.kind === "paid" ? Boolean(ticket.passCommissionToBuyer) : false,
        quantity: ticket.quantity,
        sort_order: index,
      })),
    );
    if (ticketError) throw new Error(ticketError.message);
  }

  return event as { id: string; slug: string };
}

export async function createEventStub(userId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("Give the event a name.");
  return createEventDraft(userId, { title: trimmed, description: "", ticketTypes: [] });
}

type TicketInput = NonNullable<CreateEventInput["ticketTypes"]>[number];

function ticketInsertRows(eventId: string, tickets: TicketInput[]) {
  return tickets.map((ticket, index) => ({
    event_id: eventId,
    name: ticket.name.trim() || "Standard Ticket",
    kind: ticket.kind,
    price_cents: ticket.kind === "free" ? 0 : ticket.priceCents,
    member_price_cents: ticket.kind === "free" ? null : (ticket.memberPriceCents ?? null),
    member_discount_kind: ticket.kind === "free" ? "none" : (ticket.memberDiscountKind ?? "none"),
    member_discount_value: ticket.kind === "free" ? null : (ticket.memberDiscountValue ?? null),
    members_only: ticket.kind === "free" ? false : Boolean(ticket.membersOnly),
    pass_fees_to_buyer: ticket.kind === "paid" ? Boolean(ticket.passFeesToBuyer) : false,
    pass_commission_to_buyer: ticket.kind === "paid" ? Boolean(ticket.passCommissionToBuyer) : false,
    quantity: ticket.quantity,
    sort_order: index,
  }));
}

export async function saveEventDraft(
  userId: string,
  eventId: string,
  input: CreateEventInput,
  staff: boolean,
) {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const { data: existing, error: loadError } = await supabase
    .from("events")
    .select("id, organiser_id, status, slug")
    .eq("id", eventId)
    .maybeSingle();
  if (loadError || !existing) throw new Error("Event not found.");
  if (!staff && existing.organiser_id !== userId) throw new Error("Not allowed.");
  if (!staff && !["draft", "review", "rejected"].includes(existing.status)) {
    throw new Error("This event is locked. Ask Control Room if you need a change.");
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      age_restriction: input.ageRestriction || null,
      audience_gender: input.audienceGender || "Everyone",
      format: input.format || null,
      category: input.category || null,
      tags: input.tags ?? [],
      banner_url: input.bannerUrl || null,
      listing_image_url: input.listingImageUrl || null,
      story_image_url: input.storyImageUrl || null,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
      timezone: input.timezone || "Africa/Johannesburg",
      venue_name: (input.venueName ?? "").trim(),
      address_line1: input.addressLine1 || null,
      address_line2: input.addressLine2 || null,
      city: input.city || null,
      postal_code: input.postalCode || null,
      country: (input.country || "South Africa").trim(),
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      show_map: Boolean(input.showMap),
      visibility: input.visibility || "public",
      ...(input.parking !== undefined ? { parking: input.parking?.trim() || null } : {}),
      prohibited_items: input.prohibitedItems?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);

  if (updateError) throw new Error(updateError.message);

  if (input.ticketTypes) {
    const { data: currentTickets, error: ticketLoadError } = await supabase
      .from("event_ticket_types")
      .select("id, sold_count")
      .eq("event_id", eventId);
    if (ticketLoadError) throw new Error(ticketLoadError.message);
    if ((currentTickets ?? []).some((row) => (row.sold_count ?? 0) > 0)) {
      throw new Error("Ticket types are locked after the first sale.");
    }
    const { error: deleteError } = await supabase
      .from("event_ticket_types")
      .delete()
      .eq("event_id", eventId);
    if (deleteError) throw new Error(deleteError.message);
    if (input.ticketTypes.length) {
      const { error: insertError } = await supabase
        .from("event_ticket_types")
        .insert(ticketInsertRows(eventId, input.ticketTypes));
      if (insertError) throw new Error(insertError.message);
    }
  }

  return { id: existing.id as string, slug: existing.slug as string };
}

export function eventReadyToGoLive(input: {
  title: string;
  description: string;
  venueName: string;
  startsAt?: string;
  endsAt?: string;
  ticketTypes?: TicketInput[];
}) {
  if (!input.title.trim()) return "Give the event a name.";
  if (!input.description.trim()) return "Add a short description.";
  if (!input.venueName.trim()) return "Add a venue.";
  if (!input.startsAt || !input.endsAt) return "Add a start and end time.";
  if (new Date(input.endsAt).getTime() < new Date(input.startsAt).getTime()) {
    return "End time must be after the start time.";
  }
  if (!input.ticketTypes?.length) return "Add at least one ticket type.";
  return null;
}

export async function goLiveEvent(
  userId: string,
  eventId: string,
  staff: boolean,
) {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not connected.");

  const event = await getEventById(eventId);
  if (!event) throw new Error("Event not found.");
  if (!staff && event.organiserId !== userId) throw new Error("Not allowed.");

  const ready = eventReadyToGoLive({
    title: event.title,
    description: event.description,
    venueName: event.venueName,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    ticketTypes: event.ticketTypes,
  });
  if (ready) throw new Error(ready);

  const nextStatus: EventStatus = staff ? "approved" : "review";
  const { error } = await supabase
    .from("events")
    .update({
      status: nextStatus,
      published_by: staff ? userId : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eventId);
  if (error) throw new Error(error.message);

  return { slug: event.slug, status: nextStatus };
}

export async function getOrganiserSalesSummary(organiserId: string) {
  const supabase = await createClient();
  if (!supabase) return { ticketsSold: 0, grossCents: 0, feesCents: 0, owedCents: 0 };

  const { data: events } = await supabase
    .from("events")
    .select("id")
    .eq("organiser_id", organiserId);

  const eventIds = (events ?? []).map((e) => e.id);
  if (!eventIds.length) {
    return { ticketsSold: 0, grossCents: 0, feesCents: 0, owedCents: 0 };
  }

  const { data: orders } = await supabase
    .from("event_orders")
    .select("subtotal_cents, commission_cents, booking_fee_cents, payout_status, status")
    .in("event_id", eventIds)
    .eq("status", "paid");

  let grossCents = 0;
  let feesCents = 0;
  let owedCents = 0;

  for (const order of orders ?? []) {
    grossCents += order.subtotal_cents ?? 0;
    feesCents += (order.commission_cents ?? 0) + (order.booking_fee_cents ?? 0);
    if (order.payout_status === "owed") {
      owedCents +=
        (order.subtotal_cents ?? 0) -
        (order.commission_cents ?? 0) -
        (order.booking_fee_cents ?? 0);
    }
  }

  const { count } = await supabase
    .from("event_tickets")
    .select("id", { count: "exact", head: true })
    .in("event_id", eventIds);

  return { ticketsSold: count ?? 0, grossCents, feesCents, owedCents };
}
