"use client";

import { sendPushCampaign, type PushSendState } from "@/app/admin/push-actions";
import type { PushOpenOption, PushPlaceOption } from "@/lib/push-notifications";
import { useActionState, useMemo, useState } from "react";

export function PushComposer({
  disabled,
  guides,
  events,
  places,
}: {
  disabled: boolean;
  guides: PushOpenOption[];
  events: PushOpenOption[];
  places: PushPlaceOption[];
}) {
  const [state, action, pending] = useActionState(sendPushCampaign, null as PushSendState | null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const error = state && "error" in state ? state.error : null;
  const sent = state && "inbox" in state ? state : null;
  const regions = useMemo(() => {
    const names: string[] = [];
    for (const place of places) {
      if (!names.includes(place.region)) names.push(place.region);
    }
    return names;
  }, [places]);

  return (
    <form className="cr-panel" action={action} style={{ marginBottom: 28 }}>
      <label className="field">
        <span>Title · {title.length}/80</span>
        <input
          name="title"
          value={title}
          maxLength={80}
          required
          disabled={disabled || pending}
          placeholder="Look at this guide"
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Message · {body.length}/240</span>
        <textarea
          name="body"
          value={body}
          maxLength={240}
          required
          rows={4}
          disabled={disabled || pending}
          placeholder="Top 10 things to do in Joburg."
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>Opens in the app</span>
          <select name="opens" defaultValue="" disabled={disabled || pending}>
            <option value="">Notification list</option>
            {guides.length > 0 ? (
              <optgroup label="Guides">
                {guides.map((guide) => (
                  <option key={guide.id} value={`guide:${guide.id}`}>
                    {guide.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {events.length > 0 ? (
              <optgroup label="Events">
                {events.map((event) => (
                  <option key={event.id} value={`event:${event.id}`}>
                    {event.detail ? `${event.title} · ${event.detail}` : event.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <label className="field">
          <span>Where</span>
          <select name="place" defaultValue="" required disabled={disabled || pending}>
            <option value="" disabled>
              Choose a place
            </option>
            <option value="everywhere">Everywhere</option>
            {regions.map((region) => (
              <optgroup key={region} label={region}>
                <option value={`region:${region}`}>All of {region}</option>
                {places
                  .filter((place) => place.region === region)
                  .map((place) => (
                    <option key={place.id} value={`place:${place.id}`}>
                      {place.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Who</span>
        <select name="audience" defaultValue="everyone" disabled={disabled || pending}>
          <option value="everyone">Everyone with the app</option>
          <option value="paid">Paid members</option>
          <option value="free">Free members</option>
        </select>
      </label>
      <p className="muted">
        Johannesburg reaches home areas within 32 km, including Sandton, Randburg, Soweto, Midrand & Krugersdorp.
        It does not reach Centurion, Pretoria, or Cape Town. All of Gauteng does include Pretoria.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {sent ? (
        <p className="notice">
          Saved for {sent.inbox} {sent.inbox === 1 ? "person" : "people"}
          {sent.pushed || sent.failed
            ? `. Pushed to ${sent.pushed} ${sent.pushed === 1 ? "phone" : "phones"}${sent.failed ? `, ${sent.failed} failed` : ""}.`
            : ". No phone had notifications turned on, so it stays in the app."}
        </p>
      ) : null}
      <button className="btn btn-primary" type="submit" disabled={disabled || pending}>
        {pending ? "Please Wait" : "Send Notification"}
      </button>
    </form>
  );
}
