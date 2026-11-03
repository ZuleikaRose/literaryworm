import { getBook } from "../data/books";
import { wishlistGiftBooks, wishlistGiftPath, wishlistLeftOut } from "../lib/wishlist";
import { GIFT_BOOKS_MAX } from "../lib/gifts";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { SavedBookTile } from "../components/SavedBookTile";
import { fetchSharedList, type SharedList as SharedListData, SharedListError } from "../lib/sharedListApi";
import { useTitle } from "../lib/useTitle";
import { useT } from "../lib/useT";
import { rich } from "../lib/i18n";
import { useActiveProfile, useStore } from "../store/context";

type Load =
  | { slug: string; status: "loading" }
  | { slug: string; status: "ready"; list: SharedListData }
  | { slug: string; status: "missing" }
  | { slug: string; status: "error"; message: string | null };

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
  const t = useT();
  useTitle(current.status === "ready" ? current.list.name : t("Shared list"));

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
            message: err instanceof SharedListError ? err.message : null,
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
        <h1>{missing ? t("This list isn't shared") : t("We couldn't open this list")}</h1>
        <p>
          {missing
            ? t("The link may be mistyped, or its owner has stopped sharing it.")
            : (current.message ?? t("We couldn't open this list right now. Try again in a moment."))}
        </p>
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
              {t("Try again")}
            </button>
          )}
          <Link className="primary-button" to={home}>
            {t("Explore LiteraryWorm")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="shared-list-page page-content" aria-busy={current.status === "loading"}>
      <header className="shared-list-header">
        <p className="eyebrow">{t("Shared list")}</p>
        {current.status === "ready" ? (
          <>
            <h1>{current.list.name}</h1>
            {current.list.description && <p className="shared-list-description">{current.list.description}</p>}
            <p className="shared-list-meta">
              {t.plural(
                current.list.items.length,
                { one: "A list by {owner} · {count} book", other: "A list by {owner} · {count} books" },
                { owner: current.list.owner },
              )}
            </p>
          </>
        ) : (
          <h1>{t("Opening the list…")}</h1>
        )}
      </header>
      {current.status === "ready" &&
        (current.list.items.length === 0 ? (
          <div className="library-empty">
            <Icon name="list" size={28} />
            <h2>{t("No books in this list yet")}</h2>
            <p>{t("Its owner hasn't added any books. Check back later.")}</p>
          </div>
        ) : (
          <ul className="catalog-grid library-grid" role="list" aria-label={t("Books in {name}", { name: current.list.name })}>
            {current.list.items.map((id) => (
              <SavedBookTile key={id} bookId={id} ageRating={profile?.ageRating ?? "all"} />
            ))}
          </ul>
        ))}
      {current.status === "ready" && profile?.ageRating !== "kids" && <GiveWishlist list={current.list} />}
      {!state.account && current.status === "ready" && (
        <p className="shared-list-cta">
          {rich(t("Read and listen to books like these on LiteraryWorm. {link}"), { link: <Link to="/plans">{t("See plans")}</Link> })}
        </p>
      )}
    </div>
  );
}

const inCatalog = (id: string) => Boolean(getBook(id));

/** A shared list is a wishlist too: give its owner a gift membership with its LiteraryWorm books. */
function GiveWishlist({ list }: { list: SharedListData }) {
  const t = useT();
  const books = wishlistGiftBooks(list.items, inCatalog);
  if (books.length === 0) return null;
  const leftOut = wishlistLeftOut(list.items, inCatalog);
  return (
    <section className="goal-card wishlist-gift" aria-labelledby="wishlist-gift-title">
      <h2 id="wishlist-gift-title">
        <Icon name="gift" size={18} /> {t("Give this list as a gift")}
      </h2>
      <p>
        {t("Buy {name} a gift membership that comes with this list's LiteraryWorm books. They get a code to redeem, and the books go into their library.", { name: list.owner })}
      </p>
      {leftOut > 0 && <p className="goal-hint">{t("A gift can come with up to {max} books, so the first {max} are picked. You can change them.", { max: GIFT_BOOKS_MAX })}</p>}
      <Link className="primary-button small-button" to={wishlistGiftPath(books, list.owner)}>
        {t("Choose a gift")}
      </Link>
    </section>
  );
}
