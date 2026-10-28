# Supabase backend

Database migrations, Edge Functions and security tests for LiteraryWorm. The root `schema.sql` is generated from `migrations/` by `build-schema.sh`; `drawsql.png` is its ERD (`docs/erd/`).

## Rules every migration follows

- **Row Level Security on every table**, with policies that call `(select auth.uid())` so it is evaluated once per query.
- **Every foreign key and every column a policy filters on is indexed.** Indexes on new tables are created with `CREATE INDEX CONCURRENTLY` in their own one-statement migration (`…01`, `…02`), because `CONCURRENTLY` can't run inside a transaction.
- **Column-level grants.** The browser roles (`anon`, `authenticated`) get exactly the columns the UI needs. Anything sensitive (PIN hashes, Stripe ids, plan changes, Kids profiles) goes through an Edge Function.
- **`SECURITY DEFINER` functions** use `set search_path = ''` and are executable only by `service_role`; internal ones live in the unexposed `private` schema.
- **Anonymous input is validated in the database too**: the sign-up trigger checks display name, date of birth (18+) and Terms acceptance; CHECK constraints bound every text, rating and id.

| Migration | What it adds |
|---|---|
| `0100` | `profiles` (public display name), `account_private`, sign-up trigger, `plans`, `subscriptions` |
| `0200` | `reader_profiles` (household profiles, plan limit trigger), `parental_consents` |
| `0300` | `private.rate_limits` and the server-only functions: `check_rate_limit`, `set_profile_pin`, `verify_profile_pin`, `unlock_profile`, `create_kids_profile` |
| `0400` | The brief's `library_items` (private) and `logs` (public; composite FK to the author's library item, cascade on delete) |
| `0500` | `reading_progress` (one row per book, for Continue Reading) and `bookmarks`, both private and tied to a library item (composite FK, cascade on delete) |
| `0600` | `set_profile_age_rating` (server only): moving a profile to Kids records the parent's consent in `parental_consents`; moving it off Kids marks that consent withdrawn |
| `0700` | `highlights`: a passage on one reader page (chapter, page, character offsets and the words), a colour (`highlight_color`) and an optional note; private and tied to a library item (composite FK, cascade on delete); the browser may change only `color` and `note` |
| `0800` | Per-profile `favorites`, `book_ratings` (`taste_rating`), `custom_lists` (up to 50, unique names, optional `share_slug`) and `custom_list_items` (up to 200 books), each tied to `reader_profiles(id, account_id)` so the profile must be the account's; `reader_profiles.recent_searches` (up to 8); `shared_list(slug)` for public shared-list pages; a profile moved to Kids stops sharing |
| `0900` | `book_summaries`: a short and a detailed AI-written summary per book (catalog or Google id), the model that wrote them and when; RLS on with no browser access at all (only the `summaries` function reads and writes it). No foreign key, so no index beyond the primary key |
| `1000` | `reading_goals` (a profile's book goal per year) and `reading_days` (minutes and books finished per profile per day), per profile like favourites (composite FK to `reader_profiles`); `record_reading()` (SECURITY INVOKER) adds to a day atomically, at most 60 minutes and one book a call, within two days of today |
| `1100` | Book clubs: `book_clubs` (owner, book, start and finish dates, a 10-character invite code), `club_members` (up to 50) and `club_posts` (by chapter; tied to the membership, so leaving deletes your posts). Members-only RLS through `is_club_member()`; joining only through `join_club(code)` (20 tries an hour per account); up to 20 clubs an account and 60 posts an hour |
| `1200` | The player and listening on another device: player settings on `reader_profiles` (volume 0–100, mute, skip back and forward of 5–60 seconds, skip intros, skip outros; the browser may update them), `listening_devices` (one row per open visit, browser-made id, checked in through `touch_listening_device()`, 20 kept an account) and `playback_handoffs` (a book and a place in seconds sent to one of the account's devices for one of its profiles; composite foreign keys to `listening_devices` and `reader_profiles`; the browser may set only `claimed_at` after sending). Owner-only RLS; handoffs published to Supabase Realtime. Indexes in `1201`–`1203` |
| `1300` | Reading stats: `reading_days.listening_minutes` (the listening part of a day's minutes, never more than them) and `finished_books` (which book a profile finished on which day; owner-only RLS). `record_reading()` now also takes the listening minutes and the book (older four-argument callers still work through defaults). Index in `1301` |
| `1400` | Club notifications: `club_members.last_read_at` and `notify` (a member changes only their own), `mark_club_read()` and `club_unread()` (new posts by others since you last looked, by chapter, so the app can leave out chapters you haven't reached; both `SECURITY INVOKER`); `club_posts` published to Supabase Realtime. Index `(club_id, created_at)` in `1401` |
| `1500` | Listen along: `club_listening`, one session a club (host, place in seconds, playing, speed 0.5–3). Members read it; only the host moves it; any member may take over a session nobody has moved for two minutes; the host or the club's owner ends it. Composite foreign key to `club_members`, so leaving ends a session you lead. Published to Realtime. Index in `1501` |
| `1600` | Uploaded books: `uploaded_books` (title, author, chapter titles and word counts, the text's path; ids `u-` and 32 hex digits, valid volume ids; not on Kids profiles, 50 a profile; owner-only RLS) and the private `user-books` Storage bucket (JSON only, 15 MB a file; members read, add and remove only in a folder named after their account). Indexes in `1601`–`1602` |
| `…01`, `…02`, … | One index each, created concurrently (run on their own, outside a transaction) |

**How a shared list is read.** Visitors call `rpc/shared_list` with the link's 22-character token. It's `SECURITY DEFINER` on purpose (the advisor warns about any such function anons can call): the tables stay owner-only under RLS, and this one function returns just the list's name, description, the profile's name and its titles, or nothing for a wrong, stopped or Kids link.

**Why `join_club` and `is_club_member` are `SECURITY DEFINER`.** The advisor warns that signed-in users can call them, which is the point: `is_club_member` lets the club policies check membership without querying `club_members` under its own RLS (which would recurse), and answers only about the caller; `join_club` lets someone who isn't in a club yet find it by its code, and returns nothing for a wrong one.

**How the book page reads logs.** The browser asks PostgREST for `logs` with the publishable key (`select=id,body,rating,created_at,updated_at,author:profiles(display_name)&volume_id=eq.<id>`). The anon role may read `logs` and the `id, display_name` columns of `profiles`, and is refused on `library_items` (checked live: `permission denied`), so every reader's logs are listed without exposing anyone's library.

## Edge Functions

| Function | Who can call | What it does |
|---|---|---|
| `books` | Anyone (`verify_jwt = false`) | The only path to Google Books. `mode=home` (technology), `search` (title only; optional `genre` from the six and `sort=newest`), `genre` (the six required genres), `volume` (one book). Validates every parameter, rejects unknown ones, rate limits each IP (60/min), times out after 8 s, maps Google's 429/5xx/timeouts to friendly errors, asks once more when Google answers Home's first page with no results at all (it does that when strained), asks again with plain words when a `subject:` (genre) or `intitle:` (search) query comes back empty (Google has answered every such query with nothing for hours while plain searches still worked; the fallback is looser but not empty) and returns only the fields the UI shows, with https covers. `volume` also returns `mature` (Google's MATURE rating), which the app uses to keep those titles from Teen and Kids profiles. |
| `manage-profile` | Signed-in accounts | Kids profiles with consent, PINs, daily limits, age-rating changes (`set_age_rating`), unlocking and deleting profiles. Re-checks the account password; checks the profile belongs to the caller. Deleting a profile also removes its uploaded books' files from Storage. |
| `dictionary` | Anyone (`verify_jwt = false`) | The reader's dictionary. `?word=` (one English word, letters with an inner apostrophe or hyphen, up to 40 characters). Asks the Free Dictionary API, and Wiktionary's REST API when that's down, slow or busy (both Wiktionary data, CC BY-SA); returns the word, pronunciation and up to three parts of speech with three definitions each. Rate limits each IP (40/min), 4 s per source, cached for a day. |
| `summaries` | Anyone (`verify_jwt = false`) | A book's short and detailed summaries. `?id=` (a catalog id or Google volume id). Returns the kept summaries from `book_summaries`; the first time a book is asked for, looks it up (the catalog list in `_shared/catalog.ts`, or Google Books), asks Claude (`claude-haiku-5-5`, structured JSON output; the book's details go in as data; a declined request returns an error and nothing is kept) and keeps the answer. Rate limits each IP (60/min) and new summaries (10 an hour per IP, 300 a day in all), so the Claude bill stays bounded. Cached for a day. |
| `ask` | Anyone (`verify_jwt = false`) | Ask the book. `POST { id, chapter, question }` (a public-domain catalog id, the reader's chapter, 3–500 characters). Loads the book's text from the site's `/texts` (`TEXTS_ORIGIN`, default `https://www.literaryworm.com`), sends Claude (`claude-haiku-5-5`) only the chapters up to the reader's (the last ~120,000 characters, prompt-cached) with instructions never to reveal later events, and returns `{ answer }`. Rate limits each IP (20 an hour) and all questions (500 a day). |
| `checkout` | Signed-in accounts | Validates and records the plan choice. (Payment isn't taken yet.) |
| `manage-account` | Signed-in accounts | `pause` / `resume` the membership, `cancel` (runs to the next billing date) / `restart`, and `delete` (needs the account password and `confirm: true`; marks the plan cancelled, then deletes the user, which cascades to every row they own). Rate limited per user (10/min). Deleting an account first removes its folder in the `user-books` bucket. |

All functions share `_shared/`: CORS with an origin allowlist (`ALLOWED_ORIGINS`, plus `Vary: Origin` and preflight), JSON error shape `{ error: { code, message } }`, a 4 KB body limit, strict field lists and the rate limiter.

### Secrets (set in Supabase, never in the repo or a `VITE_` variable)

```bash
supabase secrets set GOOGLE_BOOKS_API_KEY=<your key>
supabase secrets set ALLOWED_ORIGINS=https://literaryworm.com,https://www.literaryworm.com,http://localhost:5173
supabase secrets set ANTHROPIC_API_KEY=<your Claude API key>   # used only by the summaries and ask functions
```

`ALLOWED_ORIGINS` must list every site that calls the functions, including the live site (`https://www.literaryworm.com` and `https://literaryworm.com`). A site missing from the list gets answers the browser won't let it read, which the app shows as "You seem to be offline". Vercel preview URLs need adding separately.

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions by Supabase.

## Auth settings

Set in the dashboard (Authentication) or the Management API; they aren't in the migrations:

| Setting | Value | Why |
|---|---|---|
| Site URL | `https://www.literaryworm.com` | Where reset links return |
| Redirect URLs | `https://www.literaryworm.com/**`, `https://literaryworm.com/**`, `http://localhost:5173/**` | Allows `/reset-password` and `/signin` on the live site and in development |
| Minimum password length | 15 | Matches the app's rule (15–64 characters) |
| Confirm email | Off | The built-in email reaches only the project team, 2 emails an hour; turn it on once an email provider (SMTP) is set up |

How the app uses Auth: `signUp` sends `display_name`, `date_of_birth`, `terms_accepted` and `marketing_emails` as user metadata, and the `on_auth_user_created` trigger validates them and creates `profiles` and `account_private`. The browser then reads its own rows under RLS, writes `library_items`, `logs`, `reading_progress`, `bookmarks` and `highlights` directly (owner-only writes), saves household profiles to `reader_profiles` (name, avatar, genres) and display name and marketing emails to their own rows, and goes through `checkout`, `manage-profile` and `manage-account` for everything that needs the password or the service role.

## Deploy

```bash
supabase link --project-ref <ref>
supabase db push                      # applies migrations/
supabase functions deploy books manage-profile checkout manage-account dictionary summaries ask --project-ref <ref>
```

## Tests

```bash
# Edge Function unit tests (offline; Google and Claude are stubbed)
npx -y deno@2 test --allow-env supabase/functions/

# Database security checks: apply the migrations to a scratch database, then
psql "$SCRATCH_DATABASE_URL" -f supabase/tests/security_test.sql   # ends with "ALL SECURITY CHECKS PASSED"
```

The SQL checks cover sign-up validation, anonymous access, user isolation, column grants, plan limits, Kids consent, PIN lockout, age-rating changes and consent records, rate limits, the rule that logs, progress, bookmarks and highlights need a library item, that a highlighted passage can't be moved, per-profile lists, favourites and ratings (another account's profile or list refused, Kids can't share, moving to Kids stops sharing, deleting a profile deletes its lists), what a shared link reveals, goals and reading days (own profiles only, bounded additions), book clubs (members only, joined by code, owners' and members' rights), player settings (bounded volume and skip lengths), devices and handoffs (own account only, no sending to another account's device or profile, no changing a handoff's place, clearing a device clears its handoffs), reading stats (listening minutes never more than the minutes, a finished book recorded once a day, own profiles only), club notifications (posts from before joining and your own posts aren't new, reading the club clears them, members change only their own alerts), listen along (the host moves a session, members see it, nobody takes over one that's still going, a member takes over a left one), uploaded books (own account and folder only, ids and paths checked, not on Kids profiles), cascade deletes, RLS on every table and an index on every foreign key. Run them only against a scratch database: they create test users.
