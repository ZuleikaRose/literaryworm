import { LOG_MAX } from "../data/logs";
import { type Collections, withRecentSearch } from "../lib/collections";
import type {
  A11ySettings,
  Account,
  Bookmark,
  CustomList,
  Highlight,
  LibraryEntry,
  PlanId,
  Profile,
  ProfileData,
  Progress,
  RatingValue,
  ReaderSettings,
  ReadingStatus,
} from "../types";
import {
  type AccountReading,
  type AppState,
  DEMO_EMAIL,
  emailKey,
  emptyProfileData,
  emptyReading,
  type Household,
  initialState,
  MAX_PROFILES,
  newId,
} from "./state";

export type Action =
  | { type: "startDemo" }
  | { type: "createAccount"; account: Account; firstProfile: Profile }
  | { type: "signIn"; email: string }
  /** A real (Supabase) account signed in or was restored after a refresh. */
  | {
      type: "enterAccount";
      account: Account;
      library: Record<string, LibraryEntry>;
      reading: AccountReading;
      profiles: Profile[];
      /** Each profile's saved favourites, ratings, lists and recent searches. */
      collections: Record<string, Collections>;
      restored: boolean;
    }
  /**
   * A real account's progress, bookmarks and highlights, reloaded from Supabase (another device
   * may have moved on). Places saved here since `since` (this device's clock) are newer, so they stay.
   */
  | { type: "syncReading"; reading: AccountReading; since: number }
  /** A real account's profiles, reloaded from Supabase after a change. */
  | { type: "setProfiles"; profiles: Profile[] }
  /** An in-memory account deleted itself. */
  | { type: "deleteAccount" }
  | { type: "authChecked"; error?: string }
  | { type: "signOut" }
  | { type: "choosePlan"; planId: PlanId; billingDay: number }
  | { type: "updateAccount"; patch: Partial<Account> }
  | { type: "addProfile"; profile: Profile }
  | { type: "updateProfile"; id: string; patch: Partial<Profile> }
  | { type: "deleteProfile"; id: string }
  | { type: "selectProfile"; id: string | null }
  | { type: "updateA11y"; patch: Partial<A11ySettings> }
  // The active profile's library, ratings and logs
  | { type: "addToLibrary"; entry: Omit<LibraryEntry, "addedAt" | "status"> & Partial<Pick<LibraryEntry, "addedAt" | "status">>; status?: ReadingStatus }
  | { type: "setReadingStatus"; bookId: string; status: ReadingStatus }
  | { type: "removeFromLibrary"; bookId: string }
  | { type: "toggleFavorite"; bookId: string }
  | { type: "rateBook"; bookId: string; rating: RatingValue | null }
  | { type: "addLog"; bookId: string; body: string; rating: number | null }
  | { type: "updateLog"; id: string; body: string; rating: number | null }
  | { type: "deleteLog"; id: string }
  /** `list`: as saved in Supabase (real accounts); otherwise made here. */
  | { type: "createList"; name: string; description: string; list?: CustomList }
  | { type: "setListShare"; id: string; shareSlug: string | null }
  | { type: "updateList"; id: string; name: string; description: string }
  | { type: "deleteList"; id: string }
  | { type: "moveList"; id: string; by: -1 | 1 }
  | { type: "addToList"; id: string; bookId: string }
  | { type: "removeFromList"; id: string; bookId: string }
  | { type: "addRecentSearch"; q: string }
  | { type: "removeRecentSearch"; q: string }
  | { type: "clearRecentSearches" }
  // Reader and player
  /** `profileId`: the profile that was reading, when it may no longer be the active one (the mini-player). */
  | { type: "saveProgress"; progress: Progress; profileId?: string }
  | { type: "addBookmark"; bookmark: Bookmark }
  | { type: "removeBookmark"; id: string }
  | { type: "addHighlight"; highlight: Highlight }
  | { type: "updateHighlight"; id: string; patch: Partial<Pick<Highlight, "color" | "note">> }
  | { type: "removeHighlight"; id: string }
  | { type: "updateReaderSettings"; patch: Partial<ReaderSettings> }
  | { type: "setPlaybackSpeed"; speed: number }
  | { type: "setNarrationVoice"; voice: string | null }
  | { type: "addTimeUsed"; day: string; seconds: number; profileId?: string }
  | { type: "allowExtraTime"; day: string; minutes: number }
  /** The active profile's goal for a year; null clears it. */
  | { type: "setReadingGoal"; year: number; books: number | null }
  /** A book was finished today (counts towards the profile's goal). */
  | { type: "finishedBook"; day: string; profileId?: string };

