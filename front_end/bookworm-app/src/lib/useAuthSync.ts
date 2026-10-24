import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/context";
import { loadAccount, loadLibrary } from "./accountApi";
import { supabase } from "./supabase";

/**
 * Keeps the app in step with Supabase Auth: restores a member after a refresh, loads the
 * account and library when someone signs in (here or in another tab), clears the app when
 * they sign out, and opens the new-password page from a reset link.
 */
export function useAuthSync() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const accountRef = useRef(state.account);
  // The first auth event after the page loads describes a session restored from storage.
  // (Supabase may send SIGNED_IN before INITIAL_SESSION for it, so the event name alone can't tell.)
  const startup = useRef(true);

  useEffect(() => {
    accountRef.current = state.account;
  });

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const restored = startup.current;
      startup.current = false;
      // Supabase asks that the callback not await its own calls, so the work runs just after it.
      setTimeout(async () => {
        if (event === "PASSWORD_RECOVERY") {
          navigate("/reset-password");
          return;
        }
        if (event === "SIGNED_OUT" || !session) {
          if (accountRef.current?.userId) dispatch({ type: "signOut" });
          else dispatch({ type: "authChecked" });
          return;
        }
        if (event === "INITIAL_SESSION" || event === "SIGNED_IN" || event === "USER_UPDATED") {
          // A repeat for the same member (token refresh, password re-check, the second restore event) changes nothing.
          if (event !== "USER_UPDATED" && accountRef.current?.userId === session.user.id) return;
          try {
            const [account, library] = await Promise.all([loadAccount(), loadLibrary()]);
            if (account) dispatch({ type: "enterAccount", account, library, restored });
            else dispatch({ type: "authChecked" });
          } catch {
            // Offline or the database is unreachable: carry on as a visitor; logging in again retries.
            dispatch({ type: "authChecked" });
          }
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [dispatch, navigate]);
}
