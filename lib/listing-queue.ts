import { loadDirectoryQueue } from "@/lib/control-room";
import type { QueueListing } from "@/lib/control-room-types";

const SORTS = new Set(["name", "interest", "author", "updated"]);

export type ListingQueue = {
  status: string;
  q: string;
  interest: string;
  author: string;
  sort: string;
  dir: string;
  group: string;
};

export type ListingStep = {
  id: string;
  name: string;
  href: string;
};

export function listingQueueFromSearch(input: {
  status?: string;
  q?: string;
  interest?: string;
  author?: string;
  sort?: string;
  dir?: string;
  group?: string;
}): ListingQueue {
  const sort = SORTS.has(input.sort ?? "") ? (input.sort as string) : "updated";
  const dir = input.dir === "asc" || input.dir === "desc" ? input.dir : sort === "updated" ? "desc" : "asc";
  return {
    status: input.status?.trim() || "approved",
    q: input.q?.trim() ?? "",
    interest: input.interest?.trim() ?? "",
    author: input.author?.trim() ?? "",
    sort,
    dir,
    group: input.group === "interest" ? "interest" : "",
  };
}

export function listingQueueParams(queue: ListingQueue) {
  const params = new URLSearchParams();
  if (queue.status) params.set("status", queue.status);
  if (queue.q) params.set("q", queue.q);
  if (queue.interest) params.set("interest", queue.interest);
  if (queue.author) params.set("author", queue.author);
  if (queue.sort !== "updated" || queue.dir !== "desc") {
    params.set("sort", queue.sort);
    params.set("dir", queue.dir);
  }
  if (queue.group === "interest") params.set("group", "interest");
  return params;
}

export function listingDirectoryHref(queue: ListingQueue) {
  const search = listingQueueParams(queue).toString();
  return search ? `/admin/listings?${search}` : "/admin/listings";
}

export function listingEditorHref(id: string, queue: ListingQueue) {
  const search = listingQueueParams(queue).toString();
  return search ? `/admin/listings/${id}?${search}` : `/admin/listings/${id}`;
}

export function directoryGroups(rows: QueueListing[]) {
  const buckets = new Map<string, QueueListing[]>();
  for (const row of rows) {
    const title = row.interest?.trim() || "Other";
    const list = buckets.get(title) ?? [];
    list.push(row);
    buckets.set(title, list);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => {
      if (left === "Other") return 1;
      if (right === "Other") return -1;
      return left.localeCompare(right, "en", { sensitivity: "base" });
    })
    .map(([title, items]) => ({ title, rows: items }));
}

function orderedRows(rows: QueueListing[], group: string) {
  if (group !== "interest") return rows;
  return directoryGroups(rows).flatMap((bucket) => bucket.rows);
}

export async function loadListingSteps(id: string, queue: ListingQueue) {
  const board = await loadDirectoryQueue({ ...queue, limit: 1000 });
  const rows = orderedRows(board.rows, queue.group);
  const index = rows.findIndex((row) => row.id === id);
  const step = (row: QueueListing | undefined): ListingStep | null =>
    row ? { id: row.id, name: row.name, href: listingEditorHref(row.id, queue) } : null;
  return {
    index,
    total: rows.length,
    previous: index > 0 ? step(rows[index - 1]) : null,
    next: index >= 0 && index < rows.length - 1 ? step(rows[index + 1]) : null,
    listHref: listingDirectoryHref(queue),
    query: listingQueueParams(queue).toString(),
  };
}
