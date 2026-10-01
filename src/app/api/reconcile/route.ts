import { handle, isRole } from "@/lib/api";
import { reconcile } from "@/lib/pipeline";
import type { Role } from "@/lib/types";

export const runtime = "nodejs";

/** List the drafts that are missing or stale after the ranking changed. Body: {role?: "PM" | "SPM"} */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const roles: Role[] = isRole(body.role) ? [body.role] : ["PM", "SPM"];
    const tasks = (await Promise.all(roles.map((r) => reconcile(r)))).flat();
    // Invites first: they are what Arjun reads first.
    tasks.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "invite" ? -1 : 1));
    return { tasks };
  });
}