/** Swap the signed-in household in, starting with no profile chosen. */
function enter(state: AppState, household: Household): AppState {
  return { ...state, ...household, activeProfileId: null, lastProfileId: null };
}

/** Put the current household away so it can be signed back into this session (in-memory accounts). */
function stash(state: AppState): AppState["households"] {
  if (!state.account || state.account.userId) return state.households;
  const { account, profiles, profileData } = state;
  return { ...state.households, [emailKey(account.email)]: { account, profiles, profileData } };
}

/** Replace the household's profiles, keeping each surviving profile's in-memory data. */
function withProfiles(state: AppState, profiles: Profile[]): AppState {
  const ids = new Set(profiles.map((p) => p.id));
  const profileData = Object.fromEntries(profiles.map((p) => [p.id, state.profileData[p.id] ?? emptyProfileData()]));
  return {
    ...state,
    profiles,
    profileData,
    activeProfileId: state.activeProfileId && ids.has(state.activeProfileId) ? state.activeProfileId : null,
    lastProfileId: state.lastProfileId && ids.has(state.lastProfileId) ? state.lastProfileId : null,
  };
}

/**
 * Change the active profile's data (or `profileId`'s, when given); a no-op with no profile
 * chosen, or when the given profile has gone (signed out, deleted).
 */
function withProfileData(state: AppState, change: (data: ProfileData) => ProfileData, profileId?: string): AppState {
  const id = profileId ?? state.activeProfileId;
  if (!id || (profileId && !state.profileData[profileId])) return state;
  return { ...state, profileData: { ...state.profileData, [id]: change(state.profileData[id] ?? emptyProfileData()) } };
}

/** The library the active profile uses: the account's for real accounts, the profile's otherwise. */
function withLibrary(state: AppState, change: (library: Record<string, LibraryEntry>) => Record<string, LibraryEntry>): AppState {
  if (state.account?.userId) return { ...state, accountLibrary: change(state.accountLibrary) };
  return withProfileData(state, (data) => ({ ...data, library: change(data.library) }));
}

export function activeLibrary(state: AppState): Record<string, LibraryEntry> {
  if (state.account?.userId) return state.accountLibrary;
  return (state.activeProfileId && state.profileData[state.activeProfileId]?.library) || {};
}

/** Progress, bookmarks and highlights: the account's for real accounts, the profile's otherwise (like the library). */
function withReading(state: AppState, change: (reading: AccountReading) => AccountReading, profileId?: string): AppState {
  if (state.account?.userId) return { ...state, accountReading: change(state.accountReading) };
  return withProfileData(
    state,
    (data) => {
      const next = change({ progress: data.progress, bookmarks: data.bookmarks, highlights: data.highlights });
      return { ...data, progress: next.progress, bookmarks: next.bookmarks, highlights: next.highlights };
    },
    profileId,
  );
}

export function activeReading(state: AppState): AccountReading {
  if (state.account?.userId) return state.accountReading;
  const data = state.activeProfileId ? state.profileData[state.activeProfileId] : undefined;
  return data ? { progress: data.progress, bookmarks: data.bookmarks, highlights: data.highlights } : emptyReading();
}

