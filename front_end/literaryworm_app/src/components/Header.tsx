import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { usesBackend } from "../lib/booksApi";
import { cleanIsbn, searchUrl, unfiltered, type SearchBy } from "../lib/search";
import { tk } from "../lib/i18n";
import { useSignOut } from "../lib/useSignOut";
import { useT } from "../lib/useT";
import { useActiveProfile, useStore } from "../store/context";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { Icon } from "./Icon";
import { NotificationBell } from "./NotificationBell";
import { ProfileMenu } from "./ProfileMenu";

export function Brand({ to }: { to: string }) {
  const t = useT();
  return (
    <Link className="brand" to={to}>
      <span className="brand-mark">
        <Icon name="bookOpen" size={19} />
      </span>
      <strong>
        Literary<span>Worm</span>
      </strong>
      <span className="visually-hidden">{t(", home")}</span>
    </Link>
  );
}

const HEADER_SEARCH: Record<SearchBy, { label: string; placeholder: string }> = {
  title: { label: tk("Title"), placeholder: tk("Search by title") },
  author: { label: tk("Author"), placeholder: tk("Search by author") },
  keywords: { label: tk("Keywords"), placeholder: tk("Search by keywords") },
  isbn: { label: tk("ISBN"), placeholder: tk("Search by ISBN") },
};

function HeaderSearch() {
  const navigate = useNavigate();
  const t = useT();
  const profile = useActiveProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [chosen, setBy] = useState<SearchBy>("title");
  // ISBNs are looked up on Google Books only, so not for Kids profiles or without the backend (as on Search).
  const choices: SearchBy[] =
    usesBackend && profile?.ageRating !== "kids" ? ["title", "author", "keywords", "isbn"] : ["title", "author", "keywords"];
  const by = choices.includes(chosen) ? chosen : "title";
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  // ⌘K / Ctrl+K jumps to search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) navigate(by === "title" ? "/search" : `/search?by=${by}`);
    // The search page explains an ISBN that doesn't add up, so it goes there as typed.
    else navigate(searchUrl(unfiltered(by === "isbn" ? (cleanIsbn(q) ?? q) : q, by)));
  };

  return (
    <form className="search-box" role="search" onSubmit={submit}>
      <Icon name="search" size={19} />
      <label className="visually-hidden" htmlFor="header-search-by">
        {t("Search by")}
      </label>
      <select id="header-search-by" className="search-box-by" value={by} onChange={(e) => setBy(e.target.value as SearchBy)}>
        {choices.map((c) => (
          <option key={c} value={c}>
            {t(HEADER_SEARCH[c].label)}
          </option>
        ))}
      </select>
      <label className="visually-hidden" htmlFor="header-search">
        {t(HEADER_SEARCH[by].placeholder)}
      </label>
      <input
        ref={inputRef}
        id="header-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t(HEADER_SEARCH[by].placeholder)}
        inputMode={by === "isbn" ? "numeric" : undefined}
        autoComplete="off"
      />
      <kbd aria-hidden="true">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
    </form>
  );
}

export function Header() {
  const { state } = useStore();
  const t = useT();
  const profile = useActiveProfile();
  const signOut = useSignOut();
  const isMember = Boolean(state.account && profile);
  const location = useLocation();

  return (
    <header className="topbar">
      <Brand to={isMember ? "/browse" : "/"} />
      {/* The search page has its own, larger box, so the header's steps aside there. */}
      {isMember && location.pathname !== "/search" && <HeaderSearch />}
      <nav className="desktop-nav" aria-label={t("Primary")}>
        {isMember ? (
          <>
            <NavLink to="/browse">{t("Discover")}</NavLink>
            {/* The full Search page (filters, genres, search by author, keywords or ISBN), not just the box. */}
            <NavLink to="/search">{t("Search")}</NavLink>
            <NavLink to="/library">{t("My Library")}</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end>
              {t("Home")}
            </NavLink>
            <NavLink to="/search">{t("Search")}</NavLink>
            <NavLink to="/pricing">{t("Pricing")}</NavLink>
          </>
        )}
      </nav>
      <div className="header-actions">
        {!isMember && (
          <Link className="icon-button header-search-link" to="/search">
            <Icon name="search" size={20} />
            <span className="visually-hidden">{t("Search")}</span>
          </Link>
        )}
        {isMember && <NotificationBell />}
        <AccessibilityMenu />
        {isMember ? (
          <ProfileMenu />
        ) : state.account ? (
          <>
            <button type="button" className="login-button" onClick={signOut}>
              {t("Log out")}
            </button>
            {state.account.planId ? (
              location.pathname !== "/profiles" && (
                <Link className="signup-button" to="/profiles">
                  {t("Choose profile")}
                </Link>
              )
            ) : (
              <Link className="signup-button" to="/pricing?setup=1">
                {t("Finish setup")}
              </Link>
            )}
          </>
        ) : (
          <>
            <Link className="login-button" to="/signin">
              {t("Log in")}
            </Link>
            <Link className="signup-button" to="/signup">
              {t("Sign up")}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
