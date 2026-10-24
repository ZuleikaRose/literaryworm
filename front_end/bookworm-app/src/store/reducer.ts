import { LOG_MAX } from "../data/logs";
import type { A11ySettings, Account, LibraryEntry, PlanId, Profile, ProfileData, RatingValue, ReadingStatus } from "../types";
import {
  type AppState,
  DEMO_EMAIL,
  emailKey,
  emptyProfileData,
  type Household,
  initialState,
  MAX_PROFILES,
  newId,
} from "./state";

export type Action =
  | { type: "startDemo" }
  | { type: "createAccount"; account: Account; firstProfile: Profile }
  | { type: "signIn"; email: string }
  | { type: "signOut" }
  | { type: "choosePlan"; planId: PlanId; billingDay: number }
  | { type: "updateAccount"; patch: Partial<Account> }
  | { type: "addProfile"; profile: Profile }
  | { type: "updateProfile"; id: string; patch: Partial<Profile> }
  | { type: "deleteProfile"; id: string }
  | { type: "selectProfile"; id: string | null }
  | { type: "updateA11y"; patch: Partial<A11ySettings> }
  // The active profile's library, ratings and logs
  | { type: "addToLibrary"; entry: Omit<LibraryEntry, "addedAt" | "status">; status?: ReadingStatus }
  | { type: "setReadingStatus"; bookId: string; status: ReadingStatus }
  | { type: "removeFromLibrary"; bookId: string }
  | { type: "toggleFavorite"; bookId: string }
  | { type: "rateBook"; bookId: string; rating: RatingValue | null }
  | { type: "addLog"; bookId: string; body: string; rating: number | null }
  | { type: "updateLog"; id: string; body: string; rating: number | null }
  | { type: "deleteLog"; id: string };

/** Swap the signed-in household in, starting with no profile chosen. */
function enter(state: AppState, household: Household): AppState {
  return { ...state, ...household, activeProfileId: null, lastProfileId: null };
}

/** Put the current household away so it can be signed back into this session. */
function stash(state: AppState): AppState["households"] {
  if (!state.account) return state.households;
  const { account, profiles, profileData } = state;
  return { ...state.households, [emailKey(account.email)]: { account, profiles, profileData } };
}

/** Change the active profile's data; a no-op with no profile chosen. */
function withProfileData(state: AppState, change: (data: ProfileData) => ProfileData): AppState {
  const id = state.activeProfileId;
  if (!id) return state;
  return { ...state, profileData: { ...state.profileData, [id]: change(state.profileData[id] ?? emptyProfileData()) } };
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

    case "signIn": {
      const household = state.households[emailKey(action.email)];
      return household ? enter({ ...state, households: stash(state) }, household) : state;
    }

    case "signOut":
      // Accessibility settings belong to the device, so they survive signing out.
      return { ...initialState, a11y: state.a11y, logs: state.logs, households: stash(state) };

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
      return withProfileData(state, (data) =>
        data.library[action.entry.bookId]
          ? data
          : {
              ...data,
              library: {
                ...data.library,
                [action.entry.bookId]: { ...action.entry, status: action.status ?? "want_to_read", addedAt: Date.now() },
              },
            },
      );

    case "setReadingStatus":
      return withProfileData(state, (data) => {
        const entry = data.library[action.bookId];
        return entry ? { ...data, library: { ...data.library, [action.bookId]: { ...entry, status: action.status } } } : data;
      });

    case "removeFromLibrary": {
      const profileId = state.activeProfileId;
      const next = withProfileData(state, (data) => {
        const library = { ...data.library };
        delete library[action.bookId];
        return { ...data, library };
      });
      // Removing a book deletes the profile's logs about it, as the database's foreign key does.
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
      const inLibrary = profile && state.profileData[profile.id]?.library[action.bookId];
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

    case "deleteLog":
      return {
        ...state,
        logs: state.logs.filter((l) => !(l.id === action.id && l.profileId !== null && l.profileId === state.activeProfileId)),
      };
  }
}
