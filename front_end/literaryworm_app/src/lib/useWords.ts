import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { SavedWord } from "../types";
import * as accountApi from "./accountApi";
import { today } from "./reading";
import { hasWord, nextReview, type WordSource, WORDS_MAX } from "./words";

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

  async function save(word: string, definition: string | null, source: WordSource | null) {
    if (!profile || hasWord(words, word)) return;
    if (words.length >= WORDS_MAX) throw new accountApi.AccountError(`My words keeps up to ${WORDS_MAX} words. Remove some to keep more.`);
    const saved: SavedWord = {
      word,
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

  async function remove(word: string) {
    if (!profile) return;
    if (remote) await accountApi.removeWord(profile.id, word);
    set(words.filter((w) => w.word !== word));
  }

  async function setLearned(word: string, learned: boolean) {
    if (!profile) return;
    if (remote) await accountApi.setWordLearned(profile.id, word, learned);
    set(words.map((w) => (w.word === word ? { ...w, learned } : w)));
  }

  /** A review answer (lib/words.ts nextReview()): saved first for members, like the rest. */
  async function review(word: string, knew: boolean) {
    const w = words.find((x) => x.word === word);
    if (!profile || !w) return;
    const next = nextReview(w, knew, today());
    if (remote) await accountApi.setWordReview(profile.id, word, next);
    set(words.map((x) => (x.word === word ? { ...x, ...next } : x)));
  }

  return { words, has: (word: string) => hasWord(words, word), save, remove, setLearned, review };
}
