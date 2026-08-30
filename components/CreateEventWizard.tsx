"use client";

import { useMemo, useState } from "react";
import { EventPreview } from "@/components/EventPreview";
import {
  EVENT_CATEGORIES,
  EVENT_GENDERS,
  EVENT_IMAGE_SPECS,
  SUGGESTED_EVENT_TAGS,
  formatCents,
  memberPriceCentsFromDiscount,
  parseRandsToCents,
  type EventImageKind,
  type MemberDiscountKind,
  type TicketKind,
  type VenturoEvent,
} from "@/lib/event-types";

type TicketDraft = {
  name: string;
  kind: TicketKind;
  priceRands: string;
  discountKind: MemberDiscountKind;
  discountValue: string;
  membersOnly: boolean;
  quantity: string;
};

type PayoutDraft = {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  branchCode: string;
};

type ExistingPayout = {
  accountHolder: string;
  bankName: string;
  accountNumberLast4: string;
  branchCode: string | null;
} | null;

const AGE_OPTIONS = [
  "All ages",
  "No under 13s",
  "No under 16s",
  "No under 18s",
  "No under 21s",
];

const FORMAT_OPTIONS = [
  "Social Gathering",
  "Festival",
  "Workshop",
  "Performance",
  "Sports",
  "Market",
  "Networking",
  "Other",
];

const emptyTicket = (kind: TicketKind = "paid"): TicketDraft => ({
  name: kind === "free" ? "Free Ticket" : "Standard Ticket",
  kind,
  priceRands: kind === "free" ? "0.00" : "",
  discountKind: "none",
  discountValue: "",
  membersOnly: false,
  quantity: "50",
});

function ticketMemberCents(ticket: TicketDraft) {
  if (ticket.kind === "free") return null;
  const list = parseRandsToCents(ticket.priceRands);
  if (ticket.discountKind === "none") {
    return ticket.membersOnly ? list : null;
  }
  return memberPriceCentsFromDiscount(
    list,
    ticket.discountKind,
    Number(ticket.discountValue),
  );
}

