# Reports and photographs

## Implemented journey

Sign in as a contributor, select **New reference** or **Create revised draft**, then choose a PDF, JPEG, PNG or WebP. Uploads are private; add the document label or image description, author/photographer credit, permission evidence and public-use confirmation. Save the draft. Refresh scans after the ingestion worker finishes. Submit only when every attachment has passed scanning. A reviewer inspects the exact revision and a publisher releases it.

Changing attachments creates a new revision and requires new approval. The previously published version remains accessible until replacement or withdrawal. Withdrawal stops new file access immediately; already issued S3 download URLs expire within 60 seconds. Downloaded copies cannot be recalled. PDF files download as attachments rather than rendering inside the application. Re-encoded photographs have EXIF/GPS metadata removed and can appear in the public resource page and media collection.

Limits: 8 attachments per revision, 50 MB per PDF, 20 MB per photograph, 24 megapixels per decoded image, 50 upload reservations / 500 MB per contributor per rolling day. Empty files, extension/type mismatch and checksum mismatch are rejected. Videos and datasets remain external references in this milestone.

## Local development

The setup script sets `POLARBRIDGE_STORAGE=local`. Bytes are stored under `.local-data/files`, never under `public`. The local-only upload route rejects use on Vercel. Run migrations after updating:

```sh
npm run db:migrate
npm run files:process
```

`files:process` handles at most 20 jobs then exits; run it again for later uploads. It must have access to the same database and file storage as the application. Configure `CLAMD_HOST` and `CLAMD_PORT` for a running ClamAV daemon on a trusted private network. Keep its signature database current, set its stream/file scan limits above 50 MB, and configure detection of encrypted and over-limit content rather than silently skipping it. ClamAV TCP has no authentication or encryption; do not expose it to the internet.

Without a configured scanner, uploads work but scanning moves to **Scan unavailable** and submission stays blocked. After correcting the worker/scanner setup, use **Retry scan** and rerun the worker. A rejected file must be replaced with a new upload. A failed scan can be retried up to five attempts. There is no production switch to mark unscanned files clean.

The Windows demo now supports a real Windows Defender worker (see below). ClamAV remains available for a separately hosted deployment worker. The isolated backend tests still use controlled fixtures; `npm run test:scanner` is the separate real-antivirus integration check.

## Vercel and private object storage

Use an S3 bucket with all public access blocked, or a provider verified to support SigV4 POST policies, exact content-length ranges and SHA-256 checksum validation. Set `POLARBRIDGE_STORAGE=s3`, `S3_BUCKET`, `S3_REGION`, and AWS credentials; optional `S3_ENDPOINT` and `S3_PATH_STYLE` support compatible providers. Vercel receives only small upload-reservation and finalization requests. The browser sends file bytes directly to storage using a five-minute signed POST restricted to a generated quarantine key, content type, size and checksum.

Bucket CORS must allow POST from the exact application origin; do not use a wildcard for private staff workflows. Configure separate buckets/credentials for preview and production. Do not grant anonymous reads. Runtime credentials need quarantine writes, object metadata/reads, and clean-object reads for signed downloads. Worker credentials additionally need clean-object writes. Clean object keys are random and never reused. Do not give staff direct storage credentials. Keep TLS verification enabled for database and object storage connections.

Run `node --import ./scripts/register.mjs scripts/ingest.ts` on a separate worker with database, storage and private scanner connectivity. Schedule it frequently or invoke through a supervisor. Deploy that process with a memory limit and hard execution timeout (recommended initial limits: 512 MB and 5 minutes per invocation); recycle it on timeout. Images have an internal 20-second processing timeout. Quarantined content is not parsed in a Vercel request. Document text extraction is not implemented.

Jobs use database leases and `FOR UPDATE SKIP LOCKED`; expired leases can be reclaimed after ten minutes. A worker only commits a result for its lease. Clean bytes are written to a fresh key before readiness is committed. A crash can leave an orphan, but cannot expose an incomplete file. Checksum validation occurs on the bytes actually scanned, so overwriting a quarantine key cannot change the clean artifact approved later.

## Operations and remaining work

- Verify a real clean file, the standard EICAR antivirus test fixture, scanner failure, S3 CORS and the full browser workflow in staging. Use only designated security-test fixtures in a controlled environment.
- Monitor queue age, failed scans and storage usage; the UI exposes statuses, but no monitoring service is provisioned.
- Quarantine/orphan retention is manual in this milestone. No automatic deletion is enabled. Add a reviewed reconciliation job before sustained use; never delete clean objects referenced by historical revisions without an approved retention policy.
- Add managed PostgreSQL concurrency/load tests and storage-provider integration tests before production. The local suite uses PGlite and temporary private files.
- Permission text and public-use confirmation are reviewed declarations, not automated copyright verification. Scanning reduces risk but is not a guarantee that a file is harmless.

Implementation references: [S3 presigned uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/using-presigned-url.html), [ClamAV stream protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html), [Sharp output metadata behavior](https://sharp.pixelplumbing.com/api-output/).


## Windows Defender demo setup (30 September 2026)

Set `POLARBRIDGE_SCANNER=defender-local` in the ignored `.env.local` (already configured on this machine). This adapter requires Windows, `POLARBRIDGE_LOCAL_DB=1`, the installed Microsoft Defender command-line scanner and English scan-result output. Unsupported or ambiguous results fail closed. It is forbidden on Vercel.

Keep the database and website running. Start these in separate terminals:

```sh
npm run scanner:defender
npm run files:watch
```

The first process handles only generated upload-scan requests in `.local-data/defender-queue`; the second processes the database ingestion queue. The scanner has no listening network port. Requests contain a random identifier and SHA-256, and clean verdicts require matching bytes before and after a successful custom scan. The app does not execute uploaded files. Scan subprocesses have a 60-second limit and the ingestion client times out after 75 seconds. Input and result files are removed after completion; interrupted runs may leave local orphan files requiring reviewed cleanup.

Defender's `-DisableRemediation` flag applies only to the requested custom scan and does not disable real-time protection. If Windows itself blocks access with its virus-infected/deleted error, the job is rejected. Other scanner errors remain failed and never become clean. Keep the operating system's antivirus definitions current; this build does not manage or weaken Defender settings.

```sh
npm run scanner:health
npm run test:scanner
```

The real integration test uses the standard harmless EICAR test string, which can create an expected entry in Windows Security. It also uploads a generated PDF/photo, checks revision approval and public downloads, verifies withdrawal, and leaves a freshly approved, clearly labelled demo. A separate invalid-type upload tests the application's rejection gate. This is not malware-efficacy testing. Avoid running it concurrently with `files:watch`, and allow a minute between repeats to respect login rate limits.

For ClamAV instead, set `POLARBRIDGE_SCANNER=clamav`, `CLAMD_HOST=127.0.0.1` and `CLAMD_PORT=3310`. The optional portable Windows setup is:

```sh
npm run scanner:setup
npm run scanner:update
npm run scanner:start
```

The setup downloads ClamAV 1.4.6 LTS from Cisco Talos's official GitHub release, verifies its release SHA-256, and writes a loopback-only configuration that rejects encrypted/over-limit content and refuses signature databases older than seven days. The full download and live ClamAV service were not completed on this machine because of download timeouts. The active demo uses Defender, not a simulated ClamAV service.
