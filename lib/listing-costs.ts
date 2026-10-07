import { formatRand } from "@/lib/control-room-shared";

export type ListingCostItem = {
  id: string;
  name: string;
  priceLabel: string;
  wasLabel: string | null;
  saveLabel: string | null;
  note: string | null;
};

export type ListingCostGroup = {
  id: string;
  name: string;
  description: string | null;
  items: ListingCostItem[];
};

type CostActivity = {
  id: string;
  name: string;
  shortDescription: string | null;
};

type CostPrice = {
  id: string;
  name: string;
  standardPrice: number | null;
  memberPrice: number | null;
  inclusions: string | null;
  activityId: string | null;
  appliesTo: string | null;
};

type CostListing = {
  name: string;
  description: string;
  shortDescription: string;
  activities: CostActivity[];
  prices: CostPrice[];
};

const AUDIENCE_PAREN =
  /^(.*)\s*\((?:per\s+)?(?:person|persons|people|child|children|adult|adults|couple|couples|group|groups|pensioner|pensioners|hour|hours|item|items)(?:\s+([A-Za-z][A-Za-z\s-]*))?\)\s*$/i;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'");
}

function tidy(value: string) {
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

function norm(value: string) {
  return tidy(value).toLowerCase();
}

function cleanName(value: string) {
  const text = tidy(value);
  const match = text.match(AUDIENCE_PAREN);
  if (!match) return text;
  const base = match[1].trim();
  const extra = match[2]?.trim();
  if (!base) return text;
  return extra ? `${base} (${extra})` : base;
}

export function priceAudienceLabel(applies: string | null | undefined) {
  switch ((applies ?? "").toLowerCase()) {
    case "person":
      return "per person";
    case "couple":
      return "per couple";
    case "adult":
      return "per adult";
    case "child":
      return "per child";
    case "pensioner":
      return "per pensioner";
    case "group":
      return "per group";
    case "hour":
      return "per hour";
    default:
      return "";
  }
}

function moneyLine(amount: number | null, audience: string) {
  if (amount === null) return null;
  if (amount === 0) return "Free";
  const amountLabel = formatRand(amount);
  return audience ? `${amountLabel} ${audience}` : amountLabel;
}

function toItem(price: CostPrice, name: string, note: string | null): ListingCostItem {
  const audience = priceAudienceLabel(price.appliesTo);
  const standard = price.standardPrice;
  const member = price.memberPrice;
  const deal = standard !== null && member !== null && member < standard;
  const save = deal ? standard - member : 0;
  return {
    id: price.id,
    name,
    priceLabel: moneyLine(deal ? member : standard, audience) ?? "—",
    wasLabel: deal ? moneyLine(standard, audience) : null,
    saveLabel: deal && save > 0 ? `Save ${moneyLine(save, audience)}` : null,
    note,
  };
}

function activityDetail(activity: CostActivity, storyKey: string) {
  const text = (activity.shortDescription ?? "").trim();
  if (!text) return null;
  if (norm(text) === storyKey) return null;
  return text;
}

function joinDetail(description: string | null, inclusions: string | null) {
  const parts = [description?.trim(), inclusions?.trim()].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join("\n\n") : null;
}

function subLabel(activityName: string, priceName: string) {
  const activity = cleanName(activityName);
  const clean = cleanName(priceName);
  const prefix = `${activity} - `;
  if (activity && clean.toLowerCase().startsWith(prefix.toLowerCase())) {
    return clean.slice(prefix.length).trim() || clean;
  }
  return clean || activity;
}

function singleTitle(activityName: string, sub: string) {
  const activity = cleanName(activityName);
  if (!sub || norm(sub) === norm(activity)) return activity || sub;
  if (activity && sub.toLowerCase().startsWith(`${activity.toLowerCase()} - `)) return sub;
  if (!activity) return sub;
  return `${activity} - ${sub}`;
}

function splitImported(name: string) {
  const full = cleanName(name);
  const mark = full.indexOf(" - ");
  if (mark <= 0) return { key: norm(full), title: full, variant: full, full };
  const title = full.slice(0, mark).trim();
  const variant = full.slice(mark + 3).trim();
  if (!title || !variant) return { key: norm(full), title: full, variant: full, full };
  return { key: norm(title), title, variant, full };
}

function dedupePrices<T extends { price: CostPrice; label: string }>(rows: T[]) {
  const seen = new Set<string>();
  const next: T[] = [];
  for (const row of rows) {
    const key = [
      norm(row.label),
      row.price.standardPrice ?? "",
      row.price.memberPrice ?? "",
      row.price.appliesTo ?? "",
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(row);
  }
  return next;
}

type DraftGroup = ListingCostGroup & { matchKey: string; shortName: string };

function asSingle(id: string, matchKey: string, shortName: string, title: string, price: CostPrice, description: string | null): DraftGroup {
  return {
    id,
    matchKey,
    shortName,
    name: title,
    description: joinDetail(description, price.inclusions),
    items: [toItem(price, title, null)],
  };
}

function asMany(
  id: string,
  matchKey: string,
  shortName: string,
  description: string | null,
  rows: { price: CostPrice; label: string }[],
): DraftGroup {
  return {
    id,
    matchKey,
    shortName,
    name: shortName,
    description,
    items: rows.map((row) => toItem(row.price, row.label, row.price.inclusions?.trim() || null)),
  };
}

function variantFromTitle(title: string, shortName: string) {
  const prefix = `${shortName} - `;
  if (title.toLowerCase().startsWith(prefix.toLowerCase())) {
    return title.slice(prefix.length).trim() || title;
  }
  return title;
}

function absorb(existing: DraftGroup, incoming: ListingCostItem[], shortName: string) {
  const known = new Set(existing.items.map((item) => item.id));
  const added = incoming
    .filter((item) => !known.has(item.id))
    .map((item) => ({ ...item, name: variantFromTitle(item.name, shortName) }));
  if (!added.length) return;
  if (existing.items.length === 1 && added.length > 0) {
    existing.items[0] = {
      ...existing.items[0],
      name: variantFromTitle(existing.items[0].name, shortName),
    };
    existing.name = shortName;
  }
  existing.items.push(...added);
}

function realGroups(activity: CostActivity, prices: CostPrice[], storyKey: string): DraftGroup[] {
  const named = prices.filter((price) => price.name.trim());
  if (!named.length) return [];
  const detail = activityDetail(activity, storyKey);
  const rows = dedupePrices(
    named.map((price) => ({ price, label: subLabel(activity.name, price.name) })),
  );
  const shortName = cleanName(activity.name) || tidy(activity.name);
  const sameLabel = rows.every((row) => norm(row.label) === norm(shortName));
  if (rows.length === 1) {
    return [
      asSingle(
        activity.id,
        norm(shortName),
        shortName,
        singleTitle(shortName, rows[0].label),
        rows[0].price,
        detail,
      ),
    ];
  }
  if (sameLabel) {
    return rows.map((row) =>
      asSingle(
        row.price.id,
        `${norm(shortName)}#${row.price.id}`,
        shortName,
        shortName,
        row.price,
        detail,
      ),
    );
  }
  return [asMany(activity.id, norm(shortName), shortName, detail, rows)];
}

function inferGroups(prices: CostPrice[], described: Map<string, string | null>): DraftGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, { title: string; rows: { price: CostPrice; label: string; full: string }[] }>();

  for (const price of prices) {
    if (!price.name.trim()) continue;
    const split = splitImported(price.name);
    const bucket = buckets.get(split.key);
    const row = { price, label: split.variant, full: split.full };
    if (!bucket) {
      buckets.set(split.key, { title: split.title, rows: [row] });
      order.push(split.key);
    } else {
      bucket.rows.push(row);
    }
  }

  const groups: DraftGroup[] = [];
  for (const key of order) {
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const rows = dedupePrices(bucket.rows);
    const description = described.get(key) ?? null;
    const sharedTitle = rows.every((row) => norm(row.label) === norm(bucket.title));
    if (rows.length === 1) {
      groups.push(asSingle(rows[0].price.id, key, bucket.title, rows[0].full, rows[0].price, description));
      continue;
    }
    if (sharedTitle) {
      for (const row of rows) {
        groups.push(
          asSingle(
            row.price.id,
            `${key}#${row.price.id}`,
            bucket.title,
            row.full,
            row.price,
            description,
          ),
        );
      }
      continue;
    }
    groups.push(asMany(`group-${rows[0].price.id}`, key, bucket.title, description, rows));
  }
  return groups;
}

function publish(group: DraftGroup): ListingCostGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    items: group.items,
  };
}

