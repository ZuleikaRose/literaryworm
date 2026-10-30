import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/context";
import { loadAccount, loadCollections, loadLibrary, loadProfiles, loadReading, secondStepNeeded, takeFreshSignIn } from "./accountApi";
import { checkOfflinePlace } from "./offlinePlaces";
import { supabase } from "./supabase";

/**
 * Keeps the app in step with Supabase Auth: restores a member after a refresh, loads the
 * account and library when someone signs in (here or in another tab), clears the app when
 * they sign out, and opens the new-password page from a reset link. A member with two-step
 * sign-in is asked for their code (state.secondStep) before anything of theirs loads.
 */
export function useAuthSync() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const accountRef = useRef(state.account);
  // The member whose account is loading, so two events for one sign-in don't load (or create the
  // first profile) twice.
  const loading = useRef<string | null>(null);

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
        if (["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "MFA_CHALLENGE_VERIFIED"].includes(event)) {
          // A repeat for the same member (token refresh, the second restore event, a code given on Account) changes nothing.
          if (event !== "USER_UPDATED" && accountRef.current?.userId === session.user.id) return;
          if (loading.current === session.user.id) return;
          loading.current = session.user.id;
          try {
            // The database shows nothing of theirs until the code is given; the log-in page asks for it.
            if (await secondStepNeeded()) {
              dispatch({ type: "authChecked", secondStep: true });
              return;
            }
            // A session this tab didn't just sign in to was restored after a refresh (or signed in from another tab).
            const restored = !takeFreshSignIn();
            const [account, library, reading] = await Promise.all([loadAccount(), loadLibrary(), loadReading()]);
            if (!account) {
              dispatch({ type: "authChecked" });
              return;
            }
            const profiles = await loadProfiles(account);
            // After the profiles: a new account's first profile is made by loadProfiles.
            const collections = await loadCollections();
            dispatch({ type: "enterAccount", account, library, reading, profiles, collections, restored });
            // A device whose offline place was freed elsewhere drops its offline books (in the background).
            checkOfflinePlace(session.user.id).catch((err: Error) => console.error("offline: couldn't check this device's place:", err.message));
          } catch {
            // Offline or the database is unreachable: carry on as a visitor and say why; logging in again retries.
            dispatch({
              type: "authChecked",
              error: "We couldn't load your account. Check your connection, then log in again or refresh the page.",
            });
          } finally {
            loading.current = null;
          }
        }
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [dispatch, navigate]);
}
