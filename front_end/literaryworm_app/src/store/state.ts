import { browserUiLanguage } from "../lib/i18n";
import { DEFAULT_SAVED_A11Y } from "../lib/a11ySync";
import { prefersMoreContrast } from "../lib/contrast";
import { getBook } from "../data/books";
import { DEMO_READER_ID, DEMO_READER_NAME } from "../data/demoReaders";
import { demoUpcomingReminder } from "../data/demoUpcoming";
import { DEMO_UPLOAD_READING, demoUploads } from "../data/demoUploads";
import { seedLogs } from "../data/logs";
import { usesBackend } from "../lib/backend";
import { defaultPlayerSettings, defaultReaderSettings, today } from "../lib/reading";
import type {
  A11ySettings,
  Account,
  Bookmark,
  Highlight,
  LibraryEntry,
  Profile,
  ProfileData,
  Progress,
  BookDay,
  ReadingDay,
  ReadingLog,
  ReadingStatus,
  SavedWord,
} from "../types";

/**
 * All app state lives in memory. Nothing is written to localStorage, so a refresh starts over.
 */
export interface AppState {
  account: Account | null;
  profiles: Profile[];
  activeProfileId: string | null;
  /** The profile used before returning to Who's reading?, so Kids can't slip into profile management. */
  lastProfileId: string | null;
  profileData: Record<string, ProfileData>;
  /**
   * False until the app knows whether a Supabase session exists (restored after a refresh),
   * so route guards wait instead of sending a signed-in member to the log-in page.
   */
  authReady: boolean;
  /** Set when a saved session couldn't be restored (offline, database down), so the log-in page can say why. */
  authError: string | null;
  /** A session has the password but still needs the code from the member's authenticator app. */
  secondStep: boolean;
  /** A real account's library (library_items), shared by its household profiles. */
  accountLibrary: Record<string, LibraryEntry>;
  /** A real account's progress, bookmarks and highlights (reading_progress, bookmarks, highlights), shared like the library. */
  accountReading: AccountReading;
  /** Every profile's logs plus the sample ones; public on each book's page. */
  logs: ReadingLog[];
  a11y: A11ySettings;
  /**
   * Accounts created (or signed out of) during this session, keyed by lower-case email,
   * so signing back in works until the page is refreshed.
   */
  households: Record<string, Household>;
}

export interface AccountReading {
  progress: Record<string, Progress>;
  bookmarks: Bookmark[];
  highlights: Highlight[];
}

export const emptyReading = (): AccountReading => ({ progress: {}, bookmarks: [], highlights: [] });

/** Everything that belongs to one account. */
export interface Household {
  account: Account;
  profiles: Profile[];
  profileData: Record<string, ProfileData>;
}

/** The most profiles any plan allows (Premium); the database caps it too. */
export const MAX_PROFILES = 12;

/** The accessibility settings a visit starts with: the defaults, with High contrast on when the device asks for more contrast. */
export const startingA11y = (): A11ySettings => ({ ...defaultA11y, highContrast: prefersMoreContrast(), language: browserUiLanguage() });

export const defaultA11y: A11ySettings = { ...DEFAULT_SAVED_A11Y, language: "en" };

export const emptyProfileData = (): ProfileData => ({
  library: {},
  favorites: [],
  customLists: [],
  ratings: {},
  progress: {},
  bookmarks: [],
  highlights: [],
  recentSearches: [],
  readerSettings: defaultReaderSettings,
  narrationVoice: null,
  player: defaultPlayerSettings,
  timeUsed: { day: today(), seconds: 0, extraMinutes: 0 },
  readingGoals: {},
  readingDays: {},
  uploads: [],
  follows: [],
  reminders: [],
  notificationsSeenAt: null,
  authorNews: [],
  words: [],
  readingWpm: null,
  uiLanguage: null,
  a11ySettings: null,
  matureOkAt: null,
  upNext: [],
  quizResults: [],
  readerFollows: [],
  bookRequests: [],
  journal: [],
  moods: {},
});

export const newId = () => crypto.randomUUID();

/** A library entry for a title from the LiteraryWorm catalog. */
function catalogEntry(bookId: string, status: ReadingStatus, addedAt: number, updatedAt?: number): [string, LibraryEntry] {
  const book = getBook(bookId)!;
  return [bookId, { bookId, status, addedAt, ...(updatedAt ? { updatedAt } : {}), title: book.title, authors: [book.author], cover: null }];
}

