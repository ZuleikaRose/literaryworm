import type { ReactNode } from "react";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";

/** Temporary page body for routes built in later phases. */
export function Placeholder({ title, phase, children }: { title: string; phase: number; children?: ReactNode }) {
  const t = useT();
  useTitle(title);
  return (
    <section className="page placeholder-page">
      <h1>{title}</h1>
      <p className="muted">{t("Built in phase {phase}.", { phase })}</p>
      {children}
    </section>
  );
}
