import { toggleSave } from "@/app/member-actions";
import type { SaveKind } from "@/lib/saves";

export function SaveForm({
  kind,
  targetId,
  saved,
  next,
}: {
  kind: SaveKind;
  targetId: string;
  saved: boolean;
  next: string;
}) {
  return (
    <form action={toggleSave}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="target_id" value={targetId} />
      <input type="hidden" name="next" value={next} />
      <button className="btn btn-secondary" type="submit">
        {saved ? "Saved" : "Save"}
      </button>
    </form>
  );
}
