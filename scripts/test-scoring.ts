// Deterministic checks for the scoring maths, bands, routing and evidence rules,
// using the worked examples in docs/Kargo_Hiring_Rubric_FINAL.md §5.
import { readFileSync } from "node:fs";
import { parseRubric } from "../src/lib/rubric";
import { computeScores, type RawScores } from "../src/lib/scoring";

const { rubric } = parseRubric(readFileSync("rubric.txt", "utf8"));
const cv = "Sole PM responsible for shipment tracking, exception management, and carrier integration modules";
const ev = "Sole PM responsible for shipment tracking, exception management";

function raw(pm: number[], spm: number[], extra: Partial<RawScores> = {}): RawScores {
  const mk = (s: number[]) => s.map((score, i) => ({ code: `C${i + 1}`, score, evidence: score ? ev : "", reason: "r" }));
  return { PM: mk(pm), SPM: mk(spm), confidence: "high", metrics_to_verify: [], unsupported_keywords: [], ...extra };
}

let failed = 0;
function expect(label: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (want ${JSON.stringify(want)})`}`);
}

// Priya Krishnan: C1=2 C2=2 C3=1 C4=2 C5=2 -> 90, PM shortlist.
let s = computeScores(rubric, raw([2, 2, 1, 2, 2], [2, 1, 1, 1, 2]), cv, "PM");
expect("Priya PM index", s.PM.total, 90);
expect("Priya PM band", s.PM.band, "shortlist");

// Vikram-type: C1=0 C2=2 C3=1 C4=1 C5=1 -> 45, below the line.
s = computeScores(rubric, raw([0, 2, 1, 1, 1], [0, 1, 1, 1, 1]), cv, "PM");
expect("Vikram PM index", s.PM.total, 45);
expect("Vikram PM band", s.PM.band, "below");

// Siddharth Rao (SPM order C1..C5): 2,2,2,2,2 -> 100, SPM shortlist, routed SPM.
s = computeScores(rubric, raw([2, 2, 2, 2, 2], [2, 2, 2, 2, 2]), cv, "SPM");
expect("Siddharth SPM index", s.SPM.total, 100);
expect("Siddharth routed", s.routed_role, "SPM");

// Strong generalist with C1=0 but index >= 70 -> borderline + flag.
s = computeScores(rubric, raw([0, 2, 2, 2, 2], [0, 2, 2, 2, 2]), cv, "PM");
expect("Generalist PM index", s.PM.total, 65);
s = computeScores(rubric, raw([0, 2, 2, 2, 2], [0, 2, 2, 2, 2]), cv, "PM");
expect("Generalist PM band (65 -> borderline)", s.PM.band, "borderline");

// SPM >= 75 but C4 = 0 -> borderline, not_independent_for_SPM.
s = computeScores(rubric, raw([2, 2, 2, 0, 2], [2, 2, 2, 0, 2]), cv, "SPM");
expect("SPM no-independence index", s.SPM.total, 75);
expect("SPM no-independence band", s.SPM.band, "borderline");
expect("SPM no-independence flag", s.SPM.flags, ["not_independent_for_SPM"]);

// PM applicant who clears the SPM bar is routed to SPM.
s = computeScores(rubric, raw([2, 2, 2, 2, 2], [2, 2, 2, 2, 1]), cv, "PM");
expect("PM->SPM routing", [s.routed_role, s.flags.includes("routed_PM_to_SPM")], ["SPM", true]);

// Evidence-or-zero: score 2 with no quote becomes 0.
const r = raw([2, 2, 2, 2, 2], [2, 2, 2, 2, 2]);
r.PM[0].evidence = "";
s = computeScores(rubric, r, cv, "PM");
expect("No quote -> 0", s.PM.criteria[0].score, 0);

// Paraphrased quote is kept but flagged.
const p = raw([2, 0, 0, 0, 0], [0, 0, 0, 0, 0]);
p.PM[0].evidence = "Managed the entire freight booking desk for a large forwarder";
s = computeScores(rubric, p, cv, "PM");
expect("Paraphrase flagged", [s.PM.criteria[0].evidence_verified, s.flags.includes("evidence_not_verbatim")], [false, true]);

// Experience band flag.
s = computeScores(rubric, raw([2, 2, 1, 2, 2], [0, 0, 0, 0, 0], { years_experience: 12 }), cv, "PM");
expect("12 yrs PM -> mismatch flag", s.flags.includes("experience_band_mismatch"), true);

console.log(failed ? `\n${failed} failed` : "\nall scoring checks passed");
process.exit(failed ? 1 : 0);
