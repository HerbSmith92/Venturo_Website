# Venturo product architecture

Locked 26 August 2026 from Herbert’s requirements plus the website prototypes (Control Room, Activity Manager, Edit Draft) and the app screens.

## Recommendation on question 1

**Do both: a short landing that immediately opens into a public directory “taste.”**

Do not choose only a brochure homepage, and do not drop a stranger into the full member app.

| Surface | Guest (taste) | Member (paid) |
| --- | --- | --- |
| Home | Hero + a live slice of Discover (Top Picks, nearby, categories) | Same home, personalised (“Hey Marco”, Made For You) |
| Directory | Browse listings, hours, public prices, branches | Member prices, offers, bucketlist |
| Events | See the calendar & featured events | Book / pay |
| Communities | See names & info | Follow, member-only micro events |
| For You / algorithm | Teaser, then join | Interests, Persona, Energy, location |

Paywall sits on **value**, not on existence of the directory. People must taste Venturo before they pay.

**Plans (locked 26 Aug 2026):**

- **Free** — creates a profile. Can book event tickets. No subscriber benefits.
- **Paid** — R 19.99 / month via the App Store or Play Store. Unlocks curated discovery / personal recommendations & exclusive member discounts. **RevenueCat** is the source of truth for whether membership is active. The website does not take card payments.

This matches the app prototypes (Discover is the product) and the Control Room copy (“Website, directory & memberships”).

---

## Three sites, one database

| Site | Who | Job |
| --- | --- | --- |
| **www.venturo.co.za** | Guests + members | Marketing + directory taste + member account + event booking |
| **Activity Manager** | Editors + claimed businesses | Capture & edit listings, branches, prices, photos |
| **Control Room** | Verified admins | Approve / reject / override, create staff users, publish |

All three talk to the **same Supabase project** as the mobile app. One `auth.users` row. One listing. No second directory.

---

## Roles (security)

Store role in **`app_metadata` only**, never `user_metadata` (users can edit that themselves). Enforce with RLS.

| Role | Created how | Can do |
| --- | --- | --- |
| `admin` | Invited in Control Room | Everything. Create staff. Override claimed listings. Publish / reject. Manage members. |
| `editor` | Invited by admin | Add/edit Directory, Events, Community. Cannot manage other staff or billing. |
| `business` | Sign up when claiming, then admin verifies | Edit **claimed** organisation + its branches only. Submit to review. Cannot publish themselves. |
| `member` | Public sign up + subscription | Browse, profile, book events, use app. Cannot edit listings. |

Admin override always wins, even after a business has claimed. Every override writes an **audit log** (who, what, before/after).

### Auth rules

- Public site, Activity Manager, Control Room, and the app all use **Supabase Auth**
- Control Room and Activity Manager are **separate hostnames or `/admin` + `/manage` routes**, not mixed into the member UI
- Admin / editor accounts are **invite-only** (no public “register as admin”)
- MFA required for `admin` (and preferably `editor`)
- Short JWT expiry for staff; revoke sessions on role change or disable
- Never expose the `service_role` key in the browser
- Listing publish is a **privileged action** (Edge Function or `security definer` in a private schema), not a client-side update to `status = live`

---

## Data shape (directory)

One **organisation** (the business) → many **locations** (branches) → many **activities** (offerings at that branch).

```
organisation          Joons / The Fun Company
  location            Joons Linden  |  Fun Co Greenstone  |  Fun Co Menlyn
    hours             per location, 24-hour (13:30), Closed supported
    photos            per location
    activities        bowling, bumper cars, A5 canvas…
      price_options   standard R, discount type/%, auto member price
```

Events and communities are sibling objects, not stuffed into activity rows.

**Claim:** a verified `business` user is linked to an organisation. Claiming requires login/sign-up, then staff verification. Until verified, the listing stays staff-owned.

**Staff vs owner edits:** both write the same rows. `updated_by`, `claimed_by`, `published_by` stay distinct.

---

## 2.2 Directory algorithm

Listings and members share the same tags. Ranking uses all four:

1. **Interests** — Adventure & Thrills, Nightlife, Amusement Parks, Workshops & Education, Arts & Culture, Parks & Nature, Sports & Wellness, Markets, Sightseeing & Tours, Social Gatherings, Kids Play & Edutainment
2. **Persona** — Families, Kids 0–6, Kids 7–12, Teens 14–18, Couples, Solo, Groups, Pet Parents, Bargain Hunters, …
3. **Energy spent** — Low (chilled hang) → Medium → High (thrills). Members can change this as a *current mood*, not only at onboarding
4. **Place** — saved area (Sandton) + proximity (“Around Sandton”, Near You)

Onboarding in the app already collects Interests, Vibes, Persona (min 3 interests, skip allowed, editable in settings). Website members get the same profile fields so the app and site stay in sync.

**Admin tools:** assign listing tags in the editor (“Who it’s for”), feature Top Picks, filter members by plan/status, pause a subscription, never delete history.

---

## Business claim & listing wizard (from Edit Draft)

Guided steps. Minimum must be met before “Move to Review”:

1. Your contact
2. Business basics
3. Branches & hours (one complete location minimum)
4. Activities & pricing — **prompt for Venturo member discount on every price option**
5. Who it’s for (persona / energy / interest tags)
6. Branch photos
7. Permission & review — **required checkboxes**
   - I am authorised to submit this business
   - I own these images and grant Venturo use on the app, website, social, and ads

Then: **Save & Move To Review**. Control Room: Edit / Approve & Publish / Request Changes / Reject.

Statuses: `draft` → `in_review` → `changes_needed` → `live` (or `rejected`). Imports from WordPress / spreadsheet land as `draft`.

---

## Members

- Sign up / log in on web and app with the same email
- Profile: name, photo, area, interests, persona, energy, optional gender & DOB
- See all live directory listings
- See member price when subscribed
- View & book events (Free can book tickets; Paid adds member discounts)
- Paid membership: R 19.99 / month via App Store or Play Store, confirmed by RevenueCat using the same user id as Supabase
- Bucketlist / Dreams
- Follow communities
- Subscription status is the source of “member” benefits

App sync = **same Supabase user + same tables**. No separate member database.

---

## Build order

1. Supabase schema + RLS + roles
2. Control Room login + listing queue (you already have ~390 drafts)
3. Activity Manager editor (7-step wizard, branches, discounts, permissions)
4. Public website: landing + directory taste + listing detail
5. Member auth, profile, subscription
6. Events booking + payment
7. Business claim flow
8. Algorithm (Made For You) once tags exist on listings and members

---

## Open before we code payment

- Payment provider (PayFast / Paystack / Peach)
- Member price & trial
- How a discount is redeemed in-venue (QR, code, staff check)
- Confirm existing Supabase project URL to connect (MCP auth still needed)
