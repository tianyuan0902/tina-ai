import path from "node:path";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants.js";

/** @param {string} phase */
const createNextConfig = (phase) => ({
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  outputFileTracingRoot: path.join(process.cwd()),
  webpack(config) {
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      ignored: ["**/node_modules/**", "**/.next/**", "**/.next-dev/**", "**/tina-V4/**"]
    };
    return config;
  }
});

export default createNextConfig;
