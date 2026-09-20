import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "app/src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@ailexsi/visualz": fileURLToPath(new URL("./src/index.ts", import.meta.url)),
    },
  },
});
