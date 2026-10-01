"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { gmailComposeUrl } from "@/lib/compose";
import { personalise } from "@/lib/personalise";
import { ROLE_TITLE, type Band, type RankedCandidate, type Role, type RoleScore } from "@/lib/types";

// Shared by the dashboard side panel and the single-candidate page.

export type Toast = { text: string; kind?: "bad" } | null;
/** How Send behaves: straight to the candidate, or as a draft to Arjun's inbox. */
export type MailMode = { resend: boolean; directSend: boolean; draftsTo: string | null };

export const BAND_TITLE: Record<Band, string> = { shortlist: "Shortlist", borderline: "Borderline", below: "Below the line" };
export const LEVEL = ["Weak", "Moderate", "Strong"];

const FLAG_LABEL: Record<string, string> = {
  keyword_unsupported: "Keywords without experience",
  metric_to_verify: "Claims to verify",
  low_confidence: "Low confidence",
  evidence_not_verbatim: "Quote not verbatim",
  experience_band_mismatch: "Experience outside range",
  generalist_C1_zero: "No ops grounding",
  not_independent_for_SPM: "Not independent enough for SPM",
  too_many_zero_criteria: "Too many zero scores",
};
export const flagLabel = (f: string) => {
  const routed = f.match(/^routed_(\w+)_to_(\w+)$/);
  return routed ? `Routed ${routed[1]} → ${routed[2]}` : FLAG_LABEL[f] ?? f.replace(/_/g, " ");
};
export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
export const draftReady = (c: RankedCandidate) => c.decision !== "hold" && !!c.email_body && c.email_type === c.decision;

export function NextStep({ c }: { c: RankedCandidate }) {
  if (c.email_status === "sent") return <span className="badge good">{c.email_type === "invite" ? "Invite sent" : "Rejection sent"}</span>;
  if (c.email_status === "self") return <span className="badge warn">In your inbox: forward</span>;
  if (c.email_status === "failed") return <span className="badge bad">Send failed</span>;
  if (c.decision === "hold") return <span className="badge warn">Decide</span>;
  if (!draftReady(c)) return <span className="badge neutral">Drafting…</span>;
  return (
    <span className={`badge ${c.decision === "invite" ? "shortlist" : "neutral"}`}>
      {c.decision === "invite" ? "Invite ready" : "Rejection ready"}
      {c.decision_override ? " · yours" : ""}
    </span>
  );
}

function Brief({ text }: { text: string }) {
  const probeAt = text.search(/Probe:/);
  const main = probeAt >= 0 ? text.slice(0, probeAt).trim() : text;
  const probe = probeAt >= 0 ? text.slice(probeAt + 6).trim() : null;
  return (
    <div className="brief">
      <p>{main}</p>
      {probe && <div className="probe"><strong>Probe in interview:</strong> {probe}</div>}
    </div>
  );
}

function Scores({ rs }: { rs: RoleScore }) {
  return (
    <>
      {rs.criteria.map((k) => (
        <div key={k.code} className="criterion">
          <div className="head">
            <span className={`level s${k.score}`}>{LEVEL[k.score]}</span>
            <span className="nm">{k.code} · {k.name}</span>
            <span className="pts">{k.points} / {k.weight} pts</span>
          </div>
          {k.evidence && (
            <div className="evidence">
              “{k.evidence}”{!k.evidence_verified && <span className="chip warn" style={{ marginLeft: 6 }}>not verbatim, check CV</span>}
            </div>
          )}
          <div className="small">{k.reason}</div>
          {k.missing && <div className="small muted" style={{ marginTop: 4 }}>Missing: {k.missing}</div>}
        </div>
      ))}
    </>
  );
}

/** Name, badges, contact line and the big Fit score. */
export function DetailHeader({ c, role }: { c: RankedCandidate; role: Role }) {
  const s = c.score_json!;
  const name = c.personal_details.name;
  return (
    <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
      <span className="avatar lg">{initials(name)}</span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="name">{name}</div>
        <div className="row" style={{ gap: 6, marginTop: 4 }}>
          <span className={`badge ${c.band}`}>{BAND_TITLE[c.band ?? "below"]}</span>
          <span className="chip">{ROLE_TITLE[role]}</span>
          {c.applied_role !== role && <span className="chip warn">applied {c.applied_role}</span>}
          <span className="chip">confidence {s.confidence}</span>
        </div>
        <div className="kv">
          <span>{c.personal_details.email ?? "no email"}</span>
          <span>{c.personal_details.phone ?? "no phone"}</span>
          {s.years_experience != null && <span>~{s.years_experience} yrs</span>}
          <span>{c.source_filename}</span>
        </div>
      </div>
      <div className="bigscore">
        <div className="num">{c.score}</div>
        <div className="of">Fit / 100</div>
        <div className="of">{role === "PM" ? "SPM" : "PM"} {c.other_score ?? "–"}</div>
      </div>
    </div>
  );
}