function patchTicket(tickets: TicketDraft[], index: number, patch: Partial<TicketDraft>) {
  const next = [...tickets];
  next[index] = { ...tickets[index], ...patch };
  return next;
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
  isStaff,
  hasPayout,
  existingPayout,
  commissionPct,
  bookingFeeCents,
}: {
  isStaff: boolean;
  hasPayout: boolean;
  existingPayout: ExistingPayout;
  commissionPct: number;
  bookingFeeCents: number;
}) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState<EventImageKind | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ageRestriction, setAgeRestriction] = useState(AGE_OPTIONS[0]);
  const [audienceGender, setAudienceGender] = useState<string>(EVENT_GENDERS[0]);
  const [format, setFormat] = useState(FORMAT_OPTIONS[0]);
  const [category, setCategory] = useState<string>(EVENT_CATEGORIES[0]);
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [listingImageUrl, setListingImageUrl] = useState("");
  const [storyImageUrl, setStoryImageUrl] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [venueName, setVenueName] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("South Africa");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [showMap, setShowMap] = useState(true);
  const [tickets, setTickets] = useState<TicketDraft[]>([emptyTicket("paid")]);
  const [updatePayout, setUpdatePayout] = useState(!hasPayout);
  const [payout, setPayout] = useState<PayoutDraft>({
    accountHolder: existingPayout?.accountHolder ?? "",
    bankName: existingPayout?.bankName ?? "",
    accountNumber: "",
    branchCode: existingPayout?.branchCode ?? "",
  });
  const [submitForReview, setSubmitForReview] = useState(true);

  const hasPaidTickets = useMemo(
    () => tickets.some((t) => t.kind === "paid" && parseRandsToCents(t.priceRands) > 0),
    [tickets],
  );

  const houseTotals = useMemo(() => {
    let listCents = 0;
    let memberCents = 0;
    let paidCount = 0;
    let membersOnlyCount = 0;
    let hasMemberDeal = false;

    for (const ticket of tickets) {
      if (ticket.kind === "free") continue;
      const qty = Number(ticket.quantity) || 0;
      const list = parseRandsToCents(ticket.priceRands);
      const member = ticketMemberCents(ticket) ?? list;
      paidCount += 1;
      if (ticket.membersOnly) membersOnlyCount += 1;
      listCents += list * qty;
      memberCents += member * qty;
      if (ticket.membersOnly || member < list) hasMemberDeal = true;
    }

    return {
      listCents,
      memberCents,
      onlyMembers: paidCount > 0 && membersOnlyCount === paidCount,
      hasMemberDeal,
    };
  }, [tickets]);

  const previewEvent = useMemo((): VenturoEvent => {
    const mappedTickets = tickets.map((ticket, index) => {
      const priceCents = ticket.kind === "free" ? 0 : parseRandsToCents(ticket.priceRands);
      const memberPriceCents = ticketMemberCents(ticket);
      return {
        id: `preview-${index}`,
        eventId: "preview",
        name: ticket.name,
        kind: ticket.kind,
        priceCents,
        memberPriceCents,
        memberDiscountKind: ticket.discountKind,
        memberDiscountValue: ticket.discountValue ? Number(ticket.discountValue) : null,
        membersOnly: ticket.membersOnly,
        quantity: Number(ticket.quantity) || 0,
        soldCount: 0,
        sortOrder: index,
      };
    });
    const publicPrices = mappedTickets.filter((t) => !t.membersOnly).map((t) => t.priceCents);
    const memberPrices = mappedTickets
      .map((t) => t.memberPriceCents)
      .filter((p): p is number => p !== null);
    const membersOnly =
      mappedTickets.some((t) => t.kind !== "free") &&
      mappedTickets.filter((t) => t.kind !== "free").every((t) => t.membersOnly);

    return {
      id: "preview",
      slug: "",
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
      startsAt: startsAt ? new Date(startsAt).toISOString() : "",
      endsAt: endsAt ? new Date(endsAt).toISOString() : "",
      timezone: "Africa/Johannesburg",
      venueName,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      city: city || null,
      postalCode: postalCode || null,
      country,
      latitude: null,
      longitude: null,
      showMap,
      visibility,
      status: "draft",
      organiserId: "",
      reviewNote: null,
      fromPriceCents: publicPrices.length ? Math.min(...publicPrices) : membersOnly ? null : 0,
      memberFromPriceCents: memberPrices.length ? Math.min(...memberPrices) : null,
      membersOnly,
      ticketTypes: mappedTickets,
    };
  }, [
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
    showMap,
    visibility,
    tickets,
  ]);

  function addTag(raw: string) {
    const value = raw.trim().replace(/^#/, "");
    if (!value) return;
    setTags((prev) => {
      if (prev.some((tag) => tag.toLowerCase() === value.toLowerCase())) return prev;
      if (prev.length >= 12) return prev;
      return [...prev, value];
    });
  }

  function toggleSuggestedTag(tag: string) {
    setTags((prev) =>
      prev.some((item) => item.toLowerCase() === tag.toLowerCase())
        ? prev.filter((item) => item.toLowerCase() !== tag.toLowerCase())
        : prev.length >= 12
          ? prev
          : [...prev, tag],
    );
  }

  async function onImagePick(
    event: React.ChangeEvent<HTMLInputElement>,
    kind: EventImageKind,
  ) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(kind);
    try {
      const url = await uploadEventImage(file, kind);
      if (kind === "banner") setBannerUrl(url);
      if (kind === "listing") setListingImageUrl(url);
      if (kind === "story") setStoryImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(null);
      event.target.value = "";
    }
  }

  async function submit(asDraft: boolean) {
    setError(null);
    setPending(true);

    const shouldSubmit = asDraft ? false : submitForReview;
    if (hasPaidTickets && shouldSubmit && (!hasPayout || updatePayout)) {
      if (!payout.accountHolder.trim() || !payout.bankName.trim() || !payout.accountNumber.trim()) {
        setPending(false);
        setError("Add payout bank details before submitting paid tickets.");
        return;
      }
    }

    const response = await fetch("/api/events/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
        startsAt: startsAt ? new Date(startsAt).toISOString() : "",
        endsAt: endsAt ? new Date(endsAt).toISOString() : "",
        venueName,
        addressLine1,
        addressLine2,
        city,
        postalCode,
        country,
        visibility,
        showMap,
        submitForReview: shouldSubmit,
        ticketTypes: tickets.map((t) => ({
          name: t.name,
          kind: t.kind,
          priceCents: t.kind === "free" ? 0 : parseRandsToCents(t.priceRands),
          memberPriceCents: ticketMemberCents(t),
          memberDiscountKind: t.kind === "free" ? "none" : t.discountKind,
          memberDiscountValue:
            t.kind === "free" || t.discountKind === "none" || !t.discountValue
              ? null
              : Number(t.discountValue),
          membersOnly: t.kind !== "free" && t.membersOnly,
          quantity: Number(t.quantity) || 0,
        })),
        payout:
          hasPaidTickets && (updatePayout || !hasPayout) && payout.accountNumber
            ? {
                accountHolder: payout.accountHolder,
                bankName: payout.bankName,
                accountNumber: payout.accountNumber,
                branchCode: payout.branchCode,
              }
            : null,
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      redirect?: string;
    };
    setPending(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not save the event.");
      return;
    }
    window.location.href = payload.redirect ?? "/account/events";
  }

  const imageUrls: Record<EventImageKind, string> = {
    listing: listingImageUrl,
    story: storyImageUrl,
    banner: bannerUrl,
  };

  return (
    <div className="event-wizard">
      <div className="colour-bar" aria-hidden="true" />
      <div className="event-wizard-intro">
        <p className="eyebrow">Explore, Connect, Thrive</p>
        <h1>Host Your Next Adventure</h1>
        <p className="lede muted">
          Put a real plan on the map — the hike, the night out, the picnic that
          becomes a story. We&apos;ll help curious locals find it.
        </p>
      </div>

      <ol className="wizard-steps">
        <li className={step === 1 ? "active" : step > 1 ? "done" : ""}>The Plan</li>
        <li className={step === 2 ? "active" : step > 2 ? "done" : ""}>The Tickets</li>
        <li className={step === 3 ? "active" : step > 3 ? "done" : ""}>The Preview</li>
        <li className={step === 4 ? "active" : ""}>Go Live</li>
      </ol>

      {step === 1 && (
        <div className="stack-list">
          <div className="wizard-band">
            <p className="eyebrow">The Hook</p>
            <h2>What Are We Calling This?</h2>
            <div className="field-row">
              <label className="field">
                <span>Adventure Name *</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Sunrise Hike & Coffee"
                  required
                />
              </label>
              <label className="field">
                <span>Age Vibes</span>
                <select
                  value={ageRestriction}
                  onChange={(e) => setAgeRestriction(e.target.value)}
                >
                  {AGE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset className="radio-set">
              <legend>Who&apos;s Invited</legend>
              <p className="muted" style={{ marginTop: 0 }}>
                Same idea as the app profile — so the right people find the right plan.
              </p>
              <div className="tag-picker">
                {EVENT_GENDERS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`chip${audienceGender === item ? " on" : ""}`}
                    onClick={() => setAudienceGender(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field-row">
              <label className="field">
                <span>Format</span>
                <select value={format} onChange={(e) => setFormat(e.target.value)}>
                  {FORMAT_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {EVENT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="field">
              <span>Tags</span>
              <p className="muted">
                Tap a chip, or type your own. These power search on the site & in the app.
              </p>
              <div className="tag-picker">
                {SUGGESTED_EVENT_TAGS.map((tag) => {
                  const on = tags.some((item) => item.toLowerCase() === tag.toLowerCase());
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`chip${on ? " on" : ""}`}
                      onClick={() => toggleSuggestedTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
              {tags.some(
                (tag) =>
                  !SUGGESTED_EVENT_TAGS.some(
                    (suggested) => suggested.toLowerCase() === tag.toLowerCase(),
                  ),
              ) && (
                <div className="tag-picker" style={{ marginTop: 8 }}>
                  {tags
                    .filter(
                      (tag) =>
                        !SUGGESTED_EVENT_TAGS.some(
                          (suggested) => suggested.toLowerCase() === tag.toLowerCase(),
                        ),
                    )
                    .map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="chip on"
                        onClick={() => setTags((prev) => prev.filter((item) => item !== tag))}
                      >
                        {tag} ×
                      </button>
                    ))}
                </div>
              )}
              <input
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(customTag);
                    setCustomTag("");
                  }
                }}
                onBlur={() => {
                  if (customTag.trim()) {
                    addTag(customTag);
                    setCustomTag("");
                  }
                }}
                placeholder="Type another tag, then Enter"
              />
            </div>

            <label className="field">
              <span>The Story *</span>
              <textarea
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Who is this for? What makes it fun? What should people bring?"
                required
              />
            </label>
          </div>

          <div className="wizard-band">
            <p className="eyebrow">The Look</p>
            <h2>Shoot It Like You&apos;d Post It</h2>
            <p className="muted">
              Most events already live as Instagram Posts & Stories. Use those sizes
              here so the same photo works on Venturo — website, app feed, & share.
            </p>
            <div className="image-upload-grid image-upload-social">
              {(Object.keys(EVENT_IMAGE_SPECS) as EventImageKind[]).map((kind) => {
                const spec = EVENT_IMAGE_SPECS[kind];
                const url = imageUrls[kind];
                return (
                  <label className={`image-upload image-upload-${kind}`} key={kind}>
                    <span>
                      {spec.label}
                    </span>
                    <p className="muted">
                      {spec.ratio} · {spec.size}
                    </p>
                    <p className="muted">{spec.hint}</p>
                    {url ? (
                      <img src={url} alt="" className={`image-preview ratio-${kind}`} />
                    ) : (
                      <div className={`image-drop ratio-${kind}`}>
                        {uploading === kind ? "Uploading…" : `Drop a ${spec.ratio} photo`}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onImagePick(e, kind)}
                      disabled={Boolean(uploading)}
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <div className="wizard-band">
            <p className="eyebrow">When & Where</p>
            <h2>Pin It On The Map</h2>
            <p className="muted">One time slot · Africa/Johannesburg · 24-hour times</p>
            <div className="field-row">
              <label className="field">
                <span>Event start date and time *</span>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Event end date and time *</span>
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                />
              </label>
            </div>

            <label className="field">
              <span>Venue Name *</span>
              <input
                value={venueName}
                onChange={(e) => setVenueName(e.target.value)}
                placeholder="Venue name"
              />
            </label>
            <label className="field">
              <span>Address Line 1</span>
              <input
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                placeholder="Street address"
              />
            </label>
            <label className="field">
              <span>Address Line 2</span>
              <input
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                placeholder="Suburb / building"
              />
            </label>
            <div className="field-row">
              <label className="field">
                <span>City</span>
                <input value={city} onChange={(e) => setCity(e.target.value)} />
              </label>
              <label className="field">
                <span>Postal Code</span>
                <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span>Country</span>
              <input value={country} onChange={(e) => setCountry(e.target.value)} />
            </label>

            <label className="field checkbox">
              <input
                type="checkbox"
                checked={showMap}
                onChange={(e) => setShowMap(e.target.checked)}
              />
              <span>
                Show a map pin on the event page (from the address above). Switch
                it off for surprise meet-ups or invite-only spots.
              </span>
            </label>

            <fieldset className="radio-set">
              <legend>Who Can Find It *</legend>
              <label>
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === "public"}
                  onChange={() => setVisibility("public")}
                />
                <span>
                  <strong>Public</strong> — show up in What&apos;s On for curious adventurers.
                </span>
              </label>
              <label>
                <input
                  type="radio"
                  name="visibility"
                  checked={visibility === "private"}
                  onChange={() => setVisibility("private")}
                />
                <span>
                  <strong>Invite Only</strong> — people need your link to see & book.
                </span>
              </label>
            </fieldset>
          </div>

          <button
            className="btn btn-primary"
            type="button"
            onClick={() => {
              if (!title.trim() || !description.trim() || !startsAt || !endsAt || !venueName.trim()) {
                setError("Give us the name, story, times, & venue first.");
                return;
              }
              if (new Date(endsAt) < new Date(startsAt)) {
                setError("End time must be after the start time.");
                return;
              }
              setError(null);
              setStep(2);
            }}
          >
            Next · Set Tickets
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="stack-list">
          <div className="wizard-band">
            <p className="eyebrow">The Tickets</p>
            <h2>How Do People Join In?</h2>
            <p className="muted">
              Add a free RSVP or a paid ticket. Then give our members a discount —
              a percentage off, or a Rand amount. That&apos;s the perk of a paid Venturo
              membership.
              {commissionPct > 0 || bookingFeeCents > 0
                ? ` Platform fee: ${commissionPct}%${
                    bookingFeeCents ? ` + ${formatCents(bookingFeeCents)} booking` : ""
                  } (from the organiser payout).`
                : " Platform fees stay at R 0.00 while we finalise rates."}
            </p>
          </div>

          {tickets.map((ticket, index) => {
            const listCents = parseRandsToCents(ticket.priceRands);
            const memberCents = ticketMemberCents(ticket);
            return (
              <article className="ticket-editor" key={index}>
                <div className="field-row">
                  <label className="field">
                    <span>Ticket Name</span>
                    <input
                      value={ticket.name}
                      onChange={(e) =>
                        setTickets((prev) => patchTicket(prev, index, { name: e.target.value }))
                      }
                      placeholder="Ticket name"
                    />
                  </label>
                  <label className="field">
                    <span>How Many</span>
                    <input
                      type="number"
                      min="1"
                      value={ticket.quantity}
                      onChange={(e) =>
                        setTickets((prev) =>
                          patchTicket(prev, index, { quantity: e.target.value }),
                        )
                      }
                    />
                  </label>
                </div>

                {ticket.kind === "free" ? (
                  <p className="muted">Free RSVP — no money changes hands.</p>
                ) : (
                  <>
                    <label className="field">
                      <span>
                        {ticket.membersOnly ? "Member Price (R 00.00)" : "List Price (R 00.00)"}
                      </span>
                      <div className="money-input">
                        <span>R</span>
                        <input
                          inputMode="decimal"
                          value={ticket.priceRands}
                          onChange={(e) =>
                            setTickets((prev) =>
                              patchTicket(prev, index, { priceRands: e.target.value }),
                            )
                          }
                          onBlur={() => {
                            if (ticket.priceRands === "") return;
                            setTickets((prev) =>
                              patchTicket(prev, index, {
                                priceRands: (parseRandsToCents(ticket.priceRands) / 100).toFixed(2),
                              }),
                            );
                          }}
                          placeholder="0.00"
                        />
                      </div>
                    </label>

                    <fieldset className="radio-set">
                      <legend>Give Our Members A Discount</legend>
                      <div className="tag-picker">
                        {(
                          [
                            ["none", "No thanks"],
                            ["percent", "% Off"],
                            ["amount", "R Off"],
                          ] as const
                        ).map(([kind, label]) => (
                          <button
                            key={kind}
                            type="button"
                            className={`chip${ticket.discountKind === kind ? " on" : ""}`}
                            onClick={() =>
                              setTickets((prev) =>
                                patchTicket(prev, index, {
                                  discountKind: kind,
                                  discountValue: kind === "none" ? "" : ticket.discountValue,
                                }),
                              )
                            }
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                      {ticket.discountKind === "percent" && (
                        <label className="field">
                          <span>Percentage Off</span>
                          <input
                            inputMode="decimal"
                            value={ticket.discountValue}
                            onChange={(e) =>
                              setTickets((prev) =>
                                patchTicket(prev, index, { discountValue: e.target.value }),
                              )
                            }
                            placeholder="e.g. 15"
                          />
                        </label>
                      )}
                      {ticket.discountKind === "amount" && (
                        <label className="field">
                          <span>Rand Amount Off</span>
                          <div className="money-input">
                            <span>R</span>
                            <input
                              inputMode="decimal"
                              value={ticket.discountValue}
                              onChange={(e) =>
                                setTickets((prev) =>
                                  patchTicket(prev, index, { discountValue: e.target.value }),
                                )
                              }
                              placeholder="50.00"
                            />
                          </div>
                        </label>
                      )}
                      {memberCents !== null && (
                        <p className="muted">
                          Members pay {formatCents(memberCents)}
                          {listCents > memberCents
                            ? ` · save ${formatCents(listCents - memberCents)}`
                            : ""}
                          .
                        </p>
                      )}
                    </fieldset>

                    <label className="field checkbox">
                      <input
                        type="checkbox"
                        checked={ticket.membersOnly}
                        onChange={(e) =>
                          setTickets((prev) =>
                            patchTicket(prev, index, { membersOnly: e.target.checked }),
                          )
                        }
                      />
                      <span>
                        Members only — don&apos;t sell this ticket to the public. Paid
                        Venturo members get it at the member price.
                      </span>
                    </label>
                  </>
                )}

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setTickets((prev) => prev.filter((_, i) => i !== index))}
                  disabled={tickets.length === 1}
                >
                  Remove Ticket
                </button>
              </article>
            );
          })}

          <div className="hero-actions">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setTickets((prev) => [...prev, emptyTicket("paid")])}
            >
              Add Paid Ticket
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setTickets((prev) => [...prev, emptyTicket("free")])}
            >
              Add Free RSVP
            </button>
          </div>

          {houseTotals.listCents > 0 || houseTotals.memberCents > 0 ? (
            <div className="house-totals">
              {houseTotals.onlyMembers ? (
                <>
                  <p>
                    Full house at member price:{" "}
                    <strong>{formatCents(houseTotals.memberCents)}</strong>
                  </p>
                  {houseTotals.listCents > houseTotals.memberCents && (
                    <p className="muted">
                      If you sold the same tickets at list instead:{" "}
                      {formatCents(houseTotals.listCents)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Full house at list price:{" "}
                    <strong>{formatCents(houseTotals.listCents)}</strong>
                  </p>
                  {houseTotals.hasMemberDeal && houseTotals.memberCents !== houseTotals.listCents && (
                    <p className="muted">
                      Full house if every guest is a member:{" "}
                      {formatCents(houseTotals.memberCents)}
                    </p>
                  )}
                </>
              )}
            </div>
          ) : null}

          <div className="hero-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>
              Back
            </button>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => {
                if (
                  !tickets.length ||
                  tickets.some(
                    (t) =>
                      !t.name.trim() ||
                      Number(t.quantity) < 1 ||
                      (t.kind === "paid" && !(parseRandsToCents(t.priceRands) >= 0)),
                  )
                ) {
                  setError("Each ticket needs a name, quantity, & price (or Free).");
                  return;
                }
                setError(null);
                setStep(3);
              }}
            >
              Next · Preview
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="stack-list">
          <div className="wizard-band">
            <p className="eyebrow">The Preview</p>
            <h2>This Is How It Lands</h2>
            <p className="muted">
              Story, feed card, & event page — website & app share the same photos
              & fields. Tweak anything before you go live.
            </p>
          </div>
          <EventPreview event={previewEvent} />
          <div className="hero-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="btn btn-secondary" type="button" onClick={() => setStep(1)}>
              Edit The Plan
            </button>
            <button className="btn btn-primary" type="button" onClick={() => setStep(4)}>
              Looks Good · Go Live
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="stack-list">
          <div className="wizard-band">
            <p className="eyebrow">Go Live</p>
            <h2>Ready When You Are</h2>
            <p className="muted">
              Save a draft, or send it to Control Room. Paid checkout waits on PayFast
              merchant approval — free RSVPs can roll today.
            </p>
          </div>
          {hasPaidTickets ? (
            <>
              <h2>Where Should We Pay You?</h2>
              <p className="muted">Bank details for ticket payouts once PayFast is live.</p>
              {hasPayout && existingPayout && !updatePayout ? (
                <article className="plan">
                  <p>
                    <strong>{existingPayout.accountHolder}</strong>
                    <br />
                    {existingPayout.bankName} · ****{existingPayout.accountNumberLast4}
                    {existingPayout.branchCode ? ` · ${existingPayout.branchCode}` : ""}
                  </p>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setUpdatePayout(true)}
                  >
                    Update Bank Account
                  </button>
                </article>
              ) : (
                <>
                  <label className="field">
                    <span>Account Holder *</span>
                    <input
                      value={payout.accountHolder}
                      onChange={(e) =>
                        setPayout((p) => ({ ...p, accountHolder: e.target.value }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Bank Name *</span>
                    <input
                      value={payout.bankName}
                      onChange={(e) =>
                        setPayout((p) => ({ ...p, bankName: e.target.value }))
                      }
                    />
                  </label>
                  <div className="field-row">
                    <label className="field">
                      <span>Account Number *</span>
                      <input
                        value={payout.accountNumber}
                        onChange={(e) =>
                          setPayout((p) => ({ ...p, accountNumber: e.target.value }))
                        }
                        placeholder={
                          hasPayout
                            ? `•••• ${existingPayout?.accountNumberLast4 ?? ""}`
                            : undefined
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Branch Code</span>
                      <input
                        value={payout.branchCode}
                        onChange={(e) =>
                          setPayout((p) => ({ ...p, branchCode: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                  {hasPayout && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setUpdatePayout(false)}
                    >
                      Keep existing account
                    </button>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="notice">
              Free tickets only — no payout bank account needed for this event.
            </p>
          )}

          <label className="field checkbox">
            <input
              type="checkbox"
              checked={submitForReview}
              onChange={(e) => setSubmitForReview(e.target.checked)}
            />
            <span>
              {isStaff
                ? "Publish straight to What's On (staff)"
                : "Send to Control Room for a quick yes"}
            </span>
          </label>
          {!isStaff && (
            <p className="muted">
              Member hosts get a light review first — keeps the taste high for
              everyone browsing.
            </p>
          )}

          <div className="hero-actions">
            <button className="btn btn-secondary" type="button" onClick={() => setStep(3)}>
              Back To Preview
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              disabled={pending}
              onClick={() => submit(true)}
            >
              {pending ? "Please Wait" : "Save Draft"}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={pending}
              onClick={() => submit(false)}
            >
              {pending
                ? "Please Wait"
                : submitForReview
                  ? isStaff
                    ? "Publish Adventure"
                    : "Submit Adventure"
                  : "Save Draft"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="error" style={{ marginTop: 16 }}>
          {error}
        </p>
      )}
    </div>
  );
}