/**
 * The demo household's password, generated fresh on every page load so no fixed credential
 * lives in the source. The app shows it to demo users wherever it asks for the account
 * password (log-in note, "Ask a grown-up", protected profile changes).
 */
export const DEMO_ACCOUNT_PASSWORD = `demo-${Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) =>
  b.toString(16).padStart(2, "0"),
).join("")}`;
export const DEMO_EMAIL = "demo@literaryworm.example";

export const emailKey = (email: string) => email.trim().toLowerCase();

export function makeProfile(input: Partial<Profile> & Pick<Profile, "name" | "ageRating">): Profile {
  return {
    id: newId(),
    avatar: 0,
    pin: null,
    failedPinAttempts: 0,
    lockedUntil: null,
    favoriteGenres: [],
    dailyLimitMinutes: null,
    weeklyGoalMinutes: null,
    bedtime: null,
    wakeTime: null,
    kidsConsent: input.ageRating === "kids",
    setAside: false,
    ...input,
    hasPin: input.hasPin ?? Boolean(input.pin),
  };
}

/** A ready-made household so visitors can explore without signing up. */
/**
 * A few months of sample reading for the demo's goals page: a streak up to yesterday, and books
 * finished along the way. Made from today's date, so it always looks recent.
 */
/** The books Avery's demo days finish, in order (newest first). */
const DEMO_FINISHED = ["circe", "pride-and-prejudice", "the-time-machine", "klara-and-the-sun", "frankenstein", "educated", "the-great-gatsby", "jane-eyre", "babel", "dracula", "atomic-habits"];

function demoReadingDays(now: number): Record<string, ReadingDay> {
  const days: Record<string, ReadingDay> = {};
  // Days ago with some reading; every third one finishes a book. Some of the time is listening.
  const pattern = [1, 2, 3, 4, 5, 6, 9, 11, 12, 15, 18, 20, 23, 27, 31, 34, 38, 41, 45, 52, 58, 63, 70, 77, 84, 96, 103, 117, 124, 140, 151, 163];
  pattern.forEach((ago, i) => {
    const seconds = (20 + ((i * 17) % 45)) * 60;
    const book = i % 3 === 0 ? DEMO_FINISHED[i / 3] : undefined;
    days[today(new Date(now - ago * 86_400_000))] = {
      seconds,
      listened: i % 2 === 0 ? Math.round(seconds * 0.6) : 0,
      finished: book ? 1 : 0,
      ...(book ? { books: [book] } : {}),
    };
  });
  return days;
}

/** Avery's sample days with Dune (42% through), for the book page's *Your time with this book*. */
function demoDuneDays(now: number): Record<string, BookDay> {
  const days: [number, number, number, number, number][] = [
    // days ago, minutes, listening minutes, from, to
    [9, 35, 0, 0, 0.06],
    [6, 50, 30, 0.06, 0.15],
    [4, 25, 0, 0.15, 0.2],
    [2, 70, 45, 0.2, 0.34],
    [1, 40, 0, 0.34, 0.42],
  ];
  return Object.fromEntries(
    days.map(([ago, minutes, listening, from, to]) => [today(new Date(now - ago * 86_400_000)), { seconds: minutes * 60, listened: listening * 60, from, to }]),
  );
}

function demoWord(word: string, definition: string, bookId: string, reviewDue: string | null, reviewStep: number, createdAt: number): SavedWord {
  return { word, definition, bookId, chapterIndex: 0, page: null, context: null, learned: false, reviewDue, reviewStep, createdAt };
}

/** A demo highlight on a book's first page (its real words and offsets in public/texts/<id>.json). */
function demoHighlight(id: string, quote: string, start: number, color: Highlight["color"], note: string | null, createdAt: number, bookId = "frankenstein"): Highlight {
  return { id, bookId, chapterIndex: 0, page: 0, start, end: start + quote.length, quote, color, note, createdAt, reviewDue: null, reviewStep: 0 };
}

