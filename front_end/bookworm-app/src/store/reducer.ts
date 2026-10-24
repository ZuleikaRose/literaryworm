import { LOG_MAX } from "../data/logs";
import type {
  A11ySettings,
  Account,
  Bookmark,
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
  makeProfile,
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
      restored: boolean;
    }
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
  | { type: "createList"; name: string; description: string }
  | { type: "updateList"; id: string; name: string; description: string }
  | { type: "deleteList"; id: string }
  | { type: "moveList"; id: string; by: -1 | 1 }
  | { type: "addToList"; id: string; bookId: string }
  | { type: "removeFromList"; id: string; bookId: string }
  | { type: "addRecentSearch"; q: string }
  | { type: "removeRecentSearch"; q: string }
  | { type: "clearRecentSearches" }
  // Reader and player
  | { type: "saveProgress"; progress: Progress }
  | { type: "addBookmark"; bookmark: Bookmark }
  | { type: "removeBookmark"; id: string }
  | { type: "updateReaderSettings"; patch: Partial<ReaderSettings> }
  | { type: "setPlaybackSpeed"; speed: number }
  | { type: "addTimeUsed"; day: string; seconds: number }
  | { type: "allowExtraTime"; day: string; minutes: number };

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

/** Change the active profile's data; a no-op with no profile chosen. */
function withProfileData(state: AppState, change: (data: ProfileData) => ProfileData): AppState {
  const id = state.activeProfileId;
  if (!id) return state;
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

/** Progress and bookmarks: the account's for real accounts, the profile's otherwise (like the library). */
function withReading(state: AppState, change: (reading: AccountReading) => AccountReading): AppState {
  if (state.account?.userId) return { ...state, accountReading: change(state.accountReading) };
  return withProfileData(state, (data) => {
    const next = change({ progress: data.progress, bookmarks: data.bookmarks });
    return { ...data, progress: next.progress, bookmarks: next.bookmarks };
  });
}

export function activeReading(state: AppState): AccountReading {
  if (state.account?.userId) return state.accountReading;
  const data = state.activeProfileId ? state.profileData[state.activeProfileId] : undefined;
  return data ? { progress: data.progress, bookmarks: data.bookmarks } : emptyReading();
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
        return {
          ...state,
          authReady: true,
          authError: null,
          account: action.account,
          accountLibrary: action.library,
          accountReading: action.reading,
        };
      }
      // Household profiles stay in memory for now; the first one is named after the account holder.
      const first = makeProfile({ name: action.account.name.split(/\s+/)[0].slice(0, 20), ageRating: "all" });
      const entered = enter({ ...state, households: stash(state) }, {
        account: action.account,
        profiles: [first],
        profileData: { [first.id]: emptyProfileData() },
      });
      return {
        ...entered,
        // Restored after a refresh: carry on as the account's one profile instead of asking again.
        activeProfileId: action.restored ? first.id : null,
        authReady: true,
        authError: null,
        accountLibrary: action.library,
        accountReading: action.reading,
      };
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
        profiles: state.profiles.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
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
      // Progress and bookmarks go with the book too (on delete cascade in the database).
      const next = withReading(withoutBook, (reading) => {
        const progress = { ...reading.progress };
        delete progress[action.bookId];
        return { progress, bookmarks: reading.bookmarks.filter((b) => b.bookId !== action.bookId) };
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
          { id: newId(), name: action.name.trim(), description: action.description.trim(), bookIds: [], shared: false },
        ],
      }));

    case "updateList":
      return withProfileData(state, (data) => ({
        ...data,
        customLists: data.customLists.map((l) =>
          l.id === action.id ? { ...l, name: action.name.trim(), description: action.description.trim() } : l,
        ),
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

    case "addRecentSearch": {
      // Newest first, no repeats (ignoring case), at most ten per profile.
      const key = action.q.toLowerCase();
      return withProfileData(state, (data) => ({
        ...data,
        recentSearches: [action.q, ...data.recentSearches.filter((s) => s.toLowerCase() !== key)].slice(0, 10),
      }));
    }

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

    case "saveProgress":
      return withReading(state, (reading) => ({
        ...reading,
        progress: { ...reading.progress, [action.progress.bookId]: action.progress },
      }));

    case "addBookmark":
      return withReading(state, (reading) => ({ ...reading, bookmarks: [...reading.bookmarks, action.bookmark] }));

    case "removeBookmark":
      return withReading(state, (reading) => ({
        ...reading,
        bookmarks: reading.bookmarks.filter((b) => b.id !== action.id),
      }));

    case "updateReaderSettings":
      return withProfileData(state, (data) => ({ ...data, readerSettings: { ...data.readerSettings, ...action.patch } }));

    case "setPlaybackSpeed":
      return withProfileData(state, (data) => ({ ...data, playbackSpeed: action.speed }));

    case "addTimeUsed":
      return withProfileData(state, (data) => {
        // A new day starts from zero, with no extra time.
        const used = data.timeUsed.day === action.day ? data.timeUsed : { day: action.day, seconds: 0, extraMinutes: 0 };
        return { ...data, timeUsed: { ...used, seconds: used.seconds + action.seconds } };
      });

    case "allowExtraTime":
      return withProfileData(state, (data) => {
        const used = data.timeUsed.day === action.day ? data.timeUsed : { day: action.day, seconds: 0, extraMinutes: 0 };
        return { ...data, timeUsed: { ...used, extraMinutes: used.extraMinutes + action.minutes } };
      });
  }
}
