import { defineConfig } from "vitest/config";

// Tests live in packages/<pkg>/test/, deliberately OUTSIDE each package's
// src/. Every package tsconfig uses `include: ["src"]`, so keeping tests out
// of src is what guarantees they can never be emitted into dist/ and shipped
// to the registry (each package publishes `files: ["dist"]`).
export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts"],
  },
  resolve: {
    // The packages are NodeNext + verbatimModuleSyntax, so their internal
    // imports carry explicit ".js" extensions that point at TypeScript
    // sources. Strip the extension so Vite resolves the real ".ts" file and
    // tests can import source directly, in the repo's own import style.
    alias: [{ find: /^(\.{1,2}\/.*)\.js$/, replacement: "$1" }],
  },
});
