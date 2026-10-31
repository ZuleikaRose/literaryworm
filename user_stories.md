
# LiteraryWorm: User Stories

*A Netflix-style reading and listening app built on the Google Books catalog, for readers of all ages.*

Version 2: edited and corrected to match **LiteraryWorm_Blueprint.md**. This list is pulled from `front_end/` (the user journey and each page's `user_journey.md`). Each story is one thing the app has to *remember* or *enforce*. Story 1 isn't on any single page; it's there so the database knows who owns what.

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

10. **(was #41)** As an account holder, I want up to 12 profiles (by plan), each with its own name, avatar, and age rating (Kids, Teen, or All), so that everyone at home gets their own lists, Continue Reading, history, reminders, and recommendations. A profile's settings don't affect the others, and deleting a profile doesn't touch the account or other profiles.
11. **(new)** As a parent creating a Kids profile, I want to give verifiable parental consent and read the Children's Privacy Notice first so that my child's reading data is collected only with my permission. I want to be able to review, delete, or stop collection of that data at any time.
12. **(was #54)** As an account holder, I want to lock a profile with a four-digit PIN (set or removed with the account password) so that children stay in their own profile. Five wrong PINs lock the profile for 15 minutes.
13. **(was #54)** As a parent, I want Kids profiles to ask for the account password (*Ask a grown-up*) before Account or profile management opens so that children can't change settings.
14. **(was #60)** As a parent, I want to set a daily reading and listening limit on a profile (30 minutes to 4 hours, with the account password) so that the reader and player stop once the time is used up. I want to allow 30 more minutes with the password when I choose. Nobody reading can raise the limit or reset the time used.
15. **(was #64)** As a parent, I want to see how long a limited profile read or listened on each of the last 7 days, with the total and daily average, so that I can tell whether the limit is right.
16. **(new)** As a parent, I want Kids profiles to have no chat, no public reviews, no sharing, no payments or tips, and no AI assistant (unless I turn it on) so that my child isn't exposed to strangers or purchases.
17. **(was #40)** As a parent, I want every title to carry an age rating (Kids, Teen, or All) so that each profile shows only titles within its setting. For Google Books titles, LiteraryWorm uses Google's mature/not-mature flag plus its own review, and unrated titles stay hidden on Kids and Teen profiles.

## 3. Membership and billing

18. **(was #2)** As an account holder, I want to choose a plan (Basic, Standard, or Premium) and see its price, what's included (for example, the number of profiles, audiobook hours, and offline downloads), and the auto-renewal terms before I pay, so that I know what I'm agreeing to.
19. **(was #3)** As an account holder, I want to save a payment method through Stripe and choose a billing day so that I'm charged on a date that suits me. LiteraryWorm stores only the card brand, last four digits, and expiry, never the card number.
20. **(new)** As an account holder, I want an email confirming my subscription, its price, its renewal date, and how to cancel, plus receipts for each charge, so that I have a record.
21. **(was #4)** As an account holder, I want to pause, cancel, or restart my membership online in a few clicks, with no phone call or chat required, so that I only pay when I'm reading.
22. **(was #12, #30)** As an account holder, I want to apply a promo code and have it checked on the server against real offers and my plan, so that only valid discounts apply. I also want to see the price after the promo ends.

## 4. Discovering books

23. **(was #5)** As a member, I want to search books by title, author, narrator, ISBN, or keyword so that I can find a specific book.
24. **(was #6)** As a member, I want to filter by genre, format (ebook, audiobook), length, language, rating, age rating, and release date, and sort by relevance, popularity, newest, or rating, so that I can find something that interests me.
25. **(was #49)** As a member, I want search to find titles even when I misspell them (*Did you mean…?*) so that a typo doesn't hide what I'm looking for.
26. **(was #50)** As a member, I want my last ten searches per profile to show in an empty search box until I clear them so that I can repeat a search quickly. Nothing is saved while history is paused.
27. **(was #33)** As a member, I want Home rows of trending and popular books from Google Books, credited to Google Books, so that I can discover titles beyond LiteraryWorm's catalog.
28. **(was #34)** As a member, I want my searches to include matching Google Books titles below LiteraryWorm's own results, with the same filters, so that I can look up any book.
29. **(was #35)** As a member, I want to open a book's page to see its cover, synopsis, author, narrator, length, format, age rating, and reviews and decide whether it's for me. As the site owner, I want the Google Books API key kept on the server so that no one can copy it from the browser.
30. **(new)** As a member, I want a free preview of a Google Books title (using Google's Embedded Viewer, loaded only when I ask) and links to buy it, so that I can try books LiteraryWorm doesn't carry in full.
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
45. **(was #36)** As a member, I want to add Google Books titles to my Reading List or Favorites so that they appear next to LiteraryWorm's own titles. Their details come from Google Books on the server, not from what my browser sends.
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
72. **(was #24, #25)** As an account holder, I want to delete my account from the danger zone (it cancels my subscription first, after I confirm, and asks for my password) so that I can leave in one place. Deleting removes my access and deletes my personal data within the legal deadline, except records the law requires LiteraryWorm to keep (such as payment records). I want an email confirming the request, with no separate support ticket needed.

## 11. Help and support

73. **(was #13)** As a member, I want to send feedback or report a problem and get a ticket number so that I can follow up. I'm asked each time before device details are attached.
74. **(was #42)** As a member, I want to read support's replies on my tickets and answer them so that problems get solved in one conversation.
75. **(was #42)** As support staff, I want to see every member's tickets by status, reply, and change a ticket's status so that problems get solved. Only staff can see other members' tickets.
76. **(new)** As a member, I want a Status page and a Home banner during outages so that I know when a problem is on LiteraryWorm's side.
77. **(new)** As a rights holder, I want to send a copyright (DMCA) notice to LiteraryWorm's designated agent so that infringing content is reviewed and removed.

## 12. Support LiteraryWorm (tips): optional

*Recommendation: for a for-profit subscription service, consider removing this section (see What changed and why, item 7).*

78. **(was #58)** As an adult member, I want to leave a one-time tip by card ($1 to $10,000, from Account → Help) so that I can support the app. Each tip is recorded with its amount, date, and whether it went through. My card number never reaches LiteraryWorm, and only I can read my tips. Payment records can't be edited, but staff can record a refund. The page says clearly that tips aren't charitable donations and aren't tax-deductible, and it's never shown on Kids or Teen profiles.
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
5. **#40: "real U.S. maturity ratings" for books don't exist.** Books have no MPA-style rating system, and Google Books provides only a mature/not-mature flag. Story 17 adds LiteraryWorm's own age rating, with unrated titles hidden on Kids and Teen profiles.
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

Tracks each story against the front-end build in `front_end/literaryworm_app`. The live site is [www.literaryworm.com](https://www.literaryworm.com). **Done** means it works in the front end (book lists through the Supabase Edge Function when configured, other data in memory). **UI only** means the screen and rules exist but the part that needs a server (email, Stripe, Supabase) is not built yet. Stories not listed are planned for later phases or need the backend.

| Story | Phase | Status | Notes |
| --- | --- | --- | --- |
| 1. Private account data | 6 | Done | Real accounts in Supabase Auth; RLS shows each member only their own account details, plan and library. Logs are public by design. |
| 2. 18+ date of birth, Terms accepted | 1 | Done | Under-18 sign-ups are refused with a pointer to Kids/Teen profiles; Terms checkbox required; Privacy Policy linked. Enforced in `schema.sql` by trigger too. |
| 3. Password rules | 1 | Done | 15–64 characters, no forced character mix, small breached-password list (a real build would check a breach service on the server). The shorter 8-character minimum with two-step sign-in on isn't offered: Supabase Auth sets one minimum for the whole project. |
| 4. Forgot password | 6 | Done | Supabase sends a reset link to `/reset-password` through Mailgun, in LiteraryWorm's own email; the page never says whether an email has an account. |
| 5. Stay signed in | 6 | Done | The Supabase session survives a refresh (the only thing kept in browser storage); everything else still resets. |
| 6. Two-step sign-in | — | Done | Account → Sign-in turns it on with a QR code or setup key and a code to confirm; turning it off needs a current code. Logging in then asks for the code (also after a refresh). Until it's given, the database (a restrictive policy on every member table, migration 2100) and the Edge Functions show and change nothing of the member's. No recovery codes (Supabase has none): a lost phone goes to support. |
| 8. Demo account | 0–1 | Done | *Try the demo*, or log in with the demo email; the demo can't make payments. It resets on refresh rather than after 24 hours. |
| 10. Up to 12 profiles | 2, 8 | Done | Add, edit and delete on *Who's reading?*; limited by plan (Basic 1, Standard 5, Premium 12, enforced by the database; Standard was 3 and Premium 5 until migration 5800). Saved in `reader_profiles` for real accounts. Deleting a profile leaves the account and other profiles alone. |
| 11. Parental consent for Kids | 2, 8 | Done | Consent checkbox with a link to the Children's Privacy Notice, and the account password, are required to create a Kids profile or move one to Kids. `parental_consents` keeps the record; moving off Kids marks it withdrawn. |
| 12. PIN lock | 2, 8 | Done | 4-digit PIN set or removed with the account password; checked on the server (bcrypt hash) for real accounts; 5 wrong tries lock the profile for 15 minutes; the account password unlocks it. |
| 13. Ask a grown-up | 2, 8 | Done | On or just after a Kids profile, Account and managing or adding profiles need the account password. |
| 21. Pause, cancel or restart online | 8 | Done | Account → Plan and billing: pause and resume, cancel and keep the membership (with at least 48 hours' notice it runs to the next billing date with no more charges; with less, that charge still goes through and it ends a month later, as the Terms, the Return Policy, the checkout's renewal terms and the billing section say; no refunds; `subscriptions.cancel_at`, migration 3500), through the `manage-account` function, which changes the Stripe subscription first (pause stops Stripe collecting payment). Before Stripe billing no card was taken, so there's nothing to refund. |
| 72. Delete account | 8 | Done | Danger zone with the password and a confirmation; the plan is cancelled, then the account and everything it owns are deleted at once, and the address gets an email confirming it (what went, that nothing more will be charged, who to write to if it wasn't them). An email that doesn't send never undoes the deletion. |
| Download my data | 8 | Done | Account → Privacy: a JSON file of the account, profiles, library, progress, bookmarks and logs (no password or PINs). |
| 14. Daily limit | 2, 7 | Done | Limit (30 minutes to 4 hours) set with the account password; the reader and player stop when it's used up, and the account password allows 30 more minutes. Time used is kept in memory, so a refresh resets it. |
| 17. Age ratings on titles | 0 | Done | Every title is Kids, Teen or All; a profile sees titles at or below its rating (Kids sees 10 of 29). |
| 18. Choose a plan with terms first | 1 | Done | Price, what's included and auto-renewal terms shown before confirming; renewal consent required. |
| 19. Billing day, card via Stripe | 1, after 22 | Done | Billing day 1–28 chosen before paying, and changeable in Account (the days until the new date are free). The card is entered on Stripe's hosted Checkout and changed through Stripe's Customer Portal; LiteraryWorm never sees it and keeps only Stripe's ids (`stripe_customers`, server-only). |
| 22. Promo codes | — | Done | Stripe promotion codes: entered on Stripe Checkout when joining, or in Account → Plan and billing (*Add a promo code*), where the `manage-account` function looks the code up in Stripe and applies it to the membership; Stripe checks expiry, limits and first-time-only rules. Account shows the code, how long it lasts (next charge, until a date, or for good) and the plan's price once it ends (*Then $14.99 a month from January 5, 2027*). |
| Billing history and receipts | — | Done | Account → Plan and billing lists the last 24 charges from Stripe (date, amount, any promo code saving, Paid / Due / Payment failed) with a link to Stripe's receipt. Nothing is copied into our database. |
| 20. Confirmation email | 1 | Done | New addresses get a confirmation link from Mailgun, in LiteraryWorm's own email; *Check your email* (and log-in, if the address isn't confirmed yet) can send it again, once a minute. A payment confirmation is Stripe's receipt. |
| Brief: Home | 3 | Done | Public home shows technology books from the `books` Edge Function in a row and an infinite grid; never calls Google from the browser. |
| Brief: Genres | 3 | Done | Adventure, Technology, Horror, Sci-Fi, Fiction, Non-Fiction, each with its own URL; mapped to Google `subject:` queries in the Edge Function, with the genre as plain words when Google returns nothing for `subject:`. |
| Brief: Load more | 3 | Done | Grids load more near the bottom (plus a button); Home rows end with *Load more*; loading, error (*Try again*), empty and end states. |
| Home rows and carousel | 3 | Done | Featured carousel with Pause; Continue reading, Trending, Top 10, New releases, Because you saved, genre rows. Kids profiles see only age-rated titles. |
| Brief: Book details page | 4 | Done | `/books/:id` works from a link or a refresh; Google data through the `books` function (title, authors, description, cover, plus publisher, published date, pages, language, categories); every reader's logs with display name and date. |
| Brief: Library (add, remove, status) | 4, 6 | Done | Add, remove and change status (want to read, reading, finished) on the book page and the Library page; saved to `library_items`, private to the account (owner-only RLS). |
| Brief: Logs | 4, 6 | Done | Write, edit and delete your own logs (1–5000 characters, optional 1–5 rating) in Supabase, only for books in your library (composite foreign key); removing the book deletes them (cascade). Everyone can read them; only the writer can change them. |
| Brief: Sign up, log in, log out | 6 | Done | Supabase Auth email and password; every account has a public display name, and logs show it, never the email. |
| Library page (Reading List, Favorites, Custom Lists) | 6, 10 | Done | Status filter with counts, Favorites, custom lists (create, rename, delete, reorder, add and remove books). Saved per profile in Supabase for members. |
| 32. Rate in one tap | 4, 10 | Done | Not for me / I like this / I love this on the book page, saved per profile (`book_ratings`); Not for me keeps a title out of suggestions. |
| 44, 45. Favorites, including Google titles | 4, 10 | Done | Favorite on any book page, saved per profile (`favorites`); the Favorites view shows LiteraryWorm and Google Books titles, with Google's details fetched on the server. |
| 46. Custom Lists | 6, 10 | Done | Named lists with descriptions, per profile (`custom_lists`, `custom_list_items`); up to 50 lists of 200 books. |
| 47. Share a list by link | 10 | Done | *Share* makes a private link; the public page shows only the name, description, the profile's name and the titles; *Stop sharing* turns it off. Not on Kids profiles. |
| 48. Remind me for an unreleased book | — | Partly | A Google Books title with a release date still to come shows *Not out yet: due …* and *Remind me* (when Google gives the exact day). Reminders are saved per profile (`release_reminders`, migration 2300); on the day, Home shows them under *Out now* until dismissed, and My Library → Reminders lists them all. On the day the bell counts it as new and members get an email (book-out emails). No next-in-series reminders (the catalog has no unreleased titles). |
| 56. Notification bell | — | Partly | A bell in the header (members and the demo) counts what's new for the profile: books from its reminders that came out since it last opened the bell, and unread club posts up to the reader's chapter (clubs with alerts on; not on Kids profiles). The panel lists both and links to the book or club. Opening it marks the releases seen on every device (`reader_profiles.notifications_seen_at`, set by `mark_notifications_seen()`, migration 3300); club posts stop counting when the club is opened. New books from followed authors are counted and listed too (story 35); there are no support replies to count yet. |
| 29. Book page | 4 | Done | Cover, synopsis, author, narrator, length, format, age rating and logs; the Google key stays in the Edge Function. |
| Google Books preview (new request) | — | Done | Google Books titles that Google lets other sites show get a *Preview* section (or *Read it on Google Books* when every page is free): Google's embedded viewer opens on the page only when the reader asks, marked essential so the consent banner doesn't hold it back; the Cookie Policy says Google may set its own cookies then. |
| Book summaries (new request) | 11 | Done | *Short* and *Detailed (spoilers)* summaries on every book page (catalog and Google titles) for members and the demo, written by Claude through the `summaries` function the first time they're asked for and kept in `book_summaries`; labelled as written by AI. |
| Summary from My Library (new request) | 12 | Done | A *Summary* button on each My Library row opens the short summary in a dialog, with *Detailed (spoilers)* one tap away, without leaving the library. |
| Real text in the reader (new request) | 12 | Done | The public-domain titles (871 since the 50, 250, 250 and 300 added in October) open in the reader with their full Project Gutenberg text, about 1,600 characters a page; the other titles keep sample pages, and the reader says which. |
| Pick up on another device (new request) | 12 | Done | Leaving a tab saves your place at once; coming back reloads it, and an open reader offers *Go there* when another device got further. |
| Follow along while listening (new request) | 12 | Done | With a device voice reading a public-domain title, the Read-along shows the book's own text and marks the sentence being spoken; choosing one jumps there. |
| Reading goals and streaks (new request) | 12 | Done | My Library → Goals: a yearly book goal per profile with progress and pace, a streak (a minute a day) and six months of time, days and books. Members' time is saved in Supabase. |
| Household reading challenges (new request) | — | Done | My Library → Goals → *Household challenges*: any profile starts one (books finished, hours reading and listening, or days with reading; this month, next month or the next 30 days; a suggested name such as *5 books in November*), and joins it straight away; the others join or leave, Kids profiles included. Each challenge lists everyone who joined with a progress bar, furthest along first, worked out from their reading days; finished ones fold away. The profile that started it can delete it. Private to the account (`household_challenges`, `challenge_participants`, migrations 3700–3703; up to 20 an account); the demo has a sample challenge in memory. |
| Import from Goodreads or StoryGraph (new request) | — | Done | My Library → *Import from Goodreads or StoryGraph*: the site's CSV export is read on the device (up to 1,000 books, 5 MB). Each book is matched to a LiteraryWorm title, or looked up on Google Books by its title through the `books` function (about one a second, under its limit) and accepted only when the author's surname agrees; the reader reviews the matches (books already in the library are left out), then they're added with the shelf as the status (read → Finished, currently reading → Reading, to-read → Want to read; StoryGraph's did-not-finish is left out) and the stars as a rating (5 → Love it, 3–4 → Like it, 1–2 → Not for me). Imported Finished books don't count towards this year's goal or stats. Not offered to Kids profiles. |
| Book clubs (new request) | 12 | Done | Start a club around a LiteraryWorm title with a finish date, share its code, join with one; pace by chapter, members, and a discussion that hides chapters you haven't reached. Members only for real clubs (the demo has a sample); not on Kids profiles. |
| Ask the book (new request) | 12 | Done | In the reader for public-domain titles: ask a question and Claude answers from the text up to your chapter, without spoilers. Labelled as written by AI. |
| Who's who (new request) | — | Done | In the reader of a public-domain title, *Who's who* lists the characters met so far, up to the open chapter, each described only from the text so far, with the chapter they were first met; a search box once there are eight or more. Written by Claude from the book's text up to that chapter (the `characters` function), checked so nobody first met later is shown, labelled as written by AI, and kept per book and chapter (`book_characters`, migration 3800) so later readers get the same list. Not on Kids profiles. |
| What's new (new request) | — | Done | `/whats-new`, linked first in the footer and public: every new feature, fix and update, grouped by release (month and version), newest first, with major changes marked and leading; filters for Everything, Major, Minor, New features, Updates and Fixes. Editors, developers and admins add, edit and delete entries on the page (`changelog_entries`, RLS by role). A monthly email of last month's major changes, linking to the page, goes on the 1st to members who turned it on in Account → Preferences (off by default); every email has a one-click unsubscribe that works without signing in (a signed link, `List-Unsubscribe-Post`). Migrations 3900–3903. |
| More genres (new request) | — | Done | Thirteen genres beyond the brief's six, in Home's *Keep discovering* links, Search's *Or browse a genre* and its Genre filter, each with its own URL. Home keeps one row each for the brief's six. |
| Plan limits (follow-up) | — | Done | Listening hours a month (Basic 5, Standard 30, Premium unlimited) for the whole household on every device: the player pauses at the limit until the 1st and says why. Offline devices (1, 10 or 24; 1, 3 or 5 before migration 5800) checked by the database (`claim_offline_device()`); a full plan lists the devices to free. Account shows this month's use. Migrations 4100–4103. |
| Favourite genres from the full list (follow-up) | — | Done | All nineteen genres as favourites, old favourites mapped onto them; up to two favourites beyond the six get a Home row; sample titles tagged with the new genres. |
| What's new links (follow-up) | — | Done | What's new is linked from the public home page, members' Home and Plans (a line naming the newest major change, `components/WhatsNewLink.tsx`) and first in Account → Help, as well as the footer. |
| Listening heads-up (follow-up) | — | Done | Player shows the month's listening left on Basic and Standard; the bell alerts once the household passes 80% (not on Kids profiles). Fixed the *New* label stretching across the notifications panel. |
| Member lookup (follow-up) | — | Done | `/support` for customer service and admins: one member's plan, billing state, profiles, listening and devices by email, read only, recorded in `support_lookups`, 60 an hour (migrations 4200–4204). Privacy Policy updated. |
| Accessibility pass (follow-up) | — | Done | Lighthouse accessibility 100 on the home page, Plans, members' Home, Account (*This month*), the book page (*Read offline*), the player (with the listening line and when it's used up), the bell with the listening alert, and `/support`. Real-device checklist in `docs/qa/plan-limits-device-check.md`. |
| Move up a plan in one tap (follow-up) | — | Done | The used-up message, the bell alert, Account's *This month* and the full-places panel each link to the next plan's checkout (`/plans?plan=`). The home page's layout shift was measured on the production build at 0.022 (good); the 0.42 earlier came from the development server. |
| What's new: Minor filter (follow-up) | — | Done | *Minor* beside *Major* on `/whats-new`: every change not marked major (`filterEntries(…, "minor")`). |
| Annual plans (follow-up) | — | Done | Pay yearly at ten times the monthly price ($99.90, $149.90, $249.90). Yearly starts the day it's paid for; monthly members switch to yearly in place (the unused part of the month comes off); a yearly plan moves up at once (the difference for the rest of the year) or down at renewal, and isn't paused or moved to monthly mid-year. The bell reminds 30 days before renewal. Migrations 4400–4402. |
| Goals and streaks in the bell (follow-up) | — | Done | *Your reading* in the bell: *Your 6-day streak ends tonight* (streaks of 3+ days, from 6 pm until the profile reads), *1 book from your 2026 goal* (within 2 books), *You reached your 2026 goal* (for a week). Worked out in the browser from the profile's days and goals; every profile, Kids included. |
| Search by author (follow-up) | — | Done | A *Title / Author* choice on Search; an author search finds books by any author whose name has every word typed (LiteraryWorm titles and Google Books through the `books` function's author mode), with the Show and Length filters. Title search, the brief's, stays the default. |
| Footer in categories (follow-up) | — | Done | The footer's links sit in four labelled columns (two on phones): Explore (What's new first, Plans, Gifts, Search), Help (Help, Status, Accessibility), Your privacy (the privacy pages, Consent Preferences and Termly's two request links) and Legal (Terms, EULA, Acceptable Use, Return Policy, Copyright, Disclaimer). |
| Kids reading report (follow-up) | — | Done | Account → Family shows each Kids profile's last 7 days: time (and how much was listening), days read and books finished. *Email me this every week* (off by default) sends last week's on Monday mornings through the `kids-report` function, with a one-click unsubscribe. Privacy Policy updated. Migrations 4600–4602. |
| Book club calendar (follow-up) | — | Done | The club's owner schedules meetings (name, date, time, length, an optional note) and can cancel them; every member sees them on the club page with *Add to calendar* (a calendar file made in the browser) and gets an email reminder the day before, in the time zone it was set in (off in Preferences or in one click). Migrations 4700–4704. |
| Club meeting RSVPs (follow-up) | — | Done | Every member answers each meeting with Going, Maybe or Can't make it; the club page shows how many gave each answer and who's going. A meeting starting in the next day shows in the notification bell (clubs with alerts on), and members who can't make it get neither the bell alert nor the reminder email. Migrations 4800–4803. |
| Yearly to monthly at renewal (follow-up) | — | Done | A yearly member chooses monthly billing on Plans; nothing is charged or refunded, the year carries on, and monthly billing starts on the renewal date (a Stripe subscription schedule). Account shows it with *Keep yearly billing*; the bell's 30-day reminder says monthly billing starts instead of the renewal; cancelling drops it. The Terms say so. Migrations 4900–4903. |
| Weekly goals for Kids profiles (follow-up) | — | Done | A grown-up gives a Kids profile a weekly reading goal (1 to 5 hours) in its profile settings, with the account password. The child sees *1 h 15 min of 2 h this week* in Goals; Account → Family shows *Weekly goal 2 h: 45 min to go* (or reached); the Monday Kids report says whether last week's goal was reached. Migrations 5000–5002. |
| Follow authors from search (follow-up) | — | Done | An author search lists up to six matching authors above the books (from LiteraryWorm's titles and the Google Books results loaded so far; spellings that differ only in dots or spaces count as one), each with a link to their page, how many of the books below are theirs and *Follow*. Migration 5100. |
| Gift a year at the yearly price (follow-up) | — | Done | Buying a year's gift costs the plan's yearly price (two months free), shown on Gifts as *A year: 2 months free* with the saving; 1, 3 and 6 months stay at the monthly price each. Migration 5200. |
| Change a club meeting (follow-up) | — | Done | The club's owner changes a meeting's time, length, name or note with *Change* instead of cancelling it and adding another. When an upcoming meeting moves or is cancelled, the other members get an email with the old and new times (within about 10 minutes; off with the meeting reminders). Privacy Policy updated. Migrations 5600–5603. |
| Weekly goals for everyone (follow-up) | — | Done | Grown-up and teen profiles set their own weekly reading goal (1 to 5 hours) in Goals, see *1 h 15 min of 3 h this week*, and change or remove it there. Kids profiles' goals are still set by a grown-up. Migrations 5300, 5303. |
| Followers and a Following list (follow-up) | — | Done | Author and narrator pages show how many readers follow them (*12 readers follow them*; a count, never who). My Library has a *Following* tab listing the authors and narrators the profile follows, with links and *Following* to unfollow (the row stays until the page is left, so a slip can be undone). Migrations 5400–5403. |
| Gift start day (follow-up) | — | Done | Buying a gift, *When it starts* offers *Straight away* or *On a later day* (up to a year ahead, for a birthday). The code comes straight away and can be redeemed from that day; *Your gifts* shows *starts March 14, 2027* until then. Return Policy updated. Migrations 5500, 5503. |
| Yearly saving in the bell (follow-up) | — | Done | A monthly member 11 months in sees *Switch to yearly and save $29.98* in the bell for 30 days (plan, yearly and monthly price), linking to Plans with yearly billing chosen. Migration 5700. |
| Bigger Standard and Premium plans (follow-up) | — | Done | Standard now has 5 profiles and Read offline on 10 devices (was 3 and 3), Premium 12 profiles and 24 devices (was 5 and 5), at the same prices; the plan cards, FAQs, Gifts and Terms say so. Migrations 5800–5802. |
| Moving to a smaller plan (follow-up) | — | Done | Plans says how many profiles to remove and offline devices to free before a move to a plan the household doesn't fit, with links to do it; `checkout` refuses the change with the same words. |
| Calendar file in meeting change emails (follow-up) | — | Done | Moved and cancelled meeting emails carry the meeting as a calendar file (same event as *Add to calendar*, a later version), so calendars move or cancel it. |
| Search by ISBN (new request) | — | Done | A third *Search by* choice, *ISBN*: a 10- or 13-digit ISBN (hyphens and spaces allowed, check digit checked in the browser and in the `books` function's new `isbn` mode) finds that edition on Google Books. No filters; not for Kids profiles, since the catalog keeps no ISBNs. The Privacy Policy says an ISBN is what goes to Google Books. |
| Follower counts in author search (follow-up) | — | Done | *Authors* cards in an author search show *12 followers* (one `follower_counts()` call for the list; a count, never who). |
| Gift start reminder (follow-up) | — | Done | The buyer of a gift for a later day is emailed three days before it starts (the `gift-reminders` function, daily), without the code. |
| Kids report in groups (follow-up) | — | Done | Account → Family and the Monday email group Kids profiles: still working on their goal, no reading yet, reading without a goal, goal reached. |
| Set profiles aside (follow-up) | — | Done | A grown-up sets a profile aside instead of deleting it to fit a smaller plan (account password, `manage-profile`); it keeps everything, doesn't count, and comes back with *Bring back* or by itself when the plan has room. A smaller plan arriving sets the newest aside. |
| Plan room at renewal (follow-up) | — | Done | A yearly membership moving to a smaller monthly plan at renewal has that plan's room for profiles and offline devices straight away (`private.profile_room()`, `claim_offline_device()`). |
| Email a gift (follow-up) | — | Done | The buyer can have the code emailed to the person it's for, with a message, when it can be redeemed (`gift-reminders`, hourly); the address and message are deleted once sent. |
| Club calendar feed (follow-up) | — | Done | Each member gets a signed subscribe link for a club's meetings (`club-calendar` function); it stops working if they leave. |
| Most-followed authors (follow-up) | — | Done | Home lists the authors most profiles follow (`most_followed()`, counts only, two or more followers). |
| Club posts by email (follow-up) | — | Done | *Email me new book club posts* in Account → Preferences (off by default): one email a day (the `club-digest` function, 17:00 UTC) listing each club's new posts by chapter, how many and who wrote them, only about chapters the member has reached, never what was written. One-click unsubscribe (`club-posts`). Migration 6200. |
| One device per browser (follow-up) | — | Done | *Listen on another device* no longer lists a refreshed tab or a second tab as a new device: the browser keeps its device id (`literaryworm-device`) until sign-out. Cookie Policy updated (migration 6201). |
| 50 more classics (new request) | — | Done | Fifty more public-domain titles, from *Emma* to *The Scarlet Pimpernel*, each with its full Project Gutenberg text and a LibriVox recording (one reader each but *Rebecca of Sunnybrook Farm*), lined up chapter by chapter: 71 in all. Each has a synopsis, genres, an age rating and a cover in the catalog's style. |
| 250 more classics (new request) | — | Done | 250 more public-domain titles (321 in all): more Austen, Dickens, Eliot, Hardy and Trollope, Dumas, Dostoyevsky, Wharton, Woolf and Forster, ten more Oz books, Anne, Tarzan and John Carter, Wodehouse, fairy-tale collections and more. Each has its full text (in the `book-texts` bucket) and a LibriVox recording, lined up chapter by chapter. |
| A third 250 classics (new request) | — | Done | 250 more public-domain titles (571 in all): Trollope's Barsetshire and Palliser novels, more Scott, Hardy, Collins, Dumas and James, Hemingway, Hammett, Cather, Wharton, Kipling's Kim, Tom Swift, the Bobbsey Twins, more Tarzan and Wodehouse, Burgess animal stories and more, each with its full text and a LibriVox recording. |
| New Standard and Premium prices (new request) | — | Done | Standard $14.99 a month ($149.90 a year), Premium $24.99 ($249.90); Basic followed at $9.99 (next row). Plans, Gifts, checkout, the bell's yearly saving and the dashboard use them; running memberships keep their price. Stripe: new prices took over the lookup keys, old ones archived. Migration 6400. |
| New Basic price (new request) | — | Done | Basic $9.99 a month ($99.90 a year): Plans, Gifts, checkout, the bell's yearly saving ($19.98) and the dashboard. Stripe: new prices took over the Basic lookup keys, old ones archived (no active subscription on them). Migration 6402. |
| 300 more classics (new request) | — | Done | 300 more public-domain titles (871 in all): *Ulysses*, *The Divine Comedy*, *Paradise Lost*, *Beowulf*, *Leaves of Grass*, *Pinocchio*, *The Blue Fairy Book*, Scott, Collins, Grant's memoirs, Henty, Altsheler, Alger, Burgess, Thorndyke, Lupin and more, each with its full text and a LibriVox recording. Ten whose Gutenberg edition wasn't the recorded book were swapped for others. |
| Plans and prices in search results (new request) | — | Done | The description Google shows names Basic $9.99, Standard $14.99 and Premium $24.99 a month; structured data lists each plan's monthly and yearly price; Plans has its own description; `sitemap.xml` lists the public pages. Built from `lib/seo.ts`, checked by `seo.test.ts`. |
| Read and listen offline (new request) | 12 | Done | *Read offline* on public-domain book pages saves the text, and the audio if chosen (size shown), on the device; the app opens and plays them without a connection. Signing in still needs one. |
| More public-domain titles (new request) | 12 | Done | A Christmas Carol, The Call of the Wild, The Picture of Dorian Gray and The Wonderful Wizard of Oz, with LibriVox narration and full text. |
| 31. More Like This | 4 | Done | Similar catalog titles, or the closest of the six genres for Google titles. |
| 50. Display name on logs | 4 | Done | Logs show the profile's display name, never an email; Kids profiles can't post logs. |
| Brief: Search by title | 5 | Done | Public `/search`; title only (operators refused with a plain message); LiteraryWorm titles then Google results with infinite scroll and Load more. Google is asked with `intitle:`; if it returns nothing (a Google fault seen in October 2026), the function asks again with the plain words, which can match outside the title. |
| 23. Search | 5 | Changed | Title only, as the brief requires (not author, narrator, ISBN or keyword). |
| 24. Filters and sorting | 5 | Partly | Source, genre (the brief's six and thirteen more), language (English, Spanish, French, German, Italian, Portuguese; Google's own language filter), length (under 200, 200 to 400, over 400 pages), best match or newest. Google can't filter by length, so each page of its results is checked against the page count it lists, and editions without one are left out. Format and release-date filters, and popularity and rating sorts, need data Google search doesn't offer reliably. |
| 25. Did you mean | 5 | Done | Typos corrected word by word against LiteraryWorm titles the profile may see. |
| 26. Recent searches | 5 | Done | Last ten per profile, newest first, remove one or clear all. In memory, so a refresh clears them. |
| 28. Google titles below LiteraryWorm's | 5 | Done | *From LiteraryWorm* first, then *From Google Books*, with the same genre and sort. |
| 34. Surprise Me | 5 | Done | On Search and on Home; picks only titles the profile may see. |
| 35. Follow an author or narrator | — | Done | Author and narrator names on a book page open their page (`/authors/:name`, `/narrators/:name`): their LiteraryWorm titles and, for authors, their Google Books titles, with Follow. Follows are saved per profile (`follows`, migration 2200), and Home shows *New from people you follow*. New Google Books titles from followed authors (out in the last 30 days) are found by the `author-news` function (daily, each author about once a week; migration 3400), shown in the bell and emailed on Mondays unless *Email me new books from authors I follow* is off in Account → Preferences. Not for Kids profiles; narrators aren't checked, since Google Books doesn't list them. |
| 36. Reader display | 7 | Done | Light, sepia and dark themes; Literata, DM Sans or Lexend; six text sizes; line spacing; margins. Kept per profile until refresh. The text is placeholder prose until real book files are licensed. |
| 37. Bookmarks, highlights, notes, dictionary | 7, 9 | Done | Bookmarks in the reader and player; highlights in four colours with optional notes, and a *Notes and highlights* list; all saved to Supabase for real accounts. Dictionary through the `dictionary` Edge Function (Free Dictionary API, Wiktionary data). |
| 38. Progress and Continue Reading | 7 | Done | Saved to `reading_progress` (one position per book, shared by the reader and player) as you read and listen; Continue reading reopens the last format at that place, most recent first. |
| 39. Player remembers speed | 7, 13 | Done | Speed, volume, mute, skip lengths and intro and outro skipping saved per profile to Supabase (`reader_profiles`), so they follow the member to every device. Following a club's listen-along host changes speed for that session only. |
| Narrator voices (new request) | 11 | Done | A *Voice* list in the player: *Original narrator* (LibriVox) by default where there is one, and the device's British, American and Australian English voices; a British woman's voice is the default otherwise. Kept per profile for the session. How many voices there are depends on the device. |
| 40. Player controls | 7, 9, 13 | Done | Skip back and forward (5–60 seconds, chosen per profile), previous and next chapter, beginning and end of the book, Skip intro and Skip outro (by hand or every chapter), Go to (table of contents, a word index of the text, references and bookmarks, a time), volume and mute, chapter marks, sleep timer. The mini-player keeps playing while browsing, shows the title and current chapter and has the same controls (the rest in *More*). The 21 public-domain titles play real narration (LibriVox recordings, real chapters); others are read by a device voice from sample text, or run silently. |
| Listen on another device (new request) | 13 | Done | Members send the book they're listening to, at its place, to another open device on the account (`listening_devices`, `playback_handoffs`, Supabase Realtime); that device offers *Listen here*. The demo explains it needs a member account. |
| Lock-screen and headphone controls (new request) | 14 | Done | The open audiobook shows on the lock screen and in the system's media controls with its cover, title and chapter; play, pause, skip, seek and chapter buttons work from headphones, watches and cars. |
| Install as an app (new request) | 15 | Done | Web app manifest and icons; *Install the app* in Account → Preferences, or Add to Home Screen on Safari. Opens in its own window and offline. |
| Share a quote (new request) | 16 | Done | *Share as a picture* turns a highlight into a card (book colours, light or dark) to share, download or copy as text. Nothing is uploaded. |
| Reading stats and Year in Review (new request) | 17 | Done | My Library → Stats: time read and listened, books finished against the goal, streaks, month by month, top genres and authors, the books finished (`reading_days.listening_minutes`, `finished_books`). *Share as a picture* turns the year into a card (1080 × 1350, dark or light): the profile's name and year, books finished against the goal, time, days with reading and the longest streak, the five latest covers, and the top genre and author; Share, Download or Copy as text. Drawn in the browser; nothing is uploaded. |
| Smarter recommendations (new request) | 18 | Done | *Picked for you* and *Because you finished / loved…* rows on Home from the profile's finished books, ratings and favourites; Kids profiles stay in their catalog. |
| Club notifications (new request) | 19 | Done | New posts arrive live, are counted on club cards and alert members (in the app, or as a system notification in the background); never for chapters not yet reached; per-club setting. No email yet. |
| Listen along in book clubs (new request) | 20 | Done | One member leads; others join and hear the same place as they play, pause, skip and change speed (`club_listening`, Realtime). |
| Bring your own books (new request) | 21 | Done | Upload an EPUB (no DRM); its text opens in the reader with progress, bookmarks and highlights (`uploaded_books`, private `user-books` bucket). Not on Kids profiles; the demo keeps uploads in the tab. |
| Staff roles (new request) | 22 | Done | Admins give and remove roles (Admin, Editor, Developer, Billing, Customer service, Blog) by email in Account → Team access; emails without an account are invited and get the role at sign-up; the last admin can't be removed. Billing staff (and admins) have the dashboard; Developer, Customer service and Blog have no tools yet. |
| Staff dashboard (new request) | — | Done | `/dashboard`, for billing staff and admins: accounts and new sign-ups (12 weeks), paid memberships by plan and status, monthly revenue at list price, reading and listening in the last 30 days, clubs, and Stripe events to review. Totals only, from `staff_dashboard()` (migration 2600), which checks the role and the two-step code. |
| Gift memberships (new request) | — | Done | `/gifts`: buy 1, 3, 6 or 12 months of a plan once on Stripe Checkout and get a code; *Your gifts* lists codes and whether they're redeemed. *Redeem a gift* in Account, Plans and Gifts: free months on a membership of the same plan, or a new membership with no card that ends with the gift unless a card is added. Codes don't expire and work once (`gift_codes`, `subscriptions.gift_until`, migrations 2700–2800). |
| Book-out emails (new request) | 48 | Done | When a book a profile set Remind me on comes out, the account holder also gets an email that day (one per account, listing every book and, in a household, which profile it's for), with a link to each book. *Email me when a book I'm waiting for comes out* in Account → Preferences turns it off. Sent through Mailgun with no open or click tracking (`release-emails`, migrations 2900–3000). |
| Club invites by email (new request) | — | Done | On a club's page, a member types someone's email address under *Invite by email*; they get an email from LiteraryWorm with the club, its book and finish date, and a *Join the club* link (`/clubs/join/<code>`) that joins after they sign in or sign up. Up to 10 invitations a day, one per address per club a week; the address isn't kept, only a fingerprint for 30 days (`club-invite`, `club_invites`, migrations 3100–3200). |
| Editable policies (new request) | 22 | Done | Every footer page is written in full and editable in the app by editors and admins; changes publish at once and every earlier version is kept (`legal_pages`, `legal_page_revisions`). |
| Policies from Termly (new request) | After 22 | Done | The Cookie, Privacy, Accessibility, Acceptable Use and Return policies, the Terms of Service, the End User License Agreement and the Disclaimer, from Termly and adapted to stay true to the app; the footer also links Termly's Do Not Sell or Share and Limit the Use of Sensitive Information request form. |
| Stripe billing (new request) | After 22 | Done | Members pay monthly through Stripe Checkout; the first charge covers the days until the billing day. The `stripe-webhook` function (signed events, each handled once) is the only writer of paid memberships; failed payments show as *Payment failed* with *Update payment method*; members who chose a plan before billing are asked to *Add a payment method*. The policies now say LiteraryWorm is a live account billed monthly until cancelled. |
| Staff aren't billed (new request) | After 22 | Done | Everyone with a staff role (Admin, Editor, Developer, Billing, Customer service, Blog, Sales) has a complimentary Premium membership while they hold one, set by the database from `staff_roles`; it has no billing day, can't be paused, cancelled or turned into a paid plan, and Account → Plan and billing says *Complimentary* with no next charge. Moving between roles keeps it; removing the last role ends it, so a plan has to be chosen (with renewal consent) before anything could be charged. Checkout refuses staff, and any Stripe subscription that reaches one is cancelled. Sales is a new role (migrations 3600–3601). |
| Where the books come from (new request) | 22 | Done | A FAQ answer on Home and Plans, and a Help section, explain the Google Books API, that the full books here are public domain, and how to upload a DRM-free EPUB bought on Google Play Books (removing DRM isn't allowed). |
| 41. Mark as finished? | 7 | Done | Dragging to the end or turning past the last page asks first; finishing moves the book to Finished. |
| 61. Accessibility menu | 0, 9 | Partly | Text size, theme, dyslexia-friendly font, contrast, highlighted links, stop animations, and *Audio and transcripts* (transcript on or off, size, English or Spanish). Settings survive sign-out within a session. |
| 66. Read-along transcripts | 9 | Partly | The player's transcript marks the sentence being read and follows it; size and English or Spanish are kept with the accessibility settings. The transcript is sample text until publishers' transcripts are licensed, so it's hidden while a real recording plays. |
| 63. Accessibility Policy in footer | 0, 22 | Done | Footer on every page; the policy is written in full (from Termly's statement): features, conformance (partially conformant with WCAG 2.2 AA), known limits, how it's tested, and accessibility@literaryworm.com for feedback. |
| 70. Cookie choices | Cookie Policy, after 22 | Done | Termly's consent banner asks on a first visit and *Consent Preferences* in the footer changes the choice. LiteraryWorm sets only essential cookies, so nothing optional is set either way; Google Books covers are marked essential so they still load when a visitor declines. The Cookie Policy lists what the browser keeps (the sign-in session, Termly's choice, the app's files, books saved for offline) and why. |
