import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { browseGenres, favouriteGenreLabel } from "../data/genres";
import { avatarPalette } from "../lib/avatars";
import { durationLabel } from "../lib/goals";
import { LISTENING_SHARES, VOICE_SHARES } from "../lib/profileShares";
import { BEDTIME_EXTRA_MINUTES, BEDTIME_OPTIONS, DEFAULT_WAKE, timeLabel, WAKE_OPTIONS } from "../lib/bedtime";
import { ageRatingDetails, dailyLimitOptions, isValidPin, PIN_LENGTH, PROFILE_NAME_MAX, validateProfileName, weeklyGoalOptions } from "../lib/profiles";
import { AccountError } from "../lib/accountApi";
import { useCheckAccountPassword } from "../lib/useCheckAccountPassword";
import { useProfiles } from "../lib/useProfiles";
import { useStore } from "../store/context";
import { rich, type T } from "../lib/i18n";
import { useT } from "../lib/useT";
import type { AgeRating, Profile } from "../types";
import { AccountPasswordField } from "./AccountPasswordField";
import { Avatar } from "./Avatar";
import { Dialog } from "./Dialog";
import { Field } from "./Field";
import { Icon } from "./Icon";

interface ProfileEditorProps {
  open: boolean;
  /** The profile to edit, or null to add a new one. */
  profile: Profile | null;
  onClose: () => void;
}

/** An age rating's name and what it means (lib/profiles.ts's ageRatingDetails), translated. */
function ratingText(t: T, rating: AgeRating): { label: string; description: string } {
  return rating === "kids"
    ? { label: t("Kids"), description: t("Under 13. Kids titles only, a simpler layout, and no chat, public reviews, sharing or payments.") }
    : rating === "teen"
      ? { label: t("Teen"), description: t("13 to 17. Teen and Kids titles. Reviews show a display name only.") }
      : { label: t("All"), description: t("Every title in the catalog.") };
}

export function ProfileEditor({ open, profile, onClose }: ProfileEditorProps) {
  const isNew = !profile;
  const t = useT();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      eyebrow={isNew ? t("New profile") : t("Edit profile")}
      title={isNew ? t("Add a profile") : t("Edit {name}", { name: profile.name })}
      description={isNew ? <p>{t("Each profile gets its own lists, history and recommendations.")}</p> : undefined}
    >
      {/* Keyed so the form starts fresh each time it opens. */}
      {open && <ProfileForm key={profile?.id ?? "new"} profile={profile} onDone={onClose} />}
    </Dialog>
  );
}

type Errors = Partial<Record<"name" | "consent" | "pin" | "password" | "form", string>>;

