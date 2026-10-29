import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "../store/context";
import { Icon } from "./Icon";

/** Back to the previous page in the app, or home when the page was opened from a link. */
export function BackLink() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = useStore();
  const home = state.activeProfileId ? "/browse" : "/";
  // Go back when there's somewhere in the app to go back to; otherwise (opened from a link) go home.
  const canGoBack = location.key !== "default";
  return (
    <Link
      className="back-button"
      to={home}
      onClick={(e) => {
        if (!canGoBack) return;
        e.preventDefault();
        navigate(-1);
      }}
    >
      <Icon name="arrowLeft" size={18} /> Back
    </Link>
  );
}
