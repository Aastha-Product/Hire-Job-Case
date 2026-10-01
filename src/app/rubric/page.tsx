"use client";

import { useEffect, useState } from "react";
import { api, runDraftQueue } from "@/lib/client";
import { ROLE_TITLE, type Candidate, type RankedCandidate, type Role, type Rubric } from "@/lib/types";

type RubricRes = { rubric: Rubric; version: string; errors?: string[]; saved?: boolean };

export default function RubricPage() {
  const [current, setCurrent] = useState<RubricRes | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<RubricRes | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);

  async function load() {
    try {
      const r = await api<RubricRes>("/api/rubric");
      setCurrent(r);
      setText(r.rubric.text);
      const d = await api<{ roles: Record<Role, RankedCandidate[]>; unscored: Candidate[] }>("/api/candidates");
      setStale([...d.roles.PM, ...d.roles.SPM].filter((c) => c.rubric_version !== r.version).map((c) => c.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function validate() {
    setError(null);
    try {
      setPreview(await api<RubricRes>("/api/rubric", { method: "PUT", json: { text, dryRun: true } }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    if (!confirm("Replace the live rubric? Existing scores will be marked as scored with an older rubric.")) return;
    try {
      const r = await api<RubricRes>("/api/rubric", { method: "PUT", json: { text } });
      setPreview(r);
      if (r.saved) await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function rescoreAll() {
    const ids = [...stale];
    for (let i = 0; i < ids.length; i++) {
      setProgress(`Re-scoring ${i + 1}/${ids.length}…`);
      await api(`/api/candidates/${ids[i]}/rescore`, { method: "POST" }).catch(() => {});
    }
    await runDraftQueue((d, t) => setProgress(`Redrafting ${d}/${t}…`));
    setProgress("Done");
    await load();
  }

  const shown = preview ?? current;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Rubric</h1>
          <p>
            The scoring standard, built from Kargo's best past hires rather than the job descriptions. Weights and
            decision bands are read from this text, and it is sent word for word to the scoring model.
          </p>
        </div>
      </div>
      {error && <div className="notice bad">{error}</div>}
      {current && (
        <p className="small muted">
          Live version <code>{current.version}</code>
          {stale.length > 0 && (
            <>
              {" "}· {stale.length} candidate(s) scored with an older version{" "}
              <button onClick={rescoreAll} disabled={!!progress && progress !== "Done"}>Re-score them</button>
            </>
          )}
          {progress && <> · {progress}</>}
        </p>
      )}

      {shown && (
        <div className="grid2">
          {(["PM", "SPM"] as Role[]).map((r) => {
            const b = shown.rubric.rules.bands[r];
            return (
              <div key={r} className="panel">
                <h2 style={{ marginTop: 0 }}>{ROLE_TITLE[r]}</h2>
                <table>
                  <tbody>
                    {shown.rubric.criteria[r].map((c) => (
                      <tr key={c.code}>
                        <td><strong>{c.code}</strong></td>
                        <td>{c.name}</td>
                        <td className="num"><strong>{c.weight}%</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="small">
                  <strong>Shortlist:</strong> Fit ≥ {b.shortlistMin}
                  {Object.entries(b.require).map(([k, v]) => `, ${k} ≥ ${v}`).join("")}
                  {b.maxZero != null && `, ≤ ${b.maxZero} zero`} · <strong>Below:</strong> &lt; {b.belowUnder} ·{" "}
                  <strong>Borderline:</strong> everything between · expected {shown.rubric.rules.experience[r].join("–")} yrs
                </p>
              </div>
            );
          })}
        </div>
      )}

      {preview?.errors && preview.errors.length > 0 && (
        <div className="notice bad" style={{ marginTop: 12 }}>
          <strong>Not saved.</strong> {preview.errors.join(" · ")}
        </div>
      )}
      {preview && !preview.errors?.length && !preview.saved && (
        <div className="notice good" style={{ marginTop: 12 }}>Valid rubric (version {preview.version}). Save to make it live.</div>
      )}
      {preview?.saved && <div className="notice good" style={{ marginTop: 12 }}>Saved. Re-score candidates to apply it.</div>}

      <h2>Edit or paste a new rubric</h2>
      <textarea rows={24} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} style={{ fontFamily: "ui-monospace, monospace", fontSize: 12 }} />
      <div className="row" style={{ marginTop: 8 }}>
        <button onClick={validate}>Validate</button>
        <button className="primary" onClick={save} disabled={text === current?.rubric.text}>Save as live rubric</button>
      </div>
    </>
  );
}
