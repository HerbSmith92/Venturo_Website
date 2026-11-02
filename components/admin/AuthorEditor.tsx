"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGuideAuthor, saveGuideAuthor, saveGuideAuthorAsset } from "@/app/admin/author-actions";
import { GuideAuthorCard } from "@/components/GuideAuthorCard";
import type { AuthorLatestGuide, GuideAuthor } from "@/lib/guide-authors";
import type { GuideStaffOption } from "@/lib/control-room-authors";
import { createClient } from "@/lib/supabase/client";

const PHOTO_LIMIT = 5 * 1024 * 1024;
const BIO_LIMIT = 250;

export function AuthorEditor({
  author,
  staff,
  latestGuide,
  error,
  canLinkStaff = false,
}: {
  author: GuideAuthor;
  staff: GuideStaffOption[];
  latestGuide: AuthorLatestGuide | null;
  error?: string;
  canLinkStaff?: boolean;
}) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(author.display_name !== "Untitled Author");
  const [dirty, setDirty] = useState(false);
  const [assetPending, setAssetPending] = useState<"photo" | "cover" | null>(null);
  const [draft, setDraft] = useState({
    display_name: author.display_name === "Untitled Author" ? "" : author.display_name,
    tagline: author.tagline ?? "",
    bio: author.bio ?? "",
    photo_url: author.photo_url ?? "",
    photo_storage_key: author.photo_storage_key ?? "",
    cover_url: author.cover_url ?? "",
    cover_storage_key: author.cover_storage_key ?? "",
    instagram_url: author.instagram_url ?? "",
    tiktok_url: author.tiktok_url ?? "",
    facebook_url: author.facebook_url ?? "",
    website_url: author.website_url ?? "",
    user_id: author.user_id ?? "",
  });

  const linkedStaff = staff.find((person) => person.id === draft.user_id) ?? null;
  const previewAuthor = useMemo(
    () => ({
      id: author.id,
      slug: author.slug,
      name: draft.display_name.trim() || "Author name",
      tagline: draft.tagline.trim() || "Headline",
      bio: draft.bio.trim() || null,
      photo: draft.photo_url.trim() || null,
      cover: draft.cover_url.trim() || null,
      instagramUrl: draft.instagram_url.trim() || null,
      tiktokUrl: draft.tiktok_url.trim() || null,
      facebookUrl: draft.facebook_url.trim() || null,
      websiteUrl: draft.website_url.trim() || null,
    }),
    [draft],
  );

  function patch(partial: Partial<typeof draft>) {
    setDraft((current) => ({ ...current, ...partial }));
    setDirty(true);
    setSaved(false);
  }

  async function onAsset(slot: "photo" | "cover", files: FileList | null) {
    const file = files?.[0];
    const input = slot === "cover" ? coverInput.current : photoInput.current;
    if (input) input.value = "";
    if (!file) return;
    setAssetPending(slot);
    setSaveError(null);
    const supabase = createClient();
    if (!supabase) {
      setSaveError("Could not reach photo storage.");
      setAssetPending(null);
      return;
    }
    const allowed = file.type.startsWith("image/") || /\.(jpe?g|png)$/i.test(file.name);
    if (!allowed || /heic|heif|webp|gif/i.test(file.type)) {
      setSaveError("Use a JPEG or PNG, up to 5 MB.");
      setAssetPending(null);
      return;
    }
    if (file.size > PHOTO_LIMIT) {
      setSaveError("Keep the photo under 5 MB.");
      setAssetPending(null);
      return;
    }
    const ext = /\.png$/i.test(file.name) ? "png" : "jpg";
    const storageKey = `${author.id}/${slot}-${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("guide-authors").upload(storageKey, file, {
      cacheControl: "3600",
      contentType: ext === "png" ? "image/png" : "image/jpeg",
      upsert: false,
    });
    if (uploadError) {
      setSaveError(uploadError.message);
      setAssetPending(null);
      return;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("guide-authors").getPublicUrl(storageKey);
    const previousKey = slot === "cover" ? draft.cover_storage_key : draft.photo_storage_key;
    const saved = await saveGuideAuthorAsset(author.id, slot, publicUrl, storageKey);
    if (!saved.ok) {
      setSaveError(saved.error);
      await supabase.storage.from("guide-authors").remove([storageKey]);
      setAssetPending(null);
      return;
    }
    if (previousKey) {
      await supabase.storage.from("guide-authors").remove([previousKey]);
    }
    if (slot === "cover") {
      patch({ cover_url: publicUrl, cover_storage_key: storageKey });
    } else {
      patch({ photo_url: publicUrl, photo_storage_key: storageKey });
    }
    setAssetPending(null);
  }

  const creating = author.display_name === "Untitled Author" && !draft.display_name.trim();

  function onDelete() {
    const label = creating ? "this draft author" : draft.display_name.trim() || author.display_name;
    if (!window.confirm(`Delete ${label}? Guides stay live. The name comes off them. This cannot be undone.`)) {
      return;
    }
    setSaveError(null);
    startTransition(async () => {
      const result = await deleteGuideAuthor(author.id);
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      router.push("/admin/authors");
      router.refresh();
    });
  }

  function onSave() {
    setSaveError(null);
    startTransition(async () => {
      const staffTaken =
        Boolean(draft.user_id) &&
        staff.some((person) => person.id === draft.user_id && person.linkedAuthorId && person.linkedAuthorId !== author.id);
      const result = await saveGuideAuthor(author.id, {
        ...draft,
        bio: draft.bio.slice(0, BIO_LIMIT),
        user_id: staffTaken ? "" : draft.user_id,
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setDirty(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="author-studio">
      <div className="author-studio-main cr-paper">
        <header className="author-studio-head">
          <div>
            <p className="author-studio-crumb">
              <a href="/admin/guides">Guides</a>
              <span> / </span>
              <a href="/admin/authors">Authors</a>
              <span> / </span>
              {creating ? "Create profile" : "Edit profile"}
            </p>
            <h1>Your Next Chapter</h1>
            <p className="lede muted">
              {canLinkStaff
                ? "Create the author profile & put their name on the next Guide."
                : "Fill in your Author card. This is how you appear on Guides you write."}
            </p>
          </div>
          <p className="author-studio-draft">{saved && !dirty ? "Saved" : "Draft"}</p>
        </header>
        {(error || saveError) && <p className="error">{error || saveError}</p>}

        <article className="author-studio-card">
          <h2>
            <span>01</span> About You
          </h2>
          <div className="author-studio-cover">
            {draft.cover_url ? (
              <img src={draft.cover_url} alt="" />
            ) : (
              <div className="author-studio-cover-empty" aria-hidden="true" />
            )}
            <div>
              <p className="author-studio-photo-label">Cover photo</p>
              <input
                ref={coverInput}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => void onAsset("cover", e.target.files)}
              />
              <button
                className="author-upload"
                type="button"
                onClick={() => coverInput.current?.click()}
                disabled={assetPending !== null}
              >
                {assetPending === "cover" ? "Uploading…" : draft.cover_url ? "Change cover" : "Upload cover"}
              </button>
              <p className="muted">Wide JPEG or PNG for the banner on the author card.</p>
            </div>
          </div>
          <div className="author-studio-photo">
            {draft.photo_url ? (
              <img src={draft.photo_url} alt="" />
            ) : (
              <div className="author-studio-photo-empty" aria-hidden="true">
                {draft.display_name.trim().charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <div>
              <p className="author-studio-photo-label">Profile photo</p>
              <input
                ref={photoInput}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => void onAsset("photo", e.target.files)}
              />
              <button
                className="author-upload"
                type="button"
                onClick={() => photoInput.current?.click()}
                disabled={assetPending !== null}
              >
                {assetPending === "photo" ? "Uploading…" : "Upload photo"}
              </button>
              <p className="muted">JPG or PNG · Up to 5 MB</p>
            </div>
          </div>
          <div className="cr-grid-2">
            <label className="field">
              <span>Display name</span>
              <input
                value={draft.display_name}
                onChange={(e) => patch({ display_name: e.target.value })}
                placeholder="Name as it should appear on Guides"
              />
            </label>
            <label className="field">
              <span>Short headline</span>
              <input
                value={draft.tagline}
                onChange={(e) => patch({ tagline: e.target.value })}
                placeholder="One-line headline"
              />
            </label>
          </div>
          <label className="field">
            <span>Bio</span>
            <textarea
              rows={4}
              maxLength={BIO_LIMIT}
              value={draft.bio}
              onChange={(e) => patch({ bio: e.target.value.slice(0, BIO_LIMIT) })}
              placeholder="Short bio for the author card"
            />
            <small className="author-studio-count">
              Keep it to {BIO_LIMIT} characters. {draft.bio.length}/{BIO_LIMIT}
            </small>
          </label>
        </article>

        <article className="author-studio-card">
          <h2>
            <span>02</span> Find You Online
          </h2>
          <p className="muted">Add the places where readers can follow the adventures.</p>
          <div className="cr-grid-2">
            <label className="field">
              <span>Instagram</span>
              <input
                value={draft.instagram_url}
                placeholder="Instagram URL or @handle"
                onChange={(e) => patch({ instagram_url: e.target.value })}
              />
            </label>
            <label className="field">
              <span>TikTok</span>
              <input
                value={draft.tiktok_url}
                placeholder="TikTok URL or @handle"
                onChange={(e) => patch({ tiktok_url: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Facebook</span>
              <input
                value={draft.facebook_url}
                placeholder="Facebook URL"
                onChange={(e) => patch({ facebook_url: e.target.value })}
              />
            </label>
            <label className="field">
              <span>Website</span>
              <input
                value={draft.website_url}
                placeholder="Website URL"
                onChange={(e) => patch({ website_url: e.target.value })}
              />
            </label>
          </div>
        </article>

        {canLinkStaff ? (
          <article className="author-studio-card">
            <h2>
              <span>03</span> Staff login
            </h2>
            <p className="muted">Optional. Link an existing staff login so they write as this card.</p>
            <div className="author-studio-account">
              <div>
                <p>{linkedStaff ? linkedStaff.display_name : "Not linked"}</p>
                <p className="muted">
                  {linkedStaff
                    ? `${linkedStaff.email} · Guides they write can use this card.`
                    : "Writers invited by email fill their own card. Use this only for staff."}
                </p>
              </div>
              {linkedStaff ? <p className="author-studio-linked">Linked</p> : null}
            </div>
            <label className="field">
              <span>Writes as this staff user</span>
              <select value={draft.user_id} onChange={(e) => patch({ user_id: e.target.value })}>
                <option value="">Not linked</option>
                {staff.map((person) => {
                  const taken = Boolean(person.linkedAuthorId) && person.linkedAuthorId !== author.id;
                  return (
                    <option key={person.id} value={person.id} disabled={taken}>
                      {person.display_name} ({person.role})
                      {taken ? " — already linked" : ""}
                    </option>
                  );
                })}
              </select>
            </label>
          </article>
        ) : null}

        <footer className="author-studio-foot">
          <p className="muted">
            {pending ? "Saving…" : saved && !dirty ? "All changes saved." : "Unsaved changes stay on this screen until you save."}
          </p>
          <div className="cr-actions">
            {canLinkStaff ? (
              <button className="btn btn-secondary" type="button" onClick={onDelete} disabled={pending}>
                Delete
              </button>
            ) : null}
            <a className="btn btn-secondary" href={canLinkStaff ? "/admin/authors" : "/admin/guides"}>
              Back
            </a>
            <button className="btn btn-primary" type="button" onClick={onSave} disabled={pending}>
              {pending ? "Saving…" : "Save Author"}
            </button>
          </div>
        </footer>
      </div>

      <aside className="author-studio-aside">
        <p className="eyebrow">Public Profile Preview</p>
        <GuideAuthorCard
          author={previewAuthor}
          latestGuide={latestGuide}
          onEditCover={() => coverInput.current?.click()}
        />
        <p className="muted">This is how readers will see the author on Venturo.</p>
        <div className="author-studio-tip">
          <p>Make It Yours</p>
          <p>Use a recognisable photo &amp; a bio that sounds like them. Authentic profiles help readers connect with the Guides.</p>
        </div>
      </aside>
    </section>
  );
}
