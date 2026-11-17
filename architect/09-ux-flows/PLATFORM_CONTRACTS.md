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
- `external`: primary action identifies the provider and says booking happens on its website.
- External clicks are engagement only. They never create attendance, sales or payout records.

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

- Clients read `booking_method`, `external_booking_url`, `external_provider_name`
  and the selected `event_occurrences.id`.
- `free_rsvp` shows **RSVP free**, `venturo_ticketing` shows **Get tickets** and
  `external` opens the tracked `/go/event-booking/{eventId}` web link.
- Interested never means booked. A confirmed RSVP or ticket supersedes Interested
  for reminder and UI state.
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

## Native dependencies

### iOS

- Add Associated Domains for the production Venturo web domain after the Apple Team
  ID and final bundle ID are confirmed.
- Route universal links for events, tickets, communities and guides.
- Use EventKit for native calendar actions and APNs payload/open handling.
- Refresh the interest catalogue on launch/background refresh and after an editor
  change notification.

### Android

- Add verified App Links after the production application ID and signing-certificate
  SHA-256 fingerprints are confirmed.
- Route the same HTTPS paths as iOS.
- Use Calendar Provider intents/APIs and FCM data payload/open handling.
- Refresh the same dynamic catalogue; do not maintain an Android-only taxonomy.

No native app source is present in this repository. Those entitlements, manifests,
route handlers and store builds must be completed in the iOS/Android repositories.

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
