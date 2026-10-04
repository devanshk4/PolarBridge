# Hosted database and Vercel setup

Prepared 4 October 2026. No hosted resources have been created or deployed yet.

## 1. Create the database

1. Open [Neon Console](https://console.neon.tech/) and sign in or create an account yourself.
2. Create a project named `polarbridge`. Choose a region close to the intended Vercel function region. Select the free plan if available and review its current limits before enabling paid services.
3. Open **Connect** for the new database. Copy the PostgreSQL connection URL with **Connection pooling** enabled.
4. Open the private local file `.local-data/deployment.env`. Paste the pooled URL after `DATABASE_URL=`. Paste only the URL, without the surrounding `psql` command.
5. Turn pooling off in the Connect dialog and copy that URL after `DATABASE_URL_UNPOOLED=` in the same file. Preserve the provider's TLS parameters. Do not paste either URL into chat: both contain a password.
6. Save the file and tell the assistant **“database saved”**. The next action will be a read-only connection check, followed by schema setup against this new project.

The local `.env.local` file continues to point to the existing local demo database. The deployment file is excluded by `.gitignore` and must never be uploaded as source. Its random authentication secret was generated separately from the local demo secret.

Neon describes [pooled connection setup](https://neon.com/blog/authenticating-users-in-astro-using-neon-postgres-and-lucia-auth). The provider console is authoritative for your current project, available regions and limits.

## 2. Verify and initialize

Run from the `outputs/polarbridge` project directory after saving the private settings:

```powershell
node --env-file=.local-data/deployment.env --import ./scripts/register.mjs scripts/check-hosted-db.ts
```

The check opens the pooled connection, verifies encrypted transport and reports which application migrations are present. It does not create tables or change records, and it does not print connection strings.

For initial schema setup, the existing migration script now prefers `DATABASE_URL_UNPOOLED` when supplied:

```powershell
node --env-file=.local-data/deployment.env --import ./scripts/register.mjs scripts/migrate.ts
```

Before this step set `BETTER_AUTH_URL` in the private deployment file to the exact HTTPS origin chosen for the Vercel project. Schema migration is a deliberate database write and is never run automatically by the Vercel build. Do not run `db:seed` against the hosted database: that script is for local demo accounts. Create separate contributor, reviewer and publisher accounts with the documented staff provisioning script once the target is verified.

## 3. Configure Vercel

Import the repository into Vercel as a Next.js project:

| Setting | Value |
| --- | --- |
| Root directory | `outputs/polarbridge` if importing the whole workspace; otherwise the project root |
| Node.js | 24 |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | Leave at the Next.js default |

Configure server-side environment variables. Use Vercel's **Secret** type for credentials. Do not add a `NEXT_PUBLIC_` prefix.

| Variable | Value / purpose |
| --- | --- |
| `DATABASE_URL` | Pooled hosted database URL |
| `BETTER_AUTH_URL` | Exact HTTPS application origin, with no path |
| `BETTER_AUTH_SECRET` | Separate random secret from the private deployment file |
| `POLARBRIDGE_STORAGE` | `s3` |
| `S3_BUCKET`, `S3_REGION` | Private storage bucket settings |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Restricted storage credentials |
| `S3_ENDPOINT`, `S3_PATH_STYLE` | Only if required by the selected compatible provider |
| `POLARBRIDGE_AI_ENABLED` | `0` initially; enable after live provider verification |
| `POLARBRIDGE_AI_PROVIDER` | `gemini` |
| `GEMINI_MODEL` | `gemini-3.8-flash` (verify access before enabling) |
| `GEMINI_API_KEY` | Add privately if enabling AI |

Do not copy `POLARBRIDGE_LOCAL_DB`, `POLARBRIDGE_SANDBOX`, local storage paths, Windows Defender settings or demo credentials to Vercel. The direct database URL is for trusted migration tooling; it need not be present in the website environment.

Keep Preview and Production on separate databases or branches with separate credentials. Add exact preview origins as their own configuration; the app rejects cross-origin writes. Environment changes require redeployment. See [Vercel environment management](https://vercel.com/docs/environment-variables/manage-across-environments) and [Config/Secret variable types](https://vercel.com/changelog/environment-variables-now-use-config-and-secret-types).

## 4. Complete uploads before calling the deployment ready

The hosted database alone does not make uploads production-ready. The current uploader uses presigned POST with checksum fields, so the chosen storage provider must support that exact flow; do not assume all S3-compatible providers do. Configure a private bucket and exact browser-origin CORS, then verify reserve/upload/complete/scan/download against it.

Run the ingestion watcher on a separate Node host with the hosted database, private storage access and a private ClamAV connection. Vercel hosts the website; it does not run our persistent antivirus process. Windows Defender is local-demo-only. See `UPLOADS.md` for worker configuration. Unscanned files remain private.

## 5. Release checks

- Verify hosted migrations, TLS and independent staff logins.
- Check public discovery, source links, draft isolation, review, publication and withdrawal.
- Verify upload checksums, scan rejection, clean downloads and withdrawal of attachment access.
- Check source-linked outreach review and source-withdrawal invalidation.
- Test Gemini separately; a short response has succeeded locally, but full drafting remains unreliable.
- Confirm backup/restore and deployment rollback procedures before real institutional use.

The next immediate dependency is the two Neon connection URLs in the private deployment file. Storage, the worker and the final Vercel deployment remain subsequent steps.
