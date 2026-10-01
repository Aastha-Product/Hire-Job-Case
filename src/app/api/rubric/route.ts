import { handle, HttpError } from "@/lib/api";
import { getRubric, saveRubric } from "@/lib/db";
import { parseRubric, rubricVersion } from "@/lib/rubric";

export const runtime = "nodejs";

export async function GET() {
  return handle(async () => {
    const rubric = await getRubric();
    return { rubric, version: rubricVersion(rubric) };
  });
}

/** Replace the rubric with pasted text (e.g. the Cowork research output). Body: {text, dryRun?} */
export async function PUT(req: Request) {
  return handle(async () => {
    const { text, dryRun } = await req.json();
    if (typeof text !== "string" || !text.trim()) throw new HttpError(400, "Paste the rubric text");
    const { rubric, errors } = parseRubric(text);
    const version = rubricVersion(rubric);
    if (errors.length || dryRun) return { rubric, errors, version, saved: false };
    await saveRubric(rubric);
    return { rubric, errors, version, saved: true };
  });
}
