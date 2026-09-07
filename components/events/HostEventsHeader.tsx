"use client";

import { useState } from "react";
import { NewEventModal } from "@/components/events/NewEventModal";

export function HostEventsHeader({ startOpen = false }: { startOpen?: boolean }) {
  const [open, setOpen] = useState(startOpen);

  return (
    <>
      <button className="btn btn-primary" type="button" onClick={() => setOpen(true)}>
        + New Event
      </button>
      <NewEventModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
