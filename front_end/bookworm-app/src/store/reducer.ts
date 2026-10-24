import type { A11ySettings, Account, Profile } from "../types";
import { type AppState, demoHousehold, emptyProfileData, initialState, MAX_PROFILES } from "./state";

export type Action =
  | { type: "startDemo" }
  | { type: "createAccount"; account: Account }
  | { type: "signIn"; account: Account }
  | { type: "signOut" }
  | { type: "updateAccount"; patch: Partial<Account> }
  | { type: "addProfile"; profile: Profile }
  | { type: "updateProfile"; id: string; patch: Partial<Profile> }
  | { type: "deleteProfile"; id: string }
  | { type: "selectProfile"; id: string | null }
  | { type: "updateA11y"; patch: Partial<A11ySettings> };

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "startDemo":
      return { ...state, ...demoHousehold(), activeProfileId: null };

    case "createAccount":
    case "signIn":
      return { ...state, account: action.account, activeProfileId: null };

    case "signOut":
      // Accessibility settings belong to the device, so they survive signing out.
      return { ...initialState, a11y: state.a11y, reviews: state.reviews };

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
      const { [action.id]: _removed, ...profileData } = state.profileData;
      return {
        ...state,
        profiles: state.profiles.filter((p) => p.id !== action.id),
        profileData,
        activeProfileId: state.activeProfileId === action.id ? null : state.activeProfileId,
      };
    }

    case "selectProfile":
      return { ...state, activeProfileId: action.id };

    case "updateA11y":
      return { ...state, a11y: { ...state.a11y, ...action.patch } };
  }
}
