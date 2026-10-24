# BookWorm: project guide for Claude Code

BookWorm is a reading and listening app (ebooks and audiobooks, household profiles). The assessment brief is `README.md`; the product blueprint is `front_end/user_journey.md`; stories are in `user_stories.md`.

## Where things are

- `front_end/bookworm-app/`: the React app (see its `README.md` for routes and layout).
- `front_end/BookWorm_web_app_wireframe/`: the Figma Make wireframe. Visual source of truth; don't edit.
- `front_end/style_guide.md`: design tokens, type, components, motion, voice.
- `schema.sql`: target Supabase schema. `drawsql.png` is its ERD, rendered from `docs/erd/erd.html`.
- `prompt.md`: the build brief and phase plan.
- `vite-project/`: an unrelated earlier scaffold. Don't use it.

## Commands (run in `front_end/bookworm-app`)

```bash
npm run dev     # http://localhost:5173
npm run build   # tsc -b + vite build; must pass before every commit
npm run lint    # oxlint; must be clean
```

## Conventions

- TypeScript strict. React Router DOM, declarative routes with `BrowserRouter`; routes live in `src/App.tsx`.
- **State is in memory only** (`src/store`). No `localStorage`, no API calls in the front end yet. A refresh resets the app on purpose.
- Styles are plain CSS in `src/styles/`. Use tokens from `tokens.css`; no raw hex in component CSS (book cover palettes are the exception).
- Only export components from `.tsx` files (Fast Refresh); data and helpers go in `src/data` or `src/lib`.
- Accessibility is required: visible labels, `aria-describedby` for errors, focus management, 44px targets, no sideways scroll on phones.
- Copy follows the voice rules in the style guide.
- When an action both navigates and changes state a route guard reads (sign out, switching profile), call `navigate()` first and wrap the dispatch in `startTransition`. React Router applies navigation in a transition, so otherwise the guard renders first and redirects (see `src/lib/useSignOut.ts`).
- Modals use `src/components/Dialog.tsx` (native `<dialog>`). Profile-protected changes ask for the account password with `AccountPasswordField`.

## Phase workflow

Build in phases (see `prompt.md`). At the end of each phase:

1. `npm run build` and `npm run lint` clean.
2. Playwright screenshots at 1440px and 390px, compared against the wireframe; save keepers to `front_end/bookworm-app/docs/screenshots/`.
3. Chrome DevTools: no console errors; Lighthouse accessibility 100.
4. Update `schema.sql` and re-render `drawsql.png` for any new data.
5. Update the docs (app README phase table, `user_stories.md` build status, `user_journey.md` build notes, root `README.md` project status).
6. Commit only the files for that work, push to `main`, and stop for the user's review.

## Rules that must not be broken

- Never commit secrets. `.env*` files stay local; only `.env.example` (no real values) is shared. Never put a secret in a `VITE_` variable.
- The browser must never call Google Books directly (backend phases: go through a Supabase Edge Function).
- Don't edit, delete or rewrite anything in `prompt-records/` or the hooks in `.claude/hooks/`.
- Every Supabase table has Row Level Security enabled.
- Don't stage unrelated files (`.cto-toolkit/`, tool folders like `.windsurf/`, `prompt-records/` edits made by hooks) in feature commits.
