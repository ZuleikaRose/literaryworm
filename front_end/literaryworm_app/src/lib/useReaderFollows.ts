import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";

/** The same limit as the database. */
export const READER_FOLLOWS_MAX = 200;

/**
 * Readers the active profile follows (members who turned their reader page on). Members only:
 * saved to `reader_follows` first, then the store. Not for Kids profiles or the demo.
 */
export function useReaderFollows() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const follows = useProfileData().readerFollows;
  const available = Boolean(state.account?.userId) && profile?.ageRating !== "kids";

  async function toggle(readerId: string, name: string) {
    if (!profile || !available) return;
    const following = follows.some((f) => f.readerId === readerId);
    if (!following && follows.length >= READER_FOLLOWS_MAX) throw new accountApi.AccountError(`A profile can follow up to ${READER_FOLLOWS_MAX} readers.`);
    if (following) await accountApi.unfollowReader(profile.id, readerId);
    else await accountApi.followReader(profile.id, readerId);
    dispatch({
      type: "patchProfileData",
      patch: { readerFollows: following ? follows.filter((f) => f.readerId !== readerId) : [...follows, { readerId, name }] },
    });
  }

  return {
    available,
    follows,
    isFollowing: (readerId: string) => follows.some((f) => f.readerId === readerId),
    /** The signed-in account itself: nobody follows themselves. */
    isSelf: (readerId: string) => state.account?.userId === readerId,
    toggle,
  };
}
