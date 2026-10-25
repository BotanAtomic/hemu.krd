# Public website production runbook

Read `../../hemu-supabase/docs/SYSTEM-ARCHITECTURE.md` from the parent
workspace before changing hosting, app links, or public legal disclosures.
The live public `hemu.krd` Firebase Hosting target currently lives in Firebase
project `hemu-fd2f4` by explicit decision. It is public hosting only, not the
mobile staging backend.

## Canonical hosting decision

`https://hemu.krd` is the sole canonical public origin for landing pages,
privacy pages, account-deletion instructions and mobile App/Universal Links.
Firebase Hosting owns the live custom-domain deployment. The Docker image is
used only for local production-build smoke tests; there is no secondary live
deployment or Coolify fallback.

Before changing hosting, select one authoritative production origin and verify
its DNS, certificate, security headers, and association metadata. This
repository intentionally does not change DNS or current live hosting
configuration.

## Before a live deployment

- [ ] CI is green and branch protection/review requirements pass.
- [ ] `npm run security:secrets`, `npm audit --omit=dev --audit-level=high`,
  `npm run verify:production-readiness`, `npm run verify:associations`, and
  `npm run verify:share-links` pass.
- [ ] Confirm `hello@hemu.krd` is monitored. Keep `src/support.ts` and all
  legal `mailto:` links in sync; the readiness check will reject drift.
- [ ] Verify legal text, retention promises and actual deletion/backup behavior
  still agree.
- [ ] Confirm the mobile Amplitude configuration still uses the disclosed US
  data region, keeps autocapture/session replay disabled, sets only the stable
  Hemu/Supabase user UUID as authenticated `user_id`, and sends only public
  username metadata plus the bounded event dictionary and platform,
  environment and app-language labels in
  `../mobile/docs/product-analytics.md`. If any of these change, update the
  privacy policy and store privacy declarations before release.

## Store disclosure and launch inputs

The public pages describe the approved behavior, not proof of a production
retention rehearsal or submitted store forms. Use the current backend
`docs/chat/CONTRACT.md`, `docs/chat/RETENTION.md`, and
`docs/production/READINESS.md`, plus the mobile analytics dictionary, as the
source of truth. The October 23, 2026 copy was checked against backend
`8a9b063c32343db04c8f42bce90c1e8877fa85bb` and mobile
`0b3ef258cd22090de335672cc7dc36d4b06bcfc2`; recheck those sources before launch.

| Input | Prepared facts and remaining verification |
| --- | --- |
| App Privacy / Play Data Safety | Include chat message content, private photos, user-shared precise location, linked analytics account/device identifiers and product interactions, and diagnostics. Map every SDK and purpose to the actual store questions; this table is not a completed declaration. |
| Sharing and retention | Disclose reported-chat human moderator access and sender/message content through Expo/APNs/FCM. Account-erasure grace is 30 days, shared locations 90 days, chat photos 365 days, report-note text 30 days, and audit records one year. Backups have separately owned retention. |
| Analytics decisions | Confirm the configured Amplitude retention, any applicable consent/choice flow, and store declarations with the owner. The source does not establish a user-facing retention duration or an opt-out promise. |
| Public URLs and support | Use `https://hemu.krd/support`, `/privacy`, `/terms`, and `/data-deletion`. Verify `hello@hemu.krd` is monitored and can receive requests; DNS alone does not prove mailbox delivery. |
| Store assets and copy | Obtain the approved localized store copy and screenshot exports for the actual signed candidate, including English and Sorani RTL. No approved export/upload manifest was established in the October 23 repository review; current portal uploads remain unverified. |
| Store account forms | Owner/reviewer access, age/content ratings, territories, app access instructions, and final privacy/Data Safety answers require portal readback. Do not mark them complete from source alone. |
| Google Play testing | Verify the account's current progress against Google's 12 opted-in closed testers for 14 continuous days and production-access application. A draft app or internal-testing upload does not establish this gate. |
| Runtime and legal gates | Complete the hosted retention rehearsal, separately owned backup retention/restore checks, physical-device push preview/delivery QA, and counsel's confirmation of the owner-accepted one-year audit minimum before public launch. |

References: [Apple App Privacy](https://developer.apple.com/app-store/app-privacy-details/),
[Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en),
[Google Play closed-testing requirements](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
The conditional Turnstile paragraph does not establish that CAPTCHA is configured;
verify the real site keys, provider secret, and sign-in flow separately.

## After deployment

- [ ] `npm run verify:associations:live` passes.
- [ ] `npm run verify:share-links:live` passes.
- [ ] `npm run verify:security-headers -- https://hemu.krd` passes.
- [ ] Check `/privacy`, `/terms`, `/data-deletion`, `/listing/<id>`,
  `/u/<id>`, `/signup` and a root username link from an iPhone and Android
  device.
- [ ] Confirm the browser shows a valid certificate for `hemu.krd`.

## Rollback

Redeploy the last known-good immutable hosting release, then re-run all three
live verification scripts. Do not roll back App/Universal Link metadata without
also confirming the currently distributed iOS and Android signing identities.
