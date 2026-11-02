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
    body: "On the classics, ask a question, see who's who, translate a passage, take a chapter quiz or catch up with Previously…. The answers only use the pages you've reached. Every title has content notes too.",
  },
  {
    icon: "star",
    title: "Goals, streaks and badges",
    body: "Set a yearly goal, plan to finish a book by a date, keep a streak with two rest days a month, see your time with each book, earn 30 badges, and start a reading challenge with the whole household.",
  },
  {
    icon: "heart",
    title: "How a book felt",
    body: "Tag a book's moods and pace, mark the ones you didn't finish, and read your favourites again: each reread counts. Feel-good picks gathers the cheerful ones.",
  },
  {
    icon: "edit",
    title: "A private journal",
    body: "Dated notes about each book that only you see. Export them with your highlights whenever you like.",
  },
  {
    icon: "users",
    title: "Book clubs and buddy reads",
    body: "Read with a whole club, or start a buddy read with one friend in a tap. Talk about the book without spoilers: posts and shared highlights past your chapter stay hidden, and on the classics AI discussion questions for each chapter you've reached get the conversation going. Read a LiteraryWorm title or a book you uploaded (find it by title, author, keywords or ISBN), see where everyone is, plan meetings and add them to your calendar.",
  },
  {
    icon: "bookOpen",
    title: "Bring your own books",
    body: "Upload up to 20 DRM-free EPUBs at a time, each up to 50 MB, such as books you bought. They stay private to your profile and open in the reader with your place, highlights and notes. Search them by title, author, keywords or ISBN, even inside their text.",
  },
  {
    icon: "headphones",
    title: "Listen anywhere",
    body: "Keep listening while you browse, queue what's next, use car mode's big buttons on a phone or tablet, cast to a speaker, pick up on another device, or share a clip of what you just heard.",
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
