# Mobile release checklist

What stands between "works on the simulator" and "a customer installs it". Items marked **YOU** need an account, a decision or a value only BTSolve can supply; nothing here has been done on your behalf.

## Done in the repository

- **Icon and splash:** the Sailix sail mark (taken from the old Sailix Flutter project's `assets/images/sailix_icon.png`, copy kept in `mobile/assets/brand/`) on white for the app icon, on sand for the splash, an Android adaptive icon (white background, sail foreground, black-silhouette monochrome layer) and a favicon. `expo-splash-screen` configures the splash. The old wordmark (blue-to-green "SAILIX") is not used; the in-app colours are the teal "Harbor" palette, which does not match the logo's blue. Decide whether the app palette should move to the logo's blue (**YOU**).
- **Shipped builds cannot point at a developer machine:** staging and production refuse a non-https API address and also localhost, `127.*`, `10.*`, `172.16–31.*`, `192.168.*` and `*.local` (`src/app/config/env.ts`, tested).
- **Crash handling:** a render error shows a calm "Something went wrong / Try again" screen (no technical text); uncaught JS errors are passed to a reporter. **No crash service is attached** (see below).
- Demo mode is forced off in production builds (already tested).

## Needs you

1. **Crash reporting service.** Choose one (for example Sentry) or keep none. Any service sends crash data from customers' phones to another company, so it needs your approval and a privacy-policy line. Wiring it is one call to `setCrashReporter` plus the vendor SDK; do not put tokens, passwords, answers or personal data in the context.
2. **Production API address.** Set `API_BASE_URL` (and `API_PREFIX` if different) as EAS environment variables for the `staging` and `production` profiles. `eas.json` deliberately holds no address. The app refuses to start with a bad one.
3. **Privacy policy URL.** `PRIVACY_URL` currently defaults to `https://www.btsolve.com/privacy/data-privacy-sailix.html`, which is a guess; confirm the page exists and covers Sailix, or set the real one. It must also describe the Tala link (what is stored: an encrypted Tala token on the server, no Tala password).
4. **Apple and Google accounts.** Apple Developer Program team (bundle id `com.btsolve.sailix2` is a placeholder from development, change before the first store build if you want another), App Store Connect app record, Google Play Console app (package `com.btsolve.sailix2`).
5. **Signing.** Let EAS manage credentials (`eas credentials`), or provide your own. Needs the accounts above.
6. **Store listing.** Name, description, screenshots (the demo build can produce them), category, age rating, and the data-safety / privacy answers (Apple "App Privacy", Google "Data safety"): the app handles name, email, username and learning progress; it uses no tracking and no ads.
7. **Account deletion.** Both stores require an in-app route to request deletion; Account > "Request account deletion" exists but only notifies the organization (decision Q-3 on what deletion means is still open). Confirm that satisfies the store reviewers.
8. **Version policy.** `app.config.ts` version is `1.0.31` (carried over); `eas.json` auto-increments the build number remotely. Decide the first public version.

## Before the first customer (testing, nothing built for it here)

- Run on real iPhones and at least one Android phone, not only the iOS simulator (touch input does not work in the simulator used so far; the flashcard flip animation has never been seen moving).
- Screen-reader pass (VoiceOver and TalkBack) by hand.
- A TestFlight / internal-track round with one real organization and a real Tala account, with the Tala write switch still off, then decide on switching it on (docs/14 §5).

## Commands (when the accounts exist)

```bash
cd mobile
npx eas-cli@latest build --profile staging --platform all
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production --platform all
```
