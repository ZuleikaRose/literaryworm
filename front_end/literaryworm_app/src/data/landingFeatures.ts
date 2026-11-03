import { tk } from "../lib/i18n";
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
    title: tk("Highlights, notes and words"),
    body: tk("Read in OpenDyslexic with a reading ruler or line focus if you like. Highlight in twelve colours, add notes, and look up any word. Words and passages you keep come back for review just before you'd forget them."),
  },
  {
    icon: "ask",
    title: tk("Ask the book, without spoilers"),
    body: tk("On the classics, ask a question, see who's who, translate a passage, take a chapter quiz or catch up with Previously…. The answers only use the pages you've reached. Every title has content notes too."),
  },
  {
    icon: "star",
    title: tk("Goals, streaks and badges"),
    body: tk("Set a yearly goal, plan to finish a book by a date, keep a streak with two rest days a month, see your time with each book, earn 30 badges, start a reading challenge with the whole household, or read together in a 15 to 30 minute reading sprint."),
  },
  {
    icon: "heart",
    title: tk("How a book felt"),
    body: tk("Tag a book's moods and pace, mark the ones you didn't finish, and read your favourites again: each reread counts. Feel-good picks gathers the cheerful ones."),
  },
  {
    icon: "edit",
    title: tk("A private journal"),
    body: tk("Dated notes about each book that only you see. Export them with your highlights whenever you like."),
  },
  {
    icon: "users",
    title: tk("Book clubs and buddy reads"),
    body: tk("Read with a whole club, or start a buddy read with one friend in a tap. Talk about the book without spoilers: posts and shared highlights past your chapter stay hidden, and on the classics AI discussion questions for each chapter you've reached get the conversation going. Read a LiteraryWorm title or a book you uploaded (find it by title, author, keywords or ISBN), see where everyone is, plan meetings and add them to your calendar, vote on what to read next, and run a reading sprint together."),
  },
  {
    icon: "bookOpen",
    title: tk("Bring your own books"),
    body: tk("Upload up to 20 DRM-free EPUBs at a time, each up to 50 MB, such as books you bought. They stay private to your profile and open in the reader with your place, highlights and notes. Search them by title, author, keywords or ISBN, even inside their text."),
  },
  {
    icon: "headphones",
    title: tk("Listen anywhere"),
    body: tk("Keep listening while you browse, queue what's next, use car mode's big buttons or your voice on a phone or tablet, cast to a speaker, pick up on another device, or share a clip of what you just heard."),
  },
  {
    icon: "download",
    title: tk("Read offline"),
    body: tk("Save books to your device for the plane, have an audiobook keep its next chapters ready for the commute, and install LiteraryWorm like an app."),
  },
  {
    icon: "globe",
    title: tk("In your language, your way"),
    body: tk("Use LiteraryWorm in English, Spanish, French, German, Portuguese, Italian or Dutch, with larger text, high contrast and a dyslexia-friendly font. Each profile keeps its language on every device."),
  },
  {
    icon: "gift",
    title: tk("Gifts, wishlists and invitations"),
    body: tk("Give months of any plan with books picked, straight from someone's shared wishlist if you like. Invite friends too: when one joins and pays, you each get a month free (up to 2 for you)."),
  },
  {
    icon: "bell",
    title: tk("Follow authors, get notified"),
    body: tk("Follow the authors and narrators you love, and get a notification on your phone or computer when a book you're waiting for comes out."),
  },
];
