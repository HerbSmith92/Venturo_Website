"use client";

import {
  CONTROL_ROOM_TIMEZONE_LABEL,
  isoToSastLocal,
  sastLocalToIso,
} from "@/lib/control-room-schedule";

export type ScheduleValue = {
  startsAt: string | null;
  endsAt: string | null;
};

export function ScheduleFields({
  value,
  onChange,
  disabled,
}: {
  value: ScheduleValue;
  onChange: (next: ScheduleValue) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="cr-manage-schedule" disabled={disabled}>
      <legend className="cr-manage-legend">Schedule</legend>
      <p className="muted cr-manage-hint">Times use {CONTROL_ROOM_TIMEZONE_LABEL}.</p>
      <div className="form-grid">
        <label className="field">
          <span>Starts</span>
          <input
            type="datetime-local"
            value={isoToSastLocal(value.startsAt)}
            onChange={(event) =>
              onChange({ ...value, startsAt: sastLocalToIso(event.target.value) })
            }
          />
        </label>
        <label className="field">
          <span>Ends</span>
          <input
            type="datetime-local"
            value={isoToSastLocal(value.endsAt)}
            onChange={(event) =>
              onChange({ ...value, endsAt: sastLocalToIso(event.target.value) })
            }
          />
        </label>
      </div>
    </fieldset>
  );
}