function ProfileForm({ profile, onDone }: { profile: Profile | null; onDone: () => void }) {
  const { state } = useStore();
  const t = useT();
  const household = useProfiles();
  const checkPassword = useCheckAccountPassword();
  const [busy, setBusy] = useState(false);
  const isNew = !profile;
  const others = state.profiles.filter((p) => p.id !== profile?.id);

  const [name, setName] = useState(profile?.name ?? "");
  const [avatar, setAvatar] = useState(profile?.avatar ?? state.profiles.length % avatarPalette.length);
  const [rating, setRating] = useState<AgeRating>(profile?.ageRating ?? "all");
  // Favourites chosen from the older list become the browse genre that covers them.
  const [genres, setGenres] = useState<string[]>(() => [
    ...new Set((profile?.favoriteGenres ?? []).map(favouriteGenreLabel).filter((g): g is string => g !== null)),
  ]);
  const [consent, setConsent] = useState(profile?.kidsConsent ?? false);
  const [pinOn, setPinOn] = useState(Boolean(profile?.hasPin));
  const [pin, setPin] = useState("");
  const [limit, setLimit] = useState<number | null>(profile?.dailyLimitMinutes ?? null);
  const [weeklyGoal, setWeeklyGoal] = useState<number | null>(profile?.weeklyGoalMinutes ?? null);
  const [kidsVoices, setKidsVoices] = useState(Boolean(profile?.kidsNaturalVoices));
  // A monthly share of the household's hours (lib/profileShares.ts); null is none of its own.
  const [listenShare, setListenShare] = useState<number | null>(profile?.monthlyListeningMinutes ?? null);
  const [voiceShare, setVoiceShare] = useState<number | null>(profile?.monthlyVoiceMinutes ?? null);
  // Only Kids profiles keep a weekly goal.
  // Grown-up and teen profiles set their own goal in Goals; the editor sets a Kids profile's.
  const goal = rating === "kids" ? weeklyGoal : (profile?.weeklyGoalMinutes ?? null);
  // Bedtime (lib/bedtime.ts): Kids profiles only; leaving Kids clears it.
  const [bedtimeChoice, setBedtimeChoice] = useState<string | null>(profile?.bedtime ?? null);
  const [wakeChoice, setWakeChoice] = useState<string>(profile?.wakeTime ?? DEFAULT_WAKE);
  const bedtime = rating === "kids" ? bedtimeChoice : null;
  const wakeTime = bedtime ? wakeChoice : null;
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  // A step that needs confirming with the account password: deleting, setting aside, bringing back.
  const [confirm, setConfirm] = useState<"delete" | "aside" | "back" | null>(null);
  const confirmDelete = confirm === "delete";
  const inUseOthers = others.filter((p) => !p.setAside);
  // Not the profile reading now (switch first), and never the last one in use.
  const canSetAside = !isNew && !profile.setAside && profile.id !== state.activeProfileId && inUseOthers.length > 0;
  const formRef = useRef<HTMLFormElement>(null);

  // Changing who can see what, or locking a profile, is the account holder's call.
  const pinChanged = pinOn ? pin.length > 0 || !profile?.hasPin : Boolean(profile?.hasPin);
  const protectedChange =
    (isNew ? rating === "kids" : rating !== profile.ageRating) || pinChanged || limit !== (profile?.dailyLimitMinutes ?? null) || goal !== (profile?.weeklyGoalMinutes ?? null) || (rating === "kids" && kidsVoices !== Boolean(profile?.kidsNaturalVoices)) || listenShare !== (profile?.monthlyListeningMinutes ?? null) || voiceShare !== (profile?.monthlyVoiceMinutes ?? null) ||
    (rating === "kids" && (bedtime !== (profile?.bedtime ?? null) || wakeTime !== (profile?.wakeTime ?? null)));
  const needsPassword = protectedChange || confirm !== null;
  const needsConsent = rating === "kids" && !(profile?.ageRating === "kids" && profile.kidsConsent);

  const toggleGenre = (g: string) => setGenres((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));

  const focusFirstError = () =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    const nameError = validateProfileName(name, others);
    if (nameError) next.name = nameError;
    if (needsConsent && !consent) next.consent = t("Give consent as the parent or guardian to create a Kids profile.");
    if (pinOn && (pin.length > 0 || !profile?.hasPin) && !isValidPin(pin)) next.pin = t("Enter {n} digits.", { n: PIN_LENGTH });
    setBusy(true);
    if (needsPassword && !next.name && !next.consent && !next.pin) {
      const result = await checkPassword(password);
      if (!result.ok) next.password = result.problem ?? t("Enter the account password to save these changes.");
    }
    setErrors(next);
    if (Object.keys(next).length) {
      setBusy(false);
      focusFirstError();
      return;
    }
    try {
      await household.save(
        profile,
        {
          name,
          avatar,
          ageRating: rating,
          favoriteGenres: genres,
          dailyLimitMinutes: limit,
          weeklyGoalMinutes: goal,
          kidsNaturalVoices: rating === "kids" && kidsVoices,
          monthlyListeningMinutes: listenShare,
          monthlyVoiceMinutes: voiceShare,
          bedtime,
          wakeTime,
          // undefined keeps the current PIN; null removes it.
          pin: pinOn ? (pin.length > 0 ? pin : undefined) : profile?.hasPin ? null : undefined,
        },
        password,
      );
      onDone();
    } catch (err) {
      setErrors({ form: err instanceof AccountError ? err.message : t("We couldn't save the profile. Try again.") });
      setBusy(false);
    }
  };

  const moveAside = async (aside: boolean) => {
    if (!profile) return;
    setBusy(true);
    const result = await checkPassword(password);
    if (!result.ok) {
      setBusy(false);
      setErrors({
        password:
          result.problem ??
          (aside ? t("Enter the account password to set this profile aside.") : t("Enter the account password to bring this profile back.")),
      });
      focusFirstError();
      return;
    }
    try {
      await household.setAside(profile, aside, password);
      onDone();
    } catch (err) {
      setErrors({ form: err instanceof AccountError ? err.message : t("We couldn't change the profile. Try again.") });
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!profile) return;
    setBusy(true);
    const result = await checkPassword(password);
    if (!result.ok) {
      setBusy(false);
      setErrors({ password: result.problem ?? t("Enter the account password to delete this profile.") });
      focusFirstError();
      return;
    }
    try {
      await household.remove(profile, password);
      onDone();
    } catch (err) {
      setErrors({ form: err instanceof AccountError ? err.message : t("We couldn't delete the profile. Try again.") });
      setBusy(false);
    }
  };

  return (
    <form ref={formRef} className="profile-form" noValidate onSubmit={save}>
      <Field
        label={t("Name")}
        maxLength={PROFILE_NAME_MAX}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={errors.name}
        autoComplete="off"
      />

      <fieldset className="form-group">
        <legend className="field-label">{t("Avatar")}</legend>
        <div className="avatar-picker">
          {avatarPalette.map((_, i) => (
            <label key={i} className="avatar-option">
              <input type="radio" name="avatar" checked={avatar === i} onChange={() => setAvatar(i)} />
              <Avatar name={name || "?"} avatar={i} size={44} />
              <span className="visually-hidden">{t("Color {n}", { n: i + 1 })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-group">
        <legend className="field-label">{t("Age rating")}</legend>
        <div className="rating-options">
          {(Object.keys(ageRatingDetails) as AgeRating[]).map((r) => (
            <label key={r} className="rating-option">
              <input type="radio" name="age-rating" checked={rating === r} onChange={() => setRating(r)} />
              <span>
                <strong>{ratingText(t, r).label}</strong>
                <small>{ratingText(t, r).description}</small>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {needsConsent && (
        <div className="consent-box">
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-invalid={errors.consent ? true : undefined}
              aria-describedby={errors.consent ? "consent-error" : undefined}
            />
            <span>
              {rich(
                t(
                  "I'm this child's parent or guardian, and I agree that LiteraryWorm may collect their reading progress, lists, ratings and screen time as described in the {link}. I can review, delete or stop this at any time.",
                ),
                {
                  link: (
                    <Link to="/legal/childrens-privacy" target="_blank">
                      {t("Children's Privacy Notice")}
                    </Link>
                  ),
                },
              )}
            </span>
          </label>
          {errors.consent && (
            <p className="field-error" id="consent-error">
              <Icon name="alert" size={15} />
              {errors.consent}
            </p>
          )}
        </div>
      )}

      <fieldset className="form-group">
        <legend className="field-label">{t("Favorite genres")}</legend>
        <p className="field-hint genre-hint">{t("Used to start this profile's recommendations, and up to two of them get their own row on Home.")}</p>
        <div className="chip-group">
          {browseGenres.map(({ label: g }) => (
            <label key={g} className="chip">
              <input type="checkbox" checked={genres.includes(g)} onChange={() => toggleGenre(g)} />
              <span>
                {genres.includes(g) && <Icon name="check" size={14} />}
                {t(g)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="form-group protected-group">
        <legend className="field-label">
          <Icon name="lock" size={15} /> {t("Locks and limits")}
        </legend>
        <label className="switch-row">
          <span>
            <strong>{t("Lock with a PIN")}</strong>
            <small>{t("Asks for a {n}-digit PIN before this profile opens.", { n: PIN_LENGTH })}</small>
          </span>
          <input type="checkbox" role="switch" className="switch" checked={pinOn} onChange={(e) => setPinOn(e.target.checked)} />
        </label>
        {pinOn && (
          <Field
            label={profile?.hasPin ? t("New PIN (leave blank to keep the current one)") : t("PIN")}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={PIN_LENGTH}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH))}
            error={errors.pin}
            className="pin-field"
          />
        )}
        <div className="field">
          <label className="field-label" htmlFor="daily-limit">
            {t("Daily reading and listening limit")}
          </label>
          <select
            id="daily-limit"
            className="field-input"
            value={limit ?? ""}
            onChange={(e) => setLimit(e.target.value ? Number(e.target.value) : null)}
          >
            {dailyLimitOptions.map((o) => (
              <option key={o.label} value={o.value ?? ""}>
                {o.value === null ? t("No limit") : durationLabel(o.value)}
              </option>
            ))}
          </select>
          <p className="field-hint">{t("Reading and listening stop when the time is used up. The account password allows 30 more minutes.")}</p>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="listen-share">
            {t("Share of the household's audiobook hours")}
          </label>
          <select id="listen-share" className="field-input" value={listenShare ?? ""} aria-describedby="share-hint" onChange={(e) => setListenShare(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t("No share of its own")}</option>
            {LISTENING_SHARES.map((m) => (
              <option key={m} value={m}>
                {t("{duration} a month", { duration: durationLabel(m) })}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="voice-share">
            {t("Share of the household's natural-voice reading")}
          </label>
          <select id="voice-share" className="field-input" value={voiceShare ?? ""} aria-describedby="share-hint" onChange={(e) => setVoiceShare(e.target.value ? Number(e.target.value) : null)}>
            <option value="">{t("No share of its own")}</option>
            {VOICE_SHARES.map((m) => (
              <option key={m} value={m}>
                {t("{duration} a month", { duration: durationLabel(m) })}
              </option>
            ))}
          </select>
          <p className="field-hint" id="share-hint">
            {t("A profile with a share stops when it's used, even if the household has hours left. Account → Family shows what each profile has used.")}
          </p>
        </div>
        {rating === "kids" && (
          <label className="switch-row">
            <span>
              <strong>{t("Natural voices for their uploads")}</strong>
              <small id="kids-voices-hint">
                {t("Books this profile uploads can be read aloud by Google's natural voices, using the household's hours. Off until a grown-up turns it on.")}
              </small>
            </span>
            <input
              type="checkbox"
              role="switch"
              className="switch"
              aria-describedby="kids-voices-hint"
              checked={kidsVoices}
              onChange={(e) => setKidsVoices(e.target.checked)}
            />
          </label>
        )}
        {rating === "kids" && (
          <div className="field">
            <label className="field-label" htmlFor="weekly-goal">
              {t("Weekly reading goal")}
            </label>
            <select
              id="weekly-goal"
              className="field-input"
              value={weeklyGoal ?? ""}
              aria-describedby="weekly-goal-hint"
              onChange={(e) => setWeeklyGoal(e.target.value ? Number(e.target.value) : null)}
            >
              {weeklyGoalOptions.map((o) => (
                <option key={o.label} value={o.value ?? ""}>
                  {o.value === null ? t("No weekly goal") : t("{duration} a week", { duration: durationLabel(o.value) })}
                </option>
              ))}
            </select>
            <p className="field-hint" id="weekly-goal-hint">
              {name.trim()
                ? t("Reading and listening over the last 7 days. {name} can see how close they are in Goals, and you can in Account → Family.", { name: name.trim() })
                : t("Reading and listening over the last 7 days. They can see how close they are in Goals, and you can in Account → Family.")}
            </p>
          </div>
        )}
        {rating === "kids" && (
          <div className="field">
            <label className="field-label" htmlFor="bedtime">
              {t("Bedtime")}
            </label>
            <select
              id="bedtime"
              className="field-input"
              value={bedtimeChoice ?? ""}
              aria-describedby="bedtime-hint"
              onChange={(e) => setBedtimeChoice(e.target.value || null)}
            >
              <option value="">{t("No bedtime")}</option>
              {BEDTIME_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {timeLabel(time)}
                </option>
              ))}
            </select>
            <p className="field-hint" id="bedtime-hint">
              {t("From bedtime until morning, books and audiobooks show Time for bed, on this device's clock. The account password allows {n} more minutes.", { n: BEDTIME_EXTRA_MINUTES })}
            </p>
          </div>
        )}
        {bedtime && (
          <div className="field">
            <label className="field-label" htmlFor="wake-time">
              {t("Reading again from")}
            </label>
            <select id="wake-time" className="field-input" value={wakeChoice} onChange={(e) => setWakeChoice(e.target.value)}>
              {WAKE_OPTIONS.map((time) => (
                <option key={time} value={time}>
                  {timeLabel(time)}
                </option>
              ))}
            </select>
          </div>
        )}
      </fieldset>

      {needsPassword && (
        <div className="password-gate">
          <AccountPasswordField value={password} onChange={setPassword} error={errors.password} />
        </div>
      )}

      {errors.form && (
        <div className="form-alert" role="alert">
          <Icon name="alert" size={17} />
          <p>{errors.form}</p>
        </div>
      )}

      {confirmDelete ? (
        <div className="delete-confirm" role="group" aria-label={t("Delete profile")}>
          <p>
            {rich(t("Delete {name}? Their lists, history and settings will be removed. The account and other profiles aren't affected."), {
              name: <strong>{profile?.name}</strong>,
            })}
          </p>
          <div className="modal-actions">
            <button type="button" className="danger-button" onClick={remove} disabled={busy}>
              <Icon name="trash" size={16} /> {busy ? t("Deleting…") : t("Delete profile")}
            </button>
            <button type="button" className="ghost-button" onClick={() => setConfirm(null)}>
              {t("Keep profile")}
            </button>
          </div>
        </div>
      ) : confirm === "aside" || confirm === "back" ? (
        <div className="delete-confirm" role="group" aria-label={confirm === "aside" ? t("Set profile aside") : t("Bring profile back")}>
          <p>
            {confirm === "aside" ? (
              rich(
                t(
                  "Set {name} aside? Their shelf, history and settings stay, but nobody can choose the profile and it doesn't count towards your plan until you bring it back.",
                ),
                { name: <strong>{profile?.name}</strong> },
              )
            ) : (
              rich(t("Bring {name} back? It counts towards your plan again."), { name: <strong>{profile?.name}</strong> })
            )}
          </p>
          <div className="modal-actions">
            <button type="button" className="primary-button" onClick={() => void moveAside(confirm === "aside")} disabled={busy}>
              {busy ? t("Saving…") : confirm === "aside" ? t("Set aside") : t("Bring back")}
            </button>
            <button type="button" className="ghost-button" onClick={() => setConfirm(null)}>
              {t("Cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="modal-actions">
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? t("Saving…") : isNew ? t("Add profile") : t("Save changes")}
          </button>
          {profile?.setAside && (
            <button type="button" className="secondary-button" onClick={() => setConfirm("back")}>
              {t("Bring back")}
            </button>
          )}
          {canSetAside && (
            <button type="button" className="ghost-button" onClick={() => setConfirm("aside")}>
              {t("Set aside")}
            </button>
          )}
          {!isNew && inUseOthers.length > 0 && (
            <button type="button" className="ghost-button danger-text" onClick={() => setConfirm("delete")}>
              {t("Delete profile")}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
