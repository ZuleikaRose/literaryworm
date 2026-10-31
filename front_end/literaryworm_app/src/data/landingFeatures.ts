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
    body: "Highlight in twelve colours, add notes, and look up any word. Words you keep come back for review just before you'd forget them.",
  },
  {
    icon: "ask",
    title: "Ask the book, without spoilers",
    body: "On the classics, ask a question, see who's who or take a chapter quiz. The answers only use the pages you've reached.",
  },
  {
    icon: "star",
    title: "Goals, streaks and badges",
    body: "Set a yearly goal, keep a streak with two rest days a month, earn badges, and start a reading challenge with the whole household.",
  },
  {
    icon: "edit",
    title: "A private journal",
    body: "Dated notes about each book that only you see. Export them with your highlights whenever you like.",
  },
  {
    icon: "users",
    title: "Book clubs",
    body: "Talk about a book without spoilers: posts past your chapter stay hidden. Plan meetings and add them to your calendar.",
  },
  {
    icon: "headphones",
    title: "Listen anywhere",
    body: "Keep listening while you browse, queue what's next, use car mode, cast to a speaker, or pick up on another device.",
  },
  {
    icon: "download",
    title: "Read offline",
    body: "Save books to your device for the plane or the commute, and install LiteraryWorm like an app.",
  },
  {
    icon: "bell",
    title: "Follow authors",
    body: "Follow the authors and narrators you love, and hear when a book you're waiting for comes out.",
  },
];
