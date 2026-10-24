BookWorm: user stories

Pulled from `front_end/` (the user journey and each page's `user_journey.md`) into one list: one line per thing the app has to *remember*. Story 1 isn't on any single page; it's there so the database knows who owns what.

1. As a user, I want an account with my name, email and password so that my private lists and settings belong to me, and no one else can see or change them. Reviews and ratings are readable by everyone. (Supabase Auth keeps the password; private data shows a member only their own rows, while the catalog, logs, and reviews are publicly readable.)
2. As a user, I want to choose a membership plan (Basic, Standard or Premium) so that I know what I pay and what quality I get.
3. As a user, I want to save a payment method (only the card brand, last four digits and expiry) and a billing day so that I'm charged on a date that suits me.
4. As a user, I want to pause, cancel or restart my membership so that I only pay when I'm reading a book.
5. As a user, I want to browse books with a title, author, ISBN, or keyword.
6. As a user, I want to filter books by genre, year, length, rating, maturity level, ISBN, author, or keyword so that I can find something that interests me.
7. As a user, I want to add titles to my My List so that I can find them later.
8. As a user, I want to mark titles as Favorites (a title can be on both lists) so that I get recommendations based on what I love.
9. As a user, I want to rate a title and write a review so that other viewers know what I thought.
10. As a user, I want to set a reminder for an upcoming title so that I don't miss its release.
11. As a user, I want to set preferences (autoplay, email updates, personalized recommendations, maturity level) so that the app works the way I like.
12. As a user, I want to apply a promo code to my plan so that I get a discount.
13. As a user, I want to send feedback and report issues and get a ticket number so that I can follow up on a problem.
14. As a user, I want to opt out of the sale of my personal data so that my privacy choice is recorded.
15. As an affiliate, I want to join the Affiliate Program with my website and promotion channels so that I get my own referral code.
16. As an affiliate, I want each click and sign-up from my referral link counted so that I can see my tier and earnings.
17. As a user, I want to see when each review, ticket and referral was created so that I know how recent it is.
18. As a user, I want to adjust text size, font, spacing, contrast and color, and turn on reading and navigation aids from an accessibility menu, so that the app works for how I see, read and move; as a member, I want these settings saved so that they come back when I sign in.
19. As a user, I want one-tap accessibility profiles (seizure safe, low vision, ADHD friendly, dyslexia friendly, keyboard navigation, deaf and hard of hearing) so that I can set up several settings at once.
20. As a user, I want to read an Accessibility Policy linked from the footer so that I know what the app supports and how to report a problem.
21. As a user, I want to turn on audio description so that I can follow the story when I can't see the screen.
22. As a deaf or hard-of-hearing viewer, I want to turn closed captions on and choose their size so that I can follow along.
23. As a user, I want to choose the language of text and captions (English or Spanish) so that I can read in the language I understand best.
24. As a user, I want to delete my account from a danger zone once my subscription is cancelled, by typing my email and entering my password to confirm, so that I can leave the service; deleting only removes my access.
25. As a user, I want to contact support with a data removal ticket so that my stored data can be erased if I choose.
26. As a user who forgot my password, I want to request a reset link by email and choose a new password so that I can get back into my account.
27. As a user, I want the app to require a strong password (13+ characters with lowercase, uppercase, a digit and a symbol) and refuse passwords found in data leaks so that my account is hard to break into.
28. As a visitor, I want to try the app with my own private demo account, without signing up, so that I can explore every feature; the demo account is deleted after 24 hours.
29. As a reviewer, I want my real account name shown on my reviews, and no one able to post under someone else's name, so that reviews can be trusted.
30. As a user, I want my promo code checked against the real offers and my plan so that only valid discounts are applied.
31. As the site owner, I want the public features (demo accounts, referral clicks, Google Books lookups) limited per visitor so that no one can flood the service or inflate an affiliate's counts.
32. As a member, I want to stay signed in when I refresh the page or come back later, until I choose Sign out, so that I don't have to sign in again every time.
33. As a user, I want to browse trending and popular books from Google Books on the home page so that I can discover real titles beyond the platform's catalog.
34. As a user, I want my searches to also find movies and TV shows on Google Books, with the same type, genre, year and sort filters, so that I can look up any title.
35. As a user, I want to open a Book Title and see all it's book details and decide whether it's for me; as the site owner, I want the Google Books API key kept on the server so that no one can copy it from the browser.
36. As a member, I want to add a Google Books to My List or Favorites so that I can find it later next to the catalog's titles; the title's details come from Google Books, not from what my browser sends.
37. As a member, I want the video player to remember my volume on any device I sign in on so that I don't have to set it every time.
38. As a member, I want to rate and review Google Books titles like the catalog's titles so that I can share what I thought of them.
39. As a member, I want recommendations based on the Google Books titles I save (Because You Saved on Home, More Like This on the title) so that I discover similar titles; turning off personalized recommendations hides the Home row.
40. As a parent using a restricted profile, I want Google Books titles to carry their real U.S. maturity ratings so that my profile shows the ones within its setting and hides the rest (titles with no rating stay hidden).
41. As an account holder, I want up to five profiles, each with its own name, avatar and maturity rating (a Kids profile sees only kids' titles), so that everyone in my home gets their own lists, Continue Reading, history, reminders and recommendations, a profile's settings don't affect the others, and I can delete a profile without losing the account or other profiles.
42. As a member, I want to read support's replies on my reports and answer them; as support staff, I want to see every member's tickets by status, reply and change a ticket's status, so that problems get solved in one conversation. Only staff can see other members' tickets.
43. As a member, I want to set a reminder for a Google Books title that isn't out yet (or a books's next chapter), and a bell that counts what's new (released reminders, support replies) on every device for that profile, so that I don't miss a release or an answer.
44. As a member, I want to see each profile's reading history day by day, hide entries or all of it, and download it, so that I know and control what's kept.
45. As a member, I want to pause my Reading history (nothing new is recorded, including searches) or have old history deleted after 90 days or a year, so that the app keeps only what I'm comfortable with.
46. As a member, I want my own named lists of titles, with a description, so that I can group titles my way.
47. As a member, I want to share a list by link that anyone can open without signing in, showing only the list's name, description, my profile name and its titles, and to stop sharing it at any time, so that friends can see my picks without seeing my account.
48. As a member, I want to start a reading party for a title and invite friends by link, so that play, pause and skipping happen for all of us, we see who's watching and can chat; only the party's members can join it, and it ends after six hours.
49. As a user, I want search to find titles even when I misspell them, so that a typo doesn't hide what I'm looking for.
50. As a member, I want my recent searches (the last ten, per profile) to come back in an empty search box until I clear them, so that I can repeat a search quickly.
51. As a member, I want to rate a title Not for me, I like this or Love this! in one tap, so that recommendations follow my taste and titles I don't want stop being suggested to my profile.
52. As a viewer of a TV show, I want Skip Recap and Skip Intro buttons, chapter marks on the progress bar and a picture of the frame I'm pointing at, so that I get to the part I want quickly; and picture-in-picture, so that I can keep reading while I browse.
53. As a member, I want a Year in Review for each profile (titles, chapters and hours read my longest streak, busiest month, top genres and the actor I saw most) that I can share, so that I can look back on what I read.
54. As a parent, I want to lock my profile with a four-digit PIN (set with the account password), and Kids profiles to need the account password before account settings or profile management open, so that children stay in their own profile; five wrong PINs lock the profile for 15 minutes.
55. As a member, I want two-step sign-in with an authenticator app, so that my password alone isn't enough to get into my account; until the code is entered, none of my data can be read.
56. As a member, I want to see which devices are signed in to my account and sign out any of them, or all but this one, so that a lost phone or a shared computer can't keep using my account.
57. As a member who doesn't know what to read, I want to describe what I'm in the mood for in my own words and get a few titles with a reason each, chosen only from titles my profile can watch, and to know what is sent to the AI service, so that I find something quickly without giving away who I am.
58. As a member, I want to make a one-time donation by card (from $1 to $10,000, from the coffee button on any page) and have each one recorded with its amount, date and whether it went through, so that I can support the app; my card number never reaches the app's database, only I can read my donations, and nobody (not even me) can change or delete them.
59. As a member, I want to see my past donations (amount, date and whether each went through) on the donation page, and to get Stripe's emailed receipt, so that I can keep track of what I gave.
60. As a parent, I want to set a daily reading limit on a profile (from 30 minutes to 4 hours, with the account password) so that the player stops once the time is used up, and to allow 30 more minutes with the password when I choose; nobody reading can raise the limit or reset the time read.
61. As a reader, I want captions in Spanish as well as English, chosen in the accessibility menu and remembered with my other accessibility settings, so that I can follow along in the language I read best.
62. As a member, I want to report another member's review (spoilers, offensive, spam or something else, with optional details) so that support can look at it; as support staff, I want to see reported reviews with a copy of what was written and keep or remove each one, so that title pages stay useful and safe. A member can report a review once and never their own.
63. As a member, I want to mark another member's review as helpful (once, and take it back), and to sort reviews by most helpful or newest, so that the most useful reviews are easy to find; nobody can vote for their own review or set the count directly.
64. As a parent, I want to see how long a limited profile read on each of the last 7 days, with the total and the daily average, so that I can tell whether the daily limit is right.
65. As support staff, I want to see donations by month (amount paid, how many were paid and how many didn't go through) and the latest donations with a link to each payment in Stripe, so that I can follow donations and refund one when asked; members still see only their own.
66. As a reader who can't see the screen, I want audio description that reads out what happens on screen in my caption language, pausing the video while it speaks, turned on from the player's AD button, the D key or the accessibility menu and remembered with my other settings, so that I can follow the story.
67. As a member, I want to give the same amount every month until I cancel (on the donation page or in Account), with each month's payment in my donations, so that I can support the app regularly; a closed account is never charged again, and nothing in the browser can change a monthly donation.
68. As a Spanish speaker, I want the whole app in Spanish (chosen in the accessibility menu, or from the start when my browser is in Spanish) and remembered on every device, so that I can use it in my language; titles and synopses stay as published.
