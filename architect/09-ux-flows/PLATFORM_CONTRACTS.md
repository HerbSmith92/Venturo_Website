# Venturo platform contracts

## Occurrences & participation

- `event_occurrences.id` is the stable key for booking, interest, reminders, reports & door operations.
- A valid ticket/free RSVP outranks Interested for the same member & occurrence.
- Free RSVP creates a zero-value order, order item & admission ticket with `booking_source = free_rsvp`.
- Expected attendance is the number of valid admission units. Interested members are shown separately and never added to expected attendance.
- Refunded, void, cancelled or occurrence-cancelled admissions are excluded.

## Booking methods

- `free_rsvp`: primary action “RSVP free”.
- `venturo_ticketing`: primary action “Get tickets”.
- `external`: primary action uses `external_booking_button_label` (default **Book now**),
  names `external_provider_name`, and opens the tracked `/go/event-booking/{eventId}` link
  (website: new tab). Supporting copy: booking & payment take place on the provider’s site.
- `organiser_display_name` is the public organiser for third-party listings. It is separate
  from `organiser_id` (the Venturo account that uploaded the listing). A third-party
  organiser does not need a host account for an admin listing.
- External clicks are engagement only (“External booking clicks”). They never create
  attendance, RSVPs, tickets, sales or Venturo payout records unless a separately
  configured financial arrangement exists.
- Interested remains available on external listings for reminders. Reminder wording for
  interested members: “Still keen? Book your spot through {provider}.”
- Confirmed external bookings appear only when a supported integration supplies them.

## Notifications

- Delivery identity is purpose + occurrence + member + channel + schedule/version.
- Event reminders are optional and preference-aware. Cancellation, reschedule & ticket updates are essential operational messages.
- Confirmed participation cancels lower-priority Interested reminders.
- Provider acceptance, delivery, bounce, open & click are distinct states.

## Financial reporting

- Paid-order fee snapshots are authoritative for historical sales.
- Initial statements are provisional. A refund, complaint or adjustment creates a new version.
- Payout eligibility is two full South African working days after the event-local end date, subject to active holds.
- Payments remain manually authorised; background jobs never transfer funds.
- Free events receive attendance reports. External events receive click/declared-data reports only.

## Analytics & privacy

- Audience identity is a first-party visitor/session key, never an IP address.
- A rotating IP HMAC may be retained for abuse classification for 30 days.
- Raw IP is not stored by default.
- Staff and classified bots are excluded from default audience totals but remain available to authorised staff for review.
- Website and app unique visitors are reported separately unless a signed-in identity permits safe deduplication.

## Community privacy

- Existing followers are private until they opt in to host visibility.
- Managers may receive only opted-in display name, avatar & follow date.
- Email, phone and precise location are never included in manager APIs or exports.

## Mobile contract v2026-11-17

Native clients must fetch `GET /api/platform/capabilities` at launch, cache the last
successful response and tolerate unknown fields. The server keeps older web links
valid; clients must fall back to opening the HTTPS URL when they do not recognise a
feature.

### Events, booking & calendar

- Clients read `booking_method`, `external_booking_url`, `external_provider_name`,
  `external_booking_button_label`, `organiser_display_name` and the selected
  `event_occurrences.id` (from Supabase or `GET /api/events/{idOrSlug}/booking`).
- `free_rsvp` shows **RSVP free**, `venturo_ticketing` shows **Get tickets** and
  `external` shows the button label (default **Book now**) and opens the tracked
  `/go/event-booking/{eventId}` web link (prefer in-app browser / external browser;
  do not invent a native checkout). Preserve affiliate/UTM query params already on
  the stored HTTPS URL; the go route may also forward safe attribution params.
- Interested never means booked. It must not reserve capacity or issue a ticket.
  A confirmed RSVP or ticket supersedes Interested for reminder and UI state.
- Event cards, collections and guide links open the Venturo event detail first;
  booking is started from that page.
- A sign-in round trip preserves the event slug and occurrence start.
- Calendar clients may create a native calendar item from occurrence data or open
  `/api/events/{slug}/calendar?on={occurrenceStartsAt}`. Permission denial must
  leave the confirmation screen usable.

### Dynamic interests

- Fetch `GET /api/catalog/interests`; do not ship a permanent hard-coded interest
  list or icon map.
- Cache by `id`, honour `sortOrder`, hide inactive records on refresh and keep
  existing user selections by ID when a name or icon changes.
- `iconUrl` is optional. Use the Venturo fallback mark when absent or unavailable.
- A deactivated interest may remain in historical content/user selections but is
  not offered for new selection.

### Onboarding catalogues & app home

- Personas: `GET /api/catalog/personas`
- Adventure levels: `GET /api/catalog/adventure-levels` (preserve `rank`)
- Bucket list: `GET /api/catalog/bucket-list`
- App home: `GET /api/app/home?screen=discover|events|community`
- Older clients may ignore unknown catalogue/home fields and keep using local
  fallbacks. Newer clients should treat empty rows as hidden and respect
  schedule windows in `Africa/Johannesburg`.

### Content audience & setting (optional for native)

Optional discovery fields for listings, events & communities. Older clients may
ignore them. Do **not** change `audience_gender` / personas API shape.

- `audience`: `all` | `women` | `men` — Women/Men/All discovery restriction.
  Eligibility is derived from the signed-in profile gender (`woman` / `man`),
  never from a forged URL or client-supplied audience flag.
