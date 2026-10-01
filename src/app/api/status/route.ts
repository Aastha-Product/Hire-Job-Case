import { handle } from "@/lib/api";
import { allowedDomains } from "@/lib/email";

export const runtime = "nodejs";

/** Which integrations are configured. Never returns secret values. */
export async function GET() {
  return handle(async () => ({
    database: Boolean(process.env.DATABASE_URL),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    geminiModel: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    resend: Boolean(process.env.RESEND_API_KEY),
    emailOverride: process.env.EMAIL_OVERRIDE_TO || null,
    allowedDomains: allowedDomains(),
  }));
}
