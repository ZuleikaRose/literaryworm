import { startTransition } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/context";

/**
 * Signs out and returns to the landing page. React Router applies navigation in a transition,
 * so the sign-out goes in one too; otherwise the guarded page re-renders first and sends people
 * to /signin instead.
 */
export function useSignOut() {
  const { dispatch } = useStore();
  const navigate = useNavigate();
  return () => {
    navigate("/");
    startTransition(() => dispatch({ type: "signOut" }));
  };
}
