# Host companion — ticket scanning architecture

Locked for the Event Host portal door surface (`/portal`), sharing the same Supabase project as the member app and Control Room.

## Job to be done

Hosts log in to Event Host, open an event door, scan guest QR / ticket codes, watch live arrival counts, and browse the full guest list with scan status.

| Need | Surface |
| --- | --- |
| Log in | Portal auth (`/portal/login`) |
| View my events | `/portal` home + `/portal/events` |
| Scan tickets (QR + manual) | `/portal/events/[id]/door` |
| Guests scanned / still to come | Door stats strip |
| Guest list + details + scanned flag | Same door page, Guests panel |

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
| `can_manage_event_door(event_id)` | Organiser of the event **or** staff |
| `get_event_door_stats(event_id)` | `{ totalGuests, scannedGuests, remainingGuests }` |
| `list_event_door_guests(event_id)` | Door list with name, email, ticket type, code, scan flag |
| `scan_event_ticket(event_id, code)` | Idempotent redeem + audit row; returns guest + refreshed stats |

Guest email comes from `auth.users` inside the RPC — profiles stay closed under normal RLS.

## App layer

| Path | Role |
| --- | --- |
| `lib/host-scanning.ts` | Domain helpers, code normalisation, typed RPC wrappers |
| `POST /api/host/scan` | `{ eventId, code }` → scan result |
| `GET /api/host/events/[eventId]/door` | Stats + guest list for refresh |
| `/portal/events` | Host event list with door entry |
| `/portal/events/[id]/door` | Scanner + counts + guest list |
| Buyer `/account/tickets` | Shows QR for each code |

Auth: portal middleware already gates `/portal/*`. Staff may open any event door; hosts only their `organiser_id` events.

## Brand (companion UI)

Follow `architect/DESIGN_SYSTEM.md` — same Event Host portal chrome:

- Surfaces: Night Sky `#2A2D35` + Snow Drift `#EBEBF3`
- Accent for door success: Jungle Jade; alerts: Passionate Pomegranate; warm nudge: Cheerful Canary
- Type: Social Gothic Rough (titles), Nunito Extra Light (body / buttons)
- Pathway pattern at ~5% on dark empty areas
- Horizontal light logo top-left; radius 12 / 18 / 24; 44–48px tap targets
- Voice: Bold · Magical · Humorous · Insightful · Daring — short door copy, no corporate “portal” language

## Out of scope for this slice

- Co-host / door-staff invites beyond the single organiser (+ Control Room staff)
- Offline-first native scanner app (this web companion is the architectural backend + first UI; native can call the same RPCs later)
- Ticket transfer / void / refund from the door
- Multi-entry tickets (one scan = one admit)

## Migration

`supabase/migrations/20260907180000_host_ticket_scanning.sql`
