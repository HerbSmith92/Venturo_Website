import type { ListingStatus } from "@/lib/control-room-shared";

export type QueueListing = {
  id: string;
  name: string;
  branch_name: string | null;
  slug: string;
  suburb: string | null;
  city: string | null;
  status: ListingStatus;
  is_featured: boolean;
  price_from: number | string | null;
  updated_at: string;
};

export type PriceAppliesTo =
  | "person"
  | "adult"
  | "child"
  | "pensioner"
  | "group"
  | "hour"
  | "item"
  | "custom";

export type PriceCategory =
  | "activity"
  | "admission"
  | "package"
  | "rental"
  | "add_on"
  | "other";

export type ListingPriceOption = {
  id: string;
  listing_activity_id: string | null;
  name: string;
  standard_price: number | string | null;
  member_price: number | string | null;
  inclusions: string | null;
  applies_to: PriceAppliesTo | string | null;
  price_category: PriceCategory | string | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean | null;
  sort_order: number | null;
};

export type ListingActivity = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  duration_minutes: number | null;
  minimum_age: number | null;
  maximum_age: number | null;
  booking_required: boolean;
  sort_order: number | null;
  status: string;
};

export type ListingMedia = {
  id: string;
  public_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
  alt_text: string | null;
  storage_key?: string | null;
};

export type ListingDetail = QueueListing & {
  business_id: string;
  short_description: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  booking_url: string | null;
  street_address_1: string | null;
  street_address_2: string | null;
  province: string | null;
  postal_code: string | null;
  booking_required: boolean;
  indoor_outdoor: string | null;
  google_rating: number | string | null;
  authorised_to_submit: boolean;
  image_rights_granted: boolean;
  published_at: string | null;
  last_verified_at: string | null;
  businesses:
    | {
        id: string;
        name: string;
        slug: string;
        status: string;
        description: string | null;
        website_url: string | null;
      }
    | {
        id: string;
        name: string;
        slug: string;
        status: string;
        description: string | null;
        website_url: string | null;
      }[]
    | null;
  listing_media: ListingMedia[];
  listing_activities: ListingActivity[];
  operating_hours: {
    id: string;
    day_of_week: number;
    opens_at: string | null;
    closes_at: string | null;
    is_closed: boolean;
  }[];
  price_options: ListingPriceOption[];
  listing_personas: { persona_id: string; is_primary: boolean }[];
  listing_interests: { interest_id: string; is_primary: boolean }[];
  listing_activity_scales: { activity_scale_id: string; is_primary: boolean }[];
  listing_activity_kinds: { activity_kind_id: string; is_primary: boolean }[];
  social_links: {
    id: string;
    platform: string;
    handle: string | null;
    url: string;
    is_primary: boolean;
  }[];
};
