"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { applyListingAction, deleteListingPhoto, saveListingDraft } from "@/app/admin/actions";
import { createClient } from "@/lib/supabase/client";
import { ListingAppPreview } from "@/components/admin/ListingAppPreview";
import type { ListingDetail } from "@/lib/control-room-types";
import {
  auditChanges,
  formatAuditWhen,
  formatDay,
  listingStatusLabel,
  type AuditEvent,
} from "@/lib/control-room-shared";
import {
  APPLIES_TO_OPTIONS,
  EDITOR_STEPS,
  INTEREST_CHIPS,
  SUB_APPLIES_OPTIONS,
  activeMedia,
  auditLabel,
  emptyActivity,
  emptyPrice,
  derivedMemberPrice,
  draftWithPending,
  interestIdsFromKeywords,
  stepComplete,
  type DraftActivity,
  type DraftMedia,
  type DraftPrice,
  type EditorBranch,
  type EditorCatalog,
  type ListingDraft,
  type StepKey,
} from "@/lib/listing-draft";

const PHOTO_LIMIT = 10 * 1024 * 1024;
const PHOTO_CONCURRENCY = 4;

function photoExt(file: File) {
  const fromName = file.name.split(".").pop()?.toLowerCase();
  if (fromName && ["jpg", "jpeg", "png", "webp", "gif"].includes(fromName)) {
    return fromName === "jpeg" ? "jpg" : fromName;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

function photoContentType(file: File, ext: string) {
  if (file.type.startsWith("image/")) return file.type;
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

async function uploadOnePhoto(
  listingId: string,
  file: File,
  sortOrder: number,
  makeCover: boolean,
  holdBack: boolean,
): Promise<DraftMedia | string> {
  const allowed = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
  if (!allowed || /heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
    return `${file.name}: use a JPEG, PNG, WebP, or GIF.`;
  }
  if (file.size === 0) return `${file.name}: that file is empty.`;
  if (file.size > PHOTO_LIMIT) return `${file.name}: keep it under 10 MB.`;

  const supabase = createClient();
  if (!supabase) return "Could not reach photo storage.";

  const ext = photoExt(file);
  const storageKey = `${listingId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from("listing-media").upload(storageKey, file, {
    cacheControl: "3600",
    contentType: photoContentType(file, ext),
    upsert: false,
  });
  if (uploadError) return `${file.name}: ${uploadError.message}`;

  const {
    data: { publicUrl },
  } = supabase.storage.from("listing-media").getPublicUrl(storageKey);

  const { data: row, error: insertError } = await supabase
    .from("listing_media")
    .insert({
      listing_id: listingId,
      media_type: "image",
      storage_key: storageKey,
      public_url: publicUrl,
      alt_text: file.name.replace(/\.[^.]+$/, "").slice(0, 120) || null,
      copyright_status: "owned",
      is_cover: holdBack ? false : makeCover,
      is_pending: holdBack,
      sort_order: sortOrder,
    })
    .select("id, public_url, is_cover, sort_order, alt_text, is_pending")
    .single();

  if (insertError || !row) {
    await supabase.storage.from("listing-media").remove([storageKey]);
    return `${file.name}: ${insertError?.message ?? "Could not save the photo."}`;
  }

  return {
    id: row.id as string,
    public_url: row.public_url as string,
    alt_text: (row.alt_text as string | null) ?? "",
    is_cover: Boolean(row.is_cover),
    is_pending: Boolean(row.is_pending),
    sort_order: (row.sort_order as number) ?? sortOrder,
  };
}

function toggleId(ids: string[], id: string, max?: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (max !== undefined && ids.length >= max) return ids;
  return [...ids, id];
}

function normaliseTime(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "--:--") return "";
  const clock = trimmed.match(/^(\d{1,2})[:.](\d{1,2})$/);
  let hour: number;
  let minute: number;
  if (clock) {
    hour = Number(clock[1]);
    minute = Number(clock[2]);
  } else if (/^\d{1,4}$/.test(trimmed)) {
    if (trimmed.length <= 2) {
      hour = Number(trimmed);
      minute = 0;
    } else if (trimmed.length === 3) {
      hour = Number(trimmed.slice(0, 1));
      minute = Number(trimmed.slice(1));
    } else {
      hour = Number(trimmed.slice(0, 2));
      minute = Number(trimmed.slice(2));
    }
  } else {
    return null;
  }
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function TimeField({
  value,
  disabled,
  label,
  onChange,
}: {
  value: string;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <input
      className="cr-time-input"
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      disabled={disabled}
      placeholder="--:--"
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        if (!raw.trim()) {
          setText("");
          if (value) onChange("");
          return;
        }
        const complete = /^\d{4}$/.test(raw) || /^\d{1,2}[:.]\d{2}$/.test(raw);
        if (!complete) {
          setText(raw);
          return;
        }
        const next = normaliseTime(raw);
        if (next === null) {
          setText(raw);
          return;
        }
        setText(next);
        if (next !== value) onChange(next);
      }}
      onBlur={() => {
        const next = normaliseTime(text);
        if (next === null) {
          setText(value);
          return;
        }
        setText(next);
        if (next !== value) onChange(next);
      }}
    />
  );
}

const PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
];

function appliesChoices(current: string) {
  const choices: { value: string; label: string }[] = SUB_APPLIES_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  if (current && !choices.some((option) => option.value === current)) {
    const known = APPLIES_TO_OPTIONS.find((option) => option.value === current);
    choices.push({ value: current, label: known?.label ?? current });
  }
  return choices;
}

export function ListingEditor({
  listing,
  catalog,
  branches,
  audit,
  notice,
  error,
  canApprove = false,
}: {
  listing: ListingDetail;
  catalog: EditorCatalog;
  branches: EditorBranch[];
  audit: AuditEvent[];
  notice?: string;
  error?: string;
  canApprove?: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const dragMediaId = useRef<string | null>(null);
  const [draft, setDraft] = useState(() => draftWithPending(listing, catalog));
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [photoPending, setPhotoPending] = useState(false);
  const [photoDrag, setPhotoDrag] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null>(null);
  const [openSteps, setOpenSteps] = useState<Partial<Record<StepKey, boolean>>>({});
  const [activeStep, setActiveStep] = useState<StepKey>("business");
  const [openAuditId, setOpenAuditId] = useState<string | null>(null);

  function stepOpen(key: StepKey) {
    return openSteps[key] !== false;
  }

  function toggleStep(key: StepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: current[key] === false }));
  }

  function jump(key: StepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: true }));
    window.setTimeout(() => {
      document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  const scheduled =
    listing.status === "approved" &&
    Boolean(listing.publish_at) &&
    new Date(listing.publish_at ?? "").getTime() > Date.now();
  const statusText = listingStatusLabel(listing.status, {
    suspended: Boolean(listing.is_suspended),
    scheduled,
  });
  const editsSaved = listing.status === "approved" && listing.pending_state === "draft";
  const editsWaiting = listing.status === "approved" && listing.pending_state === "review";
  const canSubmit = listing.status === "draft" || editsSaved;
  const media = activeMedia(draft);

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

  function onSave() {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveListingDraft(listing.id, draft);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setSaveNotice(
        listing.status === "approved"
          ? "Edits saved. The live listing stays as it is until an admin approves."
          : "Draft saved.",
      );
      router.refresh();
    });
  }

  function addActivity() {
    setDraft((current) => ({
      ...current,
      activities: [...current.activities, emptyActivity("", current.activities.length)],
    }));
  }

  function removeActivity(clientKey: string) {
    setDraft((current) => ({
      ...current,
      activities: current.activities.filter((row) => row.clientKey !== clientKey),
    }));
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
        return {
          ...activity,
          prices: activity.prices.filter((price) => price.clientKey !== priceKey),
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
    const list = Array.from(files ?? []);
    if (!list.length) return;
    setPhotoPending(true);
    setPhotoStatus(`Uploading 0 of ${list.length}`);
    setSaveError(null);
    const visible = draft.media.filter((row) => !row._delete);
    const startOrder = visible.reduce((max, row) => Math.max(max, row.sort_order ?? 0), -1) + 1;
    const needCover = !visible.some((row) => row.is_cover);
    const jobs = list.map((file, index) => ({
      file,
      sortOrder: startOrder + index,
      makeCover: needCover && index === 0,
    }));
    const uploaded: DraftMedia[] = [];
    const failures: string[] = [];
    let cursor = 0;
    let finished = 0;

    async function worker() {
      while (cursor < jobs.length) {
        const job = jobs[cursor];
        cursor += 1;
        const result = await uploadOnePhoto(
          listing.id,
          job.file,
          job.sortOrder,
          job.makeCover,
          listing.status === "approved",
        );
        finished += 1;
        setPhotoStatus(`Uploading ${finished} of ${list.length}`);
        if (typeof result === "string") failures.push(result);
        else uploaded.push(result);
      }
    }

    try {
      await Promise.all(
        Array.from({ length: Math.min(PHOTO_CONCURRENCY, jobs.length) }, () => worker()),
      );
      if (uploaded.length) {
        const added = [...uploaded].sort((a, b) => a.sort_order - b.sort_order);
        setDraft((current) => ({
          ...current,
          media: [...current.media, ...added],
          cover_media_id:
            added.find((row) => row.is_cover)?.id ??
            (current.cover_media_id || added[0]?.id || current.cover_media_id),
        }));
      }
      if (failures.length) {
        setSaveError(
          failures.length === list.length
            ? failures.join(" ")
            : `${uploaded.length} of ${list.length} photos added. ${failures.join(" ")}`,
        );
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not upload those photos.");
    } finally {
      setPhotoPending(false);
      setPhotoStatus(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onDeletePhoto(mediaId: string) {
    const target = draft.media.find((row) => row.id === mediaId);
    if (listing.status === "approved" && !target?.is_pending) {
      setDraft((current) => {
        const next = current.media.map((row) =>
          row.id === mediaId ? { ...row, _delete: true } : row,
        );
        const visible = next.filter((row) => !row._delete);
        const coverStill = visible.find((row) => row.id === current.cover_media_id);
        return {
          ...current,
          media: next,
          cover_media_id: coverStill?.id ?? visible[0]?.id ?? "",
        };
      });
      return;
    }
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
      <aside className="cr-edit-nav" aria-label="Edit listing">
        <a className="cr-edit-spine" href="/admin">
          <span className="cr-edit-spine-mark" aria-hidden="true" />
          <span>Control Panel</span>
        </a>
        <div className="cr-edit-nav-body">
          <a className="cr-edit-brand" href="/admin/listings" aria-label="Directory listings">
            <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="Venturo" />
          </a>
          <p className="cr-edit-title">Directory</p>
          <p className="cr-edit-current">Edit Listing</p>
          <p className="cr-edit-group">Content</p>
          <p className="cr-edit-section">Directory</p>
          <nav className="cr-edit-steps">
            {EDITOR_STEPS.map((step) => (
              <button
                key={step.key}
                type="button"
                className={[
                  activeStep === step.key ? "active" : "",
                  stepComplete(draft, step.key) ? "done" : "",
                ]
                  .filter(Boolean)
                  .join(" ") || undefined}
                aria-current={activeStep === step.key ? "true" : undefined}
                onClick={() => jump(step.key)}
              >
                {step.label}
              </button>
            ))}
          </nav>
          <div className="cr-edit-actions">
            <button className="btn cr-save" type="button" onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : "Save Draft"}
            </button>
            <form action={applyListingAction}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="action" value="review" />
              <button className="btn" type="submit" disabled={!canSubmit || pending}>
                Submit for Approval
              </button>
            </form>
            {editsWaiting && canApprove ? (
              <form action={applyListingAction}>
                <input type="hidden" name="id" value={listing.id} />
                <input type="hidden" name="action" value="approve" />
                <button className="btn" type="submit" disabled={pending}>
                  Approve changes
                </button>
              </form>
            ) : null}
            <form action={applyListingAction}>
              <input type="hidden" name="id" value={listing.id} />
              <input type="hidden" name="action" value="feature" />
              <input type="hidden" name="featured" value={listing.is_featured ? "false" : "true"} />
              <button className={listing.is_featured ? "btn is-on" : "btn"} type="submit">
                Featured Candidate
              </button>
            </form>
            {listing.slug ? (
              <a className="btn" href={`/admin/listings/${listing.id}/poster`} target="_blank" rel="noreferrer">
                Print Partner Poster
              </a>
            ) : null}
          </div>
          <div
            className={
              listing.status === "approved" && !listing.is_suspended
                ? "cr-edit-status is-live"
                : "cr-edit-status"
            }
          >
            <p>Listing Status</p>
            <p>{statusText}</p>
            {editsSaved ? <p>Edits saved</p> : null}
            {editsWaiting ? <p>Waiting for approval</p> : null}
            {listing.is_featured ? <p>Featured candidate</p> : null}
          </div>
        </div>
      </aside>
      <div className="cr-editor-stage">
      <header className="cr-editor-head">
        <div>
          <p className="cr-editor-kicker">Directory Listings</p>
          <h1>Editing {draft.business_name || draft.name || "Business"}</h1>
        </div>
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

      <div className="cr-editor">
        <div className="cr-paper">
          <section className={stepOpen("business") ? "cr-step is-open" : "cr-step"} id="step-business">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("business")} onClick={() => toggleStep("business")}>
                <em>The Listing</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <label className="field cr-quiet">
              <span className="sr-only">Business Name</span>
              <input
                value={draft.name}
                placeholder="Business Name"
                aria-label="Business Name"
                onChange={(e) => patch({ name: e.target.value })}
              />
            </label>
            <div className="cr-known-row">
              <label className="field cr-quiet">
                <span className="sr-only">Business Known As</span>
                <input
                  value={draft.business_name}
                  placeholder="Business Known As (Optional)"
                  aria-label="Business Known As"
                  onChange={(e) => patch({ business_name: e.target.value })}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Branch</span>
                <input
                  value={draft.branch_name}
                  placeholder="Branch"
                  aria-label="Branch"
                  onChange={(e) => patch({ branch_name: e.target.value })}
                />
              </label>
            </div>
            <p className="cr-about-label">About</p>
            <label className="field cr-quiet cr-long">
              <textarea
                rows={6}
                value={draft.description}
                placeholder="Long Description"
                aria-label="Long Description"
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label className="field cr-quiet cr-short">
              <textarea
                rows={4}
                value={draft.short_description}
                placeholder="Short Description"
                aria-label="Short Description"
                onChange={(e) => patch({ short_description: e.target.value })}
              />
            </label>
          </section>

          <section className={stepOpen("location") ? "cr-step is-open" : "cr-step"} id="step-location">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("location")} onClick={() => toggleStep("location")}>
                <em>Location</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <div className="cr-grid-2">
              <label className="field cr-quiet">
                <span className="sr-only">Street Address</span>
                <input
                  value={draft.street_address_1}
                  placeholder="Street Address"
                  aria-label="Street Address"
                  onChange={(e) => patch({ street_address_1: e.target.value })}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Address Line 2</span>
                <input
                  value={draft.street_address_2}
                  placeholder="Address Line 2"
                  aria-label="Address Line 2"
                  onChange={(e) => patch({ street_address_2: e.target.value })}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Suburb</span>
                <input
                  value={draft.suburb}
                  placeholder="Suburb"
                  aria-label="Suburb"
                  onChange={(e) => patch({ suburb: e.target.value })}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">City</span>
                <input
                  value={draft.city}
                  placeholder="City"
                  aria-label="City"
                  onChange={(e) => patch({ city: e.target.value })}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Province</span>
                <select
                  className={draft.province ? undefined : "is-empty"}
                  value={draft.province}
                  aria-label="Province"
                  onChange={(e) => patch({ province: e.target.value })}
                >
                  <option value="">Province</option>
                  {(draft.province && !PROVINCES.includes(draft.province)
                    ? [draft.province, ...PROVINCES]
                    : PROVINCES
                  ).map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Postal Code</span>
                <input
                  value={draft.postal_code}
                  placeholder="Postal Code"
                  aria-label="Postal Code"
                  onChange={(e) => patch({ postal_code: e.target.value })}
                />
              </label>
            </div>
            <label className="field cr-quiet">
              <span className="sr-only">Google Maps Link</span>
              <input
                type="url"
                value={draft.maps_url}
                placeholder="Google Maps Link"
                aria-label="Google Maps Link"
                onChange={(e) => patch({ maps_url: e.target.value })}
              />
            </label>
            <div className="cr-grid-2">
              <label className="field cr-quiet">
                <span className="sr-only">Latitude</span>
                <input
                  inputMode="decimal"
                  value={draft.latitude}
                  placeholder="Latitude"
                  aria-label="Latitude"
                  onChange={(e) => patch({ latitude: e.target.value })}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Longitude</span>
                <input
                  inputMode="decimal"
                  value={draft.longitude}
                  placeholder="Longitude"
                  aria-label="Longitude"
                  onChange={(e) => patch({ longitude: e.target.value })}
                />
              </label>
            </div>
          </section>

          <section className={stepOpen("hours") ? "cr-step is-open" : "cr-step"} id="step-hours">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("hours")} onClick={() => toggleStep("hours")}>
                <em>Operating Hours</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <div className="cr-hours-board">
              <p className="cr-hours-season cr-hours-season-normal">Normal Time</p>
              <p className="cr-hours-season cr-hours-season-vacation">School Vacations</p>
              <span className="cr-hours-label">Day of Week</span>
              <span className="cr-hours-label">Closed</span>
              <span className="cr-hours-label">Open</span>
              <span className="cr-hours-label">Close</span>
              <span className="cr-hours-label">Closed</span>
              <span className="cr-hours-label">Open</span>
              <span className="cr-hours-label">Close</span>
              {draft.hours.map((row, index) => (
                <div className="cr-hours-day" key={row.day_of_week}>
                  <strong>{formatDay(row.day_of_week)}</strong>
                  <label className="cr-hour-check">
                    <input
                      type="checkbox"
                      checked={row.is_closed}
                      aria-label={`${formatDay(row.day_of_week)} closed, normal time`}
                      onChange={(event) => patchHour(index, { is_closed: event.target.checked })}
                    />
                  </label>
                  <TimeField
                    value={row.opens_at}
                    disabled={row.is_closed}
                    label={`${formatDay(row.day_of_week)} normal opens`}
                    onChange={(opens_at) => patchHour(index, { opens_at })}
                  />
                  <TimeField
                    value={row.closes_at}
                    disabled={row.is_closed}
                    label={`${formatDay(row.day_of_week)} normal closes`}
                    onChange={(closes_at) => patchHour(index, { closes_at })}
                  />
                  <label className="cr-hour-check">
                    <input
                      type="checkbox"
                      checked={row.vacation_is_closed}
                      aria-label={`${formatDay(row.day_of_week)} closed, school vacations`}
                      onChange={(event) =>
                        patchHour(index, { vacation_is_closed: event.target.checked })
                      }
                    />
                  </label>
                  <TimeField
                    value={row.vacation_opens_at}
                    disabled={row.vacation_is_closed}
                    label={`${formatDay(row.day_of_week)} school vacation opens`}
                    onChange={(vacation_opens_at) => patchHour(index, { vacation_opens_at })}
                  />
                  <TimeField
                    value={row.vacation_closes_at}
                    disabled={row.vacation_is_closed}
                    label={`${formatDay(row.day_of_week)} school vacation closes`}
                    onChange={(vacation_closes_at) => patchHour(index, { vacation_closes_at })}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className={stepOpen("contact") ? "cr-step is-open" : "cr-step"} id="step-contact">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("contact")} onClick={() => toggleStep("contact")}>
                <em>Contact &amp; Socials</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <div className="cr-grid-2">
              <label className="field cr-quiet">
                <span className="sr-only">Email Address</span>
                <input
                  type="email"
                  value={draft.email}
                  placeholder="Email Address"
                  aria-label="Email Address"
                  onChange={(e) => patch({ email: e.target.value })}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Contact Number</span>
                <input
                  type="tel"
                  value={draft.phone}
                  placeholder="Contact Number"
                  aria-label="Contact Number"
                  onChange={(e) => patch({ phone: e.target.value })}
                />
              </label>
            </div>
            <label className="field cr-quiet">
              <span className="sr-only">Website</span>
              <input
                type="url"
                value={draft.website_url}
                placeholder="Website"
                aria-label="Website"
                onChange={(e) => patch({ website_url: e.target.value })}
              />
            </label>
            <label className="field cr-quiet">
              <span className="sr-only">Booking Link</span>
              <input
                type="url"
                value={draft.booking_url}
                placeholder="Booking Link"
                aria-label="Booking Link"
                onChange={(e) => patch({ booking_url: e.target.value })}
              />
            </label>
            <p className="cr-about-label">Social Handles</p>
            <div className="cr-grid-3">
              <label className="field cr-quiet">
                <span className="sr-only">Instagram</span>
                <input
                  value={draft.social.find((row) => row.platform === "instagram")?.handle ?? ""}
                  placeholder="@Instagram"
                  aria-label="Instagram"
                  onChange={(e) => patchSocial("instagram", e.target.value)}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">Facebook</span>
                <input
                  value={draft.social.find((row) => row.platform === "facebook")?.handle ?? ""}
                  placeholder="Facebook"
                  aria-label="Facebook"
                  onChange={(e) => patchSocial("facebook", e.target.value)}
                />
              </label>
              <label className="field cr-quiet">
                <span className="sr-only">TikTok</span>
                <input
                  value={draft.social.find((row) => row.platform === "tiktok")?.handle ?? ""}
                  placeholder="TikTok"
                  aria-label="TikTok"
                  onChange={(e) => patchSocial("tiktok", e.target.value)}
                />
              </label>
            </div>
          </section>

          <section className={stepOpen("prices") ? "cr-step is-open" : "cr-step"} id="step-prices">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("prices")} onClick={() => toggleStep("prices")}>
                <em>Activities &amp; Costs</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <div className="cr-activity-list">
              {draft.activities.map((activity, activityIndex) => (
                <article className="cr-activity-board" key={activity.clientKey}>
                  <div className="cr-activity-kicker">
                    <p>Activity {activityIndex + 1}</p>
                    <button
                      type="button"
                      className="cr-text-remove"
                      onClick={() => removeActivity(activity.clientKey)}
                    >
                      Remove
                    </button>
                  </div>
                  <label className="field cr-quiet">
                    <span className="sr-only">Activity Name</span>
                    <input
                      value={activity.name}
                      placeholder="Activity Name"
                      aria-label={`Activity ${activityIndex + 1} name`}
                      onChange={(e) =>
                        patchActivity(activity.clientKey, { name: e.target.value })
                      }
                    />
                  </label>
                  {activity.prices.map((row, priceIndex) => {
                    const choices = appliesChoices(row.applies_to);
                    return (
                      <div className="cr-sub" key={row.clientKey}>
                        <div className="cr-sub-top">
                          <label className="field cr-quiet">
                            <span className="sr-only">Sub Activity Name</span>
                            <input
                              value={row.name}
                              placeholder="Sub Activity Name"
                              aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} name`}
                              onChange={(e) =>
                                patchPrice(activity.clientKey, row.clientKey, {
                                  name: e.target.value,
                                })
                              }
                            />
                          </label>
                          <div className="cr-applies">
                            <label className="field cr-quiet">
                              <span className="sr-only">Applies to</span>
                              <select
                                className={row.applies_to ? undefined : "is-empty"}
                                value={row.applies_to}
                                aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} applies to`}
                                onChange={(e) =>
                                  patchPrice(activity.clientKey, row.clientKey, {
                                    applies_to: e.target.value as DraftPrice["applies_to"],
                                    group_size: e.target.value === "group" ? row.group_size : "",
                                  })
                                }
                              >
                                <option value="">Applies to eg: “Per Person”</option>
                                {choices.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {row.applies_to === "group" && (
                              <label className="field cr-quiet">
                                <span className="sr-only">How many in the group</span>
                                <input
                                  inputMode="numeric"
                                  value={row.group_size}
                                  placeholder="How many"
                                  aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} group size`}
                                  onChange={(e) =>
                                    patchPrice(activity.clientKey, row.clientKey, {
                                      group_size: e.target.value.replace(/[^\d]/g, ""),
                                    })
                                  }
                                />
                              </label>
                            )}
                          </div>
                          <label className="cr-include">
                            <span>Include in “From”</span>
                            <input
                              type="checkbox"
                              checked={row.show_on_from}
                              aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} include in From`}
                              onChange={(e) =>
                                patchPrice(activity.clientKey, row.clientKey, {
                                  show_on_from: e.target.checked,
                                })
                              }
                            />
                          </label>
                        </div>
                        <div className="cr-cost-row">
                          <label className="field cr-quiet">
                            <span className="cr-cost-label">Cost</span>
                            <input
                              inputMode="decimal"
                              value={row.standard_price}
                              placeholder="Standard Price"
                              aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} standard price`}
                              onChange={(e) => {
                                const standard_price = e.target.value;
                                const hasDiscount = Boolean(
                                  row.discount_rand.trim() || row.discount_percent.trim(),
                                );
                                patchPrice(activity.clientKey, row.clientKey, {
                                  standard_price,
                                  member_price: hasDiscount
                                    ? derivedMemberPrice(
                                        standard_price,
                                        row.discount_rand,
                                        row.discount_percent,
                                      )
                                    : row.member_price,
                                });
                              }}
                            />
                          </label>
                          <fieldset className="cr-benefits">
                            <legend>Membership Benefits</legend>
                            <div className="cr-benefits-grid">
                              <label className="field cr-quiet">
                                <span className="sr-only">Discount Rand</span>
                                <input
                                  inputMode="decimal"
                                  value={row.discount_rand}
                                  placeholder="Discount Rand"
                                  aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} discount rand`}
                                  onChange={(e) => {
                                    const discount_rand = e.target.value;
                                    const discount_percent = discount_rand.trim()
                                      ? ""
                                      : row.discount_percent;
                                    const hasDiscount = Boolean(
                                      discount_rand.trim() || discount_percent.trim(),
                                    );
                                    patchPrice(activity.clientKey, row.clientKey, {
                                      discount_rand,
                                      discount_percent,
                                      member_price: hasDiscount
                                        ? derivedMemberPrice(
                                            row.standard_price,
                                            discount_rand,
                                            discount_percent,
                                          )
                                        : row.discount_rand.trim()
                                          ? ""
                                          : row.member_price,
                                    });
                                  }}
                                />
                              </label>
                              <label className="field cr-quiet">
                                <span className="sr-only">Discount Percentage</span>
                                <input
                                  inputMode="decimal"
                                  value={row.discount_percent}
                                  placeholder="Discount Percentage"
                                  aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} discount percentage`}
                                  onChange={(e) => {
                                    const discount_percent = e.target.value;
                                    const discount_rand = discount_percent.trim()
                                      ? ""
                                      : row.discount_rand;
                                    const hasDiscount = Boolean(
                                      discount_rand.trim() || discount_percent.trim(),
                                    );
                                    patchPrice(activity.clientKey, row.clientKey, {
                                      discount_rand,
                                      discount_percent,
                                      member_price: hasDiscount
                                        ? derivedMemberPrice(
                                            row.standard_price,
                                            discount_rand,
                                            discount_percent,
                                          )
                                        : row.discount_percent.trim()
                                          ? ""
                                          : row.member_price,
                                    });
                                  }}
                                />
                              </label>
                              <label className="field cr-quiet">
                                <span className="sr-only">Membership Price</span>
                                <input
                                  readOnly
                                  tabIndex={-1}
                                  value={row.member_price}
                                  placeholder="Membership Price"
                                  aria-label={`Activity ${activityIndex + 1} sub activity ${priceIndex + 1} membership price`}
                                />
                              </label>
                            </div>
                          </fieldset>
                        </div>
                        <div className="cr-sub-remove">
                          <button
                            type="button"
                            className="cr-text-remove"
                            onClick={() => removePrice(activity.clientKey, row.clientKey)}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <label className="field cr-quiet cr-details">
                    <span className="sr-only">Activity Details</span>
                    <textarea
                      rows={4}
                      value={activity.description}
                      placeholder="Activity Details"
                      aria-label={`Activity ${activityIndex + 1} details`}
                      onChange={(e) =>
                        patchActivity(activity.clientKey, { description: e.target.value })
                      }
                    />
                  </label>
                  <button
                    className="cr-outline-btn"
                    type="button"
                    onClick={() => addPrice(activity.clientKey)}
                  >
                    Add Sub Activity
                  </button>
                </article>
              ))}
            </div>
            <button className="cr-outline-btn" type="button" onClick={addActivity}>
              Add Activity
            </button>
          </section>

          <section className={stepOpen("photos") ? "cr-step is-open" : "cr-step"} id="step-photos">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("photos")} onClick={() => toggleStep("photos")}>
                <em>Photos</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <div
              className={photoDrag ? "cr-photo-well is-over" : "cr-photo-well"}
              onDragEnter={(event) => {
                event.preventDefault();
                setPhotoDrag(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setPhotoDrag(true);
              }}
              onDragLeave={(event) => {
                if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
                setPhotoDrag(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setPhotoDrag(false);
                if (!photoPending) onUploadFiles(event.dataTransfer.files);
              }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => onUploadFiles(e.target.files)}
              />
              {media.length > 0 && (
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
                          e.stopPropagation();
                          setPhotoDrag(false);
                          if (e.dataTransfer.files.length > 0) {
                            if (!photoPending) onUploadFiles(e.dataTransfer.files);
                            dragMediaId.current = null;
                            return;
                          }
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
              )}
              <button
                className="cr-photo-add"
                type="button"
                disabled={photoPending}
                onClick={() => fileRef.current?.click()}
              >
                {photoStatus ?? "Add photos"}
              </button>
            </div>
          </section>

          <section className={stepOpen("audience") ? "cr-step is-open" : "cr-step"} id="step-audience">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("audience")} onClick={() => toggleStep("audience")}>
                <em>Who&apos;s it for?</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <div className="cr-audience-well">
              <div className="cr-audience-group">
                <p className="cr-about-label">Interests</p>
                <div className="cr-chip-grid">
                  {INTEREST_CHIPS.map((item) => {
                    const kind = catalog.kinds.find((row) => row.key === item.key);
                    if (!kind) return null;
                    const active = draft.kind_ids.includes(kind.id);
                    return (
                      <button
                        key={kind.id}
                        type="button"
                        className={active ? "cr-tag active" : "cr-tag"}
                        onClick={() => patch({ kind_ids: toggleId(draft.kind_ids, kind.id) })}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <label className="field cr-quiet">
                  <span className="sr-only">Interest keywords</span>
                  <input
                    value={draft.interest_keywords}
                    onChange={(event) => {
                      const interest_keywords = event.target.value;
                      patch({
                        interest_keywords,
                        interest_ids: interestIdsFromKeywords(interest_keywords, catalog.interests),
                      });
                    }}
                    placeholder='Keywords (Separate with ",")'
                    aria-label="Interest keywords"
                  />
                </label>
              </div>

              <div className="cr-audience-group">
                <p className="cr-about-label">Persona (How you go out)</p>
                <div className="cr-chip-grid">
                  {catalog.personas.map((persona) => {
                    const active = draft.persona_ids.includes(persona.id);
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        className={active ? "cr-tag active" : "cr-tag"}
                        onClick={() => patch({ persona_ids: toggleId(draft.persona_ids, persona.id) })}
                      >
                        {persona.title}
                      </button>
                    );
                  })}
                </div>
                <label className="field cr-quiet">
                  <span className="sr-only">Persona keywords</span>
                  <input
                    value={draft.persona_keywords}
                    onChange={(event) => patch({ persona_keywords: event.target.value })}
                    placeholder='Keywords (Separate with ",")'
                    aria-label="Persona keywords"
                  />
                </label>
              </div>

              <div className="cr-audience-group">
                <p className="cr-about-label">Adventure Level</p>
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
              </div>
            </div>
          </section>

          <section className={stepOpen("review") ? "cr-step is-open" : "cr-step"} id="step-review">
            <h2>
              <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("review")} onClick={() => toggleStep("review")}>
                <em>Permission &amp; Review</em>
                <i className="cr-step-caret" aria-hidden="true" />
              </button>
            </h2>
            <label className="cr-check">
              <input
                type="checkbox"
                checked={draft.authorised_to_submit}
                onChange={(e) => patch({ authorised_to_submit: e.target.checked })}
              />
              <span>I am authorised to submit this business on Venturo</span>
            </label>
            <label className="cr-check">
              <input
                type="checkbox"
                checked={draft.image_rights_granted}
                onChange={(e) => patch({ image_rights_granted: e.target.checked })}
              />
              <span>Images &amp; Copy may be used on the Application, Website, and Adverts</span>
            </label>
            <label className="cr-check">
              <input
                type="checkbox"
                checked={draft.terms_accepted}
                onChange={(e) => patch({ terms_accepted: e.target.checked })}
              />
              <span>
                I agree to the{" "}
                <a href="/terms" target="_blank" rel="noreferrer">
                  Terms and Conditions
                </a>
                ,{" "}
                <a href="/privacy_policy" target="_blank" rel="noreferrer">
                  Privacy Policy
                </a>
                , and{" "}
                <a href="/community-guidelines" target="_blank" rel="noreferrer">
                  Content
                </a>
              </span>
            </label>
            <div className="cr-audit">
              <p className="cr-about-label">Audit Review</p>
              {audit.length === 0 && <p className="muted">No staff actions yet.</p>}
              <ul>
                {audit.map((row) => {
                  const open = openAuditId === row.id;
                  const changes = auditChanges(row.before, row.after);
                  const when = formatAuditWhen(row.created_at);
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        className="cr-audit-row"
                        aria-expanded={open}
                        onClick={() => setOpenAuditId(open ? null : row.id)}
                      >
                        <span>{auditLabel(row)}</span>
                        <span>
                          {when} - {row.actor_name}
                        </span>
                      </button>
                      {open ? (
                        <div className="cr-audit-detail">
                          {changes.length === 0 ? (
                            <p>No field changes were stored for this entry.</p>
                          ) : (
                            changes.map((change) => (
                              <div key={change.label}>
                                <p>{change.label}</p>
                                {change.lines.map((line, index) => (
                                  <p key={`${change.label}-${index}`}>{line}</p>
                                ))}
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          </section>
        </div>

        <ListingAppPreview
          draft={draft}
          listing={listing}
          catalog={catalog}
          branches={branches}
        />
      </div>
      </div>
    </div>
  );
}
