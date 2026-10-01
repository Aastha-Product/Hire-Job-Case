import { handle, HttpError, isRole } from "@/lib/api";
import { getRubric, insertCandidate, listCandidates } from "@/lib/db";
import { ACCEPTED_LABEL, isAccepted } from "@/lib/formats";
import { cvToText } from "@/lib/parse";
import { nameFromFilename, splitPersonalDetails } from "@/lib/pii";
import { scoreCandidate } from "@/lib/pipeline";
import { rankRole } from "@/lib/ranking";
import { rubricVersion } from "@/lib/rubric";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  return handle(async () => {
    const [all, rubric] = await Promise.all([listCandidates(), getRubric()]);
    return {
      rubricVersion: rubricVersion(rubric),
      bands: rubric.rules.bands,
      roles: { PM: rankRole(all, "PM"), SPM: rankRole(all, "SPM") },
      unscored: all.filter((c) => c.status !== "scored"),
    };
  });
}

/** Upload one CV: parse -> split PII -> store -> score against both rubrics. */
export async function POST(req: Request) {
  return handle(async () => {
    const form = await req.formData();
    const file = form.get("file");
    const role = form.get("role");
    if (!(file instanceof File)) throw new HttpError(400, "Attach a CV file");
    if (!isRole(role)) throw new HttpError(400, "Select the applied role (PM or SPM)");
    if (!isAccepted(file.name)) {
      throw new HttpError(400, `Unsupported file: ${file.name}. Upload a ${ACCEPTED_LABEL} file.`);
    }
    if (file.size > 10 * 1024 * 1024) throw new HttpError(400, "File is larger than 10 MB");

    const name = String(form.get("name") || "").trim() || nameFromFilename(file.name);
    let text: string;
    try {
      text = await cvToText(Buffer.from(await file.arrayBuffer()), file.name);
    } catch (e) {
      throw new HttpError(422, (e as Error).message);
    }
    const { personal, content } = splitPersonalDetails(text, name);
    const row = await insertCandidate({
      applied_role: role,
      source_filename: file.name,
      personal_details: personal,
      cv_content: content,
      status: "uploaded",
    });
    try {
      return { candidate: await scoreCandidate(row) };
    } catch (e) {
      // Stored but unscored; the dashboard offers a retry.
      return { candidate: { ...row, status: "error", error: (e as Error).message }, error: (e as Error).message };
    }
  });
}
