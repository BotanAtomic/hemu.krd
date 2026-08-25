# Public website production runbook

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
- [ ] Confirm `contact@botan.dev` is monitored. When moving to a `@hemu.krd`
  mailbox, update `src/support.ts` and all legal `mailto:` links together; the
  readiness check will reject drift.
- [ ] Verify legal text, retention promises and actual deletion/backup behavior
  still agree.

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
