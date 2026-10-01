import "server-only";
import { GoogleGenAI, type Schema } from "@google/genai";

let ai: GoogleGenAI | null = null;

function client(): GoogleGenAI {
  if (ai) return ai;
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

const MODEL = () => process.env.GEMINI_MODEL || "gemini-3.8-flash";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function retryDelayMs(err: unknown, attempt: number): number | null {
  const msg = String((err as Error)?.message ?? err);
  const status = (err as { status?: number })?.status;
  const retryable = status === 429 || status === 500 || status === 503 || /429|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(msg);
  if (!retryable) return null;
  const hinted = msg.match(/retry(?:Delay)?["\s:]*"?(\d+(?:\.\d+)?)s/i);
  return hinted ? Math.min(parseFloat(hinted[1]) * 1000 + 500, 30_000) : 2_000 * 2 ** attempt;
}

/**
 * One structured-output call. Retries rate limits and overloads, keeping the
 * total wait inside a single serverless invocation (~50 s).
 */
export async function generateJson<T>(opts: {
  system: string;
  prompt: string;
  schema: Schema;
  temperature?: number;
}): Promise<T> {
  let waited = 0;
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await client().models.generateContent({
        model: MODEL(),
        contents: opts.prompt,
        config: {
          systemInstruction: opts.system,
          temperature: opts.temperature ?? 0,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
        },
      });
      const text = res.text;
      if (!text) throw new Error("Gemini returned an empty response");
      return JSON.parse(text) as T;
    } catch (err) {
      const delay = retryDelayMs(err, attempt);
      if (delay === null || attempt >= 4 || waited + delay > 45_000) {
        const msg = String((err as Error)?.message ?? err);
        if (/429|RESOURCE_EXHAUSTED/.test(msg)) throw new Error("Gemini rate limit hit, try again in a minute");
        if (/\b40[13]\b|UNAUTHENTICATED|PERMISSION_DENIED|API_KEY_INVALID|API key not valid/i.test(msg)) {
          throw new Error("Gemini rejected the API key (invalid, expired or revoked). Update GEMINI_API_KEY in Vercel and redeploy, then click Retry scoring.");
        }
        if (/\b404\b|NOT_FOUND|no longer available/i.test(msg)) {
          throw new Error(`Gemini model "${MODEL()}" is not available to this key. Set GEMINI_MODEL to a current Flash model.`);
        }
        throw new Error(`Gemini: ${msg.slice(0, 300)}`);
      }
      waited += delay;
      await sleep(delay);
    }
  }
}
