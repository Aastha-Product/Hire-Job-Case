import { handle, HttpError } from "@/lib/api";
import { deleteCandidate, getCandidate, getRubric, listCandidates, updateCandidate } from "@/lib/db";
import { placedRole, rankRole } from "@/lib/ranking";
import { rubricVersion } from "@/lib/rubric";
import type { Candidate } from "@/lib/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** One candidate, placed in their routed role's ranking (rank, decision, other-role score). */
export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const [all, rubric] = await Promise.all([listCandidates(), getRubric()]);
    const raw = all.find((c) => c.id === id);
    if (!raw) throw new HttpError(404, "Candidate not found. They may have been deleted.");
    const role = placedRole(raw);
    const ranked = rankRole(all, role);
    const placed = ranked.find((c) => c.id === id) ?? null;
    return { candidate: placed ?? raw, scored: !!placed, role, of: ranked.length, rubricVersion: rubricVersion(rubric) };
  });
}

/** Arjun's edits: move across the line, fix the name/email, or edit the draft before sending. */
export async function PATCH(req: Request, { params }: Ctx) {
  return handle(async () => {
    const { id } = await params;
    const body = await req.json();
    const current = await getCandidate(id);
    const patch: Partial<Candidate> = {};

    if ("decision_override" in body) {
      if (![null, "invite", "reject"].includes(body.decision_override)) throw new HttpError(400, "Invalid decision");
      patch.decision_override = body.decision_override;
    }
    if (typeof body.name === "string" || typeof body.email === "string") {
      patch.personal_details = {
        ...current.personal_details,
        ...(typeof body.name === "string" && body.name.trim() ? { name: body.name.trim() } : {}),
        ...(typeof body.email === "string" ? { email: body.email.trim() || null } : {}),
      };
    }
    if (typeof body.email_subject === "string" || typeof body.email_body === "string") {
      if (current.email_status === "sent") throw new HttpError(409, "This email was already sent");
      if (typeof body.email_subject === "string") patch.email_subject = body.email_subject;
      if (typeof body.email_body === "string") patch.email_body = body.email_body;
    }
    return { candidate: await updateCandidate(id, patch) };
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return handle(async () => {
    await deleteCandidate((await params).id);
    return { ok: true };
  });
}
