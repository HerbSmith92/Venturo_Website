# Venturo App — product brief

Working brief from 26 August 2026. Replace or extend this as soon as a fuller brief exists.

## Product

**Venturo App** is an activity directory for South Africa. Members discover things to do, events, and communities. The paying user is the member / subscriber. The app (and website) give subscribers discounts on activities and events.

Current public site: [www.venturo.co.za](https://www.venturo.co.za)

## What we are building in this repo

A website **frontend and backend** that is easy to use and integrates with:

- The Venturo database
- The Venturo application (member app)

## Core surfaces

- **Activities directory** — places to go and things to do
- **Events directory** — upcoming experiences
- **Communities** — groups / people to join or follow
- **Member / subscriber account** — pay for access, receive discounts

## Business model (stated)

- The **member / subscriber pays** for the service
- Venturo provides **discounts** on activities and events as the member benefit

## Audience

- Primary: people looking for fun, memorable things to do (dates, friends, family, new connections)
- Secondary (later): activity businesses that want to be listed and offer member discounts

## Brand language (locked)

Source: Brand Guide v1.2 + [`../03-brand-voice/BRAND_VOICE.md`](../03-brand-voice/BRAND_VOICE.md) + [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md)

- Primary tagline set includes “Your next adventure awaits” and “Quality time is our love language”
- Voice: bold, magical, humorous, insightful, daring — kind and excited
- Audience in the guide: curious adventurers, thrill-seekers & travellers, families, teams
- Activity groups: Adventure, Digital, Romance, Thrills, Third party, Nightlife, Family, Team, Workshop

## Locked product decisions (26 Aug 2026)

Full write-up: [`../09-ux-flows/PRODUCT_ARCHITECTURE.md`](../09-ux-flows/PRODUCT_ARCHITECTURE.md)

- Public site = short landing **plus** a live directory taste. Member value (discounts, For You, booking) sits behind login/subscribe
- Three UIs, one Supabase: Control Room (admin), Activity Manager (editors + businesses), www.venturo.co.za (guests + members)
- Roles in `app_metadata`: `admin`, `editor`, `business`, `member`. Admin can always override a claimed listing
- Organisation → locations (branches) → activities → price options (member discount prompted)
- Algorithm tags: Interests, Persona, Energy spent, location
- Business claim: find listing → log in / sign up → verify → guided wizard → image/social permission required → staff publish
- Members: same auth as the app; profile, directory, events, payment, sync

## Still open

1. Member price, billing cycle, and trial
2. In-venue discount redemption (QR, code, staff check)
3. Payment provider (PayFast / Paystack / Peach)
4. Existing Supabase project to connect
