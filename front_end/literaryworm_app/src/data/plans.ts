import type { BillingInterval, Plan } from "../types";

export const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 15,
    yearlyPrice: 150,
    summary: "Ebooks for one reader.",
    profiles: 1,
    audioHours: "5 hours of audiobooks a month",
    audioHoursPerMonth: 5,
    offlineDevices: 1,
    downloads: "Read offline on 1 device",
    features: [
      "Every LiteraryWorm title, with full texts and LibriVox recordings of the public-domain classics, six of them in French, German or Spanish",
      "Search almost any book on Google Books by title, author, keywords or ISBN, and keep it in your library",
      "Highlights in twelve colours, notes, bookmarks and a dictionary in the reader",
      "A private reading journal on every book, and spaced review for My words and your highlights",
      "Favourites, custom lists, smart lists that fill themselves, ratings, moods and pace, and reading logs",
      "Didn't finish for books you put down, and Read again to count every reread",
      "AI book summaries and content notes, and Ask the book, Translate and Previously… recaps on the classics",
      "Reading goals, reading plans to finish a book by a date, streaks with two rest days a month, stats for each book, and a Year in Review to share as a picture or a story",
      "Book clubs and buddy reads around a LiteraryWorm title or a book you uploaded, with spoiler-free discussion, shared highlights, listening along and where everyone is in the book",
      "Notifications on your devices for new releases, club meetings and posts, and your streak",
      "Upload your own DRM-free EPUBs, up to 20 at a time and 50 MB each, search them by title, author, keywords or ISBN, even inside their text, and read offline",
      "Import your reading from Goodreads or StoryGraph, and export it back in either's format",
      "Accessibility menu, OpenDyslexic, a reading ruler and line focus, and read-along transcripts",
      "Share a clip of any LibriVox recording as a link",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 20,
    yearlyPrice: 200,
    summary: "Reading and listening for a small household.",
    profiles: 3,
    audioHours: "30 hours of audiobooks a month",
    audioHoursPerMonth: 30,
    offlineDevices: 10,
    downloads: "Read offline on 10 devices",
    features: [
      "Everything in Basic",
      "Kids and Teen profiles that show only titles rated for them",
      "Kids can ask a grown-up for any other book, and a grown-up says yes or no",
      "PIN locks and daily reading limits for any profile, and bedtimes for Kids profiles",
      "Each profile keeps its own favourites, lists, goals and stats",
      "Household reading challenges to take on together",
      "A family shelf of books grown-ups put out for everyone at home",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 30,
    yearlyPrice: 300,
    summary: "Unlimited listening for the whole family.",
    profiles: 12,
    audioHours: "Unlimited audiobooks",
    audioHoursPerMonth: null,
    offlineDevices: 24,
    downloads: "Read offline on 24 devices",
    features: [
      "Everything in Standard",
      "Nine more profiles than Standard, for bigger households",
      "$2.50 a profile each month with all 12 in use",
    ],
  },
];

