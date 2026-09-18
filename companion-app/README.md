# Venturo Companion App

Native iOS & Android door scanner for Event Hosts. Same Supabase project as the website. Camera QR, offline guest list, then sync.

Bundle IDs:

- iOS: `za.co.venturo.companion`
- Android: `za.co.venturo.companion`

## Run locally

```bash
cd companion-app
cp .env.example .env
# paste EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# (same values as the website NEXT_PUBLIC_ keys — never the service role key)
npx expo start --dev-client
# keep this running, then Product → Run in Xcode (or press ⌘R in the simulator)
```

Open in Expo Go to try login & the guest list. Camera QR is more reliable on a **development build** or a store build.

Xcode 26 rejects `SWIFT_RETURNS_RETAINED` on Expo's `RuntimeScheduler` constructors (`expo-modules-jsi` 57.1.0). A `patch-package` patch in `patches/` strips those attributes. User Script Sandboxing is off so CocoaPods can copy resources. After `npm install`, pick an **iPhone simulator** (not a locked physical iPhone) and build. A device / App Store build needs an Apple ID under Xcode → Settings → Accounts and a Team on the VenturoCompanion target.

## Ship to the App Store & Google Play

You need:

1. [Apple Developer Program](https://developer.apple.com/programs/) (R1,600 / year)
2. [Google Play Console](https://play.google.com/console) (once-off $25)
3. An [Expo](https://expo.dev) account
4. Privacy policy URL: `https://www.venturo.co.za/privacy_policy/`
5. Store screenshots from an iPhone & an Android phone at the door

Then, from this folder:

```bash
npx eas-cli login
npx eas-cli init
npx eas-cli build --platform all --profile production
npx eas-cli submit --platform all --profile production
```

`eas init` writes the Expo project id into `app.json`. The first iOS build will ask for your Apple team. The first Android build creates a Play signing key — keep that safe.

After submit:

- iOS lands in App Store Connect → TestFlight, then you send for review
- Android lands on the internal track; promote to production when you are happy

Add these Redirect URLs in Supabase Auth → URL Configuration:

- `venturo-companion://`
- `https://www.venturo.co.za/companion`

## Store listing copy (SA English)

**Name:** Venturo Companion App  
**Subtitle:** Scan tickets at the door  
**Description:** Pull the guest list onto your phone, scan QR codes from screens or printed tickets, & keep checking people in if the venue Wi-Fi wobbles. Same Venturo account as Event Host.
