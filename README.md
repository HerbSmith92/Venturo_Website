# Venturo App Website

Taste landing + directory for **Venturo App**. Free profiles can book event tickets. Paid membership is **R 19.99 / month** via the App Store or Play Store; this site asks **RevenueCat** whether the membership is active.

Live brand site: [www.venturo.co.za](https://www.venturo.co.za)

## Run locally

```bash
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth + profiles |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser/server Supabase client |
| `REVENUECAT_SECRET_API_KEY` | Server check for App Store / Play Store entitlement |
| `REVENUECAT_ENTITLEMENT_ID` | Defaults to `subscription_monthly_1` (RevenueCat “Pro”) |
| `NEXT_PUBLIC_APP_STORE_URL` | Paid CTA |
| `NEXT_PUBLIC_PLAY_STORE_URL` | Paid CTA |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Invite staff from Control Room |

The mobile app should log the same Supabase user id into RevenueCat as `app_user_id`.

## Control Room

Staff portal: [http://localhost:3000/admin](http://localhost:3000/admin). Same Supabase Auth as the public site. Only users with `app_metadata.role = admin` get in. There is no admin sign-up.

Grant the first admin in the Application SQL editor using `supabase/scripts/grant_control_room_admin.sql`, then sign out and log in again. Inviting more staff from `/admin/staff` needs `SUPABASE_SERVICE_ROLE_KEY`.

Run `supabase/migrations/20260826120000_profiles.sql` in the Venturo project before sign-up.

Brand source files stay in `architect/`.
