import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppEffects, ImmersiveLayout, RequireAccount, RequireProfile, SiteLayout } from "./layouts/Layouts";
import Account from "./pages/Account";
import BookDetail from "./pages/BookDetail";
import Browse from "./pages/Browse";
import Landing from "./pages/Landing";
import Legal from "./pages/Legal";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";
import Plans from "./pages/Plans";
import Profiles from "./pages/Profiles";
import ResetPassword from "./pages/ResetPassword";
import Search from "./pages/Search";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

// The reader and player (with their study tools) load when first opened, keeping the first download small.
const Reader = lazy(() => import("./pages/Reader"));
const Player = lazy(() => import("./pages/Player"));

/** Old /book/:id links keep working. */
function LegacyBookRedirect() {
  return <Navigate to={`/books/${useParams().id ?? ""}`} replace />;
}

export default function App() {
  return (
    <>
      <AppEffects />
      <Routes>
        <Route element={<SiteLayout />}>
          {/* Public */}
          <Route index element={<Landing />} />
          <Route path="plans" element={<Plans />} />
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="legal/:slug" element={<Legal />} />
          {/* Book details are public (the brief's /books/:id); actions ask visitors to sign in. */}
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="book/:id" element={<LegacyBookRedirect />} />
          {/* Search is public too (the brief); Kids profiles get the catalog only. */}
          <Route path="search" element={<Search />} />

          <Route element={<RequireAccount />}>
            <Route path="profiles" element={<Profiles />} />
          </Route>

          <Route element={<RequireProfile />}>
            <Route path="browse" element={<Browse />} />
            <Route path="library" element={<Library />} />
            <Route path="account" element={<Account />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<RequireProfile />}>
          <Route element={<ImmersiveLayout />}>
            <Route
              path="read/:id"
              element={
                <Suspense fallback={<div className="immersive" aria-busy="true" />}>
                  <Reader />
                </Suspense>
              }
            />
            <Route
              path="listen/:id"
              element={
                <Suspense fallback={<div className="immersive" aria-busy="true" />}>
                  <Player />
                </Suspense>
              }
            />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
