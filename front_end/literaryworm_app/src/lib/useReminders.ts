import { useActiveProfile, useProfileData, useStore } from "../store/context";
import type { Reminder } from "../types";
import * as accountApi from "./accountApi";
import { isOut, REMINDERS_MAX } from "./release";

/**
 * The active profile's Remind Me list. Like favourites, real accounts save to Supabase
 * (`release_reminders`) first, then update the store, so a failed save changes nothing and
 * rejects with an AccountError for the page to show; the demo only updates the store.
 */
export function useReminders() {
  const { state, dispatch } = useStore();
  const profile = useActiveProfile();
  const data = useProfileData();
  const remote = Boolean(state.account?.userId);

  async function add(reminder: Reminder) {
    if (!profile) return;
    if (data.reminders.length >= REMINDERS_MAX) {
      throw new accountApi.AccountError(`A profile can have up to ${REMINDERS_MAX} reminders. Remove one first.`);
    }
    if (remote) await accountApi.addReminder(profile.id, reminder);
    dispatch({ type: "addReminder", reminder });
  }

  async function remove(bookId: string) {
    if (!profile) return;
    if (remote) await accountApi.removeReminder(profile.id, bookId);
    dispatch({ type: "removeReminder", bookId });
  }

  return {
    reminders: data.reminders,
    upcoming: data.reminders.filter((r) => !isOut(r.releaseDate)),
    released: data.reminders.filter((r) => isOut(r.releaseDate)),
    has: (bookId: string) => data.reminders.some((r) => r.bookId === bookId),
    /** Whether the account holder also gets an email on the day (members who left it on in Account). */
    emails: remote && Boolean(state.account?.releaseEmails),
    add,
    remove,
  };
}