export const planFaqs = [
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel online from Account in a few clicks, with no phone call needed. Cancel at least 48 hours before your next billing date to stop that charge; cancelling later still ends your membership, but after one more month (or one more year, if you pay yearly). You keep access until the end of the period you've paid for, and there are no refunds.",
  },
  {
    q: "What does each plan cost and include?",
    a: "Basic is $15.00 a month ($150.00 a year): 1 profile, 5 hours of audiobooks a month and Read offline on 1 device. Standard is $20.00 a month ($200.00 a year): up to 3 profiles, 30 hours of audiobooks a month and 10 offline devices. Premium is $30.00 a month ($300.00 a year): up to 12 profiles, unlimited audiobooks and 24 offline devices.\n\nEvery plan has the whole catalog, the reader and player, book clubs, goals and stats, AI summaries, uploads and imports. Prices are in US dollars, plus any applicable tax.",
  },
  {
    q: "What's the difference between the plans?",
    a: "How many people can read: Basic has one profile, Standard three and Premium twelve, with more listening time and devices as you go up. Kids and Teen profiles, PIN locks and household challenges need room for more than one profile, so they start with Standard. Every other feature is in every plan. If your household already had more than 3 profiles on Standard before it changed to 3, you keep them; you just can't add more until there's room.",
  },
  {
    q: "What is LiteraryWorm?",
    a: "A reading and listening app for the whole household: ebooks and audiobooks in one library, with a profile for each person. Read in the reader with highlights, notes and a dictionary, listen with the player and mini-player, keep goals and streaks, join book clubs, and keep any book you find on Google Books in your library.",
  },
  {
    q: "Can I try it before I pay?",
    a: "Yes. Choose Try the demo on the log-in page to look around a sample household with three profiles, books, clubs and challenges. Nothing you do there is saved, and it can't take payments.",
  },
  {
    q: "How does billing work?",
    a: "Pay monthly or yearly, by card through Stripe, so your card details never reach us. Monthly plans let you pick any billing day from the 1st to the 28th and change it later in Account; the days until the new date are free. Promo codes can be added at checkout or in Account. Staff accounts are never charged.",
  },
  {
    q: "How does yearly billing work?",
    a: "A year costs ten times the monthly price, so two months are free. It starts the day you pay and renews on that date each year until you cancel; the bell reminds you 30 days before.\n\nMoving from monthly to yearly starts your year straight away, with the unused part of the month taken off. A yearly membership can move to a bigger plan at any time (you pay the difference for the rest of the year), can't be paused, and moves to monthly billing only when the year ends.",
  },
  {
    q: "Can I pause instead of cancelling?",
    a: "Yes, on monthly billing. Pause from Account and nothing is charged until you resume. Your library, profiles and progress stay as they are. A yearly membership is already paid for the year, so it can't be paused.",
  },
  {
    q: "Can I give LiteraryWorm as a gift?",
    a: "Yes. On Gifts, buy one, three, six or twelve months of any plan, paid once. Add up to 10 LiteraryWorm books to start them off, from a title or one of your lists. You get a code to pass on (or we email it to them); it never expires, the person redeems it in Account or on Plans, and the books are waiting in their library.",
  },
  {
    q: "Is LiteraryWorm safe for my kids?",
    a: "Kids profiles show only Kids-rated titles, with no chat, public reviews, sharing, payments or AI assistant. A child can ask for a book that isn't on their shelf; it opens only if a grown-up says yes in Account → Family with the account password. You can lock other profiles with a PIN and set daily reading limits.\n\nA Kids profile can have a bedtime, when books and audiobooks wait until morning. Every LiteraryWorm title's page also has content notes, written by AI, on violence, frightening scenes and more, so you can check a book before saying yes.",
  },
  {
    q: "Where do the books come from?",
    a: "LiteraryWorm uses the Google Books API to find books and show their details and covers, so you can search almost any book, save it to your library and write about it. The books you can read and listen to in full here are public-domain classics, with texts from Project Gutenberg and recordings from LibriVox.\n\nThose covers, and the Google Books preview on some book pages, load from books.google.com, so Google sets its own third-party cookies on our website when they do. Blocking third-party cookies in your browser stops them, and LiteraryWorm keeps working.\n\nTo read a book you own, upload it (up to 20 EPUBs at a time, each up to 50 MB): for example, buy a book its publisher sells DRM-free on Google Play Books, download the EPUB from your Google Play Books library, and add it in My Library → Uploads.\n\nIt opens in the reader with your place, bookmarks and highlights, and keeps working if your connection drops once you've opened it. Books with DRM can't be uploaded, and removing DRM isn't allowed.",
  },
  {
    q: "What happens when the month's listening runs out?",
    a: "Basic includes 5 hours of audiobooks a month and Standard 30, shared by everyone in the household on every device; Premium has no limit. When they're used up, audiobooks pause until the 1st of the next month and your place is saved. Reading has no limit, and you can move to a bigger plan at any time. Account → Plan and billing shows how much you've listened this month.",
  },
  {
    q: "Can I read without a connection?",
    a: "Yes. Choose Read offline on a public-domain book's page to keep its text, and its audio if you like, on your device, or have an audiobook keep its next few chapters as you listen, on Wi-Fi only if you like. Basic keeps offline books on 1 device, Standard on 10 and Premium on 24; free a device in Account to use another. Books you upload keep working if your connection drops, once you've opened them on that device.",
  },
  {
    q: "Are there audiobooks?",
    a: "Yes. The public-domain classics play their LibriVox recordings, read by volunteers, with a mini-player that keeps going while you browse and controls on your lock screen. Other titles can be read aloud by your device's own voice, and you can carry on listening on another device where you left off. Coming back after a break, Previously… in the player catches you up on the story so far.",
  },
  {
    q: "Can my book club read a book I bought?",
    a: "Yes, if it's a DRM-free EPUB. Upload it in My Library → Uploads, then start a club and choose My uploads under Book from; find it by title, author, ISBN or keywords, and sort the list by title, author, numbers or series. Your file stays private: the club sees only the title and author, and each member uploads their own copy and chooses it on the club's page, so the discussion follows their place and never spoils what's ahead.",
  },
  {
    q: "Can I bring my reading history from Goodreads or StoryGraph?",
    a: "Yes. Export your library from either site, then choose Import from Goodreads or StoryGraph in My Library. The file is read on your device; we find each book, show you what we found, and add the ones you tick with your shelf and star rating. Books you'd already read don't count towards this year's goal.",
  },
  {
    q: "Can LiteraryWorm send notifications to my phone?",
    a: "Yes. Turn on Notifications on this device in Account → Preferences, on each phone, tablet or computer you like, and choose what you hear about: books you're waiting for coming out, club meetings, new club posts up to your chapter, an evening nudge for your streak, and answers to Kids book requests. On iPhone and iPad, add LiteraryWorm to your Home Screen first. Logging out turns them off on that device.",
  },
  {
    q: "Can I read in other languages?",
    a: "Yes. Six classics have their full text and a LibriVox recording in their own language: Candide and Madame Bovary in French, Effi Briest and Max und Moritz in German, and Marianela and Lazarillo de Tormes in Spanish. Find them on Discover, on Search, or with Search's language filter.\n\nIn any public-domain classic, select a passage and choose Translate to read it in English, French, German, Spanish, Italian, Portuguese or Dutch (not on Kids profiles).",
  },
  {
    q: "Who can see what I read?",
    a: "Your library, progress, highlights and notes are private to your household. Reading logs you write are public on the book's page with your display name. Book club posts, and highlights you choose to share with a club, are seen only by the club's members, and a list is seen only by people you send its link to.",
  },
  {
    q: "Are the book summaries written by AI?",
    a: "Yes. Summaries, content notes, Ask the book, Translate and Previously… recaps are written by Claude, an AI model made by Anthropic, and are labelled as AI-written. Ask the book only reads up to your place in the book, and a Previously… recap only the chapters before yours, so neither spoils what comes next.",
  },
  {
    q: "Which devices work?",
    a: "Any modern browser on a phone, tablet or computer. You can also install LiteraryWorm as an app from your browser (on iPhone and iPad, Share → Add to Home Screen); there's nothing to download from an app store.",
  },
  {
    q: "Can I pick up where I left off on another device?",
    a: "Yes. Your place, bookmarks, highlights and notes follow you to every device you log in on, and an open book offers to jump to a place saved elsewhere. In the player, Listen on another device moves an audiobook to your phone, tablet or computer at the same spot.",
  },
  {
    q: "Does LiteraryWorm use cookies?",
    a: "Only essential ones. Our backend's host, Cloudflare, sets one to keep out bots, and your browser keeps your sign-in and the app's files for offline use.\n\nBecause we use the Google Books API, covers of books from Google Books and the Google Books preview load from books.google.com, and Google sets its own third-party cookies there. They're Google's, under Google's Privacy Policy; we don't receive them. Block third-party cookies in your browser to stop them: LiteraryWorm keeps working.\n\nThere's no advertising or analytics, and the Cookie Policy lists everything.",
  },
  {
    q: "Does LiteraryWorm need access to my local network?",
    a: "No. If your browser asks whether LiteraryWorm can reach devices on your local network, choose Block. Allowing it can stop logging in from working; if Log in does nothing, set Local network access to Block in the site's settings and reload.",
  },
  {
    q: "How do I keep my account secure?",
    a: "Turn on two-step sign-in with an authenticator app, or add a passkey, in Account → Sign-in. Grown-ups can lock any profile with a PIN, and changes to Kids profiles always ask for the account password.",
  },
];

export const planById = new Map(plans.map((p) => [p.id, p]));

export const formatPrice = (n: number) => `$${n.toFixed(2)}`;

/** What a plan costs each period: its monthly or yearly price. */
export const priceFor = (plan: Plan, interval: BillingInterval) => (interval === "year" ? plan.yearlyPrice : plan.price);

/** "a month" or "a year". */
export const perPeriod = (interval: BillingInterval) => (interval === "year" ? "a year" : "a month");
