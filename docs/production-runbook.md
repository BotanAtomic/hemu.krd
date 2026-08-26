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
  username metadata plus the bounded event dictionary in
  `../mobile/docs/product-analytics.md`. If any of these change, update the
  privacy policy and store privacy declarations before release.

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
