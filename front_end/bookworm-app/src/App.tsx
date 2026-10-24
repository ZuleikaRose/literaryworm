import { Route, Routes } from "react-router-dom";
import { AppEffects, ImmersiveLayout, RequireAccount, RequireProfile, SiteLayout } from "./layouts/Layouts";
import Account from "./pages/Account";
import BookDetail from "./pages/BookDetail";
import Browse from "./pages/Browse";
import Landing from "./pages/Landing";
import Legal from "./pages/Legal";
import Library from "./pages/Library";
import NotFound from "./pages/NotFound";
import Plans from "./pages/Plans";
import Player from "./pages/Player";
import Profiles from "./pages/Profiles";
import Reader from "./pages/Reader";
import Search from "./pages/Search";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

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
          <Route path="legal/:slug" element={<Legal />} />
          {/* Visitors can open public-domain titles; actions ask them to sign in. */}
          <Route path="book/:id" element={<BookDetail />} />

          <Route element={<RequireAccount />}>
            <Route path="profiles" element={<Profiles />} />
          </Route>

          <Route element={<RequireProfile />}>
            <Route path="browse" element={<Browse />} />
            <Route path="search" element={<Search />} />
            <Route path="library" element={<Library />} />
            <Route path="account" element={<Account />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>

        <Route element={<RequireProfile />}>
          <Route element={<ImmersiveLayout />}>
            <Route path="read/:id" element={<Reader />} />
            <Route path="listen/:id" element={<Player />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
