
# BookWorm: User Stories

*A Netflix-style reading and listening app built on the Google Books catalog, for readers of all ages.*

Version 2: edited and corrected to match **BookWorm_Blueprint.md**. This list is pulled from `front_end/` (the user journey and each page's `user_journey.md`). Each story is one thing the app has to *remember* or *enforce*. Story 1 isn't on any single page; it's there so the database knows who owns what.

**How to read this list**

- Stories are grouped by area and renumbered. **(was #N)** points to your original number, and **(new)** marks a story that was missing.
- **Roles:**
  - **Visitor:** not signed in.
  - **Account holder:** the adult who pays, 18+.
  - **Member:** any signed-in profile.
  - **Parent:** an account holder managing kids' or teens' profiles.
  - **Reader / Listener:** a member using the reader or the audiobook player.
  - **Support staff**, **Moderator**, **Admin**, **Affiliate**.
- **Profile age ratings:** Kids (under 13), Teen (13–17), All.
- A full list of changes and why is at the end ([What changed and why](#what-changed-and-why)).

---

## 1. Accounts, sign-in, and security

1. **(was #1)** As an account holder, I want an account with my name, email, and password so that my private data (lists, history, settings, payments) belongs to me and no one else can see or change it. *(Supabase Auth keeps the password. Row-level security shows each member only their own rows. The catalog and published reviews are publicly readable. Logs, tickets, and payments are never public.)*
2. **(new)** As a visitor signing up, I want to enter my date of birth and accept the Terms of Service, with the Privacy Policy shown, so that only adults (18+) open and pay for accounts. Kids and teens use profiles on a parent's account instead.
3. **(was #27)** As an account holder, I want the app to require a password of at least 15 characters (or 8 with two-step sign-in on), allow up to 64 characters, not force a mix of character types, and refuse passwords found in data breaches, so that my account is hard to break into.
4. **(was #26)** As an account holder who forgot my password, I want to request a reset link by email and choose a new password from it so that I can get back in. Expired links ask for a new one, and the page never reveals whether an email is registered.
5. **(was #32)** As a member, I want to stay signed in when I refresh or come back later, until I choose Sign out, so that I don't have to sign in every time.
6. **(was #55)** As an account holder, I want two-step sign-in with an authenticator app so that my password alone isn't enough to get in. Until the code is entered, none of my data can be read, and turning it off needs a current code.
7. **(was #56)** As an account holder, I want to see which devices are signed in (device, browser, last active, and which one is this device) and sign out any of them, or all but this one, so that a lost phone or shared computer can't keep using my account.
8. **(was #28)** As a visitor, I want to try the app with my own private demo account, without signing up, so that I can explore every feature. The demo uses no real personal data, can't make payments, and is deleted after 24 hours.
9. **(was #31)** As the site owner, I want public features (demo accounts, referral clicks, Google Books lookups) limited per visitor (by IP address, kept one day) so that no one can flood the service or inflate an affiliate's counts.

## 2. Profiles and family controls

10. **(was #41)** As an account holder, I want up to five profiles, each with its own name, avatar, and age rating (Kids, Teen, or All), so that everyone at home gets their own lists, Continue Reading, history, reminders, and recommendations. A profile's settings don't affect the others, and deleting a profile doesn't touch the account or other profiles.
11. **(new)** As a parent creating a Kids profile, I want to give verifiable parental consent and read the Children's Privacy Notice first so that my child's reading data is collected only with my permission. I want to be able to review, delete, or stop collection of that data at any time.
12. **(was #54)** As an account holder, I want to lock a profile with a four-digit PIN (set or removed with the account password) so that children stay in their own profile. Five wrong PINs lock the profile for 15 minutes.
13. **(was #54)** As a parent, I want Kids profiles to ask for the account password (*Ask a grown-up*) before Account or profile management opens so that children can't change settings.
14. **(was #60)** As a parent, I want to set a daily reading and listening limit on a profile (30 minutes to 4 hours, with the account password) so that the reader and player stop once the time is used up. I want to allow 30 more minutes with the password when I choose. Nobody reading can raise the limit or reset the time used.
15. **(was #64)** As a parent, I want to see how long a limited profile read or listened on each of the last 7 days, with the total and daily average, so that I can tell whether the limit is right.
16. **(new)** As a parent, I want Kids profiles to have no chat, no public reviews, no sharing, no payments or tips, and no AI assistant (unless I turn it on) so that my child isn't exposed to strangers or purchases.
17. **(was #40)** As a parent, I want every title to carry an age rating (Kids, Teen, or All) so that each profile shows only titles within its setting. For Google Books titles, BookWorm uses Google's mature/not-mature flag plus its own review, and unrated titles stay hidden on Kids and Teen profiles.

## 3. Membership and billing

18. **(was #2)** As an account holder, I want to choose a plan (Basic, Standard, or Premium) and see its price, what's included (for example, the number of profiles, audiobook hours, and offline downloads), and the auto-renewal terms before I pay, so that I know what I'm agreeing to.
19. **(was #3)** As an account holder, I want to save a payment method through Stripe and choose a billing day so that I'm charged on a date that suits me. BookWorm stores only the card brand, last four digits, and expiry, never the card number.
20. **(new)** As an account holder, I want an email confirming my subscription, its price, its renewal date, and how to cancel, plus receipts for each charge, so that I have a record.
21. **(was #4)** As an account holder, I want to pause, cancel, or restart my membership online in a few clicks, with no phone call or chat required, so that I only pay when I'm reading.
22. **(was #12, #30)** As an account holder, I want to apply a promo code and have it checked on the server against real offers and my plan, so that only valid discounts apply. I also want to see the price after the promo ends.

## 4. Discovering books

23. **(was #5)** As a member, I want to search books by title, author, narrator, ISBN, or keyword so that I can find a specific book.
24. **(was #6)** As a member, I want to filter by genre, format (ebook, audiobook), length, language, rating, age rating, and release date, and sort by relevance, popularity, newest, or rating, so that I can find something that interests me.
25. **(was #49)** As a member, I want search to find titles even when I misspell them (*Did you mean…?*) so that a typo doesn't hide what I'm looking for.
26. **(was #50)** As a member, I want my last ten searches per profile to show in an empty search box until I clear them so that I can repeat a search quickly. Nothing is saved while history is paused.
27. **(was #33)** As a member, I want Home rows of trending and popular books from Google Books, credited to Google Books, so that I can discover titles beyond BookWorm's catalog.
28. **(was #34)** As a member, I want my searches to include matching Google Books titles below BookWorm's own results, with the same filters, so that I can look up any book.
29. **(was #35)** As a member, I want to open a book's page to see its cover, synopsis, author, narrator, length, format, age rating, and reviews and decide whether it's for me. As the site owner, I want the Google Books API key kept on the server so that no one can copy it from the browser.
30. **(new)** As a member, I want a free preview of a Google Books title (using Google's Embedded Viewer, loaded only when I ask) and links to buy it, so that I can try books BookWorm doesn't carry in full.
31. **(was #39)** As a member, I want recommendations based on the titles I save (*Because You Saved* on Home, *More Like This* on a book page) so that I discover similar books. Turning off personalized recommendations hides the Home row.
32. **(was #51)** As a member, I want to rate a title Not for me, I like this, or I love this in one tap so that recommendations follow my taste, and titles I don't want stop being suggested to my profile.
33. **(was #57)** As a member who doesn't know what to read, I want to describe what I'm in the mood for in my own words and get up to five titles with a reason each, chosen only from titles my profile is allowed to see. I want them labeled as AI suggestions, and I want to know what's sent to the AI service (never my name, email, or account ID), so that I find something quickly without giving away who I am.
34. **(new)** As a member, I want a Surprise Me button on Home and Search that opens a random title my profile can see so that I can find something new with one tap.
35. **(new)** As a member, I want to follow an author or narrator so that I'm notified when they release a new book.

## 5. Reading and listening

36. **(new)** As a reader, I want to read an ebook with adjustable font, size, line spacing, margins, and theme (light, sepia, dark) so that reading is comfortable for my eyes.
37. **(new)** As a reader, I want to add bookmarks, highlights, and notes and look up words so that I can study and return to passages. These stay private to my profile.
38. **(new)** As a member, I want my place in every book saved automatically and synced across devices (*Continue Reading*, most recent first) so that I can switch from phone to laptop and pick up exactly where I stopped.
39. **(was #37)** As a listener, I want the audiobook player to remember my volume and playback speed on every device so that I don't have to set them each time.
40. **(was #52)** As a listener, I want skip back/forward 15 seconds, Skip Opening Credits and Skip Closing Credits, a chapter list, chapter marks on the progress bar, and a sleep timer so that I get to the part I want quickly. I also want a mini-player that keeps playing while I browse.
41. **(new)** As a reader, I want dragging the progress bar to the end to ask *Mark as finished?* instead of finishing the book by accident so that my Continue Reading stays accurate.
42. **(new)** As a member, I want to download licensed titles for offline reading and listening, see their size, and remove them so that I can read without a connection. Downloads expire if my subscription ends, as publisher licenses require. Which titles are downloaded is kept only on my device.

## 6. Library and lists

43. **(was #7)** As a member, I want to add titles to my Reading List so that I can find them later.
44. **(was #8)** As a member, I want to mark titles as Favorites (a title can be on both lists) so that I get recommendations based on what I love.
45. **(was #36)** As a member, I want to add Google Books titles to my Reading List or Favorites so that they appear next to BookWorm's own titles. Their details come from Google Books on the server, not from what my browser sends.
46. **(was #46)** As a member, I want my own named Custom Lists, each with a description, so that I can group titles my way.
47. **(was #47)** As a member, I want to share a Custom List by link (anyone can open it without signing in) so that friends can see my picks. The shared page shows only the list's name, description, my profile's display name, and its titles, never my account or history, and I can stop sharing at any time. Sharing is off for Kids profiles.
48. **(was #10, #43)** As a member, I want to set a reminder for a book that isn't out yet (or the next book in a series) so that I don't miss its release.

## 7. Reviews and community

49. **(was #9, #38)** As a member, I want to rate and review any title, including Google Books titles, so that other readers know what I thought. I want to edit or delete my own review.
50. **(was #29)** As a reviewer, I want my profile's display name shown on my reviews, with no one able to post under someone else's name (the author comes from the signed-in session, never from the browser), so that reviews can be trusted. Kids profiles can't post public reviews, and teen reviews never show a real full name.
51. **(was #63)** As a member, I want to mark another member's review as helpful (once, and take it back) and sort reviews by most helpful or newest so that useful reviews are easy to find. Nobody can vote for their own review or set the count directly.
52. **(was #62)** As a member, I want to report another member's review (spoilers, offensive, spam, or something else, with optional details) so that it gets checked. I can report a review once, and never my own.
53. **(was #62)** As a moderator, I want to see reported reviews and Book Club messages with a copy of the content and the reason, and keep or remove each one with the decision logged, so that title pages and rooms stay useful and safe.
54. **(was #48)** As a member, I want to start a Book Club room for a title and invite friends by link so that we can listen together (play, pause, and skip happen for everyone) or set a shared chapter goal for an ebook. I want to see who's in the room and chat. Only invited members can join, the link expires after six hours, and chat has Report and Block buttons. Not available on Kids profiles; teens can join only rooms from their own household.
55. **(was #53)** As a member, I want a Year in Review for each profile (books finished, pages read, hours listened, days active, longest streak, busiest month, top genres, and most-read author) that I can share so that I can look back on my year. Sharing is off for Kids profiles.

## 8. Notifications and history

56. **(was #43)** As a member, I want a bell that counts what's new (released reminders, new books from authors I follow, support replies) on every device for that profile so that I don't miss a release or an answer.
57. **(was #44)** As a member, I want to see each profile's Reading Activity day by day, hide entries or all of it, and download it so that I know and control what's kept.
58. **(was #45)** As a member, I want to pause Reading Activity (nothing new is recorded, including searches) or have old history deleted after 90 days or a year so that the app keeps only what I'm comfortable with.
59. **(was #17)** As a member, I want to see when each of my reviews, tickets, and referrals was created so that I know how recent it is.

## 9. Preferences, language, and accessibility

60. **(was #11)** As a member, I want to set preferences (autoplay of previews and the next book, email updates, and personalized recommendations) so that the app works the way I like. A profile's age rating is changed only by the account holder, not from the profile itself.
61. **(was #18)** As a visitor or member, I want to adjust text size, font (including a dyslexia-friendly font), spacing, contrast, and color, and turn on reading and navigation aids from the accessibility menu, so that the app works for how I see, read, and move. As a member, I want these settings saved so that they come back when I sign in.
62. **(was #19)** As a member, I want one-tap accessibility profiles (seizure safe, low vision, ADHD friendly, dyslexia friendly, keyboard navigation, and deaf and hard of hearing) so that I can set several settings at once.
63. **(was #20)** As a member, I want an Accessibility Policy linked from every page's footer so that I know what the app supports (WCAG 2.2 AA), its known limits, and how to report a problem or request an accessible format.
64. **(was #21, #66)** As a blind or low-vision reader, I want every page, the reader, and the player to work with my screen reader and keyboard, with image descriptions (alt text) for covers and illustrations, so that I can use the whole app without seeing the screen.
65. **(new)** As a reader who prefers listening, I want read-aloud (text-to-speech) for ebooks where the publisher's license allows it so that I can listen to books that have no audiobook.
66. **(was #22, #61)** As a deaf or hard-of-hearing listener, I want read-along transcripts for audiobooks (highlighting with the narration where the publisher provides one), with adjustable size and English or Spanish language, remembered with my other accessibility settings, so that I can follow along.
67. **(was #23, #68)** As a Spanish speaker, I want the whole app in Spanish (chosen in the accessibility menu, or automatically when my browser is in Spanish) and remembered on every device so that I can use it in my language. Book titles and synopses stay as published.
68. **(new)** As a keyboard user, I want to press **?** on any page (except while typing) to see every keyboard shortcut so that I can move around without a mouse.

## 10. Privacy and data rights

69. **(was #14)** As a member, I want to opt out of the sale or sharing of my personal data (and have my browser's Global Privacy Control signal honored automatically) so that my privacy choice is recorded and respected.
70. **(new)** As a visitor, I want to accept or decline non-essential cookies, with nothing optional set until I choose, so that I control tracking.
71. **(new)** As a member, I want to download a copy of my data (account, profiles, lists, ratings, reviews, Reading Activity) so that I can see what's kept or take it elsewhere.
72. **(was #24, #25)** As an account holder, I want to delete my account from the danger zone (it cancels my subscription first, after I confirm, and asks for my password) so that I can leave in one place. Deleting removes my access and deletes my personal data within the legal deadline, except records the law requires BookWorm to keep (such as payment records). I want an email confirming the request, with no separate support ticket needed.

## 11. Help and support

73. **(was #13)** As a member, I want to send feedback or report a problem and get a ticket number so that I can follow up. I'm asked each time before device details are attached.
74. **(was #42)** As a member, I want to read support's replies on my tickets and answer them so that problems get solved in one conversation.
75. **(was #42)** As support staff, I want to see every member's tickets by status, reply, and change a ticket's status so that problems get solved. Only staff can see other members' tickets.
76. **(new)** As a member, I want a Status page and a Home banner during outages so that I know when a problem is on BookWorm's side.
77. **(new)** As a rights holder, I want to send a copyright (DMCA) notice to BookWorm's designated agent so that infringing content is reviewed and removed.

## 12. Support BookWorm (tips): optional

*Recommendation: for a for-profit subscription service, consider removing this section (see What changed and why, item 7).*

78. **(was #58)** As an adult member, I want to leave a one-time tip by card ($1 to $10,000, from Account → Help) so that I can support the app. Each tip is recorded with its amount, date, and whether it went through. My card number never reaches BookWorm, and only I can read my tips. Payment records can't be edited, but staff can record a refund. The page says clearly that tips aren't charitable donations and aren't tax-deductible, and it's never shown on Kids or Teen profiles.
79. **(was #67)** As an adult member, I want to tip the same amount every month until I cancel (on the tip page or in Account), see the amount and next charge date before I confirm, and get a reminder before each charge, so that I can support the app regularly. A closed account is never charged again, and nothing in the browser can change a monthly tip.
80. **(was #59)** As a member, I want to see my past tips (amount, date, and whether each went through) and get Stripe's emailed receipt so that I can keep track.
81. **(was #65)** As billing staff, I want to see tips by month (amount paid, number paid, number failed) and the latest tips with a link to each payment in Stripe so that I can follow them and refund one when asked. Members still see only their own.

## 13. Affiliate program

82. **(was #15)** As an adult affiliate, I want to apply with my website and promotion channels and accept the program terms so that I get my own referral code once approved.
83. **(was #16)** As an affiliate, I want each click and sign-up from my referral link counted on the server (rate-limited, with no personal details of who signed up) so that I can see my tier and earnings.
84. **(new)** As the site owner, I want affiliates to agree to disclose that they earn a commission (FTC Endorsement Guides) and not to market to children, so that the program stays legal and trustworthy.

---

## What changed and why

### Content fixes

1. **Movie/TV leftovers rewritten for books.**
   - **#34:** "find movies and TV shows on Google Books." Google Books has no movies; it's now "matching Google Books titles."
   - **#37:** the video player's volume became the audiobook player's volume and speed.
   - **#52:** a TV show's Skip Recap/Intro, frame-preview thumbnails, and picture-in-picture became Skip Opening/Closing Credits, chapter marks, and a mini-player.
   - **#53:** "the actor I saw most" became most-read author.
   - **#48:** "who's watching" in the reading party became who's in the room.
   - **#57:** "titles my profile can watch" became titles it's allowed to see.
   - **#9:** "other viewers" became other readers.
2. **Audio description (#21, #66) reworked.** Audio description narrates on-screen *video*, which a book app doesn't have. The real needs behind it are covered by screen-reader support with alt text (story 64) and ebook read-aloud (story 65).
3. **Closed captions (#22, #61) became read-along transcripts.** Audiobooks have narration, not dialogue on video.
4. **Duplicates merged:**
   - #9 + #38 (reviews)
   - #10 + #43 (reminders)
   - #12 + #30 (promo codes)
   - #23 + #68 and #22 + #61 (Spanish)
   - #24 + #25 (deletion)
   - #42 (split into member and staff stories)
5. **List names made consistent:** *My List* became **Reading List**, matching the blueprint. The other lists are **Favorites** and **Custom Lists**.
6. **The core feature was missing.** There were no stories for actually reading an ebook or listening with the player's basic controls. Stories 36–42 add the reader, bookmarks and highlights, synced progress, playback controls, Mark as finished, and offline downloads.
7. **Missing stories added:**
   - adult sign-up and Terms acceptance
   - Kids consent and Kids restrictions
   - subscription confirmation emails
   - Google Books previews
   - Surprise Me
   - follow an author
   - cookie consent
   - data download
   - keyboard shortcuts
   - Status page
   - DMCA notices
   - affiliate disclosures
8. **Wording fixes:**
   - Browse vs. search (#5 said "browse… with a title"; it's now *search*).
   - "it's book details" → its.
   - "a books's next chapter" → the next book in a series.
   - "Google Books" used as a noun ("add a Google Books") → a Google Books title.
   - Missing punctuation in #53 ("hours read my longest streak").
   - "only pay when I'm reading a book."

### Compliance and security fixes (verify for your jurisdiction)

1. **#1 said "logs" are publicly readable.** Logs can contain IP addresses and activity, which are personal data, so only the catalog and published reviews are public now.
2. **#24/#25: deletion only removed access, and data removal needed a support ticket.** Under CCPA/CPRA (and GDPR if you serve the EU), members must be able to request deletion directly, and the request must be honored within the legal deadline. Story 72 now does both in one flow and keeps only legally required records. Story 71 adds data download (access and portability).
3. **#27's password rule conflicts with NIST SP 800-63B guidance**, which favors length and breach checks over forced character types. Story 3 updates it; confirm against the current NIST revision.
4. **#29 showed reviewers' "real account names."** That publicly exposes the account holder's real name, and children's names. It now shows the profile's display name, Kids can't post public reviews, and teens never show a full real name. Authorship still comes from the session, so reviews remain trustworthy.
5. **#40: "real U.S. maturity ratings" for books don't exist.** Books have no MPA-style rating system, and Google Books provides only a mature/not-mature flag. Story 17 adds BookWorm's own age rating, with unrated titles hidden on Kids and Teen profiles.
6. **Kids (COPPA).** Because the app is for all ages, story 11 adds verifiable parental consent and the parent's right to review, delete, or stop collection. Story 16 blocks chat, public reviews, sharing, payments, and the AI assistant (by default) on Kids profiles. #47 (public share links) and #48 (party chat with strangers) are now off for kids. Check the FTC's amended COPPA Rule (2025) compliance dates.
7. **Donations (#58, #59, #65, #67).**
   - **"Donations":** a for-profit service calling payments "donations" can imply they're charitable or tax-deductible, so they're now **tips** with a not-tax-deductible label.
   - **Coffee button:** the "coffee button on every page" put a payment prompt in front of children, so tips moved to Account → Help and are hidden from Kids and Teen profiles.
   - **Monthly tips:** they follow auto-renewal rules (clear terms, consent, a reminder, easy cancellation).
   - **Contradiction:** #58 said "nobody can change or delete" donations while #65 allowed refunds. Payment records are now immutable, but a refund can be *recorded* against them.
8. **Cancellation (#4, #21).** Online cancellation with no phone call or chat required, plus pre-payment disclosure of price and renewal terms (stories 18, 20, 21). This follows ROSCA and state auto-renewal laws.
9. **Privacy choices (#14).** Global Privacy Control signals are now honored and cookie consent is a story (69, 70), as CCPA/CPRA expects.
10. **Affiliates (#15, #16).** Limited to adults, required FTC disclosures, no marketing to children, and referral counts carry no personal details of who signed up.
11. **AI assistant (#57).** AI suggestions are labeled, and the assistant is off by default on Kids profiles.
12. **Staff roles.** #42 and #62 combined support and moderation. They're split into support staff (tickets), moderators (reports), and billing staff (tips and refunds), so each role sees only what it needs.


---

## Build status

Tracks each story against the front-end build in `front_end/bookworm-app`. **Done** means it works in the front end (book lists through the Supabase Edge Function when configured, other data in memory). **UI only** means the screen and rules exist but the part that needs a server (email, Stripe, Supabase) is not built yet. Stories not listed are planned for later phases or need the backend.

| Story | Phase | Status | Notes |
| --- | --- | --- | --- |
| 1. Private account data | 0–1 | UI only | Data is per account in memory; `schema.sql` adds RLS so each member sees only their own rows. |
| 2. 18+ date of birth, Terms accepted | 1 | Done | Under-18 sign-ups are refused with a pointer to Kids/Teen profiles; Terms checkbox required; Privacy Policy linked. Enforced in `schema.sql` by trigger too. |
| 3. Password rules | 1 | Done | 15–64 characters, no forced character mix, small breached-password list (a real build would check a breach service on the server). Two-step sign-in not built yet. |
| 4. Forgot password | 1 | UI only | Request form and "if an account uses this email" confirmation; no email is sent. |
| 5. Stay signed in | 1 | Changed | By request, all data resets on refresh. Sign out and back in works within a session. |
| 8. Demo account | 0–1 | Done | *Try the demo*, or log in with the demo email; the demo can't make payments. It resets on refresh rather than after 24 hours. |
| 10. Up to five profiles | 2 | Done | Add, edit and delete on *Who's reading?*; limited by plan (Basic 1, Standard 3, Premium 5). Deleting a profile leaves the account and other profiles alone. |
| 11. Parental consent for Kids | 2 | Done | Consent checkbox with a link to the Children's Privacy Notice is required to create a Kids profile. `parental_consents` keeps the record. |
| 12. PIN lock | 2 | Done | 4-digit PIN set or removed with the account password; 5 wrong tries lock the profile for 15 minutes; the account password unlocks it. |
| 13. Ask a grown-up | 2 | Partly | After leaving a Kids profile, managing or adding profiles needs the account password. The Account page gate comes in Phase 8. |
| 14. Daily limit | 2 | Partly | Limit (30 minutes to 4 hours) set with the account password. Enforcement in the reader and player comes in Phase 7. |
| 17. Age ratings on titles | 0 | Done | Every title is Kids, Teen or All; a profile sees titles at or below its rating (Kids sees 10 of 29). |
| 18. Choose a plan with terms first | 1 | Done | Price, what's included and auto-renewal terms shown before confirming; renewal consent required. |
| 19. Billing day, card via Stripe | 1 | UI only | Billing day 1–28 and next charge date; no card is collected in the demo. `schema.sql` stores Stripe IDs only. |
| 20. Confirmation email | 1 | UI only | Confirmation message on screen; no email is sent. |
| Brief: Home | 3 | Done | Public home shows technology books from the `books` Edge Function in a row and an infinite grid; never calls Google from the browser. |
| Brief: Genres | 3 | Done | Adventure, Technology, Horror, Sci-Fi, Fiction, Non-Fiction, each with its own URL; mapped to Google `subject:` queries in the Edge Function. |
| Brief: Load more | 3 | Done | Grids load more near the bottom (plus a button); Home rows end with *Load more*; loading, error (*Try again*), empty and end states. |
| Home rows and carousel | 3 | Done | Featured carousel with Pause; Continue reading, Trending, Top 10, New releases, Because you saved, genre rows. Kids profiles see only age-rated titles. |
| Brief: Book details page | 4 | Done | `/books/:id` works from a link or a refresh; Google data through the `books` function (title, authors, description, cover, plus publisher, published date, pages, language, categories); every reader's logs with display name and date. |
| Brief: Library (add, remove, status) | 4 | Partly | Add, remove and change status (want to read, reading, finished) on the book page, private to the profile. Kept in memory until Supabase Auth sign-in (Phase 6); `library_items` and its RLS are ready. |
| Brief: Logs | 4 | Partly | Write, edit and delete your own logs (1–5000 characters, optional 1–5 rating), only for books in your library; removing the book deletes them. Public reading from Supabase works; saving waits for Supabase Auth (Phase 6). The database enforces the rules with a composite foreign key and cascade. |
| 29. Book page | 4 | Done | Cover, synopsis, author, narrator, length, format, age rating and logs; the Google key stays in the Edge Function. |
| 31. More Like This | 4 | Done | Similar catalog titles, or the closest of the six genres for Google titles. |
| 50. Display name on logs | 4 | Done | Logs show the profile's display name, never an email; Kids profiles can't post logs. |
| 61. Accessibility menu | 0 | Partly | Text size, theme, dyslexia-friendly font, contrast, highlighted links, stop animations. Settings survive sign-out within a session. |
| 63. Accessibility Policy in footer | 0 | Done | Footer on every page; policy page is a placeholder summary. |
| 70. Cookie choices | — | Planned | Footer links to Your Privacy Choices; banner not built. |
