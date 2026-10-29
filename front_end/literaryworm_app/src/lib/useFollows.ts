import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { Follow } from "../types";
import * as accountApi from "./accountApi";
import { FOLLOWS_MAX, isFollowing, type PersonKind } from "./people";

/**
 * The authors and narrators the active profile follows. Like favourites, real accounts save to
 * Supabase (`follows`) first, then update the store, so a failed save changes nothing and
 * rejects with an AccountError for the page to show; the demo only updates the store.
 */
export function useFollows() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const remote = Boolean(state.account?.userId);

  async function toggle(kind: PersonKind, name: string) {
    if (!profile) return;
    const follow: Follow = { kind, name };
    const following = isFollowing(data.follows, kind, name);
    if (!following && data.follows.length >= FOLLOWS_MAX) {
      throw new accountApi.AccountError(`A profile can follow up to ${FOLLOWS_MAX} authors and narrators.`);
    }
    if (remote) {
      if (following) await accountApi.unfollow(profile.id, follow);
      else await accountApi.follow(profile.id, follow);
    }
    dispatch({ type: "toggleFollow", follow });
  }

  return {
    follows: data.follows,
    isFollowing: (kind: PersonKind, name: string) => isFollowing(data.follows, kind, name),
    toggle,
  };
}
