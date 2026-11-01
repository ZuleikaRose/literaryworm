import { useStore } from "../store/context";
import { activeReading } from "../store/reducer";
import type { Highlight } from "../types";
import * as accountApi from "./accountApi";
import { dueHighlights, nextHighlightReview } from "./highlightReview";
import { today } from "./reading";

/**
 * Highlights review (lib/highlightReview.ts): today's due highlights and saving an answer.
 * Members' answers save first (`highlights.review_due`, `review_step`), then show; in-memory
 * accounts change the store straight away, like the rest of the highlights.
 */
export function useHighlightReview() {
  const { state, dispatch } = useStore();
  const remote = Boolean(state.account?.userId);
  const all = activeReading(state).highlights;
  const due = dueHighlights(all, today());

  async function answer(highlight: Highlight, stillMatters: boolean) {
    const next = nextHighlightReview(highlight, stillMatters, today());
    if (remote) await accountApi.reviewHighlight(highlight.id, next);
    dispatch({ type: "updateHighlight", id: highlight.id, patch: next });
  }

  return { due, total: all.length, answer };
}
