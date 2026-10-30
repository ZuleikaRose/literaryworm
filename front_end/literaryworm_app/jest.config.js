// Unit tests for the app's logic (the .test.ts files in src). Type checking is `tsc -b`'s job
// (tsconfig.test.json); SWC only strips the types.
export default {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["@swc/jest", { jsc: { parser: { syntax: "typescript" }, target: "es2022" }, module: { type: "commonjs" } }],
  },
};
