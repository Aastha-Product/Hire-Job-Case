import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A package-lock.json in the home folder otherwise confuses root detection.
  turbopack: { root: process.cwd() },
  // rubric.txt is read at runtime to seed an empty rubric table.
  outputFileTracingIncludes: { "/api/**/*": ["./rubric.txt"] },
  serverExternalPackages: ["mammoth", "word-extractor", "cfb"],
};

export default nextConfig;
