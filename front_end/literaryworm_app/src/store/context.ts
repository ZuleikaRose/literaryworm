import { createContext, useContext, type Dispatch } from "react";
import type { Action } from "./reducer";
import { type AppState, emptyProfileData } from "./state";

export const StoreContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

export function useActiveProfile() {
  const { state } = useStore();
  return state.profiles.find((p) => p.id === state.activeProfileId) ?? null;
}

export function useProfileData() {
  const { state } = useStore();
  return (state.activeProfileId && state.profileData[state.activeProfileId]) || emptyProfileData();
}
