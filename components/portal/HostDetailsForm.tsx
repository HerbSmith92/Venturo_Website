"use client";

import { useState } from "react";
import {
  HOST_BANNER_SPEC,
  type OrganiserProfile,
} from "@/lib/host-profile-shared";
import { EVENT_IMAGE_MAX_BYTES, EVENT_IMAGE_MAX_MB } from "@/lib/event-types";

async function uploadHostBanner(file: File) {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", "host-banner");
  const response = await fetch("/api/events/upload", { method: "POST", body: form });
  const payload = (await response.json()) as { error?: string; url?: string };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Upload failed.");
  }
  return payload.url;
}

export function HostDetailsForm({
  firstName: initialFirst,
  lastName: initialLast,
  email,
  hostProfile,
}: {
  firstName: string;
  lastName: string;
  email: string;
  hostProfile: OrganiserProfile;
}) {
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [host, setHost] = useState(hostProfile);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function patch(next: Partial<OrganiserProfile>) {
    setHost((prev) => ({ ...prev, ...next }));
  }

  async function onBannerPick(change: React.ChangeEvent<HTMLInputElement>) {
    const file = change.target.files?.[0];
    if (!file) return;
    if (file.size > EVENT_IMAGE_MAX_BYTES) {
      setError(`Keep photos under ${EVENT_IMAGE_MAX_MB} MB.`);
      change.target.value = "";
      return;
    }
    setError(null);
    setUploading(true);
    const previous = host.bannerUrl;
    const localUrl = URL.createObjectURL(file);
    patch({ bannerUrl: localUrl });
    try {
      const url = await uploadHostBanner(file);
      patch({ bannerUrl: url });
    } catch (caught) {
      patch({ bannerUrl: previous });
      setError(caught instanceof Error ? caught.message : "Upload failed.");
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(localUrl), 800);
      setUploading(false);
      change.target.value = "";
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    if (!host.hostName.trim()) {
      setError("Add a host name.");
      return;
    }
    setError(null);
    setNotice(null);
    setPending(true);
    try {
      const [accountResponse, hostResponse] = await Promise.all([
        fetch("/api/account/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          }),
        }),
        fetch("/api/host/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(host),
        }),
      ]);
      const accountPayload = (await accountResponse.json()) as { error?: string };
      if (!accountResponse.ok) throw new Error(accountPayload.error ?? "Could not save your name.");
      const hostPayload = (await hostResponse.json()) as { error?: string };
      if (!hostResponse.ok) throw new Error(hostPayload.error ?? "Could not save host details.");
      setNotice("Host details saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="host-details-form" onSubmit={(event) => void onSubmit(event)}>
      <p className="notice">
        You can edit these details any time—before or after an event is live.
      </p>

      <section className="host-details-block">
        <h2>Your Name</h2>
        <div className="field-row">
          <label className="field">
            <span>First Name</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              maxLength={80}
              required
            />
          </label>
          <label className="field">
            <span>Surname</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              maxLength={80}
            />
          </label>
        </div>
        <label className="field">
          <span>Login Email</span>
          <input type="email" value={email} readOnly disabled />
        </label>
        <p className="muted">Login email stays on your Venturo account. Contact email below is what people see.</p>
      </section>

      <section className="host-details-block">
        <h2>Host Profile</h2>
        <div className="field-row">
          <label className="field">
            <span>Host Name</span>
            <input
              value={host.hostName}
              onChange={(event) => patch({ hostName: event.target.value })}
              maxLength={120}
              required
            />
          </label>
          <label className="field">
            <span>Contact Email</span>
            <input
              type="email"
              value={host.contactEmail}
              onChange={(event) => patch({ contactEmail: event.target.value })}
              autoComplete="email"
              maxLength={120}
            />
          </label>
        </div>
        <label className="field">
          <span>About The Host</span>
          <textarea
            rows={6}
            value={host.description}
            onChange={(event) => patch({ description: event.target.value })}
            maxLength={4000}
            placeholder="Who you are, what you host, & why people should come."
          />
        </label>
        <label className="image-upload host-banner-upload" data-kind="banner">
          <span>Host Banner · {HOST_BANNER_SPEC.ratio}</span>
          <em>
            {HOST_BANNER_SPEC.size} · under {EVENT_IMAGE_MAX_MB} MB
          </em>
          {host.bannerUrl ? (
            <img src={host.bannerUrl} alt="" />
          ) : (
            <span className="studio-upload-empty">{HOST_BANNER_SPEC.hint}</span>
          )}
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(change) => void onBannerPick(change)} />
          {uploading ? "Uploading\u2026" : "Choose image"}
        </label>
      </section>

      <section className="host-details-block">
        <h2>Contact</h2>
        <div className="field-row">
          <div>
            <label className="field">
              <span>Telephone</span>
              <input
                type="tel"
                value={host.telephone}
                onChange={(event) => patch({ telephone: event.target.value })}
                placeholder="021-555-0100"
                autoComplete="tel"
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={host.telephonePublic}
                onChange={(event) => patch({ telephonePublic: event.target.checked })}
              />
              Show telephone on the host page
            </label>
          </div>
          <div>
            <label className="field">
              <span>Mobile</span>
              <input
                type="tel"
                value={host.mobile}
                onChange={(event) => patch({ mobile: event.target.value })}
                placeholder="063-401-9080"
                autoComplete="tel"
              />
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={host.mobilePublic}
                onChange={(event) => patch({ mobilePublic: event.target.checked })}
              />
              Show mobile on the host page
            </label>
          </div>
        </div>
      </section>

      <section className="host-details-block">
        <h2>Address</h2>
        <label className="field">
          <span>Line 1</span>
          <input
            value={host.addressLine1}
            onChange={(event) => patch({ addressLine1: event.target.value })}
            autoComplete="address-line1"
          />
        </label>
        <label className="field">
          <span>Line 2</span>
          <input
            value={host.addressLine2}
            onChange={(event) => patch({ addressLine2: event.target.value })}
            autoComplete="address-line2"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Suburb</span>
            <input
              value={host.suburb}
              onChange={(event) => patch({ suburb: event.target.value })}
              autoComplete="address-level3"
            />
          </label>
          <label className="field">
            <span>City</span>
            <input
              value={host.city}
              onChange={(event) => patch({ city: event.target.value })}
              autoComplete="address-level2"
            />
          </label>
        </div>
        <label className="field">
          <span>Postal Code</span>
          <input
            value={host.postalCode}
            onChange={(event) => patch({ postalCode: event.target.value })}
            autoComplete="postal-code"
            inputMode="numeric"
          />
        </label>
      </section>

      <section className="host-details-block">
        <h2>Social &amp; Web</h2>
        <label className="field">
          <span>Facebook Page URL</span>
          <input
            value={host.facebookUrl}
            onChange={(event) => patch({ facebookUrl: event.target.value })}
            placeholder="https://facebook.com/"
            inputMode="url"
          />
        </label>
        <div className="field-row">
          <label className="field">
            <span>Website URL</span>
            <input
              value={host.websiteUrl}
              onChange={(event) => patch({ websiteUrl: event.target.value })}
              placeholder="https://"
              inputMode="url"
            />
          </label>
          <label className="field">
            <span>Instagram URL</span>
            <input
              value={host.instagramUrl}
              onChange={(event) => patch({ instagramUrl: event.target.value })}
              placeholder="https://instagram.com/"
              inputMode="url"
            />
          </label>
        </div>
        <div className="field-row">
          <label className="field">
            <span>Spotify Embedded Link</span>
            <input
              value={host.spotifyUrl}
              onChange={(event) => patch({ spotifyUrl: event.target.value })}
              placeholder="https://open.spotify.com/embed/"
              inputMode="url"
            />
          </label>
          <label className="field">
            <span>X Handle</span>
            <span className="money-input host-handle">
              <span>@</span>
              <input
                value={host.xHandle}
                onChange={(event) => patch({ xHandle: event.target.value.replace(/^@+/, "") })}
                placeholder="handle"
                autoComplete="off"
              />
            </span>
          </label>
        </div>
      </section>

      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending || uploading}>
        {pending ? "Saving" : "Save Details"}
      </button>
    </form>
  );
}
