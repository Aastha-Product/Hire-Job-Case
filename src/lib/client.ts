"use client";

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export type Task = { id: string; kind: "invite" | "reject" | "brief" };

/**
 * Run the drafting work the server says is missing, one call per candidate so no
 * request outlives the serverless timeout. Retries once on failure.
 */
export async function runDraftQueue(
  onProgress: (done: number, total: number, errors: string[]) => void,
): Promise<string[]> {
  const { tasks } = await api<{ tasks: Task[] }>("/api/reconcile", { method: "POST", json: {} });
  const errors: string[] = [];
  onProgress(0, tasks.length, errors);
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    const body = t.kind === "brief" ? { only: "brief" } : {};
    try {
      await api(`/api/candidates/${t.id}/generate`, { method: "POST", json: body }).catch(async () => {
        await new Promise((r) => setTimeout(r, 3000));
        return api(`/api/candidates/${t.id}/generate`, { method: "POST", json: body });
      });
    } catch (e) {
      errors.push((e as Error).message);
    }
    onProgress(i + 1, tasks.length, errors);
  }
  return errors;
}
