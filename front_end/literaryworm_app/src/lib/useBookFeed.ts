import { useCallback, useEffect, useRef, useState } from "react";
import type { AgeRating } from "../types";
import { BooksApiError, type BookSummary, type FeedQuery, feedKey, fetchBookPage } from "./booksApi";
import { nextFeedStep, shouldTopUp } from "./feedChain";

export type FeedStatus = "loading" | "idle" | "error" | "end";

interface FeedState {
  key: string;
  items: BookSummary[];
  /** Which query of the chain is being read (0 is the first), and its next page. */
  step: number;
  /** The chain query the newest books came from (what the list is showing now). */
  loadedStep: number;
  nextPage: number;
  status: FeedStatus;
  error: string | null;
}

const initial = (key: string): FeedState => ({ key, items: [], step: 0, loadedStep: 0, nextPage: 0, status: "loading", error: null });

/**
 * A list that grows a page at a time (Load more or infinite scroll). Changing the query
 * starts over, and answers for an earlier query are ignored. Duplicate ids are dropped.
 * With `then`, the list runs on into those queries in turn when one runs out (members'
 * Home scrolls from one genre into the next, lib/feedChain.ts).
 */
export function useBookFeed(query: FeedQuery, ageRating: AgeRating = "all", then: FeedQuery[] = []) {
  const chain = [query, ...then];
  const key = `${chain.map(feedKey).join(">")}|${ageRating}`;
  const [state, setState] = useState<FeedState>(() => initial(key));
  // `topUps`: pages fetched in a row on the feed's own account because the last ones were thin.
  const [requested, setRequested] = useState({ key, step: 0, page: 0, attempt: 0, topUps: 0 });
  const latestChain = useRef(chain);

  // A new query replaces the list straight away (adjusting state during render).
  if (state.key !== key) {
    setState(initial(key));
    setRequested({ key, step: 0, page: 0, attempt: 0, topUps: 0 });
  }

  useEffect(() => {
    latestChain.current = chain;
  });

  useEffect(() => {
    if (requested.key !== key) return;
    let current = true;
    const { step, page, topUps } = requested;
    const steps = latestChain.current.length;
    fetchBookPage(latestChain.current[step], page, ageRating)
      .then((result) => {
        if (!current) return;
        const after = nextFeedStep(step, page, result.hasMore, steps);
        // A thin page (a genre checked by heading, say) is topped up from the next one straight away.
        const topUp = shouldTopUp(result.items.length, after.done, topUps);
        setState((s) => {
          if (s.key !== key) return s;
          const seen = new Set(s.items.map((b) => b.id));
          const next = nextFeedStep(step, page, result.hasMore, steps);
          const added = result.items.some((b) => !seen.has(b.id));
          return {
            key,
            items: step === 0 && page === 0 ? result.items : [...s.items, ...result.items.filter((b) => !seen.has(b.id))],
            step: next.step,
            loadedStep: added ? step : s.loadedStep,
            nextPage: next.done ? page + 1 : next.page,
            status: next.done ? "end" : topUp ? "loading" : "idle",
            error: null,
          };
        });
        if (topUp) setRequested({ key, step: after.step, page: after.page, attempt: 0, topUps: topUps + 1 });
      })
      .catch((err: unknown) => {
        if (!current) return;
        const message = err instanceof BooksApiError ? err.message : "Something went wrong loading books. Try again.";
        setState((s) => (s.key === key ? { ...s, status: "error", error: message } : s));
      });
    return () => {
      current = false;
    };
  }, [requested, key, ageRating]);

  const { status, nextPage, step } = state.key === key ? state : initial(key);

  // Each request shows "loading" from the moment it's asked for.
  const loadMore = useCallback(() => {
    if (status !== "idle") return;
    setState((s) => (s.key === key ? { ...s, status: "loading", error: null } : s));
    setRequested({ key, step, page: nextPage, attempt: 0, topUps: 0 });
  }, [status, nextPage, step, key]);

  const retry = useCallback(() => {
    setState((s) => (s.key === key ? { ...s, status: "loading", error: null } : s));
    setRequested((r) => ({ key, step, page: nextPage, attempt: r.attempt + 1, topUps: r.topUps }));
  }, [nextPage, step, key]);

  const view = state.key === key ? state : initial(key);
  return { items: view.items, status: view.status, error: view.error, loadMore, retry, loadedStep: view.loadedStep };
}
