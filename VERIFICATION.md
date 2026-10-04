# Verification — backend milestone

Date: 28 September 2026.

- Production build: passed, including TypeScript and route compilation.
- TypeScript standalone check: passed.
- Isolated PGlite/PostgreSQL backend integration tests: passed. Covers authentication, disabled public signup, active-role revocation, owner isolation, independent review, immutable revision content and audit history, stale revision conflicts, replacement publication, withdrawal, rights, visibility and embargo gates.
- Browser: contributor login, loaded database records, selected published revision with source and editorial history; narrow-screen layout inspected.
- Four institutional source references seeded as explicitly labelled local workflow demonstrations. Two static learning samples remain outside the database.

Tests exercise PostgreSQL semantics using PGlite, not a managed provider's network, connection pool, concurrency or TLS behavior. Vercel deployment, provider backups/restore, production load and accessibility audit remain unverified. At that earlier milestone file ingestion and AI generation were not implemented; see the upload milestone below for the current status.

Run `npm run test:backend` for isolated tests. With the local seeded database and production server running, `node tests/http-smoke.mjs` exercises real HTTP handlers; it retains withdrawn local test records and audit history. Allow at least a minute between repeated smoke runs to respect authentication throttling.

- Live HTTP smoke test: passed authentication, origin rejection, create/review/publish, public detail, withdrawal with 404, and logout. Desktop and mobile workspace layouts inspected in the browser.


## Upload milestone — 29 September 2026

- Production build and TypeScript: passed after upload UI and route integration.
- Isolated backend suite: passed existing editorial checks plus upload type/size validation, cross-owner denial, idempotent finalization, scan failure/retry, ClamAV INSTREAM protocol handling with an explicit fake test server, image EXIF removal, clean-artifact immutability, per-revision attachment rights, published-file access and withdrawal.
- Real HTTP upload smoke: passed PDF reservation, byte transfer, duplicate finalization, CSRF origin denial, anonymous denial and quarantined-download denial.
- Browser: contributor selected a generated JPEG, uploaded privately, entered credit/permission metadata and saved a draft. Submitting before a successful scan returned the expected blocking message. The fixture remains unpublished.
- Local ingestion worker ran against the uploaded photo with no configured scanner; it recorded a failed scan and left the file private, as intended.

A successful real ClamAV scan and S3/Vercel integration remain unverified: no scanner daemon, hosted bucket or deployment credentials were available. Tests do not represent antivirus efficacy or production load testing. Successful scan tests use isolated fixtures only; production code has no scanner bypass. See UPLOADS.md for deployment and worker requirements.

- Final desktop attachment panel and scan refresh/retry controls inspected. Local database multiplexer configured for 10 connections; worker and public catalogue requests succeeded concurrently after restart.

## Real scanner milestone — 30 September 2026

- Added a Windows-only, local-development scanner backed by Microsoft Defender. A separate PowerShell worker processes checksum-bound requests; unknown results, missing workers and scanner errors fail closed. The ClamAV TCP provider remains available for hosted workers.
- Real scanner health check passed. Benign bytes were accepted and the standard harmless EICAR antivirus test fixture was rejected. This does not establish general antivirus efficacy or signature freshness.
- Live HTTP integration passed: private PDF/photo upload, actual scanning, separate contributor/reviewer/publisher accounts, public downloads, PDF checksum preservation, photo EXIF removal, withdrawal denying both files and the resource page, and independent review/publication of a new revision.
- An invalid-type upload was rejected and remained inaccessible. This is separate from the standalone EICAR scanner check.
- TypeScript and the isolated backend integration suite passed again. No new frontend production build was required for this worker milestone.
- Browser inspection confirmed the clearly labelled generated demonstration, report/photo credits and both download links on the published resource page.
- Local demonstration: http://localhost:3000/resources/demonstration-from-private-upload-to-public-discovery-900ce961

