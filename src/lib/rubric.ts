import { createHash } from "node:crypto";
import type { BandRules, Criterion, Role, Rubric, RubricRules } from "./types";

// Parses the Kargo rubric.txt format:
//   PRODUCT MANAGER (...) / SENIOR PRODUCT MANAGER (...)   role sections
//   C1. FREIGHT / LOGISTICS OPERATIONAL GROUNDING  -  35%  criterion + weight
//     Strong (2): ... / Moderate (1): ... / Recognise: ...   description lines
//   PM DECISION BANDS:  Shortlist ...: Fit Index >= 70 AND C1 >= 1 AND no more than one criterion at 0.
//                       Borderline ...  /  Below the line ...: index < 55.
//   EXPERIENCE SANITY ...: SPM ~5-8 yrs, PM ~2-4 yrs.

const CRITERION_RE = /^\s*(C\d+)\s*[.):]\s*(.+?)\s*[-–—]+\s*(\d+(?:\.\d+)?)\s*%/i;
const WORDS: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5 };

function titleCase(s: string): string {
  if (s !== s.toUpperCase()) return s.trim();
  return s
    .toLowerCase()
    .replace(/(^|[\s/])([a-z])/g, (m) => m.toUpperCase())
    .replace(/(?<=\s)(And|Or|Of|With|A|The|Vs)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (m) => m.toUpperCase())
    .trim();
}

function sectionRole(line: string): Role | null {
  const t = line.trim();
  if (/^senior product manager\b/i.test(t)) return "SPM";
  if (/^product manager\b/i.test(t)) return "PM";
  return null;
}

function parseBands(lines: string[]): { rules: Partial<BandRules>; errors: string[] } {
  const rules: Partial<BandRules> = { require: {}, maxZero: null };
  const errors: string[] = [];
  for (const line of lines) {
    const rule = line.slice(line.indexOf(":") + 1);
    if (/^\s*shortlist/i.test(line)) {
      const min = rule.match(/(?:fit\s*)?index\s*>=?\s*(\d+)/i);
      if (min) rules.shortlistMin = Number(min[1]);
      for (const m of rule.matchAll(/\b(C\d+)\s*>=\s*(\d)/gi)) rules.require![m[1].toUpperCase()] = Number(m[2]);
      const z = rule.match(/no more than\s+(\w+)\s+criteri(?:on|a)\s+at\s+0/i);
      if (z) rules.maxZero = WORDS[z[1].toLowerCase()] ?? Number(z[1]);
    } else if (/^\s*below/i.test(line)) {
      const under = rule.match(/index\s*<\s*(\d+)/i);
      if (under) rules.belowUnder = Number(under[1]);
    }
  }
  if (rules.shortlistMin == null) errors.push("shortlist threshold (Fit Index >= N) not found");
  if (rules.belowUnder == null) errors.push("below-the-line threshold (index < N) not found");
  return { rules, errors };
}

export interface ParseResult {
  rubric: Rubric;
  errors: string[];
}

export function parseRubric(text: string): ParseResult {
  const criteria: Record<Role, Criterion[]> = { PM: [], SPM: [] };
  const bandLines: Record<Role, string[]> = { PM: [], SPM: [] };
  const errors: string[] = [];
  let role: Role | null = null;
  let current: Criterion | null = null;
  let inBands: Role | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^=+$/.test(line)) continue;

    const r = sectionRole(line);
    if (r) {
      role = r;
      current = null;
      inBands = null;
      continue;
    }
    const bands = line.match(/^(S?PM)\s+DECISION BANDS/i);
    if (bands) {
      inBands = bands[1].toUpperCase() as Role;
      current = null;
      continue;
    }
    if (/^(ROLE ROUTING|EXPERIENCE SANITY)\b/i.test(line)) {
      inBands = null;
      current = null;
      continue;
    }
    if (inBands) {
      bandLines[inBands].push(line);
      continue;
    }
    const c = line.match(CRITERION_RE);
    if (c && role) {
      current = {
        role,
        position: criteria[role].length + 1,
        code: c[1].toUpperCase(),
        name: titleCase(c[2]),
        weight: Number(c[3]),
        description: "",
      };
      criteria[role].push(current);
      continue;
    }
    if (current) current.description = current.description ? `${current.description}\n${line}` : line;
  }

  const bands = {} as RubricRules["bands"];
  for (const r of ["PM", "SPM"] as Role[]) {
    const list = criteria[r];
    if (list.length < 4 || list.length > 6) errors.push(`${r}: needs 4–6 criteria, found ${list.length}`);
    const sum = list.reduce((s, c) => s + c.weight, 0);
    if (list.length && Math.abs(sum - 100) > 0.5) errors.push(`${r}: weights add up to ${sum}%, not 100%`);
    for (const c of list) if (!c.description) errors.push(`${r} ${c.code}: no anchors under the criterion line`);

    const parsed = parseBands(bandLines[r]);
    errors.push(...parsed.errors.map((e) => `${r} decision bands: ${e}`));
    for (const code of Object.keys(parsed.rules.require ?? {})) {
      if (!list.some((c) => c.code === code)) errors.push(`${r} decision bands reference unknown ${code}`);
    }
    bands[r] = {
      shortlistMin: parsed.rules.shortlistMin ?? 70,
      require: parsed.rules.require ?? {},
      maxZero: parsed.rules.maxZero ?? null,
      belowUnder: parsed.rules.belowUnder ?? 55,
    };
  }

  const exp = (r: Role, fallback: [number, number]): [number, number] => {
    const m = text.match(new RegExp(`\\b${r}\\s*~?\\s*(\\d+)\\s*[-–]\\s*(\\d+)\\s*yrs`, "i"));
    return m ? [Number(m[1]), Number(m[2])] : fallback;
  };

  return {
    rubric: { text, criteria, rules: { bands, experience: { PM: exp("PM", [2, 4]), SPM: exp("SPM", [5, 8]) } } },
    errors,
  };
}

/** Short stable hash so the dashboard can flag candidates scored with an older rubric. */
export function rubricVersion(rubric: Pick<Rubric, "text">): string {
  return createHash("sha256").update(rubric.text.replace(/\r\n/g, "\n").trim()).digest("hex").slice(0, 10);
}
