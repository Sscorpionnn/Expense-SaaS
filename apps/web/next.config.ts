import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // This app lives at apps/web inside the pnpm workspace — trace files from
  // the monorepo root so workspace packages (@expense-saas/*) are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