- `indoor_outdoor` on events (and listings): `indoor` | `outdoor` | `both` | null.
- Adventure filtering: listings use assigned `activity_scales` ranks; events reuse
  `format` energy range (`1-5`). Unassigned records are excluded when a level
  range is applied; “Any level” includes unassigned.
- Optional community link: at most one **approved** `community_events` row per
  event. Native clients may surface the linked community on event detail when
  present.
- Website search: `GET /api/search` and `/search` with query params `q`, `place`,
  `lat`, `lng`, `tab` (`all`|`activities`|`events`|`communities`), `setting`
  (comma-separated), `levelMin`, `levelMax`, `page`, and optional `audience`
  (`women`|`men`) as a **UI hint only**.

### Wallet

- Token artwork: `GET /api/wallet/token` (`imageUrl` may be null)
- Achievements: `GET /api/wallet/achievements`
- Achievement progress uses scanned ticket attendance
  (`event_tickets.scanned_at`). RSVP/booking alone does not qualify.
- Unsupported until signals exist: activity completion, interest-linked
  completion, bucket-list completion, distinct business visits.
- Publishing token artwork must not alter balances or history.

### Notifications & deep links

- Read and replace preferences through
  `/api/account/notification-preferences` with the member bearer token.
- Supported topics are `event_reminder`, `community_announcement`, `guide` and
  `general`; channels are `email` and `push`; scopes are global, event or community.
- Push payloads use HTTPS-compatible paths for events, tickets, communities and
  guides. Unknown paths open in the in-app browser.
- Record `notification_open` through `/api/analytics/screen`; provider delivery is
  not treated as an open.
- Community announcements remain distinct from essential event updates.

### App analytics

`POST /api/analytics/screen` accepts:

- `screen`, optional `itemKind` and `itemId`;
- `action`: `screen_view`, `click`, `rsvp`, `purchase`, `calendar_add` or
  `notification_open`;
- an idempotency key for conversion/open events;
- a small, non-sensitive properties object.

Do not send email, phone, precise location, raw IP or free-form profile data.
Website and app audiences remain separate in reporting.

### Content audience, setting & community link (website; optional for apps)

Additive fields. Native clients may ignore them until they opt in. Website discovery
always applies audience from the signed-in profile (`profiles.gender`); URL
`audience=` is a UI hint only and never grants access.

| Field | Where | Values | Notes |
| --- | --- | --- | --- |
| `audience` | `directory_listings`, `events`, `communities` | `all` \| `women` \| `men` | Default `all`. Not the same as `events.audience_gender` (persona tags / EVENT_PERSONAS). |
| `indoor_outdoor` | listings (existing) & `events` | `indoor` \| `outdoor` \| `both` | Required before listing publish / event go-live on the website. |
| Adventure | listings via `listing_activity_scales`; events via `format` energy range (`1-5`) | ranks 1–5 | Search range excludes unassigned; “Any level” includes them. |
| Community link | `community_events` | at most one `link_status = approved` row per `event_id` | Optional. Linking does not change `organiser_id` or manager rights. |

Website Search: `GET /api/search` and `/search` with `q`, `place`, `lat`/`lng`,
`tab=all\|activities\|events\|communities`, `setting` (multi), `levelMin`/`levelMax`,
`page`, optional `audience` hint. Tickets and host access are unchanged when audience
or community links change.

## Native dependencies

### iOS

- Add Associated Domains for the production Venturo web domain after the Apple Team
  ID and final bundle ID are confirmed.
- Route universal links for events, tickets, communities and guides.
- Use EventKit for native calendar actions and APNs payload/open handling.
- Refresh the interest catalogue on launch/background refresh and after an editor
  change notification.
- External booking: read the shared booking fields, show organiser + provider copy,
  open `/go/event-booking/{eventId}` (Safari View Controller / system browser). Do
  not open Venturo checkout for `booking_method = external`.

### Android

- Add verified App Links after the production application ID and signing-certificate
  SHA-256 fingerprints are confirmed.
- Route the same HTTPS paths as iOS.
- Use Calendar Provider intents/APIs and FCM data payload/open handling.
- Refresh the same dynamic catalogue; do not maintain an Android-only taxonomy.
- External booking: same contract as iOS — Custom Tabs / external browser via the
  tracked go link; keep Interested local to Venturo.

No native app source is present in this repository. Those entitlements, manifests,
route handlers and store builds must be completed in the iOS/Android repositories.

### Mobile gaps (external booking)

- Confirm event detail maps `organiser_display_name`, `external_booking_button_label`
  and provider supporting copy.
- Confirm analytics labels outbound opens as External booking clicks (not tickets
  sold / confirmed attendees).
- Confirm cancelled / ended / unavailable states hide or disable Book now.

## Staged rollout & rollback

1. Apply the database migration with all feature flags off.
2. Deploy the web/backend build and verify legacy booking, traffic and push paths.
3. Enable occurrence booking, then the notification outbox and reports for staff
   test events.
4. Release native clients that understand contract `2026-11-17`; verify old clients
   still open HTTPS fallbacks.
5. Enable enhanced analytics, then community tools, while watching delivery failure,
   duplicate, booking and API error rates.
6. Roll back by disabling the relevant feature flag. Do not drop new columns/tables
   while any deployed client may use them. Queued notification jobs must be paused
   or cancelled explicitly before disabling the worker.

Release validation covers free RSVP, paid and external booking, sign-in return,
reschedule/cancellation, calendar denial/success, preference changes, push deep
links, dynamic icon fallback, analytics idempotency, follower privacy and old-client
HTTPS fallback on both platforms.
