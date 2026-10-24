# BookWorm (front end)

A single-page app for reading ebooks and listening to audiobooks, built from the Figma wireframe in
`../BookWorm_web_app_wireframe` and the blueprint in `../user_journey.md` and `../../user_stories.md`.

- **Stack:** React 19, TypeScript (strict), Vite, React Router DOM (`BrowserRouter`, declarative routes).
- **Data:** everything lives in memory (React Context + `useReducer`). There are no API calls and nothing is
  saved to the browser, so **refreshing resets the app**.
- **Catalog:** 29 sample titles in `src/data/books.ts`. Covers are drawn in CSS. Narrator names, reviews and
  synopses are sample content.

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
| `/` | Landing | Public |
| `/plans` | Plans and pricing | Public |
| `/signin`, `/signup` | Sign in, sign up, demo | Public |
| `/legal/:slug` | Policies and help | Public |
| `/book/:id` | Book details | Public (actions need a profile) |
| `/profiles` | Who's reading? | Signed in |
| `/browse` | Home rows | Profile chosen |
| `/search` | Search and filters | Profile chosen |
| `/library` | Reading List, Favorites, Custom Lists | Profile chosen |
| `/account` | Account, family, preferences | Profile chosen |
| `/read/:id`, `/listen/:id` | Reader and audiobook player (full screen) | Profile chosen |

## Source layout

```
src/
  components/   Header, Footer, TabBar, AccessibilityMenu, ProfileMenu, Cover, BookCard, Icon, Avatar
  data/         books, plans, reviews, legal pages
  layouts/      SiteLayout, ImmersiveLayout, route guards, AppEffects
  lib/          small hooks (usePopover, useTitle) and helpers
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
| 3 | Home rows and featured carousel | |
| 4 | Book details, ratings, lists, reviews | |
| 5 | Search, filters, Surprise Me | |
| 6 | Library and Custom Lists | |
| 7 | Reader and audiobook player | |
| 8 | Account, Kids restrictions, accessibility and motion polish | |
