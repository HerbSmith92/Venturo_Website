# Event Host Menu

Locked 8 September 2026 from Herbert’s event sitemap (My Events → Event → Menu).

Per-event work lives under `/portal/events/[id]`. The global Event Host rail stays **Home / My Events / Host Settings**. When an event is open, the Menu destinations step down **under My Events** in that rail.

## Flow

My Events → Event → **Menu** → one of seven destinations.

| Route | Destination |
| --- | --- |
| `/portal/events/[id]` | Menu hub |
| `.../dashboard` | Event Dashboard |
| `.../manage` | Manage Event |
| `.../checkout` | Manage Checkout (ticket types) |
| `.../payment` | Payment (PayFast + this event’s payouts) |
| `.../marketing` | Marketing |
| `.../guests` | Guest Management |
| `.../settings` | Per-event listing settings |
| `.../door` | Door companion (scan). Shortcut from My Events & Guests |

My Events row click opens the Menu. **Open Door** stays a night-of shortcut. `/account/events/[id]` redirects into the portal Menu.

## Destinations

1. **Event Dashboard** — Total Income, Total Tickets Sold, Total Visits, Conversion Rate. Actions: Copy Event, Cancel Event, Postpone Event, Copy Link, Send Invite, Event QR. Preview Event.
2. **Manage Event** — Event Details (edit). Postpone, Cancel, Copy, User Access (`editor` / `door` collaborators). Owner stays `events.organiser_id`. Not a new `app_metadata` role.
3. **Manage Checkout** — Ticket types (paid / free / donation). Live events: add types & raise quantity; do not delete a type that has sales.
4. **Payment** — Guests pay with **PayFast** on the website. Payouts **3 working days after the event**. Bank is one host profile, gated by email OTP. Apple Pay & Samsung Pay are not ticket rails (app-store membership stays RevenueCat).
5. **Marketing** — Ambassador codes, ambassador networks, Ambassadors, ad campaign links (`?c=` on the event URL for Instagram, Meta Ads, TikTok), invite guests (copyable links / `mailto:`). No fake “email sent” until a mailer exists.
6. **Guest Management** — Guest list (name, cellphone, email) with ticket filters. Send Complimentary. Invite RSVP (accept mints a complimentary ticket). Open Door for scan.
7. **Settings** — This event only: visibility, show map, age, prohibited items. Host profile & bank stay on Host Settings.

## Access

`can_manage_event` = organiser, staff, or `editor` collaborator.  
`can_manage_event_door` = those plus `door` collaborators.

Hosts may postpone / cancel / copy / update live details through privileged RPCs. Refunds are flagged (`refund_none` / `refund_requested`), not auto-settled on PayFast.

## Voice

SA English. `&` not `and`. 24-hour time. Design tokens from `architect/DESIGN_SYSTEM.md`.