The local scanner worker and ingestion watcher must remain running to process new files. See UPLOADS.md for startup commands. Windows Defender is a local demonstration provider and cannot run on Vercel. Optional checksum-verified portable ClamAV setup scripts are included, but its download/setup did not complete in this environment. Managed database, S3-compatible storage, hosted ClamAV worker and Vercel deployment remain unverified. AI generation remains outstanding.

## Outreach Studio milestone — 1 October 2026

- Added `/workspace/studio`: published source selection, English/Hindi manual writing, student explainers, website news and social captions, passage-level evidence, immutable revisions, independent review, publication and reviewed Markdown export.
- Source replacement or withdrawal invalidates dependent reviews and withdraws released stories. Public reads and exports recheck source eligibility.
- Optional OpenAI Responses adapter is configured through server-only variables and per-source publisher clearance. Missing configuration is explicitly shown; manual writing remains available. No paid or live AI calls were made.
- Isolated backend suite passed, including outreach ownership, exact-revision approval, invalid citations, immutable history, export restrictions, source invalidation, clearance and 20 mocked failure cases. These are contract tests, not model-quality evaluations.
- Live HTTP workflow passed authentication/origin controls, save, review, publish, export, withdrawal and republish. A labelled English manual demonstration remains published; a Hindi manual demonstration remains a draft.
- Browser verified contributor login, studio navigation, Hindi content, edit-as-new-revision and successful save as version 2. Narrow-screen layout inspected.
- TypeScript and the production build passed. A final build includes the public discovery links and simplified citation presentation.

Scope limits: catalogue text is the evidence source; PDF extraction, linked bilingual editions, live model-quality/translation evaluation, production provider configuration and Vercel deployment remain outstanding. See OUTREACH.md for setup and limits.

## Gemini adapter — 1 October 2026

- Added selectable Google Gemini/OpenAI adapters with server-only credentials and model settings.
- Provider-specific source clearance preserves prior OpenAI approval without extending it to Google; generation metadata now records the provider.
- Gemini parsing accepts only complete, unblocked structured output and retains the existing evidence/review gates. Quota exhaustion returns a clear error without automatic retry or paid fallback.
- Backend contract tests and TypeScript passed. Gemini tests use explicit mocked responses; no live Gemini request has been made.
- Local Gemini settings are prepared, with an empty GEMINI_API_KEY slot for private entry. Actual access, free-tier quota and live model behavior still require verification after configuration.

## Live Gemini connection check — 1 October 2026

The saved key is kept server-side. Live checking exposed a response-format compatibility issue, corrected to responseMimeType/responseJsonSchema. Google reports that Gemini 2.5 Flash is unavailable to new users; the configured/default model is now gemini-3.8-flash. Backend tests and production build passed after the changes. The first live request to the new model returned a temporary provider high-demand error; this is not a successful generation test.
The subsequent full demo draft request exceeded the 40-second provider timeout. No AI-generated draft was saved or published. Live drafting is therefore not yet verified; retry from the studio when provider capacity is available.

## Low-thinking diagnostic — 1 October 2026

A live minimal request to Gemini 3.8 Flash completed in 18 seconds with thinkingLevel=low and returned "ready". The previous 64-token diagnostic stopped at MAX_TOKENS without text. The studio now requests low thinking while retaining its 2,400-token output cap and 40-second timeout. A full source-linked draft still failed with a provider error after 39 seconds; no draft was saved. This verifies basic connectivity only, not reliable full generation. The attempted backend suite rerun was blocked by Windows EACCES on the isolated test port 54330; the earlier suite passed before this one-field provider setting change.

## Hosted deployment preparation — 4 October 2026

Prepared DEPLOYMENT.md and an ignored private deployment settings file. Added a read-only hosted database/TLS/migration check; the blank configuration correctly reports MISSING_DATABASE_URL. Migration tooling can use DATABASE_URL_UNPOOLED without changing the website's pooled connection setting. No hosted connection, migration, account creation or deployment was performed. Hosted credentials remain the next dependency.
