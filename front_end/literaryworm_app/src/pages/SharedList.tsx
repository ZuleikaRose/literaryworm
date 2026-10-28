import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { SavedBookTile } from "../components/SavedBookTile";
import { fetchSharedList, type SharedList as SharedListData, SharedListError } from "../lib/sharedListApi";
import { useTitle } from "../lib/useTitle";
import { useActiveProfile, useStore } from "../store/context";

type Load =
  | { slug: string; status: "loading" }
  | { slug: string; status: "ready"; list: SharedListData }
  | { slug: string; status: "missing" }
  | { slug: string; status: "error"; message: string };

/**
 * /lists/:slug — a custom list someone shared by link. Public: it shows only the list's name,
 * description, the sharing profile's name and its books. A signed-in Kids profile sees only the
 * titles rated for it.
 */
export default function SharedList() {
  const slug = useParams().slug ?? "";
  const profile = useActiveProfile();
  const { state } = useStore();
  const [load, setLoad] = useState<Load>({ slug, status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const current: Load = load.slug === slug ? load : { slug, status: "loading" };
  useTitle(current.status === "ready" ? current.list.name : "Shared list");

  useEffect(() => {
    let live = true;
    fetchSharedList(slug)
      .then((list) => live && setLoad(list ? { slug, status: "ready", list } : { slug, status: "missing" }))
      .catch(
        (err: unknown) =>
          live &&
          setLoad({
            slug,
            status: "error",
            message: err instanceof SharedListError ? err.message : "We couldn't open this list right now. Try again in a moment.",
          }),
      );
    return () => {
      live = false;
    };
  }, [slug, attempt]);

  const home = state.activeProfileId ? "/browse" : "/";

  if (current.status === "missing" || current.status === "error") {
    const missing = current.status === "missing";
    return (
      <section className="page empty-state">
        <span className="empty-icon">
          <Icon name={missing ? "list" : "alert"} size={28} />
        </span>
        <h1>{missing ? "This list isn't shared" : "We couldn't open this list"}</h1>
        <p>{missing ? "The link may be mistyped, or its owner has stopped sharing it." : current.message}</p>
        <div className="empty-actions">
          {!missing && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setLoad({ slug, status: "loading" });
                setAttempt((a) => a + 1);
              }}
            >
              Try again
            </button>
          )}
          <Link className="primary-button" to={home}>
            Explore LiteraryWorm
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="shared-list-page page-content" aria-busy={current.status === "loading"}>
      <header className="shared-list-header">
        <p className="eyebrow">Shared list</p>
        {current.status === "ready" ? (
          <>
            <h1>{current.list.name}</h1>
            {current.list.description && <p className="shared-list-description">{current.list.description}</p>}
            <p className="shared-list-meta">
              A list by {current.list.owner} · {current.list.items.length} {current.list.items.length === 1 ? "book" : "books"}
            </p>
          </>
        ) : (
          <h1>Opening the list…</h1>
        )}
      </header>
      {current.status === "ready" &&
        (current.list.items.length === 0 ? (
          <div className="library-empty">
            <Icon name="list" size={28} />
            <h2>No books in this list yet</h2>
            <p>Its owner hasn't added any books. Check back later.</p>
          </div>
        ) : (
          <ul className="catalog-grid library-grid" role="list" aria-label={`Books in ${current.list.name}`}>
            {current.list.items.map((id) => (
              <SavedBookTile key={id} bookId={id} ageRating={profile?.ageRating ?? "all"} />
            ))}
          </ul>
        ))}
      {!state.account && current.status === "ready" && (
        <p className="shared-list-cta">
          Read and listen to books like these on LiteraryWorm. <Link to="/plans">See plans</Link>
        </p>
      )}
    </div>
  );
}