/** The same rules as the logs table: 1–5000 characters after trimming, rating 1–5 or none. */
function validLog(body: string, rating: number | null): boolean {
  const length = body.trim().length;
  return length >= 1 && length <= LOG_MAX && (rating === null || (Number.isInteger(rating) && rating >= 1 && rating <= 5));
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "startDemo":
      return enter({ ...state, households: stash(state) }, state.households[DEMO_EMAIL]);

    case "createAccount": {
      const household: Household = {
        account: action.account,
        profiles: [action.firstProfile],
        profileData: { [action.firstProfile.id]: emptyProfileData() },
      };
      return enter(
        { ...state, households: { ...stash(state), [emailKey(action.account.email)]: household } },
        household,
      );
    }

    case "enterAccount": {
      if (state.account?.userId === action.account.userId) {
        // Restored again (token refresh, another tab): keep the household, update the details.
        const kept = withProfiles(state, action.profiles);
        return {
          ...kept,
          profileData: Object.fromEntries(
            Object.entries(kept.profileData).map(([id, data]) => [id, { ...data, ...action.collections[id] }]),
          ),
          authReady: true,
          authError: null,
          account: action.account,
          accountLibrary: action.library,
          accountReading: action.reading,
        };
      }
      const entered = enter({ ...state, households: stash(state) }, {
        account: action.account,
        profiles: action.profiles,
        profileData: Object.fromEntries(action.profiles.map((p) => [p.id, { ...emptyProfileData(), ...action.collections[p.id] }])),
      });
      // Restored after a refresh: carry on when there's only one profile and nothing guards it;
      // otherwise Who's reading? asks (PIN locks and Kids profiles still apply).
      const only = action.profiles.length === 1 ? action.profiles[0] : null;
      const carryOn = action.restored && only && !only.hasPin && only.ageRating !== "kids";
      return {
        ...entered,
        activeProfileId: carryOn ? only.id : null,
        authReady: true,
        authError: null,
        accountLibrary: action.library,
        accountReading: action.reading,
      };
    }

    case "setProfiles":
      return withProfiles(state, action.profiles);

    case "deleteAccount": {
      if (!state.account || state.account.userId) return state;
      const households = { ...state.households };
      delete households[emailKey(state.account.email)];
      return { ...initialState, authReady: true, a11y: state.a11y, logs: state.logs, households };
    }

    case "authChecked":
      return { ...state, authReady: true, authError: action.error ?? null };

    case "signIn": {
      const household = state.households[emailKey(action.email)];
      return household ? enter({ ...state, households: stash(state) }, household) : state;
    }

    case "signOut":
      // Accessibility settings belong to the device, so they survive signing out.
      return { ...initialState, authReady: true, a11y: state.a11y, logs: state.logs, households: stash(state) };

    case "choosePlan":
      return state.account
        ? { ...state, account: { ...state.account, planId: action.planId, billingDay: action.billingDay, status: "active" } }
        : state;

    case "updateAccount":
      return state.account ? { ...state, account: { ...state.account, ...action.patch } } : state;

    case "addProfile":
      if (state.profiles.length >= MAX_PROFILES) return state;
      return {
        ...state,
        profiles: [...state.profiles, action.profile],
        profileData: { ...state.profileData, [action.profile.id]: emptyProfileData() },
      };

    case "updateProfile":
      return {
        ...state,
        profiles: state.profiles.map((p) =>
          p.id === action.id
            ? { ...p, ...action.patch, hasPin: action.patch.pin !== undefined ? action.patch.pin !== null : (action.patch.hasPin ?? p.hasPin) }
            : p,
        ),
      };

    case "deleteProfile": {
      const profileData = { ...state.profileData };
      delete profileData[action.id];
      return {
        ...state,
        profiles: state.profiles.filter((p) => p.id !== action.id),
        profileData,
        // A profile's logs go with it, like the database's on delete cascade.
        logs: state.logs.filter((l) => l.profileId !== action.id),
        activeProfileId: state.activeProfileId === action.id ? null : state.activeProfileId,
        lastProfileId: state.lastProfileId === action.id ? null : state.lastProfileId,
      };
    }

    case "selectProfile":
      return {
        ...state,
        activeProfileId: action.id,
        lastProfileId: action.id === null ? (state.activeProfileId ?? state.lastProfileId) : state.lastProfileId,
      };

    case "updateA11y":
      return { ...state, a11y: { ...state.a11y, ...action.patch } };

    case "addToLibrary":
      return withLibrary(state, (library) =>
        library[action.entry.bookId]
          ? library
          : {
              ...library,
              [action.entry.bookId]: {
                status: action.status ?? "want_to_read",
                addedAt: Date.now(),
                ...action.entry,
              },
            },
      );

    case "setReadingStatus":
      return withLibrary(state, (library) => {
        const entry = library[action.bookId];
        return entry ? { ...library, [action.bookId]: { ...entry, status: action.status } } : library;
      });

    case "removeFromLibrary": {
      const profileId = state.activeProfileId;
      const withoutBook = withLibrary(state, (library) => {
        const rest = { ...library };
        delete rest[action.bookId];
        return rest;
      });
      // Progress, bookmarks and highlights go with the book too (on delete cascade in the database).
      const next = withReading(withoutBook, (reading) => {
        const progress = { ...reading.progress };
        delete progress[action.bookId];
        return {
          progress,
          bookmarks: reading.bookmarks.filter((b) => b.bookId !== action.bookId),
          highlights: reading.highlights.filter((h) => h.bookId !== action.bookId),
        };
      });
      // Removing a book deletes the profile's logs about it, as the database's foreign key does
      // (for real accounts the database does it, and the page reloads the logs).
      return { ...next, logs: next.logs.filter((l) => !(l.profileId === profileId && l.bookId === action.bookId)) };
    }

    case "toggleFavorite":
      return withProfileData(state, (data) => ({
        ...data,
        favorites: data.favorites.includes(action.bookId)
          ? data.favorites.filter((id) => id !== action.bookId)
          : [...data.favorites, action.bookId],
      }));

    case "rateBook":
      return withProfileData(state, (data) => {
        const ratings = { ...data.ratings };
        if (action.rating) ratings[action.bookId] = action.rating;
        else delete ratings[action.bookId];
        return { ...data, ratings };
      });

    case "addLog": {
      const profile = state.profiles.find((p) => p.id === state.activeProfileId);
      const inLibrary = profile && activeLibrary(state)[action.bookId];
      // Logs are public, so Kids profiles don't write them.
      if (!profile || profile.ageRating === "kids" || !inLibrary || !validLog(action.body, action.rating)) return state;
      const now = Date.now();
      return {
        ...state,
        logs: [
          {
            id: newId(),
            bookId: action.bookId,
            profileId: profile.id,
            displayName: profile.name,
            body: action.body.trim(),
            rating: action.rating,
            createdAt: now,
            updatedAt: now,
          },
          ...state.logs,
        ],
      };
    }

    case "updateLog":
      if (!validLog(action.body, action.rating)) return state;
      return {
        ...state,
        logs: state.logs.map((l) =>
          l.id === action.id && l.profileId !== null && l.profileId === state.activeProfileId
            ? { ...l, body: action.body.trim(), rating: action.rating, updatedAt: Date.now() }
            : l,
        ),
      };

    case "createList":
      return withProfileData(state, (data) => ({
        ...data,
        customLists: [
          ...data.customLists,
          action.list ?? { id: newId(), name: action.name.trim(), description: action.description.trim(), bookIds: [], shareSlug: null },
        ],
      }));

    case "updateList":
      return withProfileData(state, (data) => ({
        ...data,
        customLists: data.customLists.map((l) =>
          l.id === action.id ? { ...l, name: action.name.trim(), description: action.description.trim() } : l,
        ),
      }));

    case "setListShare":
      return withProfileData(state, (data) => ({
        ...data,
        customLists: data.customLists.map((l) => (l.id === action.id ? { ...l, shareSlug: action.shareSlug } : l)),
      }));

    case "deleteList":
      return withProfileData(state, (data) => ({ ...data, customLists: data.customLists.filter((l) => l.id !== action.id) }));

    case "moveList":
      return withProfileData(state, (data) => {
        const lists = [...data.customLists];
        const from = lists.findIndex((l) => l.id === action.id);
        const to = from + action.by;
        if (from < 0 || to < 0 || to >= lists.length) return data;
        [lists[from], lists[to]] = [lists[to], lists[from]];
        return { ...data, customLists: lists };
      });

    case "addToList":
      return withProfileData(state, (data) => ({
        ...data,
        customLists: data.customLists.map((l) =>
          l.id === action.id && !l.bookIds.includes(action.bookId) ? { ...l, bookIds: [...l.bookIds, action.bookId] } : l,
        ),
      }));

    case "removeFromList":
      return withProfileData(state, (data) => ({
        ...data,
        customLists: data.customLists.map((l) =>
          l.id === action.id ? { ...l, bookIds: l.bookIds.filter((b) => b !== action.bookId) } : l,
        ),
      }));

    case "addRecentSearch":
      return withProfileData(state, (data) => ({ ...data, recentSearches: withRecentSearch(data.recentSearches, action.q) }));

    case "removeRecentSearch":
      return withProfileData(state, (data) => ({
        ...data,
        recentSearches: data.recentSearches.filter((s) => s !== action.q),
      }));

    case "clearRecentSearches":
      return withProfileData(state, (data) => ({ ...data, recentSearches: [] }));

    case "deleteLog":
      return {
        ...state,
        logs: state.logs.filter((l) => !(l.id === action.id && l.profileId !== null && l.profileId === state.activeProfileId)),
      };

    case "syncReading": {
      if (!state.account?.userId) return state;
      const progress = { ...action.reading.progress };
      for (const [bookId, local] of Object.entries(state.accountReading.progress)) {
        if (local.updatedAt >= action.since) progress[bookId] = local;
      }
      return { ...state, accountReading: { ...action.reading, progress } };
    }

    case "saveProgress":
      return withReading(
        state,
        (reading) => ({ ...reading, progress: { ...reading.progress, [action.progress.bookId]: action.progress } }),
        action.profileId,
      );

    case "addBookmark":
      return withReading(state, (reading) => ({ ...reading, bookmarks: [...reading.bookmarks, action.bookmark] }));

    case "removeBookmark":
      return withReading(state, (reading) => ({
        ...reading,
        bookmarks: reading.bookmarks.filter((b) => b.id !== action.id),
      }));

    case "addHighlight":
      return withReading(state, (reading) => ({ ...reading, highlights: [...reading.highlights, action.highlight] }));

    case "updateHighlight":
      return withReading(state, (reading) => ({
        ...reading,
        highlights: reading.highlights.map((h) => (h.id === action.id ? { ...h, ...action.patch } : h)),
      }));

    case "removeHighlight":
      return withReading(state, (reading) => ({
        ...reading,
        highlights: reading.highlights.filter((h) => h.id !== action.id),
      }));

    case "updateReaderSettings":
      return withProfileData(state, (data) => ({ ...data, readerSettings: { ...data.readerSettings, ...action.patch } }));

    case "setPlaybackSpeed":
      return withProfileData(state, (data) => ({ ...data, playbackSpeed: action.speed }));

    case "setNarrationVoice":
      return withProfileData(state, (data) => ({ ...data, narrationVoice: action.voice }));

    case "addTimeUsed":
      return withProfileData(
        state,
        (data) => {
          // A new day starts from zero, with no extra time.
          const used = data.timeUsed.day === action.day ? data.timeUsed : { day: action.day, seconds: 0, extraMinutes: 0 };
          const day = data.readingDays[action.day] ?? { seconds: 0, finished: 0 };
          return {
            ...data,
            timeUsed: { ...used, seconds: used.seconds + action.seconds },
            readingDays: { ...data.readingDays, [action.day]: { ...day, seconds: day.seconds + action.seconds } },
          };
        },
        action.profileId,
      );

    case "setReadingGoal":
      return withProfileData(state, (data) => {
        const readingGoals = { ...data.readingGoals };
        if (action.books === null) delete readingGoals[action.year];
        else readingGoals[action.year] = action.books;
        return { ...data, readingGoals };
      });

    case "finishedBook":
      return withProfileData(
        state,
        (data) => {
          const day = data.readingDays[action.day] ?? { seconds: 0, finished: 0 };
          return { ...data, readingDays: { ...data.readingDays, [action.day]: { ...day, finished: day.finished + 1 } } };
        },
        action.profileId,
      );

    case "allowExtraTime":
      return withProfileData(state, (data) => {
        const used = data.timeUsed.day === action.day ? data.timeUsed : { day: action.day, seconds: 0, extraMinutes: 0 };
        return { ...data, timeUsed: { ...used, extraMinutes: used.extraMinutes + action.minutes } };
      });
  }
}
