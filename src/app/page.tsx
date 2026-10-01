"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, runDraftQueue } from "@/lib/client";
import { ROLE_TITLE, type Band, type BandRules, type Candidate, type RankedCandidate, type Role } from "@/lib/types";
import { BAND_TITLE, DetailBody, DetailHeader, LEVEL, NextStep, flagLabel, initials, type MailMode, type Toast } from "./candidate-detail";

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
  directSend: boolean;
  draftsTo: string | null;
  allowedDomains: string[];
}
type Filter = "all" | Band | "sent";

const BANDS: Band[] = ["shortlist", "borderline", "below"];
const BAND_HINT: Record<Band, string> = {
  shortlist: "Interview invite drafted. Review and send.",
  borderline: "Your call. Pick Invite or Reject.",
  below: "Warm rejection drafted. Review and send.",
};
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
    self: list.filter((c) => c.email_status === "self").length,
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
      {status?.resend && (
        <div className={`notice ${status.directSend ? "good" : "info"} small`}>
          <span className="ico">✉</span>
          <span>
            {status.directSend ? (
              <>Emails go <strong>straight to each candidate</strong> when you click Send.</>
            ) : (
              <>
                <strong>Sending to candidates needs a verified domain in Resend.</strong> Until then, Send puts the draft in{" "}
                <strong>your inbox{status.draftsTo ? ` (${status.draftsTo})` : ""}</strong> with the candidate&apos;s address to forward,
                or use <strong>Open in Gmail</strong> on any candidate.
              </>
            )}{" "}
            · {all.filter((c) => c.email_status === "sent").length} sent · {all.filter((c) => c.email_status === "self").length} waiting in your inbox
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
        {statCard("sent", "Emails sent", stats.self ? `+${stats.self} in your inbox to forward` : "Done", "sent")}
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
          mail={{ resend: status?.resend ?? false, directSend: status?.directSend ?? false, draftsTo: status?.draftsTo ?? null }}
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

function Drawer({
  c, role, index, total, mail, onClose, onStep, onChange, onToast,
}: {
  c: RankedCandidate; role: Role; index: number; total: number; mail: MailMode;
  onClose: () => void; onStep: (d: 1 | -1) => void; onChange: () => Promise<void>; onToast: (t: Toast) => void;
}) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={c.personal_details.name}>
        <div className="drawer-head">
          <div className="row spread" style={{ marginBottom: 10 }}>
            <div className="row" style={{ gap: 6 }}>
              <button className="ghost sm" disabled={index <= 0} onClick={() => onStep(-1)}>‹ Prev</button>
              <button className="ghost sm" disabled={index < 0 || index >= total - 1} onClick={() => onStep(1)}>Next ›</button>
              {index >= 0 && <span className="faint small">{index + 1} of {total} · <span className="kbd">←</span> <span className="kbd">→</span></span>}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <Link href={`/candidates/${c.id}`} target="_blank"><button className="ghost sm">Open page ↗</button></Link>
              <button className="ghost sm" onClick={onClose} aria-label="Close">✕ Close</button>
            </div>
          </div>
          <DetailHeader c={c} role={role} />
        </div>
        <div className="drawer-body">
          <DetailBody c={c} role={role} mail={mail} onChange={onChange} onToast={onToast} onDeleted={() => { onClose(); onChange(); }} />
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
