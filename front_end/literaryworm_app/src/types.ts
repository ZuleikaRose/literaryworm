/** Age ratings are ordered: a profile sees every title at or below its own rating. */
export type AgeRating = "kids" | "teen" | "all";
export type Format = "ebook" | "audiobook";
export type BookSource = "literaryworm" | "google" | "upload";

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
  /** Listening length in minutes (fractional for real recordings). */
  minutes: number;
}

/** One section of a recording: a chapter's MP3 and its length. */
export interface RecordingTrack {
  title: string;
  url: string;
  seconds: number;
}

/** A real narration: public-domain LibriVox recordings, streamed from the Internet Archive. */
export interface Recording {
  narrator: string;
  /** The recording's LibriVox page, for the credit. */
  page: string;
  /** In order; each is one of the book's chapters. */
  tracks: RecordingTrack[];
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
  /** Titles from Google Books can be saved and rated but not read in LiteraryWorm. */
  source: BookSource;
  publicDomain?: boolean;
  featured?: boolean;
  trendingRank?: number;
  newRelease?: boolean;
  chapters: Chapter[];
  /** Real narration, when the book has one; otherwise the player runs a silent sample clock. */
  recording?: Recording;
  /** A book the member uploaded (source "upload"): where its text is kept (null: this tab only). */
  upload?: { path: string | null };
}

export type PlanId = "basic" | "standard" | "premium";

/** How often a membership is billed: monthly, or yearly at ten times the monthly price. */
export type BillingInterval = "month" | "year";

export interface Plan {
  id: PlanId;
  name: string;
  /** The monthly price, in US dollars. */
  price: number;
  /** The yearly price: ten months' worth, so two months are free. */
  yearlyPrice: number;
  summary: string;
  profiles: number;
  audioHours: string;
  downloads: string;
  /** Hours of listening a month for the whole account; null means unlimited (lib/planLimits.ts). */
  audioHoursPerMonth: number | null;
  /** Devices that may keep books with Read offline at once. */
  offlineDevices: number;
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
  /** Monthly or yearly billing (a yearly membership renews on the date it started). */
  billingInterval: BillingInterval;
  /** When the period already paid for ends (ISO): a yearly membership's renewal date. */
  renewsAt: string | null;
  marketingEmails: boolean;
  /** Email when a book a profile set Remind me on comes out (members only; on by default). */
  releaseEmails: boolean;
  /** Weekly email of new books from authors the profiles follow (members only; on by default). */
  authorEmails: boolean;
  /** The monthly What's new email of major changes (members only; off until they turn it on). */
  updateEmails: boolean;
  /** The weekly email of how the Kids profiles read (members only; off until they turn it on). */
  kidsReportEmails: boolean;
  /** Email reminders the day before a book club meeting (members only; on until they turn it off). */
  clubMeetingEmails: boolean;
  isDemo: boolean;
  status: "active" | "paused" | "cancelled";
  /** Set once the member cancels: the date (ISO) the plan ends. Reading continues until then. */
  endsAt: string | null;
  /** An admin's membership: complimentary, never billed (set by the database from the admin role). */
  complimentary: boolean;
  /** Billed through Stripe (a payment method is on file). */
  stripeLinked: boolean;
  /** The last payment failed: the member should update their payment method. */
  pastDue: boolean;
  /** While a gift's free months last: when they end (ISO). Nothing is charged before then. */
  giftUntil: string | null;
  /** A yearly membership moving to monthly billing at renewal: the plan it moves to. */
  switchToMonthly: PlanId | null;
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
  /** The token in the list's public link while it's shared; null when it isn't. */
  shareSlug: string | null;
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

/** How a profile likes the audiobook player set up. */
export interface PlayerSettings {
  /** One of PLAYBACK_SPEEDS, 0.5–3. */
  speed: number;
  /** 0–100. */
  volume: number;
  muted: boolean;
  /** Seconds the skip buttons move (one of SKIP_CHOICES). */
  skipBack: number;
  skipForward: number;
  /** Skip each chapter's spoken introduction and closing announcement as they come. */
  autoSkipIntro: boolean;
  autoSkipOutro: boolean;
}

/** One day of a profile's reading and listening, for goals and streaks. */
export interface ReadingDay {
  /** Seconds read or listened that day (members' days load from Supabase in whole minutes). */
  seconds: number;
  /** Books finished that day. */
  finished: number;
  /** Of `seconds`, how many were spent listening (the rest is reading). */
  listened?: number;
  /** The books finished that day, when known (Year in Review lists them). */
  books?: string[];
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

/** An EPUB a member uploaded: what the reader needs before its text loads. */
export interface UploadedBook {
  /** "u-" and 32 hex digits: a valid volume id, so library, progress and highlights work. */
  id: string;
  title: string;
  author: string;
  chapterTitles: string[];
  chapterWords: number[];
  words: number;
  /** The text's place in the user-books bucket; null for in-memory accounts (kept in this tab). */
  path: string | null;
  createdAt: number;
}

/** An author or narrator a profile follows, by the name shown on their books. */
export interface Follow {
  kind: "author" | "narrator";
  name: string;
}

/** Remind Me: a book that isn't out yet, as its page showed it. */
export interface Reminder {
  bookId: string;
  title: string;
  author: string | null;
  /** YYYY-MM-DD: the first day it's out. */
  releaseDate: string;
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
  /**
   * Who reads the audiobooks: "librivox" (the recording), "silent", a device voice's voiceURI,
   * or null for the default (the recording where there is one, else a British English voice).
   */
  narrationVoice: string | null;
  /** Speed, volume, skip lengths and skipping intros and outros (members save them on the profile). */
  player: PlayerSettings;
  timeUsed: TimeUsed;
  /** Books to finish, by year. */
  readingGoals: Record<number, number>;
  /** Keyed by local date, YYYY-MM-DD; days with nothing read aren't kept. */
  readingDays: Record<string, ReadingDay>;
  /** Books this profile uploaded, newest first. */
  uploads: UploadedBook[];
  /** Authors and narrators this profile follows, oldest first. */
  follows: Follow[];
  /** Books not out yet that this profile asked to hear about, soonest first. */
  reminders: Reminder[];
  /** When this profile last opened the notification bell (ms), or null if never. Members keep it in Supabase. */
  notificationsSeenAt: number | null;
  /** New books from authors this profile follows, found by the author-news function (members only), newest first. */
  authorNews: AuthorNews[];
}

/** A Google Books title by a followed author, out in the last 30 days when it was found. */
export interface AuthorNews {
  bookId: string;
  title: string;
  /** The followed name. */
  author: string;
  /** Google's publishedDate: YYYY-MM or YYYY-MM-DD. */
  published: string;
  /** When the author-news function found it (ms). */
  foundAt: number;
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
