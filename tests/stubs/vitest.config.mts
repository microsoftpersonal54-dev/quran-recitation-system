import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // The real `server-only` package throws outside Next.js.
      // In tests, replace it with a harmless stub.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
  },
});