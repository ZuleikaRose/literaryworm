/** Age ratings are ordered: a profile sees every title at or below its own rating. */
export type AgeRating = "kids" | "teen" | "all";
export type Format = "ebook" | "audiobook";
export type BookSource = "bookworm" | "google";

export type CoverMotif =
  | "dot-slash"
  | "sun"
  | "horizon"
  | "slash"
  | "rings"
  | "band"
  | "stripe"
  | "arch"
  | "grid"
  | "wave";

export interface CoverStyle {
  motif: CoverMotif;
  /** Ground color of the cover. */
  bg: string;
  /** Title color. */
  ink: string;
  /** Motif color. */
  accent: string;
  /** Optional second ground used by horizon/band motifs. */
  bg2?: string;
}

export interface Chapter {
  title: string;
  /** Listening length in minutes. */
  minutes: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  narrator?: string;
  publisher: string;
  year: number;
  genres: string[];
  rating: number;
  ratingsCount: number;
  pages: number;
  formats: Format[];
  ageRating: AgeRating;
  language: string;
  synopsis: string;
  contentNotes?: string[];
  series?: { name: string; order: number };
  cover: CoverStyle;
  /** Titles from Google Books can be saved and rated but not read in BookWorm. */
  source: BookSource;
  publicDomain?: boolean;
  featured?: boolean;
  trendingRank?: number;
  newRelease?: boolean;
  chapters: Chapter[];
}

export type PlanId = "basic" | "standard" | "premium";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  summary: string;
  profiles: number;
  audioHours: string;
  downloads: string;
  features: string[];
}

export interface Account {
  /** The Supabase user id for real accounts; absent for the demo and in-memory accounts. */
  userId?: string;
  name: string;
  email: string;
  /**
   * In-memory accounts only, so "Ask a grown-up" gates have something to check against.
   * Empty for real accounts: Supabase checks their password.
   */
  password: string;
  dob: string;
  planId: PlanId | null;
  billingDay: number | null;
  marketingEmails: boolean;
  isDemo: boolean;
  status: "active" | "paused" | "cancelled";
  /** Set once the member cancels: the date (ISO) the plan ends. Reading continues until then. */
  endsAt: string | null;
}

export interface Profile {
  id: string;
  name: string;
  /** Index into the avatar palette. */
  avatar: number;
  ageRating: AgeRating;
  /** In-memory accounts only. Real accounts never see the PIN: Supabase keeps a hash. */
  pin: string | null;
  hasPin: boolean;
  failedPinAttempts: number;
  lockedUntil: number | null;
  favoriteGenres: string[];
  dailyLimitMinutes: number | null;
  kidsConsent: boolean;
}

export type RatingValue = "not-for-me" | "like" | "love";

export interface CustomList {
  id: string;
  name: string;
  description: string;
  bookIds: string[];
  shared: boolean;
}

export interface Progress {
  bookId: string;
  /** The format used last, so Continue Reading reopens the reader or the player. */
  format: Format;
  /** How far through the whole book, 0–1 (pages for ebooks, time for audiobooks). */
  fraction: number;
  chapterIndex: number;
  updatedAt: number;
  finished: boolean;
}

/** A named place in a book. Bookmarks are added and removed, never edited. */
export interface Bookmark {
  id: string;
  bookId: string;
  format: Format;
  chapterIndex: number;
  /** 0–1 through the whole book. */
  fraction: number;
  label: string;
  createdAt: number;
}

export type HighlightColor = "yellow" | "green" | "blue" | "pink";

/**
 * A passage marked on one reader page, with an optional note. The page is found by chapter
 * and page within the chapter; the passage by character offsets in that page's text.
 */
export interface Highlight {
  id: string;
  bookId: string;
  chapterIndex: number;
  /** 0-based page within the chapter. */
  page: number;
  start: number;
  end: number;
  /** The highlighted words, kept so lists can show them without opening the page. */
  quote: string;
  color: HighlightColor;
  note: string | null;
  createdAt: number;
}

/** The reader's display choices, kept per profile for the session. */
export interface ReaderSettings {
  font: "serif" | "sans" | "readable";
  /** Index into READER_SIZES. */
  size: number;
  spacing: "compact" | "normal" | "relaxed";
  margins: "narrow" | "normal" | "wide";
  theme: "light" | "sepia" | "dark";
}

/** Reading and listening time used today, for the profile's daily limit. */
export interface TimeUsed {
  /** Local date, YYYY-MM-DD. */
  day: string;
  seconds: number;
  /** Extra minutes a grown-up allowed today. */
  extraMinutes: number;
}

/** The brief's reading statuses (the library's "update" operation). */
export type ReadingStatus = "want_to_read" | "reading" | "finished";

/** A book in a profile's library. Private: only its own profile sees it. */
export interface LibraryEntry {
  bookId: string;
  status: ReadingStatus;
  addedAt: number;
  /** What the Library page needs to show a Google Books title without asking again (when known). */
  title?: string;
  authors?: string[];
  cover?: string | null;
}

export interface ProfileData {
  /** Keyed by book id. Replaces the old Reading List: "want to read" entries are that list. */
  library: Record<string, LibraryEntry>;
  favorites: string[];
  customLists: CustomList[];
  ratings: Record<string, RatingValue>;
  /** In-memory accounts only; real accounts keep progress and bookmarks in Supabase (state.accountReading). */
  progress: Record<string, Progress>;
  bookmarks: Bookmark[];
  highlights: Highlight[];
  recentSearches: string[];
  readerSettings: ReaderSettings;
  /** Audiobook playback speed, 0.5–3. */
  playbackSpeed: number;
  timeUsed: TimeUsed;
}

/**
 * A reading log: what a reader thought of a book in their library. Logs are public on the
 * book's page and show the writer's display name, never an email address.
 */
export interface ReadingLog {
  id: string;
  bookId: string;
  /** The profile that wrote it (in-memory accounts); null for sample logs and logs from Supabase. */
  profileId: string | null;
  /** The Supabase user who wrote it, for logs read from the database. */
  userId?: string | null;
  displayName: string;
  body: string;
  /** Optional 1–5. */
  rating: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface A11ySettings {
  textScale: number;
  readableFont: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  theme: "dark" | "light";
  /** The player's read-along transcript: shown or hidden, its size, and its language. */
  transcript: boolean;
  transcriptSize: "small" | "medium" | "large";
  transcriptLanguage: TranscriptLanguage;
}

export type TranscriptLanguage = "en" | "es";
