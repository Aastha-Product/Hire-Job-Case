// Validate a rubric file without touching the database.
// Usage: npm run check:rubric -- [path/to/rubric.txt]
import { readFileSync } from "node:fs";
import { parseRubric, rubricVersion } from "../src/lib/rubric";

const path = process.argv[2] ?? "rubric.txt";
const { rubric, errors } = parseRubric(readFileSync(path, "utf8"));
for (const role of ["PM", "SPM"] as const) {
  const list = rubric.criteria[role];
  const sum = list.reduce((s, c) => s + c.weight, 0);
  console.log(`\n${role}: ${list.length} criteria, weights ${sum}%`);
  for (const c of list) {
    console.log(`  ${c.code} ${String(c.weight).padStart(3)}%  ${c.name}`);
    console.log(`           ${c.description.split("\n")[0].slice(0, 100)}`);
  }
  console.log(`  bands: ${JSON.stringify(rubric.rules.bands[role])}`);
  console.log(`  expected years: ${rubric.rules.experience[role].join("-")}`);
}
console.log(`\nversion ${rubricVersion(rubric)}`);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log("rubric OK");
