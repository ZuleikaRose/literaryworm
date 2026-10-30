# LiteraryWorm (front end)

Live at [www.literaryworm.com](https://www.literaryworm.com).

A single-page app for reading ebooks and listening to audiobooks, built from the Figma wireframe in
`../BookWorm_web_app_wireframe` and the blueprint in `../user_journey.md` and `../../user_stories.md`.

- **Stack:** React 19, TypeScript (strict), Vite, React Router DOM (`BrowserRouter`, declarative routes).
- **Data:** members' accounts, household profiles (with their favourites, ratings, lists and searches), libraries, logs,
  reading progress, bookmarks and highlights are saved in
  Supabase, and the session is kept so a member stays signed in. Everything else (and the whole demo household)
  lives in memory (React Context + `useReducer`), so **a refresh resets it**. Book lists come from the `books` Supabase Edge Function (`src/lib/booksApi.ts`),
  which is the only thing that talks to Google Books. Without `VITE_SUPABASE_URL` set, the sample catalog is used.
- **Environment:** copy `../../.env.example` to `.env.development.local` and fill in the Supabase URL and
  publishable key (both public). Never put a secret in a `VITE_` variable.
- **Catalog:** 29 sample titles in `src/data/books.ts`. Covers are drawn in CSS. Narrator names, sample logs and
  synopses are sample content. Other titles are Google Books volumes from the `books` Edge Function; their
  public reader logs come from Supabase (`src/lib/logsApi.ts`).

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and production build
npm run lint
npm test         # unit tests (Jest)
npm run test:e2e # end-to-end smoke tests (Jest driving Chromium)
```

Use **Try the demo** on the sign-in page to get a household with three profiles: Avery (All), Sam (Teen) and Mia (Kids).

## Routes

| Route | Page | Access |
| --- | --- | --- |
| `/`, `/?genre=…` | Landing: technology row and the infinite genre feed | Public |
| `/plans` | Plans and pricing | Public |
| `/signin`, `/signup` | Log in, sign up (Supabase Auth), demo (in memory) | Public |
| `/reset-password` | Choose a new password from an emailed reset link | Reset link |
| `/legal/:slug` | Policies and help (editors and admins can edit them here) | Public |
| `/books/:id` | Book details (catalog id or Google Books volume id); `/book/:id` redirects | Public (actions need a profile) |
| `/profiles` | Who's reading? | Signed in |
| `/browse`, `/browse?genre=…` | Home: carousel, rows, infinite genre feed | Profile chosen |
| `/authors/:name`, `/narrators/:name` | An author's or narrator's titles on LiteraryWorm (and an author's on Google Books), with Follow | Public (Follow needs a profile) |
| `/search` | Title search with filters (`?q=&genre=&sort=&source=&lang=&length=`) | Public (Kids profiles: catalog only) |
| `/library` | My library (`?status=`), Favorites (`?view=favorites`), custom lists (`?view=lists`), Reminders (`?view=reminders`), Uploads (`?view=uploads`), Goals, Stats (`?view=stats`) and Clubs | Profile chosen |
| `/account` | Plan and billing, sign-in, preferences, family, privacy, help, delete account (Kids profiles ask a grown-up first) | Profile chosen |
| `/gifts` | Buy a gift membership, your gift codes, and redeem one | Signed in |
| `/clubs/join/:code` | Where a club invitation email links: joins the club with its code, then opens it | Profile chosen (visitors sign in first and come back) |
| `/dashboard` | Staff dashboard: totals for accounts, memberships, reading and clubs | Profile chosen; billing staff and admins |
| `/lists/:slug` | A custom list shared by link: name, description, the profile's name and its books | Public |
| `/read/:id`, `/listen/:id` | Reader (with highlights, notes and the dictionary) and audiobook player (with the read-along transcript); full screen, loaded on demand; LiteraryWorm titles the profile may see | Profile chosen |

## Source layout

```
src/
  components/   Header, Footer, TabBar, AccessibilityMenu, ProfileMenu, Cover, BookCard, BookTile, Shelf,
                BookFeed, GenreNav, FeaturedCarousel, Icon, Avatar, ReadingParts, ReaderDisplayDialog,
                ProfileEditor, PinDialog, Dialog, StudyTools (selection toolbar, highlights, dictionary), Transcript,
                PlaybackProvider (the audiobook that's playing), MiniPlayer, SavedBookTile
  data/         books, plans, sample logs, sample reader text, legal pages
  layouts/      SiteLayout, ImmersiveLayout, route guards, AppEffects
  lib/          booksApi (Edge Function client), accountApi (Supabase), useBookFeed (load more),
                useLibrary, useReading (progress and bookmarks), useProfiles (household), useAccount
                (membership, delete, download), useHighlights, highlights (page offsets), useCollections (favourites, ratings, lists, searches),
                collections (limits, share links), sharedListApi, dictionaryApi (Edge Function
                client), playback (usePlayback), transcript (timed sentences), useDailyLimit, reading (positions),
                billing (dates), hooks
  pages/        one file per route
  store/        state shape, reducer, context hooks
  styles/       tokens (from the wireframe), base, shell, covers, pages, reader, account, study
```

## Build phases

Each phase ends with Playwright screenshots (in `docs/screenshots/`), a Chrome DevTools console and
Lighthouse check, a clean `npm run build`, `npm run lint`, `npm test` and `npm run test:e2e`, and a commit.

| Phase | Scope | Status |
| --- | --- | --- |
| 0 | Foundation: scaffold, tokens, shell, store, catalog, routes | Done |
| 1 | Landing, Plans, Sign up / Sign in, demo | Done |
| 2 | Who's reading? and profile management | Done |
| 3 | Home rows, featured carousel, technology and genre lists with infinite scroll | Done |
| 4 | Book details (Google data and catalog), public reader logs, library statuses, write/edit/delete logs, ratings, More like this | Done |
| 5 | Public title search, filters (source, genre, sort), Did you mean, recent searches, Surprise Me | Done |
| 6 | Supabase Auth (sign up, log in, log out, reset), library and logs saved in Supabase, Library page with statuses, Favorites and custom lists | Done |
| 7 | Reader and audiobook player: display settings, chapters, bookmarks, Mark as finished?, speed, ±15 s, sleep timer; progress and bookmarks in Supabase; Continue reading; daily limit | Done |
| 8 | Household profiles in Supabase; Account page (plan, sign-in, preferences, family, privacy, help); pause, cancel and delete account; Ask a grown-up; accessibility pass | Done |
| 9 | Highlights and notes (saved to Supabase), dictionary, read-along transcript (English or Spanish), mini-player; reader and player load on demand | Done |
| 10 | Favourites, ratings, custom lists and recent searches saved per profile; Favorites with Google titles; share a list by link (`/lists/:slug`) | Done |
| 11 | Real narration (LibriVox) for the public-domain titles with their real chapters; device voices; book summaries by Claude (`summaries` function) |
| 12 | Full public-domain text in the reader; Summary in My Library; Ask the book; goals and streaks; book clubs; read offline; picking up on another device |
| 13 | Fuller player: the mini-player and the full player share chapter, skip, beginning/end, skip intro/outro, Go to (contents, index, references, time), volume and mute; player settings saved per profile; listen on another device | Done |
| 14 | Lock-screen and headphone controls (Media Session API; `components/MediaSession.tsx`, cover art from `lib/coverArt.ts`) |
| 15 | Installable app: `public/manifest.webmanifest`, `public/icons`, *Install the app* in Account (`lib/installApp.ts`) |
| 16 | Share a highlight as a quote card (`lib/quoteCard.ts`, `components/QuoteCardDialog.tsx`) |
| 17 | My Library → Stats: Year in Review (`lib/stats.ts`, `components/StatsView.tsx`); listening time and finished books recorded |
| 18 | Picked for you and Because you… rows on Home; More like this ranked (`lib/recommend.ts`) |
| 19 | Club notifications: live posts, new-post counts, alerts and background notifications, per-club setting (`components/ClubAlerts.tsx`, `lib/clubEvents.ts`) |
| 20 | Listen along in clubs (`components/ListenAlong.tsx`, `lib/listenAlong.ts`, `lib/listenAlongApi.ts`) |
| 21 | My Library → Uploads: EPUBs read in the browser (`lib/epub.ts`), kept in Storage, opened in the reader (`lib/useUploads.ts`, `components/UploadsView.tsx`) |
| — | Cookie Policy at `/legal/cookies`, in the footer; legal pages can be written in full (`src/data/legal.ts`) |
| 22 | Staff roles and Account → Team access (`lib/staff.ts`, `lib/staffApi.ts`, `components/TeamAccess.tsx`); editable policies (`lib/useLegalPages.ts`, `components/LegalEditor.tsx`, built-in copy in `data/legalPages.json`); FAQ on where the books come from; offline uploads (`lib/uploadCache.ts`) |
| — | Disclaimer at `/legal/disclaimer`, in the footer; the Cookie, Privacy and Accessibility policies rewritten from Termly's |
| — | End User License Agreement at `/legal/eula`, in the footer after the Terms of Service, from Termly's, adapted to a web app |
| — | Terms of Service rewritten from Termly's, keeping our own sections and their narrow licence for what members post |
| — | Acceptable Use Policy at `/legal/acceptable-use`, in the footer after the EULA, from Termly's; reports go to report@literaryworm.com |
| — | Return Policy at `/legal/returns`, from Termly's: no payment yet, then all sales final |
| — | Admin accounts never billed: Account → Plan and billing shows a complimentary membership with no next charge; Plans offers admins no paid plan |
| — | Termly consent banner (first script in `index.html`), *Consent Preferences* in the footer; Google Books covers marked essential so they load when visitors decline |
| — | Playback speed saved per profile with the other player settings (`reader_profiles.playback_speed`, migration 2000) |
| — | Two-step sign-in: Account → Sign-in turns it on or off (authenticator app, QR code or key); the log-in page asks for the code (`lib/accountApi.ts`, `pages/SignIn.tsx`); the database and functions refuse a password-only session (migration 2100) |
| — | Author and narrator pages with Follow (`pages/Person.tsx`, `lib/people.ts`, `lib/useFollows.ts`); names on a book page link to them; Home's *New from people you follow*; follows saved per profile (`follows`, migration 2200); the `books` function's `author` mode |
| — | Remind me for books not out yet (`components/RemindMe.tsx`, `lib/release.ts`, `lib/useReminders.ts`): on Google Books titles with a future release day; Home's *Out now* and My Library → Reminders (`components/RemindersView.tsx`); saved per profile (`release_reminders`, migration 2300) |
| — | Google Books preview on the book page (`components/GooglePreview.tsx`): Google's embedded viewer, loaded only when opened, for titles the `books` function reports as embeddable (`preview`); Cookie Policy updated (migration 2400) |
| — | Search filters for language (Google's `langRestrict`, the `books` function's `lang`) and length (page count, checked in `lib/booksApi.ts`) (`lib/search.ts`, `components/SearchFilters.tsx`) |
| — | Email through Mailgun (Supabase Auth's SMTP): confirmation and reset emails from `supabase/templates`; *Send the email again* on sign-up and log-in (`components/ResendConfirmation.tsx`, `resendConfirmation()` in `lib/accountApi.ts`); Privacy Policy and EULA updated (migration 2500) |
| — | Billing history and promo codes in Account → Plan and billing (`components/BillingHistory.tsx`; `billingHistory()` and `redeemPromoCode()` in `lib/accountApi.ts`, through `manage-account`); promo codes on Stripe Checkout |
| — | Staff dashboard (`pages/Dashboard.tsx` at `/dashboard`, `loadDashboard()` in `lib/staffApi.ts`): totals for billing staff and admins from `staff_dashboard()` (migration 2600); *Open the dashboard* in Account → Team access |
| — | Gift memberships (`pages/Gifts.tsx`, `components/RedeemGift.tsx`, `lib/gifts.ts`; `buyGift()`, `myGifts()`, `redeemGift()` in `lib/accountApi.ts`): a one-off Stripe Checkout through `checkout`, codes made by `stripe-webhook` (`gift_codes`), redeemed once through `manage-account`; Account shows the free months (`subscriptions.gift_until`); migrations 2700–2800 |
| — | Book-out emails: when a book a profile set Remind me on comes out, the account holder gets one email (the `release-emails` function, called hourly by pg_cron, sends through Mailgun's API); *Email me when a book I'm waiting for comes out* in Account → Preferences (`setReleaseEmails()` in `lib/accountApi.ts`, `account_private.release_emails`); Remind me says when an email will come too; migrations 2900–3000 |
| — | Club invites by email: *Invite by email* on the club page (`InviteByEmail` in `pages/Club.tsx`, `inviteByEmail()` in `lib/clubsApi.ts`) through the `club-invite` function; the email links to `/clubs/join/:code` (`pages/JoinClub.tsx`); only a fingerprint of the address is kept (`club_invites`); the club page no longer scrolls sideways on phones; migrations 3100–3200 |
| — | Unit tests with Jest (`npm test`, `jest.config.js`; SWC compiles the TypeScript): `src/lib/*.test.ts` for paging, highlights, goals and streaks, stats, release dates, search and recommendations. Snapshots in `src/lib/__snapshots__` guard paging of the public-domain texts, which saved highlights rely on; update them (`npx jest -u`) only when paging is meant to change, knowing saved highlights move. Tests type-check through `tsconfig.test.json` |
| — | Notification bell (`components/NotificationBell.tsx`, `lib/useNotifications.ts`, `lib/notifications.ts`): released reminders and unread club posts up to the reader's chapter; opening it calls `markNotificationsSeen()` (`mark_notifications_seen()`, migration 3300) so every device agrees |
| — | New from authors you follow (the `author-news` function, migration 3400): in the bell (`ProfileData.authorNews`, loaded with the collections) and a Monday email, switched off in Account → Preferences (`setAuthorEmails()`); deleting an account sends a confirmation email (`manage-account`) |
| — | The 48-hour cancellation rule (`cancellationEnd()` in `lib/billing.ts` and the `manage-account` function; `subscriptions.cancel_at`, migration 3500): stated in Account → Plan and billing, the cancel dialog, the Plans renewal terms, the Terms and the Return Policy; promo codes show the price once they end (`afterDiscountLabel()`) |
| — | Every staff role is complimentary, not only admin (migrations 3600–3601): the new Sales role in `lib/staff.ts`; Account, Plans, Gifts and Team access say staff are never charged; `checkout` and `stripe-webhook` check any role (`isStaff`) |
| — | End-to-end smoke tests with Jest (`npm run test:e2e`, `jest.e2e.config.js`, `e2e/`): the Playwright library drives Chromium against Vite in `e2e` mode (no `.env` files, so no Supabase: the demo and the sample catalog), with every request to another site refused and any console error failing the test. They cover landing and Plans, search to a book page, a policy page, the demo's Discover, the bell, reading and turning a page, the player, cancelling under the 48-hour rule, the Preferences email switch, and no sideways scrolling at 390px. GitHub Actions runs build, lint, unit and e2e tests on every push (`.github/workflows/ci.yml`). They found the phone header overflowing with a fallback font, now fixed |
| — | Share your year: My Library → Stats → *Share as a picture* (`lib/yearCard.ts`, `components/YearCardDialog.tsx`), a 1080 × 1350 card in dark or light; the quote card and it share `components/ShareImage.tsx` |
| — | Household challenges in My Library → Goals (`components/ChallengesView.tsx`, `lib/challenges.ts`, `lib/challengesApi.ts`, `lib/useChallenges.ts`; `household_challenges`, `challenge_participants`, migrations 3700–3703) |
| — | Import from Goodreads or StoryGraph in My Library (`lib/importCsv.ts`, `components/ImportDialog.tsx`): the CSV read on the device, matched to the catalog or Google Books, reviewed, then added with statuses and ratings, never counting old reads towards this year |
| — | Who's who in the reader (`components/CharactersDialog.tsx`, `lib/charactersApi.ts`; the `characters` function and `book_characters`, migrations 3800–3801): the characters met so far in a public-domain title, written by AI from the text up to the open chapter, never anyone met later |
| — | What's new at `/whats-new` (`pages/WhatsNew.tsx`, `lib/changelog.ts`, `lib/changelogApi.ts`, `data/changelog.json`) with in-place editing for editors and developers; the opt-in monthly email (Account → Preferences) and `/unsubscribe` (`pages/Unsubscribe.tsx`); migrations 3900–3903 |
| — | More genres: thirteen beyond the brief's six (`data/genres.ts`, `shelf` marks the six with a Home row), in Home's and Search's genre links and Search's Genre filter; the `books` function accepts them (`GENRES`, `GENRE_QUERIES`) |
| — | Plan limits: `lib/planLimits.ts`, `lib/useListeningAllowance.ts` (pauses the player at the month's hours), `lib/offlinePlaces.ts` (each Read offline device takes a place; `claim_offline_device()`), `components/PlanUsage.tsx` in Account; migrations 4100–4103 |
| — | Favourite genres from all nineteen (`favouriteGenreLabel()`, `inFavouriteGenre()` in `data/genres.ts`), Home rows for up to two favourites, sample titles tagged with the new genres |
| — | What's new links on the home page, members' Home and Plans (`components/WhatsNewLink.tsx`) and in Account → Help |
| — | Listening heads-up (player line, 80% bell alert: `listeningAlert()` in `lib/planLimits.ts`), Member lookup at `/support` (`pages/Support.tsx`, `lookupMember()` in `lib/staffApi.ts`) for customer service, accessibility pass, `docs/qa/plan-limits-device-check.md`; migrations 4200–4204 |
| — | Move up a plan in one tap: `nextPlanUp()` and `planCheckoutPath()` in `lib/planLimits.ts`, used by the used-up message, the bell alert, `PlanUsage` and `OfflineBook`; migration 4300 |
| — | What's new: a *Minor* filter (every change not marked major) beside *Major* |
| — | Yearly billing: `Plan.yearlyPrice`, `priceFor()` in `data/plans.ts`, the Monthly/Yearly choice on Plans (`?billing=yearly`), `Account.billingInterval` and `renewsAt`, `renewalReminder()` in `lib/billing.ts` on the bell; migrations 4400–4402 |
| — | Goals and streaks in the bell: `goalAlerts()` in `lib/goals.ts` (streak from 6 pm, close to the goal, goal reached), *Your reading* in `NotificationBell`; migration 4500 |
| — | Search by author: `SearchParams.by` (`by=author`), `wordsMatch()` and `unfiltered()` in `lib/search.ts`, the author feed with `loose` in `lib/booksApi.ts`; migration 4501 |
| — | Footer in four labelled columns (`components/Footer.tsx`: Explore, Help, Your privacy, Legal; footer pages placed by slug); migration 4502 |
