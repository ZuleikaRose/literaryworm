import type { BillingInterval, Plan } from "../types";

export const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 7.99,
    yearlyPrice: 79.9,
    summary: "Ebooks for one reader.",
    profiles: 1,
    audioHours: "5 hours of audiobooks a month",
    audioHoursPerMonth: 5,
    offlineDevices: 1,
    downloads: "Read offline on 1 device",
    features: [
      "Every LiteraryWorm title, with full texts and LibriVox recordings of the public-domain classics",
      "Search almost any book on Google Books and keep it in your library",
      "Highlights, notes, bookmarks and a dictionary in the reader",
      "Favourites, custom lists, ratings and reading logs",
      "AI book summaries, and Ask the book on the classics",
      "Reading goals, streaks, stats and a shareable Year in Review",
      "Book clubs with spoiler-free discussion and listening along",
      "Upload your own DRM-free EPUBs, and read offline",
      "Import your reading from Goodreads or StoryGraph",
      "Accessibility menu and read-along transcripts",
    ],
  },
  {
    id: "standard",
    name: "Standard",
    price: 12.99,
    yearlyPrice: 129.9,
    summary: "Reading and listening for a small household.",
    profiles: 3,
    audioHours: "30 hours of audiobooks a month",
    audioHoursPerMonth: 30,
    offlineDevices: 3,
    downloads: "Read offline on 3 devices",
    features: [
      "Everything in Basic",
      "Kids and Teen profiles that show only titles rated for them",
      "PIN locks and daily reading limits for any profile",
      "Each profile keeps its own favourites, lists, goals and stats",
      "Household reading challenges to take on together",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 17.99,
    yearlyPrice: 179.9,
    summary: "Unlimited listening for the whole family.",
    profiles: 5,
    audioHours: "Unlimited audiobooks",
    audioHoursPerMonth: null,
    offlineDevices: 5,
    downloads: "Read offline on 5 devices",
    features: [
      "Everything in Standard",
      "Two more profiles than Standard, for bigger households",
      "About $3.60 a profile each month",
    ],
  },
];

export const planFaqs = [
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel online from Account in a few clicks, with no phone call needed. Cancel at least 48 hours before your next billing date to stop that charge; cancelling later still ends your membership, but after one more month (or one more year, if you pay yearly). You keep access until the end of the period you've paid for, and there are no refunds.",
  },
  {
    q: "What's the difference between the plans?",
    a: "How many people can read: Basic has one profile, Standard three and Premium five, with more listening time and devices as you go up. Kids and Teen profiles, PIN locks and household challenges need room for more than one profile, so they start with Standard. Every other feature is in every plan.",
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
    a: "A year costs ten times the monthly price, so two months are free. It starts the day you pay and renews on that date each year until you cancel; the bell reminds you 30 days before. Moving from monthly to yearly starts your year straight away, with the unused part of the month taken off. A yearly membership can move to a bigger plan at any time (you pay the difference for the rest of the year), can't be paused, and moves to monthly billing only when the year ends.",
  },
  {
    q: "Can I pause instead of cancelling?",
    a: "Yes, on monthly billing. Pause from Account and nothing is charged until you resume. Your library, profiles and progress stay as they are. A yearly membership is already paid for the year, so it can't be paused.",
  },
  {
    q: "Can I give LiteraryWorm as a gift?",
    a: "Yes. On Gifts, buy one, three, six or twelve months of any plan, paid once. You get a code to pass on; it never expires and the person redeems it in Account or on Plans.",
  },
  {
    q: "Is LiteraryWorm safe for my kids?",
    a: "Kids profiles show only Kids-rated titles, with no chat, public reviews, sharing, payments or AI assistant. You can lock other profiles with a PIN and set daily reading limits.",
  },
  {
    q: "Where do the books come from?",
    a: "LiteraryWorm uses the Google Books API to find books and show their details and covers, so you can search almost any book, save it to your library and write about it. The books you can read and listen to in full here are public-domain classics, with texts from Project Gutenberg and recordings from LibriVox. To read a book you own, upload it: for example, buy a book its publisher sells DRM-free on Google Play Books, download the EPUB from your Google Play Books library, and add it in My Library → Uploads. It opens in the reader with your place, bookmarks and highlights, and keeps working if your connection drops once you've opened it. Books with DRM can't be uploaded, and removing DRM isn't allowed.",
  },
  {
    q: "What happens when the month's listening runs out?",
    a: "Basic includes 5 hours of audiobooks a month and Standard 30, shared by everyone in the household on every device; Premium has no limit. When they're used up, audiobooks pause until the 1st of the next month and your place is saved. Reading has no limit, and you can move to a bigger plan at any time. Account → Plan and billing shows how much you've listened this month.",
  },
  {
    q: "Can I read without a connection?",
    a: "Yes. Choose Read offline on a public-domain book's page to keep its text, and its audio if you like, on your device. Basic keeps offline books on 1 device, Standard on 3 and Premium on 5; free a device in Account to use another. Books you upload keep working if your connection drops, once you've opened them on that device.",
  },
  {
    q: "Are there audiobooks?",
    a: "Yes. The public-domain classics play their LibriVox recordings, read by volunteers, with a mini-player that keeps going while you browse and controls on your lock screen. Other titles can be read aloud by your device's own voice, and you can carry on listening on another device where you left off.",
  },
  {
    q: "Can I bring my reading history from Goodreads or StoryGraph?",
    a: "Yes. Export your library from either site, then choose Import from Goodreads or StoryGraph in My Library. The file is read on your device; we find each book, show you what we found, and add the ones you tick with your shelf and star rating. Books you'd already read don't count towards this year's goal.",
  },
  {
    q: "Who can see what I read?",
    a: "Your library, progress, highlights and notes are private to your household. Reading logs you write are public on the book's page with your display name. Book club posts are seen only by the club's members, and a list is seen only by people you send its link to.",
  },
  {
    q: "Are the book summaries written by AI?",
    a: "Yes. Summaries and Ask the book are written by Claude, an AI model made by Anthropic, and are labelled as AI-written. Ask the book only reads up to your place in the book, so it won't spoil what comes next.",
  },
  {
    q: "Which devices work?",
    a: "Any modern browser on a phone, tablet or computer. You can also install LiteraryWorm as an app from your browser.",
  },
];

export const planById = new Map(plans.map((p) => [p.id, p]));

export const formatPrice = (n: number) => `$${n.toFixed(2)}`;

/** What a plan costs each period: its monthly or yearly price. */
export const priceFor = (plan: Plan, interval: BillingInterval) => (interval === "year" ? plan.yearlyPrice : plan.price);

/** "a month" or "a year". */
export const perPeriod = (interval: BillingInterval) => (interval === "year" ? "a year" : "a month");
