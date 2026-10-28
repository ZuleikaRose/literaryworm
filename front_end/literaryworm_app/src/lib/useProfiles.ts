import { CHILDREN_NOTICE_VERSION } from "../data/legal";
import { useStore } from "../store/context";
import { makeProfile } from "../store/state";
import type { Profile } from "../types";
import * as accountApi from "./accountApi";
import { pinAttemptResult } from "./profiles";

/** What the profile editor saves. `pin`: undefined keeps the current PIN, null removes it. */
export type ProfileDraft = Pick<Profile, "name" | "avatar" | "ageRating" | "favoriteGenres" | "dailyLimitMinutes"> & {
  pin: string | null | undefined;
};

export type PinResult = { ok: true } | { ok: false; locked: boolean; attemptsLeft: number };

/**
 * The household's profiles and how to change them. Real accounts save to Supabase:
 * name, avatar and genres straight to reader_profiles; Kids profiles, PINs, limits, age
 * ratings and deletes through the manage-profile function, which re-checks the account
 * password; PINs are checked on the server, which counts wrong tries. After a change the
 * profiles are read back, so the screen shows what was saved. In-memory accounts change the
 * store directly. Every change rejects with an AccountError the caller shows.
 */
export function useProfiles() {
  const { state, dispatch } = useStore();
  const account = state.account;
  const remote = Boolean(account?.userId);

  async function reload() {
    if (!account) return;
    dispatch({ type: "setProfiles", profiles: await accountApi.loadProfiles(account) });
  }

  async function save(existing: Profile | null, draft: ProfileDraft, password: string) {
    if (!remote) {
      const patch: Partial<Profile> = {
        name: draft.name.trim(),
        avatar: draft.avatar,
        ageRating: draft.ageRating,
        favoriteGenres: draft.favoriteGenres,
        kidsConsent: draft.ageRating === "kids" ? true : (existing?.kidsConsent ?? false),
        dailyLimitMinutes: draft.dailyLimitMinutes,
        ...(draft.pin !== undefined ? { pin: draft.pin } : {}),
      };
      if (existing) dispatch({ type: "updateProfile", id: existing.id, patch: { ...patch, failedPinAttempts: 0, lockedUntil: null } });
      else dispatch({ type: "addProfile", profile: makeProfile({ ...patch, name: patch.name!, ageRating: draft.ageRating }) });
      return;
    }

    const change = (c: Parameters<typeof accountApi.changeProtectedProfile>[0]) =>
      accountApi.changeProtectedProfile(c, password);
    try {
      let id: string;
      let limitSet = false;
      if (!existing) {
        if (draft.ageRating === "kids") {
          const created = await change({
            action: "create_kids",
            name: draft.name.trim(),
            avatar: draft.avatar,
            dailyLimitMinutes: draft.dailyLimitMinutes,
            noticeVersion: CHILDREN_NOTICE_VERSION,
          });
          id = created.id!;
          limitSet = true;
          if (draft.favoriteGenres.length) await accountApi.updateProfileBasics(id, draft);
        } else {
          id = (await accountApi.createProfile(draft)).id;
        }
      } else {
        id = existing.id;
        if (draft.name.trim() !== existing.name || draft.avatar !== existing.avatar || draft.favoriteGenres.join() !== existing.favoriteGenres.join()) {
          await accountApi.updateProfileBasics(id, draft);
        }
        if (draft.ageRating !== existing.ageRating) {
          await change({
            action: "set_age_rating",
            profileId: id,
            ageRating: draft.ageRating,
            ...(draft.ageRating === "kids" ? { noticeVersion: CHILDREN_NOTICE_VERSION } : {}),
          });
        }
      }
      const hadPin = existing?.hasPin ?? false;
      if (draft.pin !== undefined && (draft.pin !== null || hadPin)) await change({ action: "set_pin", profileId: id, pin: draft.pin });
      if (!limitSet && draft.dailyLimitMinutes !== (existing?.dailyLimitMinutes ?? null)) {
        await change({ action: "set_daily_limit", profileId: id, dailyLimitMinutes: draft.dailyLimitMinutes });
      }
    } finally {
      // Show what was saved, even when a later step failed.
      await reload().catch(() => undefined);
    }
  }

  async function remove(profile: Profile, password: string) {
    if (remote) {
      await accountApi.changeProtectedProfile({ action: "delete", profileId: profile.id }, password);
      await reload();
    } else {
      dispatch({ type: "deleteProfile", id: profile.id });
    }
  }

  /** Checks a PIN; real accounts ask the server, which locks the profile after five wrong tries. */
  async function checkPin(profile: Profile, pin: string): Promise<PinResult> {
    if (!remote) {
      const result = pinAttemptResult(profile, pin);
      dispatch({ type: "updateProfile", id: profile.id, patch: result.patch });
      return result.ok ? { ok: true } : { ok: false, locked: result.locked, attemptsLeft: result.attemptsLeft };
    }
    const result = await accountApi.verifyProfilePin(profile.id, pin);
    if (result.ok) return { ok: true };
    dispatch({
      type: "updateProfile",
      id: profile.id,
      patch: { lockedUntil: result.lockedUntil, failedPinAttempts: result.lockedUntil ? 0 : 5 - result.attemptsLeft },
    });
    return { ok: false, locked: Boolean(result.lockedUntil), attemptsLeft: result.attemptsLeft };
  }

  /** Clears a PIN lockout; the caller has already checked the account password. */
  async function unlock(profile: Profile, password: string) {
    if (remote) await accountApi.changeProtectedProfile({ action: "unlock", profileId: profile.id }, password);
    dispatch({ type: "updateProfile", id: profile.id, patch: { failedPinAttempts: 0, lockedUntil: null } });
  }

  async function setGenres(profile: Profile, favoriteGenres: string[]) {
    if (remote) await accountApi.updateProfileBasics(profile.id, { ...profile, favoriteGenres });
    dispatch({ type: "updateProfile", id: profile.id, patch: { favoriteGenres } });
  }

  return { profiles: state.profiles, remote, save, remove, checkPin, unlock, setGenres };
}
