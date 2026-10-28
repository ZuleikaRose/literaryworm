import { useRef, useState, type FormEvent } from "react";
import { AccountError } from "../lib/accountApi";
import { lockMinutesLeft, MAX_PIN_ATTEMPTS, PIN_LENGTH, PIN_LOCK_MINUTES } from "../lib/profiles";
import { useCheckAccountPassword } from "../lib/useCheckAccountPassword";
import { useProfiles } from "../lib/useProfiles";
import { useStore } from "../store/context";
import type { Profile } from "../types";
import { AccountPasswordField } from "./AccountPasswordField";
import { Avatar } from "./Avatar";
import { Dialog } from "./Dialog";
import { Icon } from "./Icon";

interface PinDialogProps {
  profile: Profile | null;
  onClose: () => void;
  onUnlocked: (profile: Profile) => void;
}

/** Asks for a locked profile's PIN. The account password is the fallback, including during a lockout. */
export function PinDialog({ profile, onClose, onUnlocked }: PinDialogProps) {
  return (
    <Dialog open={Boolean(profile)} onClose={onClose} title={profile ? `Enter ${profile.name}'s PIN` : ""} size="sm">
      {/* Keyed so each opening starts with empty fields. */}
      {profile && <PinForm key={profile.id} profile={profile} onUnlocked={onUnlocked} />}
    </Dialog>
  );
}

function PinForm({ profile, onUnlocked }: { profile: Profile; onUnlocked: (profile: Profile) => void }) {
  const { state } = useStore();
  const household = useProfiles();
  const checkPassword = useCheckAccountPassword();
  const [busy, setBusy] = useState(false);
  // Read the live profile so attempts and lockouts update as they happen.
  const live = state.profiles.find((p) => p.id === profile.id) ?? profile;
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const pinRef = useRef<HTMLInputElement>(null);
  const minutesLeft = lockMinutesLeft(live);

  const submitPin = async (e: FormEvent) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) {
      setError(`Enter all ${PIN_LENGTH} digits.`);
      return;
    }
    setBusy(true);
    let result;
    try {
      result = await household.checkPin(live, pin);
    } catch (err) {
      setBusy(false);
      setError(err instanceof AccountError ? err.message : "We couldn't check the PIN. Try again.");
      return;
    }
    setBusy(false);
    if (result.ok) {
      onUnlocked(live);
      return;
    }
    setPin("");
    setError(
      result.locked
        ? null
        : `That PIN isn't right. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left before this profile locks for ${PIN_LOCK_MINUTES} minutes.`,
    );
    pinRef.current?.focus();
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    const result = await checkPassword(password);
    if (!result.ok) {
      setPasswordError(result.problem ?? "That isn't the account password.");
      return;
    }
    try {
      await household.unlock(live, password);
    } catch (err) {
      setPasswordError(err instanceof AccountError ? err.message : "We couldn't unlock the profile. Try again.");
      return;
    }
    onUnlocked(live);
  };

  return (
    <div className="pin-dialog">
      <div className="pin-profile">
        <Avatar name={live.name} avatar={live.avatar} size={56} />
        <Icon name="lock" size={16} className="pin-lock" />
      </div>

      {minutesLeft > 0 && !usePassword ? (
        <div className="form-alert" role="alert">
          <Icon name="clock" size={17} />
          <p>
            Too many wrong PINs. {live.name} is locked for {minutesLeft} more {minutesLeft === 1 ? "minute" : "minutes"}. The
            account holder can unlock it now with the account password.
          </p>
        </div>
      ) : (
        !usePassword && (
          <form noValidate onSubmit={submitPin}>
            <label className="field-label" htmlFor="pin-input">
              {PIN_LENGTH}-digit PIN
            </label>
            <input
              ref={pinRef}
              id="pin-input"
              className="field-input pin-input"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={pin}
              autoFocus
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "pin-error" : "pin-hint"}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH));
                setError(null);
              }}
            />
            {error ? (
              <p className="field-error" id="pin-error" role="alert">
                <Icon name="alert" size={15} />
                {error}
              </p>
            ) : (
              <p className="field-hint" id="pin-hint">
                After {MAX_PIN_ATTEMPTS} wrong tries the profile locks for {PIN_LOCK_MINUTES} minutes.
              </p>
            )}
            <button type="submit" className="primary-button modal-submit" disabled={busy}>
              {busy ? "Checking…" : `Open ${live.name}`}
            </button>
          </form>
        )
      )}

      {usePassword ? (
        <form noValidate onSubmit={submitPassword}>
          <AccountPasswordField value={password} onChange={setPassword} error={passwordError} />
          <button type="submit" className="primary-button modal-submit">
            Unlock {live.name}
          </button>
        </form>
      ) : (
        <button type="button" className="text-button pin-forgot" onClick={() => setUsePassword(true)}>
          Forgot the PIN? Use the account password
        </button>
      )}
    </div>
  );
}
