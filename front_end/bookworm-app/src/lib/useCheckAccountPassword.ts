import { useStore } from "../store/context";
import { AccountError, verifyPassword } from "./accountApi";

/** `ok` when the password is right; `problem` when it couldn't be checked (offline, too many tries). */
export type PasswordCheck = { ok: boolean; problem?: string };

/**
 * Returns a checker for the signed-in account's password. Real accounts are checked by
 * Supabase; in-memory accounts against the password kept for the session. A wrong password
 * is { ok: false }; the caller shows its own message for that.
 */
export function useCheckAccountPassword() {
  const { state } = useStore();
  return async (value: string): Promise<PasswordCheck> => {
    const account = state.account;
    if (!account) return { ok: false };
    if (!account.userId) return { ok: value === account.password };
    try {
      return { ok: await verifyPassword(account.email, value) };
    } catch (err) {
      return { ok: false, problem: err instanceof AccountError ? err.message : "We couldn't check the password. Try again." };
    }
  };
}
