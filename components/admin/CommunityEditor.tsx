"use client";

import { useRef, useState, useTransition } from "react";
import { approveCommunityEvent, saveCommunityDraft } from "@/app/admin/content-actions";
import { createClient } from "@/lib/supabase/client";
import {
  communityStatusLabel,
  type CommunityEventLink,
  type CommunityPhoto,
  type CommunityRecord,
  type CommunityStatus,
} from "@/lib/community-shared";
import { INTEREST_CHIPS } from "@/lib/listing-draft";

const STATUSES: CommunityStatus[] = ["requested", "draft", "published", "archived", "suspended"];

const STEPS = [
  { key: "listing", label: "The Listing" },
  { key: "location", label: "Location" },
  { key: "contact", label: "Contact & Socials" },
  { key: "photos", label: "Photos" },
  { key: "audience", label: "Who's it for?" },
  { key: "events", label: "Listed Events" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

type AudienceCatalog = {
  kinds: { id: string; key: string; title: string }[];
  personas: { id: string; title: string }[];
  scales: { id: string; title: string; subtitle: string }[];
};

const PHOTO_LIMIT = 10 * 1024 * 1024;

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

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

function formatWhen(iso: string | null) {
  if (!iso) return "Date still to come";
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(iso));
}

function eventStatusLabel(status: string) {
  if (status === "review") return "In Review";
  if (status === "approved") return "Live";
  if (status === "rejected") return "Rejected";
  if (status === "cancelled") return "Cancelled";
  if (status === "draft") return "Draft";
  return status;
}

export function CommunityEditor({
  community,
  catalog,
  photos,
  kindIds,
  personaIds,
  events,
  notice,
  error,
}: {
  community: CommunityRecord;
  catalog: AudienceCatalog;
  photos: CommunityPhoto[];
  kindIds: string[];
  personaIds: string[];
  events: CommunityEventLink[];
  notice?: string;
  error?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [photoPending, setPhotoPending] = useState(false);
  const [photoDrag, setPhotoDrag] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState<StepKey>("listing");
  const [openSteps, setOpenSteps] = useState<Partial<Record<StepKey, boolean>>>({});
  const [media, setMedia] = useState(photos);
  const [links, setLinks] = useState(events);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: community.title,
    about: community.about ?? "",
    areas: community.areas.length ? community.areas : [""],
    contactEmail: community.contactEmail ?? "",
    phone: community.phone ?? "",
    websiteUrl: community.websiteUrl ?? "",
    instagramUrl: community.instagramUrl ?? "",
    facebookUrl: community.facebookUrl ?? "",
    tiktokUrl: community.tiktokUrl ?? "",
    founderName: community.founderName ?? "",
    founderEmail: community.founderEmail ?? "",
    kindIds,
    interestKeywords: community.interestKeywords,
    personaIds,
    scaleId: community.scaleId ?? "",
    status: community.status,
    isFeatured: community.isFeatured,
  });

  function stepOpen(key: StepKey) {
    return openSteps[key] !== false;
  }

  function jump(key: StepKey) {
    setActiveStep(key);
    setOpenSteps((current) => ({ ...current, [key]: true }));
    document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function patch(next: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...next }));
  }

  function onSave() {
    setSaveError(null);
    startTransition(async () => {
      const result = await saveCommunityDraft(community.id, draft);
      if (result && !result.ok) setSaveError(result.error);
    });
  }

  async function onApprove(eventId: string) {
    setApprovingId(eventId);
    setSaveError(null);
    const result = await approveCommunityEvent(community.id, eventId);
    setApprovingId(null);
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    setLinks((current) =>
      current.map((item) => (item.id === eventId ? { ...item, linkStatus: "approved" } : item)),
    );
  }

  async function onUploadFiles(files: FileList | File[] | null) {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setPhotoPending(true);
    setSaveError(null);
    const supabase = createClient();
    if (!supabase) {
      setSaveError("Could not reach photo storage.");
      setPhotoPending(false);
      return;
    }
    const added: CommunityPhoto[] = [];
    for (const file of list) {
      const allowed = file.type.startsWith("image/") || /\.(jpe?g|png|webp|gif)$/i.test(file.name);
      if (!allowed || /heic|heif/i.test(file.type) || /\.heic$/i.test(file.name)) {
        setSaveError(`${file.name}: use a JPEG, PNG, WebP, or GIF.`);
        continue;
      }
      if (file.size > PHOTO_LIMIT) {
        setSaveError(`${file.name}: keep it under 10 MB.`);
        continue;
      }
      const ext = photoExt(file);
      const storageKey = `${community.id}/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("community-media").upload(storageKey, file, {
        cacheControl: "3600",
        contentType: file.type.startsWith("image/") ? file.type : "image/jpeg",
        upsert: false,
      });
      if (uploadError) {
        setSaveError(`${file.name}: ${uploadError.message}`);
        continue;
      }
      const {
        data: { publicUrl },
      } = supabase.storage.from("community-media").getPublicUrl(storageKey);
      const makeCover = media.length + added.length === 0;
      const { data: row, error: insertError } = await supabase
        .from("community_photos")
        .insert({
          community_id: community.id,
          storage_key: storageKey,
          public_url: publicUrl,
          is_cover: makeCover,
          sort_order: media.length + added.length,
        })
        .select("id, public_url, storage_key, is_cover, sort_order")
        .single();
      if (insertError || !row) {
        await supabase.storage.from("community-media").remove([storageKey]);
        setSaveError(`${file.name}: ${insertError?.message ?? "Could not save the photo."}`);
        continue;
      }
      if (makeCover) {
        await supabase.from("communities").update({ cover_url: publicUrl }).eq("id", community.id);
      }
      added.push({
        id: row.id as string,
        publicUrl: row.public_url as string,
        storageKey: row.storage_key as string,
        isCover: Boolean(row.is_cover),
        sortOrder: (row.sort_order as number) ?? 0,
      });
    }
    if (added.length) setMedia((current) => [...current, ...added]);
    setPhotoPending(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onMakeCover(photo: CommunityPhoto) {
    const supabase = createClient();
    if (!supabase) return;
    await supabase.from("community_photos").update({ is_cover: false }).eq("community_id", community.id);
    await supabase.from("community_photos").update({ is_cover: true }).eq("id", photo.id);
    await supabase.from("communities").update({ cover_url: photo.publicUrl }).eq("id", community.id);
    setMedia((current) => current.map((item) => ({ ...item, isCover: item.id === photo.id })));
  }

  async function onDeletePhoto(photo: CommunityPhoto) {
    const supabase = createClient();
    if (!supabase) return;
    setPhotoPending(true);
    await supabase.storage.from("community-media").remove([photo.storageKey]);
    await supabase.from("community_photos").delete().eq("id", photo.id);
    const next = media.filter((item) => item.id !== photo.id);
    const cover = next.find((item) => item.isCover) ?? next[0];
    if (cover && !cover.isCover) {
      await supabase.from("community_photos").update({ is_cover: true }).eq("id", cover.id);
      await supabase.from("communities").update({ cover_url: cover.publicUrl }).eq("id", community.id);
    }
    if (!next.length) {
      await supabase.from("communities").update({ cover_url: null }).eq("id", community.id);
    }
    setMedia(
      next.map((item) => ({
        ...item,
        isCover: cover ? item.id === cover.id : false,
      })),
    );
    setPhotoPending(false);
  }

  const heading = draft.title.trim() || "Create Groups";

  return (
    <div className="cr-editor-page">
      <aside className="cr-edit-nav" aria-label="Create group">
        <a className="cr-edit-spine" href="/admin/communities">
          <span className="cr-edit-spine-mark" aria-hidden="true" />
          <span>Communities</span>
        </a>
        <div className="cr-edit-nav-body">
          <a className="cr-edit-brand" href="/admin/communities" aria-label="Communities">
            <img src="/brand/logos/venturo-horizontal-simple-light.svg" alt="Venturo" />
          </a>
          <p className="cr-edit-title">Communities</p>
          <p className="cr-edit-current">Create Groups</p>
          <p className="cr-edit-group">Content</p>
          <p className="cr-edit-section">Communities</p>
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
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
          <div className="cr-edit-status">
            <p>Community Status</p>
            <label className="field">
              <span className="sr-only">Status</span>
              <select
                value={draft.status}
                aria-label="Community status"
                onChange={(event) => patch({ status: event.target.value as CommunityStatus })}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {communityStatusLabel(status)}
                  </option>
                ))}
              </select>
            </label>
            <label className="cr-check">
              <input
                type="checkbox"
                checked={draft.isFeatured}
                onChange={(event) => patch({ isFeatured: event.target.checked })}
              />
              <span>Featured</span>
            </label>
          </div>
        </div>
      </aside>
      <div className="cr-editor-stage">
        <header className="cr-editor-head">
          <div>
            <p className="cr-editor-kicker">Communities</p>
            <h1>{heading}</h1>
          </div>
        </header>
        {(error || saveError) && <p className="error">{error || saveError}</p>}
        {notice && <p className="notice">{notice}</p>}
        <div className="cr-editor is-single">
          <div className="cr-paper">
            <section className={stepOpen("listing") ? "cr-step is-open" : "cr-step"} id="step-listing">
              <h2>
                <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("listing")} onClick={() => setOpenSteps((current) => ({ ...current, listing: !stepOpen("listing") }))}>
                  <em>The Listing</em>
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <label className="field cr-quiet">
                <span className="sr-only">Community Name</span>
                <input
                  value={draft.title}
                  placeholder="Community Name"
                  aria-label="Community Name"
                  onChange={(event) => patch({ title: event.target.value })}
                />
              </label>
              <p className="cr-about-label">About</p>
              <label className="field cr-quiet cr-long">
                <textarea
                  rows={6}
                  value={draft.about}
                  placeholder="About"
                  aria-label="About"
                  onChange={(event) => patch({ about: event.target.value })}
                />
              </label>
            </section>

            <section className={stepOpen("location") ? "cr-step is-open" : "cr-step"} id="step-location">
              <h2>
                <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("location")} onClick={() => setOpenSteps((current) => ({ ...current, location: !stepOpen("location") }))}>
                  <em>Location</em>
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <p className="muted">Areas where this community hosts events.</p>
              {draft.areas.map((area, index) => (
                <div className="cr-known-row" key={index}>
                  <label className="field cr-quiet">
                    <span className="sr-only">Area {index + 1}</span>
                    <input
                      value={area}
                      placeholder="Area"
                      aria-label={`Area ${index + 1}`}
                      onChange={(event) => {
                        const areas = [...draft.areas];
                        areas[index] = event.target.value;
                        patch({ areas });
                      }}
                    />
                  </label>
                  {draft.areas.length > 1 ? (
                    <button
                      type="button"
                      className="cr-text-remove"
                      onClick={() => patch({ areas: draft.areas.filter((_, item) => item !== index) })}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              <button
                className="cr-outline-btn"
                type="button"
                onClick={() => patch({ areas: [...draft.areas, ""] })}
              >
                Add area
              </button>
            </section>

            <section className={stepOpen("contact") ? "cr-step is-open" : "cr-step"} id="step-contact">
              <h2>
                <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("contact")} onClick={() => setOpenSteps((current) => ({ ...current, contact: !stepOpen("contact") }))}>
                  <em>Contact &amp; Socials</em>
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <div className="cr-grid-2">
                <label className="field cr-quiet">
                  <span className="sr-only">Email Address</span>
                  <input
                    type="email"
                    value={draft.contactEmail}
                    placeholder="Email Address"
                    aria-label="Email Address"
                    onChange={(event) => patch({ contactEmail: event.target.value })}
                  />
                </label>
                <label className="field cr-quiet">
                  <span className="sr-only">Contact Number</span>
                  <input
                    type="tel"
                    value={draft.phone}
                    placeholder="Contact Number"
                    aria-label="Contact Number"
                    onChange={(event) => patch({ phone: event.target.value })}
                  />
                </label>
              </div>
              <label className="field cr-quiet">
                <span className="sr-only">Website</span>
                <input
                  type="url"
                  value={draft.websiteUrl}
                  placeholder="Website"
                  aria-label="Website"
                  onChange={(event) => patch({ websiteUrl: event.target.value })}
                />
              </label>
              <div className="cr-grid-2">
                <label className="field cr-quiet">
                  <span className="sr-only">Founder name</span>
                  <input
                    value={draft.founderName}
                    placeholder="Founder name"
                    aria-label="Founder name"
                    onChange={(event) => patch({ founderName: event.target.value })}
                  />
                </label>
                <label className="field cr-quiet">
                  <span className="sr-only">Founder email</span>
                  <input
                    type="email"
                    value={draft.founderEmail}
                    placeholder="Founder email"
                    aria-label="Founder email"
                    onChange={(event) => patch({ founderEmail: event.target.value })}
                  />
                </label>
              </div>
              <p className="cr-about-label">Social Handles</p>
              <div className="cr-grid-3">
                <label className="field cr-quiet">
                  <span className="sr-only">Instagram</span>
                  <input
                    value={draft.instagramUrl}
                    placeholder="@Instagram"
                    aria-label="Instagram"
                    onChange={(event) => patch({ instagramUrl: event.target.value })}
                  />
                </label>
                <label className="field cr-quiet">
                  <span className="sr-only">Facebook</span>
                  <input
                    value={draft.facebookUrl}
                    placeholder="Facebook"
                    aria-label="Facebook"
                    onChange={(event) => patch({ facebookUrl: event.target.value })}
                  />
                </label>
                <label className="field cr-quiet">
                  <span className="sr-only">TikTok</span>
                  <input
                    value={draft.tiktokUrl}
                    placeholder="TikTok"
                    aria-label="TikTok"
                    onChange={(event) => patch({ tiktokUrl: event.target.value })}
                  />
                </label>
              </div>
            </section>

            <section className={stepOpen("photos") ? "cr-step is-open" : "cr-step"} id="step-photos">
              <h2>
                <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("photos")} onClick={() => setOpenSteps((current) => ({ ...current, photos: !stepOpen("photos") }))}>
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
                  if (!photoPending) void onUploadFiles(event.dataTransfer.files);
                }}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  hidden
                  onChange={(event) => void onUploadFiles(event.target.files)}
                />
                {media.length > 0 ? (
                  <div className="cr-photo-grid">
                    {media.map((photo) => (
                      <div key={photo.id} className={photo.isCover ? "cr-photo active" : "cr-photo"}>
                        <img src={photo.publicUrl} alt="" />
                        <div className="cr-photo-actions">
                          <button type="button" onClick={() => void onMakeCover(photo)}>
                            {photo.isCover ? "Cover" : "Make Cover"}
                          </button>
                          <button type="button" className="danger" onClick={() => void onDeletePhoto(photo)} disabled={photoPending}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <button className="cr-photo-add" type="button" disabled={photoPending} onClick={() => fileRef.current?.click()}>
                  {photoPending ? "Uploading…" : "Add photos"}
                </button>
              </div>
            </section>

            <section className={stepOpen("audience") ? "cr-step is-open" : "cr-step"} id="step-audience">
              <h2>
                <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("audience")} onClick={() => setOpenSteps((current) => ({ ...current, audience: !stepOpen("audience") }))}>
                  <em>Who&apos;s it for?</em>
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <p className="muted">These choices recommend the community to the right people.</p>
              <div className="cr-audience-well">
                <div className="cr-audience-group">
                  <p className="cr-about-label">Interests</p>
                  <div className="cr-chip-grid">
                    {INTEREST_CHIPS.map((item) => {
                      const kind = catalog.kinds.find((row) => row.key === item.key);
                      if (!kind) return null;
                      const active = draft.kindIds.includes(kind.id);
                      return (
                        <button
                          key={kind.id}
                          type="button"
                          className={active ? "cr-tag active" : "cr-tag"}
                          onClick={() => patch({ kindIds: toggleId(draft.kindIds, kind.id) })}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <label className="field cr-quiet">
                    <span className="sr-only">Interest keywords</span>
                    <input
                      value={draft.interestKeywords}
                      placeholder='Keywords (Separate with ",")'
                      aria-label="Interest keywords"
                      onChange={(event) => patch({ interestKeywords: event.target.value })}
                    />
                  </label>
                </div>
                <div className="cr-audience-group">
                  <p className="cr-about-label">Persona (How you go out)</p>
                  <div className="cr-chip-grid">
                    {catalog.personas.map((persona) => {
                      const active = draft.personaIds.includes(persona.id);
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          className={active ? "cr-tag active" : "cr-tag"}
                          onClick={() => patch({ personaIds: toggleId(draft.personaIds, persona.id) })}
                        >
                          {persona.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="cr-audience-group">
                  <p className="cr-about-label">Adventure Level</p>
                  <div className="cr-chip-grid">
                    {catalog.scales.map((scale) => {
                      const active = draft.scaleId === scale.id;
                      return (
                        <button
                          key={scale.id}
                          type="button"
                          className={active ? "cr-tag active" : "cr-tag"}
                          title={scale.subtitle}
                          onClick={() => patch({ scaleId: active ? "" : scale.id })}
                        >
                          {scale.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>

            <section className={stepOpen("events") ? "cr-step is-open" : "cr-step"} id="step-events">
              <h2>
                <button type="button" className="cr-step-toggle" aria-expanded={stepOpen("events")} onClick={() => setOpenSteps((current) => ({ ...current, events: !stepOpen("events") }))}>
                  <em>Listed Events</em>
                  <i className="cr-step-caret" aria-hidden="true" />
                </button>
              </h2>
              <p className="muted">
                Events created by this community&apos;s account land here on their own. Approve one before it shows on the community page.
              </p>
              {links.length === 0 ? <p className="muted">No events linked yet.</p> : null}
              <div className="cr-activity-list">
                {links.map((event) => (
                  <article className="cr-activity-board" key={event.id}>
                    <div className="cr-activity-kicker">
                      <p>{event.title}</p>
                      {event.linkStatus === "pending" ? (
                        <button type="button" className="cr-outline-btn" disabled={approvingId === event.id} onClick={() => void onApprove(event.id)}>
                          {approvingId === event.id ? "Approving…" : "Approve"}
                        </button>
                      ) : (
                        <p>Approved</p>
                      )}
                    </div>
                    <p className="muted">
                      {formatWhen(event.startsAt)}
                      {event.city ? ` · ${event.city}` : ""}
                      {` · ${eventStatusLabel(event.status)}`}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
