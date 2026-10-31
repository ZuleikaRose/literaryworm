# LiteraryWorm

Build **LiteraryWorm**, a Netflix-style book browsing app where anyone can discover books and read other readers' logs, and signed-in users can build a personal library and write logs about what they read.

You will build and deploy this application yourself using **Claude Code**. You are responsible for everything that ships, including the parts Claude Code wrote for you.

Deployed on Vercel at <https://www.literaryworm.com/> (LiteraryWorm is the name of the business and the app; `literaryworm.com` redirects to `www`).

<a href="https://docs.google.com/spreadsheets/d/12VXSh01Toe5lbbHTBuJ8mdwhuV3GgaMA5phU_EbEntw/edit?usp=drive_link" target="_">**RUBRIC**</a>

---

## Tech Stack (required)


| Layer                              | Technology                                              |
| ------------------------------------ | --------------------------------------------------------- |
| Hosting                            | Vercel                                                  |
| Frontend                           | Vite + React, React Router DOM                          |
| Backend                            | Supabase                                                |
| Database                           | Supabase PostgreSQL                                     |
| Auth                               | Supabase Auth                                           |
| CRUD API                           | Supabase PostgREST (via `supabase-js`)                   |
| Business logic / third-party calls | Supabase Edge Functions                                 |
| Third-party API                    | [Google Books API](https://developers.google.com/books) |

**Out of scope:** WebSockets, Supabase Realtime channels, Redis, and caching layers. Data does not need to update live; a page refresh is fine.

---

## The Challenge

The core challenge is not just building CRUD screens. It is building an application that:

1. Talks to a third-party API **without ever exposing your API key**
2. Protects user data with **database-level authorization** (Row Level Security), not just hidden buttons
3. Is **deployed** and works from a fresh browser

You will need to read the Google Books API documentation to figure out how to query it. We will not tell you which parameters to use.

---

## Functional Requirements

### Public (no login required)

**Home page**

- Displays books related to **"technology"** in a browsable, Netflix-inspired layout (cover, title, and author(s) at minimum).

**Search**

- Users can search for books by **title only**. Searching by author, ISBN, or keyword is not part of this app.

**Genre filtering**

- Users can browse books by genre. The required genres are:
  - Adventure
  - Technology
  - Horror
  - Sci-Fi
  - Fiction
  - Non-Fiction
- Figuring out how to translate each genre into a Google Books request is part of the assessment.

**Load more**

- Any list of books (home, search results, genre results) must support loading additional results. Implement it either as a **"Load More" button** or as **automatic loading when the user reaches the bottom of the page**. Be mindful that the API limits how many results come back per request.

**Book details page**

- Clicking a book navigates to its own route (for example, `/books/:id`) that shows:
  - Book details from the Google Books API (title, author(s), description, cover image, and at least two additional fields of your choice)
  - **Logs written by all users** for that book, showing the author's display name and date
- The page must work when visited directly by URL or refreshed.

### Authenticated users

**Sign up / login / logout**

- Email and password via Supabase Auth.
- Every user must have a **profile with a display name**. Logs show the display name, never the email address.

**My Library**

- Users can add a book to their library (from the details page or elsewhere) and remove it.
- Each library entry has a **reading status** (`want to read`, `reading`, `finished`) that the user can change. This is the library's "update" operation.
- A library is **private**. Users can only see and manage their own.

**Logs**

- From a book in their library, users can write logs about what they have read and what they think of it.
- Each log has a body of text and an optional 1-5 rating.
- Users have **full CRUD on their own logs** and can only **view** other users' logs.
- A log can only exist for a book that is in its author's library. This must be enforced **in the database**, not only in the UI.
- If a book is removed from a library, its logs are deleted with it.

---

## Data Model (minimum)

You will design the exact schema, but it must include at least these tables:


| Table           | Purpose                                                        |
| ----------------- | ---------------------------------------------------------------- |
| `profiles`      | One row per user. Display name, linked to the auth user.       |
| `library_items` | A user's saved books (Google Books volume ID, reading status). |
| `logs`          | A user's written entries about a book in their library.        |

**Design problem to solve:** libraries are private, but logs must be publicly readable on a book's page. Design your schema and policies so the book page can list every user's logs **without** exposing anyone's library.

All tables must have **Row Level Security enabled** with policies that match the rules above.

---

## Edge Function Requirements

All Google Books requests must go through **at least one Supabase Edge Function**. The browser must never call Google Books directly.

Your function(s) must:

- Be callable by **anonymous visitors**. Public pages mean you cannot require login, so you must compensate with input validation
- **Validate input**: reject missing or oversized queries and out-of-range page values
- **Shape the response**: return only what the UI needs, not the raw Google payload (for example, handle missing covers and descriptions, and use https image URLs)
- **Handle failure gracefully**: upstream errors, rate limiting (HTTP 429), and timeouts return a meaningful error, and the UI shows a friendly error state instead of crashing
- Configure **CORS** correctly
- Never expose the API key

---

## Secrets Management (non-negotiable)

You must create **your own** Google Books API key in Google Cloud Console. Do not share keys with classmates.

- The key lives only in a secure and secret location.
- The key must **never** appear in client-side code, in a `VITE_`-prefixed variable, in the deployed JavaScript bundle, in your repo, or in your git history
- Vercel environment variables should contain only the public Supabase URL and anon key
- `.env` files are gitignored
- Include a `.env.example` listing every variable needed, with **no real values**

> **Warning:** Anything prefixed `VITE_` is compiled into the code shipped to every visitor's browser. Claude Code will happily put a secret in the wrong place if prompted carelessly. Review what it writes.
>
> A key that was committed and then deleted is **still leaked**. If it happens, rotate the key and notify the instructional staff when turning in your assessment.

---

## Deployment Requirements

- Frontend deployed on **Vercel**; Edge Functions and database on **Supabase**
- Deep links and page refreshes must work on every route (configure Vercel rewrites for React Router)
- Supabase Auth redirect URLs must be configured for your deployed domain
- A new user must be able to sign up on the deployed site and complete every feature above

---

## Claude Code Workflow (also evaluated)

You must build LiteraryWorm with Claude Code, and **how you use it is graded alongside the application itself.** The finished app is not enough; we are evaluating your process.

### Prompt records (automatic)

Your project includes hooks that run automatically while you work:

- One hook **writes each prompt you send** into the `prompt-records/` directory.
- Another hook **appends your context window status** to those records after Claude Code acts.

Rules:

- Do not edit, disable, delete, or rewrite the hooks or the records. Tampering is an automatic fail.
- Commit `prompt-records/` with your submission. It is part of your deliverables.
- **Never paste secrets into a prompt.** Your records are submitted with your repository, so a key typed into a prompt is a leaked key.

### Required Claude Code configuration

Your repository must include working, project-level configuration that you wrote for this application:


| Component       | Minimum                    | Expectation                                                                                                                                                          |
| ----------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Subagents**   | At least 1 custom subagent | Delegates a focused task, such as reviewing RLS policies, auditing for secrets, or exploring the codebase. It has a clear description and a restricted set of tools. |
| **Skills**      | At least 1 custom skill    | Encodes a repeatable procedure or convention for this project. It is invoked when relevant, not copy-pasted into prompts.                                            |
| **MCP servers** | At least 1 MCP server      | Helps you manage the application, for example its database or deployment. Choose it deliberately and justify it.                                                     |

Be careful with MCP server credentials. The secrets rules above apply to them as well. Tokens must not be committed in your MCP config, repository, or prompts.

### Context management

You will be evaluated on how deliberately you manage Claude Code's context window. We will look for evidence such as:

- A maintained `CLAUDE.md` with project conventions and constraints, not a dump of everything
- Working in focused sessions and clearing or compacting at sensible points
- Delegating noisy or exploratory work to subagents so it does not flood your main context
- Giving Claude only the files, errors, and information a task needs
- Context window status in your prompt records that shows you are keeping usage under control instead of letting it fill up

### Exercise the Prompt Life Cycle

> DEFINE >> EXPLORE >> PLAN >> CODE >> REVIEW >> COMMIT

---

## Deliverables

1. GitHub repository URL
2. Deployed application URL
3. `README` in your repo with setup instructions, including how to run it locally and which secrets are needed
4. `.env.example`
5. `prompt-records/` directory, unmodified
6. Your Claude Code configuration (subagents, skills, and MCP server setup, with no secrets committed)
7. Access to your Supabase project and Github Repository

---

## How You Will Be Evaluated

Your project will be assessed across these areas:

- **Functionality:** every requirement above works on the deployed site
- **Secrets handling:** key placement, bundle, and git history
- **Authorization:** RLS policies and data isolation between users
- **Edge Function quality:** validation, response shaping, error handling
- **Frontend quality:** routing, load-more behavior, loading and error states
- **Data modeling:** a clean schema that solves the library/logs privacy problem
- **Claude Code implementation:** subagents, skills, and MCP servers that are purposeful and working
- **Context management:** evidence of deliberate context window usage
- **Prompt engineering:** the quality and progression of your recorded prompts

### Automatic fail conditions

- The API key is found in the deployed bundle, the repository, or git history
- The browser calls Google Books directly
- The deployed site does not work
- The prompt-recording hooks or records were tampered with, disabled, or are missing
- A secret appears in `prompt-records/` or in committed MCP configuration

---

## Project status and setup

*This section tracks the build. Everything above it is the assessment brief.*

### What's in the repo


| Path                                    | What it is                                                                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `front_end/literaryworm_app/`               | The React + TypeScript + Vite app (React Router DOM, `BrowserRouter`). See its [README](front_end/literaryworm_app/README.md) for routes and source layout.                        |
| `supabase/`                             | Database migrations, Edge Functions (`books`, `manage-profile`, `checkout`, `manage-account`, `stripe-webhook`, `dictionary`, `summaries`, `ask`), Auth email templates and security tests. See [supabase/README.md](supabase/README.md). |
| `schema.sql`                            | The whole database schema, generated from `supabase/migrations/`. Row Level Security on every table.                                                                           |
| `drawsql.png`                           | ERD for `schema.sql`, rendered from [`docs/erd/erd.html`](docs/erd/README.md).                                                                                                 |
| `front_end/BookWorm_web_app_wireframe/` | The Figma Make wireframe the UI is built from.                                                                                                                                |
| `front_end/style_guide.md`              | Design tokens, type, components, motion and voice.                                                                                                                            |
| `front_end/user_journey.md`             | Product blueprint, user journey, build notes, and how the brief and blueprint are both met.                                                                                   |
| `user_stories.md`                       | User stories with a build-status table.                                                                                                                                       |
| `CLAUDE.md`                             | Conventions and rules for Claude Code.                                                                                                                                        |
| `prompt.md`                             | The build brief and phase plan.                                                                                                                                               |

### How the brief's hard parts are handled

- **The API key never reaches the browser.** The front end calls only the `books` Edge Function (`front_end/literaryworm_app/src/lib/booksApi.ts`). The function adds `GOOGLE_BOOKS_API_KEY` from Supabase's function secrets; the key is in no file in this repo and no `VITE_` variable. The Claude key for book summaries works the same way: only the `summaries` function holds it (`ANTHROPIC_API_KEY`).
- **Anonymous visitors, validated input.** `books` needs no login, so it checks every parameter (mode, title query 1–100 characters with no search operators, genre from the list, page 0–19, volume id format), rejects unknown parameters, and rate limits each IP (60 a minute).
- **Shaped responses and friendly failures.** Only the fields the UI shows, with https covers, plain-text descriptions and nulls for missing data. Google's 429s, errors and timeouts (8 s) become `{ error: { code, message } }`; the UI shows *We couldn't load …* with *Try again*.
- **CORS.** An origin allowlist (`ALLOWED_ORIGINS`), `Vary: Origin`, and preflight handling.
- **Real accounts.** Sign up, log in, log out and password reset use Supabase Auth with email and password; new addresses are confirmed by an emailed link and reset links are emailed too (Mailgun, through Auth's SMTP setting), and members can turn on two-step sign-in with an authenticator app. Sign-up sends the display name, date of birth and Terms acceptance; a database trigger checks them (18+) and creates the public `profiles` row, so logs show the display name and never the email. The browser holds only the publishable key and the member's own session.
- **Libraries private, logs public.** `library_items` has owner-only policies. `logs` has a public read policy and a composite foreign key to the author's `library_items` row, so a log can't exist for a book outside its author's library and is deleted with it. The book page reads logs (with `profiles.display_name`) without touching anyone's library.
- **Reading progress stays private too.** `reading_progress` (one row per book) and `bookmarks` are owner-only and tied to the reader's own `library_items` row by the same kind of composite foreign key, so removing a book removes its place and bookmarks. Opening a book adds it to the library as *Reading*; finishing it moves it to *Finished*.
- **Database authorization.** RLS on every table with `(select auth.uid())` policies, column-level grants (for example, no one can read PIN hashes or Stripe ids), every foreign key indexed, and server-only functions callable only by the service role. `supabase/tests/security_test.sql` checks all of this.

### Run it locally

```bash
cd front_end/literaryworm_app
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check and production build
npm run lint
npm test         # unit tests (Jest)
npm run test:e2e # end-to-end smoke tests (Jest driving Chromium)
```

With no environment variables the app runs on its sample catalog. To use the real backend, copy `.env.example` to `front_end/literaryworm_app/.env.development.local` and fill in the two `VITE_` values.

Create an account with **Sign up** to use the real backend: your library and logs are saved in Supabase and you stay signed in after a refresh. Or use **Try the demo** on the log-in page for a ready-made household kept in memory. The demo's email and password are shown on that page; the password is generated fresh on each page load, so none is stored in the code.

### Secrets and environment variables

`.env.example` lists every variable with no values. `.env` files are gitignored.


| Variable                        | Where it goes                                           | Safe in the browser?                                                  |
| --------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`             | `front_end/literaryworm_app/.env.development.local`, Vercel | Yes                                                                   |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same (publishable / anon key)                           | Yes                                                                   |
| `GOOGLE_BOOKS_API_KEY`          | Supabase → Edge Functions → Secrets only              | **No.** Never in a `VITE_` variable, a file in the repo, or a prompt. |
| `ALLOWED_ORIGINS`               | Supabase → Edge Functions → Secrets                   | Not secret; lists the origins allowed by CORS (localhost and literaryworm.com) |
| `ANTHROPIC_API_KEY`             | Supabase → Edge Functions → Secrets only              | **No.** Used only by the `summaries` and `ask` functions to ask Claude. |
| `STRIPE_SECRET_KEY`             | Supabase → Edge Functions → Secrets only              | **No.** A restricted Stripe key for `checkout`, `manage-account` and `stripe-webhook`. |
| `STRIPE_WEBHOOK_SECRET`         | Supabase → Edge Functions → Secrets only              | **No.** Checks the signature on Stripe's webhook calls. |
| Mailgun SMTP (host, user, password) | Supabase → Authentication → SMTP settings only    | **No.** Not an environment variable: Supabase Auth sends its emails with it; nothing in the repo or the functions. |

### Supabase

Project `literaryworm` (ref `ldzdmrdvmacpudsbngvd`, us-east-2). All migrations are applied (checked against the live database: every table and column matches `schema.sql`) and the eight Edge Functions are deployed. Auth sends its emails through Mailgun with the templates in `supabase/templates`. To set it up from scratch:

```bash
supabase link --project-ref <ref>
supabase db push
supabase functions deploy books manage-profile checkout manage-account stripe-webhook dictionary summaries ask --project-ref <ref>
```

Then set `GOOGLE_BOOKS_API_KEY`, `ALLOWED_ORIGINS`, `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` as function secrets, and Mailgun's SMTP details, the email templates and the redirect URLs in Authentication (see [supabase/README.md](supabase/README.md)). `ALLOWED_ORIGINS` must include the Vercel URL as well as `http://localhost:5173`; without it the deployed site's book rows say "You seem to be offline".

If Google Books answers genre (`subject:`) or title (`intitle:`) queries with no results, as it has for hours at a time, the `books` function asks again with plain words, so genre rows and search stay filled (with looser matches) until Google recovers. Details and tests: [supabase/README.md](supabase/README.md).

### Build progress

Accounts, household profiles, libraries, logs, reading progress, bookmarks, highlights and notes, and each profile's favourites, ratings, custom lists, recent searches, player settings, reading time (with the listening part) and finished books, club notification settings and uploaded books are saved in Supabase, and a member stays signed in after a refresh. The rest of the app's state (reader display settings, daily time used, and the whole demo household) is kept in memory, so a refresh resets it. Book lists and details come from the `books` Edge Function, and book summaries (written once by Claude and kept) from the `summaries` function.


| Phase | Scope                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Status  |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| 0     | Foundation: scaffold, design tokens, header/footer/accessibility menu, in-memory store, 29-title sample catalog, routes and guards                                                                                                                                                                                                                                                                                                                                                 | Done    |
| 1     | Landing, Plans and checkout, Sign up (18+, password rules, Terms), Log in, forgot password, demo                                                                                                                                                                                                                                                                                                                                                                                   | Done    |
| 2     | Who's reading? (PIN locks with lockout, Kids consent, plan limits, *Ask a grown-up*), profile management, genre picking                                                                                                                                                                                                                                                                                                                                                             | Done    |
| —    | Supabase: migrations with RLS, indexes and grants; `books`, `manage-profile` and `checkout` Edge Functions; security tests; deployed                                                                                                                                                                                                                                                                                                                                                | Done    |
| 3     | Home: technology books and the six genres from the Edge Function, infinite scroll with Load more, featured carousel, blueprint rows                                                                                                                                                                                                                                                                                                                                                | Done    |
| 4     | Book details (`/books/:id`): Google Books data (publisher, published date, pages, language, categories), every reader's logs from Supabase with display names, library statuses, write/edit/delete logs only for books in the library, ratings, More like this; Kids and mature-title blocks                                                                                                                                                                                       | Done    |
| 5     | Public title-only search: LiteraryWorm titles then Google results with infinite scroll and Load more; filters (source, genre, sort) applied by the Edge Function; Did you mean; recent searches; Surprise Me                                                                                                                                                                                                                                                                           | Done    |
| 6     | Supabase Auth (sign up, log in, log out, password reset; stays signed in); plan saved by the `checkout` function; library (`library_items`) and logs saved in Supabase; Library page with reading status, Favorites and custom lists                                                                                                                                                                                                                                                | Done    |
| 7     | Reader (themes, fonts, sizes, spacing, margins; chapters; bookmarks; *Mark as finished?*) and audiobook player (speed 0.5–3×, ±15 s, chapter skips, sleep timer, credit skips, keyboard shortcuts); progress and bookmarks saved to Supabase (`reading_progress`, `bookmarks`) and feeding Continue reading; daily limit enforced. Sample text and silent audio until book files are licensed                                                                                    | Done    |
| 8     | Household profiles saved to Supabase (`reader_profiles`; Kids, PINs, limits and age ratings through `manage-profile`, PINs checked on the server); Account page: plan and billing (pause, resume, cancel, keep), display name, change password, marketing emails, family, Download my data, help; Delete account through the `manage-account` function (cascades everything); paused or ended plans stop reading; *Ask a grown-up* on Account; accessibility pass (Lighthouse 100) | Done    |
| 9     | Highlights in four colours with notes, saved to Supabase (`highlights`) and listed by chapter; dictionary through the `dictionary` Edge Function (Free Dictionary API, Wiktionary as fallback); read-along transcript in the player (follows the narration, English or Spanish, three sizes, settings in the accessibility menu); mini-player that keeps playing while browsing                                                                                                    | Done    |
| 10    | Favourites, ratings, custom lists and recent searches saved per profile in Supabase; share a custom list by link (public page with only the name, description, profile name and titles)                                                                                                                                                                                                                                                                                            | Done    |
| —    | Vercel deploy at www.literaryworm.com (Root Directory `front_end/literaryworm_app`); the site added to `ALLOWED_ORIGINS`; plain-words fallback in `books` when Google's genre and title filters return nothing | Done    |
| 11   | Real narration for the 17 public-domain titles (LibriVox recordings, real chapters); a *Voice* list of the device's British, American and Australian English voices reading the full Project Gutenberg text (or sample text); short and detailed book summaries for members and the demo, written by Claude through the `summaries` Edge Function and kept in `book_summaries`; the app renamed LiteraryWorm; refresh works on every page; genre links open at the genre's books | Done    |
| 12   | The reader shows the full Project Gutenberg text of the public-domain titles (sample pages for the rest); a *Summary* button on each My Library row opens the book's summary in a dialog; summaries are written by Claude Haiku 5.5 to keep the cost to a fraction of a cent each; your place follows you to another device; a follow-along transcript for device voices; reading goals and streaks (*Goals*); book clubs with invite codes and spoiler-safe discussion (*Clubs*); *Ask the book* (the `ask` Edge Function, Claude Haiku 5.5, answers from the text read so far); read and listen offline (service worker); four more public-domain titles (21 in all); migrations 1000–1104 | Done    |
| 13   | A fuller player: the mini-player shows the title and current chapter and, like the full player, has previous and next chapter, skip back and forward (5–60 seconds), beginning and end of the book, *Skip intro* and *Skip outro* (by hand or every chapter), *Go to* (table of contents, a word index of the text, references and bookmarks, a time), volume and mute; player settings saved per profile (`reader_profiles`); *Listen on another device* sends the book, at its place, to another open device on the account (`listening_devices`, `playback_handoffs`, Supabase Realtime); migrations 1200–1203 | Done    |
| 14   | Lock-screen and headphone controls: the playing book's cover, title and chapter on the lock screen and in the system's media controls, with play, pause, skip, seek and chapter buttons (Media Session API) | Done    |
| 15   | Install as an app: web app manifest and icons, *Install the app* in Account → Preferences (Add to Home Screen on Safari); the installed app opens offline | Done    |
| 16   | Share a quote: any highlight as a picture card (book colours, light or dark) to share, download or copy | Done    |
| 17   | Reading stats: My Library → Stats, a Year in Review of time read and listened, books finished against the goal, streaks, month by month, top genres and authors and the books (`reading_days.listening_minutes`, `finished_books`) | Done    |
| 18   | Smarter recommendations: *Picked for you* and *Because you finished…* on Home, worked out on the device from each profile's finished books, ratings and favourites | Done    |
| 19   | Club notifications: new posts arrive live (Supabase Realtime), are counted on club cards and alert members, never about chapters they haven't reached; a setting per club | Done    |
| 20   | Listen along: a club member leads a listening session and others hear the same place as they play, pause and skip (`club_listening`, Realtime) | Done    |
| 21   | Bring your own books: upload an EPUB (no DRM); its text is kept in a private Storage bucket and opens in the reader with progress, bookmarks and highlights; not on Kids profiles | Done    |
| —    | Cookie Policy in the footer: LiteraryWorm sets no cookies of its own; the page lists what the browser keeps (sign-in session, the app's files, books saved for offline) and why | Done    |
| 22   | Staff roles (admin, editor, developer, billing, customer service, blog) managed by admins in Account → Team access; every footer policy written in full and editable in the app by editors and admins, with earlier versions kept; a FAQ answer on the Google Books API, public-domain books and uploading DRM-free EPUBs; uploads keep working offline once opened | Done    |
| —    | Disclaimer in the footer; the Cookie, Privacy and Accessibility policies rewritten from Termly's, adapted to what the app does | Done    |
| —    | End User License Agreement in the footer, from Termly's, adapted to a web app with no app store or payment | Done    |
| —    | Terms of Service rewritten from Termly's, adapted to what the app does | Done    |
| —    | Acceptable Use Policy in the footer, from Termly's, adapted to what the app does | Done    |
| —    | Termly consent banner and a *Consent Preferences* link in the footer; the Cookie Policy describes them | Done    |
| —    | Return Policy in the footer, from Termly's, adapted to say no payment is taken yet | Done    |
| —    | Copyright/DMCA page: report content, copyright infringement and Acceptable Use questions to report@literaryworm.com | Done    |
| —    | Termly's *Do Not Sell or Share My Personal information* and *Limit the Use Of My Sensitive Personal Information* links in the footer | Done    |
| —    | `drawsql.png` re-rendered and `schema.sql` regenerated; live Supabase checked against both (every table, column, index and migration) | Done    |
| —    | Staff dashboard at `/dashboard` for billing staff and admins: totals only (accounts, memberships by plan, monthly revenue, reading, clubs, Stripe events to review) from `staff_dashboard()` (migration 2600) | Done    |
| —    | Admin accounts are never billed: a complimentary Premium membership set by the database from the admin role (`subscriptions.complimentary`, migration 1800); `checkout` refuses admins and Account shows *Complimentary* | Done    |
| —    | Stripe billing: monthly memberships paid on Stripe Checkout, a signed `stripe-webhook` that writes paid memberships, pause, cancel, billing-day changes and the card through `manage-account`; migrations 1900–1902; the policies now say LiteraryWorm is a live account billed monthly until cancelled | Done    |
| —    | Playback speed saved per profile, like volume and skip lengths, so it follows the member to every device (migration 2000) | Done    |
| —    | Two-step sign-in with an authenticator app: turned on and off in Account (off needs a current code), asked for after the password; until the code is given the database and the Edge Functions refuse everything of the member's (migration 2100) | Done    |
| —    | Author and narrator pages: their titles on LiteraryWorm and (authors) Google Books, with Follow saved per profile; Home shows new titles from the people a profile follows (migration 2200) | Done    |
| —    | Remind me for books not out yet: set on the book page, listed in My Library → Reminders, shown on Home under *Out now* on the day (migration 2300) | Done    |
| —    | Google Books preview: Google's embedded viewer on book pages Google allows, opened only on request; the Cookie Policy now mentions it (migration 2400) | Done    |
| —    | Search filters for language and length, for LiteraryWorm titles and Google Books results alike | Done    |
| —    | Billing history and promo codes: Account lists each Stripe charge with its receipt, shows the promo code on the membership and takes a new one; Stripe Checkout takes promo codes too | Done    |
| —    | Email through Mailgun: sign-up confirmation and password reset in LiteraryWorm's own templates, *Send the email again*, and the Privacy Policy and EULA name Mailgun (migration 2500) | Done    |
| —    | `drawsql.png` re-rendered for migrations up to 2500 (no table or column changes since 2300); `schema.sql` regenerated unchanged; live Supabase checked against both (all 244 columns, every migration); docs, style guide and phase plan cover the eight feature stages | Done    |
| —    | Gift memberships: 1, 3, 6 or 12 months of any plan bought once on Stripe Checkout; the code (`gift_codes`) is redeemed once in Account, Plans or Gifts, adding free months to a membership or starting one with no card; Privacy and Return policies updated (migrations 2700–2800) | Done    |
| —    | Book-out emails: an email on the day a reminded book comes out (the `release-emails` function, hourly through pg_cron, sending with Mailgun's API), switched off in Account → Preferences; Privacy Policy updated (migrations 2900–3000) | Done    |
| —    | Club invites by email: members invite by address from the club page (the `club-invite` function, Mailgun's API); the link `/clubs/join/<code>` joins after sign-in; only a fingerprint of the address is kept, for 30 days; Privacy Policy updated (migrations 3100–3200) | Done    |
| —    | `drawsql.png` and `schema.sql` cover every migration up to 3200 (new: `gift_codes`, `club_invites`; `subscriptions.gift_until`, `account_private.release_emails`, `release_reminders.emailed_at`); the diagram's 260 columns match the database exactly; live Supabase checked against both (columns, types, nullability, indexes and RLS identical); docs and style guide cover the four new features | Done    |
| —    | Unit tests (Jest, `npm test`) for the app's logic: paging, highlights, goals and streaks, stats, release dates, search and recommendations, with a check that the public-domain texts always page the same way so saved highlights stay put | Done    |
| —    | Notification bell: the header counts books from a profile's reminders that came out since it last looked and new club posts up to its chapter, with a panel listing them; seen on one device means seen on all (migration 3300) | Done    |
| —    | New books from authors you follow: found on Google Books by a daily job, shown in the bell and emailed on Mondays (switched off in Account → Preferences; not for Kids profiles); deleting an account now confirms by email; the Privacy Policy lists both emails (migrations 3400–3402) | Done    |
| —    | Cancelling needs 48 hours' notice to stop the next charge (later, the membership ends after one more month; no refunds), enforced in Stripe and stated in Account, at checkout, in the Terms and in the Return Policy; promo codes show the price once they end (migrations 3500–3501) | Done    |
| —    | Staff get a complimentary membership while they hold any role (Admin, Editor, Developer, Billing, Customer service, Blog and the new Sales), set by the database, refused at checkout and never billed in Stripe (migrations 3600–3601) | Done    |
| —    | End-to-end smoke tests with Jest and the Playwright library, on the demo with no network beyond the app, run by GitHub Actions with the build, lint and unit tests on every push | Done    |
| —    | Share your year: Year in Review as a picture to post or download (books, hours, days, streak, covers, top genre and author), drawn on the device | Done    |
| —    | Household reading challenges: the account's profiles take on a goal together (books, hours or days with reading, over a month or 30 days), each one's progress shown from their reading days; private to the household (migrations 3700–3703) | Done    |
| —    | Import from Goodreads or StoryGraph: the export read on the device, each book matched (catalog first, then Google Books with the author checked), reviewed, and added with its shelf and stars; old reads don't count towards this year's goal | Done    |
| —    | Who's who: a spoiler-free list of the characters met so far in a public-domain book, written by Claude from the text up to the reader's chapter and kept per chapter (migrations 3800–3801) | Done    |
| —    | What's new: a public page of every feature, fix and update, written by editors and developers in the app, and a monthly email of the major ones for members who opt in, with one-click unsubscribe (migrations 3900–3903) | Done    |
| —    | More genres: Fantasy, Mystery, Thriller, Romance, Classics, Historical Fiction, Young Adult, Children's, Biography & Memoir, History, Science, Self-Help and Poetry, on Home and in Search | Done    |
| —    | Plan limits enforced: monthly audiobook hours for the household (the player pauses at the limit) and offline devices per plan (checked by the database, freeable in Account); staff memberships in the Terms; the late cancel and promo price checked against a Stripe sandbox subscription (migrations 4100–4103) | Done    |
| —    | Favourite genres from all nineteen, Home rows for favourites beyond the six, and sample titles tagged with the new genres | Done    |
| —    | What's new linked from the home page, members' Home, Plans and Account → Help, not only the footer | Done    |
| —    | A heads-up before the listening limit (player line, 80% bell alert), Member lookup for customer service (read only, recorded; Privacy Policy updated), Lighthouse accessibility 100 on every new screen, and a real-device checklist for the plan limits (migrations 4200–4204) | Done    |
| —    | Move up a plan in one tap from every limit screen; the home page's layout shift checked on the production build (0.022, good) (migration 4300) | Done    |
| —    | What's new: filter by Minor as well as Major | Done    |
| —    | Yearly billing at ten times the monthly price (two months free): a Monthly/Yearly choice on Plans, monthly-to-yearly switches in place, a bell reminder 30 days before a year renews; Terms and Return Policy updated (migrations 4400–4402) | Done    |
| —    | Goals and streaks in the bell: a streak about to end (from 6 pm), one or two books from this year's goal, and the goal reached (migration 4500) | Done    |
| —    | Search by author as well as title (`by=author`), through the `books` function's author mode (migration 4501) | Done    |
| —    | The footer's links grouped under Explore, Help, Your privacy and Legal (migration 4502) | Done    |
| —    | Kids reading report: each Kids profile's week in Account → Family, and an opt-in Monday email (`kids-report` function, pg_cron; Privacy Policy updated) (migrations 4600–4602) | Done    |
| —    | Book club calendar: the owner schedules meetings, members add them to their calendars (.ics) and get an email reminder the day before (`club-meetings` function, pg_cron; Privacy Policy updated) (migrations 4700–4704) | Done    |
| —    | Club meeting RSVPs: members answer Going, Maybe or Can't make it and see who's coming; meetings in the next day show in the bell; no reminder email for members who can't come; the staff dashboard shows yearly memberships (migrations 4800–4803) | Done    |
| —    | Yearly to monthly at renewal: a yearly member chooses monthly on Plans; a Stripe subscription schedule keeps the year and bills monthly from the renewal date; *Keep yearly billing* in Account undoes it; cancelling drops it (Terms updated) (migrations 4900–4903) | Done    |
| —    | Weekly reading goals for Kids profiles: set by a grown-up in the profile editor (account password, `manage-profile`), shown in the child's Goals, Account → Family and the Monday Kids report (Privacy and Children's Privacy Notice updated) (migrations 5000–5002) | Done    |
| —    | Follow authors from search: an author search lists the matching authors above the books, with a Follow button each (migration 5100, What's new only) | Done    |
| —    | Gift a year at the yearly price: a 12-month gift costs the plan's yearly price (two months free); shorter gifts stay monthly price × months (`checkout` function) (migration 5200, What's new only) | Done    |
| —    | Change a club meeting: the owner changes a meeting in place; members get an email when an upcoming meeting moves or is cancelled (`club-meetings` function, now every 10 minutes; Privacy Policy updated) (migrations 5600–5603) | Done    |
| —    | Weekly goals for everyone: grown-up and teen profiles set their own weekly goal in Goals (migrations 5300, 5303) | Done    |
| —    | Followers: author and narrator pages show how many readers follow them; My Library → Following lists who a profile follows (migrations 5400–5403) | Done    |
| —    | Gift start day: a gift can be bought now to start on a later day, up to a year ahead (`checkout`, `stripe-webhook`, `manage-account`; Return Policy updated) (migrations 5500, 5503) | Done    |
| —    | Yearly saving in the bell: monthly members 11 months in see what paying yearly would save (migrations 5700–5701) | Done    |
| —    | Bigger plans: Standard has 5 profiles and Read offline on 10 devices, Premium 12 profiles and 24 devices, at the same prices (Terms updated) (migrations 5800–5802) | Done    |
| —    | Moving to a smaller plan: Plans says how many profiles to remove and offline devices to free first, and `checkout` refuses until the household fits (Terms updated) | Done    |
| —    | Calendar file in meeting change emails: moved and cancelled meetings update members' calendars (`club-meetings`; Privacy Policy updated) | Done    |
| —    | Follower counts in author search (migration 5900) | Done    |
| —    | Gift start reminder: the buyer is emailed three days before a later start day (new `gift-reminders` function, daily; Privacy and Return Policy updated) (migration 6000) | Done    |
| —    | Kids report in groups: Account → Family and the Monday email group Kids profiles by how the week went (`kids-report`) | Done    |
| —    | Database security checks run in full on a Supabase branch; fixed deleting a club with an upcoming meeting (migrations 6001–6003) | Done    |
| —    | Set profiles aside to fit a smaller plan (they keep everything and come back when there's room), and a yearly move to a smaller plan has its room from the start (migration 6100; Terms and Privacy updated) | Done    |
| —    | Email a gift to the person it's for, with a message; the address is deleted once it's sent (migration 6101; Privacy and Return Policy updated) | Done    |
| —    | Club meetings in your calendar app: a signed subscribe link per member (new `club-calendar` function, migration 6102) | Done    |
| —    | Most-followed authors on Home (migration 6103) | Done    |
| —    | Yearly-to-monthly switch tested on the Stripe sandbox with the app's prices; security checks run unchanged on a branch with `supabase/tests/run-on-branch.sh` | Done    |
| —    | Club posts by email: a daily email of new posts about chapters the member has reached, for members who turn it on (new `club-digest` function, migration 6200; Privacy Policy updated), and one device per browser in *Listen on another device* (Cookie Policy updated, migration 6201) | Done    |
| —    | 50 more public-domain titles, 71 in all, each with its full text and LibriVox recording (`scripts/build-librivox.py`, `scripts/build-texts.py`; What's new, migration 6203) | Done    |
| —    | Book texts moved to a public Supabase Storage bucket (`book-texts`, migration 6300), served at the same `/texts/` path through Vercel, so deploys and the repo stay small | Done    |

Each phase is checked with Playwright screenshots (desktop and phone) against the wireframe, a Chrome DevTools console and Lighthouse pass, and a clean build and lint before it's committed. Screenshots are in `front_end/literaryworm_app/docs/screenshots/`.