export function demoHousehold(): Household {
  const avery = makeProfile({ name: "Avery", ageRating: "all", avatar: 0, favoriteGenres: ["Fiction", "Science fiction"] });
  const sam = makeProfile({ name: "Sam", ageRating: "teen", avatar: 2, favoriteGenres: ["Young adult", "Fantasy"] });
  const mia = makeProfile({ name: "Mia", ageRating: "kids", avatar: 4, favoriteGenres: ["Children's"], dailyLimitMinutes: 60, weeklyGoalMinutes: 120 });
  const now = Date.now();
  const day = 86_400_000;
  // Four sample EPUBs (data/demoUploads.ts): two in a series, one being read, one with a LibriVox recording.
  const uploads = demoUploads(now);
  const reading = uploads.find((u) => u.id === DEMO_UPLOAD_READING)!;
  const averyData: ProfileData = {
    ...emptyProfileData(),
    // Books to read, being read, finished and not finished, two of a series, added and changed on
    // different days: so every My Library Sort by (series, published, recently changed) shows something.
    library: Object.fromEntries([
      catalogEntry("the-time-machine", "finished", now - 70 * day, now - 30 * day),
      catalogEntry("pride-and-prejudice", "finished", now - 60 * day, now - 25 * day),
      catalogEntry("anne-of-green-gables", "finished", now - 40 * day, now - 10 * day),
      catalogEntry("moby-dick", "did_not_finish", now - 30 * day, now - 15 * day),
      catalogEntry("anne-of-avonlea", "want_to_read", now - 9 * day),
      catalogEntry("babel", "want_to_read", now - 5 * day),
      catalogEntry("sea-of-tranquility", "want_to_read", now - 4 * day),
      catalogEntry("dune", "reading", now - 3 * day),
      catalogEntry("the-midnight-library", "reading", now - 2 * day),
      catalogEntry("project-hail-mary", "want_to_read", now - day),
      [reading.id, { bookId: reading.id, status: "reading", addedAt: reading.createdAt, title: reading.title, authors: [reading.author], cover: null }],
    ]),
    uploads,
    favorites: ["circe"],
    // Two of Avery's own lists (My Library → Lists); the demo can't share them by link.
    customLists: [
      {
        id: "demo-list-holiday",
        name: "Holiday reads",
        description: "Light, kind books for a week away.",
        bookIds: ["the-midnight-library", "anne-of-green-gables", "circe"],
        shareSlug: null,
      },
      { id: "demo-list-classics", name: "Classics to finish", description: "", bookIds: ["moby-dick", "jane-eyre", "middlemarch"], shareSlug: null },
    ],
    // The first lines of Pride and Prejudice, which Avery finished (real offsets on its first page).
    highlights: [
      demoHighlight(
        "demo-highlight-avery-1",
        "It is a truth universally acknowledged, that a single man in possession of a good fortune must be in want of a wife.",
        0,
        "green",
        "The best first line in English. Every word is doing a job.",
        now - 26 * day,
        "pride-and-prejudice",
      ),
      demoHighlight(
        "demo-highlight-avery-2",
        "However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered as the rightful property of some one or other of their daughters.",
        118,
        "pink",
        null,
        now - 26 * day,
        "pride-and-prejudice",
      ),
    ],
    // A sample reader to follow (data/demoReaders.ts), for My Library → Readers.
    readerFollows: [{ readerId: DEMO_READER_ID, name: DEMO_READER_NAME }],
    // A reminder for the sample upcoming book (data/demoUpcoming.ts), for My Library → Reminders.
    reminders: [demoUpcomingReminder(now)],
    follows: [
      { kind: "author", name: "Matt Haig" },
      { kind: "narrator", name: "Imogen Hale" },
    ],
    readingGoals: { [new Date(now).getFullYear()]: 24 },
    readingDays: demoReadingDays(now),
    // How two books felt (lib/moods.ts): The Midnight Library shows in Feel-good picks.
    moods: { dune: { moods: ["adventurous", "tense"], pace: "medium" }, "the-midnight-library": { moods: ["hopeful", "reflective"], pace: "fast" } },
    bookDays: { dune: demoDuneDays(now) },
    // Three kept words for My words: two due for review today, one not until later.
    words: [
      demoWord("melancholy", "noun: a deep, lasting sadness", "frankenstein", null, 0, now - 9 * 86_400_000),
      demoWord("candour", "noun: the quality of being open and honest", "pride-and-prejudice", today(new Date(now - 86_400_000)), 1, now - 6 * 86_400_000),
      demoWord("ardent", "adjective: very enthusiastic or passionate", "pride-and-prejudice", today(new Date(now + 3 * 86_400_000)), 2, now - 4 * 86_400_000),
    ],
    progress: {
      [reading.id]: { bookId: reading.id, format: "ebook", fraction: 0.4, chapterIndex: 1, updatedAt: now - 5 * 3_600_000, finished: false },
      dune: { bookId: "dune", format: "audiobook", fraction: 0.42, chapterIndex: 9, updatedAt: now - 3_600_000, finished: false },
      "the-midnight-library": {
        bookId: "the-midnight-library",
        format: "ebook",
        fraction: 0.18,
        chapterIndex: 2,
        updatedAt: now - 86_400_000,
        finished: false,
      },
    },
  };
  const miaData: ProfileData = {
    ...emptyProfileData(),
    // A little reading this week, for the grown-ups' Kids report in Account → Family.
    readingDays: {
      // Some of it in Bedtime listening, for the report's bedtime line.
      [today(new Date(now - 86_400_000))]: { seconds: 25 * 60, listened: 15 * 60, finished: 0, bedtimeListened: 10 * 60 },
      [today(new Date(now - 2 * 86_400_000))]: { seconds: 30 * 60, listened: 30 * 60, finished: 0, bedtimeListened: 12 * 60 },
      [today(new Date(now - 4 * 86_400_000))]: { seconds: 20 * 60, listened: 0, finished: 1, books: ["peter-pan"] },
    },
    library: Object.fromEntries([catalogEntry("the-wild-robot", "reading", now - 2 * 86_400_000)]),
    // The author of the book Mia's listening to, for My Library → Following and Home's new-from row.
    follows: [{ kind: "author", name: "Peter Brown" }],
    progress: {
      "the-wild-robot": {
        bookId: "the-wild-robot",
        format: "audiobook",
        fraction: 0.3,
        chapterIndex: 4,
        updatedAt: now - 7_200_000,
        finished: false,
      },
    },
  };
  return {
    account: {
      name: "Avery Brooks",
      email: DEMO_EMAIL,
      password: DEMO_ACCOUNT_PASSWORD,
      dob: "1990-01-01",
      planId: "premium",
      billingDay: 1,
      billingInterval: "month",
      renewsAt: null,
      marketingEmails: false,
      releaseEmails: true,
      authorEmails: true,
      updateEmails: false,
      kidsReportEmails: false,
      yearEmails: false,
      clubMeetingEmails: true,
      clubPostEmails: false,
      isDemo: true,
      status: "active",
      endsAt: null,
      complimentary: false,
      stripeLinked: false,
      pastDue: false,
      giftUntil: null,
      trialUntil: null,
      switchToMonthly: null,
      memberSince: null,
    },
    profiles: [avery, sam, mia],
    profileData: { [avery.id]: averyData, [sam.id]: samData(now), [mia.id]: miaData },
  };
}

