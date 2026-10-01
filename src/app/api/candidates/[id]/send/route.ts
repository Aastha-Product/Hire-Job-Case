import { handle, HttpError } from "@/lib/api";
import { getCandidate, updateCandidate } from "@/lib/db";
import { resolveRecipient, sendEmail } from "@/lib/email";
import { personalise } from "@/lib/personalise";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Arjun's confirm click. The only path by which anything reaches a candidate. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const c = await getCandidate(id);
    if (c.email_status === "sent") throw new HttpError(409, `Already sent to ${c.sent_to} at ${c.sent_at}`);
    if (!c.email_body || !c.email_subject) throw new HttpError(400, "No draft to send yet");

    const recipient = resolveRecipient(c.personal_details.email);
    if ("error" in recipient) throw new HttpError(400, recipient.error);

    const name = c.personal_details.name;
    let resendId: string | null;
    try {
      resendId = await sendEmail({
        to: recipient.to,
        subject: personalise(c.email_subject, name),
        text: personalise(c.email_body, name),
      });
    } catch (e) {
      await updateCandidate(id, { email_status: "failed", email_error: (e as Error).message });
      throw new HttpError(502, (e as Error).message);
    }
    return {
      candidate: await updateCandidate(id, {
        email_status: "sent",
        email_error: null,
        sent_to: recipient.to,
        sent_at: new Date().toISOString(),
        resend_id: resendId,
      }),
    };
  });
}
