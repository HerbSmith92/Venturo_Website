"use client";

import { useMemo, useState } from "react";
import { EventPreview } from "@/components/EventPreview";
import { EventPageHero } from "@/components/events/EventPageHero";
import { StudioDateTime } from "@/components/events/StudioDateTime";
import { StudioSection } from "@/components/events/StudioSection";
import { TicketTypeCard } from "@/components/events/TicketTypeCard";
import { EnergySpectrum } from "@/components/EnergySpectrum";
import {
  EVENT_ENERGY_SCALES,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_MAX_MB,
  EVENT_IMAGE_SPECS,
  EVENT_INTERESTS,
  EVENT_PERSONAS,
  SUGGESTED_EVENT_TAGS,
  datetimeLocalToIso,
  formatEventFromPrice,
  isoToDatetimeLocal,
  parseEventEnergy,
  parseEventPersonas,
  parseRandsToCents,
  pickEnergyRange,
  serializeEventEnergy,
  serializeEventPersonas,
  toggleEventPersona,
  withCurrentOption,
  type EventImageKind,
  type MemberDiscountKind,
  type TicketKind,
  type VenturoEvent,
} from "@/lib/event-types";
import { ticketMemberCents } from "@/lib/event-fees";
import { PORTAL_SETTINGS_BANK } from "@/lib/portal";

type TicketDraft = {
  name: string;
  kind: TicketKind;
  priceRands: string;
  discountKind: MemberDiscountKind;
  discountValue: string;
  membersOnly: boolean;
  quantity: string;
  passFeesToBuyer: boolean;
  passCommissionToBuyer: boolean;
};

const AGE_OPTIONS = [
  "All ages",
  "No under 13s",
  "No under 16s",
  "No under 18s",
  "No under 21s",
];

const STUDIO_IMAGE_ORDER: EventImageKind[] = ["banner", "listing", "story"];

const emptyTicket = (kind: TicketKind = "paid"): TicketDraft => ({
  name: kind === "free" ? "Free Ticket" : kind === "donation" ? "Donation" : "Standard Ticket",
  kind,
  priceRands: kind === "free" ? "0.00" : "",
  discountKind: "none",
  discountValue: "",
  membersOnly: false,
  quantity: "100",
  passFeesToBuyer: false,
  passCommissionToBuyer: false,
});

function fromEventTickets(event: VenturoEvent): TicketDraft[] {
  if (!event.ticketTypes.length) return [];
  return event.ticketTypes.map((ticket) => ({
    name: ticket.name,
    kind: ticket.kind,
    priceRands: (ticket.priceCents / 100).toFixed(2),
    discountKind: ticket.memberDiscountKind,
    discountValue:
      ticket.memberDiscountValue != null ? String(ticket.memberDiscountValue) : "",
    membersOnly: ticket.membersOnly,
    quantity: String(ticket.quantity),
    passFeesToBuyer: ticket.passFeesToBuyer,
    passCommissionToBuyer: ticket.passCommissionToBuyer,
  }));
}