export const initialState: AppState = {
  authReady: !usesBackend,
  authError: null,
  secondStep: false,
  accountLibrary: {},
  accountReading: emptyReading(),
  account: null,
  profiles: [],
  activeProfileId: null,
  lastProfileId: null,
  profileData: {},
  logs: seedLogs,
  a11y: startingA11y(),
  households: { [DEMO_EMAIL]: demoHousehold() },
};

/**
 * Sam's demo data: Frankenstein, with two highlights made last week, so Notes has a highlights
 * review due (lib/highlightReview.ts) and Home says so.
 */
function samData(now: number): ProfileData {
  const intro = "The event on which this fiction is founded has been supposed, by Dr. Darwin, and some of the physiological writers of Germany, as not of impossible occurrence.";
  const weaving = "I have not considered myself as merely weaving a series of supernatural terrors.";
  return {
    ...emptyProfileData(),
    library: Object.fromEntries([catalogEntry("frankenstein", "reading", now - 8 * 86_400_000)]),
    // The author of the book Sam's reading, and the sample reader (data/demoReaders.ts).
    follows: [{ kind: "author", name: "Mary Shelley" }],
    readerFollows: [{ readerId: DEMO_READER_ID, name: DEMO_READER_NAME }],
    highlights: [
      demoHighlight("demo-highlight-1", intro, 0, "yellow", "Mary Shelley defending the premise before the story starts.", now - 7 * 86_400_000),
      demoHighlight("demo-highlight-2", weaving, 311, "blue", null, now - 6 * 86_400_000),
    ],
  };
}
