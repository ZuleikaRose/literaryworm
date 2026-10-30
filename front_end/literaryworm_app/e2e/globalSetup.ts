import { spawn } from "node:child_process";
import { BASE_URL, PORT } from "./config";

/**
 * Starts Vite for the run, in "e2e" mode: Vite loads only .env.e2e* files (there are none), so
 * the app has no Supabase settings and runs on its sample catalog and the in-memory demo.
 */
export default async function globalSetup() {
  const server = spawn("npx", ["vite", "--mode", "e2e", "--port", String(PORT), "--strictPort"], {
    cwd: `${__dirname}/..`,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
    env: { ...process.env, VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" },
  });
  let output = "";
  server.stdout?.on("data", (d: Buffer) => (output += d.toString()));
  server.stderr?.on("data", (d: Buffer) => (output += d.toString()));
  (globalThis as { __VITE__?: typeof server }).__VITE__ = server;

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite stopped before it was ready:\n${output}`);
    try {
      if ((await fetch(BASE_URL)).ok) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Vite wasn't ready on ${BASE_URL} after 30 seconds:\n${output}`);
}
