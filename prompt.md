# Build prompt

The brief given to Claude Code for the LiteraryWorm front end, written as a reusable prompt. It follows the prompt life cycle from the assessment: DEFINE → EXPLORE → PLAN → CODE → REVIEW → COMMIT.

---

## Define

Build a front-end single-page application for **LiteraryWorm** from the wireframes and user stories.

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
| 2 | Who's reading? and profile management | Max 5 profiles (now by plan, up to 12 on Premium); Kids/Teen/All; PIN prompt with lockout after 5 wrong tries; choosing a profile goes to Home |
| 3 | Home | Matches the wireframe Discover screen; technology books and the six genres via the Edge Function; infinite scroll with a Load more fallback; loading, error, empty and end states; rows work by keyboard; carousel pauses; titles respect the age rating |
| 4 | Book details | Matches the wireframe detail screen; `/books/:id` works on refresh; Google data with at least two extra fields; every reader's logs with display name and date; library statuses; logs only for books in the library, removed with the book; ratings; blocked on Kids, mature titles blocked on Teen |
| 5 | Search | Public title-only search (LiteraryWorm titles, then Google through the Edge Function); filters and sort applied server-side; Load more; *Did you mean*; recent searches; Surprise Me; Kids see the catalog only |
| 6 | Library and sign-in | Supabase Auth sign-up, log-in, log-out and password reset; session survives a refresh; plan saved by the `checkout` function; library (`library_items`) and logs saved to Supabase under RLS; Library page with the three statuses; Favorites; custom lists create, rename, delete, reorder; empty states |
| 7 | Reader and player | Reader display (theme, font, size, spacing, margins), chapters, bookmarks, *Mark as finished?*; player speed, ±15s, sleep timer, credit skips; progress and bookmarks saved to Supabase (`reading_progress`, `bookmarks`) and feeding Continue Reading; daily limit enforced; keyboard-operable |
| 8 | Account and polish | Household profiles saved to Supabase (`reader_profiles`, `manage-profile`); Account page (plan and billing, sign-in, preferences, family, privacy with Download my data, help); pause, cancel and restart online and Delete account through a `manage-account` function; *Ask a grown-up* gate on Kids; paused or ended memberships stop reading; accessibility and motion pass |
| 9 | Study tools and listening | Highlights in four colours with notes, saved to Supabase (`highlights`) and listed by chapter; dictionary through a `dictionary` Edge Function (Free Dictionary API, server side); read-along transcript in the player (follows the narration, English or Spanish, size in the accessibility menu); a mini-player that keeps playing while browsing; keyboard-operable throughout |
| 10 | Lists and ratings that last | Favourites, ratings, custom lists and recent searches saved per profile to Supabase (`favorites`, `book_ratings`, `custom_lists`, `custom_list_items`, `reader_profiles.recent_searches`) under RLS; Favorites shows Google titles; share a list by link with a public page that shows only the name, description, profile name and titles (`shared_list`), stop sharing at any time, never from Kids profiles |
| 11 | Listening and summaries | Real narration (LibriVox) for the 17 public-domain titles with their real chapters; a Voice list of the device's British, American and Australian English voices reading the full public-domain text (or sample text); short and detailed book summaries written by Claude through a `summaries` Edge Function and kept in `book_summaries`, for members and the demo; build, lint, `deno test` and a browser check of every path |
| 12 | Reading together and offline | The reader shows the real public-domain text (Gutenberg, tidied); Summary from My Library rows; summaries on Claude Haiku 5.5; your place follows you across devices; a follow-along transcript for device voices; reading goals and streaks (`reading_goals`, `reading_days`, `record_reading()`); book clubs (`book_clubs`, `club_members`, `club_posts`, `join_club()`); Ask the book (`ask` Edge Function, Haiku, spoiler-safe); read and listen offline (service worker); four more public-domain titles (21 in all); migrations 1000–1104, ERD and schema; build, lint, `deno test` and browser checks |
| 13 | A fuller player | The mini-player and the full player share the same controls: previous and next chapter, skip back and forward (5–60 seconds), beginning and end of the book, skip intro and outro (by hand or every chapter), Go to (table of contents, word index of the text, references and bookmarks, a time), volume and mute; the mini-player shows the title and current chapter and keeps the rest in *More*; settings saved per profile (`reader_profiles` player columns); listen on another device (`listening_devices`, `playback_handoffs`, Realtime); migrations 1200–1203, ERD and schema; security tests; build, lint and browser checks at 1440 and 390px |
| 14 | Lock-screen controls | The open audiobook on the lock screen and in the system's media controls (Media Session API): cover (drawn to a PNG), title and chapter; play, pause, skip, seek and previous/next chapter from headphones, watches and cars, the same controls as the mini-player |
| 15 | Install as an app | Web app manifest, any/maskable/Apple icons and shortcuts; *Install the app* in Account → Preferences (the browser's install offer, or Add to Home Screen on Safari); the service worker keeps the manifest and icons (shell v2); Chrome reports no installability errors |
| 16 | Share a quote | *Share as a picture* on each highlight: a 1080×1350 card (quote, cover, title, author, chapter) in the book's colours, light or dark; Share (where the device shares files), Download picture, Copy the quote; drawn in the browser |
| 17 | Reading stats | My Library → *Stats*: Year in Review (time read and listened, books finished against the goal, days read, longest streak, highlights, month by month, busiest month, favourite weekday, top genres and authors, the books); `reading_days.listening_minutes`, `finished_books`, `record_reading()` takes both; migrations 1300–1301 |
| 18 | Smarter recommendations | *Picked for you* and *Because you finished / loved / favourited…* on Home, scored in the browser from the profile's finished books, ratings and favourites (not-for-me pushes down, favourite genres break ties); *More like this* ranked by genre, author and series |
| 19 | Club notifications | New posts arrive live (Realtime on `club_posts`): added to the open club page, counted on club cards, an alert in the corner or a system notification in the background; never for chapters the reader hasn't reached; *Notifications* per club (`club_members.notify`, `last_read_at`, `mark_club_read()`, `club_unread()`); migrations 1400–1401 |
| 20 | Listen along | *Listen together* on a club page: one member leads, others join and hear the same place as the leader plays, pauses, skips and changes speed (`club_listening`, Realtime); carries on while browsing; a second tab takes over cleanly; a session left for two minutes can be taken over; migrations 1500–1501 |
| 21 | Bring your own books | My Library → *Uploads*: an EPUB (no DRM) read in the browser, its text kept in the private `user-books` bucket and listed in `uploaded_books`; opens in the reader with progress, bookmarks and highlights; not on Kids profiles; deleting a profile or account removes the files; migrations 1600–1602 |
| — | Cookie Policy | A full Cookie Policy in the footer (`/legal/cookies`): no cookies of LiteraryWorm's own; what the browser keeps and why; third-party cookies from covers and audio; choices. Legal pages can carry full sections; Your Privacy Choices updated to match |
| 22 | Staff roles and editable policies | Staff roles (admin, editor, developer, billing, customer service, blog) managed by admins in Account → Team access, by email or as an invitation applied at sign-up (`staff_roles`, `staff_invites`); every footer policy written in full and editable in the app by editors and admins (`legal_pages`, with every earlier version kept in `legal_page_revisions`); a FAQ answer on the Google Books API, public-domain books and uploading DRM-free EPUBs; opened uploads keep working offline; Ask the book hidden on Kids profiles; migrations 1700–1706 |
| — | Policies from Termly and consent | The Cookie, Privacy and Accessibility policies and the Terms of Service rewritten from Termly's, and an End User License Agreement, Acceptable Use Policy, Return Policy and Disclaimer added, all adapted to stay true to the app (migrations for the new pages: 29 Oct); Termly's consent banner as the first script, with Google Books covers marked essential; *Consent Preferences* and Termly's request links in the footer |
| — | Stripe billing | Monthly memberships paid on Stripe Checkout (hosted); `stripe-webhook` (signed, idempotent) writes paid memberships; `checkout` and `manage-account` change Stripe first (plan, pause, cancel, billing day with free days, Customer Portal for the card); admins never billed; *Payment failed* and *Add a payment method* in Account; migrations 1800–1902; policies say the account is live and billed monthly |
| — | Playback speed per profile | Speed saved with the other player settings (`reader_profiles.playback_speed`, 0.5–3); the same in the player and mini-player on every device; migration 2000 |
| — | Two-step sign-in | Authenticator-app codes (Supabase Auth MFA, TOTP) turned on and off in Account → Sign-in; the log-in page asks for the code; every member table refuses a password-only session (`second_step_done()`), and so do the functions; migration 2100 |
| — | Authors and narrators | `/authors/:name` and `/narrators/:name` with their titles (and an author's Google Books titles, the `books` function's `author` mode); *Follow* per profile (`follows`, up to 200); Home's *New from people you follow*; migration 2200 |
| — | Remind me | *Remind me* on Google Books titles due on an exact future day (`release_reminders`, up to 100 a profile); *Out now* on Home on the day; My Library → Reminders; migration 2300 |
| — | Google Books preview | Google's embedded viewer on book pages Google allows (`preview` from the `books` function), loaded only on request and marked essential for the consent banner; Cookie Policy updated (migration 2400) |
| — | More search filters | Language (en, es, fr, de, it, pt; Google's `langRestrict`, the `books` function's `lang`) and length (under 200, 200–400, over 400 pages, checked against each edition's page count) for LiteraryWorm and Google results |
| — | Billing history and promo codes | Account lists the last 24 Stripe charges with receipts; the promo code on the membership, and a box to apply a Stripe promotion code (`manage-account` `billing_history`, `promo_code`); Checkout takes promo codes; nothing copied to the database |
| — | Email | Supabase Auth's confirmation and reset emails sent through Mailgun's SMTP in LiteraryWorm's templates (`supabase/templates`); *Send the email again*; links last 1 hour; the Privacy Policy and EULA name Mailgun (migration 2500) |
| — | Staff dashboard | `/dashboard` for billing staff and admins (`pages/Dashboard.tsx`, `loadDashboard()`): totals only from `staff_dashboard()` (security definer, checks the role); migration 2600 |
| — | Gift memberships | `/gifts` (`checkout` gift mode, a one-off Checkout of the plan's product × months), codes made by `stripe-webhook` in `gift_codes`, redeemed once through `manage-account` `gift` (Stripe `trial_end`; a new subscription free until then that cancels without a card); `subscriptions.gift_until`; Privacy and Return policies; migrations 2700–2800 |
| — | Book-out emails | `release-emails` function, called every hour by pg_cron with a Vault secret: `claim_release_emails()` marks due reminders (`release_reminders.emailed_at`) and the function emails each account once through Mailgun's API (`SEND_MAILGUN_EMAIL`, `MAILGUN_DOMAIN`), handing back any Mailgun refuses; `account_private.release_emails` switch in Account → Preferences; Privacy Policy updated; migrations 2900–3000 |
| — | Club invites by email | `club-invite` function (members only): `record_club_invite()` checks membership, a full club, 10 a day and one per address per club a week, keeping only a sha256 fingerprint (`club_invites`, 30 days, pg_cron cleanup); the email (Mailgun API, shared `_shared/mailgun.ts`) links to `/clubs/join/:code`, which joins after sign-in; Privacy Policy updated; migrations 3100–3200 |

After Phase 10 the app was deployed to Vercel. Two fixes followed: the Vercel URL was added to the `ALLOWED_ORIGINS` function setting (without it every book row said "You seem to be offline"), and the `books` function now asks Google again with plain words when its genre (`subject:`) or title (`intitle:`) filters return nothing.

The app was then renamed LiteraryWorm and moved to www.literaryworm.com (the app folder is `front_end/literaryworm_app`, Vercel's Root Directory). `vercel.json` moved into that folder, which fixed refreshing any page but Home, and genre links now open at the genre's books (`#discover`).

Later, thirteen more genres were added beside the brief's six (Fantasy, Mystery, Thriller, Romance, Classics, Historical Fiction, Young Adult, Children's, Biography & Memoir, History, Science, Self-Help, Poetry): one list in `src/data/genres.ts` (`shelf` marks the six with a Home row each) matched by `GENRES` and `GENRE_QUERIES` in the `books` function, with a plain-words fallback for each.

Then the plan limits became real: the month's audiobook hours (counted for the household from `reading_days`, checked against the server's total, with listening counted by the clock so a background tab still counts) pause the player, and Read offline devices are counted by the database (`offline_devices`, `claim_offline_device()`), with places freed from Account. The Terms gained the limits and the staff-membership line; the late cancel (`cancel_at` a period on, one more full charge, then *Keep my membership* clearing it) and a repeating promo code were checked against a Stripe sandbox subscription. Favourite genres now come from the nineteen browse genres. Finally, What's new got links of its own on the home page, members' Home, Plans and Account → Help. Then: a heads-up before the listening limit (the player line and an 80% bell alert), Member lookup for customer service (`support_member_lookup()`, recorded in `support_lookups`), a Lighthouse accessibility pass of every new screen (100 each; it also found the bell's *New* label stretching, now fixed) and a real-device checklist for the plan limits. Last, every limit screen links straight to the next plan's checkout, and the home page's layout shift turned out to be a development-server effect (0.022 on the production build). What's new then got a *Minor* filter beside *Major*. Then yearly billing: each plan at ten times its monthly price, chosen on Plans, switched to from monthly in place, with a bell reminder 30 days before the year renews. The bell then gained goals and streaks: a streak ending tonight, a goal within reach, and a goal reached. Search then gained an Author choice beside Title, the footer was grouped into Explore, Help, Your privacy and Legal, and grown-ups got a weekly Kids reading report in Account → Family, with an opt-in Monday email. Last, book clubs got a calendar: meetings the owner schedules, Add to calendar, and an email reminder the day before. Then members could answer each meeting (Going, Maybe, Can't make it) and see who's coming, with meetings in the next day in the bell; yearly members could choose monthly billing from their renewal date (a Stripe subscription schedule); the staff dashboard counted yearly memberships; and grown-ups could give Kids profiles a weekly reading goal, shown in Goals, Account → Family and the Monday report. Author searches then listed the authors they found, each with a Follow button, and a year's gift membership came at the yearly price. The Edge Functions' Deno tests then ran in CI on every push (they caught `billing_cycle_anchor` becoming an object in Stripe's 2026-09-30 API). Next, club owners could change a meeting in place, and members get an email when an upcoming meeting moves or is cancelled; every profile could set a weekly goal; author pages showed how many readers follow them, with a Following tab in My Library; a gift could be bought to start on a later day; and the bell offered yearly billing to monthly members nearly a year in. Standard then grew to 5 profiles and 10 offline devices, and Premium to 12 profiles and 24 devices, at the same prices.

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
