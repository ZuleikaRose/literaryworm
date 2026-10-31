import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { usesBackend } from "../lib/booksApi";
import { cleanIsbn, searchUrl, unfiltered, type SearchBy } from "../lib/search";
import { useSignOut } from "../lib/useSignOut";
import { useActiveProfile, useStore } from "../store/context";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { Icon } from "./Icon";
import { NotificationBell } from "./NotificationBell";
import { ProfileMenu } from "./ProfileMenu";

export function Brand({ to }: { to: string }) {
  return (
    <Link className="brand" to={to}>
      <span className="brand-mark">
        <Icon name="bookOpen" size={19} />
      </span>
      <strong>
        Literary<span>Worm</span>
      </strong>
      <span className="visually-hidden">, home</span>
    </Link>
  );
}

const HEADER_SEARCH: Record<SearchBy, { label: string; placeholder: string }> = {
  title: { label: "Title", placeholder: "Search by title" },
  author: { label: "Author", placeholder: "Search by author" },
  isbn: { label: "ISBN", placeholder: "Search by ISBN" },
};

function HeaderSearch() {
  const navigate = useNavigate();
  const profile = useActiveProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [chosen, setBy] = useState<SearchBy>("title");
  // ISBNs are looked up on Google Books only, so not for Kids profiles or without the backend (as on Search).
  const choices: SearchBy[] = usesBackend && profile?.ageRating !== "kids" ? ["title", "author", "isbn"] : ["title", "author"];
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
        Search by
      </label>
      <select id="header-search-by" className="search-box-by" value={by} onChange={(e) => setBy(e.target.value as SearchBy)}>
        {choices.map((c) => (
          <option key={c} value={c}>
            {HEADER_SEARCH[c].label}
          </option>
        ))}
      </select>
      <label className="visually-hidden" htmlFor="header-search">
        {HEADER_SEARCH[by].placeholder}
      </label>
      <input
        ref={inputRef}
        id="header-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={HEADER_SEARCH[by].placeholder}
        inputMode={by === "isbn" ? "numeric" : undefined}
        autoComplete="off"
      />
      <kbd aria-hidden="true">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
    </form>
  );
}

export function Header() {
  const { state } = useStore();
  const profile = useActiveProfile();
  const signOut = useSignOut();
  const isMember = Boolean(state.account && profile);
  const location = useLocation();

  return (
    <header className="topbar">
      <Brand to={isMember ? "/browse" : "/"} />
      {/* The search page has its own, larger box, so the header's steps aside there. */}
      {isMember && location.pathname !== "/search" && <HeaderSearch />}
      <nav className="desktop-nav" aria-label="Primary">
        {isMember ? (
          <>
            <NavLink to="/browse">Discover</NavLink>
            <NavLink to="/library">My Library</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/" end>
              Home
            </NavLink>
            <NavLink to="/search">Search</NavLink>
            <NavLink to="/plans">Plans</NavLink>
          </>
        )}
      </nav>
      <div className="header-actions">
        {!isMember && (
          <Link className="icon-button header-search-link" to="/search">
            <Icon name="search" size={20} />
            <span className="visually-hidden">Search</span>
          </Link>
        )}
        {isMember && <NotificationBell />}
        <AccessibilityMenu />
        {isMember ? (
          <ProfileMenu />
        ) : state.account ? (
          <>
            <button type="button" className="login-button" onClick={signOut}>
              Log out
            </button>
            {state.account.planId ? (
              location.pathname !== "/profiles" && (
                <Link className="signup-button" to="/profiles">
                  Choose profile
                </Link>
              )
            ) : (
              <Link className="signup-button" to="/plans?setup=1">
                Finish setup
              </Link>
            )}
          </>
        ) : (
          <>
            <Link className="login-button" to="/signin">
              Log in
            </Link>
            <Link className="signup-button" to="/signup">
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
