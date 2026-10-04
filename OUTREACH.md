# Outreach Studio

Open `/workspace/studio` and sign in through `/workspace`. Contributors choose up to three current published report, dataset or publication revisions. They can write a student explainer, website news item or social caption in English or Hindi, attach evidence to every passage, and save an immutable draft. A separate reviewer must check all claims (including the title), evidence and terminology. A publisher releases the exact approved revision. Reviewed Markdown exports are available only while the release and its sources remain eligible.

This milestone uses **approved catalogue summary/body text**, bounded to six body passages of up to 1,800 characters plus the summary per source. It does not fetch external URLs or extract PDF contents. Each evidence identifier includes its immutable source revision. Citation checks establish existence, not scientific entailment; human review remains necessary. English/Hindi are independent outputs; linked bilingual editions and translation-quality evaluations are not implemented.

## Optional OpenAI connection

Manual drafting needs no AI service or payment. Set these server-only environment variables to enable generation:

```
POLARBRIDGE_AI_ENABLED=1
OPENAI_API_KEY=<configure privately in .env.local or Vercel>
OPENAI_MODEL=<a model available to your account that supports structured outputs>
```

Never expose keys with a `NEXT_PUBLIC_` prefix. A publisher must explicitly clear each public source revision for OpenAI processing in the evidence panel. Clearance is revision-specific and is not inferred from a public URL. Review actual rights/provider policy before clearing institutional material. No source text is sent until a contributor selects cleared sources and requests generation.

The adapter calls the fixed OpenAI Responses endpoint with no tools, `store:false`, a strict JSON schema, 40-second timeout and a 2,400 output-token cap. Source text is data, not instructions. Incomplete output, refusal, malformed citations and insufficient evidence cannot become saved drafts automatically. No provider credential means a clear unavailable state; no synthetic AI success fallback exists.

There are conservative rolling 24-hour request caps: 20 per staff account and 100 globally, including failures; one active request per account. These are request/token bounds, not a currency budget. Configure provider-level spend limits separately. Generation run metadata retains model, prompt version, source IDs and token counts; application logs exclude prompts and credentials. A crashed run stops blocking a new request after two minutes. Generation is a bounded synchronous server request in this milestone, not a durable job queue.

API contract checked against [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs). Account access, billing and live model quality have not been verified. Creating/configuring an API key is not evidence of free generation; consult [official pricing](https://developers.openai.com/api/docs/pricing).

## Evidence and release

Apply `npm run db:migrate` before starting the new build. Migration 003 adds outreach revisions, immutable lineage, history, generation metadata and source clearance. Replacing or withdrawing a published catalogue source invalidates dependent outreach reviews and withdraws published output in the same transaction. Public page and export reads independently recheck source eligibility. A replacement source requires a new output revision and fresh review. Existing downloaded copies cannot be revoked; exports include the live URL and timestamp for checking before reuse.

Outreach is available at `/outreach` and `/outreach/[id]`. Only published stories appear publicly. No automatic social platform posting is implemented. Contributors see their own drafts; reviewers/publishers see the shared outreach review queue. The studio is linked from the editorial workspace.

## Verification

`npm run test:backend` covers source lineage, independent approval, stale revisions, immutable content, owner isolation, export restrictions, source replacement/withdrawal, per-source AI clearance and explicit mocked-provider contract failures. Twenty mocked failure cases are **not** the planned 20-prompt live model evaluation. That evaluation and translation quality review remain pending a configured provider.

With the local scanner demonstration already published, run `node --env-file=.env.local tests/http-outreach.mjs` for a live HTTP workflow. It leaves a clearly labelled manually authored English demonstration published and a Hindi demonstration draft for review. No paid AI calls are made by this test.

Vercel uses the Node runtime; the generation route declares a 60-second maximum duration. Verify the selected hosting plan supports it. Hosted PostgreSQL, storage, antivirus worker and deployment remain separate configuration work.


## Gemini option — 1 October 2026

Gemini is supported alongside OpenAI. Local settings are prepared with:

```
POLARBRIDGE_AI_PROVIDER=gemini
POLARBRIDGE_AI_ENABLED=1
GEMINI_MODEL=gemini-3.8-flash
GEMINI_API_KEY=<add your key privately>
```

Restart the app after changing environment settings. Vercel needs the same server-side variables and a new deployment. Selecting Gemini never reuses an OpenAI source clearance: a publisher must clear each revision for Google Gemini separately. The source clearance panel names the selected provider. Migration 004 preserves existing approvals as OpenAI-only and records the provider on new generation runs.

Gemini uses the fixed Google generateContent endpoint, the API key in a header, structured JSON, no tools, a bounded timeout and output cap. The same citation validation and human review gates apply. Quota exhaustion shows a retry-later message without automatic retries or a paid-provider fallback. Free-tier eligibility and billing are properties of your Google project; the app cannot determine them from a key. Google lists free-tier content as eligible for product improvement, so use only cleared public/demo text.

Implementation reference: [Google generateContent API](https://ai.google.dev/api/generate-content). Isolated tests cover Gemini success parsing, quota exhaustion, blocked/truncated/malformed output, provider metadata and provider-specific clearance. These use mocked responses; a live key/model request remains unverified until privately configured.

Gemini generation now sets `thinkingConfig.thinkingLevel=low` to reduce reasoning latency. A small live response succeeded; full drafting remains unreliable due to provider errors. The timeout remains bounded for hosting compatibility.
