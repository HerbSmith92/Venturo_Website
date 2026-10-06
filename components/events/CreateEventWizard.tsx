"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EnergySpectrum } from "@/components/EnergySpectrum";
import { StudioDateTime } from "@/components/events/StudioDateTime";
import {
  REPEAT_ORDINALS,
  REPEAT_WEEKDAYS,
  parseRepeat,
  repeatCode,
  repeatPhrase,
  weekdayFromDateInput,
} from "@/lib/event-repeat";
import type { RepeatOrdinal, RepeatWeekday } from "@/lib/event-types";
import { StudioSection } from "@/components/events/StudioSection";
import { TicketTypeCard } from "@/components/events/TicketTypeCard";
import { ticketMemberCents, type TicketFeeDraft } from "@/lib/event-fees";
import {
  EVENT_AGE_OPTIONS,
  EVENT_ENERGY_SCALES,
  EVENT_IMAGE_MAX_BYTES,
  EVENT_IMAGE_MAX_MB,
  EVENT_IMAGE_SPECS,
  EVENT_INTERESTS,
  EVENT_PERSONAS,
  datetimeLocalToIso,
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
  type PlatformFees,
  type TicketKind,
  type VenturoEvent,
} from "@/lib/event-types";
import {
  PORTAL_SETTINGS_BANK,
  portalEventHref,
  portalNewEventHref,
  type CreateEventStep,
} from "@/lib/portal";

type TicketDraft = TicketFeeDraft & {
  id?: string;
  name: string;
  kind: TicketKind;
};

const STEPS: { id: CreateEventStep; label: string }[] = [
  { id: "details", label: "1 · Event Details" },
  { id: "tickets", label: "2 · Tickets" },
  { id: "assets", label: "3 · Images" },
];

const IMAGE_ORDER: EventImageKind[] = ["story", "banner", "listing"];
const INTEREST_SET = new Set<string>(EVENT_INTERESTS);

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

function fromEventTickets(event: VenturoEvent | null): TicketDraft[] {
  if (!event?.ticketTypes.length) return [];
  return event.ticketTypes.map((ticket) => ({
    id: ticket.id,
    name: ticket.name,
    kind: ticket.kind,
    priceRands: (ticket.priceCents / 100).toFixed(2),
    discountKind: ticket.memberDiscountKind,
    discountValue: ticket.memberDiscountValue != null ? String(ticket.memberDiscountValue) : "",
    membersOnly: ticket.membersOnly,
    quantity: String(ticket.quantity),
    passFeesToBuyer: ticket.passFeesToBuyer,
    passCommissionToBuyer: ticket.passCommissionToBuyer,
  }));
}

function publicImageUrl(url: string) {
  return url.startsWith("http://") || url.startsWith("https://") ? url : "";
}

