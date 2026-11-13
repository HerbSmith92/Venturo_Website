# Member app screen analytics

The website counts public page visits itself. The member app must post each screen open. Do not mix this into `member_activity` (that feed is Overview active users).

The phone never holds analytics secrets. Use the signed-in member access token only.

## POST `/api/analytics/screen`

| Item | Rule |
| --- | --- |
| Auth | `Authorization: Bearer <Supabase access token>` |
| Body | `{ "screen": "listing_detail", "itemKind": "listing", "itemId": "<uuid>" }` |
| Success | `204` |
| Staff | `204` and not counted (`admin` / `editor`) |
| Missing token | `401` |
| Bad screen | `400` |

`screen` is a stable snake_case id: starts with a letter, letters / digits / underscore, 2–63 characters. The website lowercases and turns spaces or hyphens into underscores. Do not put slugs or UUIDs in `screen`.

On a detail screen, also send:

| Field | Rule |
| --- | --- |
| `itemKind` | `listing` \| `event` \| `community` \| `guide` |
| `itemId` | UUID of that row (not a slug) |

Missing or invalid item: the screen still counts; no named row.

Count **one open per screen per app session** on the phone, and one named open per item per session. The website increments every POST.

Johannesburg day. Unique members are once per screen (or per item) per day; Control Room sums distinct members over the chosen date range.

No dwell time until the app later sends seconds. Do not send Control Room, Event Host, or Companion.

## Screen ids

Use these names so Control Room rows stay stable:

| `screen` | Meaning | Named item |
| --- | --- | --- |
| `discover` | Discover / home | — |
| `directory` | Directory list | — |
| `listing_detail` | One listing | `listing` + listing UUID |
| `whats_on` | What’s On | — |
| `event_detail` | One event | `event` + event UUID |
| `communities` | Communities list | — |
| `community_detail` | One community | `community` + community UUID |
| `guides` | Guides list | — |
| `guide_detail` | One guide | `guide` + guide UUID |
| `saved` | Saved | — |
| `wallet` | Wallet | — |
| `account` | Account | — |
| `tickets` | Tickets | — |
| `search` | Search | — |

Add a new id when a new root screen ships.

Until the app calls this route, Settings → Analytics → Application stays empty. Named Activities / Events / Communities / Guides stay empty until `itemKind` & `itemId` are sent.
