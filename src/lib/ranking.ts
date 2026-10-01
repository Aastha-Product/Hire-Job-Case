import type { Band, Candidate, Decision, EmailType, RankedCandidate, Role } from "./types";

const BAND_ORDER: Record<Band, number> = { shortlist: 0, borderline: 1, below: 2 };
const SYSTEM_DECISION: Record<Band, Decision> = { shortlist: "invite", borderline: "hold", below: "reject" };

const roleScore = (c: Candidate, role: Role) => (role === "PM" ? c.pm_score : c.spm_score);
export const placedRole = (c: Candidate): Role => c.routed_role ?? c.applied_role;

/**
 * Rank scored candidates within the role the rubric routed them to:
 * shortlist, then borderline, then below the line, each by Fit Index.
 */
export function rankRole(all: Candidate[], role: Role): RankedCandidate[] {
  const other: Role = role === "PM" ? "SPM" : "PM";
  return all
    .filter((c) => c.status === "scored" && placedRole(c) === role && roleScore(c, role) != null)
    .sort(
      (a, b) =>
        BAND_ORDER[a.band ?? "below"] - BAND_ORDER[b.band ?? "below"] ||
        Number(roleScore(b, role)) - Number(roleScore(a, role)) ||
        a.created_at.localeCompare(b.created_at),
    )
    .map((c, i) => {
      const system_decision = SYSTEM_DECISION[c.band ?? "below"];
      return {
        ...c,
        rank: i + 1,
        score: Number(roleScore(c, role)),
        other_score: roleScore(c, other) == null ? null : Number(roleScore(c, other)),
        system_decision,
        decision: c.decision_override ?? system_decision,
      };
    });
}

export type Task = { id: string; kind: EmailType | "brief" };

/**
 * Work that is missing or stale for the current ranking: brief + invite for the
 * shortlist, a brief for borderline (held for Arjun), a rejection below the line.
 */
export function pendingDrafts(ranked: RankedCandidate[]): Task[] {
  const tasks: Task[] = [];
  for (const c of ranked) {
    if (c.email_status === "sent") continue;
    if (c.decision === "hold") {
      if (!c.brief) tasks.push({ id: c.id, kind: "brief" });
    } else if (!c.email_body || c.email_type !== c.decision || (c.decision === "invite" && !c.brief)) {
      tasks.push({ id: c.id, kind: c.decision });
    }
  }
  return tasks;
}
