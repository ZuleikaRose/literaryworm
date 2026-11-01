import type { IconName } from "../components/Icon";

/**
 * The public home page's *More than a reader* cards. Keep each one true to the app (CLAUDE.md
 * describes every feature); when a feature changes, change its card too.
 */
export interface LandingFeature {
  icon: IconName;
  title: string;
  body: string;
}

export const landingFeatures: LandingFeature[] = [
  {
    icon: "highlighter",
    title: "Highlights, notes and words",
    body: "Read in OpenDyslexic with a reading ruler or line focus if you like. Highlight in twelve colours, add notes, and look up any word. Words and passages you keep come back for review just before you'd forget them.",
  },
  {
    icon: "ask",
    title: "Ask the book, without spoilers",
    body: "On the classics, ask a question, see who's who, take a chapter quiz or catch up with Previously…. The answers only use the pages you've reached.",
  },
  {
    icon: "star",
    title: "Goals, streaks and badges",
    body: "Set a yearly goal, plan to finish a book by a date, keep a streak with two rest days a month, see your time with each book, earn badges, and start a reading challenge with the whole household.",
  },
  {
    icon: "edit",
    title: "A private journal",
    body: "Dated notes about each book that only you see. Export them with your highlights whenever you like.",
  },
  {
    icon: "users",
    title: "Book clubs",
    body: "Talk about a book without spoilers: posts and shared highlights past your chapter stay hidden. See where everyone is, plan meetings and add them to your calendar.",
  },
  {
    icon: "headphones",
    title: "Listen anywhere",
    body: "Keep listening while you browse, queue what's next, use car mode, cast to a speaker, or pick up on another device.",
  },
  {
    icon: "download",
    title: "Read offline",
    body: "Save books to your device for the plane, have an audiobook keep its next chapters ready for the commute, and install LiteraryWorm like an app.",
  },
  {
    icon: "bell",
    title: "Follow authors, get notified",
    body: "Follow the authors and narrators you love, and get a notification on your phone or computer when a book you're waiting for comes out.",
  },
];
