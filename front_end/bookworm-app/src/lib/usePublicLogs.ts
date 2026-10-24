import { useCallback, useEffect, useState } from "react";
import type { ReadingLog } from "../types";
import { fetchPublicLogs, LogsApiError } from "./logsApi";

interface LogsState {
  bookId: string;
  items: ReadingLog[];
  nextPage: number;
  status: "loading" | "idle" | "end" | "error";
  error: string | null;
}

const initial = (bookId: string): LogsState => ({ bookId, items: [], nextPage: 0, status: "loading", error: null });

/** Every reader's logs for a book from Supabase, newest first, a page at a time. */
export function usePublicLogs(bookId: string) {
  const [state, setState] = useState<LogsState>(() => initial(bookId));
  const [requested, setRequested] = useState({ bookId, page: 0, attempt: 0 });

  if (state.bookId !== bookId) {
    setState(initial(bookId));
    setRequested({ bookId, page: 0, attempt: 0 });
  }

  useEffect(() => {
    if (requested.bookId !== bookId) return;
    let current = true;
    const { page } = requested;
    fetchPublicLogs(bookId, page)
      .then((result) => {
        if (!current) return;
        setState((s) => {
          if (s.bookId !== bookId) return s;
          const seen = new Set(s.items.map((l) => l.id));
          return {
            bookId,
            items: page === 0 ? result.items : [...s.items, ...result.items.filter((l) => !seen.has(l.id))],
            nextPage: page + 1,
            status: result.hasMore ? "idle" : "end",
            error: null,
          };
        });
      })
      .catch((err: unknown) => {
        if (!current) return;
        const message = err instanceof LogsApiError ? err.message : "We couldn't load reader logs. Try again.";
        setState((s) => (s.bookId === bookId ? { ...s, status: "error", error: message } : s));
      });
    return () => {
      current = false;
    };
  }, [requested, bookId]);

  const view = state.bookId === bookId ? state : initial(bookId);

  const loadMore = useCallback(() => {
    if (view.status !== "idle") return;
    setState((s) => ({ ...s, status: "loading" }));
    setRequested({ bookId, page: view.nextPage, attempt: 0 });
  }, [view.status, view.nextPage, bookId]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    setRequested((r) => ({ bookId, page: view.nextPage, attempt: r.attempt + 1 }));
  }, [view.nextPage, bookId]);

  /** Start again from the first page (after this reader writes, edits or deletes a log). */
  const reload = useCallback(() => {
    setState((s) => ({ ...s, status: "loading", error: null }));
    setRequested((r) => ({ bookId, page: 0, attempt: r.attempt + 1 }));
  }, [bookId]);

  return { items: view.items, status: view.status, error: view.error, loadMore, retry, reload };
}
