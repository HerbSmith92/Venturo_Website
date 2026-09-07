# Venturo App Website

Taste landing + directory for **Venturo App**. Free profiles can book event tickets. Paid membership is **R 19.99 / month** via PayFast on the website or the App Store / Play Store in the app. Both write **`member_access.subscribed`**; the website and app only read that row for privileges.

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
| `REVENUECAT_SECRET_API_KEY` | One-shot backfill of App Store / Play Store entitlements into `member_access` |
| `REVENUECAT_ENTITLEMENT_ID` | Defaults to `subscription_monthly_1` (RevenueCat “Pro”) |
| `REVENUECAT_WEBHOOK_AUTH` | Shared secret for `POST /api/revenuecat/webhook` (Authorization header) |
| `REVENUECAT_WEBHOOK_ALLOW_SANDBOX` | Set `true` to honour sandbox events (off in production) |
| `NEXT_PUBLIC_APP_STORE_URL` | Paid CTA |
| `NEXT_PUBLIC_PLAY_STORE_URL` | Paid CTA |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Invite staff from Control Room |

The mobile app should log the same Supabase user id into RevenueCat as `app_user_id`. After a store purchase, RevenueCat’s webhook updates `member_access`; the app must read **`member_access.subscribed`** for privileges, not `Purchases.customerInfo`.

Production webhook URL: `https://www.venturo.co.za/api/revenuecat/webhook`.

## Control Room

Staff portal: [http://localhost:3000/admin](http://localhost:3000/admin). Same Supabase Auth as the public site. Only users with `app_metadata.role = admin` get in. There is no admin sign-up.

Grant the first admin in the Application SQL editor using `supabase/scripts/grant_control_room_admin.sql`, then sign out and log in again. Inviting more staff from `/admin/staff` needs `SUPABASE_SERVICE_ROLE_KEY`.

Run `supabase/migrations/20260826120000_profiles.sql` in the Venturo project before sign-up.

Brand source files stay in `architect/`.
