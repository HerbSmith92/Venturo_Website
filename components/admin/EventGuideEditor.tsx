"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCuratedEventGuide } from "@/app/admin/event-guide-actions";
import { EventGuideActions } from "@/components/admin/EventGuideActions";
import {
  EVENT_ENERGY_SCALES,
  EVENT_INTERESTS,
  EVENT_PERSONAS,
  formatCents,
  formatEventWhen,
} from "@/lib/event-types";
import type { EventGuideEditorRecord } from "@/lib/control-room-event-guides";
import type { GuideAuthor } from "@/lib/guide-authors";
import {
  SUGGESTED_EVENT_GUIDE_TITLES,
  eventGuideAudienceLabels,
  eventGuideFillSummary,
  eventGuideHasAudience,
  type EventGuideDraft,
  type EventGuidePreview,
} from "@/lib/event-guide-shared";
import { guideStatusLabel, toZaLocalInput, type GuidePlace } from "@/lib/guide-shared";

const FALLBACK_IMAGE = "/brand/images/climbing.jpg";
const CHEAP_DATES_TITLE = "Cheap Dates This Week";

const STEPS = [
  { key: "list", label: "The List" },
  { key: "audience", label: "Audience" },
  { key: "window", label: "Window" },
  { key: "spots", label: "Recommendations" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

function windowSummary(publish: string, expire: string) {
  const short = (value: string) => value.replace("T", " ").slice(0, 16);
  if (publish && expire) return `${short(publish)} – ${short(expire)}`;
  if (publish) return `From ${short(publish)}`;
  if (expire) return `Until ${short(expire)}`;
  return "Evergreen";
}

function toggleLabel(labels: string[], label: string) {
  return labels.includes(label) ? labels.filter((item) => item !== label) : [...labels, label];
}

function toggleRank(ranks: number[], rank: number) {
  return ranks.includes(rank) ? ranks.filter((item) => item !== rank) : [...ranks, rank].sort((a, b) => a - b);
}

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} & ${labels[labels.length - 1]}`;
}

function areaLabel(event: EventGuidePreview | null) {
  if (!event) return "Event missing";
  return [event.venueName, event.city].filter(Boolean).join(", ") || "South Africa";
}

export function EventGuideEditor({
  guide,
  notice,
  error,
  places,
  authors = [],
  canPublish = true,
  lockAuthor = false,
}: {
  guide: EventGuideEditorRecord;
  notice?: string;
  error?: string;
  places: GuidePlace[];
  authors?: GuideAuthor[];
  canPublish?: boolean;
  lockAuthor?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const dragId = useRef<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [eventQuery, setEventQuery] = useState("");
  const [eventResults, setEventResults] = useState<EventGuidePreview[]>([]);
  const [searching, setSearching] = useState(false);
  const [pickerFor, setPickerFor] = useState<"new" | string | null>(null);
  const [titlesOpen, setTitlesOpen] = useState(true);
  const savedPlace = places.find((place) => place.id === guide.place_id) ?? null;
  const savedAmount = guide.max_price_cents != null ? Math.round(guide.max_price_cents / 100) : null;
  const [priceOn, setPriceOn] = useState(Boolean(savedAmount));
  const [priceAmount, setPriceAmount] = useState(savedAmount ?? 200);
  const [amountText, setAmountText] = useState(String(savedAmount ?? 200));
  const [placeId, setPlaceId] = useState(savedPlace?.id ?? "");
  const [fillKey, setFillKey] = useState(0);
  const [filling, setFilling] = useState(false);
  const [matchNote, setMatchNote] = useState("");
  const fillSkip = useRef(true);
  const placesRef = useRef(places);
  placesRef.current = places;
  const [activeStep, setActiveStep] = useState<StepKey>("list");
  const [openSteps, setOpenSteps] = useState<Record<StepKey, boolean>>({
    list: true,
    audience:
      guide.interest_labels.length > 0 ||
      guide.persona_labels.length > 0 ||
      guide.energy_ranks.length > 0,
    window: Boolean(guide.publish_at || guide.expire_at),
    spots: true,
  });
  const [draft, setDraft] = useState<EventGuideDraft>(() => ({
    title: guide.title === "Untitled Event Guide" ? "" : guide.title,
    intro: guide.intro ?? "",
    body: guide.body ?? "",
    shape: guide.shape === "spotlight" ? "spotlight" : "roundup",
    author_id: guide.author_id ?? "",
    publish_at: toZaLocalInput(guide.publish_at),
    expire_at: toZaLocalInput(guide.expire_at),
    interest_labels: guide.interest_labels,
    persona_labels: guide.persona_labels,
    energy_ranks: guide.energy_ranks,
    items: guide.items,
  }));

  const audienceKey = [
    [...draft.interest_labels].sort().join(","),
    [...draft.persona_labels].sort().join(","),
    [...draft.energy_ranks].sort().join(","),
  ].join("|");
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const fillSnapshot = useRef({ audienceKey, fillKey, placeId, priceAmount, priceOn });

  const pickerEvents = useMemo(
    () => eventResults.filter((event) => !draft.items.some((item) => item.event_id === event.id)),
    [draft.items, eventResults],
  );

  useEffect(() => {
    if (!pickerFor) return;
    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (eventQuery.trim()) params.set("q", eventQuery.trim());
        const res = await fetch(`/api/admin/event-guides/events?${params.toString()}`);
        const body = (await res.json()) as { events?: EventGuidePreview[] };
        if (!cancelled) setEventResults(body.events ?? []);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [eventQuery, pickerFor]);

  useEffect(() => {
    const previous = fillSnapshot.current;
    const audienceOnly =
      previous.audienceKey !== audienceKey &&
      previous.fillKey === fillKey &&
      previous.placeId === placeId &&
      previous.priceAmount === priceAmount &&
      previous.priceOn === priceOn;
    fillSnapshot.current = { audienceKey, fillKey, placeId, priceAmount, priceOn };
    if (fillSkip.current) {
      fillSkip.current = false;
      return;
    }
    const place = placesRef.current.find((item) => item.id === placeId) ?? null;
    const amount = priceOn ? Math.round(priceAmount) : null;
    const hasAmount = amount != null && Number.isFinite(amount) && amount > 0;
    const audience = draftRef.current;
    const hasAudience = eventGuideHasAudience({
      interestLabels: audience.interest_labels,
      personaLabels: audience.persona_labels,
      energyRanks: audience.energy_ranks,
    });
    if (!hasAmount && !place && !hasAudience) return;
    if (priceOn && !hasAmount) return;
    const scrollToList = !audienceOnly;

    let cancelled = false;
    const handle = window.setTimeout(async () => {
      setFilling(true);
      try {
        const params = new URLSearchParams({ fill: "1" });
        if (hasAmount) params.set("maxPrice", String(amount));
        if (place) {
          params.set("lat", String(place.lat));
          params.set("lng", String(place.lng));
        }
        if (audience.interest_labels.length) params.set("interests", audience.interest_labels.join(","));
        if (audience.persona_labels.length) params.set("personas", audience.persona_labels.join(","));
        if (audience.energy_ranks.length) params.set("energy", audience.energy_ranks.join(","));
        const res = await fetch(`/api/admin/event-guides/events?${params.toString()}`);
        const body = (await res.json()) as {
          events?: EventGuidePreview[];
          total?: number;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setMatchNote(body.error || "Those events could not be loaded.");
          return;
        }
        const events = body.events ?? [];
        const total = body.total ?? events.length;
        setDraft((current) => ({
          ...current,
          items: (current.shape === "spotlight" ? events.slice(0, 1) : events).map((event) => ({
            event_id: event.id,
            editorial_note:
              current.items.find((item) => item.event_id === event.id)?.editorial_note ?? "",
            event,
          })),
        }));
        const labels = eventGuideAudienceLabels({
          interestLabels: audience.interest_labels,
          personaLabels: audience.persona_labels,
          energyRanks: audience.energy_ranks,
        });
        setMatchNote(
          eventGuideFillSummary(
            events.length,
            total,
            hasAmount ? amount : null,
            place?.name ?? null,
            joinLabels(labels) || null,
          ),
        );
        setOpenSteps((current) => ({ ...current, spots: true }));
        setSaveNotice(null);
        if (scrollToList) {
          setActiveStep("spots");
          document.getElementById("step-spots")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } catch {
        if (!cancelled) setMatchNote("Those events could not be loaded.");
      } finally {
        if (!cancelled) setFilling(false);
      }
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [audienceKey, fillKey, placeId, priceAmount, priceOn]);

  function patch(partial: Partial<EventGuideDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setSaveNotice(null);
  }

  function addEvent(event: EventGuidePreview) {
    if (draft.items.some((item) => item.event_id === event.id)) return;
    if (pickerFor && pickerFor !== "new") {
      patch({
        items: draft.items.map((item) =>
          item.event_id === pickerFor
            ? { event_id: event.id, editorial_note: item.editorial_note, event }
            : item,
        ),
      });
    } else if (draft.shape === "spotlight") {
      patch({
        items: [{ event_id: event.id, editorial_note: "", event }],
      });
    } else {
      patch({
        items: [...draft.items, { event_id: event.id, editorial_note: "", event }],
      });
    }
    setPickerFor(null);
    setEventQuery("");
  }

  function removeItem(eventId: string) {
    patch({ items: draft.items.filter((item) => item.event_id !== eventId) });
  }

  function reorder(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = draft.items.findIndex((item) => item.event_id === fromId);
    const toIndex = draft.items.findIndex((item) => item.event_id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...draft.items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    patch({ items: next });
  }

  function moveItem(eventId: string, direction: -1 | 1) {
    const fromIndex = draft.items.findIndex((item) => item.event_id === eventId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= draft.items.length) return;
    reorder(eventId, draft.items[toIndex].event_id);
  }

  function onSave() {
    setSaveError(null);
    startTransition(async () => {
      const amount = priceOn ? Math.round(priceAmount) : null;
      const result = await saveCuratedEventGuide(guide.id, {
        title: draft.title,
        intro: draft.intro,
        body: draft.shape === "spotlight" ? "" : draft.body,
        shape: draft.shape,
        author_id: draft.author_id,
        publish_at: draft.publish_at,
        expire_at: draft.expire_at,
        max_price_cents: amount != null && amount > 0 ? amount * 100 : null,
        place_id: placeId,
        interest_labels: draft.interest_labels,
        persona_labels: draft.persona_labels,
        energy_ranks: draft.energy_ranks,
        items: draft.items.map((item) => ({
          event_id: item.event_id,
          editorial_note: item.editorial_note,
        })),
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaveNotice("Guide saved.");
      router.refresh();
    });
  }

  const isNew = guide.title === "Untitled Event Guide" && guide.items.length === 0;
  const heading = draft.title.trim() || "Untitled Event Guide";
  const audienceSummary =
    joinLabels(
      eventGuideAudienceLabels({
        interestLabels: draft.interest_labels,
        personaLabels: draft.persona_labels,
        energyRanks: draft.energy_ranks,
      }),
    ) || "None yet";

  function jump(key: StepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: true }));
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function toggleStep(key: StepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: !current[key] }));
  }

  function stepOpen(key: StepKey) {
    return openSteps[key];
  }

  return (
    <div className="cr-editor-page">
      <aside className="cr-edit-nav" aria-label="Edit event guide">
        <a className="cr-edit-spine" href="/admin/event-guides">
          <span className="cr-edit-spine-mark" aria-hidden="true" />
          <span>Event Guides</span>
        </a>
        <div className="cr-edit-nav-body">
          <a className="cr-edit-brand" href="/admin/event-guides" aria-label="Event Guides">
            <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="Venturo" />
          </a>
          <p className="cr-edit-title">Event Guides</p>
          <p className="cr-edit-current">{isNew ? "New Event Guide" : "Edit Event Guide"}</p>
          <p className="cr-edit-group">Content</p>
          <p className="cr-edit-section">Event Guides</p>
          <nav className="cr-edit-steps">
            {STEPS.map((step) => (
              <button
                key={step.key}
                type="button"
                className={activeStep === step.key ? "active" : undefined}
                aria-current={activeStep === step.key ? "true" : undefined}
                onClick={() => jump(step.key)}
              >
                {step.label}
              </button>
            ))}
          </nav>
          <div className="cr-edit-actions">
            <button className="btn cr-save" type="button" onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : "Save Guide"}
            </button>
            <EventGuideActions guideId={guide.id} status={guide.status} canPublish={canPublish} />
          </div>
          <div className={guide.status === "published" ? "cr-edit-status is-live" : "cr-edit-status"}>
            <p>Guide Status</p>
            <p>{guideStatusLabel(guide.status)}</p>
          </div>
        </div>
      </aside>

      <div className="cr-editor-stage">
        <header className="cr-editor-head">
          <div>
            <p className="cr-editor-kicker">Event Guides</p>
            <h1>{heading}</h1>
          </div>
        </header>

        {(error || saveError) && <p className="error">{error || saveError}</p>}
        {(notice || saveNotice) && <p className="notice">{notice || saveNotice}</p>}

        <div className="cr-editor is-single">
          <div className="cr-paper cr-guide-editor">
            <section className={stepOpen("list") ? "cr-step is-open" : "cr-step"} id="step-list">
              <h2>
                <button
                  type="button"
                  className="cr-step-toggle"
                  aria-expanded={stepOpen("list")}
                  onClick={() => toggleStep("list")}
                >
                  <em>The List</em>
                  {!stepOpen("list") ? <small className="cr-guide-step-summary">{heading}</small> : null}
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <label className="field">
                <span>Guide Title</span>
                <input
                  value={draft.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="What’s On This Weekend"
                />
              </label>
              <div className="field-row">
                <label className="field">
                  <span>Shape</span>
                  <select
                    value={draft.shape}
                    onChange={(event) => {
                      const shape = event.target.value === "spotlight" ? "spotlight" : "roundup";
                      patch({
                        shape,
                        items: shape === "spotlight" ? draft.items.slice(0, 1) : draft.items,
                      });
                    }}
                  >
                    <option value="roundup">Round-up</option>
                    <option value="spotlight">Spotlight</option>
                  </select>
                </label>
                <label className="field">
                  <span>Author</span>
                  <select
                    value={draft.author_id}
                    disabled={lockAuthor}
                    onChange={(event) => patch({ author_id: event.target.value })}
                  >
                    <option value="">Venturo (no byline)</option>
                    {authors.map((author) => (
                      <option key={author.id} value={author.id}>
                        {author.display_name}
                        {author.tagline ? ` — ${author.tagline}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                className="cr-text-remove"
                type="button"
                onClick={() => setTitlesOpen((current) => !current)}
              >
                {titlesOpen ? "Hide suggested titles" : "Use a suggested title"}
              </button>
              {titlesOpen ? (
                <div className="cr-chip-grid" style={{ marginTop: 12 }}>
                  {SUGGESTED_EVENT_GUIDE_TITLES.map((title) => (
                    <button
                      key={title}
                      type="button"
                      className={
                        (title === CHEAP_DATES_TITLE ? priceOn : !priceOn && draft.title === title)
                          ? "cr-tag active"
                          : "cr-tag"
                      }
                      onClick={() => {
                        if (title === CHEAP_DATES_TITLE) {
                          setPriceOn(true);
                          setPriceAmount(200);
                          setAmountText("200");
                          patch({ title });
                          setFillKey((current) => current + 1);
                          return;
                        }
                        setPriceOn(false);
                        patch({ title });
                        setFillKey((current) => current + 1);
                      }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              ) : null}
              <p className="muted cr-step-help">
                Change the amount, the place, or the audience and matching upcoming events replace
                Recommendations. An event has to fit every audience group you turn on. Notes on
                events that stay are kept.
              </p>
              <div className="field-row">
                {priceOn ? (
                  <label className="field">
                    <span>At most (R)</span>
                    <input
                      type="number"
                      min={1}
                      step={50}
                      value={amountText}
                      aria-label="Maximum price in rand"
                      onChange={(event) => setAmountText(event.target.value)}
                      onBlur={() => {
                        const amount = Math.round(Number(amountText));
                        if (!Number.isFinite(amount) || amount <= 0) return;
                        setAmountText(String(amount));
                        setPriceAmount(amount);
                        setFillKey((current) => current + 1);
                      }}
                    />
                  </label>
                ) : null}
                <label className="field">
                  <span>In and around</span>
                  <select
                    value={placeId}
                    aria-label="Place"
                    onChange={(event) => {
                      if (priceOn) {
                        const amount = Math.round(Number(amountText));
                        if (Number.isFinite(amount) && amount > 0) {
                          setAmountText(String(amount));
                          setPriceAmount(amount);
                        }
                      }
                      setPlaceId(event.target.value);
                    }}
                  >
                    <option value="">Anywhere</option>
                    {places.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <p className="muted">{filling ? "Finding events…" : matchNote}</p>
              <label className="field" style={{ marginTop: 18 }}>
                <span>Short Intro (optional)</span>
                <textarea
                  rows={3}
                  value={draft.intro}
                  onChange={(e) => patch({ intro: e.target.value })}
                  placeholder="This weekend’s worth getting out for—markets, nights, & a few cheap dates."
                />
              </label>
            </section>

            <section className={stepOpen("audience") ? "cr-step is-open" : "cr-step"} id="step-audience">
              <h2>
                <button
                  type="button"
                  className="cr-step-toggle"
                  aria-expanded={stepOpen("audience")}
                  onClick={() => toggleStep("audience")}
                >
                  <em>Audience</em>
                  {!stepOpen("audience") ? (
                    <small className="cr-guide-step-summary">{audienceSummary}</small>
                  ) : null}
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <div className="cr-audience-well">
                <div className="cr-audience-group">
                  <p className="cr-about-label">Interests</p>
                  <div className="cr-chip-grid">
                    {EVENT_INTERESTS.map((label) => {
                      const active = draft.interest_labels.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          className={active ? "cr-tag active" : "cr-tag"}
                          aria-pressed={active}
                          onClick={() => patch({ interest_labels: toggleLabel(draft.interest_labels, label) })}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="cr-audience-group">
                  <p className="cr-about-label">How you go out</p>
                  <div className="cr-chip-grid">
                    {EVENT_PERSONAS.filter((label) => label !== "Everyone").map((label) => {
                      const active = draft.persona_labels.includes(label);
                      return (
                        <button
                          key={label}
                          type="button"
                          className={active ? "cr-tag active" : "cr-tag"}
                          aria-pressed={active}
                          onClick={() => patch({ persona_labels: toggleLabel(draft.persona_labels, label) })}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="cr-audience-group">
                  <p className="cr-about-label">Adventure Level</p>
                  <div className="cr-chip-grid">
                    {EVENT_ENERGY_SCALES.map((scale) => {
                      const active = draft.energy_ranks.includes(scale.rank);
                      return (
                        <button
                          key={scale.rank}
                          type="button"
                          className={active ? "cr-tag active" : "cr-tag"}
                          title={scale.subtitle}
                          aria-pressed={active}
                          onClick={() => patch({ energy_ranks: toggleRank(draft.energy_ranks, scale.rank) })}
                        >
                          {scale.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <p className="muted">
                {filling
                  ? "Finding events…"
                  : matchNote || "Turn a place, amount, or audience on to narrow Recommendations."}
              </p>
            </section>

            <section className={stepOpen("window") ? "cr-step is-open" : "cr-step"} id="step-window">
              <h2>
                <button
                  type="button"
                  className="cr-step-toggle"
                  aria-expanded={stepOpen("window")}
                  onClick={() => toggleStep("window")}
                >
                  <em>Window</em>
                  {!stepOpen("window") ? (
                    <small className="cr-guide-step-summary">
                      {windowSummary(draft.publish_at, draft.expire_at)}
                    </small>
                  ) : null}
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <p className="muted cr-step-help">
                Times are Africa/Johannesburg. Leave both empty for an evergreen list. Public pages
                still hide events that have already started.
              </p>
              <div className="field-row">
                <label className="field">
                  <span>Publish</span>
                  <input
                    type="datetime-local"
                    value={draft.publish_at}
                    onChange={(e) => patch({ publish_at: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>Expire</span>
                  <input
                    type="datetime-local"
                    value={draft.expire_at}
                    onChange={(e) => patch({ expire_at: e.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className={stepOpen("spots") ? "cr-step is-open" : "cr-step"} id="step-spots">
              <h2>
                <button
                  type="button"
                  className="cr-step-toggle"
                  aria-expanded={stepOpen("spots")}
                  onClick={() => toggleStep("spots")}
                >
                  <em>{draft.shape === "spotlight" ? "The Spot" : "Recommendations"}</em>
                  {!stepOpen("spots") ? (
                    <small className="cr-guide-step-summary">
                      {draft.items.length === 0
                        ? "None yet"
                        : draft.items.length === 1
                          ? "1 event"
                          : `${draft.items.length} events`}
                    </small>
                  ) : null}
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <p className="muted cr-step-help">
                Drag the handle to reorder. Title, time, area &amp; from-price come from the event.
              </p>
              <div className="cr-guide-items">
                {draft.items.length === 0 && (
                  <p className="muted">
                    No recommendations yet. Choose a place or audience, or add an upcoming event
                    below.
                  </p>
                )}
                {draft.items.map((item, index) => (
                  <article
                    key={item.event_id}
                    className="cr-guide-item"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId.current) reorder(dragId.current, item.event_id);
                      dragId.current = null;
                    }}
                  >
                    <button
                      type="button"
                      className="cr-guide-drag"
                      draggable
                      aria-label={`Drag to reorder ${item.event?.title ?? "event"}`}
                      onDragStart={() => {
                        dragId.current = item.event_id;
                      }}
                      onDragEnd={() => {
                        dragId.current = null;
                      }}
                    >
                      ⋮⋮
                    </button>
                    <img src={item.event?.image ?? FALLBACK_IMAGE} alt="" />
                    <div>
                      <p className="eyebrow">
                        {index + 1}. {item.event?.status === "approved" ? "Live" : "Unavailable"}
                      </p>
                      <h3>{item.event?.title ?? "Event missing"}</h3>
                      <p className="muted">
                        {item.event
                          ? formatEventWhen(item.event.startsAt, item.event.timezone)
                          : ""}
                        {item.event ? ` · ${areaLabel(item.event)}` : ""}
                        {item.event?.fromPriceCents != null
                          ? ` · From ${formatCents(item.event.fromPriceCents)}`
                          : ""}
                      </p>
                      {draft.shape === "roundup" ? (
                        <label className="field">
                          <span>Write-up</span>
                          <textarea
                            rows={4}
                            value={item.editorial_note}
                            onChange={(e) =>
                              patch({
                                items: draft.items.map((row) =>
                                  row.event_id === item.event_id
                                    ? { ...row, editorial_note: e.target.value }
                                    : row,
                                ),
                              })
                            }
                            placeholder="Why this one is worth leaving the house for."
                          />
                        </label>
                      ) : null}
                      <div className="cr-guide-item-tools">
                        <button type="button" disabled={index === 0} onClick={() => moveItem(item.event_id, -1)}>
                          Up
                        </button>
                        <button
                          type="button"
                          disabled={index === draft.items.length - 1}
                          onClick={() => moveItem(item.event_id, 1)}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSearching(true);
                            setPickerFor(item.event_id);
                            setEventQuery("");
                          }}
                        >
                          Replace
                        </button>
                        <button type="button" onClick={() => removeItem(item.event_id)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="cr-guide-picker">
                <button
                  className="cr-outline-btn"
                  type="button"
                  onClick={() => {
                    setSearching(true);
                    setPickerFor(pickerFor === "new" ? null : "new");
                    setEventQuery("");
                  }}
                >
                  {pickerFor === "new" ? "Close search" : "Add recommendation"}
                </button>
                {pickerFor && (
                  <div className="cr-guide-search">
                    <label className="field">
                      <span>{pickerFor === "new" ? "Search Upcoming Events" : "Replace With"}</span>
                      <input
                        value={eventQuery}
                        onChange={(e) => setEventQuery(e.target.value)}
                        placeholder="Search by name"
                        autoFocus
                      />
                    </label>
                    <p className="muted">
                      {searching ? "Searching…" : "Upcoming approved public events only."}
                    </p>
                    {!searching && pickerEvents.length === 0 && (
                      <p className="muted">No matching upcoming events.</p>
                    )}
                    <ul className="cr-guide-results">
                      {pickerEvents.map((event) => (
                        <li key={event.id}>
                          <button type="button" onClick={() => addEvent(event)}>
                            <strong>{event.title}</strong>
                            <span className="muted">
                              {formatEventWhen(event.startsAt, event.timezone)} · {areaLabel(event)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
