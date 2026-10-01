import "server-only";
import { Resend } from "resend";

export function allowedDomains(): string[] {
  return (process.env.ALLOWED_RECIPIENT_DOMAIN ?? "pg27.mesaschool.co")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

/** Where an email for this candidate would actually go, or why it can't. */
export function resolveRecipient(candidateEmail: string | null): { to: string } | { error: string } {
  const override = process.env.EMAIL_OVERRIDE_TO?.trim();
  const to = override || candidateEmail?.trim();
  if (!to) return { error: "No email address found on this CV." };
  const domains = allowedDomains();
  const domain = to.split("@")[1]?.toLowerCase() ?? "";
  if (!override && domains.length && !domains.includes(domain)) {
    return { error: `Blocked: ${to} is outside the allowed test domain (${domains.join(", ")}).` };
  }
  return { to };
}

export async function sendEmail(opts: { to: string; subject: string; text: string }) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set yet (checkpoint B-2).");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM || "Kargo Hiring <onboarding@resend.dev>",
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
  if (error) throw new Error(`Resend: ${error.message}`);
  return data?.id ?? null;
}
