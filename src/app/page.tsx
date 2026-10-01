"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, runDraftQueue } from "@/lib/client";
import { personalise } from "@/lib/personalise";
import {
  ROLE_TITLE,
  type Band,
  type BandRules,
  type Candidate,
  type RankedCandidate,
  type Role,
  type RoleScore,
} from "@/lib/types";

interface Data {
  rubricVersion: string;
  bands: Record<Role, BandRules>;
  roles: Record<Role, RankedCandidate[]>;
  unscored: Candidate[];
}
interface Status {
  database: boolean;
  gemini: boolean;
  resend: boolean;
  emailOverride: string | null;
  allowedDomains: string[];
}
type Filter = "all" | Band | "sent";
type Toast = { text: string; kind?: "bad" } | null;

const BANDS: Band[] = ["shortlist", "borderline", "below"];
const BAND_TITLE: Record<Band, string> = { shortlist: "Shortlist", borderline: "Borderline", below: "Below the line" };
const BAND_HINT: Record<Band, string> = {
  shortlist: "Interview invite drafted. Review and send.",
  borderline: "Your call. Pick Invite or Reject.",
  below: "Warm rejection drafted. Review and send.",
};
const LEVEL = ["Weak", "Moderate", "Strong"];

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
const flagLabel = (f: string) => {
  const routed = f.match(/^routed_(\w+)_to_(\w+)$/);
  return routed ? `Routed ${routed[1]} → ${routed[2]}` : FLAG_LABEL[f] ?? f.replace(/_/g, " ");
};
const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";
const draftReady = (c: RankedCandidate) => c.decision !== "hold" && !!c.email_body && c.email_type === c.decision;

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("PM");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [queue, setQueue] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const load = useCallback(async () => {
    try {
      setData(await api<Data>("/api/candidates"));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    api<Status>("/api/status").then(setStatus).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const all = useMemo(() => (data ? [...data.roles.PM, ...data.roles.SPM] : []), [data]);
  const list = data?.roles[role] ?? [];
  const stats = {
    borderline: list.filter((c) => c.decision === "hold" && c.email_status !== "sent").length,
    shortlist: list.filter((c) => c.decision === "invite" && c.email_status !== "sent").length,
    below: list.filter((c) => c.decision === "reject" && c.email_status !== "sent").length,
    sent: list.filter((c) => c.email_status === "sent").length,
  };
  const pending = all.filter(
    (c) => c.email_status !== "sent" && (c.decision === "hold" ? !c.brief : !c.email_body || c.email_type !== c.decision),
  ).length;

  const q = query.trim().toLowerCase();
  const visible = list.filter(
    (c) =>
      (filter === "all" || (filter === "sent" ? c.email_status === "sent" : c.band === filter)) &&
      (!q || c.personal_details.name.toLowerCase().includes(q) || (c.source_filename ?? "").toLowerCase().includes(q)),
  );
  const openIndex = visible.findIndex((c) => c.id === openId);
  const open = openIndex >= 0 ? visible[openIndex] : all.find((c) => c.id === openId) ?? null;

  const step = useCallback(
    (d: 1 | -1) => {
      if (openIndex < 0) return;
      const next = visible[openIndex + d];
      if (next) setOpenId(next.id);
    },
    [openIndex, visible],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!openId) return;
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "");
      if (e.key === "Escape") setOpenId(null);
      else if (!typing && e.key === "ArrowRight") step(1);
      else if (!typing && e.key === "ArrowLeft") step(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId, step]);

  async function draftAll() {
    const errors = await runDraftQueue((done, total) => setQueue(`Drafting ${done}/${total}…`));
    setQueue(null);
    setToast(errors.length ? { text: `Finished with ${errors.length} error(s): ${errors[0]}`, kind: "bad" } : { text: "All drafts ready" });
    await load();
  }

  const statCard = (key: Exclude<Filter, "all">, label: string, hint: string, dot: string) => (
    <button className={`stat ${filter === key ? "on" : ""}`} onClick={() => setFilter(filter === key ? "all" : key)}>
      <div className="label"><span className={`dot ${dot}`} /> {label}</div>
      <div className="value">{stats[key]}</div>
      <div className="hint">{hint}</div>
    </button>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Candidates</h1>
          <p>Ranked by the Kargo rubric. Open anyone to see the evidence, then decide and send.</p>
        </div>
        <div className="row">
          {queue && <span className="muted small">{queue}</span>}
          {pending > 0 && !queue && (
            <button onClick={draftAll}>Draft {pending} missing</button>
          )}
          <button className="ghost" onClick={load} title="Refresh">↻ Refresh</button>
          <Link href="/upload"><button className="primary">+ Upload CVs</button></Link>
        </div>
      </div>

      {status && (!status.database || !status.gemini) && (
        <div className="notice bad"><span className="ico">!</span>
          <span>Missing configuration: {[!status.database && "Neon DATABASE_URL", !status.gemini && "Gemini"].filter(Boolean).join(", ")}.</span>
        </div>
      )}
      {status && !status.resend && (
        <div className="notice warn small"><span className="ico">!</span><span>Email sending is off until a Resend API key is added.</span></div>
      )}
      {status?.emailOverride && (
        <div className="notice info small">
          <span className="ico">✉</span>
          <span>
            <strong>Test mode.</strong> Nothing is emailed until you open a candidate and click Send. Emails go to{" "}
            <strong>{status.emailOverride}</strong> instead of the candidate · {all.filter((c) => c.email_status === "sent").length} sent so far.
          </span>
        </div>
      )}
      {error && <div className="notice bad"><span className="ico">!</span><span>{error}</span></div>}

      <div className="toolbar">
        <div className="seg">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <button key={r} className={r === role ? "on" : ""} onClick={() => { setRole(r); setFilter("all"); }}>
              {ROLE_TITLE[r]}<span className="count">{data?.roles[r].length ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="search">
          <input placeholder="Search by name or file" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {filter !== "all" && <button className="ghost sm" onClick={() => setFilter("all")}>Clear filter ×</button>}
      </div>

      <div className="stats">
        {statCard("borderline", "Your call", "Borderline: decide", "borderline")}
        {statCard("shortlist", "Invites ready", "Shortlist: review and send", "shortlist")}
        {statCard("below", "Rejections ready", "Below the line: review and send", "below")}
        {statCard("sent", "Emails sent", "Done", "sent")}
      </div>

      {data && (
        <p className="muted small" style={{ margin: "-6px 0 14px" }}>
          {ROLE_TITLE[role]} shortlist: Fit ≥ {data.bands[role].shortlistMin}
          {Object.entries(data.bands[role].require).map(([k, v]) => `, ${k} ≥ ${v}`).join("")}
          {data.bands[role].maxZero != null ? `, at most ${data.bands[role].maxZero} criterion at 0` : ""} · below the line under{" "}
          {data.bands[role].belowUnder} · candidates appear under the role the rubric routed them to.
        </p>
      )}

      {!data && !error && <div className="section"><div className="empty">Loading candidates…</div></div>}
      {data && list.length === 0 && (
        <div className="section"><div className="empty">No candidates in this role yet. <Link href="/upload">Upload CVs</Link> to get started.</div></div>
      )}
      {data && list.length > 0 && visible.length === 0 && (
        <div className="section"><div className="empty">Nobody matches this filter.</div></div>
      )}

      {BANDS.map((band) => {
        const rows = visible.filter((c) => c.band === band);
        if (!rows.length) return null;
        return (
          <div key={band} className={`section ${band}`}>
            <div className="section-head">
              <span className={`dot ${band}`} />
              <span className="title">{BAND_TITLE[band]}</span>
              <span className="count">{rows.length}</span>
              <span className="hint">{BAND_HINT[band]}</span>
            </div>
            {rows.map((c) => (
              <Row key={c.id} c={c} role={role} active={c.id === openId} stale={c.rubric_version !== data?.rubricVersion} onOpen={() => setOpenId(c.id)} />
            ))}
          </div>
        );
      })}

      {data && data.unscored.length > 0 && (
        <div className="section">
          <div className="section-head"><span className="dot" style={{ background: "var(--bad)" }} /><span className="title">Not scored</span><span className="count">{data.unscored.length}</span></div>
          {data.unscored.map((c) => <Unscored key={c.id} c={c} onChange={load} onToast={setToast} />)}
        </div>
      )}

      {open && (
        <Drawer
          key={open.id}
          c={open}
          role={role}
          index={openIndex}
          total={visible.length}
          resend={status?.resend ?? false}
          override={status?.emailOverride ?? null}
          onClose={() => setOpenId(null)}
          onStep={step}
          onChange={load}
          onToast={setToast}
        />
      )}
      {toast && <div className={`toast ${toast.kind ?? ""}`}>{toast.text}</div>}
    </>
  );
}

function Row({ c, role, active, stale, onOpen }: { c: RankedCandidate; role: Role; active: boolean; stale: boolean; onOpen: () => void }) {
  const s = c.score_json;
  const other: Role = role === "PM" ? "SPM" : "PM";
  const flags = s ? [...s.flags.filter((f) => !f.startsWith("routed_") && f !== "metric_to_verify"), ...s[role].flags] : [];
  return (
    <button className={`cand ${active ? "active" : ""}`} onClick={onOpen}>
      <span className="rank">{c.rank}</span>
      <span className="who">
        <span className="avatar">{initials(c.personal_details.name)}</span>
        <span style={{ minWidth: 0 }}>
          <div className="name">{c.personal_details.name}</div>
          <div className="meta">
            Applied {c.applied_role}
            {c.applied_role !== role && ` · routed to ${role}`}
            {stale && " · older rubric"}
            {flags.length > 0 && ` · ${flags.slice(0, 2).map(flagLabel).join(", ")}${flags.length > 2 ? ` +${flags.length - 2}` : ""}`}
          </div>
        </span>
      </span>
      <span className="fit">
        <span className="num">{c.score}<small>{other} {c.other_score ?? "–"}</small></span>
        <span className={`bar ${c.band}`}><span style={{ width: `${Math.max(3, c.score)}%` }} /></span>
      </span>
      <span className="crit">
        {s?.[role].criteria.map((k) => (
          <span key={k.code} className={`cblock s${k.score}`} title={`${k.code} ${k.name}: ${LEVEL[k.score]} (${k.points}/${k.weight})\n${k.reason}`}>
            {k.code}
          </span>
        ))}
      </span>
      <span className="status"><NextStep c={c} /></span>
      <span className="chev">›</span>
    </button>
  );
}

function NextStep({ c }: { c: RankedCandidate }) {
  if (c.email_status === "sent") return <span className="badge good">{c.email_type === "invite" ? "Invite sent" : "Rejection sent"}</span>;
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

function Drawer({
  c, role, index, total, resend, override, onClose, onStep, onChange, onToast,
}: {
  c: RankedCandidate; role: Role; index: number; total: number; resend: boolean; override: string | null;
  onClose: () => void; onStep: (d: 1 | -1) => void; onChange: () => Promise<void>; onToast: (t: Toast) => void;
}) {
  const s = c.score_json!;
  const name = c.personal_details.name;
  const [view, setView] = useState<Role>(role);
  const [subject, setSubject] = useState(personalise(c.email_subject ?? "", name));
  const [body, setBody] = useState(personalise(c.email_body ?? "", name));
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    setSubject(personalise(c.email_subject ?? "", name));
    setBody(personalise(c.email_body ?? "", name));
  }, [c.email_subject, c.email_body, name]);

  const dirty = c.email_body != null && (subject !== personalise(c.email_subject ?? "", name) || body !== personalise(c.email_body ?? "", name));
  const ready = draftReady(c);
  const sent = c.email_status === "sent";
  const to = override ?? c.personal_details.email ?? "no email on CV";
  const flags = [...s.flags, ...s[role].flags].filter((f, i, a) => a.indexOf(f) === i);

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

  const decide = (d: "invite" | "reject" | null) =>
    run("decide", async () => {
      await api(`/api/candidates/${c.id}`, { method: "PATCH", json: { decision_override: d } });
      await api(`/api/candidates/${c.id}/generate`, { method: "POST", json: {} });
    }, d ? `Marked as ${d}; draft written` : "Back to the system's recommendation");

  const save = () => run("save", () => api(`/api/candidates/${c.id}`, { method: "PATCH", json: { email_subject: subject, email_body: body } }), "Draft saved");

  async function send() {
    const note = override ? `\n\nTest mode: it goes to ${override}, not the candidate.` : "";
    if (!confirm(`Send this ${c.email_type} email for ${name} to ${to}?${note}\n\nThis cannot be undone.`)) return;
    await run("send", async () => {
      if (dirty) await api(`/api/candidates/${c.id}`, { method: "PATCH", json: { email_subject: subject, email_body: body } });
      await api(`/api/candidates/${c.id}/send`, { method: "POST" });
    }, `Sent to ${to}`);
  }

  const del = () => {
    if (confirm(`Delete ${name} and all their data?`)) run("del", async () => { await api(`/api/candidates/${c.id}`, { method: "DELETE" }); onClose(); }, "Candidate deleted");
  };

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={name}>
        <div className="drawer-head">
          <div className="row spread" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 6 }}>
              <button className="ghost sm" disabled={index <= 0} onClick={() => onStep(-1)}>‹ Prev</button>
              <button className="ghost sm" disabled={index < 0 || index >= total - 1} onClick={() => onStep(1)}>Next ›</button>
              {index >= 0 && <span className="faint small">{index + 1} of {total} · <span className="kbd">←</span> <span className="kbd">→</span></span>}
            </div>
            <button className="ghost sm" onClick={onClose} aria-label="Close">✕ Close</button>
          </div>
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
        </div>

        <div className="drawer-body">
          {/* Decision + email */}
          <div className="card emph">
            <h3>Decision</h3>
            {sent ? (
              <div className="notice good" style={{ marginBottom: 0 }}>
                <span className="ico">✓</span>
                <span>{c.email_type === "invite" ? "Interview invite" : "Rejection"} sent to {c.sent_to} on {new Date(c.sent_at!).toLocaleString()}.</span>
              </div>
            ) : (
              <>
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

            {(ready || sent || c.email_status === "failed") && (
              <div style={{ marginTop: 14 }}>
                <div className="small muted" style={{ marginBottom: 6 }}>
                  To <strong style={{ color: "var(--text)" }}>{sent ? c.sent_to : to}</strong>
                  {override && !sent && <span className="chip warn" style={{ marginLeft: 6 }}>test inbox</span>}
                </div>
                <input className="wide" value={subject} disabled={sent} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" />
                <textarea rows={11} value={body} disabled={sent} onChange={(e) => setBody(e.target.value)} style={{ marginTop: 8 }} aria-label="Email body" />
                {c.email_error && <div className="notice bad small" style={{ marginTop: 8 }}><span className="ico">!</span><span>{c.email_error}</span></div>}
                {!sent && (
                  <div className="row spread" style={{ marginTop: 10 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <button className="ghost" disabled={!!busy} onClick={() => run("regen", () => api(`/api/candidates/${c.id}/generate`, { method: "POST", json: {} }), "Redrafted")}>
                        {busy === "regen" ? "Drafting…" : "↻ Redraft"}
                      </button>
                      {dirty && <button disabled={!!busy} onClick={save}>{busy === "save" ? "Saving…" : "Save edits"}</button>}
                    </div>
                    <button className="primary" disabled={!!busy || !resend} onClick={send} title={resend ? "" : "Add a Resend API key to enable sending"}>
                      {busy === "send" ? "Sending…" : c.email_type === "invite" ? "Send invite →" : "Send rejection →"}
                    </button>
                  </div>
                )}
              </div>
            )}
            {!ready && !sent && c.email_status !== "failed" && c.decision !== "hold" && (
              <button style={{ marginTop: 12 }} disabled={!!busy} onClick={() => run("regen", () => api(`/api/candidates/${c.id}/generate`, { method: "POST", json: {} }), "Draft written")}>
                {busy === "regen" ? "Drafting…" : `Write ${c.decision} email`}
              </button>
            )}
          </div>

          {/* Brief */}
          <div className="card">
            <h3>Interview brief</h3>
            {c.brief ? (
              <Brief text={personalise(c.brief, name)} />
            ) : (
              <button disabled={!!busy} onClick={() => run("brief", () => api(`/api/candidates/${c.id}/generate`, { method: "POST", json: { only: "brief" } }), "Brief written")}>
                {busy === "brief" ? "Writing…" : "Write brief"}
              </button>
            )}
          </div>

          {/* Scores */}
          <div className="card">
            <div className="row spread" style={{ marginBottom: 10 }}>
              <h3 style={{ margin: 0 }}>Why this score</h3>
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

          {/* Flags */}
          {(flags.length > 0 || s.metrics_to_verify.length > 0) && (
            <div className="card">
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
          )}

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
        </div>
      </aside>
    </>
  );
}

function Unscored({ c, onChange, onToast }: { c: Candidate; onChange: () => Promise<void>; onToast: (t: Toast) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="row spread" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-2)" }}>
      <div className="who">
        <span className="avatar">{initials(c.personal_details.name)}</span>
        <span>
          <div className="name">{c.personal_details.name}</div>
          <div className="meta">{c.applied_role} · {c.source_filename}{c.error ? ` · ${c.error}` : ""}</div>
        </span>
      </div>
      <div className="row" style={{ gap: 6 }}>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/api/candidates/${c.id}/rescore`, { method: "POST" });
              onToast({ text: "Scored" });
              await onChange();
            } catch (e) {
              onToast({ text: (e as Error).message, kind: "bad" });
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Scoring…" : "Retry scoring"}
        </button>
        <button className="ghost danger" onClick={async () => { if (confirm("Delete this upload?")) { await api(`/api/candidates/${c.id}`, { method: "DELETE" }); await onChange(); } }}>
          Delete
        </button>
      </div>
    </div>
  );
}
