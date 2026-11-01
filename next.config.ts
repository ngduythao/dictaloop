import type { NextConfig } from "next";

// The app is a static site: `pnpm build` exports it to dist/client.
const nextConfig: NextConfig = {
  output: "export",
};

export default nextConfig;
