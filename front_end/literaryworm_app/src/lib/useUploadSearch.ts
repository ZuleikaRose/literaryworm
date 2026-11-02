import { useCallback, useRef, useState } from "react";
import type { UploadedBook } from "../types";
import { bookText } from "./narration";
import { type ReaderPage, textPages } from "./reading";
import { type KeywordResult, searchPages, uploadDetails } from "./uploadSearch";
import { uploadToBook } from "./uploadBook";

/** Each upload's pages, worked out once this session (memory only, like the rest of the app). */
const pagesCache = new Map<string, Promise<ReaderPage[]>>();

function uploadPages(u: UploadedBook): Promise<ReaderPage[]> {
  let pending = pagesCache.get(u.id);
  if (!pending) {
    pending = bookText(uploadToBook(u)).then(textPages);
    pagesCache.set(u.id, pending);
    // A failure (offline, say) isn't kept, so the next search tries again.
    pending.catch(() => pagesCache.delete(u.id));
  }
  return pending;
}

export interface KeywordSearch {
  q: string;
  status: "searching" | "done";
  /** How many books have been looked through so far. */
  searched: number;
  total: number;
  found: { upload: UploadedBook; result: KeywordResult }[];
  /** Titles whose text couldn't be loaded (offline, or uploaded in another tab of the demo). */
  failed: string[];
}

/**
 * A keyword search through the profile's uploads: each book's text is loaded (from this tab,
 * the device or Storage, as the reader loads it) and searched in the browser, one after another.
 */
export function useUploadSearch() {
  const [search, setSearch] = useState<KeywordSearch | null>(null);
  const run = useRef(0);

  const start = useCallback(async (uploads: UploadedBook[], q: string) => {
    const id = ++run.current;
    let state: KeywordSearch = { q, status: "searching", searched: 0, total: uploads.length, found: [], failed: [] };
    setSearch(state);
    for (const upload of uploads) {
      let result: KeywordResult | null = null;
      let failed = false;
      try {
        result = searchPages(await uploadPages(upload), q, uploadDetails(upload));
      } catch {
        failed = true;
      }
      if (run.current !== id) return;
      state = {
        ...state,
        searched: state.searched + 1,
        found: result ? [...state.found, { upload, result }] : state.found,
        failed: failed ? [...state.failed, upload.title] : state.failed,
      };
      setSearch(state);
    }
    if (run.current === id) setSearch({ ...state, status: "done" });
  }, []);

  const clear = useCallback(() => {
    run.current += 1;
    setSearch(null);
  }, []);

  return { search, start, clear };
}
