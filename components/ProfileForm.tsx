"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_INTERESTS,
  MIN_INTERESTS,
  profileProgress,
  type MemberProfile,
  type ProfileCatalog,
} from "@/lib/profile-shared";

function toggleId(ids: string[], id: string, max: number) {
  if (ids.includes(id)) return ids.filter((item) => item !== id);
  if (ids.length >= max) return ids;
  return [...ids, id];
}

function initials(firstName: string, lastName: string) {
  const first = firstName.trim();
  const last = lastName.trim();
  if (!first && !last) return "V";
  if (first && last) return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
  return first.slice(0, 2).toUpperCase() || last.slice(0, 2).toUpperCase();
}

function kindClass(kindKey: string) {
  return `kind kind-${kindKey}`;
}

function EnergySpectrum({
  scales,
  energyLow,
  energyHigh,
  onPick,
}: {
  scales: ProfileCatalog["scales"];
  energyLow: string;
  energyHigh: string;
  onPick: (rank: number) => void;
}) {
  const low = energyLow ? Number(energyLow) : null;
  const high = energyHigh ? Number(energyHigh) : null;
  const lowTitle = scales.find((scale) => scale.rank === low)?.title;
  const highTitle = scales.find((scale) => scale.rank === high)?.title;

  return (
    <div className="energy-spectrum" role="group" aria-label="Activity level range">
      <div className="energy-spectrum-track" aria-hidden>
        <span
          className="energy-spectrum-fill"
          style={
            low != null && high != null
              ? {
                  left: `${((low - 1) / Math.max(scales.length - 1, 1)) * 100}%`,
                  width: `${((high - low) / Math.max(scales.length - 1, 1)) * 100}%`,
                }
              : undefined
          }
        />
      </div>
      <div className="energy-spectrum-stops">
        {scales.map((scale) => {
          const inRange =
            low != null && high != null && scale.rank >= low && scale.rank <= high;
          const isEnd = scale.rank === low || scale.rank === high;
          return (
            <button
              key={scale.rank}
              type="button"
              data-rank={scale.rank}
              className={`energy-stop${inRange ? " in-range" : ""}${isEnd ? " end" : ""}`}
              onClick={() => onPick(scale.rank)}
              aria-pressed={inRange}
            >
              <span className="energy-bars" aria-hidden>
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <span className="energy-stop-label">{scale.title}</span>
              {scale.subtitle ? (
                <span className="energy-stop-sub">{scale.subtitle}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="muted energy-spectrum-hint">
        {low != null && high != null
          ? low === high
            ? `Selected: ${lowTitle}. Tap another card to stretch your range.`
            : `Selected: ${lowTitle} through ${highTitle}.`
          : "Tap a card to start. Tap another to set your range from calmer to more intense."}
      </p>
    </div>
  );
}

export function ProfileForm({
  profile,
  catalog,
  email,
}: {
  profile: MemberProfile;
  catalog: ProfileCatalog;
  email: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [homePlaceId, setHomePlaceId] = useState(profile.homePlaceId ?? "");
  const [personaIds, setPersonaIds] = useState(profile.personaIds);
  const [interestIds, setInterestIds] = useState(profile.interestIds);
  const [energyLow, setEnergyLow] = useState(profile.energyLow != null ? String(profile.energyLow) : "");
  const [energyHigh, setEnergyHigh] = useState(
    profile.energyHigh != null ? String(profile.energyHigh) : "",
  );
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
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
        personaIds,
        interestIds,
        energyLow: energyLow ? Number(energyLow) : null,
        energyHigh: energyHigh ? Number(energyHigh) : null,
      }),
    [avatarUrl, energyHigh, energyLow, firstName, homePlaceId, interestIds, personaIds],
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

  const visibleInterests = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const rows = needle
      ? catalog.interests.filter((item) => item.title.toLowerCase().includes(needle))
      : catalog.interests;
    const groups = new Map<string, { key: string; title: string; items: typeof rows }>();
    for (const item of rows) {
      const existing = groups.get(item.kind_key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(item.kind_key, {
          key: item.kind_key,
          title: item.kind_title,
          items: [item],
        });
      }
    }
    return [...groups.values()];
  }, [catalog.interests, query]);

  function pickEnergy(rank: number) {
    const lo = energyLow ? Number(energyLow) : null;
    const hi = energyHigh ? Number(energyHigh) : null;
    if (lo == null || hi == null) {
      setEnergyLow(String(rank));
      setEnergyHigh(String(rank));
      return;
    }
    if (rank < lo) {
      setEnergyLow(String(rank));
      return;
    }
    if (rank > hi) {
      setEnergyHigh(String(rank));
      return;
    }
    setEnergyLow(String(rank));
    setEnergyHigh(String(rank));
  }

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
    setSaved(false);
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
    setSaved(false);
    router.refresh();
  }

  async function saveProfile(options?: { detailsOnly?: boolean }) {
    setError(null);
    setSaved(false);
    setDetailsSaved(false);
    if (options?.detailsOnly) setDetailsPending(true);
    else setPending(true);

    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName,
        lastName,
        homePlaceId: homePlaceId || null,
        personaIds,
        interestIds,
        energyLow: energyLow ? Number(energyLow) : null,
        energyHigh: energyHigh ? Number(energyHigh) : null,
      }),
    });
    const payload = (await response.json()) as { error?: string };
    if (options?.detailsOnly) setDetailsPending(false);
    else setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Could not save your profile.");
      return false;
    }

    if (options?.detailsOnly) {
      setDetailsSaved(true);
      setEditingDetails(false);
    } else {
      setSaved(true);
    }
    router.refresh();
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editingDetails) {
      setError("Save or cancel Your Details before saving the full profile.");
      return;
    }
    await saveProfile();
  }

  function cancelDetailsEdit() {
    setFirstName(profile.firstName);
    setLastName(profile.lastName);
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
    <form className="profile-form" onSubmit={onSubmit}>
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

      <section className="profile-section">
        <p className="eyebrow">Photo</p>
        <h3>Profile Photo</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          A clear headshot helps hosts & fellow members recognise you.
        </p>
        <div className="profile-avatar-row">
          <div className="profile-avatar" aria-hidden={!avatarUrl}>
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

      <section className="profile-section">
        <p className="eyebrow">Account</p>
        <h3>Your Details</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Name & home area are shared with the app. Email is used to sign in.
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
                disabled={detailsPending || !firstName.trim()}
                onClick={() => void saveProfile({ detailsOnly: true })}
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

      <section className="profile-section">
        <p className="eyebrow">Going Out</p>
        <h3>How You Usually Go Out</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Choose the situations that fit you—solo, with a partner, family, friends, or work.
          Up to 8.
        </p>
        <div className="tag-picker">
          {catalog.personas.map((persona) => {
            const on = personaIds.includes(persona.id);
            return (
              <button
                key={persona.id}
                type="button"
                className={`chip${on ? " on" : ""}`}
                onClick={() => setPersonaIds(toggleId(personaIds, persona.id, 8))}
              >
                {persona.title}
              </button>
            );
          })}
        </div>
      </section>

      <section className="profile-section">
        <p className="eyebrow">Interests</p>
        <h3>Activities You Enjoy</h3>
        <p className="muted">
          Pick at least {MIN_INTERESTS} so Made For You has enough to work with. Max{" "}
          {MAX_INTERESTS}.
        </p>
        <label className="field">
          <span>Search</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search interests"
            aria-label="Search interests"
          />
        </label>
        {visibleInterests.map((group) => (
          <div key={group.key} className="profile-kind" data-kind={group.key}>
            <p className="eyebrow profile-kind-title">
              <span className="profile-kind-swatch" aria-hidden />
              {group.title}
            </p>
            <div className="tag-picker">
              {group.items.map((item) => {
                const on = interestIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`chip ${kindClass(item.kind_key)}${on ? " on" : ""}`}
                    onClick={() => setInterestIds(toggleId(interestIds, item.id, MAX_INTERESTS))}
                  >
                    {item.title}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="profile-section">
        <p className="eyebrow">Activity Level</p>
        <h3>How Active You Feel</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Set a range on the scale—from chilled to full throttle. This is your current mood,
          not a permanent setting.
        </p>
        <EnergySpectrum
          scales={catalog.scales}
          energyLow={energyLow}
          energyHigh={energyHigh}
          onPick={pickEnergy}
        />
        {(energyLow || energyHigh) && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setEnergyLow("");
              setEnergyHigh("");
            }}
          >
            Clear Activity Level
          </button>
        )}
      </section>

      {error && <p className="error">{error}</p>}
      {saved && <p className="notice">Saved. The app sees the same profile.</p>}
      <button
        className="btn btn-primary"
        type="submit"
        disabled={pending || uploading || editingDetails}
      >
        {pending ? "Please Wait" : "Save Profile"}
      </button>
    </form>
  );
}
