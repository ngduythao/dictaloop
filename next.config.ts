import type { NextConfig } from "next";

// The app is a static site. Locally it is served from "/"; GitHub Pages serves a
// project site under "/<repository>", which GitHub Actions exposes as GITHUB_REPOSITORY.
// BASE_PATH overrides both (e.g. BASE_PATH=/dictaloop).
const repository = process.env.GITHUB_REPOSITORY?.split("/")[1];
const basePath = process.env.BASE_PATH ?? (repository && !repository.endsWith(".github.io") ? `/${repository}` : "");

const nextConfig: NextConfig = {
  output: "export",
  assetPrefix: basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
