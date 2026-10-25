# Build prompt

The brief given to Claude Code for the BookWorm front end, written as a reusable prompt. It follows the prompt life cycle from the assessment: DEFINE → EXPLORE → PLAN → CODE → REVIEW → COMMIT.

---

## Define

Build a front-end single-page application for **BookWorm** from the wireframes and user stories.

- **Stack:** React + TypeScript (strict) + Vite, React Router DOM with `BrowserRouter`.
- **Data:** app state lives in the browser's memory, so refreshing resets the app. Book lists come only from the `books` Supabase Edge Function (Google Books); the browser never calls Google. Without Supabase configured, the sample catalog stands in.
- **Brief first:** every requirement in `README.md` (the graded brief) must be met; the blueprint's experience is kept around it.
- **Skills to apply:** Front-End Design, UI UX Pro Max, Taste, Design Motion Principles.
- **Docs:** use the Context7 MCP for current React Router and Vite documentation.
- **Supervision:** use the Playwright and Chrome DevTools MCP servers. After each page, screenshot it with Playwright and compare it with the wireframe and user stories before moving on.

## Explore

Read, in this order:

1. `front_end/user_journey.md`: the product blueprint and user journey.
2. `front_end/BookWorm_web_app_wireframe/` (`src/App.tsx`, `src/index.css`, `images/`): the visual design.
3. `user_stories.md`: what the app must remember or enforce.
4. `front_end/style_guide.md`: tokens and components.
5. `README.md`: the assessment brief (backend, secrets and grading requirements).

Before writing code, summarise the user journey and list the pages to build, and get approval.

## Plan

Work in phases. Each phase has its own passing conditions and ends with a review stop for feedback.

| Phase | Scope | Passes when |
| --- | --- | --- |
| 0 | Foundation: scaffold, tokens, shell, store, catalog, routes | Build and lint clean; every route renders; guards redirect; header and covers match the wireframe; no sideways scroll at 390px; refresh resets state; Lighthouse accessibility 100 |
| 1 | Landing, Plans, Sign up / Sign in, demo | Under-18 and short or breached passwords refused; Terms required; plan, price, billing day and renewal terms shown before confirming; demo works and can't pay; auth matches the wireframe modal |
| 2 | Who's reading? and profile management | Max 5 profiles; Kids/Teen/All; PIN prompt with lockout after 5 wrong tries; choosing a profile goes to Home |
| 3 | Home | Matches the wireframe Discover screen; technology books and the six genres via the Edge Function; infinite scroll with a Load more fallback; loading, error, empty and end states; rows work by keyboard; carousel pauses; titles respect the age rating |
| 4 | Book details | Matches the wireframe detail screen; `/books/:id` works on refresh; Google data with at least two extra fields; every reader's logs with display name and date; library statuses; logs only for books in the library, removed with the book; ratings; blocked on Kids, mature titles blocked on Teen |
| 5 | Search | Public title-only search (BookWorm titles, then Google through the Edge Function); filters and sort applied server-side; Load more; *Did you mean*; recent searches; Surprise Me; Kids see the catalog only |
| 6 | Library and sign-in | Supabase Auth sign-up, log-in, log-out and password reset; session survives a refresh; plan saved by the `checkout` function; library (`library_items`) and logs saved to Supabase under RLS; Library page with the three statuses; Favorites; custom lists create, rename, delete, reorder; empty states |
| 7 | Reader and player | Reader display (theme, font, size, spacing, margins), chapters, bookmarks, *Mark as finished?*; player speed, ±15s, sleep timer, credit skips; progress and bookmarks saved to Supabase (`reading_progress`, `bookmarks`) and feeding Continue Reading; daily limit enforced; keyboard-operable |
| 8 | Account and polish | Household profiles saved to Supabase (`reader_profiles`, `manage-profile`); Account page (plan and billing, sign-in, preferences, family, privacy with Download my data, help); pause, cancel and restart online and Delete account through a `manage-account` function; *Ask a grown-up* gate on Kids; paused or ended memberships stop reading; accessibility and motion pass |
| 9 | Study tools and listening | Highlights in four colours with notes, saved to Supabase (`highlights`) and listed by chapter; dictionary through a `dictionary` Edge Function (Free Dictionary API, server side); read-along transcript in the player (follows the narration, English or Spanish, size in the accessibility menu); a mini-player that keeps playing while browsing; keyboard-operable throughout |
| 10 | Lists and ratings that last | Favourites, ratings, custom lists and recent searches saved per profile to Supabase (`favorites`, `book_ratings`, `custom_lists`, `custom_list_items`, `reader_profiles.recent_searches`) under RLS; Favorites shows Google titles; share a list by link with a public page that shows only the name, description, profile name and titles (`shared_list`), stop sharing at any time, never from Kids profiles |

After Phase 10 the app was deployed to Vercel. Two fixes followed: the Vercel URL was added to the `ALLOWED_ORIGINS` function setting (without it every book row said "You seem to be offline"), and the `books` function now asks Google again with plain words when its genre (`subject:`) or title (`intitle:`) filters return nothing.

## Code

- Follow `CLAUDE.md` conventions and the style guide.
- Keep data and helpers out of component files.
- Name buttons by what they do. Put errors next to their fields.

## Review

At the end of each phase:

- `npm run build` and `npm run lint` clean.
- Playwright screenshots (desktop and phone) compared against the wireframe and stories; fix what doesn't match.
- Chrome DevTools: console clean, Lighthouse run.
- Check for secrets, I/O error handling and naming.

## Commit

- New data goes in a migration in `supabase/migrations/` (RLS on, `(select auth.uid())` policies, column grants, every foreign key indexed with `CREATE INDEX CONCURRENTLY` in its own migration); run `supabase/tests/security_test.sql`; regenerate `schema.sql` with `supabase/build-schema.sh` and re-render `drawsql.png`.
- Update the README files and docs for the phase.
- Commit only the phase's files, push to `main`, and stop for feedback before the next phase.
