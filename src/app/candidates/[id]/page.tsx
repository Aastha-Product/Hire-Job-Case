"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { ROLE_TITLE, type Candidate, type RankedCandidate, type Role } from "@/lib/types";
import { BAND_TITLE, DetailBody, DetailHeader, NextStep, draftReady, type Toast } from "../../candidate-detail";

type Res = { candidate: RankedCandidate | Candidate; scored: boolean; role: Role; of: number; rubricVersion: string };
type Status = { resend: boolean; directSend: boolean; draftsTo: string | null };

const BAND_EXPLAIN = {
  shortlist: "Clears the shortlist bar. An interview invite is drafted for you to review and send.",
  borderline: "Close to the bar. Your call: pick Invite or Reject and the email is drafted.",
  below: "Below the bar. A warm rejection is drafted for you to review and send.",
};

export default function CandidatePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [res, setRes] = useState<Res | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    try {
      setRes(await api<Res>(`/api/candidates/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
    api<Status>("/api/status").then(setStatus).catch(() => {});
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // Right after an upload the brief/email may still be being written: refresh until they land.
  const c = res?.scored ? (res.candidate as RankedCandidate) : null;
  const waiting = !!c && c.email_status !== "sent" && (c.decision === "hold" ? !c.brief : !draftReady(c) || (c.decision === "invite" && !c.brief));
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(load, 5000);
    const stop = setTimeout(() => clearInterval(t), 120_000);
    return () => { clearInterval(t); clearTimeout(stop); };
  }, [waiting, load]);

  async function retry() {
    setRetrying(true);
    try {
      await api(`/api/candidates/${id}/rescore`, { method: "POST" });
      await api(`/api/candidates/${id}/generate`, { method: "POST", json: {} }).catch(() => {});
      setToast({ text: "Scored" });
      await load();
    } catch (e) {
      setToast({ text: (e as Error).message, kind: "bad" });
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div className="row spread" style={{ marginBottom: 14 }}>
        <Link href="/upload"><button className="ghost">← Upload more CVs</button></Link>
        <Link href="/"><button className="ghost">All candidates →</button></Link>
      </div>

      {error && <div className="notice bad"><span className="ico">!</span><span>{error}</span></div>}
      {!res && !error && <div className="card"><div className="empty">Loading candidate…</div></div>}

      {res && !res.scored && (
        <div className="card">
          <h3>Not scored yet</h3>
          <p style={{ marginTop: 0 }}>
            <strong>{res.candidate.personal_details.name}</strong> <span className="muted">· {res.candidate.source_filename}</span>
          </p>
          {res.candidate.error && <div className="notice bad small"><span className="ico">!</span><span>{res.candidate.error}</span></div>}
          <button className="primary" disabled={retrying} onClick={retry}>{retrying ? "Scoring…" : "Retry scoring"}</button>
        </div>
      )}

      {c && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <DetailHeader c={c} role={res!.role} />
            <div className="row spread" style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-2)" }}>
              <span className="small">
                <strong>#{c.rank} of {res!.of}</strong> in {ROLE_TITLE[res!.role]} · {BAND_TITLE[c.band ?? "below"]}: {BAND_EXPLAIN[c.band ?? "below"]}
              </span>
              <span className="row" style={{ gap: 6 }}>
                {waiting && <span className="faint small">writing drafts…</span>}
                <NextStep c={c} />
              </span>
            </div>
          </div>
          <DetailBody
            c={c}
            role={res!.role}
            focus="score"
            mail={{ resend: status?.resend ?? false, directSend: status?.directSend ?? false, draftsTo: status?.draftsTo ?? null }}
            onChange={load}
            onToast={setToast}
            onDeleted={() => router.push("/")}
          />
        </div>
      )}

      {toast && <div className={`toast ${toast.kind ?? ""}`}>{toast.text}</div>}
    </div>
  );
}
