# LiteraryWorm: Product Blueprint and User Journey

*A Netflix-style reading and listening app built on the Google Books catalog, for readers of all ages.*

Version 2: edited and corrected. A list of every change, and the compliance items to verify before launch, is at the end of this document ([What changed and why](#what-changed-and-why)).

---

## Part 1: From Idea to Blueprint (the planning pipeline)

### 1. What is it?

LiteraryWorm is a Netflix-style web app for reading ebooks and listening to audiobooks. Members browse a visual, row-based home screen, search the Google Books catalog, and read or listen to licensed and public-domain titles in one place. It offers profiles for every member of a household (including kids), personalized recommendations, an AI reading assistant, offline downloads, and a responsive design that works on phones, tablets, and desktops. It installs as an app (PWA).

### 2. What problem does it solve? How do people solve it now?

Readers who want both ebooks and audiobooks juggle several paid services (one for ebooks, another for audiobooks, plus individual purchases). Some turn to pirate sites, which are illegal, unsafe (malware, phishing), and unfair to authors. Others rely on library apps with long waitlists, or track what they've read and want to read in spreadsheets, notebooks, Goodreads lists, and phone notes.

Families have an extra problem: there's no easy way to give kids their own age-appropriate shelf, set screen-time limits, and keep them away from adult content and strangers.

LiteraryWorm gives readers one legal, affordable place to discover, read, listen to, and track books, with family controls built in.

### 3. Who are the users?


| User                         | Who they are                                            | What they need most                                                         |
| ------------------------------ | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Account holder (18+)**     | The adult who signs up and pays                         | Simple billing, easy cancellation, family controls                          |
| **Adult reader**             | Reads and listens across genres                         | Discovery, recommendations, synced progress across devices                  |
| **Teen reader (13–17)**     | Profile on a family account                             | Age-appropriate catalog, social features with guardrails                    |
| **Child reader (under 13)**  | Kids profile managed by a parent                        | A safe, simple shelf; no chat, ads, or public posting                       |
| **Commuter / listener**      | Prefers audiobooks                                      | Playback speed, sleep timer, offline downloads                              |
| **Reader with a disability** | Low vision, dyslexia, motor, hearing or cognitive needs | Adjustable text, read-along transcripts, keyboard and screen-reader support |
| **Support staff**            | LiteraryWorm employees                                      | Ticket dashboard, review moderation                                         |
| **Affiliate (18+)**          | Creators and bloggers who refer readers                 | Referral links, tracking, payouts                                           |

### 4. Features: reasons to log in

**Read and listen**

- Ebook reader: adjustable font, size, spacing, theme (light, sepia, dark), bookmarks, highlights, notes, built-in dictionary, chapter list, and progress synced across devices.
- Audiobook player: chapter list, playback speed (0.5× to 3×), skip back/forward 15 seconds, sleep timer, and a read-along transcript where the publisher provides one.
- Continue Reading picks up where each profile stopped, on any device.
- Download licensed titles for offline reading and listening.

**Discover**

- Home rows: Featured, Continue Reading, Trending, New Releases, Top 10, Because You Saved…, and genre rows.
- Search by title, author, ISBN, narrator, or keyword, with filters (genre, format, length, language, age rating, release date) and sorting (relevance, popularity, newest, rating).
- Surprise Me opens a random title the profile is allowed to see.
- *What should I read?* AI assistant suggests up to five titles from the catalog.

**Organize (Create, Read, Update, Delete)**

- Reading List, Favorites, and named Custom Lists (create, rename, reorder, delete, share by link).
- Ratings (Not for me / I like this / I love this) and written reviews (create, edit, delete).
- Reading Activity history (view, hide, download, pause, auto-delete).
- Profiles (create, edit, lock with a PIN, delete).

**Share and connect**

- Share a title or a list by link.
- Book Club rooms: read or listen along with friends, with chat (adult and teen profiles only; off for Kids).
- Year in Review: books finished, hours read and listened, streaks, top genres.

**Account and family**

- Subscription and billing management, including pause and self-service cancel.
- Up to five profiles with age ratings, PIN locks, and daily screen-time limits.
- Two-step sign-in, signed-in device management, privacy controls, and data download/deletion.

### 5. User journey

**First visit and sign-up (adult)**

1. A visitor lands on the public home page and sees featured titles, plans, and pricing. They can browse public-domain titles or try a demo without an account.
2. They sign up: email, password, and date of birth (account holders must be 18+). They accept the Terms of Service and see the Privacy Policy, with optional marketing email unchecked by default.
3. They choose a plan, see the price, billing date, and auto-renewal terms clearly before paying, and check out with Stripe.
4. They create their first profile and pick a few favorite genres to start their recommendations.

**Setting up the family**
5. The account holder adds profiles: Kids (under 13), Teen (13–17), or All. Creating a Kids profile is where the parent gives consent for LiteraryWorm to collect that child's reading data (see Q7–Q8). They can set a PIN on their own profile and a daily screen-time limit on each child's profile.

**Everyday use**
6. Each visit starts at *Who's reading?* The member picks a profile (entering a PIN if it's locked).
7. Home shows Continue Reading first, then personalized rows. The member searches, filters, or asks the assistant for ideas.
8. On a book's page they read the synopsis, author and narrator details, age rating, and reviews, then start reading or listening, add it to a list, rate it, or download it.
9. Progress saves automatically. Switching from phone to laptop resumes at the same spot.
10. They get notifications for new releases from authors they follow, release reminders, and replies from support.

**A child's journey**

- The child picks their Kids profile (a parent may have locked the others). They see only Kids-rated titles, large covers, and a simple layout. There's no chat, no public reviews, no sharing, no Donate/Support button, and no AI assistant unless a parent turns it on. When the daily limit is reached, reading stops with a friendly message and *Ask a grown-up* for more time.

**Account management, help, and leaving**

- From Account the member manages billing, privacy, accessibility, and security, downloads their data, or gets help through FAQs or a support ticket.
- To leave, they cancel online in a few clicks (no phone call or chat required). Then they can delete their account. Deleting removes their access and starts deletion of their personal data within the legal deadline, except records the law requires LiteraryWorm to keep (such as payment records).

### 6. Screens

The design is clean, modern, and cover-forward. Book covers are the hero of every screen.

- **Home:** a featured-title carousel with pause control, then horizontal rows (Continue Reading, Trending, New Releases, Top 10, Because You Saved, genre rows). Rows scroll left and right only and can be operated by keyboard and screen readers.
- **Book page:** cover, synopsis, author, narrator, length (pages or hours), age rating, format (ebook, audiobook, or both), reviews, and More Like This.
- **Reader and player:** full-screen, distraction-free, with controls that hide while reading and reappear on tap or keypress.
- **Search:** always reachable from the header, with filters in a side panel (desktop) or bottom sheet (mobile).
- **Library:** Reading List, Favorites, Custom Lists, and Downloads, one tap from the tab bar.
- **Account:** reachable from the profile menu in the header.

**On every screen:** an accessibility menu button in the header; footer links to the Accessibility Policy, Privacy Policy, Your Privacy Choices, Terms of Service, Copyright/DMCA, and Help. The layout is responsive for desktop, tablet, and phone, follows WCAG 2.2 AA, and supports light and dark themes. Kids profiles get a simplified, larger-target layout.

### 7. When things break

- **Status:** a public Status page and a banner on Home during outages or maintenance. Signed-in members also get an email for long outages.
- **Helpful errors:** every error says what happened and what to do next, in plain words, with a Try again button. The app never shows raw error codes.
- **Offline:** downloaded titles keep working without a connection. Anything else shows an offline message and retries when the connection returns. Reading progress saves locally and syncs later.
- **Payments:** a declined card shows a plain-words reason. A failed renewal triggers a grace period and email reminders before access pauses. No retry ever charges twice.
- **Reporting problems:** Help Center FAQs, a Report a problem form (which can attach the page, device, and browser automatically, with the member's permission), and support tickets with replies inside the app.
- **Behind the scenes:** error monitoring and alerts, automatic backups with tested restores, a written incident-response plan, and data-breach notifications to members and regulators within legal deadlines.
- **Getting better:** a Feedback page and occasional in-app surveys feed the product roadmap.

---

## Part 2: The 8-Question Practical Template

### 1. What problem does the app solve?

Readers pay for several ebook and audiobook subscriptions, buy books one by one, or turn to illegal sites. LiteraryWorm brings reading and listening into one legal, affordable app with personalized discovery and family-safe profiles. Authors and publishers get paid, and readers get a single library that follows them across devices.

### 2. Who are the users?

Anyone who wants to read or listen to books online. The account holder is an adult (18+). Their household can have up to five profiles, including teen and kids profiles with age-appropriate catalogs and parental controls. The full list of user types is in Part 1, Q3.

### 3. What are their primary goals?

- Find something good to read or listen to quickly, through personalized rows, search, and the AI assistant.
- Read and listen on any device and pick up exactly where they left off.
- Keep their books organized in a Reading List, Favorites, and Custom Lists.
- Pay one fair price, legally, with easy cancellation.
- For parents: give kids a safe shelf, with control over what they see and how long they read.
- Use the app comfortably whatever their abilities or device.
- Control their own data and privacy.

### 4. What information do the users need?

- **About books:** title, cover, synopsis, author, narrator, publisher, publication date, length (pages or listening time), format, language, age rating, content notes, reviews and ratings, series order, and More Like This.
- **About their account:** plan, price, next billing date, auto-renewal terms, payment method, billing history and receipts, and active promotions.
- **About their profiles:** age ratings, PIN locks, screen-time limits and usage, and reading activity.
- **About the app:** how search and filters work, accessibility features, supported devices, how the AI assistant works, and how to get help.
- **About their rights:** what data is collected and why, how to download or delete it, and how to cancel.

### 5. What actions can the users perform?

**Account and security**

- Sign up, sign in, sign out, try a demo account, and reset a forgotten password.
- Turn two-step sign-in on or off, see signed-in devices, and sign out one device or all other devices.
- Change their email, password, plan, billing date, or payment method. Pause or cancel the subscription.
- Download their data. Delete their account.

**Profiles and family**

- Create, edit, and delete up to five profiles (name, avatar, age rating).
- Lock a profile with a four-digit PIN.
- Set a daily screen-time limit and grant extra time (account password required).
- Give or withdraw parental consent for a Kids profile.

**Discovering**

- Browse Home rows, search, filter, and sort, and use Surprise Me.
- Ask the *What should I read?* assistant.
- Follow authors and narrators; set release reminders.

**Reading and listening**

- Open a book in the reader or player, and change its font, size, spacing, theme, playback speed, or sleep timer.
- Add bookmarks, highlights, and notes; look up words.
- Jump between chapters, skip opening/closing credits on audiobooks, and mark a book as finished.
- Download titles for offline use and remove downloads.

**Organizing and sharing**

- Add titles to the Reading List, Favorites, and Custom Lists, and share a list by link.
- Rate titles (Not for me hides a title from recommendations; I like this; I love this).
- Write, edit, and delete reviews, and report another member's review.
- Start or join a Book Club room, and share a title or Year in Review.

**Help and settings**

- Customize accessibility settings and keyboard shortcuts (press **?** to see them).
- Turn autoplay of previews and next chapters on or off.
- Manage notification, privacy, and cookie choices.
- Contact support, report a problem, and send feedback.

Kids profiles can browse, read, listen, use lists, and rate titles. They can't chat, write public reviews, share, buy, donate, or use the AI assistant (unless a parent allows it).

### 6. What pages are required?

#### Public pages (no account needed)

- **Landing page:** what LiteraryWorm is, featured public-domain titles, plans and pricing, FAQs, and Sign up / Sign in.
- **Plans and Pricing:** each plan's price, what's included, the free trial (if any), and the auto-renewal and cancellation terms, stated plainly before checkout.
- **Sign Up / Sign In:** create an account (email, password, date of birth; account holders must be 18+) or sign in, or try a private demo account. With two-step sign-in on, a second step asks for the six-digit code from an authenticator app. Passwords must be at least 15 characters (or at least 8 with two-step sign-in on), with no forced mix of character types; any length up to 64 is allowed, and passwords known from data breaches are refused.
- **Forgot / Reset Password:** request a reset link by email, then choose a new password from that link. Expired links ask for a new one. The page never reveals whether an email is registered.
- **Shared List page:** a list a member shared by link. Anyone with the link can view it (titles and covers only, never the owner's reading history).
- **Status page:** current service status and past incidents.
- **Legal pages:** Terms of Service, Privacy Policy, Children's Privacy Notice, Cookie Policy, Your Privacy Choices, Community Guidelines, Copyright/DMCA Policy, Accessibility Policy, AI Transparency, and Affiliate Program Terms (details below).

#### Member pages

- **Who's Reading? (Profiles):** choose a profile; add, edit, or delete profiles (up to five), each with a name, avatar, and age rating (Kids, Teen, or All).

  - **PIN lock:** a profile can have a four-digit PIN, set or removed with the account password. A locked profile shows a lock and asks for its PIN before it opens or can be edited. After five wrong tries it locks for 15 minutes.
  - **Kids profiles:** they ask for the account password (*Ask a grown-up*) before managing profiles or opening Account.
  - **Screen-time limits:** each profile can have a daily limit (30 minutes to 4 hours), set with the account password. Reading and listening stop when it's used up, and the account password allows 30 more minutes.
- **Home:**

  - **Featured carousel:** a featured-titles carousel with a pause button.
  - **Rows:** Continue Reading (where the profile stopped, most recent first), Trending, New Releases, Top 10, genre rows, and Because You Saved (Google Books suggestions based on the profile's most recently saved title, credited to Google Books).
  - **Header:** a notifications bell with a count of new notifications.
  - **Row behavior:** every row, including the Top 10, scrolls left and right only.
- **Book Details:**

  - **Information:** cover, synopsis, author, narrator, publisher, publication date, length, format, language, age rating, content notes, series order, reviews, and More Like This.
  - **Actions:** Read, Listen, Add to Reading List, Favorite, Add to Custom List, Rate (Not for me / I like this / I love this), Download for offline, Share, Start a Book Club, and report a review (spoiler, offensive, spam, or something else).
  - **Links:** author, narrator, and publisher names link to their pages.
  - **Series:** books in a series are listed in order, each with a Read/Listen button.
- **Reader (ebooks):**

  - **Display:** font, size, line spacing, margins, and theme (light, sepia, dark).
  - **Tools:** bookmarks, highlights, notes, dictionary lookup, and a chapter list.
  - **Progress:** a progress bar showing chapter marks and the current chapter's name. Dragging to the end asks *Mark as finished?* rather than finishing the book by accident.
  - **Navigation:** page turns by tap, swipe, or arrow keys.
  - **Phones and tablets:** follows the device's rotation, with an optional rotation lock.
- **Audiobook Player:**

  - **Controls:** play/pause, skip back/forward 15 seconds, playback speed, sleep timer, chapter list, and a progress bar with chapter marks.
  - **Skip buttons:** Skip Opening Credits and Skip Closing Credits appear while those parts play. At the end of a book in a series, a countdown offers the next book (if autoplay of the next title is on).
  - **Read-along:** a transcript that highlights along with the narration, where the publisher provides one. Transcript language and size are adjustable.
  - **Keyboard:** all controls work by keyboard. Playback continues on the lock screen of phones.
- **Google Books Title page (books outside LiteraryWorm's licensed catalog):**

  - **Information:** cover, description, author, publisher, published date, page count, categories, and average rating from Google Books, credited as required by Google's branding guidelines.
  - **Preview:** where Google allows it, a free preview using Google's Embedded Viewer, loaded only when the member asks.
  - **Buy links:** where to buy (from Google Books sale information).
  - **Saving and rating:** members can add these titles to their lists, rate them, and review them, but can't read the full book in LiteraryWorm.
  - **Reminders:** Remind Me for books not yet published.
- **Search:**

  - **Suggestions:** suggests titles, authors, narrators, and genres while typing, and shows the profile's recent searches when the box is empty.
  - **Filters and sorting:** genre, format, length, language, age rating, release date, and popularity.
  - **Did you mean:** when nothing matches exactly, shows close spellings.
  - **Results:** LiteraryWorm's own titles appear first, then matching Google Books titles. Results always respect the profile's age rating.
  - **Surprise Me:** a Surprise Me button (also on Home) opens a random title the profile can see.
- **Library:**

  - **Reading List:** titles saved to read later.
  - **Favorites:** titles the member loves.
  - **Custom Lists:** named lists with descriptions, each private until its owner turns on sharing by link. Sharing is off for Kids profiles.
  - **Downloads:** titles on this device for offline use, with size and a Remove button. Downloaded titles open with no connection and expire if the subscription ends, as required by publisher licenses.
- **Author, Narrator, and Publisher pages:** photo (where licensed), bio, and their titles in LiteraryWorm and on Google Books, with a Follow button.
- **What Should I Read? (AI assistant):**

  - **Asking:** a text box for a request in plain words, and example requests to tap.
  - **Answers:** up to five titles from LiteraryWorm's catalog, each with a reason, within the profile's age rating and leaving out titles marked Not for me.
  - **Labels:** suggestions are clearly labeled as AI-generated, with a link to the AI Transparency page.
  - **Fallback:** when the AI service is unavailable, it matches words in titles, genres, and moods instead.
  - **Kids profiles:** off by default on Kids profiles; a parent can turn it on.
- **Book Club rooms:**

  - **Reading together:** read or listen together, with a shared position (for audiobooks) or a shared chapter goal (for ebooks), plus a member list and chat.
  - **Who can join:** members only. The invite link lasts six hours.
  - **Safety:** chat follows the Community Guidelines and has Report and Block buttons. Not available on Kids profiles; Teen profiles can join only rooms started from their own household.
- **Year in Review:**

  - **Stats:** for the profile and a chosen year, books finished, pages read, hours listened, days active, the longest streak, the busiest month, top genres, and the most-read author.
  - **Sharing:** a Share button copies a short summary. Sharing is off for Kids profiles.
  - **Empty years:** when there's no history for the year, the page links to Reading Activity.
- **Reading Activity:** the profile's history by day, with Hide, Hide all, and Download. Settings pause the history or auto-delete it after 90 days or a year.
- **Notifications:** new releases from followed authors, release reminders, and support replies, with new ones marked. Upcoming reminders are listed below.
- **Account:**

  - **Profile and plan:** email, password, plan, and billing (change plan, change billing date, pause, cancel online), plus payment method, billing history, and receipts.
  - **Promotions:** promo codes.
  - **Preferences:** autoplay of previews and next titles, notifications, and accessibility.
  - **Privacy:** personalized recommendations on/off, Your Privacy Choices, Download my data, and Reading Activity.
  - **Security:**
    - **Two-step sign-in:** turn it on or off. Setup shows a QR code or setup key for an authenticator app, then asks for a six-digit code to confirm. Turning it off needs a current code.
    - **Signed-in devices:** each device's browser and when it was last active, with this device marked. Sign out any one device, or all other devices.
  - **Family:** profiles, Kids consent, and screen-time limits.
  - **Help:** links to Help Center, Report a problem, Feedback, Technical Requirements, and Install the app.
  - **Danger zone (Delete account):** a red Delete account button, which first cancels any active subscription (with confirmation) and asks for the member's password. It then removes access and deletes personal data within the legal deadline, keeping only what the law requires (such as payment records). The member gets an email confirming the request.
  - **Kids profiles:** the page asks for the account password (*Ask a grown-up*) before showing anything.
- **Support LiteraryWorm (optional):**

  - **Recommendation:** for a for-profit subscription business, consider removing this page (see *What changed and why*).
  - **If kept:** a one-time or monthly tip by card through Stripe ($1 to $10,000).
  - **Labeling:** it's clearly labeled as *not a charitable donation and not tax-deductible*.
  - **Where it lives:** opened from Account → Help only, never shown on Kids or Teen profiles.
  - **Payment states:** a thank-you naming the amount, plain-words decline messages, Try again on a dropped connection, and *being processed* while the bank confirms. No retry ever charges twice.
  - **Monthly tips:** they show the amount and next charge date with a one-click Cancel, and the member gets a reminder before each charge.
  - **Card data:** card numbers go straight to Stripe and never reach LiteraryWorm. Stripe emails receipts.
- **Help Center (FAQs + Support):** searchable FAQs, Report a problem, support tickets with in-app replies, and a link to the Status page.
- **Feedback:** suggestions and ratings of the app experience.
- **Technical Requirements:** supported browsers and devices, recommended connection speed for audio streaming, storage needed for downloads, and how to install the app (with a check of whether this browser can).
- **Sign Out:** signs out of this device and returns to the landing page.

#### Staff pages

- **Support Dashboard (support staff only):** every member's tickets by status, each ticket's details and conversation, replies, and status changes.
- **Moderation Queue (moderators only):** reported reviews and Book Club messages (reason, details, a copy of the content, reporter), with Keep or Remove and an audit log.
- **Content Admin (admins only):** catalog, age ratings, featured rows, and promotions.

#### Legal and policy pages

- **Terms of Service:** eligibility (account holders 18+), the subscription and auto-renewal terms, cancellation and refunds, acceptable use, content licensing limits (no copying or redistributing books), user content (reviews) and moderation, limitation of liability, dispute resolution, and governing law.
- **Privacy Policy:** what data is collected and why, legal bases, retention periods, who it's shared with (Stripe, the AI provider, Google Books, hosting, email), cookies, user rights (access, correction, deletion, portability, opt-out), and how to exercise them.
- **Children's Privacy Notice:** COPPA notice for parents: what's collected from Kids profiles, how parental consent works, and how a parent can review, delete, or stop collection of their child's data.
- **Your Privacy Choices / Cookie Preferences:** opt out of non-essential cookies, targeted advertising, and any "sale" or "sharing" of personal information. It honors Global Privacy Control signals.
- **Community Guidelines:** rules for reviews and Book Club chat, and what happens when they're broken.
- **Copyright / DMCA Policy:** how rights holders report infringement, the designated DMCA agent, counter-notices, and the repeat-infringer policy.
- **Accessibility Policy:**
  - **Commitment:** LiteraryWorm's commitment to WCAG 2.2 AA.
  - **Features:** the accessibility menu, read-along transcripts in English or Spanish, keyboard-accessible reader and player controls, screen-reader support, and autoplay control.
  - **Shortcuts and limits:** the keyboard shortcuts (and that **?** shows them all), and known limitations (for example, publisher-supplied files that lack accessibility features).
  - **Help:** how to report an accessibility issue or request an accessible format.
- **AI Transparency:**
  - **How it works:** which AI model powers the assistant and what's sent to the AI provider (the request and, with personalized recommendations on, the names of titles the profile loved or liked). Never the member's name, email, or account ID.
  - **Limits:** suggestions come only from LiteraryWorm's catalog. The provider is contractually barred from training on member data.
  - **Choices:** how to turn personalized recommendations off.
- **Affiliate Program:**
  - **Eligibility:** adults 18+ with an approved application.
  - **Earnings:** commission structure, cookie window, payment methods and thresholds, and tax forms.
  - **Rules:** required disclosures under the FTC Endorsement Guides (#ad / "I earn a commission"), no advertising to children, no spam, and no bidding on the LiteraryWorm brand name.
  - **Support:** marketing materials, a referral dashboard, and tips for growing referrals.
- **Promotions:** current offers with their full terms: the price after the promo ends, when it ends, and how to cancel.

#### On every page

- **Accessibility menu (header icon, OneTap-style):**
  - **Profiles:** one-tap accessibility profiles.
  - **Text:** size, font (including a dyslexia-friendly font), line height, letter spacing, and alignment.
  - **Display:** contrast, saturation, highlighted links and headings, strong focus outline, big cursor, reading guide, hiding images, and stopping animations.
  - **Audio and transcripts:** transcript display, transcript size, and transcript language (English or Spanish), plus autoplay.
  - **Keyboard shortcuts:** a Keyboard shortcuts button. Pressing **?** on any page (except while typing) opens the shortcut list.
- **Footer links:** Accessibility Policy, Privacy Policy, Cookie Policy, Children's Privacy Notice, Your Privacy Choices, Terms of Service, End User License Agreement, Acceptable Use Policy, Return Policy, Copyright/DMCA, Disclaimer, Help, Status, Consent Preferences, and Termly's request forms (Do Not Sell or Share My Personal information; Limit the Use Of My Sensitive Personal Information).

### 7. What data must be collected?

Only what each feature needs, for as long as it needs it. Each item below is listed with its purpose.


| Data                                                                                                                                                     | Why                                                                            | Kept for                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Account: name, email, hashed password, date of birth (to confirm 18+)                                                                                    | Sign-in, age eligibility, contact                                              | Until account deletion                                                               |
| Subscription: plan, status, billing dates, Stripe customer and payment IDs, promo codes used                                                             | Billing, receipts, promotions                                                  | Payment records as long as tax law requires (often 7 years)                          |
| **Card numbers**                                                                                                                                         | **Never collected.** They go straight to Stripe                                | Not stored                                                                           |
| Profiles: name, avatar, age rating, PIN lock status, one-way hash of the PIN (never the PIN itself), wrong-try count and lock-out end time               | Profiles and locks                                                             | Until profile deletion                                                               |
| Parental consent records for Kids profiles (who consented, when, how)                                                                                    | COPPA compliance                                                               | As long as the Kids profile exists, plus the period required by law                  |
| Two-step sign-in: authenticator secret (held by the sign-in service, never shown again after setup) and signed-in devices (browser, device, last active) | Account security                                                               | Until removed                                                                        |
| Reading progress per title (position, chapter, finished)                                                                                                 | Continue Reading, sync across devices                                          | Until deleted by the member                                                          |
| Reading Activity (title, chapter, day) and history settings (paused, auto-delete after 90 days or a year)                                                | History and recommendations                                                    | Per the member's setting                                                             |
| Lists, favorites, ratings (Not for me / I like this / I love this), reviews, bookmarks, highlights, notes                                                | Library and recommendations                                                    | Until deleted                                                                        |
| Google Books titles a member saves (volume ID, title, cover, basic details)                                                                              | Show them in lists                                                             | Until removed                                                                        |
| Recent searches (when history isn't paused)                                                                                                              | Search suggestions                                                             | 90 days                                                                              |
| Reminders, followed authors, notification read status                                                                                                    | Notifications                                                                  | Until removed                                                                        |
| Book Club memberships and chat messages                                                                                                                  | Book Clubs                                                                     | 30 days after the room ends (unless reported)                                        |
| Screen-time limit and seconds read per day (plus extra time allowed)                                                                                     | Screen-time limits                                                             | 7 days                                                                               |
| Accessibility settings, transcript language, autoplay and volume preferences                                                                             | Personalization                                                                | Until changed                                                                        |
| Support tickets and replies, bug reports (with device info if the member allows it)                                                                      | Support                                                                        | 2 years after closing                                                                |
| Review and chat reports (reason, details, a copy of the content, reporter, outcome)                                                                      | Moderation                                                                     | 2 years                                                                              |
| Deletion and data-access requests                                                                                                                        | Proof of compliance                                                            | As long as legally required                                                          |
| Tips/donations: amount, status, Stripe payment ID, date                                                                                                  | Receipts, accounting                                                           | Per tax law                                                                          |
| Affiliate: referral clicks and sign-ups, payout details, tax forms                                                                                       | Commissions                                                                    | Per tax law                                                                          |
| IP address                                                                                                                                               | Rate limiting (demo accounts, public pages, Google Books lookups) and security | 1 day (longer only for security incidents)                                           |
| AI assistant requests                                                                                                                                    | Counted for rate limiting;**not stored**                                       | Not stored                                                                           |
| Usage analytics (pages viewed, clicks, time on page)                                                                                                     | Improve the app                                                                | Only with consent where required; never on Kids profiles; aggregated after 13 months |

**Kept only on the device:** which titles are downloaded, and offline reading progress until it syncs.

**Children (Kids profiles):** LiteraryWorm collects the minimum needed to provide the service (profile, reading progress, lists, ratings, and screen time). It does not use Kids profile data for advertising, AI training, or analytics profiling, and it doesn't share it with third parties beyond service providers needed to run the app.

### 8. What permissions exist?

**A. What members choose (consent and controls)**


| Choice                                                                     | Default                                 | Where                               |
| ---------------------------------------------------------------------------- | ----------------------------------------- | ------------------------------------- |
| Accept Terms of Service and acknowledge the Privacy Policy                 | Required to sign up                     | Sign Up                             |
| Marketing emails                                                           | Off                                     | Sign Up, Account                    |
| Push/email notifications by type                                           | Service notices on; others off          | Account                             |
| Non-essential cookies and analytics                                        | Off until accepted (where required)     | Cookie banner, Your Privacy Choices |
| Personalized recommendations (and sending liked titles to the AI provider) | On; can be turned off                   | Account → Privacy                  |
| Reading Activity history                                                   | On; can be paused or set to auto-delete | Reading Activity                    |
| Autoplay of previews and next titles; transcripts                          | Member's choice                         | Account, Accessibility menu         |
| Sharing a list by link                                                     | Off (private)                           | List settings                       |
| Kids profile data collection (parental consent)                            | Off until the parent consents           | Creating a Kids profile             |
| AI assistant on Kids profiles                                              | Off                                     | Account → Family                   |
| Report bugs with device information attached                               | Asked each time                         | Report a problem                    |
| Download my data / delete my account                                       | Available anytime                       | Account                             |

Members can withdraw any optional consent at any time without losing access to the core service.

**B. Who can do what (access control)**


| Role                     | Can                                                                                                                                                  | Can't                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Visitor**              | Browse the landing page, public-domain titles, shared lists, and policies; try a demo account                                                        | Save anything, review, chat, or see other people's data                                                            |
| **Account holder**       | Everything a member can, plus billing, profiles, PINs, screen-time limits, Kids consent, and deleting the account (all needing the account password) | See other accounts' data                                                                                           |
| **Member profile (All)** | Read, listen, lists, ratings, reviews, Book Clubs, the AI assistant, and sharing                                                                     | Change billing or other profiles' PINs and limits without the account password                                     |
| **Teen profile**         | Teen-and-under catalog; lists, ratings, and reviews (display name only); household Book Clubs                                                        | Mature titles, public Book Clubs with strangers, payments                                                          |
| **Kids profile**         | Kids catalog, reading, listening, lists, ratings                                                                                                     | Chat, public reviews, sharing, payments, Account, profile management, the AI assistant (unless a parent allows it) |
| **Support staff**        | View and reply to tickets                                                                                                                            | See payment card data (never stored) or reading history unless the member shares it in a ticket                    |
| **Moderator**            | Review reports; keep or remove reviews and chat messages                                                                                             | Edit what members wrote                                                                                            |
| **Admin**                | Manage the catalog, age ratings, featured rows, promotions, and staff roles                                                                          | Bypass audit logging                                                                                               |
| **Affiliate**            | View their own referral stats and payouts                                                                                                            | See referred members' identities or activity                                                                       |

**C. Rules the system enforces**

- **Data access:**
  - **Own data only:** each member can see and change only their own data, enforced in the database with row-level security.
  - **Two-step sign-in:** with it on, data can be read or changed only after the second step.
  - **Ratings:** belong to the profile that gave them.
- **Profile locks and screen time:**
  - **PINs:** setting or removing a profile PIN needs the account password. Unlocking a profile needs its PIN.
  - **Kids profiles:** need the account password to open Account or manage profiles.
  - **Screen time:** only the account password sets screen-time limits or grants extra time. Nobody can lower the time already used.
- **Server-only actions and secret keys:**
  - **Server-only actions:** only LiteraryWorm's server functions can create demo accounts, start payments (for the signed-in member, $1 to $10,000), record payment results from Stripe's signed webhooks, check promo codes, count referral clicks, delete accounts, and call Google Books or the AI provider with LiteraryWorm's API keys.
  - **Secret keys:** never reach the browser.
- **Reviews and Book Clubs:**
  - **Reviews:** show the profile's display name (never a child's real name). A member can report another member's review once, and never their own. Only moderators see reports.
  - **Book Clubs:** only a room's members can join its channel. Only support staff can see other members' tickets.
- **AI assistant:**
  - **Access:** for signed-in profiles only, rate limited, and only suggests titles the profile is allowed to see.
  - **Data sent:** sends the AI provider the request and title names only.
- **Devices and lists:**
  - **Devices:** a member can sign out only their own devices.
  - **Lists:** a list stays private until its owner shares it.
- **History and deletion:**
  - **Paused history:** while history is paused, nothing is recorded, including searches.
  - **Deletion:** deleting the account cancels the subscription, removes access, and deletes personal data within the legal deadline, except records the law requires LiteraryWorm to keep.

---

## What changed and why

### Corrections to the content

1. **Leftover streaming-service text replaced with book equivalents.** Many sections described movies, TV shows, episodes, seasons, cast and crew, trailers, video, and "watching." These now describe ebooks and audiobooks: chapters, narrators, the reader and player, "reading" and "listening." Specific swaps:
   - *Continue Watching* → **Continue Reading**
   - *Viewing Activity* → **Reading Activity**
   - *Who's watching?* → **Who's reading?**
   - *Watch Party* → **Book Club rooms**
   - *What should I watch?* → **What should I read?**
   - *Skip Recap/Intro/Outro* → **Skip Opening/Closing Credits** (audiobooks)
   - *closed captions* → **read-along transcripts**
   - *trailer* → **Google Books preview**
   - *most-watched title / actor seen most* → **most-read author**
2. **TMDB, YouTube, and JustWatch removed.** They are movie/TV data sources and don't fit a book app. The TMDB Title page became a **Google Books Title page** for books outside LiteraryWorm's licensed catalog, with Google's preview and buy links.
3. **Inconsistent list names unified.** Reading List, Watch list, My List, and My Lists were used for overlapping things. Now there are three: **Reading List** (read later), **Favorites**, and **Custom Lists**.
4. **Q4 (Features) actually lists features.** It previously restated the business model, so it now lists the reasons to log in and the create/read/update/delete actions.
5. **Q3 (Primary goals)** said "movies and TV shows"; it's rewritten for readers and parents.
6. **Duplicate pages merged.** "Legal and Privacy Pages" duplicated Terms of Service and Privacy Policy; Customer Support, FAQs, and Error/Issue Reporting overlapped. These are now one Help Center plus the separate legal pages.
7. **Game leaderboards removed.** The data and permissions sections mentioned them, but no game feature or page existed.
8. **"Drag to the end finishes the title"** now asks *Mark as finished?* so a stray drag doesn't remove a book from Continue Reading.
9. **Forced landscape on phones removed.** It made sense for video, not reading. The reader now follows the device's rotation.
10. **Missing pages added:**
    - Landing page and Plans and Pricing
    - Reader and Audiobook Player
    - Status page
    - Moderation Queue and Content Admin
    - Children's Privacy Notice
    - Your Privacy Choices
    - Community Guidelines
    - Copyright/DMCA
    - Shared List page
11. **A user table and a child's journey were added** to Who are the users and the User journey, since the app is for all ages.
12. **Spelling and grammar fixed throughout:** managmeent, guidlines, responsiblities, double spaces, "An character," a missing line break before "Privacy Policy Page," and others.

### Compliance changes (items to verify for your jurisdiction)

These are flagged for your legal review. Laws and rules change, and some depend on where you launch and your company's size.

1. **Content rights: the biggest launch risk.** The Google Books API supplies **metadata, covers, previews, and buy links**. It does **not** give you rights to host, stream, or sell access to full copyrighted books. A subscription catalog needs:

   - **Public domain:** public-domain works (for example, Project Gutenberg texts and LibriVox audiobooks; check each source's terms)
   - **Publisher and distributor licenses:** licenses from publishers or distributors (which usually require DRM and expiring downloads)
   - **Link-outs:** links out for everything else

   Also review the Google APIs Terms of Service and the Google Books branding/attribution requirements. The blueprint now separates LiteraryWorm's licensed catalog from Google Books titles that can only be previewed and saved.
2. **Children's privacy (COPPA).** Because the app is for all ages, Kids profiles (under 13) now require verifiable parental consent, a Children's Privacy Notice, data minimization, and parent access/deletion. There are no ads, chat, public reviews, sharing, or payments for kids, and the AI assistant is off by default. The FTC's amended COPPA Rule (2025) added requirements, such as separate consent for third-party disclosures, a written data-retention policy, and a security program; confirm the compliance dates. Also check state laws on teens' data and age-appropriate design.
3. **Account deletion and data rights.** The original design deleted only *access* and required a support ticket to remove data. Under CCPA/CPRA (and GDPR if you serve the EU), members must be able to request deletion directly, and you must honor it within the legal deadline (45 days under CCPA, one month under GDPR, each extendable). The flow now cancels the subscription and deletes personal data in one place, keeping only legally required records. A **Download my data** option was added.
4. **"Any other relevant data" removed.** A catch-all conflicts with data-minimization and purpose-limitation rules, so every data item now has a stated purpose and retention period. "Internet speed" collection was removed. The Technical Requirements page can check it in the browser without storing it.
5. **Donations on a for-profit subscription service.** Calling payments "donations" can mislead people into thinking they're charitable or tax-deductible. The page is renamed **Support LiteraryWorm (tips)** with a clear "not tax-deductible" label, moved off the always-on floating button, and hidden from Kids and Teen profiles. Consider removing it entirely. Monthly tips follow the same auto-renewal rules as subscriptions.
6. **Auto-renewal and cancellation.** Plans, promotions, and monthly tips must clearly disclose the price, renewal terms, and how to cancel *before* payment. Members get affirmative consent, an acknowledgment email, and **online cancellation**. Check:

   - **ROSCA:** the federal Restore Online Shoppers' Confidence Act
   - **State auto-renewal laws:** for example, California's amendments effective July 1, 2025
   - **The FTC's negative-option rule:** its 2024 "click-to-cancel" rule was vacated in 2025, but ROSCA and state laws still apply
7. **Password rules updated to NIST SP 800-63B guidance.** The original rule (13+ characters with forced character types) conflicts with NIST, which recommends length and breach-list checks instead of composition rules. The blueprint now uses:

   - **Length:** at least 15 characters when the password is the only factor, or 8 with two-step sign-in
   - **Maximum:** up to 64 allowed
   - **Composition:** no forced character types
   - **Breach check:** breached passwords refused

   Confirm against the current SP 800-63B revision.
8. **Accessibility.** WCAG 2.2 AA is kept, and it's the right target for ADA Title III risk in the U.S. If you sell to EU consumers, the **European Accessibility Act** (applying from June 28, 2025) specifically covers e-books, e-reading software, and e-commerce. The blueprint adds screen-reader support, a dyslexia-friendly font, a carousel pause, and a way to request accessible formats.
9. **AI disclosures.** AI suggestions are labeled, there's an AI Transparency page, the provider is contractually barred from training on member data, and the assistant is off by default for kids. Check state AI disclosure laws and the EU AI Act's transparency duties if you serve the EU.
10. **User content and moderation.**

    - **Reviews and chat:** now governed by Community Guidelines with Report and Block buttons, a moderator role, and an audit log.
    - **Kids' reviews:** show a display name, never a child's real name. The original rule "reviews always show the real author's name" exposed children's names publicly.
    - **Copyright/DMCA:** added a page and a registered DMCA agent to preserve safe-harbor protection.
11. **Affiliate program.** Limited to adults, with FTC Endorsement Guides disclosure requirements, no marketing to children, and tax forms for payouts.
12. **Cookies and privacy choices.** Added a cookie banner and a Your Privacy Choices page that honors Global Privacy Control, as required by CCPA/CPRA for any "sharing" for targeted ads.
13. **Netflix-style, not Netflix.** Keep the layout pattern, but use your own visual identity, colors, and wording to avoid trade-dress confusion. The rating label "Love this!" became "I love this," and you shouldn't use Netflix's red and black, typefaces, or logo shapes. Run a trademark clearance search on "LiteraryWorm," a common name in the book space, before launch.


---

## Part 3: Build notes (front end)

The front end lives in `front_end/literaryworm_app` (React + TypeScript + Vite, React Router DOM with `BrowserRouter`). It is deployed on Vercel at [www.literaryworm.com](https://www.literaryworm.com); `vercel.json` in that folder rewrites every path to `index.html`, so any page can be refreshed or opened from a link. It is built in phases; each phase is screenshotted with Playwright, checked in Chrome DevTools (console and Lighthouse), committed and pushed. App state is kept in memory only, so a refresh starts the app over. Book lists come from the `books` Supabase Edge Function (Google Books) when Supabase is configured. The database is in `supabase/migrations/` (combined in `schema.sql`, diagram in `drawsql.png`).

### Journey as built so far (Phases 0–10)

1. **Landing (`/`).** A visitor sees the hero from the wireframe ("Stories worth staying up for."), free public-domain titles they can open without an account, how ebooks and audiobooks work together, family profiles, the three plans and an FAQ. Calls to action: *See plans and join* and *Try the demo*.
2. **Plans (`/plans`).** Basic $7.99, Standard $12.99 and Premium $17.99 a month, each listing profiles, audiobook hours, download devices and features. Choosing a plan as a visitor goes to sign-up with that plan remembered.
3. **Sign up (`/signup`).** Name, email, password and date of birth. The account holder must be 18 or older; passwords must be 15 to 64 characters with no forced character mix, and known breached passwords are refused; the Terms of Service must be accepted (Privacy Policy linked); marketing email is unchecked by default. Errors appear next to each field and focus moves to the first one.
4. **Checkout (on `/plans`, step 2 of 3).** Shows the plan, price, first charge (today) and next charge date, a billing day (1st–28th), a note that card details go straight to Stripe, and the auto-renewal and cancellation terms in plain words. The member must tick *I understand my membership renews automatically* before starting. The demo account can't make payments.
5. **First profile.** The account starts with one profile named after the account holder (age rating All). Picking favorite genres and adding family profiles happen on *Who's reading?* (Phase 2).
6. **Log in (`/signin`).** Email and password. A wrong email and a wrong password give the same message, and *Forgot password?* always says a link was sent "if an account uses" that email, so the page never reveals who has an account. *Try the demo* opens a sample household (Avery, Sam and Mia); the demo can also be opened with the email and password shown on the log-in page. That password is generated fresh on each page load, so no fixed credential is stored.
7. **Log out.** Returns to the landing page. Accounts created in this session can be logged back into until the page is refreshed.
8. **On every page.** Header with the accessibility menu (text size, dark or light theme, dyslexia-friendly font, high contrast, highlighted links, stop animations); footer with Accessibility Policy, Privacy Policy, Your Privacy Choices, Terms of Service, Copyright/DMCA, Help and Status; a bottom tab bar on phones for signed-in members; *Skip to content*; ⌘K / Ctrl+K jumps to search.

### Phase 2: Who's reading?

9. **Step 3 of sign-up.** After checkout, the new member picks favorite genres for their first profile (or skips).
10. **Who's reading? (`/profiles`).** Large avatar tiles with each profile's name, a Kids or Teen chip, a daily-limit chip and a lock badge if it has a PIN. Choosing a profile goes to Home, or back to the page the member was trying to reach.
11. **PIN.** A locked profile asks for its 4-digit PIN. Each wrong try says how many are left; after 5 the profile locks for 15 minutes. *Forgot the PIN?* takes the account password instead.
12. **Manage profiles.** Add a profile (up to the plan's limit), or choose one to edit its name, avatar, age rating, favorite genres, PIN and daily limit, or delete it. Changing the age rating, PIN or limit, and deleting, need the account password. A Kids profile needs the parent's consent, with a link to the Children's Privacy Notice.
13. **Ask a grown-up.** If the last profile used was a Kids profile, *Manage profiles* and *Add profile* first ask for the account password.
14. **Switching profiles.** The profile menu's *Switch profile* and *Manage profiles* always go back through *Who's reading?*, so PIN locks still apply.

### Phase 3: Home

15. **Public home (`/`).** Right under the hero, *Popular in technology*: books about "technology" from the `books` Edge Function (Google Books), browsable without an account. At the bottom, *Keep discovering*: the six genres from the brief (Technology, Adventure, Sci-Fi, Fiction, Non-Fiction, Horror) and thirteen more (Fantasy, Mystery, Thriller, Romance, Classics, Historical Fiction, Young Adult, Children's, Biography & Memoir, History, Science, Self-Help, Poetry) as links, and a grid that keeps loading as the visitor scrolls (with a *Load more books* button too). Each genre has its own URL (`/?genre=sci-fi#discover`), so it survives a refresh, and every genre link (here, on Home and in Search's *Or browse a genre*) opens the page at that genre's books rather than the top.
16. **Member Home (`/browse`).** A featured carousel with Pause, then Continue reading (with progress bars), Trending this week, the reading-room banner, Top 10, New releases, *Because you saved …*, and one row per genre. Rows scroll sideways and the genre rows load more at their end. *Keep discovering* closes the page as on the public home.
17. **Age ratings.** Kids profiles see only the age-rated LiteraryWorm catalog (no Google Books results). Everyone else gets Google results with mature titles left out.
18. **When the book service fails.** Rows and the grid show "We couldn't load …" with the reason in plain words (busy, too slow, offline) and *Try again*; books already loaded stay on screen. On the live site its address (`www.literaryworm.com` and `literaryworm.com`) must be in the functions' `ALLOWED_ORIGINS`, or every row says the visitor seems to be offline.

### Phase 4: Book details

19. **Book page (`/books/:id`).** Public, and works when opened from a link or refreshed. LiteraryWorm titles come from the catalog; any other id is a Google Books volume fetched through the `books` Edge Function. The page shows the cover, title, subtitle, author(s), average rating, number of ratings, pages and the description (long ones fold with *Read the full description*), then a *Book details* list: publisher, published date, pages, language and categories for Google titles; narrator, length, format, language, age rating and content notes for LiteraryWorm titles. Google titles credit *Details from Google Books*.
20. **Reader logs.** Every reader's logs, newest first, each with the writer's display name, date and optional 1–5 star rating; long logs fold with *Read full log*. Logs come from Supabase's `logs` table without signing in (the page never reads anyone's library), plus logs written this session. *Load more logs* fetches 20 more; if loading fails, the page says so with *Try again*.
21. **Library and logs.** *Add to my library* (visitors are sent to log in first, then come back). Once saved, a reading-status menu (Want to read, Reading, Finished), *Write a log* and *Remove from library*. A log needs the book in the writer's library; its text is 1–5000 characters with an optional rating. Readers edit and delete only their own logs. Removing the book asks first when it has logs, then deletes them with it, as the database does.
22. **Taste and actions.** Not for me / I like this / I love this, Favorite, and for LiteraryWorm titles *Read* and *Listen*. *More like this* shows similar titles (catalog genres, or the closest of the six genres for Google titles).
23. **Age ratings.** Kids profiles never load Google titles and see "This book isn't on …'s shelf"; they read logs but don't post them. Teen profiles can't open titles Google rates mature, or catalog titles above their rating.

### Phase 5: Search

24. **Search (`/search`).** Public, by title only (the brief): visitors reach it from *Search* in the header (an icon on phones), members from the header box or the tab bar. Results show LiteraryWorm's own titles first (*From LiteraryWorm*, read and listen here), then Google Books titles through the `books` Edge Function (*From Google Books*), loading more as the reader scrolls, with a *Load more books* button too. The search and its filters are in the URL, so they survive a refresh and work with Back.
25. **Filters and sorting.** Show (All results, LiteraryWorm titles, Google Books), a genre (the same list as Home), language (English, Spanish, French, German, Italian, Portuguese), length (under 200, 200 to 400, over 400 pages), and Best match or Newest. A sidebar on desktop; a *Filters* dialog on phones, whose button shows how many are on. Genre, language and sort are applied by Google, not just to the books already loaded; Google can't filter by length, so each page of its results is checked against the page count it lists, and editions without one are left out (a page may show fewer books; *Load more* fetches the next).
26. **Helpful mistakes.** A search with operators or symbols explains what's allowed instead of sending it. *Did you mean …?* corrects typos against LiteraryWorm titles ("midnite libary" → *Midnight Library*). No matches says so and suggests checking the spelling, fewer words or other filters.
27. **Recent searches and Surprise me.** An empty search box shows the profile's last ten searches (remove one or clear all) and the genres. *Surprise me* (on Search and on Home's Trending row) opens a random title the profile may see.
28. **Kids profiles** search LiteraryWorm's age-rated shelf only; the page says so.

### Phase 6: Real accounts and the Library

29. **Sign up and log in with Supabase Auth.** Sign-up creates a real account; the database checks the display name, the 18+ date of birth and the Terms acceptance again before creating the public profile. The account is ready straight away (no confirmation email; see below). Log in, log out and *Forgot password?* (an emailed link to `/reset-password`, where the member chooses a new password) work against Supabase. A wrong email or password gets the same message, so the page never reveals who has an account.
30. **Staying signed in.** A refresh keeps the member signed in and carries on as the account's profile; logging in fresh still starts at *Who's reading?*. Only the Supabase session is kept in the browser; everything else still resets on refresh.
31. **Plan.** Choosing a plan calls the `checkout` Edge Function, which writes the subscription; the browser never writes it.
32. **The library is the account's.** Adding a book, changing its status (Want to read, Reading, Finished) and removing it save to `library_items` straight away and are private to the account. The household's profiles share it; Kids profiles see only Kids-rated titles in it. If a save fails, the page says so beside the button and nothing changes on screen.
33. **Logs are saved too.** Writing, editing and deleting a log saves to `logs`, shown on the book's page with the account's display name and date. The database refuses a log for a book that isn't in the writer's library, and removing the book deletes the writer's logs about it. Other readers see the log but can't change it.
34. **Library page (`/library`).** *My library* lists every saved book, newest first, with a filter by status (with counts), a status menu and *Remove* (which warns that logs go too). *Favorites* shows the profile's favourites. *Lists* holds custom lists: create, rename, delete, reorder (Move up / Move down keep keyboard focus), add books from the library and remove them. Every view has an empty state that says what to do.
35. **The demo** stays a sample household kept in memory; it never touches Supabase.

### Phase 7: Reader and player

36. **Reader (`/read/:id`).** Full screen and distraction-free, for LiteraryWorm titles with an ebook. The top bar (Close, title and chapter, Chapters, Bookmarks, Display) and the bottom bar (previous and next page, a progress bar with chapter marks, the chapter name, page and percentage) fade after 4 seconds and come back on a tap, mouse move, key press or focus. Pages turn with the arrow keys or Page Up/Down, the buttons, a swipe, or a tap on the outer edges on touch screens. Each chapter opens with its name and a drop capital.
37. **Display.** Theme (light, sepia, dark), font (Literata, DM Sans, or Lexend for easier reading), six text sizes (which also follow the accessibility menu's text size), line spacing and margins. The choices stay with the profile until the page is refreshed.
38. **Player (`/listen/:id`).** Cover, title, author, narrator and chapter; a progress bar with chapter marks, elapsed and remaining time; previous chapter, back 15 seconds, play/pause, forward 15 seconds, next chapter; speed from 0.5× to 3× (saved per profile); a sleep timer (5, 15, 30, 45 or 60 minutes of playing, or the end of the chapter); *Skip opening credits* and *Skip closing credits* during the first and last 30 seconds. Space plays and pauses, and the arrow keys skip 15 seconds, when focus isn't on a control.
39. **Chapters and bookmarks** in both: the chapter list marks the current chapter; a bookmark saves the place ("Chapter 3, page 2" or "Chapter 3, 12:40") and can be opened or removed later.
40. **Progress and Continue reading.** The place is saved as the reader turns pages and every 15 seconds of listening, on pause and on leaving. One position per book, so the reader and the player pick up from each other. Home's *Continue reading* lists unfinished books, most recent first, and reopens the format used last at the saved place; the book page's buttons say *Continue reading · 42%*. Opening a book adds it to the library as *Reading* (a *Want to read* book moves to *Reading*).
41. **Mark as finished?** Dragging the progress bar to the end, or turning past the last page, asks first; *Not yet* stays put. Finishing (or the audiobook reaching its end) moves the book to *Finished* and out of *Continue reading*, with *Write a log* next.
42. **Daily limit.** A profile with a daily limit (set with the account password in Phase 2) counts reading time while the reader is open and listening time while playing. When it's used up, the reader and player stop with *That's today's reading time*; *Ask a grown-up for more time* takes the account password and allows 30 more minutes. The demo's Kids profile, Mia, has a one-hour limit.
43. **Saved for real accounts.** Progress and bookmarks save to `reading_progress` and `bookmarks` in Supabase, private to the account and tied to a library book (removing the book removes them). If a save fails, the reader says so and keeps going; the next page turn tries again. The demo keeps them in memory.

### Phase 8: Account and household

44. **Profiles are saved.** A real account's household profiles live in `reader_profiles`: the first is created from the account holder's name, and adding, renaming, avatars and favourite genres save straight away. Kids profiles (with the parent's consent and the account password), PINs, daily limits, age-rating changes and deletes go through the `manage-profile` function, which checks the account password again. PINs are checked on the server, which counts wrong tries and locks the profile for 15 minutes after five.
45. **After a refresh** a member with one unguarded profile carries on; a household with more profiles (or a PIN or Kids profile) starts at *Who's reading?*, so locks still apply.
46. **Account (`/account`).** Section links at the top, then:
    - **Plan and billing:** plan, price, status, next charge and billing day; *Change plan*, *Pause membership* / *Resume membership*, and *Cancel membership* (it runs to the next billing date with no more charges) / *Keep my membership*. Pausing and cancelling ask first.
    - **Sign-in:** the display name shown on logs, the email (read only for now) and *Change password* (current password first; the same 15–64 character rules as sign-up).
    - **Preferences:** marketing emails on or off; a pointer to the accessibility menu.
    - **Family:** each profile with its age rating, PIN and daily limit, and *Manage profiles*.
    - **Privacy:** *Download my data* (a JSON file of the account, profiles, library, progress, bookmarks and logs; never the password or PINs) and the privacy notices.
    - **Help** links, and the **Delete account** danger zone.
47. **Paused or ended.** While paused, or after a cancelled plan's end date, the reader and player say so and link to *Resume in Account* or *Choose a plan*; the library and progress stay.
48. **Delete account.** Asks for the account password and a tick to confirm, then the `manage-account` function cancels the plan and deletes the user, which removes the profiles, library, logs, progress and bookmarks with it. The home page confirms it. The demo can't be deleted.
49. **Ask a grown-up.** On a Kids profile, Account and *Manage profiles* ask for the account password before showing anything.
50. **Accessibility pass.** Dialog close buttons and *Show password* toggles are now 44px; Lighthouse accessibility is 100 on every page checked.

### Phase 9: Study tools, read-along and the mini-player

51. **Highlights.** Selecting words on a reader page (widened to whole words) brings up a small toolbar: four highlight colours (yellow, green, blue, pink), *Add note* and *Define*. The passage is marked in that colour straight away for in-memory accounts, and after it saves for members (`highlights`, private to the account, deleted with the book). Selecting a highlight again opens it to change the colour, write or edit the note, or remove it.
52. **Notes.** A note belongs to a highlight. Highlights with a note show a small note mark; the note opens from the highlight. *Notes and highlights* (a reader toolbar button) lists every one in the book by chapter, with its colour, the words and the note, and goes to the page, edits or removes it. The list is how keyboard users reach their highlights.
53. **Dictionary.** *Define* on a single selected word, or *Dictionary* in the reader toolbar (a search field, so it works by keyboard), shows the word, its pronunciation and up to three meanings with examples. Definitions come from the `dictionary` Edge Function, which asks the Free Dictionary API on the server, and Wiktionary itself when that service is down (both Wiktionary data, CC BY-SA); the browser never calls either. Kids profiles can use it too. Unknown words get *No definition found*, with a spelling hint.
54. **Read-along transcript.** The player shows the chapter's transcript under the controls, with the sentence being read marked and kept in view as the narration moves (*Follow the narration* can be turned off to read ahead). Selecting a sentence jumps there. Transcript on or off, its size (small, medium, large) and its language (English or Spanish) are in the accessibility menu under *Audio and transcripts*, kept with the other accessibility settings, and beside the transcript in the player; a button in the player bar shows or hides it. The sentences are in the Tab order one at a time (the arrow keys move between them). The transcript is sample text timed to the sample clock and says so.
55. **Mini-player.** Leaving the player keeps the book playing. A mini-player sits at the bottom of every page (above the tab bar on phones) with the cover, title, chapter and the time left in it, a thin progress line, *Back 15 seconds*, *Play/Pause* and *Close*; the title opens the full player. The place keeps saving as it plays. Opening the reader pauses it (one book at a time); closing it, switching profile, signing out or reaching the daily limit stops it and saves the place.
56. **Download my data and removing a book** now include highlights and notes.

### Phase 10: Lists and ratings that last

57. **Saved per profile.** A member's favourites, ratings (Not for me / I like this / I love this), custom lists and recent searches are saved to Supabase for the profile that made them (`favorites`, `book_ratings`, `custom_lists`, `custom_list_items`, `reader_profiles.recent_searches`), so they survive a refresh and follow the member to another device. Each change saves first, then shows; a failed save says so beside the control and nothing changes. Recent searches save in the background. The demo keeps them in memory.
58. **Favorites shows every title.** Google Books favourites appear beside LiteraryWorm's own, with their details fetched through the `books` function.
59. **Share a list by link.** Each custom list has *Share*: it makes a private link (a random 22-character token) to copy, and *Stop sharing* turns the link off at once; sharing again makes a new link, so an old one never comes back. Kids profiles and the demo don't see *Share*; a profile moved to Kids stops sharing.
60. **Shared list page (`/lists/:token`).** Public: anyone with the link sees the list's name, description, "A list by" the profile's name, and its titles (LiteraryWorm covers or Google Books covers), never the account, library or history. A wrong or stopped link says the list isn't shared. Signed-in Kids profiles see only titles rated for them.

### After Phase 10: LiteraryWorm, listening and summaries

61. **LiteraryWorm.** The app and the business are LiteraryWorm, at [www.literaryworm.com](https://www.literaryworm.com). Every page and the logo say so; on narrow phones the wordmark is set a little smaller, and below 390px only the book mark shows (it's still announced as "LiteraryWorm, home").
62. **Refresh anywhere.** Any page can be refreshed or opened from a link (`vercel.json` sends every path to the app).
63. **Genres open at the books.** Choosing a genre under *Or browse a genre* on Search, a genre button on Home, or *See all* on a row opens Home at that genre's books, not at the top.
64. **Real narration.** The public-domain titles (17, now 21) play their LibriVox recording, by real narrators (credited and linked), with the recording's own chapters and lengths. Speed, skips, chapters, the sleep timer, the daily limit and the mini-player all work as before; a chapter that fails to load is retried once, then the player says so.
65. **Choose a voice.** The player's *Voice* list offers *Original narrator* (the default where there is one) and the device's British, American and Australian English voices. A voice reads the full public-domain text, or sample text for the other titles, and the clock follows it. With no choice made, other titles are read by a British woman's voice where the device has one. How many voices there are depends on the device and browser.
66. **Summaries.** On any book page, members and the demo household can read a *Short* summary (two or three sentences, no spoilers) or a *Detailed* one (the whole book, marked as containing spoilers). Claude writes them the first time anyone asks (up to half a minute) and LiteraryWorm keeps them, so everyone after gets them at once. They're labelled as written by AI.

### Phase 12: reading together, and offline

67. **Real text in the reader.** Public-domain titles open on their own text (Project Gutenberg, with proper dashes and no repeated chapter headings), about 1,600 characters a page. *Summary* on a My Library row opens the summary without leaving the library.
68. **Another device.** Leave a book on the phone and open the laptop: your place is already saved, and an open reader offers *Go there* or *Stay here*.
69. **Follow along.** When a device voice reads a public-domain title, the Read-along shows the real text and marks the sentence being spoken.
70. **Goals.** My Library → *Goals*: set how many books to finish this year, see whether you're on pace, keep a reading streak going, and look back over six months.
71. **Book clubs.** My Library → *Clubs*: start a club around a book with a finish date and share its code, or join with a code. The club page shows where the club should be today, where you are, the members, and a discussion by chapter; posts about chapters you haven't reached stay hidden until you choose to see them.
72. **Ask the book.** In the reader of a public-domain title, *Ask the book* answers questions from the text up to your chapter, never giving away what comes later.
73. **Offline.** *Read offline* on a public-domain book page saves its text, and its audio if you like, on the device; the reader and player then work on a plane.
74. **Four more classics.** A Christmas Carol, The Call of the Wild, The Picture of Dorian Gray and The Wonderful Wizard of Oz join the catalog with narration and full text.

### Phase 13: a fuller player, and listening on another device

75. **The mini-player does more.** It shows the book's title and the current chapter with the time left in it. Beside *Play* sit previous and next chapter, skip back and forward, volume and mute (on wide screens), and *More*: beginning or end of the book, *Skip intro*, *Skip outro*, the table of contents, the index, references and bookmarks, *Go to a time*, speed, the sleep timer and skipping, *Listen on another device* and *Open the full player*. On phones the chapter buttons and volume move into *More*.
76. **The full player has the same controls.** *Beginning*, *Skip intro*, *Skip outro* and *End* under the play controls, a volume slider with mute, and in the top bar the table of contents, *Go to*, bookmarks, *Listen on another device* and player settings. M mutes.
77. **Go to.** One dialog, four parts: *Contents* (every chapter with its start time), *Index* (type a word or a name, see every place it's read with the words around it, and go there), *References* (the opening and closing credits and your bookmarks, with *Bookmark* for the current place) and *Time* (type 1:05:30).
78. **Skipping and volume are remembered.** Skip back and forward can each be 5, 10, 15, 30, 45 or 60 seconds; *Skip intros* starts every chapter after the LibriVox announcement and *Skip outros* moves on before "End of chapter…". These, the volume and mute are saved on the profile for members (`reader_profiles`), and kept for the visit in the demo.
79. **Listen on another device.** Signed in on a phone and a laptop, a member chooses *Listen on another device*, picks the other one and the book pauses here. The other device shows *Pride and Prejudice was sent here from Chrome on Windows, at 1:02:05* with *Listen here* and *Not now*; *Listen here* opens the player at that place and plays. A book sent for a different profile says which one to switch to. The demo household explains that this needs a member account.

### Phases 14–21: the app on the phone, reading stats, clubs together, your own books

80. **Lock screen and headphones.** While a book plays, the phone's lock screen and the system's media controls show its cover, title and chapter. Play, pause, skip back and forward, seek, and previous and next chapter work from there, from headphones, a watch or a car.
81. **Install the app.** Account → Preferences → *Install the app* puts LiteraryWorm on the home screen or desktop, where it opens in its own window and works offline. On an iPhone or iPad the page says to use Share → Add to Home Screen.
82. **Share a quote.** In *Notes and highlights*, or on a highlight, *Share as a picture* makes a card with the quote, the cover, the title, author and chapter, in the book's colours or a light or dark look. *Share* opens the phone's share sheet; *Download picture* and *Copy the quote* work everywhere.
83. **Year in Review.** My Library → *Stats*: the year's time reading and listening (and the split), books finished against the goal, days read, the longest streak, highlights and notes, month by month, the busiest month and favourite day, top genres and authors, and the books finished. Earlier years can be picked.
84. **Picked for you.** Home suggests books from what the profile finished, loved, liked and favourited (*Picked for you*, *Because you finished Pride and Prejudice*), never books already in the library, and only titles the profile may see.
85. **Club notifications.** A new post in one of your clubs shows up straight away: on the club page if it's open, as a count on the club's card, and as an alert (or, with LiteraryWorm in the background, a system notification). Posts about chapters you haven't reached never alert or count. Each club has *Tell me about new posts*.
86. **Listen together.** On a club page, *Start listening together* plays the club's book; other members choose *Join* and hear the same place as the leader plays, pauses and skips. A bar says who's leading, with *Stop* or *Leave*.
87. **Bring your own books.** My Library → *Uploads* → *Choose an EPUB*. The book opens in the reader like any other, with its place, bookmarks and highlights kept; *Delete* removes it. Not on Kids profiles.
88. **Cookie Policy.** The footer links to a Cookie Policy (after the Privacy Policy) that says LiteraryWorm sets no cookies of its own and lists what the browser keeps and why.
89. **Team access.** An admin opens Account → *Team access*, sees the team, and gives an email a role (Admin, Editor, Developer, Billing, Customer service or Blog); someone without an account yet gets it when they sign up. Every staff member sees their own access there.
90. **Editing a policy.** An editor or admin opens any footer page and chooses *Edit page*: the title, summary and each section (a heading and its paragraphs) can be changed, added, moved or removed, then *Save and publish* puts it live at once. Earlier versions are kept.

### After Phase 22: the policies from Termly, and a consent banner

91. **The policies in full.** The Cookie, Privacy and Accessibility policies, the Terms of Service and a new End User License Agreement, Acceptable Use Policy, Return Policy and Disclaimer come from Termly, adapted so every statement is true of the app (no payment yet, no ads, no social login, Claude as the only AI). The Copyright/DMCA page says where to report content: report@literaryworm.com.
92. **Cookie choices.** On a first visit, Termly's banner asks for a choice; *Consent Preferences* in the footer changes it at any time. LiteraryWorm sets only essential cookies, so declining changes nothing: covers, audio and accounts work either way.
93. **Privacy requests.** The footer links Termly's request form for *Do Not Sell or Share My Personal information* and *Limit the Use Of My Sensitive Personal Information*.

### After Phase 22: paying with Stripe

94. **Paying for a plan.** Choosing a plan shows the price, the billing day and the renewal terms, then *Continue to payment* opens Stripe's secure page, which also takes a promo code. The first charge covers the days until the billing day; then the full price on that day each month. Back on LiteraryWorm, Plans waits a moment for the membership, then carries on to setting up profiles.
95. **Plan and billing.** Account shows the plan, status and next charge, with *Update payment method* (Stripe's page), *Change billing day* (the days until the new date are free), *Pause*, *Resume*, *Cancel* and *Keep my membership*. A failed payment shows *Payment failed*. A member who chose a plan before billing started sees *Add a payment method* to continue. Below them, *Promo code* shows the code on the membership and how long it lasts, with a box to add one (a new code replaces the old), and *Billing history* lists each charge from Stripe with its amount, any promo saving, whether it was paid, and a link to Stripe's receipt.
96. **Staff.** Everyone on staff (any role: Admin, Editor, Developer, Billing, Customer service, Blog, Sales) has a complimentary membership while they're on the team and is never charged; Account says *Complimentary*. Removing someone's last role ends it.
97. **Email.** Confirming a new address and resetting a password are emailed by Mailgun, in LiteraryWorm's own design. After signing up, *Check your email* has *Send the email again* (then a one-minute wait); logging in before confirming says so and offers the same button.
98. **Playback speed follows the profile.** The speed chosen in the player or mini-player is saved with the profile's other player settings, so it's the same on every device.
99. **Two-step sign-in.** Account → *Sign-in* turns it on: scan the QR code (or type the setup key) into an authenticator app, then enter a code to confirm. From then on, log-in asks for a six-digit code after the password, and nothing of the account loads until it's given. Turning it off needs a current code.
100. **Authors and narrators.** On a book page, the author's name and the narrator open their own page: their LiteraryWorm titles, an author's Google Books titles, and *Follow*. Home's *New from people you follow* puts their titles first.
101. **Remind me.** A Google Books title that isn't out yet says when it's due and offers *Remind me*. On the day, Home shows it under *Out now* until dismissed; My Library → *Reminders* lists every reminder.
102. **Google Books preview.** Where Google allows it, the book page has *Preview* (or *Read it on Google Books*); Google's viewer loads only when the reader opens it.
103. **Staff dashboard.** Billing staff and admins have *Open the dashboard* in Account → Team access: accounts and new sign-ups week by week, paid memberships by plan and status, monthly revenue at list price, reading in the last 30 days, clubs, and Stripe events waiting for review. Totals only, never names or emails.
104. **Gift memberships.** *Gifts* (profile menu, Account, Plans) sells 1, 3, 6 or 12 months of any plan, paid once on Stripe's page; the code appears under *Your gifts* with *Copy code*. Whoever has it types it into *Redeem a gift*: on a membership of the same plan, the next charge moves back by those months; with no membership, one starts today, free, with no card, and ends when the gift does unless a card is added. Account says *None until … : a gift*.
105. **Book-out emails.** When a book someone set *Remind me* on comes out, the account holder gets an email that day as well as the Home card: one email listing every book that's out, with which profile asked when there's more than one. *Email me when a book I'm waiting for comes out* in Account → Preferences turns them off; the Remind me button says when an email will come.
106. **Club invites by email.** On a club's page, *Invite by email* sends someone a LiteraryWorm email naming who invited them, the club, its book and finish date, with *Join the club*. The link opens */clubs/join/<code>*: a visitor signs in (or signs up, confirms and opens the link again) and lands in the club. A wrong or changed code says so and points to My Library → Clubs.
107. **Notification bell.** The bell in the header shows how many things are new for the profile: books from its reminders that came out since it last looked, and new posts in its book clubs (only about chapters it has reached). Opening it lists them, each linking to the book or the club, and marks the books seen on every device the profile uses; club posts stop counting once the club is opened.
108. **New from authors you follow.** When an author a profile follows has a new book out (in the last 30 days, on Google Books), it shows in the bell under *New from authors you follow* and, once a week on Mondays, the account holder gets one email listing them, naming the profile when the household has more than one. *Email me new books from authors I follow* in Account → Preferences turns the email off; the bell keeps them either way. Kids profiles don't get them.
109. **Deleting an account confirms by email.** After the account is deleted, the address gets one last email saying what went, that nothing more will be charged, and who to write to if it wasn't them.
110. **Cancel 48 hours ahead.** Account → Plan and billing says: cancel at least 48 hours before your next billing date to stop the next charge; cancelling later still ends the membership, but after one more month; no refunds. *Cancel membership* says which applies before it's confirmed, and afterwards *Next charge* shows the one charge still to come (*$12.99 on November 5, then the plan ends on December 5*). The checkout's renewal terms, the Terms and the Return Policy say the same.
111. **The price after a promo code.** Under the code on the membership, Account says what the plan costs once it stops applying (*Then $12.99 a month from January 5, 2027*), unless the code lasts as long as the membership.
112. **Share your year.** In My Library → Stats, *Share as a picture* draws the year as a card to post: *Avery's 2026 in books*, four big numbers (books finished, of the goal if there is one; hours; days with reading; the longest streak), the covers of the latest books finished, and the top genre and author. Dark or light; Share where the device can, Download, or Copy as text. Nothing leaves the device until the reader shares it.
113. **Household challenges.** In My Library → Goals, a profile starts a challenge for the household (*5 books in November*, *20 hours by 28 November*, *10 days in December*) and joins it; everyone else on the account sees it, joins with one tap, and watches each other's progress bars fill. Kids profiles can join. When the dates pass, it moves under *Finished challenges*. Nothing is shared outside the household.
114. **Bring your reading history.** In My Library, *Import from Goodreads or StoryGraph* takes the CSV file either site exports. The file stays on the device; LiteraryWorm finds each book (its own titles first, then Google Books, checking the author), shows what it found and what it couldn't, and adds the ticked ones with their shelf and star rating. Books read before don't count towards this year's goal.
115. **Who's who.** In the reader of a public-domain classic, the people icon opens *Who's who*: everyone met so far, with a line or two on what the book has shown about them and the chapter they first appeared in. It never lists anyone still to come or hints at what happens to them. Not on Kids profiles.
116. **What's new.** The footer's first link, *What's new*, also linked under the questions on the home page and Plans, between the rows on members' Home (*Latest: … See everything that's new*) and in Account → Help, lists every change to LiteraryWorm, newest first, each marked as a new feature, an update or a fix, with the biggest marked *Major*. Members who want them can turn on *Email me a monthly round-up of what's new* in Account → Preferences: on the 1st of each month, an email with last month's major changes and a link to the page for the rest. Every one has an *Unsubscribe in one click* link, and mail apps' own unsubscribe button works too.
117. **More genres.** Beyond the brief's six (Technology, Adventure, Sci-Fi, Fiction, Non-Fiction, Horror), readers can browse and search Fantasy, Mystery, Thriller, Romance, Classics, Historical Fiction, Young Adult, Children's, Biography & Memoir, History, Science, Self-Help and Poetry: in *Keep discovering* on the public home and on Home, in Search's *Or browse a genre*, and as Search's Genre filter. Each has its own URL (`/?genre=historical-fiction#discover`). Home keeps one row each for the brief's six, so it still loads quickly; the rest open from the links. Kids profiles see only the sample catalog's books in a genre, as before.
118. **Plan limits.** Each plan's audiobook hours and offline devices now apply. Listening is counted for the whole household on every device: when Basic's 5 hours or Standard's 30 are used up, the player and mini-player show *That's this month's listening*, with *See plans* and *Read it instead*, until the 1st of next month (Premium has no limit). Saving a book with *Read offline* takes one of the plan's device places (Basic 1, Standard 3, Premium 5); when they're all taken, the book page lists the devices holding them, and *Free* on one releases it and carries on saving. Account → Plan and billing has *This month*: listening so far and the devices in use, each with *Free*. A freed device removes its offline books the next time it opens LiteraryWorm.
119. **Favourite genres from the full list.** The first-run *What do you like to read?* step and the profile editor offer all nineteen genres. Favourites chosen before from the older list become the genre that covers them (Science fiction → Sci-Fi, Memoir → Biography & Memoir). Up to two favourites beyond the brief's six get their own Home row, marked *One of your favourite genres*. More of our own titles are tagged Thriller, Historical Fiction and Fantasy, so those genres have LiteraryWorm books too, including for Kids profiles.

### Where the build differs from the blueprint, and why

- **Plan before profiles.** The blueprint lists "choose a plan" then "create their first profile". The build follows that order and creates the first profile automatically from the account holder's name, so no one lands on an empty *Who's reading?* screen.
- **Emails are for what members asked for.** Mailgun sends Supabase Auth's confirmation and password-reset emails, book-out emails, club invitations, the weekly email of new books from followed authors and the deletion confirmation, all in LiteraryWorm's own templates. Club alerts and marketing don't email yet.
- **Demo accounts are not deleted after 24 hours.** Everything resets on refresh instead.
- **One library per account.** The brief gives each user one library and shows logs with that user's display name, so the household's profiles share the account's library and logs. Kids profiles see only Kids-rated titles in it and don't post logs.
- **Reader display settings, narrator voice and daily time used are still in memory**, per profile. They reset on refresh. Profiles (Phase 8), their favourites, ratings, lists and recent searches (Phase 10), their volume, skip lengths and intro and outro skipping (Phase 13), and their playback speed are saved.
- **A device is one visit.** Each open copy of the app counts as a device until it's closed (the app keeps nothing in browser storage to recognise a device later), so a refreshed tab shows up as a new device and the old one drops off the list after a couple of minutes.
- **Developer, Billing, Customer service and Blog roles are recorded but not used yet.** Admins can give them now; the tools that will check them don't exist yet, and the Team access page says so.
- **The cookie banner is Termly's.** LiteraryWorm sets no non-essential cookies of its own (only the sign-in session, the app's files and books saved for offline, all in the Cookie Policy). Termly's banner holds back third-party resources until the visitor chooses; Google Books covers and the preview are marked essential, so they load either way.
- **Lock-screen controls need something playing.** Browsers show the media controls for a book read by its recording; a device voice or the silent sample clock may not appear on every lock screen.
- **Installing is the browser's offer.** Chrome and Edge offer to install once a site has been used a little; until then *Install the app* says where the browser keeps the option.
- **Recommendations are worked out on the device**, from the profile's own history, rather than by Claude: they're instant, private and the same for the demo.
- **Club alerts arrive while LiteraryWorm is open** (a tab or the installed app). There are no emails or push notifications to a closed app yet: Mailgun sends only the sign-in emails so far, and push needs Web Push.
- **Listen along follows within a few seconds,** not to the word; each listener's own connection loads the audio. Only books with a recording can be played together.
- **Uploads keep the text only,** not images, styles or the EPUB itself, and are ebooks only (no device voice yet). DRM-protected books can't be read. Each upload belongs to the profile that added it.
- **Previews come from Google.** The book page's *Preview* is Google's embedded viewer, offered only where Google allows it and loaded only when the reader opens it (Google may set its own cookies then, which the Cookie Policy says). It shows whatever pages Google makes available for that edition.
- **Reminders show in the app, not by email.** *Remind me* is on Google Books titles whose release day is still to come (Google must give the exact day); on the day the book is listed under *Out now* on Home until dismissed, and My Library → Reminders lists them all. On the day the bell counts it as new and members get an email; there are no next-in-series reminders, because the catalog has no unreleased titles.
- **Following doesn't notify yet.** Author and narrator pages list their titles (and an author's Google Books titles, since Google Books doesn't list narrators), and a profile can follow them; new titles from them appear first on Home (*New from people you follow*), and new Google Books titles from followed authors reach the bell and a weekly email. Narrators aren't checked (Google Books doesn't list them), and there's no photo or bio (none are licensed); publisher pages aren't built.
- **Two-step sign-in has no recovery codes.** Supabase Auth doesn't make them, so the code step points a member who lost their phone to support, who can remove the factor once they've checked it's them. Passwords stay at least 15 characters with it on (the blueprint's 8 needs a per-account rule Supabase doesn't have).
- **Intros and outros are timed, not detected.** LibriVox chapters open with about 15 seconds of announcement and close with about 5; the sample titles have 30 seconds of credits at each end of the book. Skipping uses those lengths.
- **No email change or signed-in devices yet.** Promo codes and billing history come from Stripe. Deleting an account happens straight away rather than within a legal deadline, and a confirmation email follows.
- **Sample text, and real audio for public-domain books only.** LiteraryWorm doesn't hold the text or narration of any copyrighted book, so the reader shows original placeholder prose, and in the player those titles are read from it by a device voice (or run silently). The 21 public-domain titles play real LibriVox narration and the reader shows their full public-domain text (Project Gutenberg), which a device voice can also read aloud. Highlights made on those books' sample pages before then stay in the highlights list but aren't drawn on the new pages.
- **Search can match outside the title for a while.** When Google Books returns nothing for its title (`intitle:`) and genre (`subject:`) filters, as it did for hours in October 2026, the `books` function asks again with the plain words, so results stay filled but can match words elsewhere in a book. It goes back to title only by itself when Google recovers.
- **Email confirmation is a link.** A new account confirms its address from the email before logging in; *Check your email* and the log-in page can send it again (Supabase allows one a minute).

### Assessment brief and blueprint together

The assessment brief in `README.md` (graded) and this blueprint differ in places. The build meets the brief in full and keeps the blueprint's experience around it:

| Area | Assessment brief (README) | Blueprint (this file) | As built |
| --- | --- | --- | --- |
| Home | Books about "technology", Netflix-style | Featured carousel plus Continue Reading, Trending, New Releases, Top 10 and genre rows | Both (Phase 3): technology row and feed on the public home; blueprint rows on member Home |
| Search | Title only, public | Title, author, narrator, ISBN, keyword, with filters | Both (Phase 5): public title-only search through the Edge Function, with the blueprint's filters (genre, sort, source), *Did you mean*, recent searches and Surprise Me |
| Genres | Adventure, Technology, Horror, Sci-Fi, Fiction, Non-Fiction | Genres from the catalog | The brief's six (Phase 3) |
| Lists | Load more on every list (button or infinite scroll) | Horizontal rows | Both: infinite scroll plus a button on grids; *Load more* at the end of rows |
| Book route | `/books/:id` | `/book/:id` | `/books/:id`; `/book/:id` redirects |
| Library | One library with a reading status (want to read, reading, finished) | Reading List, Favorites and Custom Lists | Both (Phases 4 and 6): the account's `library_items` with the three statuses (Reading List = *Want to read*), plus Favorites and Custom Lists on the Library page |
| Reviews | "Logs": text plus optional 1–5 rating, only for books in your library, deleted with the library entry | Reviews plus Not for me / I like this / I love this | Both (Phase 4): logs as the brief describes (enforced in the database, mirrored in the app), plus the three rating buttons |
| Book details | Google Books data with at least two extra fields; all readers' logs with display name and date | Cover, synopsis, author, narrator, length, format, age rating, reviews, More Like This | Both (Phase 4): publisher, published date, pages, language and categories, credited to Google; logs; More like this |
| Profiles | One profile per user with a display name | Up to five household profiles per account | Both: `profiles.display_name` for logs, household `reader_profiles` |
