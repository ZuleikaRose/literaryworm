# Releasing: dev first, then main

Every change reaches readers in two steps. It lands on **dev**, where it's tested against the dev database, and only then moves to **main**, which is the live site at www.literaryworm.com.

| | Code (git) | Website (Vercel) | Database (Supabase) |
| --- | --- | --- | --- |
| **dev** | the `dev` branch | the `dev` branch's preview deployment | the `literaryworm-dev` branch (ref `xjvisabdztxvnsglysdh`) |
| **main** | the `main` branch | www.literaryworm.com | the `literaryworm` project (ref `ldzdmrdvmacpudsbngvd`) |

## 1. Build on dev

```bash
git checkout dev
# ...make the change, with tests...
```

Before every commit, in `front_end/literaryworm_app`: `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e` all pass (CLAUDE.md, *Phase workflow*).

## 2. Database changes go to the dev branch first

Apply each new migration in `supabase/migrations` to the **dev branch**, one at a time, in order. Migrations that are a single `CREATE INDEX CONCURRENTLY` run through `execute_sql`, not `apply_migration`. Then check the change there: the security and performance advisors, and the table's access rules, tested inside a transaction that's rolled back. The dev branch has no member accounts; create a throwaway one inside that transaction, with `display_name`, `date_of_birth` and `terms_accepted` in `raw_user_meta_data`.

Migrations aren't applied by CI. Production's migration history doesn't match the file names (they were applied with their own timestamps), so `supabase db push` would try to run everything again.

## 3. Push dev and let CI run

```bash
git push origin dev
gh run watch          # CI runs the four test suites and the Edge Functions' Deno checks
```

Open the dev preview from Vercel and try the change there.

## 4. Announce planned work (when readers might notice)

At **/maintenance** (developers and admins; Account → Team access → *Maintenance notices*), add a notice: a title, a message, when the work starts and ends, and when the notice starts showing (up to 30 days ahead). It shows as a banner across every page from then until the work ends, in each reader's own time zone. Edit or delete it there at any time.

## 5. Production database and functions

Apply the same migrations to **production**, one at a time and in the same order, once a person has approved it. Deploy any changed Edge Functions (`supabase functions deploy <name>`); redeploy every function that imports a changed file in `supabase/functions/_shared`. Apply migrations before promoting code that reads new tables or columns: if the code goes first, members see errors until the migration is applied.

## 6. Promote dev to main

```bash
scripts/promote.sh --dry-run   # every check, no push
scripts/promote.sh             # the same checks, then pushes dev to main
```

The script stops, changing nothing, unless:
- you're on `dev`, with no uncommitted changes to tracked files, and `dev` is pushed;
- `main` hasn't moved on its own, so this is a fast-forward (otherwise merge `origin/main` into `dev`, test and push first);
- the build, lint, unit tests and end-to-end tests pass;
- GitHub's CI run for `dev`'s latest commit finished green;
- you confirm that the new migrations it lists are on production and the changed functions are deployed.

It then pushes `dev` to `main` (`main` is never checked out, so your working files aren't touched), and Vercel deploys the live site.

## Setting up the dev site (once)

- **Vercel:** in the project's Environment Variables, give the **Preview** environment (or just the `dev` branch) `VITE_SUPABASE_URL=https://xjvisabdztxvnsglysdh.supabase.co` and the dev branch's publishable key as `VITE_SUPABASE_PUBLISHABLE_KEY`. Production keeps the main project's values. A fixed address such as dev.literaryworm.com (a domain assigned to the `dev` branch) makes the next two steps simpler.
- **Supabase dev branch:** add the dev site's address to the functions' `ALLOWED_ORIGINS` setting, or the browser blocks their answers. For passkeys there, set the Relying Party ID to `literaryworm.com` with the dev site's origin (works for dev.literaryworm.com, not for `*.vercel.app` previews).
- **Data:** the dev branch's policies and What's new were copied from production on 31 October 2026. Do it again whenever they drift: export `legal_pages` and `changelog_entries` from production and upsert them on the dev branch.
