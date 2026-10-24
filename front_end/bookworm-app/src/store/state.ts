import { seedReviews } from "../data/reviews";
import type { A11ySettings, Account, Profile, ProfileData, Review } from "../types";

/**
 * All app state lives in memory. Nothing is written to localStorage, so a refresh starts over.
 */
export interface AppState {
  account: Account | null;
  profiles: Profile[];
  activeProfileId: string | null;
  profileData: Record<string, ProfileData>;
  reviews: Review[];
  a11y: A11ySettings;
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
  readingList: [],
  favorites: [],
  customLists: [],
  ratings: {},
  progress: {},
  bookmarks: [],
  recentSearches: [],
});

export const initialState: AppState = {
  account: null,
  profiles: [],
  activeProfileId: null,
  profileData: {},
  reviews: seedReviews,
  a11y: defaultA11y,
};

export const newId = () => crypto.randomUUID();

/**
 * Not a secret: the demo household is public sample data that only exists in memory.
 * It's shown to demo users wherever the app asks for the account password ("Ask a grown-up").
 */
export const DEMO_ACCOUNT_PASSWORD = "bookworm-demo";

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
export function demoHousehold(): Pick<AppState, "account" | "profiles" | "profileData"> {
  const avery = makeProfile({ name: "Avery", ageRating: "all", avatar: 0, favoriteGenres: ["Fiction", "Science fiction"] });
  const sam = makeProfile({ name: "Sam", ageRating: "teen", avatar: 2, favoriteGenres: ["Young adult", "Fantasy"] });
  const mia = makeProfile({ name: "Mia", ageRating: "kids", avatar: 4, favoriteGenres: ["Children's"] });
  const now = Date.now();
  const averyData: ProfileData = {
    ...emptyProfileData(),
    readingList: ["babel", "sea-of-tranquility", "project-hail-mary"],
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
      email: "demo@bookworm.example",
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
