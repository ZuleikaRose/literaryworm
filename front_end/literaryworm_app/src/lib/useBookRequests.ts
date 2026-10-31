import { useStore } from "../store/context";
import type { BookRequest, Profile } from "../types";
import * as accountApi from "./accountApi";
import { REQUESTS_MAX, requestFor } from "./bookRequests";
import { useCheckAccountPassword } from "./useCheckAccountPassword";

/**
 * Book requests (lib/bookRequests.ts). A Kids profile asks; real accounts save to
 * `book_requests` first, then update the store. A grown-up's answer re-checks the account
 * password: members' through the manage-profile function, the demo's against its password.
 */
export function useBookRequests() {
  const { state, dispatch } = useStore();
  const remote = Boolean(state.account?.userId);
  const checkPassword = useCheckAccountPassword();

  const requestsOf = (profileId: string) => state.profileData[profileId]?.bookRequests ?? [];
  const set = (profileId: string, next: BookRequest[]) => dispatch({ type: "patchProfileData", profileId, patch: { bookRequests: next } });

  /** The profile asks for a book (asking again changes nothing). */
  async function ask(profile: Profile, bookId: string) {
    const mine = requestsOf(profile.id);
    if (requestFor(mine, bookId)) return;
    if (mine.length >= REQUESTS_MAX) {
      throw new accountApi.AccountError(`This profile has asked for ${REQUESTS_MAX} books. A grown-up can clear some in Account → Family.`);
    }
    if (remote) await accountApi.requestBook(profile.id, bookId);
    set(profile.id, [{ bookId, status: "pending", createdAt: Date.now(), answeredAt: null }, ...mine]);
  }

  /** Withdraws a request, or takes back an answer, so the book closes again. */
  async function remove(profile: Profile, bookId: string) {
    if (remote) await accountApi.removeBookRequest(profile.id, bookId);
    set(profile.id, requestsOf(profile.id).filter((r) => r.bookId !== bookId));
  }

  /** A grown-up says yes or no; the account password is checked first. */
  async function answer(profile: Profile, bookId: string, approve: boolean, password: string) {
    if (remote) {
      await accountApi.changeProtectedProfile({ action: "answer_request", profileId: profile.id, bookId, approve }, password);
    } else {
      const check = await checkPassword(password);
      if (!check.ok) throw new accountApi.AccountError(check.problem ?? "That password isn't right.");
    }
    const at = Date.now();
    set(
      profile.id,
      requestsOf(profile.id).map((r) => (r.bookId === bookId ? { ...r, status: approve ? "approved" : "declined", answeredAt: at } : r)),
    );
  }

  return { requestsOf, ask, remove, answer };
}
