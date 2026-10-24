# Supabase backend

Database migrations, Edge Functions and security tests for BookWorm. The root `schema.sql` is generated from `migrations/` by `build-schema.sh`; `drawsql.png` is its ERD (`docs/erd/`).

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
| `…01`, `…02` | One index each, created concurrently |

**How the book page reads logs.** The browser asks PostgREST for `logs` with the publishable key (`select=id,body,rating,created_at,updated_at,author:profiles(display_name)&volume_id=eq.<id>`). The anon role may read `logs` and the `id, display_name` columns of `profiles`, and is refused on `library_items` (checked live: `permission denied`), so every reader's logs are listed without exposing anyone's library.

## Edge Functions

| Function | Who can call | What it does |
|---|---|---|
| `books` | Anyone (`verify_jwt = false`) | The only path to Google Books. `mode=home` (technology), `search` (title only; optional `genre` from the six and `sort=newest`), `genre` (the six required genres), `volume` (one book). Validates every parameter, rejects unknown ones, rate limits each IP (60/min), times out after 8 s, maps Google's 429/5xx/timeouts to friendly errors, asks once more when Google answers a first page with no results at all (it does that when strained) and returns only the fields the UI shows, with https covers. `volume` also returns `mature` (Google's MATURE rating), which the app uses to keep those titles from Teen and Kids profiles. |
| `manage-profile` | Signed-in accounts | Kids profiles with consent, PINs, daily limits, age-rating changes (`set_age_rating`), unlocking and deleting profiles. Re-checks the account password; checks the profile belongs to the caller. |
| `dictionary` | Anyone (`verify_jwt = false`) | The reader's dictionary. `?word=` (one English word, letters with an inner apostrophe or hyphen, up to 40 characters). Asks the Free Dictionary API, and Wiktionary's REST API when that's down, slow or busy (both Wiktionary data, CC BY-SA); returns the word, pronunciation and up to three parts of speech with three definitions each. Rate limits each IP (40/min), 4 s per source, cached for a day. |
| `checkout` | Signed-in accounts | Validates and records the plan choice. (Payment isn't taken yet.) |
| `manage-account` | Signed-in accounts | `pause` / `resume` the membership, `cancel` (runs to the next billing date) / `restart`, and `delete` (needs the account password and `confirm: true`; marks the plan cancelled, then deletes the user, which cascades to every row they own). Rate limited per user (10/min). |

All functions share `_shared/`: CORS with an origin allowlist (`ALLOWED_ORIGINS`, plus `Vary: Origin` and preflight), JSON error shape `{ error: { code, message } }`, a 4 KB body limit, strict field lists and the rate limiter.

### Secrets (set in Supabase, never in the repo or a `VITE_` variable)

```bash
supabase secrets set GOOGLE_BOOKS_API_KEY=<your key>
supabase secrets set ALLOWED_ORIGINS=https://<your-vercel-domain>,http://localhost:5173
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions by Supabase.

## Auth settings

Set in the dashboard (Authentication) or the Management API; they aren't in the migrations:

| Setting | Value | Why |
|---|---|---|
| Site URL | `http://localhost:5173` (add the Vercel URL when deployed) | Where reset links return |
| Redirect URLs | `http://localhost:5173/**` | Allows `/reset-password` and `/signin` |
| Minimum password length | 15 | Matches the app's rule (15–64 characters) |
| Confirm email | Off | The built-in email reaches only the project team, 2 emails an hour; turn it on once an email provider (SMTP) is set up |

How the app uses Auth: `signUp` sends `display_name`, `date_of_birth`, `terms_accepted` and `marketing_emails` as user metadata, and the `on_auth_user_created` trigger validates them and creates `profiles` and `account_private`. The browser then reads its own rows under RLS, writes `library_items`, `logs`, `reading_progress`, `bookmarks` and `highlights` directly (owner-only writes), saves household profiles to `reader_profiles` (name, avatar, genres) and display name and marketing emails to their own rows, and goes through `checkout`, `manage-profile` and `manage-account` for everything that needs the password or the service role.

## Deploy

```bash
supabase link --project-ref <ref>
supabase db push                      # applies migrations/
supabase functions deploy books manage-profile checkout manage-account dictionary
```

## Tests

```bash
# Edge Function unit tests (offline; Google is stubbed)
npx -y deno@2 test --allow-env supabase/functions/

# Database security checks: apply the migrations to a scratch database, then
psql "$SCRATCH_DATABASE_URL" -f supabase/tests/security_test.sql   # ends with "ALL SECURITY CHECKS PASSED"
```

The SQL checks cover sign-up validation, anonymous access, user isolation, column grants, plan limits, Kids consent, PIN lockout, age-rating changes and consent records, rate limits, the rule that logs, progress, bookmarks and highlights need a library item, that a highlighted passage can't be moved, cascade deletes, RLS on every table and an index on every foreign key. Run them only against a scratch database: they create test users.
