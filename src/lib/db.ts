import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { parseRubric, rubricVersion } from "./rubric";
import type { Candidate, Role, Rubric } from "./types";

// Neon Postgres over HTTP. All tables live in the kargo_hiring schema.
const T = {
  config: "kargo_hiring.rubric_config",
  criteria: "kargo_hiring.rubric_criteria",
  candidates: "kargo_hiring.candidates",
};

let client: NeonQueryFunction<false, false> | null = null;

function sql(): NeonQueryFunction<false, false> {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL must be set in .env.local (Neon connection string)");
  client = neon(url);
  return client;
}

async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  try {
    return (await sql().query(text, params)) as T[];
  } catch (e) {
    throw new Error(`Database: ${(e as Error).message}`);
  }
}

const JSON_COLUMNS = new Set(["personal_details", "score_json"]);
const TIME_COLUMNS = ["created_at", "updated_at", "sent_at"] as const;

function toCandidate(row: Record<string, unknown>): Candidate {
  for (const k of TIME_COLUMNS) {
    const v = row[k];
    if (v instanceof Date) row[k] = v.toISOString();
  }
  return row as unknown as Candidate;
}

/** Store the rubric text (source of truth) and one rubric_criteria row per criterion per role. */
export async function saveRubric(rubric: Rubric): Promise<void> {
  const version = rubricVersion(rubric);
  const rows = (["PM", "SPM"] as Role[]).flatMap((r) => rubric.criteria[r]);
  const s = sql();
  await s.transaction([
    s.query(
      `insert into ${T.config} (id, raw_text, rules, version, updated_at) values (1, $1, $2::jsonb, $3, now())
       on conflict (id) do update set raw_text = excluded.raw_text, rules = excluded.rules, version = excluded.version, updated_at = now()`,
      [rubric.text, JSON.stringify(rubric.rules), version],
    ),
    s.query(`delete from ${T.criteria}`),
    ...rows.map((c) =>
      s.query(
        `insert into ${T.criteria} (role, position, code, name, description, weight, rubric_version) values ($1,$2,$3,$4,$5,$6,$7)`,
        [c.role, c.position, c.code, c.name, c.description, c.weight, version],
      ),
    ),
  ]);
}

let cached: { text: string; rubric: Rubric } | null = null;

/** Loads the rubric; seeds it from the bundled rubric.txt the first time. */
export async function getRubric(): Promise<Rubric> {
  const [row] = await q<{ raw_text: string }>(`select raw_text from ${T.config} where id = 1`);
  let text = row?.raw_text;
  if (!text) {
    text = await readFile(join(process.cwd(), "rubric.txt"), "utf8");
    const { rubric, errors } = parseRubric(text);
    if (errors.length) throw new Error(`rubric.txt is invalid: ${errors.join("; ")}`);
    await saveRubric(rubric);
  }
  if (cached?.text === text) return cached.rubric;
  const { rubric } = parseRubric(text);
  cached = { text, rubric };
  return rubric;
}

export async function listCandidates(): Promise<Candidate[]> {
  return (await q(`select * from ${T.candidates} order by created_at asc`)).map(toCandidate);
}

export async function getCandidate(id: string): Promise<Candidate> {
  const [row] = await q(`select * from ${T.candidates} where id = $1`, [id]);
  if (!row) throw new Error("Candidate not found");
  return toCandidate(row);
}

const COLUMN_RE = /^[a-z_]+$/;

function assignments(values: Partial<Candidate>, offset = 0) {
  const keys = Object.keys(values).filter((k) => (values as Record<string, unknown>)[k] !== undefined);
  for (const k of keys) if (!COLUMN_RE.test(k)) throw new Error(`Bad column ${k}`);
  const params = keys.map((k) => {
    const v = (values as Record<string, unknown>)[k];
    return JSON_COLUMNS.has(k) && v != null ? JSON.stringify(v) : v;
  });
  const placeholders = keys.map((k, i) => `$${i + 1 + offset}${JSON_COLUMNS.has(k) ? "::jsonb" : ""}`);
  return { keys, params, placeholders };
}

export async function insertCandidate(values: Partial<Candidate>): Promise<Candidate> {
  const { keys, params, placeholders } = assignments(values);
  const [row] = await q(
    `insert into ${T.candidates} (${keys.join(", ")}) values (${placeholders.join(", ")}) returning *`,
    params,
  );
  return toCandidate(row);
}

export async function updateCandidate(id: string, values: Partial<Candidate>): Promise<Candidate> {
  const { keys, params, placeholders } = assignments(values, 1);
  if (!keys.length) return getCandidate(id);
  const set = keys.map((k, i) => `${k} = ${placeholders[i]}`).join(", ");
  const [row] = await q(`update ${T.candidates} set ${set} where id = $1 returning *`, [id, ...params]);
  if (!row) throw new Error("Candidate not found");
  return toCandidate(row);
}

export async function deleteCandidate(id: string): Promise<void> {
  await q(`delete from ${T.candidates} where id = $1`, [id]);
}
