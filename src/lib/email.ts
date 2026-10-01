import "server-only";
import { Resend } from "resend";
import { gmailComposeUrl } from "./compose";

/** Recipient domains the app may email. "*" (or empty) means any domain. */
export function allowedDomains(): string[] {
  const raw = process.env.ALLOWED_RECIPIENT_DOMAIN ?? "*";
  return raw
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter((d) => d && d !== "*");
}

/** Arjun's own inbox: where drafts go when Resend can't reach the candidate. */
export function draftsInbox(): string | null {
  return process.env.DRAFTS_TO?.trim() || process.env.EMAIL_OVERRIDE_TO?.trim() || null;
}

export function fromAddress(): string {
  return process.env.RESEND_FROM || "Kargo Hiring <onboarding@resend.dev>";
}

/** Resend refuses non-owner recipients until a domain is verified. */
export function isTestingRestriction(message: string): boolean {
  return /only send testing emails|verify a domain|domain is not verified/i.test(message);
}

/** Resend's restriction message names the account owner's address. */
export function ownerFromError(message: string): string | null {
  return message.match(/own email address \(([^)\s]+@[^)\s]+)\)/i)?.[1] ?? null;
}

export function checkRecipient(to: string): string | null {
  const domains = allowedDomains();
  const domain = to.split("@")[1]?.toLowerCase() ?? "";
  if (domains.length && !domains.includes(domain)) {
    return `Blocked: ${to} is outside the allowed domains (${domains.join(", ")}).`;
  }
  return null;
}

export async function sendEmail(opts: { to: string; subject: string; text: string; html?: string }) {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set.");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: fromAddress(),
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    ...(opts.html ? { html: opts.html } : {}),
  });
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The email Arjun receives when the draft can't go straight to the candidate. */
export function selfDraft(opts: { candidate: string; candidateEmail: string | null; role: string; subject: string; body: string; reason: string }) {
  const to = opts.candidateEmail ?? "(no email on the CV: add one)";
  const compose = gmailComposeUrl(opts.candidateEmail, opts.subject, opts.body);
  const subject = `[Forward to ${opts.candidateEmail ?? "candidate"}] ${opts.subject}`;
  const text = `DRAFT, not yet sent to the candidate.
Send it to: ${to}
Candidate: ${opts.candidate} · ${opts.role}
Why you're getting it: ${opts.reason}

Open it in Gmail with the address filled in:
${compose}

Or forward this email to ${to} and delete these lines.
----------------------------------------
Subject: ${opts.subject}

${opts.body}`;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px">
<div style="background:#fff8eb;border:1px solid #fde3b0;border-radius:10px;padding:14px 16px;margin-bottom:18px;color:#5b3a06">
<div style="font-weight:700;margin-bottom:4px">Draft, not yet sent to the candidate</div>
<div>Send it to: <strong>${esc(to)}</strong> · ${esc(opts.candidate)} · ${esc(opts.role)}</div>
<div style="font-size:12px;margin-top:4px;color:#7a5414">${esc(opts.reason)}</div>
<a href="${esc(compose)}" style="display:inline-block;margin-top:12px;background:#2563eb;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:600">Open in Gmail, ready to send →</a>
<div style="font-size:12px;margin-top:8px;color:#7a5414">Or forward this email to ${esc(to)} and delete this box.</div>
</div>
<div style="font-weight:600;margin-bottom:10px">${esc(opts.subject)}</div>
<div style="white-space:pre-wrap;line-height:1.55">${esc(opts.body)}</div>
</div>`;
  return { subject, text, html };
}

let domainCache: { at: number; verified: string[] } | null = null;

/** Can Resend email anyone (verified sending domain), or only the account owner? */
export async function directSendAvailable(): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  const fromDomain = fromAddress().match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? "";
  if (!domainCache || Date.now() - domainCache.at > 5 * 60_000) {
    try {
      const { data } = await new Resend(process.env.RESEND_API_KEY).domains.list();
      const list = (data as { data?: { name: string; status: string }[] } | null)?.data ?? [];
      domainCache = { at: Date.now(), verified: list.filter((d) => d.status === "verified").map((d) => d.name.toLowerCase()) };
    } catch {
      return false;
    }
  }
  return domainCache.verified.includes(fromDomain);
}
