"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteListingPhoto,
  saveListingDraft,
  uploadListingPhoto,
} from "@/app/admin/actions";
import { ListingActions } from "@/components/admin/ListingActions";
import type { ListingDetail } from "@/lib/control-room-types";
import {
  formatClock,
  formatDay,
  formatRand,
  listingStatusLabel,
  type AuditEvent,
} from "@/lib/control-room-shared";
import {
  APPLIES_TO_OPTIONS,
  PRICE_CATEGORY_OPTIONS,
  WHO_COMES_PERSONAS,
  activeMedia,
  auditLabel,
  completeness,
  emptyActivity,
  emptyPrice,
  formatPreviewRand,
  listingToDraft,
  previewHours,
  previewPrices,
  statusLegend,
  type DraftActivity,
  type DraftMedia,
  type DraftPrice,
  type EditorBranch,
  type EditorCatalog,
  type ListingDraft,
  type StepKey,
} from "@/lib/listing-draft";

function toggleId(ids: string[], id: string, max?: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (max !== undefined && ids.length >= max) return ids;
  return [...ids, id];
}

function inclusionBullets(text: string) {
  return text
    .split(/\n|•|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function PhonePreview({
  draft,
  listing,
  catalog,
}: {
  draft: ListingDraft;
  listing: ListingDetail;
  catalog: EditorCatalog;
}) {
  const [descOpen, setDescOpen] = useState(false);
  const hours = previewHours(draft);
  const prices = previewPrices(draft, 4);
  const media = activeMedia(draft);
  const cover =
    media.find((item) => item.id === draft.cover_media_id)?.public_url ??
    media[0]?.public_url ??
    null;
  const kinds = catalog.kinds.filter((kind) => draft.kind_ids.includes(kind.id));
  const address = [
    draft.street_address_1,
    draft.suburb,
    draft.city,
    draft.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const rating =
    listing.google_rating != null && Number.isFinite(Number(listing.google_rating))
      ? Number(listing.google_rating).toFixed(1)
      : null;
  const description = draft.description || draft.short_description || "";
  const shortDesc =
    description.length > 140 && !descOpen
      ? `${description.slice(0, 140).trim()}…`
      : description;

  return (
    <aside className="cr-phone-wrap" aria-label="App preview">
      <p className="cr-phone-label">Discover Info Preview</p>
      <div className="cr-phone cr-phone-discover">
        <div className="cr-phone-notch" />
        <div className="cr-phone-hero">
          {cover ? (
            <img src={cover} alt="" />
          ) : (
            <div className="cr-phone-hero-empty">No cover yet</div>
          )}
          <span className="cr-phone-see-all">See all images</span>
        </div>
        <div className="cr-phone-body">
          <h3>{draft.name || "Listing name"}</h3>
          {kinds.length > 0 && (
            <div className="cr-phone-chips">
              {kinds.map((kind) => (
                <span key={kind.id}>{kind.title}</span>
              ))}
            </div>
          )}
          {rating && (
            <p className="cr-phone-rating">
              <span aria-hidden="true">★</span> {rating}
            </p>
          )}
          <div className="cr-phone-tabs" aria-hidden="true">
            <span className="active">Info</span>
            <span>Reviews</span>
          </div>

          <h4>Description</h4>
          <p className="cr-phone-copy">
            {shortDesc || "Description shows here."}
            {description.length > 140 && (
              <>
                {" "}
                <button type="button" onClick={() => setDescOpen((open) => !open)}>
                  {descOpen ? "See Less" : "See More"}
                </button>
              </>
            )}
          </p>

          <h4>Cost</h4>
          <p className="cr-phone-cost-hint">Show your app at checkout to claim your discount.</p>
          <div className="cr-phone-cost-list">
            {prices.length === 0 && <p className="cr-phone-muted">Add member prices to preview.</p>}
            {prices.map((row, index) => (
              <article className="cr-phone-cost-card" key={`${row.name}-${index}`}>
                <div className="cr-phone-cost-top">
                  <div>
                    <strong>{row.name}</strong>
                    {row.save != null && (
                      <em>Save {formatPreviewRand(row.save)}</em>
                    )}
                  </div>
                  <div className="cr-phone-cost-prices">
                    {row.standard != null && (
                      <span className={row.member != null ? "struck" : undefined}>
                        {formatPreviewRand(row.standard)}
                      </span>
                    )}
                    {row.member != null && (
                      <b>{formatPreviewRand(row.member)}</b>
                    )}
                  </div>
                </div>
                {row.inclusions && (
                  <ul>
                    {inclusionBullets(row.inclusions).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          <h4>Operating Hours</h4>
          <ul className="cr-phone-hours">
            {hours.map((row) => (
              <li key={row.day}>
                <span>{row.day}</span>
                <span>{row.hours}</span>
              </li>
            ))}
          </ul>

          <h4>Map Location</h4>
          <div className="cr-phone-map">
            <p>{address || "Add a street address to preview the map pin."}</p>
          </div>
        </div>
        <nav className="cr-phone-nav" aria-hidden="true">
          <span>Calendar</span>
          <span>Search</span>
          <span className="active">Discover</span>
          <span>Community</span>
          <span>Profile</span>
        </nav>
      </div>
    </aside>
  );
}

export function ListingEditor({
  listing,
  catalog,
  branches,
  audit,
  notice,
  error,
}: {
  listing: ListingDetail;
  catalog: EditorCatalog;
  branches: EditorBranch[];
  audit: AuditEvent[];
  notice?: string;
  error?: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragMediaId = useRef<string | null>(null);
  const [draft, setDraft] = useState(() => listingToDraft(listing));
  const [interestQuery, setInterestQuery] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [photoPending, setPhotoPending] = useState(false);

  const progress = completeness(draft);
  const legend = statusLegend(listing.status);
  const media = activeMedia(draft);

  const whoComes = useMemo(() => {
    return WHO_COMES_PERSONAS.map((item) => {
      const persona = catalog.personas.find((row) => row.title === item.title);
      return persona ? { ...item, id: persona.id } : null;
    }).filter((row): row is { title: string; label: string; id: string } => Boolean(row));
  }, [catalog.personas]);

  const selectedInterests = useMemo(
    () => catalog.interests.filter((item) => draft.interest_ids.includes(item.id)),
    [catalog.interests, draft.interest_ids],
  );

  const interestResults = useMemo(() => {
    const q = interestQuery.trim().toLowerCase();
    const primaryKindId = draft.kind_ids[0];
    const primaryKind = catalog.kinds.find((kind) => kind.id === primaryKindId);

    if (q.length >= 1) {
      return catalog.interests
        .filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.kind_title.toLowerCase().includes(q),
        )
        .slice(0, 24);
    }

    if (primaryKind) {
      return catalog.interests
        .filter((item) => item.kind_key === primaryKind.key)
        .slice(0, 16);
    }

    return [];
  }, [catalog.interests, catalog.kinds, draft.kind_ids, interestQuery]);

  function patch(partial: Partial<ListingDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setSaveNotice(null);
  }

  function patchActivity(clientKey: string, partial: Partial<DraftActivity>) {
    setDraft((current) => ({
      ...current,
      activities: current.activities.map((row) =>
        row.clientKey === clientKey ? { ...row, ...partial } : row,
      ),
    }));
    setSaveNotice(null);
  }

  function patchPrice(
    activityKey: string,
    priceKey: string,
    partial: Partial<DraftPrice>,
  ) {
    setDraft((current) => ({
      ...current,
      activities: current.activities.map((activity) => {
        if (activity.clientKey !== activityKey) return activity;
        return {
          ...activity,
          prices: activity.prices.map((price) =>
            price.clientKey === priceKey ? { ...price, ...partial } : price,
          ),
        };
      }),
    }));
    setSaveNotice(null);
  }

  function patchHour(index: number, partial: Partial<ListingDraft["hours"][number]>) {
    setDraft((current) => ({
      ...current,
      hours: current.hours.map((row, i) => (i === index ? { ...row, ...partial } : row)),
    }));
    setSaveNotice(null);
  }

  function patchSocial(platform: ListingDraft["social"][number]["platform"], handle: string) {
    setDraft((current) => ({
      ...current,
      social: current.social.map((row) =>
        row.platform === platform ? { ...row, handle, url: "" } : row,
      ),
    }));
    setSaveNotice(null);
  }

  function jump(key: StepKey) {
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function onSave() {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveListingDraft(listing.id, draft);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaveNotice("Draft saved.");
      router.refresh();
    });
  }

  function addActivity() {
    setDraft((current) => ({
      ...current,
      activities: [
        ...current.activities,
        emptyActivity(`Activity ${current.activities.length + 1}`, current.activities.length),
      ],
    }));
  }

  function removeActivity(clientKey: string) {
    setDraft((current) => {
      const next = current.activities.filter((row) => row.clientKey !== clientKey);
      return {
        ...current,
        activities: next.length ? next : [emptyActivity(current.name || "General", 0)],
      };
    });
  }

  function addPrice(activityKey: string) {
    setDraft((current) => ({
      ...current,
      activities: current.activities.map((activity) => {
        if (activity.clientKey !== activityKey) return activity;
        return {
          ...activity,
          prices: [...activity.prices, emptyPrice(activity.prices.length)],
        };
      }),
    }));
  }

  function removePrice(activityKey: string, priceKey: string) {
    setDraft((current) => ({
      ...current,
      activities: current.activities.map((activity) => {
        if (activity.clientKey !== activityKey) return activity;
        const prices = activity.prices.filter((price) => price.clientKey !== priceKey);
        return {
          ...activity,
          prices: prices.length ? prices : [emptyPrice(0)],
        };
      }),
    }));
  }

  function setCover(mediaId: string) {
    setDraft((current) => ({
      ...current,
      cover_media_id: mediaId,
      media: current.media.map((row) => ({
        ...row,
        is_cover: row.id === mediaId,
      })),
    }));
  }

  function reorderMedia(fromId: string, toId: string) {
    if (fromId === toId) return;
    setDraft((current) => {
      const visible = current.media.filter((row) => !row._delete);
      const fromIndex = visible.findIndex((row) => row.id === fromId);
      const toIndex = visible.findIndex((row) => row.id === toId);
      if (fromIndex < 0 || toIndex < 0) return current;
      const nextVisible = [...visible];
      const [moved] = nextVisible.splice(fromIndex, 1);
      nextVisible.splice(toIndex, 0, moved);
      const ordered = nextVisible.map((row, index) => ({ ...row, sort_order: index }));
      const deleted = current.media.filter((row) => row._delete);
      return { ...current, media: [...ordered, ...deleted] };
    });
  }

  async function onUploadFiles(files: FileList | null) {
    if (!files?.length) return;
    setPhotoPending(true);
    setSaveError(null);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.set("file", file);
        const result = await uploadListingPhoto(listing.id, formData);
        if (!result.ok) {
          setSaveError(result.error);
          break;
        }
        setDraft((current) => {
          const nextMedia: DraftMedia[] = [
            ...current.media,
            {
              id: result.media.id,
              public_url: result.media.public_url,
              alt_text: result.media.alt_text,
              is_cover: result.media.is_cover,
              sort_order: result.media.sort_order,
            },
          ];
          return {
            ...current,
            media: nextMedia,
            cover_media_id: result.media.is_cover
              ? result.media.id
              : current.cover_media_id || result.media.id,
          };
        });
      }
    } finally {
      setPhotoPending(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDeletePhoto(mediaId: string) {
    setPhotoPending(true);
    setSaveError(null);
    const result = await deleteListingPhoto(listing.id, mediaId);
    setPhotoPending(false);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setDraft((current) => {
      const next = current.media.filter((row) => row.id !== mediaId);
      const coverStill = next.find((row) => row.id === current.cover_media_id && !row._delete);
      return {
        ...current,
        media: next,
        cover_media_id: coverStill?.id ?? next.find((row) => !row._delete)?.id ?? "",
      };
    });
  }

  return (
    <div className="cr-editor-page">
      <header className="cr-editor-head">
        <div>
          <p className="eyebrow">
            <a href="/admin/listings">Directory</a> · {listingStatusLabel(listing.status)}
            {listing.is_featured ? " · Top Pick" : ""}
          </p>
          <h1>Editing: {draft.name || listing.name}</h1>
          <p className="lede muted">
            {draft.business_name || "Business"}
            {draft.branch_name ? ` · ${draft.branch_name}` : ""}
          </p>
        </div>
        <a className="btn btn-secondary" href="/admin/listings">
          Back To Queue
        </a>
      </header>

      {(error || saveError) && <p className="error">{error || saveError}</p>}
      {(notice || saveNotice) && <p className="notice">{notice || saveNotice}</p>}

      {branches.length > 1 && (
        <div className="cr-branch-tabs">
          {branches.map((branch) => (
            <a
              key={branch.id}
              className={branch.id === listing.id ? "cr-tab active" : "cr-tab"}
              href={`/admin/listings/${branch.id}`}
            >
              {branch.branch_name || branch.name}
            </a>
          ))}
        </div>
      )}

      <div className="cr-jump">
        {progress.steps.map((step) => (
          <button
            key={step.key}
            type="button"
            className={step.done ? "cr-jump-chip done" : "cr-jump-chip"}
            onClick={() => jump(step.key)}
          >
            {step.label}
          </button>
        ))}
      </div>

      <div className="cr-editor">
        <aside className="cr-rail">
          <div className="cr-rail-card">
            <p className="cr-rail-title">Listing Status</p>
            <ul className="cr-status-legend">
              {legend.map((item) => (
                <li key={item.id} className={item.active ? "active" : undefined}>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="cr-rail-card">
            <p className="cr-rail-title">Ready · {progress.percent}%</p>
            <ul className="cr-progress">
              {progress.steps.map((step) => (
                <li key={step.key} className={step.done ? "done" : "todo"}>
                  <button type="button" onClick={() => jump(step.key)}>
                    <span aria-hidden="true">{step.done ? "✓" : step.number}</span>
                    {step.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="cr-paper">
          <section className="cr-step" id="step-contact">
            <h2>
              <span>1</span> Your Contact
            </h2>
            <div className="cr-grid-2">
              <label className="field">
                <span>Contact Email</span>
                <input
                  type="email"
                  value={draft.email}
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Contact Number</span>
                <input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                />
              </label>
            </div>
          </section>

          <section className="cr-step" id="step-business">
            <h2>
              <span>2</span> The Business
            </h2>
            <div className="cr-grid-2">
              <label className="field">
                <span>Main Business Name</span>
                <input
                  value={draft.business_name}
                  onChange={(e) => patch({ business_name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Branch Name</span>
                <input
                  value={draft.branch_name}
                  onChange={(e) => patch({ branch_name: e.target.value })}
                  placeholder="Optional"
                />
              </label>
            </div>
            <label className="field">
              <span>Listing Name</span>
              <input value={draft.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <div className="cr-grid-2">
              <label className="field">
                <span>Website</span>
                <input
                  type="url"
                  value={draft.website_url}
                  onChange={(e) => patch({ website_url: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Booking Link</span>
                <input
                  type="url"
                  value={draft.booking_url}
                  onChange={(e) => patch({ booking_url: e.target.value })}
                />
              </label>
            </div>
            <div className="cr-grid-3">
              {draft.social.map((row) => (
                <label className="field" key={row.platform}>
                  <span>{row.platform}</span>
                  <input
                    value={row.handle}
                    onChange={(e) => patchSocial(row.platform, e.target.value)}
                    placeholder="@handle"
                  />
                </label>
              ))}
            </div>
            <label className="field">
              <span>Short Description</span>
              <textarea
                rows={2}
                value={draft.short_description}
                onChange={(e) => patch({ short_description: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Marketing Description</span>
              <textarea
                rows={5}
                value={draft.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Business Description</span>
              <textarea
                rows={3}
                value={draft.business_description}
                onChange={(e) => patch({ business_description: e.target.value })}
              />
            </label>
            <div className="cr-grid-2">
              <label className="field">
                <span>Indoor / Outdoor</span>
                <select
                  value={draft.indoor_outdoor}
                  onChange={(e) =>
                    patch({
                      indoor_outdoor: e.target.value as ListingDraft["indoor_outdoor"],
                    })
                  }
                >
                  <option value="">Not set</option>
                  <option value="indoor">Indoor</option>
                  <option value="outdoor">Outdoor</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="field checkbox">
                <span>Booking</span>
                <label>
                  <input
                    type="checkbox"
                    checked={draft.booking_required}
                    onChange={(e) => patch({ booking_required: e.target.checked })}
                  />
                  Booking required
                </label>
              </label>
            </div>
          </section>

          <section className="cr-step" id="step-hours">
            <h2>
              <span>3</span> Branch & Hours
            </h2>
            <div className="cr-grid-2">
              <label className="field">
                <span>Street Address</span>
                <input
                  value={draft.street_address_1}
                  onChange={(e) => patch({ street_address_1: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Suburb</span>
                <input
                  value={draft.suburb}
                  onChange={(e) => patch({ suburb: e.target.value })}
                />
              </label>
              <label className="field">
                <span>City</span>
                <input value={draft.city} onChange={(e) => patch({ city: e.target.value })} />
              </label>
              <label className="field">
                <span>Postal Code</span>
                <input
                  value={draft.postal_code}
                  onChange={(e) => patch({ postal_code: e.target.value })}
                />
              </label>
            </div>
            <div className="cr-hours-edit">
              {draft.hours.map((row, index) => (
                <div className="cr-hour-row" key={row.day_of_week}>
                  <strong>{formatDay(row.day_of_week)}</strong>
                  <label className="cr-closed">
                    <input
                      type="checkbox"
                      checked={row.is_closed}
                      onChange={(e) => patchHour(index, { is_closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <input
                    type="time"
                    value={row.opens_at}
                    disabled={row.is_closed}
                    onChange={(e) => patchHour(index, { opens_at: e.target.value })}
                    aria-label={`${formatDay(row.day_of_week)} opens`}
                  />
                  <input
                    type="time"
                    value={row.closes_at}
                    disabled={row.is_closed}
                    onChange={(e) => patchHour(index, { closes_at: e.target.value })}
                    aria-label={`${formatDay(row.day_of_week)} closes`}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="cr-step" id="step-prices">
            <h2>
              <span>4</span> Activities, Prices & Member Offers
            </h2>
            <p className="muted cr-step-help">
              Group prices under each activity. Every active price needs a Venturo member price —
              that is the paid membership promise.
            </p>
            <div className="cr-activity-list">
              {draft.activities.map((activity) => (
                <article className="cr-activity-card" key={activity.clientKey}>
                  <div className="cr-activity-head">
                    <label className="field">
                      <span>Activity Name</span>
                      <input
                        value={activity.name}
                        onChange={(e) =>
                          patchActivity(activity.clientKey, { name: e.target.value })
                        }
                      />
                    </label>
                    <label className="field checkbox">
                      <span>Active</span>
                      <label>
                        <input
                          type="checkbox"
                          checked={activity.is_active}
                          onChange={(e) =>
                            patchActivity(activity.clientKey, { is_active: e.target.checked })
                          }
                        />
                        Show this activity
                      </label>
                    </label>
                  </div>
                  <label className="field">
                    <span>What Happens & What To Bring</span>
                    <textarea
                      rows={4}
                      value={activity.description}
                      onChange={(e) =>
                        patchActivity(activity.clientKey, { description: e.target.value })
                      }
                      placeholder="Write-up for the activity. Good-to-know notes (gear, arrival, weather) can live here too."
                    />
                    <small className="cr-field-hint">
                      Good-to-know tips fit naturally in this write-up.
                    </small>
                  </label>
                  <div className="cr-grid-3">
                    <label className="field">
                      <span>Duration (minutes)</span>
                      <input
                        inputMode="numeric"
                        value={activity.duration_minutes}
                        onChange={(e) =>
                          patchActivity(activity.clientKey, {
                            duration_minutes: e.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Min Age</span>
                      <input
                        inputMode="numeric"
                        value={activity.minimum_age}
                        onChange={(e) =>
                          patchActivity(activity.clientKey, { minimum_age: e.target.value })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Max Age</span>
                      <input
                        inputMode="numeric"
                        value={activity.maximum_age}
                        onChange={(e) =>
                          patchActivity(activity.clientKey, { maximum_age: e.target.value })
                        }
                      />
                    </label>
                  </div>
                  <label className="field checkbox">
                    <span>Booking</span>
                    <label>
                      <input
                        type="checkbox"
                        checked={activity.booking_required}
                        onChange={(e) =>
                          patchActivity(activity.clientKey, {
                            booking_required: e.target.checked,
                          })
                        }
                      />
                      Booking required for this activity
                    </label>
                  </label>

                  <p className="cr-subhead">Prices</p>
                  <div className="cr-price-list">
                    {activity.prices.map((row) => {
                      const missingMember = row.is_active && !row.member_price.trim();
                      return (
                        <article className="cr-price-card" key={row.clientKey}>
                          <div className="cr-grid-2">
                            <label className="field">
                              <span>Option Name</span>
                              <input
                                value={row.name}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    name: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Applies To</span>
                              <select
                                value={row.couples_exclusive ? "custom" : row.applies_to}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    applies_to: e.target.value as DraftPrice["applies_to"],
                                    couples_exclusive:
                                      e.target.value === "custom"
                                        ? row.couples_exclusive
                                        : false,
                                  })
                                }
                              >
                                {APPLIES_TO_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="cr-grid-2">
                            <label className="field">
                              <span>Price Category</span>
                              <select
                                value={row.price_category}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    price_category: e.target
                                      .value as DraftPrice["price_category"],
                                  })
                                }
                              >
                                {PRICE_CATEGORY_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="field checkbox">
                              <span>Couples Exclusive</span>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={row.couples_exclusive}
                                  onChange={(e) =>
                                    patchPrice(activity.clientKey, row.clientKey, {
                                      couples_exclusive: e.target.checked,
                                      applies_to: e.target.checked
                                        ? "custom"
                                        : row.applies_to === "custom"
                                          ? "person"
                                          : row.applies_to,
                                    })
                                  }
                                />
                                Couples package
                              </label>
                            </label>
                          </div>
                          <div className="cr-grid-2">
                            <label className="field">
                              <span>Valid From</span>
                              <input
                                type="date"
                                value={row.valid_from}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    valid_from: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Valid Until</span>
                              <input
                                type="date"
                                value={row.valid_until}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    valid_until: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <div className="cr-grid-2">
                            <label className="field">
                              <span>Standard Price (R)</span>
                              <input
                                inputMode="decimal"
                                value={row.standard_price}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    standard_price: e.target.value,
                                  })
                                }
                              />
                            </label>
                            <label className="field">
                              <span>Member Price (R)</span>
                              <input
                                inputMode="decimal"
                                value={row.member_price}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    member_price: e.target.value,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <div className="cr-member-box">
                            <span>Venturo member pays</span>
                            <strong>
                              {row.member_price.trim()
                                ? formatRand(Number(row.member_price))
                                : "Add member price"}
                            </strong>
                          </div>
                          {missingMember && (
                            <p className="cr-warn">Member discount still missing on this option.</p>
                          )}
                          <label className="field">
                            <span>What&apos;s Included?</span>
                            <textarea
                              rows={2}
                              value={row.inclusions}
                              onChange={(e) =>
                                patchPrice(activity.clientKey, row.clientKey, {
                                  inclusions: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="field checkbox">
                            <span>Active</span>
                            <label>
                              <input
                                type="checkbox"
                                checked={row.is_active}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    is_active: e.target.checked,
                                  })
                                }
                              />
                              Show this price
                            </label>
                          </label>
                          <button
                            className="btn btn-secondary cr-inline-btn"
                            type="button"
                            onClick={() => removePrice(activity.clientKey, row.clientKey)}
                          >
                            Remove Price
                          </button>
                        </article>
                      );
                    })}
                  </div>
                  <div className="cr-activity-actions">
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => addPrice(activity.clientKey)}
                    >
                      Add Price
                    </button>
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={() => removeActivity(activity.clientKey)}
                    >
                      Remove Activity
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button className="btn btn-secondary" type="button" onClick={addActivity}>
              Add Activity
            </button>
          </section>

          <section className="cr-step" id="step-audience">
            <h2>
              <span>5</span> Who It&apos;s For
            </h2>
            <p className="cr-subhead">Primary Category</p>
            <p className="muted cr-step-help">Pick one kind — this steers interest suggestions.</p>
            <div className="cr-chip-grid" role="radiogroup" aria-label="Primary category">
              {catalog.kinds.map((kind) => {
                const active = draft.kind_ids[0] === kind.id;
                return (
                  <button
                    key={kind.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={active ? "cr-tag active" : "cr-tag"}
                    onClick={() => patch({ kind_ids: [kind.id] })}
                  >
                    {kind.title}
                  </button>
                );
              })}
            </div>

            <p className="cr-subhead">Who Comes</p>
            <p className="muted cr-step-help">Optional. Choose up to 3.</p>
            <div className="cr-chip-grid">
              {whoComes.map((persona) => {
                const active = draft.persona_ids.includes(persona.id);
                return (
                  <button
                    key={persona.id}
                    type="button"
                    className={active ? "cr-tag active" : "cr-tag"}
                    onClick={() =>
                      patch({ persona_ids: toggleId(draft.persona_ids, persona.id, 3) })
                    }
                  >
                    {persona.label}
                  </button>
                );
              })}
            </div>

            <p className="cr-subhead">Energy</p>
            <div className="cr-chip-grid">
              {catalog.scales.map((scale) => {
                const active = draft.scale_id === scale.id;
                return (
                  <button
                    key={scale.id}
                    type="button"
                    className={active ? "cr-tag active" : "cr-tag"}
                    title={scale.subtitle}
                    onClick={() => patch({ scale_id: active ? "" : scale.id })}
                  >
                    {scale.title}
                  </button>
                );
              })}
            </div>

            <p className="cr-subhead">Interests</p>
            <p className="muted cr-step-help">
              Search to find interests, or browse top picks for the selected category. Max 5.
            </p>
            {selectedInterests.length > 0 && (
              <div className="cr-chip-grid cr-selected-chips">
                {selectedInterests.map((interest) => (
                  <button
                    key={interest.id}
                    type="button"
                    className="cr-tag active"
                    onClick={() =>
                      patch({
                        interest_ids: draft.interest_ids.filter((id) => id !== interest.id),
                      })
                    }
                  >
                    {interest.title} ×
                  </button>
                ))}
              </div>
            )}
            <label className="field">
              <span>Search Interests</span>
              <input
                type="search"
                value={interestQuery}
                onChange={(e) => setInterestQuery(e.target.value)}
                placeholder="Bowling, escape rooms, markets…"
              />
            </label>
            {interestResults.length === 0 && interestQuery.trim().length === 0 && (
              <p className="muted">
                Type to search, or pick a primary category to see suggested interests.
              </p>
            )}
            {interestResults.length > 0 && (
              <div className="cr-chip-grid">
                {interestResults.map((interest) => {
                  const active = draft.interest_ids.includes(interest.id);
                  return (
                    <button
                      key={interest.id}
                      type="button"
                      className={active ? "cr-tag active" : "cr-tag"}
                      onClick={() =>
                        patch({
                          interest_ids: toggleId(draft.interest_ids, interest.id, 5),
                        })
                      }
                    >
                      {interest.title}
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <section className="cr-step" id="step-photos">
            <h2>
              <span>6</span> Branch Photos
            </h2>
            <p className="muted cr-step-help">
              Drag to reorder. The cover is the Discover hero image.
            </p>
            {media.length === 0 && <p className="muted">No photos on this listing yet.</p>}
            <div className="cr-photo-grid">
              {media.map((item) => {
                const cover = draft.cover_media_id === item.id;
                return (
                  <div
                    key={item.id}
                    className={cover ? "cr-photo active" : "cr-photo"}
                    draggable
                    onDragStart={() => {
                      dragMediaId.current = item.id;
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragMediaId.current) reorderMedia(dragMediaId.current, item.id);
                      dragMediaId.current = null;
                    }}
                  >
                    <img src={item.public_url} alt={item.alt_text || ""} />
                    <div className="cr-photo-actions">
                      <button type="button" onClick={() => setCover(item.id)}>
                        {cover ? "Cover" : "Make Cover"}
                      </button>
                      <button
                        type="button"
                        className="danger"
                        disabled={photoPending}
                        onClick={() => onDeletePhoto(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="cr-photo-upload">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => onUploadFiles(e.target.files)}
              />
              <button
                className="btn btn-secondary"
                type="button"
                disabled={photoPending}
                onClick={() => fileRef.current?.click()}
              >
                {photoPending ? "Working…" : "Add Photos"}
              </button>
            </div>
          </section>

          <section className="cr-step" id="step-review">
            <h2>
              <span>7</span> Permission & Review
            </h2>
            <label className="cr-check">
              <input
                type="checkbox"
                checked={draft.authorised_to_submit}
                onChange={(e) => patch({ authorised_to_submit: e.target.checked })}
              />
              <span>I am authorised to submit this business on Venturo.</span>
            </label>
            <label className="cr-check">
              <input
                type="checkbox"
                checked={draft.image_rights_granted}
                onChange={(e) => patch({ image_rights_granted: e.target.checked })}
              />
              <span>
                Images & copy may be used on the app, website, social, and ads.
              </span>
            </label>
            <div className="cr-next-box">
              <p className="cr-subhead">What Happens Next?</p>
              <p className="muted">
                Save your edits any time. Approve & Publish is still a staff-only action —
                businesses never go live themselves.
              </p>
            </div>
            <div className="cr-audit">
              <p className="cr-subhead">Audit</p>
              {audit.length === 0 && <p className="muted">No staff actions yet.</p>}
              <ul>
                {audit.map((row) => (
                  <li key={row.id}>
                    <span>{auditLabel(row)}</span>
                    <span>{formatClock(row.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <PhonePreview draft={draft} listing={listing} catalog={catalog} />
      </div>

      <footer className="cr-sticky">
        <div>
          <strong>
            {progress.ready ? "Ready for review" : `${progress.doneCount} of ${progress.total} complete`}
          </strong>
          <p className="muted">Member prices, tags, photos & permissions count.</p>
        </div>
        <div className="cr-sticky-actions">
          <button className="btn btn-secondary" type="button" onClick={onSave} disabled={pending}>
            {pending ? "Saving…" : "Save Draft"}
          </button>
          <ListingActions listing={listing} />
        </div>
      </footer>
    </div>
  );
}
