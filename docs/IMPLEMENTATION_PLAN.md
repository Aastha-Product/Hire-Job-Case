# Kargo Hiring Dashboard — Implementation Plan

Case 2 · Arjun / Kargo · MESA AI and its Applications, Cohort C4

## Goal

Arjun gets a ranked shortlist per role (PM, SPM) with enough reasoning per candidate to make a call in under
10 minutes. The system ranks, explains and drafts. Arjun decides and confirms every send. Nothing leaves the
system without his click.

Success = first offer within 2 weeks (baseline: 0 offers in 11 weeks, 19 of 60 CVs opened).

## The Cut (from the Nine Checks)

Arjun asked for emails to go out to selected **and rejected** candidates automatically. Checks 06 (failure
risk) and 09 (owner clear) stop the auto-reject: a wrongly rejected candidate never comes back and no named
person owns a system rejection. So:

| Automated | Stays human |
|---|---|
| Text extraction, PII split, rubric scoring (both roles), banding, routing, ranking, interview brief, email drafting | Reviewing the ranked list, every Borderline call, moving anyone across the line, editing a draft, clicking **Send** on each email, the hiring call |

## The rubric (final, from the Cowork research)

`rubric.txt` (reference and reasoning: `docs/Kargo_Hiring_Rubric_FINAL.md`). Five criteria, each scored
**0 / 1 / 2**, `points = score/2 × weight`, and the Fit Index is their sum (0–100).

| | C1 Ops grounding | C2 Ship-and-kill | C3 Ownership under pressure | C4 Independence | C5 Ground discovery |
|---|---|---|---|---|---|
| PM | 35% | 25% | 20% | 10% | 10% |
| SPM | 30% | 20% | 20% | 25% | 5% |

| Band | PM | SPM | Draft |
|---|---|---|---|
| Shortlist | Fit ≥ 70, C1 ≥ 1, ≤ 1 criterion at 0 | Fit ≥ 75, C1 ≥ 1, C4 ≥ 1 | Brief + interview invite |
| Borderline | everything between | everything between | Brief only. Arjun picks Invite or Reject |
| Below the line | Fit < 55 | Fit < 60 | Warm rejection (Arjun confirms) |

Routing: SPM if the SPM shortlist bar is cleared, else PM if the PM bar is cleared, else the applied role.

Integrity rules enforced in code, not left to the model:
- **Evidence-or-zero:** a score above 0 with no quoted bullet is forced to 0.
- **Quote check:** quotes are checked against the CV, and a paraphrase is flagged `evidence_not_verbatim`.
- **Decided by code:** weights, Fit Index, bands, routing and gate flags (`generalist_C1_zero`, `not_independent_for_SPM`, `experience_band_mismatch`).

Finding worth defending: the "Fit ≥ 70 with C1 = 0" borderline rule can never fire. Without C1, the PM
maximum is 65 and the SPM maximum is 70. Those candidates land in Borderline anyway, so the outcome is right.

## Final Components Map

| Stage | Actor | Component |
|---|---|---|
| Trigger | Founder | Uploads one or many CVs and selects the applied role (PM / SPM) |
| Input | Founder | CV file (PDF / DOCX / TXT) + role + candidate name (prefilled from filename, editable). The name comes from the form because PDF text layers garble names |
| Context | System | Rubric from `rubric.txt` (Cowork research on the 8 hire profiles, not the JD), stored in `rubric_config` + `rubric_criteria` |
| Context | System | Deterministic PII split: email + phone by regex, name from the form, fuzzy redaction of name variants and profile links. `personal_details` stored privately, `cv_content` redacted. No AI touches PII |
| AI | Gemini Flash | Scores the redacted CV against **both** rubrics: 0/1/2 per criterion, quoted evidence, reason, missing info, confidence, claims to verify, unsupported keywords. JSON schema, temperature 0 |
| Processing | System | Evidence-or-zero, points, Fit Index, bands, routing and flags, all computed deterministically. Rank by band, then by Fit Index, within the routed role |
| AI | Gemini Flash | Shortlist: 3-sentence brief (who / why this band / Probe) + invite. Borderline: brief only. Below: warm rejection. Uses a `[NAME]` placeholder |
| Output | Founder | Dashboard: bands, per-criterion evidence, brief, editable draft with the real name, Invite / Reject override, **Send** |
| Human gate | Founder | Arjun decides each Borderline candidate and clicks Send per email. No bulk send, no auto-reject |
| Delivery | Resend | Sends the approved email only. Recipient domain allow-list; `sent_to`, `sent_at`, `resend_id` written back |
| Storage | Neon Postgres | `kargo_hiring` schema: `candidates`, `rubric_config`, `rubric_criteria`. Server-only connection string |

## Stack

Claude Cowork (rubric research) · Claude Code (build) · Next.js 16 + TypeScript · Gemini Flash
(`@google/genai`, model via `GEMINI_MODEL`) · Neon Postgres · Resend · Vercel · GitHub (repo = `kargo-hiring/`
only, so the CVs stay outside it).

## Pipeline (client-driven, so no request outlives the serverless timeout)

1. `POST /api/candidates`: one file per request. Parse → PII split → insert → score + band + route.
2. `POST /api/reconcile`: list the briefs/drafts that are missing or stale for the current bands and overrides.
3. `POST /api/candidates/:id/generate`: brief + invite, brief only, or rejection for one candidate.
4. `POST /api/candidates/:id/send`: substitute the real name, send via Resend, mark as sent. Refuses a second send.
5. `PATCH /api/candidates/:id`: Invite / Reject override, name/email fix, draft edits.
6. `GET/PUT /api/rubric`: view, validate (dry run) or replace the rubric. `POST /api/candidates/:id/rescore` re-scores.

## Privacy and safety

- PII never enters Gemini, verified offline on all 60 CVs + 8 hire profiles (`npm run test:extraction`: 0 leaks).
- Use a billed Gemini key for real candidate data (the free tier may use inputs for training).
- The Neon connection string is server-only, and `.env.local` is gitignored (and excluded from Vercel uploads).
- No sign-in by design: a single-user tool for Arjun, so keep the URL private. Sends are still limited to the allowed test domain.
- `ALLOWED_RECIPIENT_DOMAIN` (default `pg27.mesaschool.co`) blocks real external addresses; `EMAIL_OVERRIDE_TO` routes all sends to one inbox.
- The CV text is treated as untrusted in every prompt (injection guard).

## Build order and status

| # | Step | Done when | Status |
|---|---|---|---|
| 1 | Rubric research → `rubric.txt` | 4–6 criteria per role, weights = 100, traced to hire profiles | Done (Cowork) |
| 2 | Scaffold, schema, rubric seeding | `rubric_criteria` has 10 rows | Done: Neon, 10 rows |
| 3 | Parse + PII split + redaction | 0 PII in `cv_content` | Done, tested on 68 files |
| 4 | Scoring, bands, routing | Worked examples reproduce (90 / 45 / 100) | Done, `npm run test:scoring` |
| 5 | Briefs + drafts + reconcile | Shortlist has brief + invite, Borderline has brief, Below has rejection | Done: all 60 scored and drafted |
| 6 | Resend send + status | Confirm → inbox within 30 s, real name shown | Built. Needs Resend key |
| 7 | Deploy to Vercel, end-to-end test | Upload → send in under 5 min | Live at kargo-hiring-theta.vercel.app; upload → draft verified. Send waits on Resend |
