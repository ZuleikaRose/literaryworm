import type { ClubPostEvent } from "./clubs";

/**
 * New club posts heard while the app is open (components/ClubAlerts.tsx listens to Supabase
 * Realtime once and passes each post on here), so the club page can add it to the discussion
 * and the club list can update its counts without listening again.
 */
const listeners = new Set<(event: ClubPostEvent) => void>();

export function onClubPost(listener: (event: ClubPostEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitClubPost(event: ClubPostEvent): void {
  listeners.forEach((l) => l(event));
}
