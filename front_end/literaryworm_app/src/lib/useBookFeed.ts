import { useCallback, useEffect, useRef, useState } from "react";
import type { AgeRating } from "../types";
import { BooksApiError, type BookSummary, type FeedQuery, feedKey, fetchBookPage } from "./booksApi";

export type FeedStatus = "loading" | "idle" | "error" | "end";

interface FeedState {
  key: string;
  items: BookSummary[];
  nextPage: number;
  status: FeedStatus;
  error: string | null;
}

const initial = (key: string): FeedState => ({ key, items: [], nextPage: 0, status: "loading", error: null });

/**
 * A list that grows a page at a time (Load more or infinite scroll). Changing the query
 * starts over, and answers for an earlier query are ignored. Duplicate ids are dropped.
 */
export function useBookFeed(query: FeedQuery, ageRating: AgeRating = "all") {
  const key = `${feedKey(query)}|${ageRating}`;
  const [state, setState] = useState<FeedState>(() => initial(key));
  const [requested, setRequested] = useState({ key, page: 0, attempt: 0 });
  const latestQuery = useRef(query);

  // A new query replaces the list straight away (adjusting state during render).
  if (state.key !== key) {
    setState(initial(key));
    setRequested({ key, page: 0, attempt: 0 });
  }

  useEffect(() => {
    latestQuery.current = query;
  });

  useEffect(() => {
    if (requested.key !== key) return;
    let current = true;
    const { page } = requested;
    fetchBookPage(latestQuery.current, page, ageRating)
      .then((result) => {
        if (!current) return;
        setState((s) => {
          if (s.key !== key) return s;
          const seen = new Set(s.items.map((b) => b.id));
          return {
            key,
            items: page === 0 ? result.items : [...s.items, ...result.items.filter((b) => !seen.has(b.id))],
            nextPage: page + 1,
            status: result.hasMore ? "idle" : "end",
            error: null,
          };
        });
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

  const { status, nextPage } = state.key === key ? state : initial(key);

  // Each request shows "loading" from the moment it's asked for.
  const loadMore = useCallback(() => {
    if (status !== "idle") return;
    setState((s) => (s.key === key ? { ...s, status: "loading", error: null } : s));
    setRequested({ key, page: nextPage, attempt: 0 });
  }, [status, nextPage, key]);

  const retry = useCallback(() => {
    setState((s) => (s.key === key ? { ...s, status: "loading", error: null } : s));
    setRequested((r) => ({ key, page: nextPage, attempt: r.attempt + 1 }));
  }, [nextPage, key]);

  const view = state.key === key ? state : initial(key);
  return { items: view.items, status: view.status, error: view.error, loadMore, retry };
}
