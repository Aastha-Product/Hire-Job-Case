import type { PersonalDetails } from "./types";

// Deterministic PII handling. No AI call is involved: the name comes from the
// upload form, email and phone come from regexes, and everything that looks like
// them is removed from the text before any AI step sees it.

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// Digit runs with separators; kept only if they hold 10+ digits (phones, not years or money).
const PHONE_RE = /\+?\(?\d[\d\s().-]{8,}\d/g;
const PROFILE_URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?(?:linkedin\.com|github\.com|gitlab\.com|leetcode\.com|behance\.net|dribbble\.com|medium\.com|twitter\.com|x\.com|instagram\.com|facebook\.com)\/[^\s|·•,;)]*/gi;
const PROFILE_LABEL_RE = /\b(linkedin|github|leetcode|portfolio)\s*:\/*\s*\S+/gi;

const digitCount = (s: string) => (s.match(/\d/g) ?? []).length;

// Words people put in CV filenames that are not part of their name.
const FILENAME_NOISE = /^(resume|résumé|cv|curriculum|vitae|final|updated|latest|new|copy|draft|profile|pm|spm|apm|v\d*)$/i;

/** "01_rohan_mehta.pdf" / "spm_16_siddharth_rao.pdf" / "Aastha_Pandey_Resume (1).ppt" -> "Rohan Mehta" */
export function nameFromFilename(filename: string): string {
  return filename
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\(\d+\)|\[\d+\]/g, " ")
    .split(/[_\s.-]+/)
    .filter((w) => w && !/\d/.test(w) && !FILENAME_NOISE.test(w))
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

// Indian mobile, used when a PDF renders the number twice into one digit run.
const IN_MOBILE_RE = /(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/;

export function extractContacts(
  text: string,
  name = "",
): { email: string | null; phone: string | null } {
  let email = text.match(EMAIL_RE)?.[0] ?? null;
  // Garbled headers glue the uppercase surname onto the address: "REDDYsquad_5@..."
  const caps = email?.match(/^([A-Z]{2,})(?=[a-z0-9_])/)?.[1];
  if (email && caps && name.toLowerCase().split(/[^a-z]+/).includes(caps.toLowerCase())) {
    email = email.slice(caps.length);
  }
  const phoneRaw =
    (text.match(PHONE_RE) ?? []).find((m) => {
      const d = digitCount(m);
      return d >= 10 && d <= 13;
    }) ?? text.match(IN_MOBILE_RE)?.[0];
  return { email, phone: phoneRaw ? phoneRaw.trim() : null };
}

function isSubsequence(needle: string, hay: string): boolean {
  let i = 0;
  for (const ch of hay) if (ch === needle[i]) i++;
  return i === needle.length;
}

/**
 * True when a token is the candidate's name, a handle built from it
 * ("priyakrishnan-pm"), or a garbled PDF rendering of it ("RoOhHaAnN").
 */
function isNameToken(token: string, parts: string[], nameLetters: Set<string>): boolean {
  const t = token.toLowerCase();
  const letters = t.replace(/[^a-z]/g, "");
  if (!letters) return false;
  for (const p of parts) {
    if (letters === p) return true;
    if (p.length >= 4 && t.includes(p)) return true;
  }
  if (letters.length >= 4 && [...letters].every((c) => nameLetters.has(c))) {
    return parts.some((p) => p.length >= 4 && isSubsequence(p, letters));
  }
  return false;
}

export function redact(text: string, name: string): string {
  let out = text
    .replace(PROFILE_URL_RE, "[LINK]")
    .replace(PROFILE_LABEL_RE, "[LINK]")
    .replace(EMAIL_RE, "[EMAIL]")
    .replace(PHONE_RE, (m) => (digitCount(m) >= 10 ? "[PHONE]" : m));

  const parts = name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((p) => p.length >= 2);
  if (!parts.length) return out;

  const full = parts.join("\\W+");
  out = out.replace(new RegExp(`\\b${full}\\b`, "gi"), "[CANDIDATE]");

  const nameLetters = new Set(parts.join(""));
  out = out.replace(/[^\s|·•,;:()[\]]+/g, (tok) =>
    tok.startsWith("[") || !isNameToken(tok, parts, nameLetters) ? tok : "[CANDIDATE]",
  );
  return out.replace(/(\[CANDIDATE\]\s*){2,}/g, "[CANDIDATE] ");
}

/** Split an uploaded CV into private personal details and AI-safe content. */
export function splitPersonalDetails(
  text: string,
  name: string,
): { personal: PersonalDetails; content: string } {
  const { email, phone } = extractContacts(text, name);
  return { personal: { name, email, phone }, content: redact(text, name) };
}

/** Returns any PII still present in redacted content (used by the offline check). */
export function findLeaks(content: string, personal: PersonalDetails): string[] {
  const leaks: string[] = [];
  const lower = content.toLowerCase();
  if (personal.email && lower.includes(personal.email.toLowerCase())) leaks.push(`email ${personal.email}`);
  if (EMAIL_RE.test(content)) leaks.push("an email address");
  EMAIL_RE.lastIndex = 0;
  for (const m of content.match(PHONE_RE) ?? []) if (digitCount(m) >= 10) leaks.push(`phone-like ${m.trim()}`);
  for (const p of personal.name.toLowerCase().split(/[^a-z]+/).filter((p) => p.length >= 3)) {
    if (new RegExp(`\\b${p}\\b`, "i").test(content)) leaks.push(`name part "${p}"`);
  }
  return leaks;
}
