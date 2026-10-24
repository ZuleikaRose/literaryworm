import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useTitle } from "../lib/useTitle";
import { useStore } from "../store/context";

export default function NotFound() {
  useTitle("Page not found");
  const { state } = useStore();
  const home = state.activeProfileId ? "/browse" : "/";
  return (
    <section className="page empty-state">
      <span className="empty-icon">
        <Icon name="bookOpen" size={28} />
      </span>
      <h1>This page isn't on our shelves</h1>
      <p>The link may be old, or the book may have been removed. Try searching, or head back home.</p>
      <Link className="primary-button" to={home}>
        Go to home
      </Link>
    </section>
  );
}
