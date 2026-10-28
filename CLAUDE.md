# LiteraryWorm: project guide for Claude Code

LiteraryWorm is a reading and listening app (ebooks and audiobooks, household profiles). It lives at https://www.literaryworm.com (Vercel; `literaryworm.com` redirects there). The assessment brief is `README.md`; the product blueprint is `front_end/user_journey.md`; stories are in `user_stories.md`.

## Where things are

- `front_end/literaryworm_app/`: the React app (see its `README.md` for routes and layout). Vercel's Root Directory is this folder, so its `vercel.json` (the rewrite that lets every route survive a refresh) lives here too.
- `front_end/BookWorm_web_app_wireframe/`: the Figma Make wireframe. Visual source of truth; don't edit.
- `front_end/style_guide.md`: design tokens, type, components, motion, voice.
- `supabase/`: migrations, Edge Functions (`books`, `manage-profile`, `checkout`, `manage-account`, `dictionary`, `summaries`, `ask`), security tests. See `supabase/README.md`. Project: `literaryworm` (ref `ldzdmrdvmacpudsbngvd`). The app is deployed on Vercel at `https://www.literaryworm.com`; `https://www.literaryworm.com`, `https://literaryworm.com` and `http://localhost:5173` must all be in the `ALLOWED_ORIGINS` function setting, or the browser blocks the functions' answers and the app reports "offline".
- `schema.sql`: generated from the migrations by `supabase/build-schema.sh`; don't edit by hand. `drawsql.png` is its ERD, rendered from `docs/erd/erd.html`.
- `prompt.md`: the build brief and phase plan.
- `vite-project/`: an unrelated earlier scaffold. Don't use it.

## Commands (run in `front_end/literaryworm_app`)

```bash
npm run dev     # http://localhost:5173
npm run build   # tsc -b + vite build; must pass before every commit
npm run lint    # oxlint; must be clean
```

## Conventions

