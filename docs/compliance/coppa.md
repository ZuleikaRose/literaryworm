# COPPA: children's information

LiteraryWorm's written information security program and data retention policy for children's personal information, as the amended COPPA Rule (16 CFR Part 312, compliance from 22 April 2026) requires, and the checklist that keeps the public notice true. The public side is the **Children's Privacy Notice** (`/legal/childrens-privacy`, `src/data/legalPages.json`, seeded and updated by migrations; last 6831), linked in the footer's Privacy group and from the profile editor's consent box.

This is not legal advice. Have a lawyer review it, and the notice, before relying on them.

## Scope

Every **Kids profile** is treated as a child under 13, whatever the child's age. Grown-up and Teen profiles are not child-directed, and account holders must be 18 or older (`private.enforce_adult_account()`).

## Responsible person

- **Operator:** LiteraryWorm. Privacy contact: usprivacy@literaryworm.com.
- **Responsible for this program:** _name to be added_ (the person who answers usprivacy@ and approves changes to Kids features).
- **Still to add:** a postal address or telephone number for the operator, in the notice's *Questions* section and the Privacy Policy (section 20). Email only for now (decided 2026-11-10).

## Verifiable parental consent

- **Method:** a card payment on the account, the FTC's "credit card, debit card or other online payment system that provides notification of each discrete transaction to the primary account holder", used in a monetary transaction.
- **How it works:** `stripe-webhook` calls `record_card_payment()` on the first real payment (a membership invoice above $0, or a paid Checkout: membership, natural-voice hours, a gift purchase or a gift card), setting `account_private.card_payment_at` once (migration 6830). `create_kids_profile()` and `set_profile_age_rating(..., 'kids')` refuse without it and record `parental_consents.method = 'card_payment'` with the notice version (`CHILDREN_NOTICE_VERSION` in `src/data/legal.ts`). The profile editor explains it when `Account.kidsConsentVerified` is false.
- **Not enough on its own:** a free week, a gift membership someone gave the account, a $0 invoice paid by a credit. Staff accounts are never billed, so they can't add Kids profiles.
- **Before 10 November 2026:** consents were confirmed with the account password (`method = 'account_password_confirmation'`). At the switch-over production had no active Kids consents (checked 2026-11-10), and the live Stripe account had no payments yet, so no backfill of `card_payment_at` was needed and no family had to consent again.
- **Withdrawal:** moving a profile off Kids, or deleting it, sets `withdrawn_at`.

## What is collected, and sharing

The notice's *What a Kids profile collects* and *What we never collect* are the source of truth; keep them equal to the tables. Nothing about a child is disclosed to third parties. Service providers handle it only to run the service: Supabase (database, storage, functions), Vercel (hosting), Mailgun (the Kids report and Year in reading emails, only when the parent turns them on). Anthropic and Google receive only a book's own words or details. Ahrefs Web Analytics is off while a Kids profile is active (`applyAnalytics()`); Google Books doesn't load on Kids profiles.

## Data retention policy

| Information | Kept | How it's removed |
| --- | --- | --- |
| The profile, its reading, time, learning and family activity | While the profile exists | Deleted with the profile (`manage-profile` delete) or the account (`manage-account`), cascading |
| Reading sprint pages | 90 days | pg_cron `reading-sprints-cleanup` |
| Natural-voice reading per profile, per month | 12 months | pg_cron `natural-voice-profile-usage-cleanup` |
| Consent records (`parental_consents`) | While the account exists, for proof of consent | Deleted with the account |
| Provider backups | Until the provider's backup expires | Never restored into the service except to recover from a failure |
| Anything collected without consent | Deleted as soon as we learn of it | By hand, from usprivacy@ |

## Security program

Safeguards in place:

1. **Access rules.** Row Level Security on every table, `(select auth.uid())` policies, column-level grants, the second-step restrictive policy (`second_step_done()`). Only the account reads its profiles' data. Support lookup (`support_member_lookup()`) returns counts, never a profile's name, library or reading.
2. **Least privilege for the server.** Kids changes go through `manage-profile` with the account password; service-role functions are granted to `service_role` only.
3. **Encryption.** HTTPS everywhere; Supabase encrypts data at rest.
4. **Account protection.** Two-step sign-in and passkeys; profile PINs stored as one-way hashes, verified on the server.
5. **No third-party trackers** on Kids profiles; no advertising anywhere.
6. **Providers.** Only the providers listed above handle children's information, under their data processing terms.
7. **Testing.** `supabase/tests/security_test.sql` on a Supabase branch (`run-on-branch.sh`); webhook and function tests in CI.

Review this program **at least once a year**, and whenever a change touches Kids profiles: what's collected, who receives it, how long it's kept, or how consent is given. Record each review below.

## Keeping it up to date

When a change touches Kids profiles, in the same commit:

1. Update the Children's Privacy Notice in `src/data/legalPages.json` and add a migration that applies the same text (the edit trigger keeps the old version).
2. If what's collected, shared or kept changes materially, bump `CHILDREN_NOTICE_VERSION` and say so on What's new. Ask a lawyer whether parents must consent again.
3. Update the tables above, the Privacy Policy (section 10 and section 18) and Help.
4. Add an entry to the review log.

## Review log

| Date | What changed |
| --- | --- |
| 2026-11-10 | Program written. Consent verified by card payment (6830). Notice names COPPA, adds sharing, retention and security (6831). No Kids profiles or payments on production yet, so nothing to backfill or re-consent. Open: responsible person's name, postal address or phone, lawyer review. |
