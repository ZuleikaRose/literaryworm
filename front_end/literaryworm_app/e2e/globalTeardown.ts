import type { ChildProcess } from "node:child_process";

/** Stops the Vite server globalSetup started (its whole process group, since npx starts a child). */
export default async function globalTeardown() {
  const server = (globalThis as { __VITE__?: ChildProcess }).__VITE__;
  if (!server?.pid) return;
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}
