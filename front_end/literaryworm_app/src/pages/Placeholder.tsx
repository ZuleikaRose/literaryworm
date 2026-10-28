import type { ReactNode } from "react";
import { useTitle } from "../lib/useTitle";

/** Temporary page body for routes built in later phases. */
export function Placeholder({ title, phase, children }: { title: string; phase: number; children?: ReactNode }) {
  useTitle(title);
  return (
    <section className="page placeholder-page">
      <h1>{title}</h1>
      <p className="muted">Built in phase {phase}.</p>
      {children}
    </section>
  );
}
