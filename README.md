# PolarBridge

Winter-themed SIH polar outreach prototype with a Next.js frontend and PostgreSQL editorial backend. This is an independent prototype, not an official institutional portal.

## Local setup

Use Node.js 24 LTS (minimum 22.15) and npm. From this folder:

```sh
npm ci
npm run db:setup
npm run db:local
```

For uploads, configure the scanner/worker described in UPLOADS.md. Without a running scanner, files stay private and cannot enter review.

Keep the database terminal open. In another terminal:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000/workspace. Local demo passwords are generated in `.local-data/demo-accounts.json`. Sign in separately as contributor, reviewer and publisher to demonstrate the complete flow. These are local test accounts only. The seed publishes four reference links with explicit demonstration audit notes; it does not imply institutional approval.

The local database is persistent PGlite with a loopback PostgreSQL socket. It is for development only. Keep `.local-data` and `.env.local` private and out of Git and deployment archives. The production application uses `pg` with a managed PostgreSQL connection.

```sh
npm run test:backend
npm run typecheck
npm run build
npm start
```

Backend tests use their own in-memory database on port 54330, separate from demo data on 54329. In this Windows sandbox, production builds use `POLARBRIDGE_SANDBOX=1` to avoid restricted process spawning; that setting is not needed on Vercel.

## What works

- Responsive winter design, licensed photography, pausable snow and reduced-motion support.
- Repository search/filtering, source detail pages, regional collections, learning and media pages.
- Provisioned staff accounts, database-backed sessions and contributor/reviewer/publisher roles.
- Immutable draft revisions, independent review, change requests, publication and withdrawal.
- Public pages read only the published revision; later drafts stay private until separately approved.
- Source attribution, public/staff/owner-only visibility, rights and embargo release checks.
- Private PDF/photo uploads, scan status, image metadata removal and reviewed attachment downloads.
- Append-only editorial history. Previous browser drafts remain at `/workspace/local`.

## Vercel deployment

1. Import this folder as a Next.js project. For the whole workspace repository, set Root Directory to `outputs/polarbridge`.
2. Use Node.js 24 and `npm run build`, with the default Next.js output settings.
3. Set `DATABASE_URL` to your managed PostgreSQL provider's TLS connection URL. Use its serverless-compatible pooled endpoint for runtime and its recommended direct endpoint for migrations. Never disable certificate verification.
4. Set a random `BETTER_AUTH_SECRET` of at least 32 characters and `BETTER_AUTH_URL` to the exact HTTPS deployment origin. Configure preview and production separately. Do not set `POLARBRIDGE_LOCAL_DB` or `POLARBRIDGE_SANDBOX` on Vercel.
5. Before release, run `node --import ./scripts/register.mjs scripts/migrate.ts` from a trusted machine or CI with the target database and auth environment configured. Migrations are deliberately not automatic during Vercel builds. Migration tooling needs dev dependencies installed.
6. Provision actual accounts using `scripts/provision-staff.ts`, with `STAFF_EMAIL`, `STAFF_NAME`, `STAFF_PASSWORD` and `STAFF_ROLE` in the environment. Run `node --import ./scripts/register.mjs scripts/provision-staff.ts`. Accepted roles are contributor, reviewer and publisher. Never seed local demo accounts into production. Public signup is disabled.
7. Verify login/logout, separate role access, release and withdrawal on a preview database before promoting. Preview deployments must not share the production database by default.

Vercel hosting and a managed database are not provisioned by this source package. Configure database backups, restore tests, least-privilege runtime credentials and monitoring before real institutional use. Password reset email and account-management UI are not implemented; inactive staff access can be revoked in `staff_members`.

## Implementation boundary

This milestone uses Next.js Node route handlers for authentication and catalogue APIs to keep the web application deployable as one Vercel project. This is a scoped implementation decision relative to the broader companion SAD; long-running extraction and scanning still need a separate worker service.

PDF and photo uploads now use private storage, checksum validation, a separate antivirus worker (ClamAV or local Windows Defender) and revision-bound publication permissions. See UPLOADS.md for setup and current scanner verification limits. The Outreach Studio now supports English/Hindi drafting and review with an optional AI adapter. Live AI evaluation, full dataset ingestion and automatic social publishing remain future milestones. Two clearly labelled sample learning articles remain static examples outside the editorial database. Public catalogue retrieval is capped at 1,000 records and staff lists at 200; server-side search/pagination is needed for larger collections. The current rate limiter uses a conservative shared fallback when trusted client IP forwarding is unavailable; validate provider-specific trusted proxy configuration before scaling.

See `db/001_catalogue.sql`, `tests/backend.ts` and `VERIFICATION.md` for schema and checks. Photos are illustrative rather than expedition records; see `ASSET_CREDITS.md` and `/about#credits`.

## Outreach Studio

Open `/workspace/studio` for source-linked English/Hindi drafting and independent review. Reviewed stories appear at `/outreach`. Manual writing works without an AI key. See [OUTREACH.md](OUTREACH.md) for optional OpenAI configuration, processing clearance and verification limits.

## Hosted deployment preparation — 4 October 2026

See [DEPLOYMENT.md](DEPLOYMENT.md) for Neon setup, private connection settings, migration checks and Vercel configuration. Hosted resources have not yet been provisioned. The existing local demo settings remain unchanged.