function parseCoord(value: string) {
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

async function uploadEventImage(file: File, kind: EventImageKind) {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  const response = await fetch("/api/events/upload", { method: "POST", body: form });
  const payload = (await response.json()) as { error?: string; url?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Upload failed.");
  }
  return payload.url;
}

export function EventStudio({
  event,
  isStaff,
  hasPayout,
  commissionPct,
  bookingFeeCents,
  stay,
}: {
  event: VenturoEvent;
  isStaff: boolean;
  hasPayout: boolean;
  commissionPct: number;
  bookingFeeCents: number;
  stay?: "portal";
}) {
  const [title, setTitle] = useState(event.title);
  const [description, setDescription] = useState(event.description);
  const [ageRestriction, setAgeRestriction] = useState(event.ageRestriction || AGE_OPTIONS[0]);
  const [personas, setPersonas] = useState(() => parseEventPersonas(event.audienceGender));
  const energyStart = parseEventEnergy(event.format);
  const [energyLow, setEnergyLow] = useState(String(energyStart.low));
  const [energyHigh, setEnergyHigh] = useState(String(energyStart.high));
  const [category, setCategory] = useState(event.category || EVENT_INTERESTS[0]);
  const [tags, setTags] = useState<string[]>(event.tags);
  const [customTag, setCustomTag] = useState("");
  const [bannerUrl, setBannerUrl] = useState(event.bannerUrl ?? "");
  const [listingImageUrl, setListingImageUrl] = useState(event.listingImageUrl ?? "");
  const [storyImageUrl, setStoryImageUrl] = useState(event.storyImageUrl ?? "");
  const [startsAt, setStartsAt] = useState(isoToDatetimeLocal(event.startsAt));
  const [endsAt, setEndsAt] = useState(isoToDatetimeLocal(event.endsAt));
  const [venueName, setVenueName] = useState(event.venueName);
  const [addressLine1, setAddressLine1] = useState(event.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(event.addressLine2 ?? "");
  const [city, setCity] = useState(event.city ?? "");
  const [postalCode, setPostalCode] = useState(event.postalCode ?? "");
  const [country, setCountry] = useState(event.country || "South Africa");
  const [latitude, setLatitude] = useState(event.latitude != null ? String(event.latitude) : "");
  const [longitude, setLongitude] = useState(
    event.longitude != null ? String(event.longitude) : "",
  );
  const [visibility, setVisibility] = useState<"public" | "private">(event.visibility);
  const [showMap, setShowMap] = useState(event.showMap);
  const [prohibitedItems, setProhibitedItems] = useState(event.prohibitedItems ?? "");
  const [tickets, setTickets] = useState<TicketDraft[]>(() => fromEventTickets(event));
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "live" | null>(null);
  const [uploading, setUploading] = useState<EventImageKind | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const hasPaidTickets = useMemo(
    () => tickets.some((ticket) => ticket.kind === "paid" && parseRandsToCents(ticket.priceRands) > 0),
    [tickets],
  );
  const audienceGender = serializeEventPersonas(personas);
  const format = serializeEventEnergy(Number(energyLow) || 3, Number(energyHigh) || 3);

  function pickEnergy(rank: number) {
    const next = pickEnergyRange(
      energyLow ? Number(energyLow) : null,
      energyHigh ? Number(energyHigh) : null,
      rank,
    );
    setEnergyLow(String(next.low));
    setEnergyHigh(String(next.high));
  }

  const previewEvent = useMemo((): VenturoEvent => {
    const mappedTickets = tickets.map((ticket, index) => {
      const priceCents = ticket.kind === "free" ? 0 : parseRandsToCents(ticket.priceRands);
      const memberPriceCents = ticketMemberCents(ticket);
      return {
        id: `preview-${index}`,
        eventId: event.id,
        name: ticket.name,
        kind: ticket.kind,
        priceCents,
        memberPriceCents,
        memberDiscountKind: ticket.discountKind,
        memberDiscountValue: ticket.discountValue ? Number(ticket.discountValue) : null,
        membersOnly: ticket.membersOnly,
        quantity: Number(ticket.quantity) || 0,
        passFeesToBuyer: ticket.passFeesToBuyer,
        passCommissionToBuyer: ticket.passCommissionToBuyer,
        soldCount: 0,
        sortOrder: index,
      };
    });
    const publicPrices = mappedTickets.filter((ticket) => !ticket.membersOnly).map((ticket) => ticket.priceCents);
    const memberPrices = mappedTickets
      .map((ticket) => ticket.memberPriceCents)
      .filter((price): price is number => price !== null);
    const membersOnly =
      mappedTickets.some((ticket) => ticket.kind !== "free") &&
      mappedTickets.filter((ticket) => ticket.kind !== "free").every((ticket) => ticket.membersOnly);

    return {
      ...event,
      title,
      description,
      ageRestriction,
      audienceGender,
      format,
      category,
      tags,
      bannerUrl: bannerUrl || null,
      listingImageUrl: listingImageUrl || null,
      storyImageUrl: storyImageUrl || null,
      startsAt: datetimeLocalToIso(startsAt),
      endsAt: datetimeLocalToIso(endsAt),
      venueName,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      city: city || null,
      postalCode: postalCode || null,
      country,
      latitude: parseCoord(latitude),
      longitude: parseCoord(longitude),
      showMap,
      visibility,
      prohibitedItems: prohibitedItems || null,
      fromPriceCents: publicPrices.length ? Math.min(...publicPrices) : membersOnly ? null : 0,
      memberFromPriceCents: memberPrices.length ? Math.min(...memberPrices) : null,
      membersOnly,
      ticketTypes: mappedTickets,
    };
  }, [
    event,
    title,
    description,
    ageRestriction,
    audienceGender,
    format,
    category,
    tags,
    bannerUrl,
    listingImageUrl,
    storyImageUrl,
    startsAt,
    endsAt,
    venueName,
    addressLine1,
    addressLine2,
    city,
    postalCode,
    country,
    latitude,
    longitude,
    showMap,
    visibility,
    prohibitedItems,
    tickets,
  ]);

  function body() {
    return {
      title,
      description,
      ageRestriction,
      audienceGender,
      format,
      category,
      tags,
      bannerUrl,
      listingImageUrl,
      storyImageUrl,
      startsAt: datetimeLocalToIso(startsAt),
      endsAt: datetimeLocalToIso(endsAt),
      venueName,
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
      latitude: parseCoord(latitude),
      longitude: parseCoord(longitude),
      visibility,
      showMap,
      prohibitedItems,
      ticketTypes: tickets.map((ticket) => ({
        name: ticket.name,
        kind: ticket.kind,
        priceCents: ticket.kind === "free" ? 0 : parseRandsToCents(ticket.priceRands),
        memberPriceCents: ticketMemberCents(ticket),
        memberDiscountKind: ticket.kind === "free" ? "none" : ticket.discountKind,
        memberDiscountValue:
          ticket.kind === "free" || ticket.discountKind === "none" || !ticket.discountValue
            ? null
            : Number(ticket.discountValue),
        membersOnly: ticket.kind !== "free" && ticket.membersOnly,
        passFeesToBuyer: ticket.kind === "paid" && ticket.passFeesToBuyer,
        passCommissionToBuyer: ticket.kind === "paid" && ticket.passCommissionToBuyer,
        quantity: Number(ticket.quantity) || 0,
      })),
    };
  }

  async function onImagePick(change: React.ChangeEvent<HTMLInputElement>, kind: EventImageKind) {
    const file = change.target.files?.[0];
    if (!file) return;
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      setError(`Keep photos under ${EVENT_IMAGE_MAX_MB} MB.`);
      change.target.value = "";
      return;
    }
    setError(null);
    setUploading(kind);
    const previous =
      kind === "banner" ? bannerUrl : kind === "listing" ? listingImageUrl : storyImageUrl;
    const localUrl = URL.createObjectURL(file);
    if (kind === "banner") setBannerUrl(localUrl);
    if (kind === "listing") setListingImageUrl(localUrl);
    if (kind === "story") setStoryImageUrl(localUrl);
    try {
      const url = await uploadEventImage(file, kind);
      if (kind === "banner") setBannerUrl(url);
      if (kind === "listing") setListingImageUrl(url);
      if (kind === "story") setStoryImageUrl(url);
    } catch (caught) {
      if (kind === "banner") setBannerUrl(previous);
      if (kind === "listing") setListingImageUrl(previous);
      if (kind === "story") setStoryImageUrl(previous);
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(localUrl), 800);
      setUploading(null);
      change.target.value = "";
    }
  }

  async function save(kind: "save" | "live") {
    setError(null);
    setNotice(null);
    setPending(kind);
    try {
      const response = await fetch(
        kind === "live" ? `/api/events/${event.id}/live` : `/api/events/${event.id}`,
        {
          method: kind === "live" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body(), stay }),
        },
      );
      const payload = (await response.json()) as {
        error?: string;
        redirect?: string;
        status?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Could not save.");
      if (payload.redirect) {
        window.location.href = payload.redirect;
        return;
      }
      setPending(null);
      setNotice(kind === "live" ? "Submitted for Control Room." : "Draft saved.");
    } catch (caught) {
      setPending(null);
      setError(caught instanceof Error ? caught.message : "Could not save.");
    }
  }

  function addTag(raw: string) {
    const value = raw.trim().replace(/^#/, "");
    if (!value) return;
    setTags((prev) => {
      if (prev.some((tag) => tag.toLowerCase() === value.toLowerCase())) return prev;
      if (prev.length >= 12) return prev;
      return [...prev, value];
    });
    setCustomTag("");
  }

  return (
    <div className="studio-shell">
      <EventPageHero
        className="studio-page-hero"
        imageUrl={bannerUrl || null}
        category={category || "Adventure & Thrills"}
        title={title || "Untitled event"}
        place={[venueName, city].filter(Boolean).join(" · ")}
        priceLabel={
          previewEvent.ticketTypes.length ? formatEventFromPrice(previewEvent.fromPriceCents) : null
        }
      />

      <header className="studio-top">
        <div className="hero-actions">
          <button className="btn btn-ghost" type="button" onClick={() => setPreviewOpen(true)}>
            Preview
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={pending !== null}
            onClick={() => void save("save")}
          >
            {pending === "save" ? "Saving" : "Save Draft"}
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={pending !== null}
            onClick={() => void save("live")}
          >
            {pending === "live" ? "Please Wait" : isStaff ? "Go Live" : "Submit To Review"}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}

      <div className="studio-layout">
        <div className="studio-main">
          <StudioSection title="Details">
            <label className="field">
              <span>Title</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} />
            </label>
            <div className="studio-when-pair">
              <StudioDateTime label="Starts" value={startsAt} onChange={setStartsAt} />
              <StudioDateTime label="Ends" value={endsAt} onChange={setEndsAt} />
            </div>
            <label className="field">
              <span>Venue</span>
              <input
                value={venueName}
                onChange={(event) => setVenueName(event.target.value)}
                placeholder="Modderfontein Reserve"
              />
            </label>
            <label className="field">
              <span>Street</span>
              <input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} />
            </label>
            <label className="field">
              <span>Address Line 2</span>
              <input value={addressLine2} onChange={(event) => setAddressLine2(event.target.value)} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Area</span>
                <input value={city} onChange={(event) => setCity(event.target.value)} />
              </label>
              <label className="field">
                <span>Postal Code</span>
                <input value={postalCode} onChange={(event) => setPostalCode(event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Country</span>
              <input value={country} onChange={(event) => setCountry(event.target.value)} />
            </label>
            <div className="field-row">
              <label className="field">
                <span>GPS Latitude</span>
                <input
                  inputMode="decimal"
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="-33.9249"
                />
              </label>
              <label className="field">
                <span>GPS Longitude</span>
                <input
                  inputMode="decimal"
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="18.4241"
                />
              </label>
            </div>
            <label className="field">
              <span>Description</span>
              <textarea
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are people walking into?"
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>Interest</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {withCurrentOption(EVENT_INTERESTS, category).map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Page Listing</span>
                <select
                  value={visibility}
                  onChange={(event) => setVisibility(event.target.value as "public" | "private")}
                >
                  <option value="public">Public</option>
                  <option value="private">Private — link only</option>
                </select>
              </label>
            </div>
            <div className="studio-personas">
              <p className="eyebrow">Persona</p>
              <p className="muted">Who this day is for. Pick as many as fit.</p>
              <div className="chips tag-list">
                {EVENT_PERSONAS.map((persona) => {
                  const on = personas.includes(persona);
                  return (
                    <button
                      key={persona}
                      type="button"
                      className={`chip${on ? " on" : ""}`}
                      aria-pressed={on}
                      onClick={() => setPersonas(toggleEventPersona(personas, persona))}
                    >
                      {persona}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="studio-energy">
              <p className="eyebrow">Vibe / Energy</p>
              <h3>How Wild Is This Day</h3>
              <p className="muted">
                Set a range on the scale—from chilled hang to full throttle. Same scale members pick
                in the app.
              </p>
              <EnergySpectrum
                scales={[...EVENT_ENERGY_SCALES]}
                energyLow={energyLow}
                energyHigh={energyHigh}
                onPick={pickEnergy}
              />
            </div>
            <label className="check">
              <input
                type="checkbox"
                checked={showMap}
                onChange={(event) => setShowMap(event.target.checked)}
              />
              Show map on the event page
            </label>
            <p className="eyebrow" style={{ marginTop: 18 }}>
              Tags
            </p>
            <div className="chips tag-list">
              {SUGGESTED_EVENT_TAGS.map((tag) => {
                const on = tags.some((item) => item.toLowerCase() === tag.toLowerCase());
                return (
                  <button
                    key={tag}
                    type="button"
                    className={`chip${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() =>
                      setTags((prev) =>
                        on
                          ? prev.filter((item) => item.toLowerCase() !== tag.toLowerCase())
                          : prev.length >= 12
                            ? prev
                            : [...prev, tag],
                      )
                    }
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            <div className="field-row">
              <label className="field">
                <span>Add A Tag</span>
                <input
                  value={customTag}
                  onChange={(event) => setCustomTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addTag(customTag);
                    }
                  }}
                />
              </label>
              <button className="btn btn-secondary" type="button" onClick={() => addTag(customTag)}>
                Add
              </button>
            </div>
          </StudioSection>

          <StudioSection title="Information">
            <label className="field">
              <span>Age Requirement</span>
              <select value={ageRestriction} onChange={(event) => setAgeRestriction(event.target.value)}>
                {AGE_OPTIONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Prohibited Items</span>
              <textarea
                rows={3}
                value={prohibitedItems}
                onChange={(event) => setProhibitedItems(event.target.value)}
                placeholder="Weapons, outside alcohol, professional cameras…"
              />
            </label>
          </StudioSection>

          <StudioSection title="Ticket Types">
            {tickets.length === 0 && <p className="notice">Add ticket types before you go live.</p>}
            <ul className="studio-tickets">
              {tickets.map((ticket, index) => (
                <TicketTypeCard
                  key={`${ticket.kind}-${index}`}
                  ticket={ticket}
                  fees={{ commissionPct, bookingFeeCents }}
                  onChange={(patch) => {
                    const next = [...tickets];
                    next[index] = { ...ticket, ...patch };
                    setTickets(next);
                  }}
                  onRemove={() => setTickets(tickets.filter((_, item) => item !== index))}
                />
              ))}
            </ul>
            {hasPaidTickets && !hasPayout ? (
              <p className="notice">
                Paid tickets need a payout bank. Set that once in{" "}
                <a href={PORTAL_SETTINGS_BANK}>Host Settings</a>—not per event.
              </p>
            ) : null}
            <div className="studio-add-ticket">
              <button className="btn btn-secondary" type="button" onClick={() => setAddOpen((open) => !open)}>
                Add
              </button>
              {addOpen && (
                <div className="studio-add-menu">
                  {(["paid", "free", "donation"] as TicketKind[]).map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => {
                        setTickets((prev) => [...prev, emptyTicket(kind)]);
                        setAddOpen(false);
                      }}
                    >
                      {kind === "paid" ? "Paid Ticket" : kind === "free" ? "Free Ticket" : "Donation"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </StudioSection>

          <StudioSection title="Appearance">
            <p className="muted">
              Event Page fills the hero above. Feed &amp; story are for What&apos;s On &amp; the app.
              Max {EVENT_IMAGE_MAX_MB} MB per photo · JPEG, PNG or WebP.
            </p>
            <div className="studio-uploads">
              {STUDIO_IMAGE_ORDER.map((kind) => {
                const spec = EVENT_IMAGE_SPECS[kind];
                const url =
                  kind === "banner" ? bannerUrl : kind === "listing" ? listingImageUrl : storyImageUrl;
                return (
                  <label key={kind} className="image-upload" data-kind={kind}>
                    <span>
                      {spec.label} · {spec.ratio}
                    </span>
                    <em>
                      {spec.size} · under {EVENT_IMAGE_MAX_MB} MB
                    </em>
                    {url ? <img src={url} alt="" /> : <span className="studio-upload-empty">{spec.hint}</span>}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(change) => void onImagePick(change, kind)}
                    />
                    {uploading === kind ? "Uploading…" : "Choose image"}
                  </label>
                );
              })}
            </div>
          </StudioSection>
        </div>

        <aside className="studio-preview">
          <p className="eyebrow">Live Preview</p>
          <EventPreview event={previewEvent} />
        </aside>
      </div>

      {previewOpen ? (
        <div className="studio-modal-wrap studio-preview-modal">
          <button className="studio-modal-backdrop" type="button" onClick={() => setPreviewOpen(false)} />
          <div className="studio-preview-sheet">
            <header className="studio-preview-sheet-top">
              <div>
                <p className="eyebrow">Preview</p>
                <h2>Your Event Page</h2>
              </div>
              <div className="hero-actions">
                <a className="btn btn-secondary" href={`/events/${event.slug}`} target="_blank" rel="noreferrer">
                  Open Event Page
                </a>
                <button className="btn btn-ghost" type="button" onClick={() => setPreviewOpen(false)}>
                  Close
                </button>
              </div>
            </header>
            <p className="muted">
              This is the live draft on this screen. Save Draft, then Open Event Page for the public
              view.
            </p>
            <EventPreview event={previewEvent} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
