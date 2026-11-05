import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // "server-only" throws outside React Server Components; unit tests import those modules directly.
    alias: { "server-only": fileURLToPath(new URL("./tests/unit/server-only-stub.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    env: { TZ: "UTC" },
  },
});
