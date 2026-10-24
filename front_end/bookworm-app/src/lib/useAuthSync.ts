import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/context";
import { loadAccount, loadLibrary, loadReading, takeFreshSignIn } from "./accountApi";
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

  useEffect(() => {
    accountRef.current = state.account;
  });

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
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
        // Any of these can arrive first for a session restored from storage: Supabase may send
        // SIGNED_IN before INITIAL_SESSION, or TOKEN_REFRESHED first when the saved token has expired.
        if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event)) {
          // A repeat for the same member (token refresh, password re-check, the second restore event) changes nothing.
          if (event !== "USER_UPDATED" && accountRef.current?.userId === session.user.id) return;
          // A session this tab didn't just sign in to was restored after a refresh (or signed in from another tab).
          const restored = !takeFreshSignIn();
          try {
            const [account, library, reading] = await Promise.all([loadAccount(), loadLibrary(), loadReading()]);
            if (account) dispatch({ type: "enterAccount", account, library, reading, restored });
            else dispatch({ type: "authChecked" });
          } catch {
            // Offline or the database is unreachable: carry on as a visitor and say why; logging in again retries.
            dispatch({
              type: "authChecked",
              error: "We couldn't load your account. Check your connection, then log in again or refresh the page.",
            });
          }
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [dispatch, navigate]);
}
