// Unit tests for the app's logic (the .test.ts files in src). Type checking is `tsc -b`'s job
// (tsconfig.test.json); SWC only strips the types.
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  // lib/backend.ts reads import.meta.env, which CommonJS can't: tests run without Supabase, as e2e does.
  moduleNameMapper: { "^(\\.{1,2}/)+(lib/)?backend$": "<rootDir>/src/lib/backendStub.ts" },
  transform: {
    "^.+\\.ts$": ["@swc/jest", { jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" } }],
  },
};
