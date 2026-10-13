"use client";

import { sendPushCampaign, type PushSendState } from "@/app/admin/push-actions";
import { useActionState, useState } from "react";

export function PushComposer({ disabled }: { disabled: boolean }) {
  const [state, action, pending] = useActionState(sendPushCampaign, null as PushSendState | null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const error = state && "error" in state ? state.error : null;
  const sent = state && "inbox" in state ? state : null;

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
          placeholder="Doors open at 18:00"
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
          placeholder="Your next adventure is live. Open Companion & scan the door."
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <div className="field-row">
        <label className="field">
          <span>App</span>
          <select name="app" defaultValue="companion" disabled={disabled || pending}>
            <option value="companion">Companion</option>
            <option value="member">Member app</option>
            <option value="both">Both apps</option>
          </select>
        </label>
        <label className="field">
          <span>Who</span>
          <select name="audience" defaultValue="everyone" disabled={disabled || pending}>
            <option value="everyone">Everyone with the app</option>
            <option value="paid">Paid members</option>
            <option value="free">Free members</option>
            <option value="hosts">Event hosts</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Opens in the app</span>
        <input
          name="link_path"
          disabled={disabled || pending}
          placeholder="/event/…"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      </label>
      <p className="muted">
        Leave the path blank to open the notification list. Companion understands <code>/event/…</code>.
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
