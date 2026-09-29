"use client";

import { useMemo, useRef, useState } from "react";
import type { ListingDetail } from "@/lib/control-room-types";
import {
  formatAppPrice,
  previewChips,
  previewHours,
  previewPrices,
  activeMedia,
  type EditorBranch,
  type EditorCatalog,
  type ListingDraft,
} from "@/lib/listing-draft";

function asRating(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function asCount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function relatedPrice(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "Free";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n === 0) return "Free";
  return `From R ${n.toFixed(0)}`;
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 12h16M12 4c2.5 2.8 3.8 5.4 3.8 8S14.5 17.2 12 20c-2.5-2.8-3.8-5.4-3.8-8S9.5 6.8 12 4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 7l7 6 7-6" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconCamera() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 8h2l1-1.5h2L14 8h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="12" cy="13" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M13.5 20v-7h2.4l.4-2.6h-2.8V8.8c0-.8.2-1.3 1.4-1.3H16.5V5.1c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v1.5H8v2.6h2.4V20h3.1Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 5.5c0-.8.7-1.5 1.5-1.5h1.2c.6 0 1.1.4 1.3 1l.6 1.7c.2.5 0 1.1-.4 1.4L11 9.4a11 11 0 0 0 3.6 3.6l1.3-1.2c.3-.4.9-.6 1.4-.4l1.7.6c.6.2 1 .7 1 1.3v1.2c0 .8-.7 1.5-1.5 1.5C12.3 16 8 11.7 8 5.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="cr-phone-stars" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => {
        const state = rating >= star ? "filled" : rating >= star - 0.5 ? "half" : undefined;
        return (
          <span key={star} className={state}>
            ★
          </span>
        );
      })}
    </span>
  );
}

function IconBack() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M14.5 6 8.5 12l6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconHeart() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 18.2s-6.2-3.7-6.2-8.1A3.4 3.4 0 0 1 12 8a3.4 3.4 0 0 1 6.2 2.1c0 4.4-6.2 8.1-6.2 8.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShare() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 14V5M12 5l-3 3M12 5l3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 12.5V17a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="15" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 10h16M8 3.5v3M16 3.5v3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5 13.4 9 19 10.5 13.4 12 12 17.5 10.6 12 5 10.5 10.6 9 12 3.5Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 15.5 18.6 17.4 20.5 18 18.6 18.6 18 20.5 17.4 18.6 15.5 18 17.4 17.4 18 15.5Z" fill="currentColor" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="m14.8 9.2-1.3 4.3-4.3 1.3 1.3-4.3 4.3-1.3Z" fill="currentColor" />
    </svg>
  );
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="9" r="2.4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="16" cy="10" r="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4.8 18.2c.6-2.2 2.3-3.4 4.2-3.4s3.6 1.2 4.2 3.4M14 14.8c1.4 0 2.8.8 3.4 2.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconWallet() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="4.5" width="12" height="15" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 8.5h6M8 12h6M8 15.5h4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function StatusSignals() {
  return (
    <span className="cr-device-signals" aria-hidden="true">
      <svg viewBox="0 0 18 12">
        <rect x="0" y="7" width="3" height="5" rx="0.6" fill="currentColor" />
        <rect x="5" y="4.5" width="3" height="7.5" rx="0.6" fill="currentColor" />
        <rect x="10" y="2" width="3" height="10" rx="0.6" fill="currentColor" />
        <rect x="15" y="0" width="3" height="12" rx="0.6" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 16 12">
        <path d="M8 10.2 1.2 4.2a9 9 0 0 1 13.6 0L8 10.2Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 10.2 4.2 6.8a5 5 0 0 1 7.6 0L8 10.2Z" fill="currentColor" />
      </svg>
      <svg viewBox="0 0 26 12">
        <rect x="0.6" y="1" width="21" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <rect x="2.2" y="2.6" width="8" height="6.8" rx="1" fill="currentColor" />
        <rect x="22.4" y="3.6" width="1.8" height="4.8" rx="0.6" fill="currentColor" />
      </svg>
    </span>
  );
}

