import { useStore } from "../store/context";
import { verifyPassword } from "./accountApi";

/**
 * Returns a checker: resolves true if a value is the signed-in account's password. Real
 * accounts are checked by Supabase; in-memory accounts against the password kept for the session.
 */
export function useCheckAccountPassword() {
  const { state } = useStore();
  return async (value: string): Promise<boolean> => {
    const account = state.account;
    if (!account) return false;
    if (account.userId) return verifyPassword(account.email, value);
    return value === account.password;
  };
}
