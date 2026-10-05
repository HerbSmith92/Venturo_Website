export type CommunityStatus = "draft" | "requested" | "published" | "archived" | "suspended";

export function communityStatusLabel(status: CommunityStatus) {
  switch (status) {
    case "requested":
      return "Requested";
    case "draft":
      return "Changes Requested";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    case "suspended":
      return "Suspended";
  }
}

export type CommunityRecord = {
  id: string;
  title: string;
  slug: string;
  about: string | null;
  coverUrl: string | null;
  interest: string | null;
  placeLabel: string | null;
  socialUrl: string | null;
  contactEmail: string | null;
  websiteUrl: string | null;
  phone: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  founderName: string | null;
  founderEmail: string | null;
  areas: string[];
  interestKeywords: string;
  scaleId: string | null;
  status: CommunityStatus;
  isFeatured: boolean;
};

export type CommunityPhoto = {
  id: string;
  publicUrl: string;
  storageKey: string;
  isCover: boolean;
  sortOrder: number;
};

export type CommunityEventLink = {
  id: string;
  title: string;
  slug: string;
  startsAt: string | null;
  city: string | null;
  status: string;
  linkStatus: "pending" | "approved";
};
