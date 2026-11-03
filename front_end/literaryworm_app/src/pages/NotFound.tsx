import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { useStore } from "../store/context";

export default function NotFound() {
  const t = useT();
  useTitle(t("Page not found"));
  const { state } = useStore();
  const home = state.activeProfileId ? "/browse" : "/";
  return (
    <section className="page empty-state">
      <span className="empty-icon">
        <Icon name="bookOpen" size={28} />
      </span>
      <h1>{t("This page isn't on our shelves")}</h1>
      <p>{t("The link may be old, or the book may have been removed. Try searching, or head back home.")}</p>
      <Link className="primary-button" to={home}>
        {t("Go to home")}
      </Link>
    </section>
  );
}
