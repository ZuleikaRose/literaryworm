import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";
import { addToQueue, moveInQueue, nextQueued, removeFromQueue, UP_NEXT_MAX } from "./upNext";

/**
 * Up next for the active profile. Members save the queue to `reader_profiles.up_next` first,
 * then update the store (a failed save changes nothing and rejects with an AccountError); the
 * demo keeps it in memory.
 */
export function useUpNext() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const queue = useProfileData().upNext;
  const remote = Boolean(state.account?.userId);

  async function set(next: string[]) {
    if (!profile || next === queue) return;
    if (remote) await accountApi.saveUpNext(profile.id, next);
    dispatch({ type: "patchProfileData", patch: { upNext: next } });
  }

  return {
    queue,
    has: (bookId: string) => queue.includes(bookId),
    full: queue.length >= UP_NEXT_MAX,
    next: (playingId?: string) => (profile ? nextQueued(queue, profile.ageRating, playingId) : undefined),
    add: (bookId: string) => set(addToQueue(queue, bookId)),
    remove: (bookId: string) => set(removeFromQueue(queue, bookId)),
    move: (bookId: string, by: -1 | 1) => set(moveInQueue(queue, bookId, by)),
  };
}
