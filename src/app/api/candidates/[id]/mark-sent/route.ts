import { handle, HttpError } from "@/lib/api";
import { getCandidate, updateCandidate } from "@/lib/db";

export const runtime = "nodejs";

/** Arjun sent the email himself (Gmail, forwarded draft): record it so the dashboard stays accurate. Body: {to?} */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const c = await getCandidate(id);
    if (c.email_status === "sent") throw new HttpError(409, `Already marked as sent to ${c.sent_to}`);
    if (!c.email_body) throw new HttpError(400, "There is no draft for this candidate yet");
    const to = (typeof body.to === "string" && body.to.trim()) || c.personal_details.email || null;
    return {
      candidate: await updateCandidate(id, {
        email_status: "sent", delivery: "manual", email_error: null,
        sent_to: to, sent_at: new Date().toISOString(), resend_id: null,
      }),
    };
  });
}
