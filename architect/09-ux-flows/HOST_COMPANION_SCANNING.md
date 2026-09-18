# Host companion — ticket scanning architecture

Locked for the Event Host door. The **Venturo Companion App** is the night-of scanner. It shares the same Supabase project as the member app, website, and Control Room.

## Job to be done

Hosts & door staff log in, pull the guest list onto the phone, scan ticket QR codes (phone screens or printed paper) at the venue, keep working if the network drops, and sync scans back to the database.

| Need | Surface |
| --- | --- |
| Log in | Companion (`/companion/login`) — same Venturo account as Event Host |
| View my events | `/companion` |
| Scan tickets (camera QR + manual) | `/companion/events/[id]` |
| Offline guest list & queued scans | IndexedDB on the device, then `POST /api/host/scan` |
| Guests scanned / still to come | Door stats strip |
| Guest list + details + scanned flag | Companion Guests tab |
| Desktop fallback | `/portal/events/[id]/door` |

## Data model

Builds on `events` + `event_tickets` (unique 12-char `code` issued by `fulfill_event_order`).

```
event_tickets
  + scanned_at timestamptz   -- null = not yet through the door
  + scanned_by uuid          -- host/staff who scanned

event_ticket_scan_events     -- audit every attempt
  event_id, ticket_id?, actor_id, code_attempt, result, created_at
  result ∈ ok | already_scanned | wrong_event | not_found | cancelled_event
```

Buyer wallet QR encodes the **plain ticket code** (also accepts `venturo://ticket/<code>` and `?code=` URLs).

## Privileged RPCs (security definer)

Organisers already **read** tickets via RLS; they cannot update scan columns from the client. Check-in and guest PII go through RPCs:

| RPC | Purpose |
| --- | --- |
| `can_manage_event_door(event_id)` | Organiser, staff, or `editor` / `door` collaborator |
| `get_event_door_stats(event_id)` | `{ totalGuests, scannedGuests, remainingGuests }` |
| `list_event_door_guests(event_id)` | Door list with name, email, ticket type, code, scan flag |
| `scan_event_ticket(event_id, code)` | Idempotent redeem + audit row; returns guest + refreshed stats |

Guest email comes from `auth.users` inside the RPC — profiles stay closed under normal RLS.

## App layer

| Path | Role |
| --- | --- |
| `/companion` | Venturo Companion App (installable PWA) |
| `lib/companion-offline.ts` | IndexedDB guest list + scan queue |
| `lib/qr-detect.ts` | Camera QR (BarcodeDetector + jsQR fallback) |
| `lib/host-scanning.ts` | Domain helpers, typed RPC wrappers |
| `POST /api/host/scan` | `{ eventId, code }` → scan result |
| `GET /api/host/events` | Door-ready events for the signed-in host |
| `GET /api/host/events/[eventId]/door` | Stats + guest list for refresh |
| `/portal/events` | Host event list — Open Door launches Companion |
| `/portal/events/[id]/door` | Desktop door fallback |
| Buyer `/account/tickets` | Shows QR for each code |

Auth: middleware gates `/companion/*` and `/portal/*`. Door collaborators may scan; hosts only events they own or were invited to.

## Brand (companion UI)

Follow `architect/DESIGN_SYSTEM.md`:

- Surfaces: Night Sky `#2A2D35` + Snow Drift `#EBEBF3`
- Accent for door success: Jungle Jade; alerts: Passionate Pomegranate; warm nudge: Cheerful Canary
- Type: Social Gothic Rough (titles), Nunito Extra Light (body / buttons)
- Pathway pattern at ~5% on dark empty areas
- Horizontal light logo top-left; never centred; radius 12 / 18 / 24; 44–48px tap targets
- Voice: Bold · Magical · Humorous · Insightful · Daring — short door copy, no corporate language
- Time: 24-hour

## Native stores

`companion-app/` is the Expo iOS & Android app (`za.co.venturo.companion`). Same RPCs as the web companion. Ship with EAS Build / EAS Submit. See `companion-app/README.md`.

## Out of scope

- Ticket transfer / void / refund from the door
- Multi-entry tickets (one scan = one admit)

## Migration

`supabase/migrations/20260907180000_host_ticket_scanning.sql`
