export type Role = "PM" | "SPM";
export const ROLES: Role[] = ["PM", "SPM"];
export const ROLE_TITLE: Record<Role, string> = {
  PM: "Product Manager",
  SPM: "Senior Product Manager",
};

export type Band = "shortlist" | "borderline" | "below";
export type EmailType = "invite" | "reject";
export type Decision = EmailType | "hold";
export type EmailStatus = "none" | "draft" | "sent" | "failed";
export type Confidence = "high" | "medium" | "low";

export interface Criterion {
  id?: string;
  role: Role;
  position: number;
  code: string; // "C1"
  name: string;
  description: string; // anchors, keyword bank and guardrail as written in rubric.txt
  weight: number;
}

/** Band thresholds for one role, parsed from the rubric's DECISION BANDS block. */
export interface BandRules {
  shortlistMin: number; // Fit Index >= this ...
  require: Record<string, number>; // ... AND C1 >= 1, C4 >= 1
  maxZero: number | null; // ... AND no more than N criteria at 0
  belowUnder: number; // Fit Index < this -> below the line
}

export interface RubricRules {
  bands: Record<Role, BandRules>;
  experience: Record<Role, [number, number]>; // expected years, flag only
}

export interface Rubric {
  text: string; // the full rubric.txt, sent verbatim to the scoring model
  criteria: Record<Role, Criterion[]>;
  rules: RubricRules;
}

export interface CriterionScore {
  code: string;
  name: string;
  weight: number;
  score: 0 | 1 | 2;
  points: number;
  evidence: string; // quoted experience bullet
  evidence_verified: boolean; // quote found verbatim in the CV
  reason: string;
  missing: string | null;
}

export interface RoleScore {
  total: number; // Fit Index 0-100
  band: Band;
  flags: string[];
  criteria: CriterionScore[];
}

export interface ScoreJson {
  PM: RoleScore;
  SPM: RoleScore;
  routed_role: Role;
  confidence: Confidence;
  years_experience: number | null;
  metrics_to_verify: string[];
  unsupported_keywords: string[];
  flags: string[];
}

export interface PersonalDetails {
  name: string;
  email: string | null;
  phone: string | null;
}

export interface Candidate {
  id: string;
  applied_role: Role;
  routed_role: Role | null;
  band: Band | null;
  source_filename: string | null;
  personal_details: PersonalDetails;
  cv_content: string;
  status: "uploaded" | "scored" | "error";
  error: string | null;
  score_json: ScoreJson | null;
  pm_score: number | null;
  spm_score: number | null;
  rubric_version: string | null;
  brief: string | null;
  decision_override: EmailType | null;
  email_type: EmailType | null;
  email_subject: string | null;
  email_body: string | null;
  email_status: EmailStatus;
  email_error: string | null;
  sent_to: string | null;
  sent_at: string | null;
  resend_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A candidate as placed in its routed role's ranking. */
export interface RankedCandidate extends Candidate {
  rank: number;
  score: number;
  other_score: number | null;
  system_decision: Decision;
  decision: Decision;
}
