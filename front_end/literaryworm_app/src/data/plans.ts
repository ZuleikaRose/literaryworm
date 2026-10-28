import type { Plan } from "../types";

export const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price: 7.99,
    summary: "Ebooks for one reader.",
    profiles: 1,
    audioHours: "5 hours of audiobooks a month",
    downloads: "Downloads on 1 device",
    features: ["Full ebook catalog", "Reading List, Favorites and Custom Lists", "Accessibility menu and read-along"],
  },
  {
    id: "standard",
    name: "Standard",
    price: 12.99,
    summary: "Reading and listening for a small household.",
    profiles: 3,
    audioHours: "30 hours of audiobooks a month",
    downloads: "Downloads on 3 devices",
    features: ["Everything in Basic", "Kids and Teen profiles", "Screen-time limits and PIN locks"],
  },
  {
    id: "premium",
    name: "Premium",
    price: 17.99,
    summary: "Unlimited listening for the whole family.",
    profiles: 5,
    audioHours: "Unlimited audiobooks",
    downloads: "Downloads on 5 devices",
    features: ["Everything in Standard", "Book Club rooms", "Year in Review for every profile"],
  },
];

export const planFaqs = [
  {
    q: "Can I cancel any time?",
    a: "Yes. Cancel online from Account in a few clicks, with no phone call needed. You keep access until the end of the period you've paid for.",
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
    q: "Can I read without a connection?",
    a: "Yes. Choose Read offline on a public-domain book's page to keep its text, and its audio if you like, on your device. Books you upload keep working if your connection drops, once you've opened them on that device.",
  },
  {
    q: "Which devices work?",
    a: "Any modern browser on a phone, tablet or computer. You can also install LiteraryWorm as an app from your browser.",
  },
];

export const planById = new Map(plans.map((p) => [p.id, p]));

export const formatPrice = (n: number) => `$${n.toFixed(2)}`;