function parseCoord(value: string) {
  if (!value.trim()) return null;
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

export function CreateEventWizard({
  event,
  step,
  hasPayout,
  fees,
}: {
  event: VenturoEvent | null;
  step: CreateEventStep;
  hasPayout: boolean;
  fees: PlatformFees;
}) {
  const router = useRouter();
  const energyStart = parseEventEnergy(event?.format);
  const [eventId, setEventId] = useState(event?.id ?? null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [ageRestriction, setAgeRestriction] = useState(event?.ageRestriction || EVENT_AGE_OPTIONS[0]);
  const [personas, setPersonas] = useState(() => parseEventPersonas(event?.audienceGender));
  const [energyLow, setEnergyLow] = useState(String(energyStart.low));
  const [energyHigh, setEnergyHigh] = useState(String(energyStart.high));
  const [interests, setInterests] = useState(() => {
    const fromTags = (event?.tags ?? []).filter((tag) => INTEREST_SET.has(tag));
    if (fromTags.length) return fromTags;
    if (event?.category && INTEREST_SET.has(event.category)) return [event.category];
    return [];
  });
  const [otherTags] = useState(() => (event?.tags ?? []).filter((tag) => !INTEREST_SET.has(tag)));
  const [bannerUrl, setBannerUrl] = useState(event?.bannerUrl ?? "");
  const [listingImageUrl, setListingImageUrl] = useState(event?.listingImageUrl ?? "");
  const [storyImageUrl, setStoryImageUrl] = useState(event?.storyImageUrl ?? "");
  const [startsAt, setStartsAt] = useState(isoToDatetimeLocal(event?.startsAt));
  const [endsAt, setEndsAt] = useState(isoToDatetimeLocal(event?.endsAt));
  const savedRepeat = parseRepeat(event?.repeatEvery);
  const [repeatMode, setRepeatMode] = useState<"" | "week" | "month" | "weekday">(
    savedRepeat?.kind === "weekday" ? "weekday" : (savedRepeat?.kind ?? ""),
  );
  const [repeatOrdinal, setRepeatOrdinal] = useState<RepeatOrdinal>(
    savedRepeat?.kind === "weekday" ? savedRepeat.ordinal : "first",
  );
  const [repeatWeekday, setRepeatWeekday] = useState<RepeatWeekday>(
    savedRepeat?.kind === "weekday" ? savedRepeat.weekday : "thu",
  );
  const [repeatUntil, setRepeatUntil] = useState(isoToDatetimeLocal(event?.repeatUntil));
  const repeatEvery =
    repeatMode === "weekday" ? repeatCode(repeatOrdinal, repeatWeekday) : repeatMode;
  const [venueName, setVenueName] = useState(event?.venueName ?? "");
  const [addressLine1, setAddressLine1] = useState(event?.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(event?.addressLine2 ?? "");
  const [city, setCity] = useState(event?.city ?? "");
  const [postalCode, setPostalCode] = useState(event?.postalCode ?? "");
  const [country, setCountry] = useState(event?.country || "South Africa");
  const latitude = event?.latitude != null ? String(event.latitude) : "";
  const longitude = event?.longitude != null ? String(event.longitude) : "";
  const [visibility, setVisibility] = useState<"public" | "private">(event?.visibility ?? "public");
  const showMap = event?.showMap ?? false;
  const prohibitedItems = event?.prohibitedItems ?? "";
  const parking = event?.parking ?? "";
  const [tickets, setTickets] = useState<TicketDraft[]>(() => fromEventTickets(event));
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState<EventImageKind | null>(null);

  useEffect(() => {
    if (step !== "tickets") return;
    setTickets((prev) => (prev.length ? prev : [emptyTicket()]));
  }, [step]);

  function pickEnergy(rank: number) {
    const next = pickEnergyRange(
      energyLow ? Number(energyLow) : null,
      energyHigh ? Number(energyHigh) : null,
      rank,
    );
    setEnergyLow(String(next.low));
    setEnergyHigh(String(next.high));
  }

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((item) => item !== interest) : [...prev, interest],
    );
  }

  function ticketRows() {
    if (step === "tickets" && tickets.length === 0) return [emptyTicket()];
    return tickets;
  }

  function validateDetails() {
    if (!title.trim()) return "Give the event a name.";
    const startIso = datetimeLocalToIso(startsAt);
    const endIso = datetimeLocalToIso(endsAt);
    if (!startIso || !endIso) return "Add a start & end.";
    if (new Date(endIso).getTime() < new Date(startIso).getTime()) {
      return "End time must be after the start.";
    }
    if (repeatEvery) {
      const untilIso = datetimeLocalToIso(repeatUntil);
      if (!untilIso) return "Choose when the repeat ends.";
      if (new Date(untilIso).getTime() < new Date(startIso).getTime()) {
        return "The last date must be on or after the start.";
      }
      const yearLater = new Date(startIso);
      yearLater.setUTCFullYear(yearLater.getUTCFullYear() + 1);
      if (new Date(untilIso).getTime() > yearLater.getTime()) return "Keep a repeat within one year.";
    }
    if (!interests.length) return "Pick at least one interest.";
    if (!description.trim()) return "Add a description.";
    if (!venueName.trim()) return "Add the location.";
    return null;
  }

  function validateTickets(rows = ticketRows()) {
    if (!rows.length) return "Add at least one ticket.";
    for (const ticket of rows) {
      if (!ticket.name.trim()) return "Name each ticket.";
      const qty = Number(ticket.quantity);
      if (!Number.isFinite(qty) || qty < 1) return "Set how many tickets are available.";
    }
    return null;
  }

  function buildBody(rows: TicketDraft[]) {
    const tags = [...interests, ...otherTags].slice(0, 12);
    return {
      title: title.trim(),
      description: description.trim(),
      ageRestriction,
      audienceGender: serializeEventPersonas(personas),
      format: serializeEventEnergy(Number(energyLow) || 3, Number(energyHigh) || 3),
      category: interests[0] ?? "",
      tags,
      bannerUrl: publicImageUrl(bannerUrl),
      listingImageUrl: publicImageUrl(listingImageUrl),
      storyImageUrl: publicImageUrl(storyImageUrl),
      startsAt: datetimeLocalToIso(startsAt),
      endsAt: datetimeLocalToIso(endsAt),
      repeatEvery: repeatEvery || null,
      repeatUntil: repeatEvery ? datetimeLocalToIso(repeatUntil) : null,
      venueName: venueName.trim(),
      addressLine1,
      addressLine2,
      city,
      postalCode,
      country,
      latitude: parseCoord(latitude),
      longitude: parseCoord(longitude),
      visibility,
      showMap,
      parking,
      prohibitedItems,
      ticketTypes: rows.map((ticket) => ({
        id: ticket.id,
        name: ticket.name,
        kind: ticket.kind,
        priceCents: ticket.kind === "free" ? 0 : parseRandsToCents(ticket.priceRands),
        memberPriceCents: ticketMemberCents(ticket),
        memberDiscountKind: (ticket.kind === "free" ? "none" : ticket.discountKind) as MemberDiscountKind,
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

  async function persist(target: CreateEventStep | "menu", rows = ticketRows()) {
    setError(null);
    setPending(true);
    try {
      let id = eventId;
      if (!id) {
        const created = await fetch("/api/events/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), stay: "portal" }),
        });
        const createdPayload = (await created.json()) as { error?: string; id?: string };
        if (!created.ok || !createdPayload.id) {
          throw new Error(createdPayload.error ?? "Could not create event.");
        }
        id = createdPayload.id;
        setEventId(id);
      }
      const saved = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(rows)),
      });
      const savedPayload = (await saved.json()) as { error?: string };
      if (!saved.ok) throw new Error(savedPayload.error ?? "Could not save event.");
      if (target === "menu") {
        window.location.href = portalEventHref(id);
        return;
      }
      router.push(portalNewEventHref(id, target));
      setPending(false);
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not save event.");
    }
  }

  function continueForward() {
    if (pending || uploading) return;
    if (step === "details") {
      const issue = validateDetails();
      if (issue) {
        setError(issue);
        return;
      }
      void persist("tickets");
      return;
    }
    if (step === "tickets") {
      const rows = ticketRows();
      const issue = validateTickets(rows);
      if (issue) {
        setError(issue);
        return;
      }
      if (tickets.length === 0) setTickets(rows);
      void persist("assets", rows);
      return;
    }
    void persist("menu");
  }

  function goBack() {
    if (pending || uploading || !eventId) return;
    if (step === "assets") {
      void persist("tickets");
      return;
    }
    if (step === "tickets") {
      const issue = validateTickets();
      if (issue) {
        setError(null);
        router.push(portalNewEventHref(eventId, "details"));
        return;
      }
      void persist("details");
    }
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
      const nextBanner = kind === "banner" ? url : bannerUrl;
      const nextListing = kind === "listing" ? url : listingImageUrl;
      const nextStory = kind === "story" ? url : storyImageUrl;
      if (kind === "banner") setBannerUrl(url);
      if (kind === "listing") setListingImageUrl(url);
      if (kind === "story") setStoryImageUrl(url);
      if (eventId) {
        const saved = await fetch(`/api/events/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...buildBody(tickets),
            bannerUrl: publicImageUrl(nextBanner),
            listingImageUrl: publicImageUrl(nextListing),
            storyImageUrl: publicImageUrl(nextStory),
          }),
        });
        const savedPayload = (await saved.json()) as { error?: string };
        if (!saved.ok) throw new Error(savedPayload.error ?? "Could not save the image.");
      }
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

  const hasPaidTickets = ticketRows().some(
    (ticket) => ticket.kind === "paid" && parseRandsToCents(ticket.priceRands) > 0,
  );
  const continueLabel =
    step === "details" ? "Continue To Tickets" : step === "tickets" ? "Continue To Images" : "Save Draft";

  return (
    <div className="studio-shell create-wizard">
      <p className="eyebrow">Event Host</p>
      <h1>Create Event</h1>
      <p className="lede muted">One date. This stays a draft until you submit it from the event menu.</p>
      <div className="chips host-settings-tabs" role="tablist" aria-label="Create event">
        {STEPS.map((item) => (
          <span
            key={item.id}
            className={`chip${step === item.id ? " on" : ""}`}
            aria-current={step === item.id ? "step" : undefined}
          >
            {item.label}
          </span>
        ))}
      </div>

      {error && <p className="error">{error}</p>}

      {step === "details" ? (
        <StudioSection title="Event Details">
          <label className="field">
            <span>Event Name</span>
            <input
              value={title}
              onChange={(change) => setTitle(change.target.value)}
              maxLength={120}
              required
              placeholder="Event Name"
            />
          </label>
          <p className="muted">Pick a start &amp; an end on the calendar. Times are 24-hour.</p>
          <div className="studio-when-pair">
            <StudioDateTime label="Start Date" value={startsAt} onChange={setStartsAt} />
            <StudioDateTime label="End Date" value={endsAt} onChange={setEndsAt} />
          </div>
          <label className="field">
            <span>Repeat</span>
            <select
              value={repeatMode}
              onChange={(change) => {
                const mode = change.target.value as "" | "week" | "month" | "weekday";
                setRepeatMode(mode);
                if (mode === "weekday") setRepeatWeekday(weekdayFromDateInput(startsAt));
              }}
            >
              <option value="">Does not repeat</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
              <option value="weekday">A set weekday</option>
            </select>
          </label>
          {repeatMode === "weekday" ? (
            <>
              <div className="field-row">
                <label className="field">
                  <span>Which</span>
                  <select
                    value={repeatOrdinal}
                    onChange={(change) => setRepeatOrdinal(change.target.value as RepeatOrdinal)}
                  >
                    {REPEAT_ORDINALS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Day</span>
                  <select
                    value={repeatWeekday}
                    onChange={(change) => setRepeatWeekday(change.target.value as RepeatWeekday)}
                  >
                    {REPEAT_WEEKDAYS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="muted">{repeatPhrase(repeatCode(repeatOrdinal, repeatWeekday))}.</p>
            </>
          ) : null}
          {repeatMode ? (
            <StudioDateTime label="Repeat Until" value={repeatUntil} onChange={setRepeatUntil} dateOnly />
          ) : null}
          <label className="field">
            <span>Description</span>
            <textarea
              rows={6}
              value={description}
              onChange={(change) => setDescription(change.target.value)}
              placeholder="What are people walking into?"
            />
          </label>
          <label className="field">
            <span>Location</span>
            <input
              value={venueName}
              onChange={(change) => setVenueName(change.target.value)}
              placeholder="Location"
            />
          </label>
          <label className="field">
            <span>Street</span>
            <input value={addressLine1} onChange={(change) => setAddressLine1(change.target.value)} />
          </label>
          <label className="field">
            <span>Address Line 2</span>
            <input value={addressLine2} onChange={(change) => setAddressLine2(change.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Area</span>
              <input value={city} onChange={(change) => setCity(change.target.value)} />
            </label>
            <label className="field">
              <span>Postal Code</span>
              <input value={postalCode} onChange={(change) => setPostalCode(change.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Country</span>
            <input value={country} onChange={(change) => setCountry(change.target.value)} />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Age Restriction</span>
              <select
                value={ageRestriction}
                onChange={(change) => setAgeRestriction(change.target.value)}
              >
                {withCurrentOption(EVENT_AGE_OPTIONS, ageRestriction).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Public Or Private</span>
              <select
                value={visibility}
                onChange={(change) => setVisibility(change.target.value as "public" | "private")}
              >
                <option value="public">Public</option>
                <option value="private">Private — link only</option>
              </select>
            </label>
          </div>
          <div className="studio-personas">
            <p className="eyebrow">Interests</p>
            <p className="muted">What this day is about. Pick as many as fit.</p>
            <div className="chips tag-list">
              {EVENT_INTERESTS.map((interest) => {
                const on = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    type="button"
                    className={`chip${on ? " on" : ""}`}
                    aria-pressed={on}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
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
            <p className="eyebrow">Adventure Level</p>
            <h3>How Wild Is This Day</h3>
            <p className="muted">
              From a chilled hang to full throttle. Same scale members pick in the app.
            </p>
            <EnergySpectrum
              scales={[...EVENT_ENERGY_SCALES]}
              energyLow={energyLow}
              energyHigh={energyHigh}
              onPick={pickEnergy}
            />
          </div>
        </StudioSection>
      ) : null}

      {step === "tickets" ? (
        <StudioSection title="Tickets">
          <p className="muted">Each ticket&apos;s quantity is how many you can sell of that type.</p>
          <ul className="studio-tickets">
            {ticketRows().map((ticket, index) => (
              <TicketTypeCard
                key={`${ticket.kind}-${index}`}
                ticket={ticket}
                fees={fees}
                onChange={(patch) => {
                  const next = [...ticketRows()];
                  next[index] = { ...ticket, ...patch };
                  setTickets(next);
                }}
                onRemove={() => setTickets(ticketRows().filter((_, item) => item !== index))}
              />
            ))}
          </ul>
          {hasPaidTickets && !hasPayout ? (
            <p className="notice">
              Paid tickets need a payout bank before this event can go live. Set that once in{" "}
              <a href={PORTAL_SETTINGS_BANK}>Host Settings</a>.
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
                      setTickets((prev) => [...(prev.length ? prev : ticketRows()), emptyTicket(kind)]);
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
      ) : null}

      {step === "assets" ? (
        <StudioSection title="Event Images">
          <p className="muted">
            Story 9:16, event page 16:9, and feed post 4:5. Max {EVENT_IMAGE_MAX_MB} MB per photo ·
            JPEG, PNG or WebP.
          </p>
          <div className="studio-uploads">
            {IMAGE_ORDER.map((kind) => {
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
      ) : null}

      <div className="create-wizard-actions">
        {step !== "details" ? (
          <button className="btn btn-secondary" type="button" disabled={pending || Boolean(uploading)} onClick={goBack}>
            Back
          </button>
        ) : null}
        <button
          className="btn btn-primary"
          type="button"
          disabled={pending || Boolean(uploading)}
          onClick={continueForward}
        >
          {pending ? "Please Wait" : continueLabel}
        </button>
      </div>
    </div>
  );
}
