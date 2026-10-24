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
| 4 | Book details | Matches the wireframe detail screen; lists, ratings and reviews; blocked on Kids |
| 5 | Search | Search, filters, sort, *Did you mean*, recent searches, Surprise Me |
| 6 | Library | Lists and Custom Lists create, rename, delete, reorder; empty states |
| 7 | Reader and player | Reader controls, chapters, bookmarks, *Mark as finished?*; player speed, ±15s, sleep timer; progress feeds Continue Reading |
| 8 | Account and polish | *Ask a grown-up* gate on Kids; cancel and delete flows; accessibility and motion pass |

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
