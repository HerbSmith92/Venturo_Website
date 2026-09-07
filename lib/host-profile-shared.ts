export const HOST_BANNER_SPEC = {
  ratio: "3:1",
  size: "1500 \u00d7 500",
  hint: "Wide banner across the top of your host profile.",
} as const;

export type OrganiserProfile = {
  hostName: string;
  contactEmail: string;
  description: string;
  bannerUrl: string;
  telephone: string;
  telephonePublic: boolean;
  mobile: string;
  mobilePublic: boolean;
  addressLine1: string;
  addressLine2: string;
  suburb: string;
  city: string;
  postalCode: string;
  facebookUrl: string;
  websiteUrl: string;
  instagramUrl: string;
  spotifyUrl: string;
  xHandle: string;
};

export const EMPTY_ORGANISER_PROFILE: OrganiserProfile = {
  hostName: "",
  contactEmail: "",
  description: "",
  bannerUrl: "",
  telephone: "",
  telephonePublic: false,
  mobile: "",
  mobilePublic: false,
  addressLine1: "",
  addressLine2: "",
  suburb: "",
  city: "",
  postalCode: "",
  facebookUrl: "",
  websiteUrl: "",
  instagramUrl: "",
  spotifyUrl: "",
  xHandle: "",
};

function asText(value: unknown, max: number) {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

function asEmail(value: unknown) {
  const email = asText(value, 120);
  if (!email) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Check the contact email.");
  }
  return email;
}

function asHttpUrl(value: unknown, label: string) {
  const raw = asText(value, 400);
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("bad protocol");
    }
    return parsed.toString();
  } catch {
    throw new Error(`Check the ${label}.`);
  }
}

function asHandle(value: unknown) {
  return asText(value, 40).replace(/^@+/, "");
}

export function parseOrganiserProfileInput(body: unknown): OrganiserProfile {
  const input = (body ?? {}) as Record<string, unknown>;
  const hostName = asText(input.hostName, 120);
  if (!hostName) throw new Error("Add a host name.");

  return {
    hostName,
    contactEmail: asEmail(input.contactEmail),
    description: asText(input.description, 4000),
    bannerUrl: asHttpUrl(input.bannerUrl, "banner image"),
    telephone: asText(input.telephone, 40),
    telephonePublic: Boolean(input.telephonePublic),
    mobile: asText(input.mobile, 40),
    mobilePublic: Boolean(input.mobilePublic),
    addressLine1: asText(input.addressLine1, 120),
    addressLine2: asText(input.addressLine2, 120),
    suburb: asText(input.suburb, 80),
    city: asText(input.city, 80),
    postalCode: asText(input.postalCode, 16),
    facebookUrl: asHttpUrl(input.facebookUrl, "Facebook URL"),
    websiteUrl: asHttpUrl(input.websiteUrl, "website URL"),
    instagramUrl: asHttpUrl(input.instagramUrl, "Instagram URL"),
    spotifyUrl: asHttpUrl(input.spotifyUrl, "Spotify link"),
    xHandle: asHandle(input.xHandle),
  };
}

export function defaultOrganiserProfile(
  firstName: string,
  lastName: string,
  email: string,
  existing: OrganiserProfile | null,
): OrganiserProfile {
  const accountName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return {
    ...EMPTY_ORGANISER_PROFILE,
    ...existing,
    hostName: existing?.hostName || accountName,
    contactEmail: existing?.contactEmail || email,
  };
}
