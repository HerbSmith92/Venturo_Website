# Venturo Application push tokens

Control Room sends lock-screen alerts with Apple APNs and Firebase Cloud Messaging. The website does not use Expo tokens. Companion is not counted.

`push_devices.app` must be **`member`**.

## Register

Call while signed in. Granted to `authenticated`. `auth.uid()` owns the row.

```
public.register_push_device(
  p_install_id,
  p_platform,
  p_app,
  p_token,
  p_apns_environment
)
```

| Arg | Rule |
| --- | --- |
| `p_install_id` | UUID, stable for this install |
| `p_platform` | `ios` or `android` |
| `p_app` | `member` |
| `p_token` | iOS: hex `^[0-9a-f]{64,200}$` from `didRegisterForRemoteNotifications`. Android: FCM registration token, 20–4096 chars, no spaces. Null until permission is granted |
| `p_apns_environment` | iOS with a token: `sandbox` (Xcode debug) or `production` (TestFlight & App Store). Android: omit / null |

`ExponentPushToken[...]` and `ExpoPushToken[...]` are rejected.

Call after sign-in, after notification permission, when the token rotates, and on each cold start if signed in.

Sign-out: `unregister_push_device(p_install_id, p_app)`.

Until this RPC runs, Control Room **Phones** stays 0. Until `p_token` is set, **Push ready** stays 0 and the message stays in the in-app inbox.

## Payload

Lock-screen title & body come from Control Room. Deep link is a site path, not a custom URL scheme.

| Key | Example |
| --- | --- |
| `path` | `/guides/...` or `/events/...` |
| `kind` | `guide` or `event` |
| `id` | UUID |
| `slug` | public slug |
| `when` | 24-hour, when an event time is known |
| `campaignId` | Control Room campaign UUID |

Apple: `aps.alert` plus those keys at the payload root. Android: FCM `notification` plus `data` with the same keys (all strings).

## Website env (Vercel Production)

Server-only. Do not prefix with `NEXT_PUBLIC_`.

- `APNS_BUNDLE_ID` — iOS bundle, currently `com.app.venturo` unless the App Store id differs
- `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` — Apple AuthKey `.p8`
- `FIREBASE_SERVICE_ACCOUNT` — Firebase service-account JSON with Cloud Messaging
