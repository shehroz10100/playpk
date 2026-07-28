# PlayPK Mobile (Expo)

Native customer app for **Android** and **iOS** (separate from the [playpk.vercel.app](https://playpk.vercel.app) PWA).

## Run locally

```bash
# Terminal 1 — API (or use production Railway)
npm run dev:api

# Terminal 2 — Expo
npm run dev:mobile
```

Press `i` (iOS simulator), `a` (Android), or scan the QR with Expo Go.

Demo player: `player@playpk.demo` / `PlayPK@player1`

For a physical phone against your laptop API:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:4000 npm run dev:mobile
```

Release/preview builds default to `https://api-production-2057.up.railway.app`.

## Store builds (EAS)

You need:

1. [Expo account](https://expo.dev) + `npx eas-cli login`
2. **Google Play** developer account (Android)
3. **Apple Developer** account (iOS, paid)

Then from the repo:

```bash
cd apps/mobile
npx eas-cli init          # creates EAS project; paste projectId into EAS_PROJECT_ID if prompted
npx eas-cli build --platform android --profile preview    # APK for testers
npx eas-cli build --platform android --profile production # AAB for Play Store
npx eas-cli build --platform ios --profile production     # IPA for App Store
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```

Profiles are in `eas.json`. App identity:

- Android package: `pk.play.app`
- iOS bundle: `pk.play.app`

## Web vs native

| | Web PWA | This Expo app |
|---|---|---|
| URL | playpk.vercel.app | Install from stores / Expo |
| Add to Home Screen | Yes | Native icon |
| App Store / Play Store | No | Yes (after EAS submit) |

Booking rules match the web: **Rs 1,000 advance per slot**; sport discounts apply only to remaining balance at the venue; multi-slot selection supported.
