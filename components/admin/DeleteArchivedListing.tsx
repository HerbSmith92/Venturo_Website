"use client";

import type { deleteArchivedListing } from "@/app/admin/actions";

export function DeleteArchivedListing({
  id,
  action,
}: {
  id: string;
  action: typeof deleteArchivedListing;
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm("Delete this archived listing? This cannot be undone.")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
          <button className="btn btn-secondary" type="submit">
        Delete
      </button>
    </form>
  );
}
