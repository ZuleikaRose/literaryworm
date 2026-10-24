# BookWorm: project guide for Claude Code

BookWorm is a reading and listening app (ebooks and audiobooks, household profiles). The assessment brief is `README.md`; the product blueprint is `front_end/user_journey.md`; stories are in `user_stories.md`.

## Where things are

- `front_end/bookworm-app/`: the React app (see its `README.md` for routes and layout).
- `front_end/BookWorm_web_app_wireframe/`: the Figma Make wireframe. Visual source of truth; don't edit.
- `front_end/style_guide.md`: design tokens, type, components, motion, voice.
- `supabase/`: migrations, Edge Functions (`books`, `manage-profile`, `checkout`), security tests. See `supabase/README.md`. Project: `bookworm` (ref `ldzdmrdvmacpudsbngvd`).
- `schema.sql`: generated from the migrations by `supabase/build-schema.sh`; don't edit by hand. `drawsql.png` is its ERD, rendered from `docs/erd/erd.html`.
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
- **State is in memory only** (`src/store`). No `localStorage`. A refresh resets the app on purpose.
- **Book lists go through `src/lib/booksApi.ts`**, which calls only the `books` Edge Function. Never fetch Google Books from the browser. Kids profiles use the sample catalog only.
- **Public logs come from `src/lib/logsApi.ts`** (the `logs` table with the publishable key, embedding only `profiles.display_name`). Public pages never read `library_items`.
- Search is title only and public. Its state lives in the URL (`q`, `genre`, `sort`, `source`; see `src/lib/search.ts`), and the client checks queries with the same rules as the `books` function.
- The profile's library is `ProfileData.library` (keyed by book id, with the brief's three statuses). Store actions mirror the database rules: a log needs its book in the library, and removing the book removes that profile's logs.
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
- Every Supabase table has Row Level Security enabled, with `(select auth.uid())` policies and column-level grants. Index every foreign key, with `CREATE INDEX CONCURRENTLY` in its own one-statement migration (the MCP `apply_migration` runs in a transaction, so apply those with `execute_sql`).
- Edge Functions validate every input, use the CORS allowlist in `_shared/cors.ts`, and return `{ error: { code, message } }`. Test (`deno check`, `deno test`) before deploying.
- `DELETE` statements always have a `WHERE` clause (a hook blocks the rest).
- Don't stage unrelated files (`.cto-toolkit/`, tool folders like `.windsurf/`, `prompt-records/` edits made by hooks) in feature commits.
