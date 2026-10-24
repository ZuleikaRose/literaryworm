# BookWorm (front end)

A single-page app for reading ebooks and listening to audiobooks, built from the Figma wireframe in
`../BookWorm_web_app_wireframe` and the blueprint in `../user_journey.md` and `../../user_stories.md`.

- **Stack:** React 19, TypeScript (strict), Vite, React Router DOM (`BrowserRouter`, declarative routes).
- **Data:** members' accounts, household profiles, libraries, logs, reading progress, bookmarks and highlights are saved in
  Supabase, and the session is kept so a member stays signed in. Everything else (and the whole demo household)
  lives in memory (React Context + `useReducer`), so **a refresh resets it**. Book lists come from the `books` Supabase Edge Function (`src/lib/booksApi.ts`),
  which is the only thing that talks to Google Books. Without `VITE_SUPABASE_URL` set, the sample catalog is used.
- **Environment:** copy `../../.env.example` to `.env.development.local` and fill in the Supabase URL and
  publishable key (both public). Never put a secret in a `VITE_` variable.
- **Catalog:** 29 sample titles in `src/data/books.ts`. Covers are drawn in CSS. Narrator names, sample logs and
  synopses are sample content. Other titles are Google Books volumes from the `books` Edge Function; their
  public reader logs come from Supabase (`src/lib/logsApi.ts`).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and production build
npm run lint
```

Use **Try the demo** on the sign-in page to get a household with three profiles: Avery (All), Sam (Teen) and Mia (Kids).

## Routes

| Route | Page | Access |
| --- | --- | --- |
| `/`, `/?genre=…` | Landing: technology row and the infinite genre feed | Public |
| `/plans` | Plans and pricing | Public |
| `/signin`, `/signup` | Log in, sign up (Supabase Auth), demo (in memory) | Public |
| `/reset-password` | Choose a new password from an emailed reset link | Reset link |
| `/legal/:slug` | Policies and help | Public |
| `/books/:id` | Book details (catalog id or Google Books volume id); `/book/:id` redirects | Public (actions need a profile) |
| `/profiles` | Who's reading? | Signed in |
| `/browse`, `/browse?genre=…` | Home: carousel, rows, infinite genre feed | Profile chosen |
| `/search` | Title search with filters (`?q=&genre=&sort=&source=`) | Public (Kids profiles: catalog only) |
| `/library` | My library (`?status=`), Favorites (`?view=favorites`), custom lists (`?view=lists`) | Profile chosen |
| `/account` | Plan and billing, sign-in, preferences, family, privacy, help, delete account (Kids profiles ask a grown-up first) | Profile chosen |
| `/read/:id`, `/listen/:id` | Reader (with highlights, notes and the dictionary) and audiobook player (with the read-along transcript); full screen, loaded on demand; BookWorm titles the profile may see | Profile chosen |

## Source layout

```
src/
  components/   Header, Footer, TabBar, AccessibilityMenu, ProfileMenu, Cover, BookCard, BookTile, Shelf,
                BookFeed, GenreNav, FeaturedCarousel, Icon, Avatar, ReadingParts, ReaderDisplayDialog,
                ProfileEditor, PinDialog, Dialog, StudyTools (selection toolbar, highlights, dictionary), Transcript,
                PlaybackProvider (the audiobook that's playing), MiniPlayer
  data/         books, plans, sample logs, sample reader text, legal pages
  layouts/      SiteLayout, ImmersiveLayout, route guards, AppEffects
  lib/          booksApi (Edge Function client), accountApi (Supabase), useBookFeed (load more),
                useLibrary, useReading (progress and bookmarks), useProfiles (household), useAccount
                (membership, delete, download), useHighlights, highlights (page offsets), dictionaryApi (Edge Function
                client), playback (usePlayback), transcript (timed sentences), useDailyLimit, reading (positions),
                billing (dates), hooks
  pages/        one file per route
  store/        state shape, reducer, context hooks
  styles/       tokens (from the wireframe), base, shell, covers, pages, reader, account, study
```

## Build phases

Each phase ends with Playwright screenshots (in `docs/screenshots/`), a Chrome DevTools console and
Lighthouse check, a clean `npm run build` and `npm run lint`, and a commit.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation: scaffold, tokens, shell, store, catalog, routes | Done |
| 1 | Landing, Plans, Sign up / Sign in, demo | Done |
| 2 | Who's reading? and profile management | Done |
| 3 | Home rows, featured carousel, technology and genre lists with infinite scroll | Done |
| 4 | Book details (Google data and catalog), public reader logs, library statuses, write/edit/delete logs, ratings, More like this | Done |
| 5 | Public title search, filters (source, genre, sort), Did you mean, recent searches, Surprise Me | Done |
| 6 | Supabase Auth (sign up, log in, log out, reset), library and logs saved in Supabase, Library page with statuses, Favorites and custom lists | Done |
| 7 | Reader and audiobook player: display settings, chapters, bookmarks, Mark as finished?, speed, ±15 s, sleep timer; progress and bookmarks in Supabase; Continue reading; daily limit | Done |
| 8 | Household profiles in Supabase; Account page (plan, sign-in, preferences, family, privacy, help); pause, cancel and delete account; Ask a grown-up; accessibility pass | Done |
| 9 | Highlights and notes (saved to Supabase), dictionary, read-along transcript (English or Spanish), mini-player; reader and player load on demand | Done |
