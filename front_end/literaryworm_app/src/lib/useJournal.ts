import { useActiveProfile, useProfileData, useStore } from "../store/context";
import { newId } from "../store/state";
import type { JournalEntry } from "../types";
import * as accountApi from "./accountApi";
import { byNewest, JOURNAL_MAX, journalError } from "./journal";
import { today } from "./reading";

/**
 * The active profile's reading journal (lib/journal.ts). Like My words: real accounts save to
 * `journal_entries` first, then update the store, so a failed save changes nothing and rejects
 * with an AccountError; in-memory accounts only update the store.
 */
export function useJournal() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const journal = useProfileData().journal;
  const remote = Boolean(state.account?.userId);
  const set = (next: JournalEntry[]) => dispatch({ type: "patchProfileData", patch: { journal: [...next].sort(byNewest) } });

  const check = (body: string, writtenOn: string) => {
    const problem = journalError(body, writtenOn, today());
    if (problem) throw new accountApi.AccountError(problem);
  };

  async function add(bookId: string, body: string, writtenOn: string) {
    if (!profile) return;
    check(body, writtenOn);
    if (journal.length >= JOURNAL_MAX) throw new accountApi.AccountError("The journal keeps up to 1,000 entries a profile. Delete some to write more.");
    const draft = { id: newId(), bookId, body: body.trim(), writtenOn };
    const now = Date.now();
    const saved = remote ? await accountApi.addJournalEntry(profile.id, draft) : { ...draft, createdAt: now, updatedAt: now };
    set([saved, ...journal]);
  }

  async function update(id: string, body: string, writtenOn: string) {
    check(body, writtenOn);
    const change = { body: body.trim(), writtenOn };
    const saved = remote ? await accountApi.updateJournalEntry(id, change) : undefined;
    set(journal.map((e) => (e.id === id ? (saved ?? { ...e, ...change, updatedAt: Date.now() }) : e)));
  }

  async function remove(id: string) {
    if (remote) await accountApi.deleteJournalEntry(id);
    set(journal.filter((e) => e.id !== id));
  }

  return { journal, add, update, remove };
}
