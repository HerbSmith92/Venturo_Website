"use client";

import { useMemo, useState } from "react";
import { PORTAL_HOME } from "@/lib/portal";
import type { OrganiserProfile } from "@/lib/host-profile-shared";

export function BecomeHostForm({
  firstName: initialFirst,
  lastName: initialLast,
  email,
  phone: initialPhone,
  homePlaceId: initialHome,
  places,
  hostProfile,
}: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  homePlaceId: string | null;
  places: { id: string; name: string; region: string | null }[];
  hostProfile: OrganiserProfile;
}) {
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [phone, setPhone] = useState(initialPhone);
  const [homePlaceId, setHomePlaceId] = useState(initialHome ?? "");
  const [description, setDescription] = useState(hostProfile.description);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const regions = useMemo(() => {
    const groups = new Map<string, { id: string; name: string }[]>();
    for (const place of places) {
      const region = place.region ?? "South Africa";
      const list = groups.get(region) ?? [];
      list.push(place);
      groups.set(region, list);
    }
    return [...groups.entries()];
  }, [places]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextFirst = firstName.trim();
    const nextLast = lastName.trim();
    const nextPhone = phone.trim();
    const nextDescription = description.trim();
    if (!nextFirst) {
      setError("Add your first name.");
      return;
    }
    if (!nextPhone) {
      setError("Add a cellphone number.");
      return;
    }
    if (!nextDescription) {
      setError("Describe the events you want to host.");
      return;
    }

    setError(null);
    setPending(true);
    const hostName = [nextFirst, nextLast].filter(Boolean).join(" ");
    try {
      const [accountResponse, hostResponse] = await Promise.all([
        fetch("/api/account/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: nextFirst,
            lastName: nextLast,
            phone: nextPhone,
            homePlaceId: homePlaceId || null,
          }),
        }),
        fetch("/api/host/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...hostProfile,
            hostName: hostProfile.hostName.trim() || hostName,
            contactEmail: hostProfile.contactEmail || email,
            description: nextDescription,
            mobile: nextPhone,
          }),
        }),
      ]);
      const accountPayload = (await accountResponse.json()) as { error?: string };
      if (!accountResponse.ok) {
        throw new Error(accountPayload.error ?? "Could not save your details.");
      }
      const hostPayload = (await hostResponse.json()) as { error?: string };
      if (!hostResponse.ok) {
        throw new Error(hostPayload.error ?? "Could not save that description.");
      }
      window.location.assign(PORTAL_HOME);
    } catch (caught) {
      setPending(false);
      setError(caught instanceof Error ? caught.message : "Could not submit.");
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)}>
      <h2>Your Details</h2>
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
        <span>Email Address</span>
        <input type="email" value={email} readOnly disabled />
      </label>
      <label className="field">
        <span>Cellphone Number</span>
        <input
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          placeholder="082 123 4567"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>Home Area</span>
        <select value={homePlaceId} onChange={(event) => setHomePlaceId(event.target.value)}>
          <option value="">Pick a place</option>
          {regions.map(([region, regionPlaces]) => (
            <optgroup key={region} label={region}>
              {regionPlaces.map((place) => (
                <option key={place.id} value={place.id}>
                  {place.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <h2>Events You Want To Host</h2>
      <label className="field">
        <span>Description</span>
        <textarea
          rows={6}
          maxLength={4000}
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="A Sunday hike, a book club, a night out—what you want to put on."
        />
      </label>

      {error && <p className="error">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? "Please Wait" : "Submit"}
      </button>
    </form>
  );
}
