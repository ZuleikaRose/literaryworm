import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { TabBar } from "../components/TabBar";
import { useActiveProfile, useStore } from "../store/context";

/** Applies accessibility settings to <html> and resets scroll on navigation. */
export function AppEffects() {
  const { state } = useStore();
  const { pathname } = useLocation();
  const { a11y } = state;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--text-scale", String(a11y.textScale));
    root.dataset.theme = a11y.theme;
    root.toggleAttribute("data-readable-font", a11y.readableFont);
    root.toggleAttribute("data-high-contrast", a11y.highContrast);
    root.toggleAttribute("data-reduce-motion", a11y.reduceMotion);
    root.toggleAttribute("data-underline-links", a11y.underlineLinks);
  }, [a11y]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

/** Header, page and footer. Members also get the phone tab bar. */
export function SiteLayout() {
  const { state } = useStore();
  const profile = useActiveProfile();
  return (
    <div className={`app${state.account && profile ? " has-tab-bar" : ""}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
      {state.account && profile && <TabBar />}
    </div>
  );
}

/** Full-screen reader and player: no site chrome. */
export function ImmersiveLayout() {
  return (
    <div className="immersive">
      <Outlet />
    </div>
  );
}

/** Signed-in only. Sends visitors to sign in, then back here. */
export function RequireAccount() {
  const { state } = useStore();
  const location = useLocation();
  if (!state.account) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Needs a chosen profile. Sends members to Who's reading? first. */
export function RequireProfile() {
  const { state } = useStore();
  const location = useLocation();
  if (!state.account) return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  if (!state.activeProfileId) return <Navigate to="/profiles" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
