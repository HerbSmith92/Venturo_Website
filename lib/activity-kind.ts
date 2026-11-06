export type ActivityKindEmbed = {
  is_primary?: boolean | null;
  activity_kind_id?: string | null;
  activity_kinds?:
    | { id?: string | null; key?: string | null; title?: string | null }
    | { id?: string | null; key?: string | null; title?: string | null }[]
    | null;
};

function kindRows(entry: ActivityKindEmbed) {
  const raw = entry.activity_kinds;
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function keyFromKindEmbed(entry: ActivityKindEmbed): string | null {
  const rows = kindRows(entry);
  const wanted = entry.activity_kind_id ?? null;
  if (wanted) {
    const match = rows.find((row) => row.id === wanted);
    if (match?.key) return match.key;
  }
  if (rows.length === 1) return rows[0]?.key ?? null;
  return null;
}

export function primaryActivityKindKey(entries: ActivityKindEmbed[] | null | undefined): string | null {
  const list = entries ?? [];
  for (const entry of list) {
    if (entry.is_primary !== true) continue;
    const key = keyFromKindEmbed(entry);
    if (key) return key;
  }
  for (const entry of list) {
    const key = keyFromKindEmbed(entry);
    if (key) return key;
  }
  return null;
}
