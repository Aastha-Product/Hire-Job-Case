import { handle, HttpError } from "@/lib/api";
import { getCandidate, updateCandidate } from "@/lib/db";
import { checkRecipient, draftsInbox, isTestingRestriction, ownerFromError, selfDraft, sendEmail } from "@/lib/email";
import { personalise } from "@/lib/personalise";
import { placedRole } from "@/lib/ranking";
import { ROLE_TITLE } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * Arjun's confirm click, the only path by which anything is emailed.
 * 1. Try the candidate's own address.
 * 2. If that isn't possible (no address, blocked domain, or Resend limited to the
 *    owner's inbox until a domain is verified), email the draft to Arjun's inbox
 *    with the candidate's address and a ready-to-send Gmail link.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const c = await getCandidate(id);
    if (c.email_status === "sent") throw new HttpError(409, `Already sent to ${c.sent_to} at ${c.sent_at}`);
    if (!c.email_body || !c.email_subject) throw new HttpError(400, "No draft to send yet");

    const name = c.personal_details.name;
    const subject = personalise(c.email_subject, name);
    const body = personalise(c.email_body, name);
    const candidateEmail = c.personal_details.email?.trim() || null;

    let reason: string | null = !candidateEmail ? "No email address was found on the CV." : checkRecipient(candidateEmail);
    let owner: string | null = null;

    if (!reason && candidateEmail) {
      try {
        const resendId = await sendEmail({ to: candidateEmail, subject, text: body });
        const updated = await updateCandidate(id, {
          email_status: "sent", delivery: "resend", email_error: null,
          sent_to: candidateEmail, sent_at: new Date().toISOString(), resend_id: resendId,
        });
        return { candidate: updated, delivered: "candidate", to: candidateEmail };
      } catch (e) {
        const msg = (e as Error).message;
        if (!isTestingRestriction(msg)) {
          await updateCandidate(id, { email_status: "failed", email_error: `Resend: ${msg}` });
          throw new HttpError(502, `Resend: ${msg}`);
        }
        owner = ownerFromError(msg);
        reason = "Resend can only email your own address until a sending domain is verified at resend.com/domains.";
      }
    }

    const inbox = owner ?? draftsInbox();
    if (!inbox) {
      throw new HttpError(400, `${reason} Set DRAFTS_TO to your email so drafts can be sent to you instead.`);
    }
    const draft = selfDraft({
      candidate: name,
      candidateEmail,
      role: ROLE_TITLE[placedRole(c)],
      subject,
      body,
      reason: reason ?? "",
    });
    let resendId: string | null;
    try {
      resendId = await sendEmail({ to: inbox, ...draft });
    } catch (e) {
      const msg = (e as Error).message;
      await updateCandidate(id, { email_status: "failed", email_error: `Resend: ${msg}` });
      throw new HttpError(502, `Resend: ${msg}`);
    }
    const updated = await updateCandidate(id, {
      email_status: "self", delivery: "self", email_error: null,
      sent_to: inbox, sent_at: new Date().toISOString(), resend_id: resendId,
    });
    return { candidate: updated, delivered: "self", to: inbox, candidateEmail, reason };
  });
}