- TypeScript strict. React Router DOM, declarative routes with `BrowserRouter`; routes live in `src/App.tsx`.
- **State is in memory only** (`src/store`). No `localStorage`, with one exception: the Supabase session (`src/lib/supabase.ts`, key `literaryworm-session`) so a member stays signed in. Everything else resets on refresh on purpose.
- **Real accounts go through `src/lib/accountApi.ts`** (Supabase Auth, `library_items`, `logs`, the `checkout` function) and `src/lib/useAuthSync.ts` (restores the session, follows sign-in and sign-out). Use `useLibrary()` for the library: it writes to Supabase first, then updates the store. The demo household stays in memory and never calls Supabase.
- **Book lists go through `src/lib/booksApi.ts`**, which calls only the `books` Edge Function. Never fetch Google Books from the browser. Kids profiles use the sample catalog only.
- **Public logs come from `src/lib/logsApi.ts`** (the `logs` table with the publishable key, embedding only `profiles.display_name`). Public pages never read `library_items`.
- **Reading progress and bookmarks go through `src/lib/useReading.ts`.** Opening a book adds it to the library as Reading; the place is dispatched straight away and saved to Supabase (`reading_progress`) a moment later, so reading never waits for the network; bookmarks save first, then show. Real accounts keep them in `state.accountReading`, in-memory accounts in `ProfileData`; `activeReading()` picks the right one. Positions are fractions of the whole book (`src/lib/reading.ts`), shared by the reader and the player.
- **Household profiles go through `src/lib/useProfiles.ts`.** Real accounts save name, avatar and genres to `reader_profiles` directly; Kids profiles, PINs, limits, age ratings and deletes through the `manage-profile` function (which re-checks the password); PINs are verified on the server. After a change the profiles are read back (`setProfiles`). A real profile has `hasPin`, never the PIN.
- **Account changes go through `src/lib/useAccount.ts`**: membership (pause, resume, cancel, restart) and deleting through the `manage-account` function; display name and marketing emails straight to their tables; Download my data builds a JSON file in the browser.
- **Highlights and notes go through `src/lib/useHighlights.ts`**, like bookmarks: real accounts save to `highlights` first, then show; in-memory accounts keep them in `ProfileData`. A highlight is found by chapter, page and character offsets in the page's text (`src/lib/highlights.ts`).
- **Favourites, ratings, custom lists and recent searches go through `src/lib/useCollections.ts`.** They belong to the active profile (`ProfileData`); real accounts save to `favorites`, `book_ratings`, `custom_lists`, `custom_list_items` and `reader_profiles.recent_searches` first, then dispatch (recent searches save in the background). `useAuthSync` loads every profile's collections after the profiles. Shared lists are read with the `shared_list` RPC (`src/lib/sharedListApi.ts`), never the tables.
- **Definitions come from `src/lib/dictionaryApi.ts`**, which calls only the `dictionary` Edge Function (the Free Dictionary API is asked on the server).
- **Audiobook playback lives in `src/components/PlaybackProvider.tsx`** (read it with `usePlayback()` from `src/lib/playback.ts`), above the routes, so a book keeps playing in the mini-player (`src/components/MiniPlayer.tsx`) while the member browses. The player page is a view of it. Opening the reader pauses it; switching profile or signing out stops it, and its last save still goes to the profile that was listening (`saveProgress` / `addTimeUsed` take a `profileId`).
- **Who reads an audiobook is a narrator (`src/lib/narration.ts`)** that the engine drives: the book's LibriVox recording (`book.recording`, from `src/data/librivox.ts`, generated by `scripts/build-librivox.py`; MP3s streamed from the Internet Archive) or a device voice (Web Speech API) reading the text. The 21 public-domain titles have a recording and full Project Gutenberg text (`public/texts/<id>.json`, built by `scripts/build-texts.py` to line up with the recording's chapters); other titles have only sample text. The profile's choice is `ProfileData.narrationVoice` (in memory, like speed); `resolveNarration()` picks the recording by default, else a British English voice. Don't edit the generated files by hand.
- **Book summaries come from `src/lib/summaryApi.ts`**, which calls only the `summaries` Edge Function. Claude (`claude-haiku-5-5`, using the `ANTHROPIC_API_KEY` function setting) writes a book's short and detailed summaries the first time anyone asks; the function keeps them in `book_summaries` (service role only, no browser access) and limits new ones per IP and per day. The book page and each My Library row (*Summary*, in a dialog) show them to members and the demo, labelled as written by AI. The function's catalog list (`supabase/functions/_shared/catalog.ts`) must stay in step with `src/data/books.ts`.
- **Ask the book (`src/lib/askApi.ts`, `components/AskDialog.tsx`)** calls only the `ask` Edge Function, which sends Claude (`claude-haiku-5-5`) the public-domain text up to the reader's chapter (fetched from the site's `/texts`, the last ~120,000 characters) and tells it never to reveal later events. Public-domain titles only; rate limited per IP and per day.
- **Goals and streaks** live in `ProfileData.readingGoals` / `readingDays` (per profile, like favourites). Reading time comes from `useDailyLimit`; members' minutes go to Supabase through `record_reading()` (`src/lib/readingActivity.ts`, whole minutes, retried); finished books are counted in `useReading` and `useLibrary`. Streaks and month summaries are worked out in `src/lib/goals.ts`. If the goal tables can't load, the account still opens.
- **Book clubs** are per account (`book_clubs`, `club_members`, `club_posts`), reached through `src/lib/useClubs.ts`: Supabase for members (`clubsApi.ts`; joining only through `join_club()`), an in-memory sample club for the demo. Not offered to Kids profiles. Posts past the reader's place stay hidden until they choose to see them.
- **Across devices:** `useReadingSync` reloads progress, bookmarks and highlights when a member comes back to the tab (after 15 s away) or back online; `useReading` saves the place as soon as the tab is hidden. An open reader offers to go to a place saved on another device.
- **Offline:** `public/sw.js` (registered in production builds only) keeps the app's files and serves books saved with *Read offline* (`src/lib/offline.ts`, cache `lw-books`: text, and LibriVox audio served with Range support). Never let it cache Supabase or Edge Function calls. Bump `SHELL` in `sw.js` if the shell caching changes.
- The read-along transcript is built from the sample text (`src/data/sampleText.ts`, English and Spanish) and timed to the chapter (`src/lib/transcript.ts`). Its settings are accessibility settings.
- The reader shows the full Project Gutenberg text for the 21 public-domain titles (`public/texts`, paged by `textPages()` in `src/lib/reading.ts`, loaded by `useBookPages`); paging must stay deterministic, because highlights store a page and character offsets. The 12 copyrighted titles show sample text (`src/data/sampleText.ts`), which is also what a device voice reads for them; the pages say so. The daily limit is `src/lib/useDailyLimit.ts`.
- Search is title only and public. Its state lives in the URL (`q`, `genre`, `sort`, `source`; see `src/lib/search.ts`), and the client checks queries with the same rules as the `books` function. When Google returns nothing for a `subject:` or `intitle:` query, the `books` function asks again with plain words (looser, but not empty).
- The library is the account's for real accounts (`state.accountLibrary`, from `library_items`) and the profile's for in-memory accounts (`ProfileData.library`); `activeLibrary()` picks the right one. Store actions mirror the database rules: a log needs its book in the library, and removing the book removes that profile's logs.
- Styles are plain CSS in `src/styles/`. Use tokens from `tokens.css`; no raw hex in component CSS (book cover palettes are the exception).
- Only export components from `.tsx` files (Fast Refresh); data and helpers go in `src/data` or `src/lib`.
- Accessibility is required: visible labels, `aria-describedby` for errors, focus management, 44px targets, no sideways scroll on phones.
- Copy follows the voice rules in the style guide.
- When an action both navigates and changes state a route guard reads (sign out, switching profile), call `navigate()` first and wrap the dispatch in `startTransition`. React Router applies navigation in a transition, so otherwise the guard renders first and redirects (see `src/lib/useSignOut.ts`).
- Modals use `src/components/Dialog.tsx` (native `<dialog>`). Profile-protected changes ask for the account password with `AccountPasswordField`.

## Phase workflow

Build in phases (see `prompt.md`). At the end of each phase:

1. `npm run build` and `npm run lint` clean.
2. Playwright screenshots at 1440px and 390px, compared against the wireframe; save keepers to `front_end/literaryworm_app/docs/screenshots/`.
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
