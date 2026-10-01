import "server-only";
import { getCandidate, getRubric, listCandidates, updateCandidate } from "./db";
import { draftBrief, draftInvite, draftRejection } from "./drafts";
import { generateJson } from "./gemini";
import { pendingDrafts, placedRole, rankRole } from "./ranking";
import { rubricVersion } from "./rubric";
import { computeScores, SCORING_SCHEMA, SCORING_SYSTEM, scoringPrompt, type RawScores } from "./scoring";
import type { Candidate, Role } from "./types";

/** Score redacted CV content against both rubrics, band it and route it. */
export async function scoreCandidate(c: Candidate): Promise<Candidate> {
  const rubric = await getRubric();
  try {
    const raw = await generateJson<RawScores>({
      system: SCORING_SYSTEM,
      prompt: scoringPrompt(rubric, c.cv_content),
      schema: SCORING_SCHEMA,
    });
    const scores = computeScores(rubric, raw, c.cv_content, c.applied_role);
    const routed = scores.routed_role;
    return await updateCandidate(c.id, {
      status: "scored",
      error: null,
      score_json: scores,
      pm_score: scores.PM.total,
      spm_score: scores.SPM.total,
      routed_role: routed,
      band: scores[routed].band,
      rubric_version: rubricVersion(rubric),
    });
  } catch (e) {
    await updateCandidate(c.id, { status: "error", error: (e as Error).message });
    throw e;
  }
}

export async function rankedFor(role: Role) {
  return rankRole(await listCandidates(), role);
}

export async function reconcile(role: Role) {
  return pendingDrafts(await rankedFor(role));
}

/**
 * Generate what this candidate needs given their band now: brief + invite for the
 * shortlist, brief only for borderline (Arjun decides), rejection below the line.
 * Never touches an email that was already sent.
 */
export async function generateDrafts(id: string, only?: "brief"): Promise<Candidate> {
  const c = await getCandidate(id);
  if (only === "brief") return updateCandidate(id, { brief: await draftBrief(c) });
  if (c.email_status === "sent") return c;

  const placed = (await rankedFor(placedRole(c))).find((r) => r.id === id);
  if (!placed) throw new Error("Candidate is not scored yet");

  if (placed.decision === "hold") {
    return c.brief ? c : updateCandidate(id, { brief: await draftBrief(c) });
  }
  if (placed.decision === "invite") {
    const d = await draftInvite(c);
    return updateCandidate(id, {
      brief: d.brief,
      email_type: "invite",
      email_subject: d.subject,
      email_body: d.body,
      email_status: "draft",
      email_error: null,
    });
  }
  const d = await draftRejection(c);
  return updateCandidate(id, {
    email_type: "reject",
    email_subject: d.subject,
    email_body: d.body,
    email_status: "draft",
    email_error: null,
  });
}
