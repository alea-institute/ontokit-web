import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
    include: ["__tests__/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      exclude: [
        // Type-only files (no runtime code)
        "lib/ontology/types.ts",
        "lib/graph/types.ts",
        "lib/git-graph/types.ts",
        // Barrel re-exports
        "lib/editor/index.ts",
        "lib/git-graph/index.ts",
        "lib/context/index.ts",
        "components/editor/index.ts",
        // Web Worker (can't run in jsdom)
        "lib/editor/indexWorker.ts",
        // LSP client (WebSocket + LSP protocol, high mock cost)
        "lib/editor/lsp-client.ts",
        // SVG icon (no logic)
        "components/icons/github.tsx",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
