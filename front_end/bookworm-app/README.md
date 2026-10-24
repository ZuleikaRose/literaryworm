# BookWorm (front end)

A single-page app for reading ebooks and listening to audiobooks, built from the Figma wireframe in
`../BookWorm_web_app_wireframe` and the blueprint in `../user_journey.md` and `../../user_stories.md`.

- **Stack:** React 19, TypeScript (strict), Vite, React Router DOM (`BrowserRouter`, declarative routes).
- **Data:** app state lives in memory (React Context + `useReducer`); nothing is saved to the browser, so
  **refreshing resets the app**. Book lists come from the `books` Supabase Edge Function (`src/lib/booksApi.ts`),
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
| `/signin`, `/signup` | Sign in, sign up, demo | Public |
| `/legal/:slug` | Policies and help | Public |
| `/books/:id` | Book details (catalog id or Google Books volume id); `/book/:id` redirects | Public (actions need a profile) |
| `/profiles` | Who's reading? | Signed in |
| `/browse`, `/browse?genre=…` | Home: carousel, rows, infinite genre feed | Profile chosen |
| `/search` | Search and filters | Profile chosen |
| `/library` | Reading List, Favorites, Custom Lists | Profile chosen |
| `/account` | Account, family, preferences | Profile chosen |
| `/read/:id`, `/listen/:id` | Reader and audiobook player (full screen) | Profile chosen |

## Source layout

```
src/
  components/   Header, Footer, TabBar, AccessibilityMenu, ProfileMenu, Cover, BookCard, BookTile, Shelf,
                BookFeed, GenreNav, FeaturedCarousel, Icon, Avatar
  data/         books, plans, sample logs, legal pages
  layouts/      SiteLayout, ImmersiveLayout, route guards, AppEffects
  lib/          booksApi (Edge Function client), useBookFeed (load more), small hooks and helpers
  pages/        one file per route
  store/        state shape, reducer, context hooks
  styles/       tokens (from the wireframe), base, shell, covers, pages
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
| 5 | Search, filters, Surprise Me | |
| 6 | Library and Custom Lists | |
| 7 | Reader and audiobook player | |
| 8 | Account, Kids restrictions, accessibility and motion polish | |
