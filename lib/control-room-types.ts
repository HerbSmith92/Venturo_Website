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
  is_suspended?: boolean;
  review_note?: string | null;
  publish_at?: string | null;
  price_from: number | string | null;
  updated_at: string;
  cover_url?: string | null;
  interest?: string | null;
  interest_key?: string | null;
  author?: string | null;
};

export type PriceAppliesTo =
  | "person"
  | "couple"
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
  show_on_from?: boolean | null;
  minimum_group_size?: number | null;
  discount_rand?: number | string | null;
  discount_percent?: number | string | null;
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
  show_on_discover?: boolean | null;
  show_on_from?: boolean | null;
  cost_varied?: boolean | null;
};

export type ListingMedia = {
  id: string;
  public_url: string | null;
  is_cover: boolean | null;
  sort_order: number | null;
  alt_text: string | null;
  storage_key?: string | null;
  is_pending?: boolean | null;
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
  latitude: number | string | null;
  longitude: number | string | null;
  maps_url: string | null;
  booking_required: boolean;
  indoor_outdoor: string | null;
  interest_keywords: string | null;
  persona_keywords: string | null;
  google_rating: number | string | null;
  google_review_count: number | string | null;
  authorised_to_submit: boolean;
  image_rights_granted: boolean;
  terms_accepted: boolean;
  pending_payload: unknown | null;
  pending_state: "draft" | "review" | null;
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
    vacation_opens_at?: string | null;
    vacation_closes_at?: string | null;
    vacation_is_closed?: boolean;
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