/**
 * Everything about one candidate. `focus="score"` puts the score breakdown first
 * (used right after an upload); `focus="decision"` puts the decision first (dashboard review).
 */
export function DetailBody({
  c, role, mail, focus = "decision", onChange, onToast, onDeleted,
}: {
  c: RankedCandidate; role: Role; mail: MailMode; focus?: "decision" | "score";
  onChange: () => Promise<void>; onToast: (t: Toast) => void; onDeleted: () => void;
}) {
  const s = c.score_json!;
  const name = c.personal_details.name;
  const [view, setView] = useState<Role>(role);
  const [subject, setSubject] = useState(personalise(c.email_subject ?? "", name));
  const [body, setBody] = useState(personalise(c.email_body ?? "", name));
  const [recipient, setRecipient] = useState(c.personal_details.email ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => setView(role), [role]);
  useEffect(() => {
    setSubject(personalise(c.email_subject ?? "", name));
    setBody(personalise(c.email_body ?? "", name));
  }, [c.email_subject, c.email_body, name]);
  useEffect(() => setRecipient(c.personal_details.email ?? ""), [c.personal_details.email]);

  const dirty = c.email_body != null && (subject !== personalise(c.email_subject ?? "", name) || body !== personalise(c.email_body ?? "", name));
  const recipientDirty = recipient.trim() !== (c.personal_details.email ?? "");
  const validRecipient = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.trim());
  const ready = draftReady(c);
  const sent = c.email_status === "sent";
  const inInbox = c.email_status === "self";
  const kind = c.email_type === "invite" ? "invite" : "rejection";
  const flags = [...s.flags, ...s[role].flags].filter((f, i, a) => a.indexOf(f) === i);
  const gmail = gmailComposeUrl(validRecipient ? recipient.trim() : null, subject, body);

  async function run(label: string, fn: () => Promise<unknown>, ok?: string) {
    setBusy(label);
    try {
      await fn();
      if (ok) onToast({ text: ok });
      await onChange();
    } catch (e) {
      onToast({ text: (e as Error).message, kind: "bad" });
    } finally {
      setBusy(null);
    }
  }

  /** Persist any edits (address, subject, body) before sending or opening Gmail. */
  async function saveEdits() {
    const patch: Record<string, string> = {};
    if (recipientDirty) patch.email = recipient.trim();
    if (dirty) Object.assign(patch, { email_subject: subject, email_body: body });
    if (Object.keys(patch).length) await api(`/api/candidates/${c.id}`, { method: "PATCH", json: patch });
  }

  const decide = (d: "invite" | "reject" | null) =>
    run("decide", async () => {
      await api(`/api/candidates/${c.id}`, { method: "PATCH", json: { decision_override: d } });
      await api(`/api/candidates/${c.id}/generate`, { method: "POST", json: {} });
    }, d ? `Marked as ${d}; draft written` : "Back to the system's recommendation");

  const save = () => run("save", saveEdits, "Saved");

  async function send() {
    if (recipient.trim() && !validRecipient) {
      onToast({ text: "That email address doesn't look right.", kind: "bad" });
      return;
    }
    const target = validRecipient ? recipient.trim() : null;
    const msg = mail.directSend && target
      ? `Send this ${kind} to ${name} at ${target}?\n\nThis cannot be undone.`
      : `Resend can't email ${target ?? "the candidate"} directly yet (no verified domain), so the draft will go to your inbox${mail.draftsTo ? ` (${mail.draftsTo})` : ""} with ${target ?? "the candidate"}'s address, ready to forward.\n\nContinue?`;
    if (!confirm(msg)) return;
    setBusy("send");
    try {
      await saveEdits();
      const res = await api<{ delivered: "candidate" | "self"; to: string }>(`/api/candidates/${c.id}/send`, { method: "POST" });
      onToast({ text: res.delivered === "candidate" ? `Sent to ${res.to}` : `Draft sent to your inbox (${res.to}). Forward it to ${target ?? "the candidate"}.` });
      await onChange();
    } catch (e) {
      onToast({ text: (e as Error).message, kind: "bad" });
    } finally {
      setBusy(null);
    }
  }

  const markSent = () => {
    if (!confirm(`Mark the ${kind} to ${name} as sent${validRecipient ? ` to ${recipient.trim()}` : ""}? Use this after sending it yourself from Gmail.`)) return;
    run("mark", async () => {
      await saveEdits();
      await api(`/api/candidates/${c.id}/mark-sent`, { method: "POST", json: { to: validRecipient ? recipient.trim() : undefined } });
    }, "Marked as sent");
  };

  async function copy() {
    const text = `To: ${recipient.trim() || "(add the candidate's email)"}\nSubject: ${subject}\n\n${body}`;
    try {
      await navigator.clipboard.writeText(text);
      onToast({ text: "Email copied: paste it into any mail app" });
    } catch {
      onToast({ text: "Couldn't copy automatically. Select the text and copy it.", kind: "bad" });
    }
  }

  async function openGmail() {
    // Open the window first (popup blockers allow it only straight from the click), then save edits.
    window.open(gmail, "_blank", "noopener");
    if (dirty || recipientDirty) await saveEdits().then(onChange).catch(() => {});
  }

  const del = async () => {
    if (!confirm(`Delete ${name} and all their data?`)) return;
    setBusy("del");
    try {
      await api(`/api/candidates/${c.id}`, { method: "DELETE" });
      onToast({ text: "Candidate deleted" });
      onDeleted();
    } catch (e) {
      onToast({ text: (e as Error).message, kind: "bad" });
      setBusy(null);
    }
  };

  const when = c.sent_at ? new Date(c.sent_at).toLocaleString() : "";

  const decision = (
    <div className="card emph" key="decision">
      <h3>Decision</h3>
      {sent ? (
        <div className="notice good" style={{ marginBottom: 0 }}>
          <span className="ico">✓</span>
          <span>
            {kind === "invite" ? "Interview invite" : "Rejection"} {c.delivery === "manual" ? "sent by you" : "sent"}
            {c.sent_to ? ` to ${c.sent_to}` : ""} on {when}.
          </span>
        </div>
      ) : (
        <>
          {inInbox && (
            <div className="notice warn small">
              <span className="ico">✉</span>
              <span>
                The draft was sent to <strong>your inbox ({c.sent_to})</strong> on {when}. Forward it to{" "}
                <strong>{recipient.trim() || "the candidate"}</strong>, or use <strong>Open in Gmail</strong> below. Then click <strong>Mark as sent</strong>.
              </span>
            </div>
          )}
          <div className="row spread">
            <span className="small muted">
              Recommendation: <strong style={{ color: "var(--text)" }}>{c.system_decision === "hold" ? "your call" : c.system_decision}</strong>
              {c.decision_override && <> · your choice: <strong style={{ color: "var(--text)" }}>{c.decision_override}</strong></>}
            </span>
            <div className="row" style={{ gap: 6 }}>
              <div className="seg">
                <button className={c.decision === "invite" ? "on" : ""} disabled={!!busy} onClick={() => c.decision !== "invite" && decide("invite")}>Invite</button>
                <button className={c.decision === "reject" ? "on" : ""} disabled={!!busy} onClick={() => c.decision !== "reject" && decide("reject")}>Reject</button>
              </div>
              {c.decision_override && <button className="ghost sm" disabled={!!busy} onClick={() => decide(null)}>Reset</button>}
            </div>
          </div>
          {busy === "decide" && <p className="small muted">Writing the draft…</p>}
          {c.decision === "hold" && busy !== "decide" && (
            <p className="small muted" style={{ marginBottom: 0 }}>Borderline: nothing is drafted until you pick Invite or Reject.</p>
          )}
        </>
      )}

      {(ready || sent || inInbox || c.email_status === "failed") && (
        <div style={{ marginTop: 14 }}>
          <label className="small muted" style={{ display: "block", marginBottom: 4 }}>To (candidate&apos;s email)</label>
          <input
            className="wide"
            type="email"
            value={recipient}
            disabled={sent}
            placeholder="Add the candidate's email address"
            onChange={(e) => setRecipient(e.target.value)}
            style={recipient.trim() && !validRecipient ? { borderColor: "var(--bad)" } : undefined}
            aria-label="Candidate email"
          />
          {!sent && (
            <div className="small" style={{ margin: "6px 0 10px", color: mail.directSend ? "var(--good)" : "var(--warn)" }}>
              {mail.directSend
                ? "Send goes straight to this address."
                : `Direct sending isn't available yet (no verified Resend domain), so Send puts the draft in your inbox${mail.draftsTo ? ` (${mail.draftsTo})` : ""} to forward. Or use Open in Gmail.`}
            </div>
          )}
          <input className="wide" value={subject} disabled={sent} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
          <textarea rows={11} value={body} disabled={sent} onChange={(e) => setBody(e.target.value)} style={{ marginTop: 8 }} aria-label="Email body" />
          {c.email_error && <div className="notice bad small" style={{ marginTop: 8 }}><span className="ico">!</span><span>{c.email_error}</span></div>}
          {!sent && (
            <>
              <div className="row spread" style={{ marginTop: 10 }}>
                <div className="row" style={{ gap: 6 }}>
                  <button className="ghost" disabled={!!busy} onClick={() => run("regen", () => api(`/api/candidates/${c.id}/generate`, { method: "POST", json: {} }), "Redrafted")}>
                    {busy === "regen" ? "Drafting…" : "↻ Redraft"}
                  </button>
                  {(dirty || recipientDirty) && <button disabled={!!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save edits"}</button>}
                </div>
                <button className="primary" disabled={!!busy || !mail.resend} onClick={send} title={mail.resend ? "" : "Add a Resend API key to enable sending"}>
                  {busy === "send" ? "Sending…" : mail.directSend && validRecipient ? `Send ${kind} →` : inInbox ? "Send draft to my inbox again" : "Send draft to my inbox →"}
                </button>
              </div>
              <div className="row" style={{ gap: 6, marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-2)" }}>
                <span className="small muted">Send it yourself:</span>
                <button className="sm" disabled={!!busy} onClick={openGmail}>Open in Gmail ↗</button>
                <button className="sm" disabled={!!busy} onClick={copy}>Copy email</button>
                <button className={inInbox ? "sm good" : "sm"} disabled={!!busy} onClick={markSent}>{busy === "mark" ? "Saving…" : "✓ Mark as sent"}</button>
              </div>
            </>
          )}
        </div>
      )}
      {!ready && !sent && !inInbox && c.email_status !== "failed" && c.decision !== "hold" && (
        <button style={{ marginTop: 12 }} disabled={!!busy} onClick={() => run("regen", () => api(`/api/candidates/${c.id}/generate`, { method: "POST", json: {} }), "Draft written")}>
          {busy === "regen" ? "Drafting…" : `Write ${c.decision} email`}
        </button>
      )}
    </div>
  );

  const brief = (
    <div className="card" key="brief">
      <h3>Interview brief</h3>
      {c.brief ? (
        <Brief text={personalise(c.brief, name)} />
      ) : (
        <button disabled={!!busy} onClick={() => run("brief", () => api(`/api/candidates/${c.id}/generate`, { method: "POST", json: { only: "brief" } }), "Brief written")}>
          {busy === "brief" ? "Writing…" : "Write brief"}
        </button>
      )}
    </div>
  );

  const scores = (
    <div className="card" key="scores">
      <div className="row spread" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>Score breakdown</h3>
        <div className="seg">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <button key={r} className={view === r ? "on" : ""} onClick={() => setView(r)}>
              {r} {s[r].total}
            </button>
          ))}
        </div>
      </div>
      <div className="small muted" style={{ marginBottom: 10 }}>
        {ROLE_TITLE[view]} rubric · Fit {s[view].total}/100 · <span className={`badge ${s[view].band}`}>{BAND_TITLE[s[view].band]}</span>
      </div>
      <Scores rs={s[view]} />
    </div>
  );

  const flagCard = (flags.length > 0 || s.metrics_to_verify.length > 0) && (
    <div className="card" key="flags">
      <h3>Flags to check</h3>
      <div>{flags.map((f) => <span key={f} className="chip warn">{flagLabel(f)}</span>)}</div>
      {s.metrics_to_verify.length > 0 && (
        <>
          <div className="small" style={{ fontWeight: 600, margin: "10px 0 4px" }}>Claims to verify in the interview</div>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{s.metrics_to_verify.map((m) => <li key={m}>{m}</li>)}</ul>
        </>
      )}
      {s.unsupported_keywords.length > 0 && (
        <p className="small muted" style={{ marginBottom: 0 }}>Listed without experience behind them: {s.unsupported_keywords.join(", ")}</p>
      )}
    </div>
  );

  const order = focus === "score" ? [scores, flagCard, brief, decision] : [decision, brief, scores, flagCard];

  return (
    <>
      {order}
      <div className="card">
        <details>
          <summary>What the AI saw (CV with personal details removed)</summary>
          <pre className="cv">{c.cv_content}</pre>
        </details>
      </div>
      <div className="row spread">
        <button className="ghost sm" disabled={!!busy} onClick={() => run("rescore", () => api(`/api/candidates/${c.id}/rescore`, { method: "POST" }), "Re-scored")}>
          {busy === "rescore" ? "Scoring…" : "↻ Re-score"}
        </button>
        <button className="ghost sm danger" disabled={!!busy} onClick={del}>Delete candidate</button>
      </div>
    </>
  );
}
