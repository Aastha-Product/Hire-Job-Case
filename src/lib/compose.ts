// Links that open a ready-to-send email in the user's own mail client.
// Shared by the candidate page and the forwarded draft email.

/** Gmail compose window with To, Subject and Body filled in. */
export function gmailComposeUrl(to: string | null, subject: string, body: string): string {
  const q = new URLSearchParams({ view: "cm", fs: "1", su: subject, body });
  if (to) q.set("to", to);
  return `https://mail.google.com/mail/?${q.toString()}`;
}

/** Default mail app (Outlook, Apple Mail, ...). */
export function mailtoUrl(to: string | null, subject: string, body: string): string {
  const q = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return `mailto:${to ? encodeURIComponent(to) : ""}?${q}`;
}
