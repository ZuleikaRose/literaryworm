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
| — | Book-out emails | `release-emails` function, called every hour by pg_cron with a Vault secret: `claim_release_emails()` marks due reminders (`release_reminders.emailed_at`) and the function emails each account once through Mailgun's API (`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`), handing back any Mailgun refuses; `account_private.release_emails` switch in Account → Preferences; Privacy Policy updated; migrations 2900–3000 |
| — | Club invites by email | `club-invite` function (members only): `record_club_invite()` checks membership, a full club, 10 a day and one per address per club a week, keeping only a sha256 fingerprint (`club_invites`, 30 days, pg_cron cleanup); the email (Mailgun API, shared `_shared/mailgun.ts`) links to `/clubs/join/:code`, which joins after sign-in; Privacy Policy updated; migrations 3100–3200 |

After Phase 10 the app was deployed to Vercel. Two fixes followed: the Vercel URL was added to the `ALLOWED_ORIGINS` function setting (without it every book row said "You seem to be offline"), and the `books` function now asks Google again with plain words when its genre (`subject:`) or title (`intitle:`) filters return nothing.

The app was then renamed LiteraryWorm and moved to www.literaryworm.com (the app folder is `front_end/literaryworm_app`, Vercel's Root Directory). `vercel.json` moved into that folder, which fixed refreshing any page but Home, and genre links now open at the genre's books (`#discover`).

Later, thirteen more genres were added beside the brief's six (Fantasy, Mystery, Thriller, Romance, Classics, Historical Fiction, Young Adult, Children's, Biography & Memoir, History, Science, Self-Help, Poetry): one list in `src/data/genres.ts` (`shelf` marks the six with a Home row each) matched by `GENRES` and `GENRE_QUERIES` in the `books` function, with a plain-words fallback for each.

