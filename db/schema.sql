-- Kargo hiring dashboard schema for Neon Postgres.
-- Everything lives in its own schema so it never collides with other apps in the same database.

create schema if not exists kargo_hiring;

-- The rubric text (rubric.txt from the Cowork research) is the source of truth.
-- The app parses weights and decision bands from it and sends it verbatim to the scoring model.
create table if not exists kargo_hiring.rubric_config (
  id          int primary key default 1 check (id = 1),
  raw_text    text not null,
  rules       jsonb not null,          -- parsed decision bands + expected experience
  version     text not null,
  updated_at  timestamptz not null default now()
);

-- One row per criterion per role, derived from rubric_config.raw_text.
create table if not exists kargo_hiring.rubric_criteria (
  id             uuid primary key default gen_random_uuid(),
  role           text not null check (role in ('PM', 'SPM')),
  position       int  not null,
  code           text not null,        -- C1..C5
  name           text not null,
  description    text not null,        -- anchors, keyword bank, guardrail
  weight         double precision not null check (weight > 0 and weight <= 100),
  rubric_version text,
  created_at     timestamptz not null default now(),
  unique (role, code)
);

create table if not exists kargo_hiring.candidates (
  id                uuid primary key default gen_random_uuid(),
  applied_role      text not null check (applied_role in ('PM', 'SPM')),
  routed_role       text check (routed_role in ('PM', 'SPM')),
  band              text check (band in ('shortlist', 'borderline', 'below')),
  source_filename   text,

  -- PII lives only here. Never sent to any AI step.
  personal_details  jsonb not null default '{}'::jsonb,   -- {name, email, phone}
  -- Redacted CV text. The only CV content Gemini ever sees.
  cv_content        text not null,

  status            text not null default 'uploaded' check (status in ('uploaded', 'scored', 'error')),
  error             text,

  score_json        jsonb,            -- per-criterion 0/1/2 + evidence for PM and SPM, routing, flags
  pm_score          double precision,         -- PM Fit Index 0-100
  spm_score         double precision,         -- SPM Fit Index 0-100
  rubric_version    text,

  brief             text,
  decision_override text check (decision_override in ('invite', 'reject')),

  email_type        text check (email_type in ('invite', 'reject')),
  email_subject     text,
  email_body        text,             -- uses [NAME] placeholder until send
  email_status      text not null default 'none' check (email_status in ('none', 'draft', 'self', 'sent', 'failed')),
  delivery          text check (delivery in ('resend', 'self', 'manual')),  -- how it went out: Resend to candidate, draft to Arjun's inbox, or sent by hand
  email_error       text,
  sent_to           text,
  sent_at           timestamptz,
  resend_id         text,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists candidates_routed on kargo_hiring.candidates (routed_role, band);

create or replace function kargo_hiring.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists candidates_updated_at on kargo_hiring.candidates;
create trigger candidates_updated_at before update on kargo_hiring.candidates
  for each row execute function kargo_hiring.set_updated_at();
