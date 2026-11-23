import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { SavedWord } from "../types";
import * as accountApi from "./accountApi";
import { today } from "./reading";
import { hasWord, isSameWord, nextReview, type WordSource, WORDS_MAX } from "./words";

/**
 * My words for the active profile. Like favourites: real accounts save to Supabase
 * (`saved_words`) first, then update the store, so a failed save changes nothing and rejects
 * with an AccountError; the demo only updates the store.
 */
export function useWords() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const remote = Boolean(state.account?.userId);
  const words = data.words;

  const set = (next: SavedWord[]) => dispatch({ type: "patchProfileData", patch: { words: next } });

  async function save(word: string, definition: string | null, source: WordSource | null, language = "en") {
    if (!profile || hasWord(words, word, language)) return;
    if (words.length >= WORDS_MAX) throw new accountApi.AccountError(`My words keeps up to ${WORDS_MAX} words. Remove some to keep more.`);
    const saved: SavedWord = {
      word,
      language,
      definition,
      bookId: source?.bookId ?? null,
      chapterIndex: source?.chapterIndex ?? null,
      page: source?.page ?? null,
      context: source?.context ?? null,
      learned: false,
      reviewDue: null,
      reviewStep: 0,
      createdAt: Date.now(),
    };
    if (remote) await accountApi.saveWord(profile.id, saved);
    set([saved, ...words]);
  }

  async function remove(word: string, language = "en") {
    if (!profile) return;
    if (remote) await accountApi.removeWord(profile.id, word, language);
    set(words.filter((w) => !isSameWord(w, word, language)));
  }

  async function setLearned(word: string, learned: boolean, language = "en") {
    if (!profile) return;
    if (remote) await accountApi.setWordLearned(profile.id, word, learned, language);
    set(words.map((w) => (isSameWord(w, word, language) ? { ...w, learned } : w)));
  }

  /** A review answer (lib/words.ts nextReview()): saved first for members, like the rest. */
  async function review(word: string, knew: boolean, language = "en") {
    const w = words.find((x) => isSameWord(x, word, language));
    if (!profile || !w) return;
    const next = nextReview(w, knew, today());
    if (remote) await accountApi.setWordReview(profile.id, word, next, language);
    set(words.map((x) => (isSameWord(x, word, language) ? { ...x, ...next } : x)));
  }

  return { words, has: (word: string, language = "en") => hasWord(words, word, language), save, remove, setLearned, review };
}
