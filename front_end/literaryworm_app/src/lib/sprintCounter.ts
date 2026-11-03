import { useSyncExternalStore } from "react";

/**
 * The sprint this device is reading in, and the pages turned forward in the reader since joining.
 * In memory only (like the rest of the app's state): the count is saved with the sprint when it ends.
 */
export interface SprintCount {
  sprintId: string;
  profileId: string;
  endsAt: number;
  pages: number;
}

let current: SprintCount | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function joinCount(sprintId: string, profileId: string, endsAt: number) {
  if (current?.sprintId === sprintId && current.profileId === profileId) return;
  current = { sprintId, profileId, endsAt, pages: 0 };
  emit();
}

/** One page read forward in the reader: counted while this profile's sprint is running. */
export function countPage(profileId: string | undefined, now = Date.now()) {
  if (!current || current.profileId !== profileId || now >= current.endsAt) return;
  current = { ...current, pages: current.pages + 1 };
  emit();
}

export function clearCount(sprintId?: string) {
  if (!current || (sprintId && current.sprintId !== sprintId)) return;
  current = null;
  emit();
}

export const sprintCount = () => current;

export function useSprintCount(): SprintCount | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => null,
  );
}
