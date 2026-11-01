import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useStore } from "../store/context";
import * as accountApi from "./accountApi";
import { FAMILY_SHELF_MAX, type FamilyShelfItem } from "./familyShelf";

/**
 * The household's family shelf (lib/familyShelf.ts), shared by Home and the book page: loaded once
 * per account, then changed in place. Members save to `family_shelf` first; the demo keeps a
 * sample shelf in memory (two classics its first profile put out), which resets on refresh.
 */

interface Shelf {
  account: string;
  items: FamilyShelfItem[];
  loaded: boolean;
}

let shelf: Shelf = { account: "", items: [], loaded: false };
const listeners = new Set<() => void>();
const emit = (next: Shelf) => {
  shelf = next;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const DEMO_BOOKS = ["the-secret-garden", "pride-and-prejudice"];

export function useFamilyShelf() {
  const { state } = useStore();
  const remote = Boolean(state.account?.userId);
  const account = state.account?.userId ?? (state.profiles.length ? "demo" : "");
  const firstProfile = state.profiles[0]?.id ?? null;
  const current = useSyncExternalStore(subscribe, () => shelf);

  useEffect(() => {
    if (!account || shelf.account === account) return;
    if (!remote) {
      const now = Date.now();
      emit({ account, loaded: true, items: DEMO_BOOKS.map((bookId, i) => ({ bookId, addedBy: firstProfile, addedAt: now - i * 60_000 })) });
      return;
    }
    emit({ account, items: [], loaded: false });
    accountApi
      .loadFamilyShelf()
      .then((items) => shelf.account === account && emit({ account, items, loaded: true }))
      .catch((err: unknown) => {
        console.error("family shelf: couldn't load:", err);
        if (shelf.account === account) emit({ account, items: [], loaded: true });
      });
  }, [account, remote, firstProfile]);

  const items = current.account === account ? current.items : [];
  const has = useCallback((bookId: string) => items.some((i) => i.bookId === bookId), [items]);

  const add = useCallback(
    async (profileId: string, bookId: string) => {
      if (shelf.items.some((i) => i.bookId === bookId)) return;
      if (shelf.items.length >= FAMILY_SHELF_MAX) throw new accountApi.AccountError(`The family shelf holds up to ${FAMILY_SHELF_MAX} books. Take one off first.`);
      if (remote) await accountApi.addToFamilyShelf(profileId, bookId);
      emit({ ...shelf, items: [{ bookId, addedBy: profileId, addedAt: Date.now() }, ...shelf.items] });
    },
    [remote],
  );

  const remove = useCallback(
    async (bookId: string) => {
      if (remote) await accountApi.removeFromFamilyShelf(bookId);
      emit({ ...shelf, items: shelf.items.filter((i) => i.bookId !== bookId) });
    },
    [remote],
  );

  return { items, loaded: current.account === account && current.loaded, has, add, remove };
}
