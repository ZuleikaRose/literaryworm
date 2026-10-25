import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { RatingValue } from "../types";
import * as accountApi from "./accountApi";
import { newShareSlug, withRecentSearch } from "./collections";

/**
 * The active profile's favourites, ratings, custom lists and recent searches. Real accounts
 * save to Supabase first, then update the store, so a failed save changes nothing and rejects
 * with an AccountError for the page to show; in-memory accounts (the demo) only update the
 * store. Recent searches save in the background: losing one is no reason to interrupt a search.
 */
export function useCollections() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const remote = Boolean(state.account?.userId);
  const profileId = profile?.id ?? null;

  async function toggleFavorite(bookId: string) {
    if (!profileId) return;
    if (remote) {
      if (data.favorites.includes(bookId)) await accountApi.removeFavorite(profileId, bookId);
      else await accountApi.addFavorite(profileId, bookId);
    }
    dispatch({ type: "toggleFavorite", bookId });
  }

  /** Sets a rating, or clears it with null. */
  async function rate(bookId: string, rating: RatingValue | null) {
    if (!profileId) return;
    if (remote) await accountApi.setRating(profileId, bookId, rating);
    dispatch({ type: "rateBook", bookId, rating });
  }

  async function createList(name: string, description: string) {
    if (!profileId) return;
    const list = remote ? await accountApi.createList(profileId, name, description, data.customLists.length) : undefined;
    dispatch({ type: "createList", name, description, list });
  }

  async function updateList(id: string, name: string, description: string) {
    if (remote) await accountApi.updateList(id, name, description);
    dispatch({ type: "updateList", id, name, description });
  }

  async function deleteList(id: string) {
    if (remote) await accountApi.deleteList(id);
    dispatch({ type: "deleteList", id });
  }

  /** Moves a list one place up (-1) or down (1). */
  async function moveList(id: string, by: -1 | 1) {
    const ids = data.customLists.map((l) => l.id);
    const from = ids.indexOf(id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    if (remote) await accountApi.setListOrder(ids);
    dispatch({ type: "moveList", id, by });
  }

  async function addToList(id: string, bookId: string) {
    if (remote) await accountApi.addListBook(id, bookId);
    dispatch({ type: "addToList", id, bookId });
  }

  async function removeFromList(id: string, bookId: string) {
    if (remote) await accountApi.removeListBook(id, bookId);
    dispatch({ type: "removeFromList", id, bookId });
  }

  /** Lists can be shared by members only (the demo can't publish anything) and never from Kids profiles. */
  const canShare = remote && profile?.ageRating !== "kids";

  async function shareList(id: string) {
    if (!canShare) return;
    const slug = newShareSlug();
    await accountApi.setListShare(id, slug);
    dispatch({ type: "setListShare", id, shareSlug: slug });
  }

  async function stopSharing(id: string) {
    if (!remote) return;
    await accountApi.setListShare(id, null);
    dispatch({ type: "setListShare", id, shareSlug: null });
  }

  function saveSearches(next: string[]) {
    if (!remote || !profileId) return;
    accountApi.saveRecentSearches(profileId, next).catch(() => {
      // Kept on screen for this visit; the next search tries again.
    });
  }

  function addRecentSearch(q: string) {
    dispatch({ type: "addRecentSearch", q });
    saveSearches(withRecentSearch(data.recentSearches, q));
  }

  function removeRecentSearch(q: string) {
    dispatch({ type: "removeRecentSearch", q });
    saveSearches(data.recentSearches.filter((s) => s !== q));
  }

  function clearRecentSearches() {
    dispatch({ type: "clearRecentSearches" });
    saveSearches([]);
  }

  return {
    favorites: data.favorites,
    ratings: data.ratings,
    lists: data.customLists,
    recentSearches: data.recentSearches,
    remote,
    canShare,
    toggleFavorite,
    rate,
    createList,
    updateList,
    deleteList,
    moveList,
    addToList,
    removeFromList,
    shareList,
    stopSharing,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  };
}
