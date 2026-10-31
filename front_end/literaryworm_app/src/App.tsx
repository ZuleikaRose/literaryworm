import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { AppEffects, ImmersiveLayout, RequireAccount, RequireProfile, SiteLayout } from "./layouts/Layouts";
import { ClubAlerts } from "./components/ClubAlerts";
import { ListenAlong } from "./components/ListenAlong";
import { MediaSession } from "./components/MediaSession";
import Account from "./pages/Account";
import Gifts from "./pages/Gifts";
import BookDetail from "./pages/BookDetail";
import ClubPage from "./pages/Club";
import JoinClub from "./pages/JoinClub";
import Browse from "./pages/Browse";
import Landing from "./pages/Landing";
import Legal from "./pages/Legal";
import Unsubscribe from "./pages/Unsubscribe";
import WhatsNew from "./pages/WhatsNew";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";
import Person from "./pages/Person";
import Series from "./pages/Series";
import ReaderProfile from "./pages/ReaderProfile";
import Plans from "./pages/Plans";
import Profiles from "./pages/Profiles";
import ResetPassword from "./pages/ResetPassword";
import Search from "./pages/Search";
import SharedList from "./pages/SharedList";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

// The reader and player (with their study tools) load when first opened, keeping the first download small.
const Reader = lazy(() => import("./pages/Reader"));
const Player = lazy(() => import("./pages/Player"));
// Staff only, so most members never download it.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Support = lazy(() => import("./pages/Support"));

/** Old /book/:id links keep working. */
function LegacyBookRedirect() {
  return <Navigate to={`/books/${useParams().id ?? ""}`} replace />;
}

export default function App() {
  return (
    <>
      <AppEffects />
      <MediaSession />
      <ClubAlerts />
      <ListenAlong />
      <Routes>
        <Route element={<SiteLayout />}>
          {/* Public */}
          <Route index element={<Landing />} />
          <Route path="plans" element={<Plans />} />
          <Route path="signin" element={<SignIn />} />
          <Route path="signup" element={<SignUp />} />
          <Route path="reset-password" element={<ResetPassword />} />
          <Route path="legal/:slug" element={<Legal />} />
          <Route path="whats-new" element={<WhatsNew />} />
          <Route path="unsubscribe" element={<Unsubscribe />} />
          {/* Book details are public (the brief's /books/:id); actions ask visitors to sign in. */}
          <Route path="books/:id" element={<BookDetail />} />
          <Route path="book/:id" element={<LegacyBookRedirect />} />
          <Route path="authors/:name" element={<Person kind="author" />} />
          <Route path="narrators/:name" element={<Person kind="narrator" />} />
          <Route path="series/:name" element={<Series />} />
          <Route path="readers/:id" element={<ReaderProfile />} />
          {/* Search is public too (the brief); Kids profiles get the catalog only. */}
          <Route path="search" element={<Search />} />
          {/* A custom list shared by link: public, shows only what its owner shared. */}
          <Route path="lists/:slug" element={<SharedList />} />

          <Route element={<RequireAccount />}>
            <Route path="profiles" element={<Profiles />} />
            <Route path="gifts" element={<Gifts />} />
          </Route>

          <Route element={<RequireProfile />}>
            <Route path="browse" element={<Browse />} />
            <Route path="library" element={<Library />} />
            <Route path="clubs/join/:code" element={<JoinClub />} />
            <Route path="clubs/:id" element={<ClubPage />} />
            <Route path="account" element={<Account />} />
            <Route
              path="dashboard"
              element={
                <Suspense fallback={null}>
                  <Dashboard />
                </Suspense>
              }
            />
            <Route
              path="support"
              element={
                <Suspense fallback={null}>
                  <Support />
                </Suspense>
              }
            />
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
