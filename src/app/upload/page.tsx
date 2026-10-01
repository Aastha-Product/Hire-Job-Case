"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { api, runDraftQueue } from "@/lib/client";
import { nameFromFilename } from "@/lib/pii";
import { ACCEPTED_EXTENSIONS, ACCEPTED_LABEL, isAccepted } from "@/lib/formats";
import { ROLE_TITLE, type Candidate, type Role } from "@/lib/types";

type Row = {
  file: File;
  name: string;
  role: Role | "";
  state: "ready" | "working" | "done" | "error";
  note?: string;
  id?: string; // candidate id once stored
};

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");
// Vercel rejects request bodies over 4.5 MB before they reach the app.
const MAX_BYTES = 4 * 1024 * 1024;

function roleFromFilename(f: string): Role | "" {
  if (/^spm[_\s-]/i.test(f)) return "SPM";
  if (/^pm[_\s-]/i.test(f)) return "PM";
  return "";
}

export default function Upload() {
  const [rows, setRows] = useState<Row[]>([]);
  const [defaultRole, setDefaultRole] = useState<Role | "">("");
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState(2);
  const picker = useRef<HTMLInputElement>(null);

  function add(files: FileList | File[]) {
    const list = [...files];
    const skipped = list.filter((f) => !isAccepted(f.name)).map((f) => f.name);
    const next: Row[] = list
      .filter((f) => isAccepted(f.name))
      .map((file) =>
        file.size > MAX_BYTES
          ? { file, name: nameFromFilename(file.name), role: defaultRole, state: "error", note: `File is ${(file.size / 1048576).toFixed(1)} MB; the limit is 4 MB. Compress or re-save the PDF.` }
          : { file, name: nameFromFilename(file.name), role: roleFromFilename(file.name) || defaultRole, state: "ready" },
      );
    setRows((r) => [...r, ...next]);
    setProblem(skipped.length ? `Skipped ${skipped.join(", ")}: upload a ${ACCEPTED_LABEL} file.` : null);
    if (picker.current) picker.current.value = ""; // allow picking the same file again
  }

  const update = (i: number, patch: Partial<Row>) => setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  function chooseRole(role: Role) {
    setDefaultRole(role);
    setProblem(null);
    setRows((r) => r.map((row) => (row.state !== "done" && row.state !== "working" && !roleFromFilename(row.file.name) ? { ...row, role } : row)));
  }

  const pending = rows.filter((r) => (r.state === "ready" || r.state === "error") && r.file.size <= MAX_BYTES);

  async function start() {
    if (!pending.length) {
      setProblem("Add at least one CV first.");
      return;
    }
    if (pending.some((r) => !r.role)) {
      setProblem("Choose the applied role (Product Manager or Senior Product Manager) in step 1, or set it on each row.");
      return;
    }
    setProblem(null);
    setRunning(true);
    const todo = rows.map((r, i) => ({ r, i })).filter(({ r }) => pending.includes(r));
    let next = 0;
    let done = 0;
    setPhase(`Scoring 0/${todo.length}…`);
    async function worker() {
      while (next < todo.length) {
        const { r, i } = todo[next++];
        update(i, { state: "working", note: "reading, removing personal details, scoring…" });
        const form = new FormData();
        form.set("file", r.file);
        form.set("role", r.role);
        form.set("name", r.name);
        try {
          const res = await api<{ candidate: Candidate; error?: string }>("/api/candidates", { method: "POST", body: form });
          if (res.error) update(i, { state: "error", id: res.candidate.id, note: `Saved, but scoring failed: ${res.error}. Open it to retry.` });
          else {
            const s = res.candidate.score_json!;
            update(i, {
              state: "done",
              id: res.candidate.id,
              note: `PM ${s.PM.total} (${s.PM.band}) · SPM ${s.SPM.total} (${s.SPM.band}) → shown under ${s.routed_role}`,
            });
          }
        } catch (e) {
          const msg = (e as Error).message;
          update(i, { state: "error", note: msg === "HTTP 413" ? "File too large for upload (max 4 MB)." : msg });
        }
        setPhase(`Scoring ${++done}/${todo.length}…`);
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, todo.length) }, worker));
    const errors = await runDraftQueue((d, t) => setPhase(`Writing briefs and emails ${d}/${t}…`));
    setPhase(errors.length ? `Done, with ${errors.length} drafting error(s): ${errors[0]}` : "Done. Open the dashboard to review.");
    setRunning(false);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Upload CVs</h1>
          <p>
            Name, email and phone are split off and stored privately; only the redacted text is scored against both
            rubrics. Nothing is emailed from this page.
          </p>
        </div>
        <Link href="/"><button className="ghost">← Back to candidates</button></Link>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>1. Which role did these candidates apply for?</h3>
        <div className="row">
          {(["PM", "SPM"] as Role[]).map((r) => (
            <button key={r} className={defaultRole === r ? "primary" : ""} onClick={() => chooseRole(r)} disabled={running}>
              {defaultRole === r ? "✓ " : ""}
              {ROLE_TITLE[r]}
            </button>
          ))}
          <span className="muted small">Files named pm_… or spm_… set their own role. You can change any row below.</span>
        </div>

        <h3>2. Add CV files</h3>
        <div
          className={`drop ${over ? "over" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            add(e.dataTransfer.files);
          }}
        >
          <p style={{ margin: "0 0 10px" }}>Drag CV files here: {ACCEPTED_LABEL}</p>
          <button className="primary" onClick={() => picker.current?.click()} disabled={running}>
            Choose files
          </button>
          <input ref={picker} type="file" accept={ACCEPT} multiple style={{ display: "none" }} onChange={(e) => e.target.files && add(e.target.files)} />
          <p className="muted small" style={{ margin: "10px 0 0" }}>Up to 4 MB per file. You can add many at once.</p>
        </div>
      </div>

      {problem && <div className="notice bad" style={{ marginTop: 12 }}>{problem}</div>}

      {rows.length > 0 && (
        <div className="panel scroll-x" style={{ marginTop: 14 }}>
          <h3 style={{ marginTop: 0 }}>3. Check names and roles, then process</h3>
          <table>
            <thead>
              <tr>
                <th>File</th>
                <th>Candidate name (never sent to AI)</th>
                <th>Applied role</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="small">{r.file.name}</td>
                  <td>
                    <input value={r.name} disabled={r.state === "working" || r.state === "done"} onChange={(e) => update(i, { name: e.target.value })} />
                  </td>
                  <td>
                    <select
                      value={r.role}
                      disabled={r.state === "working" || r.state === "done"}
                      onChange={(e) => update(i, { role: e.target.value as Role })}
                      style={!r.role && r.state !== "done" ? { borderColor: "var(--bad)" } : undefined}
                    >
                      <option value="">Choose…</option>
                      <option value="PM">PM</option>
                      <option value="SPM">SPM</option>
                    </select>
                  </td>
                  <td className="small">
                    <span className={`chip ${r.state === "done" ? "good" : r.state === "error" ? "bad" : r.state === "working" ? "warn" : ""}`}>{r.state}</span> {r.note}
                  </td>
                  <td>
                    {r.id && (
                      // While others are still processing, open in a new tab so the queue keeps running.
                      <Link href={`/candidates/${r.id}`} target={running ? "_blank" : undefined}>
                        <button className={r.state === "done" ? "primary sm" : "sm"} style={{ whiteSpace: "nowrap" }}>
                          View candidate →
                        </button>
                      </Link>
                    )}
                    {!r.id && (r.state === "ready" || r.state === "error") && !running && (
                      <button title="Remove" onClick={() => setRows((x) => x.filter((_, j) => j !== i))}>×</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {running && (
            <div className="progress" aria-label="Progress">
              <span style={{ width: `${Math.round((rows.filter((r) => r.state === "done" || r.state === "error").length / Math.max(rows.length, 1)) * 100)}%` }} />
            </div>
          )}
          <div className="row spread" style={{ marginTop: 12 }}>
            <div className="row">
              <button className="primary" disabled={running} onClick={start}>
                {running ? "Working…" : `Process ${pending.length} CV${pending.length === 1 ? "" : "s"}`}
              </button>
              <label className="small muted">
                At a time{" "}
                <select value={concurrency} onChange={(e) => setConcurrency(Number(e.target.value))} disabled={running}>
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="row">
              {phase && <span className="small">{phase}</span>}
              {!running && phase?.startsWith("Done") && <Link href="/"><button className="primary sm">View candidates →</button></Link>}
              <Link href="/">Dashboard →</Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
