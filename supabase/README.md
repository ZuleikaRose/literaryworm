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

**How the book page reads logs.** The browser asks PostgREST for `logs` with the publishable key (`select=id,body,rating,created_at,updated_at,author:profiles(display_name)&volume_id=eq.<id>`). The anon role may read `logs` and the `id, display_name` columns of `profiles`, and is refused on `library_items` (checked live: `permission denied`), so every reader's logs are listed without exposing anyone's library.
| `…01`, `…02` | One index each, created concurrently |

## Edge Functions

| Function | Who can call | What it does |
|---|---|---|
| `books` | Anyone (`verify_jwt = false`) | The only path to Google Books. `mode=home` (technology), `search` (title only), `genre` (the six required genres), `volume` (one book). Validates every parameter, rejects unknown ones, rate limits each IP (60/min), times out after 8 s, maps Google's 429/5xx/timeouts to friendly errors and returns only the fields the UI shows, with https covers. `volume` also returns `mature` (Google's MATURE rating), which the app uses to keep those titles from Teen and Kids profiles. |
| `manage-profile` | Signed-in accounts | Kids profiles with consent, PINs, daily limits, unlocking and deleting profiles. Re-checks the account password; checks the profile belongs to the caller. |
| `checkout` | Signed-in accounts | Validates and records the plan choice. (Payment isn't taken yet.) |

All functions share `_shared/`: CORS with an origin allowlist (`ALLOWED_ORIGINS`, plus `Vary: Origin` and preflight), JSON error shape `{ error: { code, message } }`, a 4 KB body limit, strict field lists and the rate limiter.

### Secrets (set in Supabase, never in the repo or a `VITE_` variable)

```bash
supabase secrets set GOOGLE_BOOKS_API_KEY=<your key>
supabase secrets set ALLOWED_ORIGINS=https://<your-vercel-domain>,http://localhost:5173
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions by Supabase.

## Deploy

```bash
supabase link --project-ref <ref>
supabase db push                      # applies migrations/
supabase functions deploy books manage-profile checkout
```

## Tests

```bash
# Edge Function unit tests (offline; Google is stubbed)
npx -y deno@2 test --allow-env supabase/functions/

# Database security checks: apply the migrations to a scratch database, then
psql "$SCRATCH_DATABASE_URL" -f supabase/tests/security_test.sql   # ends with "ALL SECURITY CHECKS PASSED"
```

The SQL checks cover sign-up validation, anonymous access, user isolation, column grants, plan limits, Kids consent, PIN lockout, rate limits, the log-needs-a-library-item rule, cascade deletes, RLS on every table and an index on every foreign key. Run them only against a scratch database: they create test users.
