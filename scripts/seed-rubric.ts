// Create the schema (if needed) and load rubric.txt into Neon.
// Usage: npm run seed:rubric -- [path/to/rubric.txt]
// The app also seeds automatically on first use; run this to replace the rubric.
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { parseRubric, rubricVersion } from "../src/lib/rubric";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL (Neon connection string) in .env.local first.");
  process.exit(1);
}

const path = process.argv[2] ?? "rubric.txt";
const { rubric, errors } = parseRubric(readFileSync(path, "utf8"));
if (errors.length) {
  console.error(`${path} is invalid:\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

// Apply db/schema.sql statement by statement (idempotent).
const schema = readFileSync("db/schema.sql", "utf8")
  .replace(/--.*$/gm, "")
  .split(/;\s*(?=(?:[^$]*\$\$[^$]*\$\$)*[^$]*$)/)
  .map((s) => s.trim())
  .filter(Boolean);
for (const stmt of schema) await sql.query(stmt);

const version = rubricVersion(rubric);
const rows = (["PM", "SPM"] as const).flatMap((r) => rubric.criteria[r]);
await sql.transaction([
  sql.query(
    `insert into kargo_hiring.rubric_config (id, raw_text, rules, version, updated_at) values (1, $1, $2::jsonb, $3, now())
     on conflict (id) do update set raw_text = excluded.raw_text, rules = excluded.rules, version = excluded.version, updated_at = now()`,
    [rubric.text, JSON.stringify(rubric.rules), version],
  ),
  sql.query("delete from kargo_hiring.rubric_criteria"),
  ...rows.map((c) =>
    sql.query(
      "insert into kargo_hiring.rubric_criteria (role, position, code, name, description, weight, rubric_version) values ($1,$2,$3,$4,$5,$6,$7)",
      [c.role, c.position, c.code, c.name, c.description, c.weight, version],
    ),
  ),
]);

const check = await sql.query("select role, code, name, weight from kargo_hiring.rubric_criteria order by role, position");
console.log(`Seeded rubric ${version}: ${check.length} rows in kargo_hiring.rubric_criteria`);
for (const r of check) console.log(`  ${String(r.role).padEnd(3)} ${r.code} ${String(r.weight).padStart(3)}%  ${r.name}`);
