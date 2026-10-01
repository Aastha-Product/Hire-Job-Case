import { handle } from "@/lib/api";
import { getCandidate } from "@/lib/db";
import { scoreCandidate } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => ({ candidate: await scoreCandidate(await getCandidate((await params).id)) }));
}
