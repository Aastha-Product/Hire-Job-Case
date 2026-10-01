# Kargo Hiring Dashboard

Internal tool for Arjun (founder, Kargo). Upload CVs → PII split off → scored against the PM and SPM rubric
(`rubric.txt`) → banded, routed and ranked → brief and email drafts → Arjun reviews and clicks **Send**.
The system recommends. Arjun decides.

Plan and final components map: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).
Rubric reasoning: [docs/Kargo_Hiring_Rubric_FINAL.md](docs/Kargo_Hiring_Rubric_FINAL.md).

## Setup

1. **Neon:** the tables live in their own `kargo_hiring` schema ([`db/schema.sql`](db/schema.sql)), so they
   never collide with other apps in the same database. `npm run seed:rubric` creates them if they are missing.
2. **Keys:** copy `.env.example` to `.env.local` and fill in:
   - `DATABASE_URL`: Neon console → project → Connect (pooled connection string). Server-only.
   - `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-3.8-flash`).
   - Leave `RESEND_API_KEY` blank until checkpoint B-2.
3. **Install, load the rubric, and run:**
   ```bash
   npm install
   npm run seed:rubric
   npm run dev
   ```
   After seeding, `kargo_hiring.rubric_criteria` has 10 rows (5 per role).

## Live deployment

- URL: https://kargo-hiring-theta.vercel.app (Vercel project `kargo-hiring`)
- Database: Neon project "Hire Case", schema `kargo_hiring`
- Redeploy after changes, from this folder:
  ```bash
  npx vercel deploy --prod
  ```
- Environment variables are set in Vercel (production): `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`,
  `RESEND_FROM`, `ALLOWED_RECIPIENT_DOMAIN`. Add `RESEND_API_KEY` at B-2:
  ```bash
  npx vercel env add RESEND_API_KEY production
  ```

## Checks that need no keys

```bash
npm run check:rubric      # parse + validate rubric.txt (weights, bands)
npm run test:scoring      # Fit Index, bands, routing, evidence-or-zero vs the worked examples
npm run test:extraction   # parse every CV in ../resumes and ../hires, assert no PII reaches the AI text
```

## Using it

- **Upload CVs:** pick the applied role (files named `pm_…`/`spm_…` pick it automatically) and check the
  names, then click Process. Each CV is scored, then briefs and drafts are generated. Progress shows per file.
- **Dashboard:** PM / SPM tabs, grouped into Shortlist → Borderline → Below the line. Click a row for the
  per-criterion evidence, the brief, the draft and the buttons. Candidates appear under the role the rubric
  routed them to.
- **Borderline** candidates get a brief but no email. Pick Invite or Reject and the draft is written then.
- **Send** asks for confirmation, sends via Resend and records `sent_to` / `sent_at` / `resend_id`.
  A sent email cannot be sent twice.
- **Rubric:** view the live rubric, paste a re-tuned version, validate, save, then re-score everyone.

## Email safety

- `ALLOWED_RECIPIENT_DOMAIN` (default `pg27.mesaschool.co`): sends to any other domain are refused.
- `EMAIL_OVERRIDE_TO`: route every email to one inbox while testing.
- With Resend's default `onboarding@resend.dev` sender, Resend only delivers to the address you signed up
  with. To reach the MESA test addresses, verify a domain in Resend and set `RESEND_FROM`, or set
  `EMAIL_OVERRIDE_TO` to your Resend account email.

## Deploy from scratch (Vercel)

1. Push this folder (`kargo-hiring/`) to GitHub. `.env.local`, PDFs and DOCX files are gitignored, so
   candidate CVs never go into the repo.
2. Import it in Vercel and add the same environment variables. The app has no sign-in (single user, Arjun):
   keep the URL private, since the dashboard shows candidate details. Sends are limited to `ALLOWED_RECIPIENT_DOMAIN`.
3. Deploy. At checkpoint B-2, add `RESEND_API_KEY` and redeploy.

## Privacy notes (DPDP)

- The name comes from the upload form, and email/phone come from regexes. Everything resembling them
  (including garbled PDF renderings and profile links) is redacted before any AI call. Gemini sees only
  `cv_content`. Identity stays in `personal_details` in Neon.
- Use a Gemini key with billing enabled for real applicants: the AI Studio free tier may use inputs to
  improve Google's models, and the billed API does not.
