import { useSyncExternalStore } from "react";
import { type LegalPage, legalPages } from "../data/legal";
import { loadLegalPages } from "./legalApi";

/**
 * The footer's legal pages: the built-in copy at once, then the live copy from Supabase once it
 * loads (once a visit, shared by the footer and the page). If it can't load, the built-in copy
 * stays. `replace` puts an admin's saved edit in place straight away.
 */
let current: LegalPage[] = legalPages;
let requested = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    loadLegalPages().then(
      (live) => {
        if (live?.length) {
          current = live;
          notify();
        }
      },
      (err: Error) => console.error("legal pages: couldn't load the live copy, showing the built-in one:", err.message),
    );
  }
  return () => listeners.delete(listener);
}

export function useLegalPages(): LegalPage[] {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}

export function replaceLegalPage(page: LegalPage): void {
  current = current.map((p) => (p.slug === page.slug ? page : p));
  notify();
}
