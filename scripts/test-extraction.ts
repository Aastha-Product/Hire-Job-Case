// Offline privacy check: parse every CV, split PII, and report anything that
// would still reach Gemini. Usage: npm run test:extraction -- [folder ...]
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { cvToText, ACCEPTED_EXTENSIONS } from "../src/lib/parse";
import { findLeaks, nameFromFilename, splitPersonalDetails } from "../src/lib/pii";

const folders = process.argv.slice(2);
if (!folders.length) folders.push("../resumes", "../hires");

const verbose = process.env.VERBOSE === "1";
let files = 0;
let failures = 0;

for (const folder of folders) {
  for (const f of readdirSync(folder).sort()) {
    const path = join(folder, f);
    if (!statSync(path).isFile() || !ACCEPTED_EXTENSIONS.some((e) => f.toLowerCase().endsWith(e))) continue;
    files++;
    const name = nameFromFilename(f);
    try {
      const text = await cvToText(readFileSync(path), f);
      const { personal, content } = splitPersonalDetails(text, name);
      const leaks = findLeaks(content, personal);
      const missing = [!personal.email && "email", !personal.phone && "phone"].filter(Boolean);
      const flag = leaks.length ? "LEAK" : missing.length ? "WARN" : "ok  ";
      if (leaks.length) failures++;
      console.log(
        `${flag} ${f.padEnd(38)} name="${name}" email=${personal.email ?? "-"} phone=${personal.phone ?? "-"}` +
          (leaks.length ? `  leaks: ${leaks.join(", ")}` : "") +
          (missing.length ? `  missing: ${missing.join(", ")}` : ""),
      );
      if (verbose) console.log(content.slice(0, 600).replace(/^/gm, "     | "));
    } catch (e) {
      failures++;
      console.log(`ERR  ${f}: ${(e as Error).message}`);
    }
  }
}
console.log(`\n${files} files, ${failures} with leaks or errors`);
process.exit(failures ? 1 : 0);
