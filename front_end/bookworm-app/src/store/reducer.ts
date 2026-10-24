import type { A11ySettings, Account, PlanId, Profile } from "../types";
import { type AppState, DEMO_EMAIL, emailKey, emptyProfileData, type Household, initialState, MAX_PROFILES } from "./state";

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
  | { type: "updateA11y"; patch: Partial<A11ySettings> };

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
      return { ...initialState, a11y: state.a11y, reviews: state.reviews, households: stash(state) };

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
  }
}
