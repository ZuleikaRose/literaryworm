import { useSyncExternalStore } from "react";

/**
 * The listen-along session this copy of the app is in, if any: leading it ("host") or
 * following it. The club page sets it; components/ListenAlong.tsx (above the routes) keeps the
 * playback and the session in step, so it carries on while the member browses.
 */
export interface ListenAlongState {
  clubId: string;
  clubName: string;
  bookId: string;
  role: "host" | "follower";
}

let current: ListenAlongState | null = null;
const listeners = new Set<() => void>();

export function setListenAlong(next: ListenAlongState | null): void {
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useListenAlong(): ListenAlongState | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}
