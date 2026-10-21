"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  onboardingStepFor,
  profileProgress,
  type MemberProfile,
  type ProfileCatalog,
} from "@/lib/profile-shared";

function initials(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first && !last) return "V";
  if (first && last) return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  return first.slice(0, 2).toUpperCase() || last.slice(0, 2).toUpperCase();
}

export function ProfileForm({
  profile,
  catalog,
  email,
  paid,
  paidPrice,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
  email: string;
  paid: boolean;
  paidPrice: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [phone, setPhone] = useState(profile.phone);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [homePlaceId, setHomePlaceId] = useState(profile.homePlaceId ?? "");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [detailsPending, setDetailsPending] = useState(false);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);

  const progress = useMemo(
    () =>
      profileProgress({
        firstName,
        avatarUrl,
        homePlaceId: homePlaceId || null,
        personaIds: profile.personaIds,
        interestIds: profile.interestIds,
        energyLow: profile.energyLow,
        energyHigh: profile.energyHigh,
      }),
    [avatarUrl, firstName, homePlaceId, profile.energyHigh, profile.energyLow, profile.interestIds, profile.personaIds],
  );

  const regions = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }[]>();
    for (const place of catalog.places) {
      const region = place.region ?? "South Africa";
      const list = groups.get(region) ?? [];
      list.push(place);
      groups.set(region, list);
    }
    return [...groups.entries()];
  }, [catalog.places]);

  const homePlaceLabel = useMemo(() => {
    if (!homePlaceId) return "Not set yet";
    return catalog.places.find((place) => place.id === homePlaceId)?.name ?? "Not set yet";
  }, [catalog.places, homePlaceId]);

  async function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/api/account/avatar", { method: "POST", body: form });
    const payload = (await response.json()) as { error?: string; avatarUrl?: string };
    setUploading(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not upload that photo.");
      return;
    }
    setAvatarUrl(payload.avatarUrl ?? null);
    router.refresh();
  }

  async function removeAvatar() {
    setError(null);
    setUploading(true);
    const response = await fetch("/api/account/avatar", { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };
    setUploading(false);
    if (!response.ok) {
      setError(payload.error ?? "Could not remove that photo.");
      return;
    }
    setAvatarUrl(null);
    router.refresh();
  }

  async function saveDetails() {
    setError(null);
    setDetailsSaved(false);
    setDetailsPending(true);

    const finishOnboarding =
      onboardingStepFor({
        firstName,
        homePlaceId: homePlaceId || null,
        personaIds: profile.personaIds,
        interestIds: profile.interestIds,
        energyLow: profile.energyLow,
        energyHigh: profile.energyHigh,
      }) === "complete";

    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        phone,
        homePlaceId: homePlaceId || null,
        finishOnboarding,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    setDetailsPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not save your profile.");
      return;
    }

    setDetailsSaved(true);
    setEditingDetails(false);
    router.refresh();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingDetails) return;
    await saveDetails();
  }

  function cancelDetailsEdit() {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
    setPhone(profile.phone);
    setHomePlaceId(profile.homePlaceId ?? "");
    setEditingDetails(false);
    setDetailsSaved(false);
    setError(null);
  }

  async function onChangePassword() {
    setPasswordNotice(null);
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Those passwords do not match.");
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Supabase is not connected yet.");
      return;
    }
    setPasswordPending(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setPasswordPending(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPassword("");
    setPasswordConfirm("");
    setShowPassword(false);
    setPasswordNotice("Password updated.");
  }

  return (
    <form className="profile-form profile-layout" onSubmit={onSubmit}>
      <aside className="profile-sidebar">
        <div className={`plan-strip${paid ? " featured" : ""}`}>
          <div>
            <p className="eyebrow">Membership</p>
            <h2>{paid ? "Paid Member" : "Free Profile"}</h2>
            <p>
              {paid
                ? "Your membership is active. Curated discovery & member ticket prices are on."
                : `Book tickets & host events for approval. Subscribe on the website for ${paidPrice} a month for member prices.`}
            </p>
          </div>
          <div className="hero-actions">
            <a className="btn btn-secondary" href="/events">
              Browse Events
            </a>
            {!paid && (
              <a className="btn btn-secondary" href="/join/subscribe">
                Subscribe · {paidPrice} / month
              </a>
            )}
          </div>
        </div>

        <div className="profile-progress" aria-label="Profile progress">
          <div className="profile-progress-top">
            <p className="eyebrow">Profile Progress</p>
            <p className="profile-progress-count">
              {progress.doneCount} / {progress.steps.length}
            </p>
          </div>
          <div
            className="profile-progress-bar"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={progress.steps.length}
            aria-valuenow={progress.doneCount}
          >
            <span style={{ width: `${(progress.doneCount / progress.steps.length) * 100}%` }} />
          </div>
          <ul className="profile-progress-steps">
            {progress.steps.map((step) => (
              <li key={step.id} className={step.done ? "done" : undefined}>
                {step.label}
              </li>
            ))}
          </ul>
          {progress.complete ? (
            <p className="notice">Profile complete. Made For You can use this here & in the app.</p>
          ) : (
            <p className="muted">
              Fill in what you can. Skip is fine—come back anytime.
            </p>
          )}
        </div>
      </aside>

      <div className="profile-main">
        <div className="profile-identity">
          <section className="profile-section profile-section-photo">
            <p className="eyebrow">Photo</p>
            <h3>Profile Photo</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              A clear headshot helps hosts & fellow members recognise you.
            </p>
            <div className="profile-avatar-stack">
              <div className="profile-avatar profile-avatar-lg" aria-hidden={!avatarUrl}>
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" />
                ) : (
                  <span>{initials(firstName, lastName)}</span>
                )}
              </div>
              <div className="profile-avatar-actions">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={onAvatarChange}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? "Please Wait" : avatarUrl ? "Change Photo" : "Add Photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={uploading}
                    onClick={() => void removeAvatar()}
                  >
                    Remove
                  </button>
                )}
                <p className="muted">JPG, PNG or WebP. Keep it under 5 MB.</p>
              </div>
            </div>
          </section>

          <section className="profile-section profile-section-details">
            <p className="eyebrow">Account</p>
            <h3>Your Details</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Name, cellphone & home area are shared with the app. Email is used to sign in. The
              cellphone goes on your ticket so the host can reach you.
            </p>

            {!editingDetails ? (
              <div className="profile-details-locked">
                <dl>
                  <div>
                    <dt>First Name</dt>
                    <dd>{firstName || "Not set yet"}</dd>
                  </div>
                  <div>
                    <dt>Surname</dt>
                    <dd>{lastName || "Not set yet"}</dd>
                  </div>
                  <div>
                    <dt>Cellphone Number</dt>
                    <dd>{phone || "Not set yet"}</dd>
                  </div>
                  <div>
                    <dt>Email Address</dt>
                    <dd>{email || "Not set yet"}</dd>
                  </div>
                  <div>
                    <dt>Home Area</dt>
                    <dd>{homePlaceLabel}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <>
                <div className="field-row">
                  <label className="field">
                    <span>First Name</span>
                    <input
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      required
                      maxLength={80}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Surname</span>
                    <input
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      maxLength={80}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Cellphone Number</span>
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    required
                    placeholder="082 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>

                <label className="field">
                  <span>Email Address</span>
                  <input type="email" value={email} readOnly disabled />
                </label>

                <label className="field">
                  <span>Home Area</span>
                  <select value={homePlaceId} onChange={(e) => setHomePlaceId(e.target.value)}>
                    <option value="">Pick a place</option>
                    {regions.map(([region, places]) => (
                      <optgroup key={region} label={region}>
                        {places.map((place) => (
                          <option key={place.id} value={place.id}>
                            {place.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </>
            )}

            <div className="profile-details-actions">
              {!editingDetails ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditingDetails(true);
                    setDetailsSaved(false);
                    setError(null);
                  }}
                >
                  Edit Details
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={detailsPending || !firstName.trim() || !phone.trim()}
                    onClick={() => void saveDetails()}
                  >
                    {detailsPending ? "Please Wait" : "Save Details"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={detailsPending}
                    onClick={cancelDetailsEdit}
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowPassword((open) => !open);
                  setPasswordNotice(null);
                  setError(null);
                }}
              >
                {showPassword ? "Cancel Password Change" : "Change Password"}
              </button>
            </div>
            {error && <p className="error">{error}</p>}
            {detailsSaved && <p className="notice">Details saved.</p>}

            <div className="profile-password">
              {passwordNotice && <p className="notice">{passwordNotice}</p>}
              {showPassword && (
                <div className="profile-password-fields">
                  <label className="field">
                    <span>New Password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Confirm New Password</span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={passwordPending}
                    onClick={() => void onChangePassword()}
                  >
                    {passwordPending ? "Please Wait" : "Update Password"}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

      </div>
    </form>
  );
}
