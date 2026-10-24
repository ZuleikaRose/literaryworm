import { getBook } from "../data/books";
import { seedLogs } from "../data/logs";
import { usesBackend } from "../lib/backend";
import type { A11ySettings, Account, LibraryEntry, Profile, ProfileData, ReadingLog, ReadingStatus } from "../types";

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
  /** A real account's library (library_items), shared by its household profiles. */
  accountLibrary: Record<string, LibraryEntry>;
  /** Every profile's logs plus the sample ones; public on each book's page. */
  logs: ReadingLog[];
  a11y: A11ySettings;
  /**
   * Accounts created (or signed out of) during this session, keyed by lower-case email,
   * so signing back in works until the page is refreshed.
   */
  households: Record<string, Household>;
}

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
};

export const emptyProfileData = (): ProfileData => ({
  library: {},
  favorites: [],
  customLists: [],
  ratings: {},
  progress: {},
  bookmarks: [],
  recentSearches: [],
});

export const newId = () => crypto.randomUUID();

/** A library entry for a title from the BookWorm catalog. */
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
export const DEMO_EMAIL = "demo@bookworm.example";

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
  };
}

/** A ready-made household so visitors can explore without signing up. */
export function demoHousehold(): Household {
  const avery = makeProfile({ name: "Avery", ageRating: "all", avatar: 0, favoriteGenres: ["Fiction", "Science fiction"] });
  const sam = makeProfile({ name: "Sam", ageRating: "teen", avatar: 2, favoriteGenres: ["Young adult", "Fantasy"] });
  const mia = makeProfile({ name: "Mia", ageRating: "kids", avatar: 4, favoriteGenres: ["Children's"] });
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
      isDemo: true,
      status: "active",
    },
    profiles: [avery, sam, mia],
    profileData: { [avery.id]: averyData, [sam.id]: emptyProfileData(), [mia.id]: miaData },
  };
}

export const initialState: AppState = {
  authReady: !usesBackend,
  authError: null,
  accountLibrary: {},
  account: null,
  profiles: [],
  activeProfileId: null,
  lastProfileId: null,
  profileData: {},
  logs: seedLogs,
  a11y: defaultA11y,
  households: { [DEMO_EMAIL]: demoHousehold() },
};
