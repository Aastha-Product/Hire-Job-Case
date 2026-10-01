import { handle } from "@/lib/api";
import { generateDrafts } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Draft the brief + invite or the rejection this candidate needs right now. Body: {only?: "brief"} */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    return { candidate: await generateDrafts((await params).id, body.only === "brief" ? "brief" : undefined) };
  });
}
