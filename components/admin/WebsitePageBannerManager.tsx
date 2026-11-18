"use client";

import { MediaUploadField } from "@/components/admin/manage/MediaUploadField";
import type { WebsiteBannerPage } from "@/lib/website-banners";
import { WEBSITE_BANNER_PAGES } from "@/lib/website-banners";
import { useState } from "react";

export function WebsitePageBannerManager({
  page,
  initialImageUrl,
}: {
  page: WebsiteBannerPage;
  initialImageUrl: string;
}) {
  const meta = WEBSITE_BANNER_PAGES[page];
  const [imageUrl, setImageUrl] = useState(initialImageUrl || meta.defaultImage);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setMessage(null);
    setError(null);
    const form = new FormData();
    form.set("page", page);
    form.set("file", file);
    const response = await fetch("/api/admin/website/banner-image", {
      method: "POST",
      body: form,
    });
    const body = (await response.json()) as { error?: string; url?: string };
    setBusy(false);
    if (!response.ok || !body.url) {
      setError(body.error || "Could not update that banner image.");
      return;
    }
    setImageUrl(body.url);
    setMessage("Banner image updated on the public site.");
  }

  return (
    <section className="cr-manage">
      <header className="cr-manage-head">
        <div>
          <p className="eyebrow">Website · {meta.label}</p>
          <h1>Banner image</h1>
          <p className="lede muted">
            Choose the featured image at the top of{" "}
            <a href={meta.publicPath} target="_blank" rel="noreferrer">
              {meta.publicPath}
            </a>
            . Copy stays as it is — only the picture changes.
          </p>
        </div>
        <a className="btn btn-secondary" href={meta.publicPath} target="_blank" rel="noreferrer">
          View public page
        </a>
      </header>

      {message ? (
        <p className="notice" role="status">
          {message}
        </p>
      ) : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="cr-manage-layout">
        <article className="studio-card">
          <MediaUploadField
            label={`${meta.label} banner`}
            url={imageUrl || null}
            busy={busy}
            showLightDark={false}
            guidance={{
              recommended: "Wide landscape photo works best. Keep the subject clear of the left copy.",
              maxMb: 3,
              transparentOk: false,
            }}
            onFile={(file) => void upload(file)}
          />
        </article>

        <aside className="cr-manage-aside">
          <article className="studio-card">
            <p className="eyebrow">Preview</p>
            <h2>Current banner</h2>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt=""
                style={{
                  width: "100%",
                  borderRadius: 16,
                  aspectRatio: "16 / 10",
                  objectFit: "cover",
                  marginTop: 12,
                }}
              />
            ) : (
              <p className="muted" style={{ marginTop: 12 }}>
                No image yet. Upload one to feature it on the public page.
              </p>
            )}
          </article>
        </aside>
      </div>
    </section>
  );
}