Then the plan limits became real: the month's audiobook hours (counted for the household from `reading_days`, checked against the server's total, with listening counted by the clock so a background tab still counts) pause the player, and Read offline devices are counted by the database (`offline_devices`, `claim_offline_device()`), with places freed from Account. The Terms gained the limits and the staff-membership line; the late cancel (`cancel_at` a period on, one more full charge, then *Keep my membership* clearing it) and a repeating promo code were checked against a Stripe sandbox subscription. Favourite genres now come from the nineteen browse genres. Finally, What's new got links of its own on the home page, members' Home, Plans and Account → Help. Then: a heads-up before the listening limit (the player line and an 80% bell alert), Member lookup for customer service (`support_member_lookup()`, recorded in `support_lookups`), a Lighthouse accessibility pass of every new screen (100 each; it also found the bell's *New* label stretching, now fixed) and a real-device checklist for the plan limits. Last, every limit screen links straight to the next plan's checkout, and the home page's layout shift turned out to be a development-server effect (0.022 on the production build). What's new then got a *Minor* filter beside *Major*. Then yearly billing: each plan at ten times its monthly price, chosen on Plans, switched to from monthly in place, with a bell reminder 30 days before the year renews. The bell then gained goals and streaks: a streak ending tonight, a goal within reach, and a goal reached. Search then gained an Author choice beside Title, the footer was grouped into Explore, Help, Your privacy and Legal, and grown-ups got a weekly Kids reading report in Account → Family, with an opt-in Monday email. Last, book clubs got a calendar: meetings the owner schedules, Add to calendar, and an email reminder the day before. Then members could answer each meeting (Going, Maybe, Can't make it) and see who's coming, with meetings in the next day in the bell; yearly members could choose monthly billing from their renewal date (a Stripe subscription schedule); the staff dashboard counted yearly memberships; and grown-ups could give Kids profiles a weekly reading goal, shown in Goals, Account → Family and the Monday report. Author searches then listed the authors they found, each with a Follow button, and a year's gift membership came at the yearly price. The Edge Functions' Deno tests then ran in CI on every push (they caught `billing_cycle_anchor` becoming an object in Stripe's 2026-09-30 API). Next, club owners could change a meeting in place, and members get an email when an upcoming meeting moves or is cancelled; every profile could set a weekly goal; author pages showed how many readers follow them, with a Following tab in My Library; a gift could be bought to start on a later day; and the bell offered yearly billing to monthly members nearly a year in. Standard then grew to 5 profiles and 10 offline devices, and Premium to 12 profiles and 24 devices, at the same prices. After that, moving to a smaller plan asked the household to fit it first (profiles removed, offline devices freed), meeting change emails carried an updated calendar file, author search cards showed follower counts, a gift's buyer was reminded three days before a later start day, and the Kids report grouped Kids profiles by how the week went. The database security checks then ran in full on a Supabase branch of production; they caught a club with an upcoming meeting that couldn't be deleted (fixed) and four stale checks.

The last round closed the gaps in moving down a plan and finished the household features: a profile can be set aside instead of deleted (it keeps everything, doesn't count, and comes back when there's room, by itself when the plan grows), a yearly membership moving to a smaller plan has that plan's room from the day it's chosen, a gift can be emailed to the person it's for, each book club has a calendar feed for its members, and Home lists the most-followed authors. The yearly-to-monthly switch was run again on the Stripe sandbox with the app's prices, and the security checks now run unchanged on a Supabase branch with one script.

Then the two gaps the build notes still named were closed: book club posts can be emailed once a day to members who turn it on (only chapters they've reached, who wrote and how many, never the text; the `club-digest` function), and a browser keeps its device id until sign-out, so a refresh is no longer a new device in *Listen on another device* (the second thing kept in local storage, in the Cookie Policy).

Then 50 more public-domain titles were added (71 in all), each with its LibriVox recording and Project Gutenberg text lined up chapter by chapter by `scripts/build-librivox.py` and `scripts/build-texts.py`.

Then the texts moved to a public Supabase Storage bucket served at the same `/texts/` path, and 250 more titles were added (321 in all).

Then a third 250 titles were added (571 in all), and then 300 more (871 in all).

Then Standard went to $14.99 and Premium to $24.99 a month (ten times that a year), in the app, the database and Stripe; memberships already running keep their price. Basic then went to $9.99 ($99.90 a year) the same way. On 1 November 2026 the prices became Basic $15.00, Standard $20.00 and Premium $30.00 a month (yearly ten times that); on 6 November 2026 they became Basic $30.00, Standard $40.00 and Premium $50.00 (yearly still ten times), with a free week for a first membership, and Standard went to up to 3 profiles; households already over 3 keep theirs until their plan next changes. On 7 November 2026 Premium went to $60.00 a month ($600.00 a year), the same way. Book clubs then learned to read a book a member uploaded (such as a DRM-free EPUB they bought): the club keeps only the title and author, and every member reads their own copy, so no one's file is ever shared and spoiler protection follows each member's place in it. Choosing the club's book then gained a search by title, author or ISBN (an ISBN is looked up on Google Books and matched by title and author, since neither the catalog nor uploads keep ISBNs), a Sort by (title, author, numbers first, series in reading order) and a Series filter, the same for LiteraryWorm books and My uploads. Then cancelling learned to ask why and to offer something that fits before a member goes (pause, a smaller plan, their uploads, Help, or once a month's credit), with counts by reason for billing staff. Gifts then gained gift cards: $25, $50 or $100 of credit for any plan, redeemed into the account's Stripe balance. Then the player gained bedtime listening: a dim view that sets the sleep timer and fades the sound out, suggested to Kids profiles before bedtime. Uploads then learned to read PDFs (with pdf.js) and DRM-free Kindle books (MOBI, AZW3) in the browser, into text like EPUBs. Character voices (6726–6728) let natural voices hand speech in uploads to other voices, one per named speaker. A speed for each book (6731–6732). Bedtime in the Kids reading report (6733–6735). Theme challenges (6736–6737). Notes as a PDF (6738–6739).

Then Search gained a third *Search by* choice, ISBN: the `books` function's new `isbn` mode asks Google Books for the edition, with the ISBN's check digit checked in the browser and in the function; Google Books only, since the catalog keeps no ISBNs.

Then came ten reading tools, built in phases: My words (saving words from the dictionary, with flashcards), exporting notes and highlights, series pages, the time left at the reader's own pace, an Up next queue for audiobooks, badges, keyboard shortcuts in the reader, chapter quizzes written by Claude from one public-domain chapter, following other readers through an opt-in public reader page, and Car mode with Cast. Highlights went from four colours to eight (migrations 6500 to 6507). Car mode later got bigger buttons on phones and tablets, on several rows in the same order as on a computer (What's new, migrations 6629 and 6630). Book clubs then got discussion questions written by Claude for each chapter a reader has reached (the `discussion` function, migrations 6631 to 6633). Car mode got voice control, off until turned on and never on Kids profiles, using the browser's own speech recognition (migrations 6634 and 6635). Clubs got polls for choosing the next book, with the winner starting the next club (migrations 6637 to 6642). High contrast became AAA-strength, following the device's contrast setting and Windows contrast themes (migrations 6643 and 6644).

My library then gained *Sort by* (title, numbers first, author, when added or changed, published date; uploads by date uploaded or title), and the header's search box a *Search by* choice of title, author or ISBN.

Then members could add passkeys in Account → Sign-in (Face ID, Touch ID, Windows Hello, a phone's screen lock, a password manager or a security key), rename and remove them, and log in with one instead of the password, through Supabase Auth's passkey API.

Then releases became dev first: a `dev` branch tested by CI against the Supabase dev branch (given production's policies and What's new), and `scripts/promote.sh`, which moves `main` only when every test passes. Developers and admins can announce planned work with maintenance notices, a banner across the site, and My library sorts by author Z–A as well.

Highlights then went from eight colours to twelve: lime, indigo, brown and grey, shown as two rows of six in the reader's toolbar.
Each book's page then got a private reading journal: dated entries only the profile sees, exported with the notes and highlights.
The Plans cards, the Kids FAQ and Help were then brought up to date with the four.
The public home page then got a tour of the tools (*More than a reader*), and What's new put the most recent change first.
The Google Books calls then got five fallback keys, tried in turn when one is rate-limited or failing, so the book rows keep loading.
My words then gained review: spaced repetition that asks each word again just before it would be forgotten, with Home saying when words are due.
Streaks then got rest days: two a month, used automatically, so one missed day doesn't undo weeks of reading.
Kids profiles can then ask a grown-up for a book that isn't on their shelf; the grown-up answers in Account → Family with the account password, and a yes opens that one book.

The site's description, structured data and sitemap then gave search engines the plans and prices (`lib/seo.ts`).

Then, on 1 November 2026: a gentler sleep timer; notifications on members' devices (Web Push) for release days, club meetings, club posts up to the reader's chapter, the evening streak and Kids book-request answers, each kind a choice; the family shelf; the year as a story for social media; where everyone is in a club; smart lists; six classics in French, German and Spanish, with their own row on Discover and links on Search; reading statistics for each book; and *Previously…*, a spoiler-free recap written by Claude from the chapters before the listener's. Plans, the public home page and its FAQs describe them.

Then highlights review: spaced repetition for highlights in My Library → Notes, like word review, with a nudge on Home.

Then shared highlights in book clubs: members share their own highlights of the club's book, hidden past each reader's chapter like posts.

Then reading plans: "finish this book by a date", with a day's share in minutes at the reader's own pace or pages, and on track, ahead or behind.

Then gifts with books: a gift membership can come with up to 10 LiteraryWorm books, chosen by title or from a list, named in the recipient's email and added to their library when they redeem it.

Then library export: the library as a Goodreads or StoryGraph CSV, made in the browser.

Then OpenDyslexic, a reading ruler and line focus in the reader's Display settings.

Then offline listening on a schedule: keep the next chapters of an audiobook on the device as it plays, on Wi-Fi only if chosen.

Then a second list, built on 1 November 2026, one feature at a time:

- Didn't finish: a fourth library status, with its own tab, that pushes similar books down in recommendations.
- Rereads: Read again on a finished book, counted from the days it was finished.
- Moods and pace: up to three moods and a pace per book, a mood filter, Feel-good picks on Discover and moods on Search.
- Bedtime for Kids profiles: set by a grown-up with the account password, shown as Time for bed.
- Translate a passage in the classics, with Claude, sending only the words selected.
- Audio clips: a link to 15 to 60 seconds of a LibriVox recording, nothing recorded or stored.
- Content notes, written by AI from a book's details, on book pages and under Kids book requests.
- Buddy reads: a book club for two, started from a book's page.

Saved for later: public library lending (Libby or OverDrive) and Kids reading aloud recordings.

Alongside them: a clearer Children's Privacy Notice, every policy in short paragraphs, and schema.org data true to each page.

Then, on 2 November 2026, search grew:

- Search by keywords on Search and in the header: every word anywhere in a book's title, author, narrator, description, genres or series, with a title search's filters, and a few keyword searches to try on Discover and Search.
- Search your uploads in My Library → Uploads by title, author, keywords or ISBN; keywords look through the books' text on the device and link to each page.
- Starting a club, Find a book and Find one of your uploads take a title, author, keywords or ISBN in one box.
- Ahrefs Web Analytics to count visits: no cookies, only with consent, never for Kids profiles, with every policy saying so.

Then, on 2 and 3 November 2026, eight more features, in this order:

- Discussion questions for book clubs: Claude writes 5 to 8 questions about one chapter of a classic, from the text up to that chapter only, kept so every club gets the same ones.
- Voice control in car mode: off until turned on, the browser's speech recognition hears Play, Pause, Back, Forward, the chapters and Exit car mode; never on Kids profiles.
- Polls on a club's next book: the owner offers 2 to 5 titles, members vote, and the winner starts the next club in one step.
- Stronger high contrast: AAA text on black or white, on from the start when the device asks for more contrast, with Windows contrast themes supported.
- The app in seven languages (English, Spanish, French, German, Portuguese, Italian, Dutch), each profile's choice kept on every device; policies and Help stay in English with a note.
- Reading sprints: a 15 to 30 minute session for a household or a book club, with one timer and everyone's pages at the end.
- Refer a friend: a month of their plan free for each of you after the friend's first payment, as Stripe balance credits, up to 2 free months for inviting.
- Gift wishlists: a shared list's page gives it as a gift membership with up to 10 of its books.
- LGBTQIA+ as a twentieth genre to browse, search and filter by, from Google Books.
- The demo keeps up with these: a sample invite link, last night's reading sprints, and a sample wishlist that opens Gifts.

Then, on 3 November 2026:

- Members' Home keeps scrolling: Keep discovering runs on from one genre into the next; visitors to the public home page see a sample of 20 books, then an invitation to log in, join or try the demo.
- The accessibility menu scrolls inside the window (it was cut off on a computer screen) and has an OpenDyslexic switch for the whole app.
- Google Books answers cached in Supabase only as long as Google's cache headers allow, at most 7 days, to follow the Google APIs Terms; nothing kept when Google allows none.

Then, on 4 November 2026, five more, in this order:

- The accessibility menu's settings kept for each profile, on every device.
- The endless feed kept light: only books near the screen are drawn, with Back to top and the genre it has reached.
- Open Library as a second source for book details and covers, so fewer Google Books requests are made.
- An affiliate program: approved affiliates earn 20% of a referred member's first payment as account credit.
- True read-along for three classics: the LibriVox recording lined up with the text word by word (files generated the same day for Alice, Frankenstein and Pride and Prejudice: 102 chapters, 93–99% of words matched).

The same day, a fix from a reader's report: Search's Filters scroll on their own on a computer when they're taller than the window.

Then every Google Books genre: 64 to browse and filter by on Home and Search (every top-level BISAC subject, none repeated), with Kids profiles offered only the genres the sample catalog has. Those genres then keep only books filed under their own subject heading, thin pages top up from the next one, every photo cover has alt text, and the FAQ says which genres there are. Logged-in members get Search in the header menu too, and every page gets a canonical address for search engines. The demo household gets samples for every My Library view but Reminders, then a sample upcoming book with a reminder for that one too. Five more classics get the true read-along (Through the Looking-Glass, A Christmas Carol, The Wonderful Wizard of Oz, Dr Jekyll and Mr Hyde and The Call of the Wild), eight in all.

Then, on 6 November 2026, voices for uploads:

- Listen to an uploaded book: a device voice reads it in the player, and an upload the catalog has with a LibriVox recording offers that recording, read by a person.
- Natural voices from Google Cloud Text-to-Speech (Chirp 3: HD, six voices) for members' uploads, voiced a part at a time as they listen and kept with the upload, within a monthly allowance by plan (Basic 2 hours, Standard 6, Premium 12); never on Kids profiles. The demo's Frankenstein sample is voiced ahead of time in all six, so visitors hear them without any call to Google.
- Then: natural voices in six more languages (later 17: adding Japanese, Chinese, Korean, Hindi, Arabic, Polish, Russian, Turkish, Swedish, Ukrainian and Tagalog), hours left in Account and the bell, played parts kept for offline listening, and a read-along timed by the voice's pauses.

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

- New data goes in a migration in `supabase/migrations/` (RLS on, `(select auth.uid())` policies, column grants, every foreign key indexed with `CREATE INDEX CONCURRENTLY` in its own migration); run `supabase/tests/security_test.sql` (on a scratch database or a Supabase branch, see `supabase/README.md`); regenerate `schema.sql` with `supabase/build-schema.sh` and re-render `drawsql.png`.
- Update the README files and docs for the phase.
- Commit only the phase's files, push to `main`, and stop for feedback before the next phase.
