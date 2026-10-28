import { startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/context";
import { signOut as signOutOfSupabase } from "./accountApi";

/**
 * Signs out and returns to the landing page. React Router applies navigation in a transition,
 * so the sign-out goes in one too; otherwise the guarded page re-renders first and sends people
 * to /signin instead.
 */
export function useSignOut() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  return () => {
    navigate("/");
    startTransition(() => dispatch({ type: "signOut" }));
    // Real accounts also end the Supabase session (useAuthSync then sees SIGNED_OUT and has nothing to do).
    if (state.account?.userId) void signOutOfSupabase();
  };
}
