import { getBook } from "../data/books";
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
  ReadingDay,
  ReadingLog,
  ReadingStatus,
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

export const MAX_PROFILES = 5;

export const defaultA11y: A11ySettings = {
  textScale: 1,
  readableFont: false,
  highContrast: false,
  reduceMotion: false,
  underlineLinks: false,
  theme: "dark",
  transcript: true,
  transcriptSize: "medium",
  transcriptLanguage: "en",
};

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
});

export const newId = () => crypto.randomUUID();

/** A library entry for a title from the LiteraryWorm catalog. */
function catalogEntry(bookId: string, status: ReadingStatus, addedAt: number): [string, LibraryEntry] {
  const book = getBook(bookId)!;
  return [bookId, { bookId, status, addedAt, title: book.title, authors: [book.author], cover: null }];
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
    kidsConsent: input.ageRating === "kids",
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

export function demoHousehold(): Household {
  const avery = makeProfile({ name: "Avery", ageRating: "all", avatar: 0, favoriteGenres: ["Fiction", "Science fiction"] });
  const sam = makeProfile({ name: "Sam", ageRating: "teen", avatar: 2, favoriteGenres: ["Young adult", "Fantasy"] });
  const mia = makeProfile({ name: "Mia", ageRating: "kids", avatar: 4, favoriteGenres: ["Children's"], dailyLimitMinutes: 60 });
  const now = Date.now();
  const averyData: ProfileData = {
    ...emptyProfileData(),
    library: Object.fromEntries([
      catalogEntry("babel", "want_to_read", now - 5 * 86_400_000),
      catalogEntry("sea-of-tranquility", "want_to_read", now - 4 * 86_400_000),
      catalogEntry("dune", "reading", now - 3 * 86_400_000),
      catalogEntry("the-midnight-library", "reading", now - 2 * 86_400_000),
      catalogEntry("project-hail-mary", "want_to_read", now - 86_400_000),
    ]),
    favorites: ["circe"],
    follows: [
      { kind: "author", name: "Matt Haig" },
      { kind: "narrator", name: "Imogen Hale" },
    ],
    readingGoals: { [new Date(now).getFullYear()]: 24 },
    readingDays: demoReadingDays(now),
    progress: {
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
    library: Object.fromEntries([catalogEntry("the-wild-robot", "reading", now - 2 * 86_400_000)]),
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
      marketingEmails: false,
      releaseEmails: true,
      authorEmails: true,
      updateEmails: false,
      isDemo: true,
      status: "active",
      endsAt: null,
      complimentary: false,
      stripeLinked: false,
      pastDue: false,
      giftUntil: null,
    },
    profiles: [avery, sam, mia],
    profileData: { [avery.id]: averyData, [sam.id]: emptyProfileData(), [mia.id]: miaData },
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
  a11y: defaultA11y,
  households: { [DEMO_EMAIL]: demoHousehold() },
};
