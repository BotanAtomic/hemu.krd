# hemu.krd: rules for coding agents

Read `README.md` first. This file states the norms the code already follows.
Where a rule is machine-enforced the check is named; the rest is review.

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
