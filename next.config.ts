import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensures Turbopack resolves `next` from the app root (avoids mis-inference under `src/`).
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
