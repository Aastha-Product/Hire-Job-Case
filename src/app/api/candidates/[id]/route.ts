import { handle, HttpError } from "@/lib/api";
import { deleteCandidate, getCandidate, updateCandidate } from "@/lib/db";
import type { Candidate } from "@/lib/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return handle(async () => ({ candidate: await getCandidate((await params).id) }));
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
