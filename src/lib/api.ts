import "server-only";
import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Wrap a route handler so thrown errors come back as JSON the UI can show. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    const message = (e as Error).message || "Unexpected error";
    if (status >= 500) console.error(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export const isRole = (r: unknown): r is "PM" | "SPM" => r === "PM" || r === "SPM";
