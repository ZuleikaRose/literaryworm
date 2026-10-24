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
  name: string;
  email: string;
  /** Kept only in memory so "Ask a grown-up" gates have something to check against. */
  password: string;
  dob: string;
  planId: PlanId | null;
  billingDay: number | null;
  marketingEmails: boolean;
  isDemo: boolean;
  status: "active" | "paused" | "cancelled";
}

export interface Profile {
  id: string;
  name: string;
  /** Index into the avatar palette. */
  avatar: number;
  ageRating: AgeRating;
  pin: string | null;
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
  format: Format;
  /** 0–1 */
  fraction: number;
  chapterIndex: number;
  updatedAt: number;
  finished: boolean;
}

export interface Bookmark {
  id: string;
  bookId: string;
  chapterIndex: number;
  label: string;
  createdAt: number;
}

export interface ProfileData {
  readingList: string[];
  favorites: string[];
  customLists: CustomList[];
  ratings: Record<string, RatingValue>;
  progress: Record<string, Progress>;
  bookmarks: Bookmark[];
  recentSearches: string[];
}

export interface Review {
  id: string;
  bookId: string;
  /** Null for seeded community reviews. */
  profileId: string | null;
  displayName: string;
  initials: string;
  body: string;
  createdAt: number;
  progressLabel: string;
  helpful: number;
  helpfulBy: string[];
  reportedBy: string[];
}

export interface A11ySettings {
  textScale: number;
  readableFont: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  theme: "dark" | "light";
}
