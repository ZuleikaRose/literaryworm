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

Apply the same migrations to **production**, one at a time and in the same order, once a person has approved it. Deploy any changed Edge Functions (`supabase functions deploy <name> --remote=<ref> --yes` with Supabase CLI v3, which needs `--yes` for every change to a hosted project); redeploy every function that imports a changed file in `supabase/functions/_shared`. Apply migrations before promoting code that reads new tables or columns: if the code goes first, members see errors until the migration is applied.

**Refer a friend 20% (migrations 6843, 6844, 6845, 160955, 165931, 174720 and the indexes 165932 and 165934; every function, because `_shared/http.ts` changed).**
1. Pre-check production, read-only: `select count(*) as referrals, count(*) filter (where rewarded_at is null) as waiting, count(*) filter (where rewarded_at is null and (exists (select 1 from public.account_private a where a.user_id = r.referred_id and a.card_payment_at is not null) or exists (select 1 from public.subscriptions s where s.user_id = r.referred_id and not s.complimentary and s.gift_until is null and s.created_at < '2026-11-10'))) as waiting_already_paid from public.referrals r;` (the waiting referrals the cut-over keeps on the free month are the `waiting_already_paid` ones: a card payment, or a membership row from before 2026-11-10 that isn't complimentary or a gift; a claim the old code handed back always followed a payment, so it's among them).
2. Deploy every function that loads `_shared/http.ts` (each with its dry run): affiliate-click, ask, author-news, books, characters, checkout, club-calendar, club-digest, club-invite, club-meetings, content-notes, dictionary, discussion, gift-reminders, kids-report, manage-account, manage-profile, mcp, natural-voice, quiz, recaps, referral-retry, release-emails, stripe-webhook, summaries, translate, unsubscribe, whats-new, year-in-reading. `stripe-webhook` and `referral-retry` carry the referral changes; the rest only pick up the new error codes.
3. **Within minutes of step 2**, back to back: apply 6843, then 160955, 165931 and 174720 (each tried in `begin … rollback` first), then 6844 and 6845. Until 174720 is in, a set-aside event is still recorded for review, without its reason or payload (stripe-webhook falls back when the columns are missing), and can't be replayed: keep this gap to minutes. 160955 is safe on top of either version of 6843 and never runs the cut-over over a decision already made under the 20% rule; 165931 and 174720 are safe to run again.
4. The unique indexes, each on its own and outside a transaction (`CREATE INDEX CONCURRENTLY` can't run in one): `supabase db query --remote=<ref> --yes -f supabase/migrations/20261123165932_referrals_friend_credit_id_indexes.sql`, then the same for `20261123165934_referrals_referrer_credit_id_indexes.sql`. Then check both are valid (a failed concurrent build leaves an invalid index behind): `select c.relname, i.indisvalid from pg_index i join pg_class c on c.oid = i.indexrelid where c.relname in ('referrals_friend_credit_id_key', 'referrals_referrer_credit_id_key');` must show two rows, both `true`; drop and re-create an invalid one. `record_referral_transaction()` refuses a reused id even before they exist.
5. `scripts/promote.sh`.
6. Check the dashboard's *Referral credits held for review* says *Nothing held for review.* Production's `STRIPE_SECRET_KEY` is a standard secret key with full access, so nothing needs adding at Stripe (a restricted `rk_` key would need Customers write, Charges read and Invoices read).

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
- **Connecting apps (the `mcp` function):** production needs the function setting `MCP_SITE=https://www.literaryworm.com` (the site serves `/mcp` through `vercel.json`, so that's the address members use and the OAuth issuer). The dev branch has no such setting and answers at its own address (`https://xjvisabdztxvnsglysdh.supabase.co/functions/v1/mcp`; point the command line at it with `LITERARYWORM_URL`); set `MCP_CONSENT_ORIGIN` there to the dev site's address, or its consent page opens on the live site. Publish `cli/` to npm (`literaryworm`) before a release whose Help or What's new tells members to run `npx literaryworm`.
- **Data:** the dev branch's policies and What's new were copied from production on 31 October 2026. Do it again whenever they drift: export `legal_pages` and `changelog_entries` from production and upsert them on the dev branch.
