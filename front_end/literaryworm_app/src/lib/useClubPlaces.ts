import { useCallback, useEffect, useState } from "react";
import { useStore } from "../store/context";
import type { ClubMember } from "./clubs";
import { type ClubPlace, demoPlaces, PLACES_REFRESH_MS, sortPlaces } from "./clubPlaces";
import * as clubsApi from "./clubsApi";

/** The demo's choice per club, in memory like the rest of the demo. */
const demoSharing = new Map<string, boolean>();

/**
 * Where everyone is in a club's book (lib/clubPlaces.ts), and whether this account shows its own
 * place. Asks again every minute and when the tab comes back.
 */
export function useClubPlaces(clubId: string, members: ClubMember[], me: string | null) {
  const { state } = useStore();
  const remote = Boolean(state.account?.userId);
  const [places, setPlaces] = useState<ClubPlace[] | null>(null);
  const [sharing, setSharing] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = remote ? await clubsApi.fetchClubPlaces(clubId) : demoPlaces(members, me ?? "");
      setPlaces(sortPlaces(next));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load where everyone is.");
    }
  }, [remote, clubId, members, me]);

  useEffect(() => {
    let live = true;
    if (remote) clubsApi.loadSharePlace(clubId).then((on) => live && setSharing(on), () => live && setSharing(false));
    else setSharing(demoSharing.get(clubId) ?? false);
    void refresh();
    const timer = window.setInterval(() => void refresh(), PLACES_REFRESH_MS);
    const onVisible = () => document.visibilityState === "visible" && void refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [remote, clubId, refresh]);

  const setShare = useCallback(
    async (on: boolean) => {
      if (remote) await clubsApi.setSharePlace(clubId, on);
      else demoSharing.set(clubId, on);
      setSharing(on);
      await refresh();
    },
    [remote, clubId, refresh],
  );

  return { places, sharing, error, setShare };
}