export function ListingAppPreview({
  draft,
  listing,
  catalog,
  branches,
}: {
  draft: ListingDraft;
  listing: ListingDetail;
  catalog: EditorCatalog;
  branches: EditorBranch[];
}) {
  const [descOpen, setDescOpen] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [tab, setTab] = useState<"info" | "reviews">("info");
  const [barSolid, setBarSolid] = useState(false);
  const screenRef = useRef<HTMLDivElement>(null);
  const hours = previewHours(draft);
  const prices = previewPrices(draft, 8);
  const media = activeMedia(draft);
  const chips = previewChips(draft, catalog);
  const cover = media[heroIndex] ?? media[0] ?? null;
  const rating = asRating(listing.google_rating);
  const reviews = asCount(listing.google_review_count);
  const description = draft.description || draft.short_description || "";
  const shortDesc =
    description.length > 220 && !descOpen
      ? `${description.slice(0, 220).trim()}…`
      : description;
  const address = [
    draft.street_address_1,
    draft.street_address_2,
    draft.suburb,
    draft.city,
    draft.postal_code,
  ]
    .filter(Boolean)
    .join(", ");
  const lat = Number(draft.latitude);
  const lng = Number(draft.longitude);
  const hasPin = Number.isFinite(lat) && Number.isFinite(lng);
  const mapQuery = hasPin
    ? `${lat},${lng}`
    : draft.maps_url || address;
  const instagram = draft.social.find((row) => row.platform === "instagram")?.handle;
  const facebook = draft.social.find((row) => row.platform === "facebook")?.handle;
  const social = [
    { key: "website", label: "Website", show: Boolean(draft.website_url.trim()), icon: <IconGlobe /> },
    { key: "email", label: "Email", show: Boolean(draft.email.trim()), icon: <IconMail /> },
    { key: "instagram", label: "Instagram", show: Boolean(instagram?.trim()), icon: <IconCamera /> },
    { key: "facebook", label: "Facebook", show: Boolean(facebook?.trim()), icon: <IconFacebook /> },
    { key: "phone", label: "Phone", show: Boolean(draft.phone.trim()), icon: <IconPhone /> },
  ].filter((item) => item.show);
  const related = useMemo(
    () => branches.filter((branch) => branch.id !== listing.id).slice(0, 3),
    [branches, listing.id],
  );

  return (
    <aside className="cr-phone-wrap" aria-label="Discover listing preview">
      <p className="cr-phone-label">Application Preview</p>
      <div className="cr-device">
        <div className="cr-device-bezel">
          <div className="cr-device-screen cr-phone">
            <div className={barSolid ? "cr-device-status is-solid" : "cr-device-status"} aria-hidden="true">
              <span>16:18</span>
              <span className="cr-device-island" />
              <StatusSignals />
            </div>
            <div
              className="cr-phone-screen"
              ref={screenRef}
              onScroll={(event) => setBarSolid(event.currentTarget.scrollTop > 12)}
            >
          <div className="cr-phone-hero">
            {cover ? (
              <img src={cover.public_url} alt="" />
            ) : (
              <div className="cr-phone-hero-empty">No cover yet</div>
            )}
            <div className="cr-phone-hero-chrome" aria-hidden="true">
              <span className="cr-phone-hero-back">
                <IconBack />
              </span>
              <span className="cr-phone-hero-actions">
                <span className="cr-phone-hero-btn">
                  <IconHeart />
                </span>
                <span className="cr-phone-hero-btn">
                  <IconShare />
                </span>
              </span>
            </div>
            {cover && (
              <button
                type="button"
                className="cr-phone-see-all"
                onClick={() => {
                  if (media.length > 1) setHeroIndex((index) => (index + 1) % media.length);
                }}
              >
                See all images
              </button>
            )}
          </div>

          <div className="cr-phone-body">
            <h3>{draft.name || "Listing name"}</h3>
            {chips.length > 0 && (
              <div className="cr-phone-chips">
                {chips.map((chip) => (
                  <span key={chip}>{chip}</span>
                ))}
              </div>
            )}
            {rating != null && (
              <p className="cr-phone-rating">
                <Stars rating={rating} />
                <span className="cr-phone-rating-rule" />
                <span>Avg {rating.toFixed(1)}</span>
              </p>
            )}

            <div className="cr-phone-tabs">
              <button
                type="button"
                className={tab === "info" ? "active" : undefined}
                onClick={() => setTab("info")}
              >
                Info
              </button>
              <button
                type="button"
                className={tab === "reviews" ? "active" : undefined}
                onClick={() => setTab("reviews")}
              >
                Reviews
              </button>
            </div>

            {tab === "reviews" ? (
              <div className="cr-phone-reviews">
                <p>
                  {rating != null
                    ? `Avg ${rating.toFixed(1)}${reviews ? ` from ${reviews.toLocaleString("en-ZA")} Google reviews.` : "."}`
                    : "Google reviews appear here once a rating is on the listing."}
                </p>
              </div>
            ) : (
              <>
                <h4>Description</h4>
                <p className="cr-phone-copy">
                  {shortDesc || "Description shows here."}
                  {description.length > 220 && (
                    <>
                      {" "}
                      <button type="button" onClick={() => setDescOpen((open) => !open)}>
                        {descOpen ? "See Less" : "See More"}
                      </button>
                    </>
                  )}
                </p>

                <h4>Cost</h4>
                <p className="cr-phone-cost-hint">Scan QR Code to claim your Discount.</p>
                <div className="cr-phone-cost-list">
                  {prices.length === 0 && (
                    <p className="cr-phone-muted">Add Cost cards to preview member prices.</p>
                  )}
                  {prices.map((row, index) => (
                    <article className="cr-phone-cost-card" key={`${row.name}-${index}`}>
                      <strong>{row.name}</strong>
                      <div className="cr-phone-cost-prices">
                        {row.free ? (
                          <b className="free">Free</b>
                        ) : (
                          <>
                            {row.standard != null && (
                              <span>{formatAppPrice(row.standard, row.unit)}</span>
                            )}
                            {row.member != null && (
                              <b>{formatAppPrice(row.member, row.unit)}</b>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>

                <h4>Operating Hours</h4>
                <ul className="cr-phone-hours">
                  {hours.map((row) => (
                    <li key={row.day} className={row.closed ? "closed" : undefined}>
                      <span>{row.day}</span>
                      <span>{row.hours}</span>
                    </li>
                  ))}
                </ul>

                <h4>Social Media</h4>
                {social.length === 0 ? (
                  <p className="cr-phone-muted">Add website, email, phone or social handles.</p>
                ) : (
                  <div className="cr-phone-social" aria-label="Social Media">
                    {social.map((item) => (
                      <span key={item.key} title={item.label}>
                        {item.icon}
                      </span>
                    ))}
                  </div>
                )}

                <h4>Map Location</h4>
                <div className="cr-phone-map">
                  {mapQuery ? (
                    <>
                      <iframe
                        title="Map preview"
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(mapQuery)}&z=14&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                      />
                      <p className="cr-phone-pin">
                        <span />
                        <em>{draft.name || "Listing"}</em>
                      </p>
                    </>
                  ) : (
                    <p>Add a street address or pin to preview the map.</p>
                  )}
                </div>

                {related.length > 0 && (
                  <>
                    <div className="cr-phone-related-head">
                      <h4>People Also Searched For</h4>
                      <span>See All</span>
                    </div>
                    <p className="cr-phone-related-sub">Unique to your interests.</p>
                    <div className="cr-phone-related">
                      {related.map((branch) => (
                        <article key={branch.id}>
                          {branch.cover_url ? (
                            <img src={branch.cover_url} alt="" />
                          ) : (
                            <div className="cr-phone-related-empty" />
                          )}
                          <strong>{branch.name}</strong>
                          <em>{relatedPrice(branch.price_from)}</em>
                        </article>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
            </div>
            <nav className="cr-phone-nav" aria-hidden="true">
              <span>
                <IconCalendar />
                <em>Calendar</em>
              </span>
              <span>
                <IconSpark />
                <em>Events</em>
              </span>
              <span className="active">
                <IconCompass />
                <em>Discover</em>
              </span>
              <span>
                <IconPeople />
                <em>Community</em>
              </span>
              <span>
                <IconWallet />
                <em>Wallet</em>
              </span>
            </nav>
          </div>
        </div>
      </div>
    </aside>
  );
}
