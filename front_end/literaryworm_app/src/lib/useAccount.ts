import { startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/context";
import { activeLibrary, activeReading } from "../store/reducer";
import * as accountApi from "./accountApi";
import { AccountError, type MembershipAction } from "./accountApi";
import { cancellationEnd, nextBillingDate } from "./billing";

/**
 * The Account page's changes. Real accounts save to Supabase (membership and deleting go
 * through the manage-account function); in-memory accounts change the store. Each change
 * rejects with an AccountError the page shows beside the control.
 */
export function useAccount() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const account = state.account;
  const userId = account?.userId;

  async function changeMembership(action: MembershipAction) {
    if (!account) return;
    if (userId) {
      dispatch({ type: "updateAccount", patch: await accountApi.changeMembership(action) });
      return;
    }
    const day = account.billingDay ?? 1;
    const patch = {
      pause: { status: "paused" as const },
      resume: { status: "active" as const },
      cancel: { endsAt: cancellationEnd(nextBillingDate(day)).ends.toISOString() },
      restart: { endsAt: null },
    }[action];
    dispatch({ type: "updateAccount", patch });
  }

  async function setDisplayName(name: string) {
    if (userId) await accountApi.setDisplayName(userId, name);
    dispatch({ type: "updateAccount", patch: { name: name.trim() } });
  }

  async function setMarketingEmails(on: boolean) {
    if (userId) await accountApi.setMarketingEmails(userId, on);
    dispatch({ type: "updateAccount", patch: { marketingEmails: on } });
  }

  async function setReleaseEmails(on: boolean) {
    if (userId) await accountApi.setReleaseEmails(userId, on);
    dispatch({ type: "updateAccount", patch: { releaseEmails: on } });
  }

  async function setAuthorEmails(on: boolean) {
    if (userId) await accountApi.setAuthorEmails(userId, on);
    dispatch({ type: "updateAccount", patch: { authorEmails: on } });
  }

  async function changePassword(current: string, next: string) {
    if (!account) return;
    if (userId) {
      await accountApi.changePassword(account.email, current, next);
      return;
    }
    if (current !== account.password) throw new AccountError("Your current password isn't right.");
    dispatch({ type: "updateAccount", patch: { password: next } });
  }

  /** Deletes the account, then leaves for the home page. The demo can't be deleted. */
  async function deleteAccount(password: string) {
    if (!account || account.isDemo) return;
    if (userId) {
      await accountApi.deleteAccount(password);
    } else if (password !== account.password) {
      throw new AccountError("That isn't the account password.");
    }
    // Leave first, as in useSignOut, so the guarded page doesn't send people to /signin.
    navigate("/?deleted=1");
    startTransition(() => dispatch(userId ? { type: "signOut" } : { type: "deleteAccount" }));
    // The user is gone on the server; forget the session here too.
    if (userId) void accountApi.signOut();
  }

  /** Everything LiteraryWorm holds about the account, as a JSON file to save. */
  async function downloadData() {
    if (!account) return;
    const logs = userId
      ? await accountApi.loadMyLogs(userId)
      : state.logs.filter((l) => l.profileId && state.profiles.some((p) => p.id === l.profileId));
    const { password: _password, ...details } = account;
    const reading = activeReading(state);
    const data = {
      exportedAt: new Date().toISOString(),
      account: details,
      profiles: state.profiles.map(({ pin: _pin, ...profile }) => {
        const data = state.profileData[profile.id];
        return {
          ...profile,
          favorites: data?.favorites ?? [],
          ratings: data?.ratings ?? {},
          customLists: data?.customLists ?? [],
          recentSearches: data?.recentSearches ?? [],
          follows: data?.follows ?? [],
          reminders: data?.reminders ?? [],
          newFromFollowedAuthors: (data?.authorNews ?? []).map(({ foundAt, ...n }) => ({ ...n, foundAt: new Date(foundAt).toISOString() })),
          player: data?.player ?? null,
          // What was uploaded (the books' text stays in the app; it's the member's own file).
          uploads: (data?.uploads ?? []).map(({ id, title, author, chapterTitles, words, createdAt }) => ({ id, title, author, chapters: chapterTitles, words, uploadedAt: new Date(createdAt).toISOString() })),
          // Kept on this device for this visit only.
          onThisDevice: data ? { readerSettings: data.readerSettings, narrationVoice: data.narrationVoice, timeUsed: data.timeUsed } : null,
        };
      }),
      library: Object.values(activeLibrary(state)),
      readingProgress: Object.values(reading.progress),
      bookmarks: reading.bookmarks,
      highlights: reading.highlights,
      logs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `literaryworm-data-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return { account, remote: Boolean(userId), changeMembership, setDisplayName, setMarketingEmails, setReleaseEmails, setAuthorEmails, changePassword, deleteAccount, downloadData };
}
