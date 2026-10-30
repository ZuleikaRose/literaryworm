// End-to-end smoke tests (e2e/*.e2e.ts): Jest runs them, the Playwright library drives Chromium
// against the app served by Vite in its own "e2e" mode (no .env files, so no Supabase: the demo
// household and the sample catalog). Run with `npm run test:e2e`.
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/e2e"],
  testMatch: ["**/*.e2e.ts"],
  transform: {
    "^.+\\.ts$": ["@swc/jest", { jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" } }],
  },
  globalSetup: "<rootDir>/e2e/globalSetup.ts",
  globalTeardown: "<rootDir>/e2e/globalTeardown.ts",
  // One browser, one server: run the files one after another.
  maxWorkers: 1,
  testTimeout: 60_000,
};
