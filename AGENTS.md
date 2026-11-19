# hemu.krd: rules for coding agents

Read `README.md` first. This file states the norms the code already follows.
Where a rule is machine-enforced the check is named; the rest is review.

## Owner's standing rules

These apply to every agent, whatever tool it runs in. They are the owner's decisions; change one only when he says so.

- Finish in-flight pull requests before starting new work. No large parallel preparation for a new request.
- Just code, then check on a device only what the change could break. The owner does the rest of the QA and confirms tester builds himself.
- Report outcomes as they are: what was verified, what was not, and what failed. Never weaken a check to get green.
- Ask in chat before each production deploy. Production configuration, security settings and secrets changes need the owner's yes.
- Exception for this website (owner, 2026-11-19: « Me demande jamais pour mettre en ligne, toujours. Auto merge »): a pull request here is merged, and so deployed, without asking as soon as its CI is green. Report it done; do not ask whether to put it online.
- Store-console forms (Google Play, App Store Connect) are filled without per-step approval: decide from what the app and its docs establish, then report. Never type a password, one-time code or reviewer code, never accept an agreement, never upload identity documents; the owner does those.
- Never print or persist a secret, token or signed URL. Secrets are read only through the repository wrappers or private files with mode 600.
- Kurdish copy uses Kurdish words, not Arabic loanwords: a listing is «ڕیکلام» in Soranî and "reklam" in Kurmancî, everywhere (app, notifications, website, store pages). Soranî text uses Soranî digits. Turkish and Arabic keep their own words.
- Never mention AI in the app or its store pages, and never write a privacy statement that is not true.
- Every visible app change is also made in the "hemû - app" design project, so the design stays the reference.
- Chat must behave like a good messaging app. Do not offer a blunt workaround (a global cache wipe, a forced reload) as a fix.
- Keep `hemu.krd` minimal; show a rough version early.
- Staging and production share one version number. Raise it only in a pull request whose result will be released; quick test builds keep the number. Tag `staging-<version>-<build>` only after the owner confirms the build.
- The release JavaScript bundle cap (11 MiB) is raised only by the owner.
- While GitHub Actions is unavailable, the merge gate is the full local gate (`npm run ci:local -- <sha>`) on the PR head, noted in the PR. Merge with `--squash --match-head-commit`; never `--admin`, never auto-merge.
- The apps are in the stores: ship backend additions before the app needs them and remove from the backend only after the app stopped using it.

## How to work

- Keep the site minimal. It is a sparse landing page that ships to slow
  phones: no framework, no new dependency, no extra sections without the
  owner asking. Show a rough version early.
- Copy the nearest existing pattern. Make the smallest change that solves the
  stated problem. Never weaken a test to get green.
- No plan, audit or evidence Markdown in the repository. Evidence goes in the
  PR description.
- Never open or print `functions/.env`.

## Layout

- The landing page is `index.html`, `src/main.ts` (plain DOM code),
  `src/translations.ts` and `src/styles.css` (plain CSS with custom
  properties on `:root`).
- The page is one pinned phone that steps through eight app screens. The
  screens are `src/assets/screens/<screen>-<language>.webp`; `src/pieces.ts`
  lists, per language, the elements that lift off each screen. Both are
  generated from the app's store screenshots: regenerate them together, never
  edit one by hand.
- Static pages (`privacy`, `terms`, `data-deletion`, `support`,
  `auth/captcha`, `auth/callback`, `.well-known`) are hand-written under
  `public/`.
- `functions/` holds the one Cloud Function, `sharepreview`, with no
  dependencies beyond the Firebase libraries.

## Languages and wording

- Six languages: `ckb`, `ku`, `en`, `ar`, `tr`, `fa`. The site calls Kurmancî
  `ku`; the backend calls it `kmr`.
- Strings live in `T` in `src/translations.ts`, and only strings the page
  shows. They copy the app's wording exactly; the app is the reference.
- The Soranî strings are repeated in `index.html` for the first paint and must
  stay identical (`tests/landing.test.mjs`).
- Kurdish copy uses Kurdish words, not Arabic loanwords: a listing is «ڕیکلام»
  in Soranî and "reklam" in Kurmancî. "hemû" is never translated.
- Direction is set with `dir` on `<html>`.

## Routing and security

- `firebase.json` owns routing: explicit rewrites first, the catch-all last.
  Listing, profile and username paths go to `sharepreview`.
- `public/.well-known/` names both app identities. Replace `assetlinks.json`
  when a signing certificate changes, and keep the exclusions in the Apple
  file before its username catch-all.
- The content security policy and security headers are in `firebase.json` and
  repeated in `functions/preview.mjs`; a test keeps them equal. Never add
  `unsafe-eval` or a wildcard source.
- `sharepreview` calls only the fixed backends in its own table; a backend URL
  never comes from configuration or a request.
- The CAPTCHA page makes no sign-in call; it only returns a token to the app.

## Style

- TypeScript is strict with `verbatimModuleSyntax`. `src/` uses single quotes,
  two spaces and semicolons; `functions/` and `tests/` use double quotes.
  Follow the file you are in.

## Tests, gate and deploy

- Tests are `node --test` files in `tests/*.test.mjs`.
- Before every PR: `npm test && npm run build`.
- Branches are `agent/<kebab-topic>`. One squash merge per PR, with
  `--match-head-commit`. Use `gh` and git, never a browser. The title is a
  plain sentence saying what changes.
- A same-repository PR gets a preview channel. A merge to `main` deploys the
  tested build to `https://hemu.krd` and runs the smoke check. The function
  deploys separately.
