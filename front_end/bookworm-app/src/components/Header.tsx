import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useSignOut } from "../lib/useSignOut";
import { useActiveProfile, useStore } from "../store/context";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { Icon } from "./Icon";
import { ProfileMenu } from "./ProfileMenu";

export function Brand({ to }: { to: string }) {
  return (
    <Link className="brand" to={to}>
      <span className="brand-mark">
        <Icon name="bookOpen" size={19} />
      </span>
      <strong>
        Book<span>Worm</span>
      </strong>
      <span className="visually-hidden">, home</span>
    </Link>
  );
}

function HeaderSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
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
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  return (
    <form className="search-box" role="search" onSubmit={submit}>
      <Icon name="search" size={19} />
      <label className="visually-hidden" htmlFor="header-search">
        Search by title
      </label>
      <input
        ref={inputRef}
        id="header-search"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by title"
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
