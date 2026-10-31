import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { QuizResult } from "../types";
import * as accountApi from "./accountApi";

/**
 * The active profile's chapter quiz scores (the latest try per book and chapter). Members save
 * to `quiz_results` first, then update the store; the demo keeps them in memory.
 */
export function useQuizResults() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const results = useProfileData().quizResults;
  const remote = Boolean(state.account?.userId);

  async function record(result: QuizResult) {
    if (!profile) return;
    if (remote) await accountApi.saveQuizResult(profile.id, result);
    const rest = results.filter((r) => !(r.bookId === result.bookId && r.chapterIndex === result.chapterIndex));
    dispatch({ type: "patchProfileData", patch: { quizResults: [result, ...rest] } });
  }

  return {
    results,
    find: (bookId: string, chapterIndex: number) => results.find((r) => r.bookId === bookId && r.chapterIndex === chapterIndex),
    record,
  };
}