export function buildListingCostGroups(listing: CostListing): ListingCostGroup[] {
  const story = (listing.description || listing.shortDescription || "").trim();
  const storyKey = norm(story);
  const visibleIds = new Set(listing.activities.map((activity) => activity.id));
  const prices = listing.prices.filter(
    (price) => !price.activityId || visibleIds.has(price.activityId),
  );
  const described = new Map<string, string | null>();
  for (const activity of listing.activities) {
    if (norm(activity.name) === norm(listing.name)) continue;
    described.set(norm(activity.name), activityDetail(activity, storyKey));
  }

  const groups: DraftGroup[] = [];
  const byKey = new Map<string, DraftGroup>();

  for (const activity of listing.activities) {
    if (norm(activity.name) === norm(listing.name)) continue;
    const mine = prices.filter((price) => price.activityId === activity.id);
    for (const group of realGroups(activity, mine, storyKey)) {
      const existing = byKey.get(group.matchKey);
      if (existing) {
        absorb(existing, group.items, group.shortName);
        if (!existing.description && group.description) existing.description = group.description;
        continue;
      }
      groups.push(group);
      byKey.set(group.matchKey, group);
    }
  }

  const bucketPrices = prices.filter((price) => {
    if (!price.activityId) return true;
    const activity = listing.activities.find((item) => item.id === price.activityId);
    return activity ? norm(activity.name) === norm(listing.name) : false;
  });

  for (const inferred of inferGroups(bucketPrices, described)) {
    const parentKey = inferred.matchKey.split("#")[0];
    const existing = byKey.get(inferred.matchKey) ?? (parentKey !== inferred.matchKey ? byKey.get(parentKey) : undefined);
    if (existing) {
      absorb(existing, inferred.items, inferred.shortName);
      if (!existing.description && inferred.description) existing.description = inferred.description;
      continue;
    }
    groups.push(inferred);
    byKey.set(inferred.matchKey, inferred);
  }

  return groups.map(publish);
}
