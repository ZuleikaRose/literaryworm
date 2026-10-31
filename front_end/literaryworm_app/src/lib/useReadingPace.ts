import { useEffect, useRef } from "react";
import { useActiveProfile, useProfileData, useStore } from "../store/context";
import * as accountApi from "./accountApi";
import { blendPace, pageSample } from "./pace";

/**
 * Learns the active profile's reading pace from the reader: each page turn times the page just
 * read (the clock stops while the tab is hidden). Members' pace saves to `reader_profiles` in the
 * background when the reader closes, so other devices start from it.
 */
export function useReadingPace(pageIndex: number, pageWords: number): number | null {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const wpm = useProfileData().readingWpm;
  const remote = Boolean(state.account?.userId);
  // `since` is set when the first page opens (an effect), so rendering stays pure.
  const page = useRef({ index: pageIndex, words: pageWords, since: 0, hiddenFor: 0, hiddenAt: 0 });
  const latest = useRef({ wpm, profileId: profile?.id, remote, changed: false });
  useEffect(() => {
    latest.current = { ...latest.current, wpm, profileId: profile?.id, remote };
  });
  useEffect(() => {
    if (!page.current.since) page.current.since = Date.now();
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) page.current.hiddenAt = Date.now();
      else if (page.current.hiddenAt) {
        page.current.hiddenFor += Date.now() - page.current.hiddenAt;
        page.current.hiddenAt = 0;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  useEffect(() => {
    const last = page.current;
    if (last.index === pageIndex) return;
    const seconds = (Date.now() - last.since - last.hiddenFor) / 1000;
    // Only reading forwards one page at a time counts: jumps and going back aren't reading.
    const sample = pageIndex === last.index + 1 ? pageSample(last.words, seconds) : null;
    if (sample !== null) {
      dispatch({ type: "patchProfileData", patch: { readingWpm: blendPace(latest.current.wpm, sample) } });
      latest.current.changed = true;
    }
    page.current = { index: pageIndex, words: pageWords, since: Date.now(), hiddenFor: 0, hiddenAt: 0 };
  }, [pageIndex, pageWords, dispatch]);

  useEffect(
    () => () => {
      const { changed, remote: r, profileId, wpm: pace } = latest.current;
      if (changed && r && profileId && pace !== null) {
        accountApi.saveReadingPace(profileId, pace).catch((err: Error) => console.error("reading pace: couldn't save:", err.message));
      }
    },
    [],
  );

  return wpm;
}
