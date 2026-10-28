import { useEffect, useRef } from "react";
import { useStore } from "../store/context";
import { loadReading } from "./accountApi";

/** Away at least this long before coming back reloads the account's places. */
const AWAY_MS = 15_000;

/**
 * Picks up where the account got to on another device: coming back to the tab (after a while
 * away) or back online reloads progress, bookmarks and highlights from Supabase. Places saved on
 * this device while the reload was on its way are kept. A failed reload changes nothing.
 */
export function useReadingSync() {
  const { state, dispatch } = useStore();
  const signedIn = Boolean(state.account?.userId);

  const hiddenAt = useRef<number | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    const sync = async () => {
      const since = Date.now();
      try {
        const reading = await loadReading();
        if (live) dispatch({ type: "syncReading", reading, since });
      } catch {
        // Offline or the database is busy: the next return to the tab tries again.
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current === null ? 0 : Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (away >= AWAY_MS) void sync();
    };
    const onOnline = () => void sync();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [signedIn, dispatch]);
}
