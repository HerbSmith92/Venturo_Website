"use client";

import { useState } from "react";
import { NewEventModal } from "@/components/events/NewEventModal";

export function CreateEventPrompt({ hasEvents }: { hasEvents: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <section className="portal-create">
      <div className="colour-bar" aria-hidden="true" />
      <div className="portal-create-body">
        <div>
          <p className="eyebrow">Start Here</p>
          <h2>{hasEvents ? "Host Another Event" : "Create An Event"}</h2>
          <p className="muted">Name it first. Dates &amp; tickets can wait.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
          + New Event
        </button>
      </div>
      <NewEventModal open={open} onClose={() => setOpen(false)} stay="portal" />
    </section>
  );
}
