import { colours } from "@/lib/theme";

export const EVENT_CATEGORY_COLOUR: Record<string, string> = {
  "Adventure & Thrills": colours.jade,
  Nightlife: colours.velvet,
  "Amusement Parks": colours.orange,
  "Workshops & Education": colours.sapphire,
  "Arts & Culture": colours.blush,
  "Parks & Nature": colours.jade,
  "Sports & Wellness": colours.orange,
  Markets: colours.maroon,
  "Sightseeing & Tours": colours.sapphire,
  "Social Gatherings": colours.blush,
  "Kids Play & Edutainment": colours.blush,
  Adventure: colours.jade,
  Music: colours.velvet,
  Workshop: colours.sapphire,
  Family: colours.blush,
  Sports: colours.orange,
  "Food & Drink": colours.canary,
  Other: colours.canary,
};

export function eventCategoryColour(category: string | null | undefined) {
  if (!category) return colours.canary;
  return EVENT_CATEGORY_COLOUR[category] ?? colours.canary;
}

export function formatCents(cents: number) {
  return `R ${(cents / 100).toFixed(2)}`;
}

export function formatEventWhen(startsAt: string, timezone = "Africa/Johannesburg") {
  if (!startsAt) return "Date coming";
  try {
    return new Intl.DateTimeFormat("en-ZA", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(startsAt));
  } catch {
    return startsAt;
  }
}

export function publicPriceLabel(event: {
  membersOnly: boolean;
  memberFromPriceCents: number | null;
  fromPriceCents: number | null;
}) {
  if (event.membersOnly && event.memberFromPriceCents !== null) {
    return `Members from ${formatCents(event.memberFromPriceCents)}`;
  }
  if (event.fromPriceCents == null) return "Tickets soon";
  if (event.fromPriceCents === 0) return "Free";
  return `From ${formatCents(event.fromPriceCents)}`;
}

export function hasMemberDeal(event: {
  memberFromPriceCents: number | null;
  fromPriceCents: number | null;
}) {
  return (
    event.memberFromPriceCents !== null &&
    (event.fromPriceCents === null || event.memberFromPriceCents < event.fromPriceCents)
  );
}
