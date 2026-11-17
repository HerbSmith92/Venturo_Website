import {
  scheduleStatusLabel,
  type ScheduleStatus,
} from "@/lib/control-room-schedule";

const TONE: Record<ScheduleStatus, string> = {
  draft: "is-draft",
  scheduled: "is-scheduled",
  active: "is-active",
  expired: "is-expired",
  inactive: "is-inactive",
};

export function StatusBadge({
  status,
  label,
}: {
  status: ScheduleStatus;
  label?: string;
}) {
  return (
    <span className={`cr-manage-badge ${TONE[status]}`}>
      {label ?? scheduleStatusLabel(status)}
    </span>
  );
}
