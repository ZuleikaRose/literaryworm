import { type FormEvent, type ReactNode, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AccountPasswordField } from "../components/AccountPasswordField";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Dialog";
import { Field } from "../components/Field";
import { GrownUpDialog } from "../components/GrownUpDialog";
import { Icon } from "../components/Icon";
import { PasswordField } from "../components/PasswordField";
import { formatPrice, planById } from "../data/plans";
import { AccountError, type MembershipAction } from "../lib/accountApi";
import { endDate, longDate, nextBillingDate, ordinal } from "../lib/billing";
import { ageRatingDetails, dailyLimitOptions } from "../lib/profiles";
import { useAccount } from "../lib/useAccount";
import { useTitle } from "../lib/useTitle";
import { validateNewPassword } from "../lib/validation";
import { useActiveProfile, useStore } from "../store/context";
import type { Account as AccountDetails } from "../types";

const DISPLAY_NAME_MAX = 60;

/** Runs a save and keeps its error and success message next to the control. */
function useAttempt() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  async function attempt(work: () => Promise<void>, success?: string): Promise<boolean> {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      await work();
      if (success) setDone(success);
      return true;
    } catch (err) {
      setError(err instanceof AccountError ? err.message : "Something went wrong. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, done, attempt, setError };
}

function Feedback({ error, done }: { error: string | null; done: string | null }) {
  if (error)
    return (
      <div className="form-alert" role="alert">
        <Icon name="alert" size={17} />
        <p>{error}</p>
      </div>
    );
  if (done)
    return (
      <div className="form-success" role="status">
        <Icon name="check" size={17} />
        <p>{done}</p>
      </div>
    );
  return null;
}

function Section({ id, title, intro, children, className }: { id: string; title: string; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`account-section${className ? ` ${className}` : ""}`} aria-labelledby={`${id}-title`}>
      <div className="account-section-heading">
        <h2 id={`${id}-title`}>{title}</h2>
        {intro && <p>{intro}</p>}
      </div>
      <div className="account-section-body">{children}</div>
    </section>
  );
}

const SECTIONS = [
  ["plan", "Plan and billing"],
  ["sign-in", "Sign-in"],
  ["preferences", "Preferences"],
  ["family", "Family"],
  ["privacy", "Privacy"],
  ["help", "Help"],
  ["delete", "Delete account"],
] as const;

export default function Account() {
  useTitle("Account");
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [grownUpOk, setGrownUpOk] = useState(false);
  const { account } = useAccount();

  // Kids profiles need the account password before anything here shows.
  if (profile?.ageRating === "kids" && !grownUpOk) {
    return (
      <section className="page account-page">
        <h1>Account</h1>
        <p className="account-sub">A grown-up needs to open this page.</p>
        <GrownUpDialog open onClose={() => navigate("/browse")} onConfirmed={() => setGrownUpOk(true)} action="open Account" />
      </section>
    );
  }
  if (!account) return null;

  return (
    <div className="page account-page">
      <h1>Account</h1>
      <p className="account-sub">
        {account.email}
        {account.isDemo && " · Demo household: changes here last until you refresh the page."}
      </p>
      <nav className="account-nav" aria-label="Account sections">
        <ul>
          {SECTIONS.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{label}</a>
            </li>
          ))}
        </ul>
      </nav>
      <PlanSection account={account} />
      <SignInSection account={account} />
      <PreferencesSection account={account} />
      <FamilySection />
      <PrivacySection />
      <Section id="help" title="Help">
        <ul className="account-links">
          <li>
            <Link to="/legal/help">Help Center</Link>
          </li>
          <li>
            <Link to="/legal/status">Service status</Link>
          </li>
          <li>
            <Link to="/legal/accessibility">Accessibility Policy</Link>
          </li>
          <li>
            <Link to="/legal/terms">Terms of Service</Link>
          </li>
        </ul>
      </Section>
      <DeleteSection account={account} />
    </div>
  );
}

// --- Plan and billing ----------------------------------------------------------

function PlanSection({ account }: { account: AccountDetails }) {
  const { changeMembership } = useAccount();
  const { busy, error, done, attempt } = useAttempt();
  const [confirming, setConfirming] = useState<MembershipAction | null>(null);
  const plan = account.planId ? planById.get(account.planId) : undefined;
  const nextCharge = account.billingDay ? longDate(nextBillingDate(account.billingDay)) : null;
  const endsOn = account.endsAt ? endDate(account.endsAt) : null;

  const run = async (action: MembershipAction) => {
    setConfirming(null);
    const messages: Record<MembershipAction, string> = {
      pause: "Your membership is paused. Nothing is charged until you resume.",
      resume: "Welcome back. Your membership is active again.",
      cancel: `Your membership is cancelled. You can keep reading until ${nextCharge}.`,
      restart: "Your membership will carry on as before.",
    };
    await attempt(() => changeMembership(action), messages[action]);
  };

  if (!plan) {
    return (
      <Section id="plan" title="Plan and billing">
        <p>You haven't chosen a plan yet.</p>
        <Link className="primary-button" to="/plans?setup=1">
          Choose a plan
        </Link>
      </Section>
    );
  }

  const statusText =
    account.status === "paused" ? "Paused" : endsOn ? `Cancelled: ends ${endsOn}` : account.status === "cancelled" ? "Ended" : "Active";

  return (
    <Section id="plan" title="Plan and billing" intro="Change, pause or cancel online at any time. No phone call needed.">
      <dl className="account-facts">
        <div>
          <dt>Plan</dt>
          <dd>
            {plan.name} · {formatPrice(plan.price)} a month
          </dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={`status-pill status-${account.status === "paused" ? "paused" : endsOn ? "ending" : "active"}`}>{statusText}</span>
          </dd>
        </div>
        <div>
          <dt>Next charge</dt>
          <dd>
            {account.status === "paused"
              ? "None while paused"
              : endsOn
                ? "None: the plan ends instead"
                : `${formatPrice(plan.price)} on ${nextCharge}`}
          </dd>
        </div>
        <div>
          <dt>Billing day</dt>
          <dd>The {ordinal(account.billingDay ?? 1)} of each month</dd>
        </div>
      </dl>
      {account.isDemo && <p className="field-hint">The demo can't take payments, so no card is on file.</p>}

      <div className="account-actions">
        <Link className="secondary-button" to="/plans">
          Change plan
        </Link>
        {account.status === "paused" ? (
          <button type="button" className="primary-button" disabled={busy} onClick={() => run("resume")}>
            Resume membership
          </button>
        ) : (
          !endsOn && (
            <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming("pause")}>
              Pause membership
            </button>
          )
        )}
        {endsOn ? (
          <button type="button" className="primary-button" disabled={busy} onClick={() => run("restart")}>
            Keep my membership
          </button>
        ) : (
          account.status !== "paused" && (
            <button type="button" className="ghost-button danger-text" disabled={busy} onClick={() => setConfirming("cancel")}>
              Cancel membership
            </button>
          )
        )}
      </div>
      <Feedback error={error} done={done} />

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        size="sm"
        title={confirming === "cancel" ? "Cancel your membership?" : "Pause your membership?"}
        description={
          <p>
            {confirming === "cancel"
              ? `You can keep reading and listening until ${nextCharge}, and you won't be charged again. You can change your mind any time before then.`
              : "Reading and listening stop, and nothing is charged until you resume. Your library, profiles and progress stay as they are."}
          </p>
        }
      >
        <div className="modal-actions">
          <button
            type="button"
            className={confirming === "cancel" ? "danger-button" : "primary-button"}
            onClick={() => confirming && run(confirming)}
          >
            {confirming === "cancel" ? "Cancel membership" : "Pause membership"}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(null)}>
            {confirming === "cancel" ? "Keep membership" : "Not now"}
          </button>
        </div>
      </Dialog>
    </Section>
  );
}

// --- Sign-in ---------------------------------------------------------------------

function SignInSection({ account }: { account: AccountDetails }) {
  const { setDisplayName, changePassword } = useAccount();
  const name = useAttempt();
  const password = useAttempt();
  const [displayName, setName] = useState(account.name);
  const [nameError, setNameError] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [nextError, setNextError] = useState<string | null>(null);
  const nextRef = useRef<HTMLInputElement>(null);

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const v = displayName.trim();
    const problem = !v ? "Enter a display name." : v.length > DISPLAY_NAME_MAX ? `Use ${DISPLAY_NAME_MAX} characters or fewer.` : null;
    setNameError(problem);
    if (problem) return;
    await name.attempt(() => setDisplayName(v), "Display name saved. New and existing logs show it.");
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(next);
    setNextError(problem);
    if (problem) {
      nextRef.current?.focus();
      return;
    }
    const ok = await password.attempt(() => changePassword(current, next), "Password changed.");
    if (ok) {
      setCurrent("");
      setNext("");
    }
  };

  return (
    <Section id="sign-in" title="Sign-in">
      <form className="account-form" noValidate onSubmit={saveName}>
        <Field
          label="Display name"
          hint="Shown on your reader logs instead of your email."
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          autoComplete="nickname"
        />
        <button type="submit" className="secondary-button" disabled={name.busy || displayName.trim() === account.name}>
          {name.busy ? "Saving…" : "Save display name"}
        </button>
        <Feedback error={name.error} done={name.done} />
      </form>

      <div className="account-fact-row">
        <span>Email</span>
        <strong>{account.email}</strong>
        <small>Changing your email address isn't available yet.</small>
      </div>

      <form className="account-form" noValidate onSubmit={savePassword}>
        <h3>Change password</h3>
        <PasswordField label="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordField
          ref={nextRef}
          label="New password"
          autoComplete="new-password"
          hint="15 to 64 characters. A short phrase works well."
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setNextError(null);
          }}
          error={nextError}
        />
        <button type="submit" className="secondary-button" disabled={password.busy || !current || !next}>
          {password.busy ? "Changing…" : "Change password"}
        </button>
        <Feedback error={password.error} done={password.done} />
      </form>
    </Section>
  );
}

// --- Preferences -------------------------------------------------------------------

function PreferencesSection({ account }: { account: AccountDetails }) {
  const { setMarketingEmails } = useAccount();
  const { busy, error, done, attempt } = useAttempt();
  const hintId = useId();
  return (
    <Section id="preferences" title="Preferences">
      <label className="switch-row">
        <span>
          <strong>Emails about new releases and offers</strong>
          <small id={hintId}>Service emails, like receipts and password resets, always arrive.</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={hintId}
          checked={account.marketingEmails}
          disabled={busy}
          onChange={(e) => {
            const on = e.target.checked;
            void attempt(() => setMarketingEmails(on), on ? "You'll get emails about new releases." : "No more marketing emails.");
          }}
        />
      </label>
      <Feedback error={error} done={done} />
      <p className="account-note">
        <Icon name="accessibility" size={18} /> Text size, theme, the easier-reading font, contrast and motion are in the
        accessibility menu at the top of every page.
      </p>
    </Section>
  );
}

// --- Family ---------------------------------------------------------------------------

function FamilySection() {
  const { state } = useStore();
  const limitLabel = (minutes: number | null) => dailyLimitOptions.find((o) => o.value === minutes)?.label ?? `${minutes} minutes`;
  return (
    <Section id="family" title="Family" intro="Profiles, Kids consent, PIN locks and daily limits.">
      <ul className="family-list">
        {state.profiles.map((p) => (
          <li key={p.id}>
            <Avatar name={p.name} avatar={p.avatar} size={40} />
            <span className="family-name">{p.name}</span>
            <span className="family-chips">
              <span className="chip-tag">{ageRatingDetails[p.ageRating].label}</span>
              {p.hasPin && (
                <span className="chip-tag">
                  <Icon name="lock" size={12} /> PIN
                </span>
              )}
              {p.dailyLimitMinutes !== null && (
                <span className="chip-tag">
                  <Icon name="clock" size={12} /> {limitLabel(p.dailyLimitMinutes)} a day
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Link className="secondary-button" to="/profiles?manage=1">
        Manage profiles
      </Link>
    </Section>
  );
}

// --- Privacy ----------------------------------------------------------------------------

function PrivacySection() {
  const { downloadData } = useAccount();
  const { busy, error, done, attempt } = useAttempt();
  return (
    <Section id="privacy" title="Privacy" intro="Your library, progress and bookmarks are private. Logs you publish are public, with your display name.">
      <button type="button" className="secondary-button" disabled={busy} onClick={() => attempt(downloadData, "Your data file is downloading.")}>
        <Icon name="download" size={17} /> {busy ? "Gathering your data…" : "Download my data"}
      </button>
      <p className="field-hint">A JSON file with your account details, profiles, library, reading progress, bookmarks, highlights and notes, and logs.</p>
      <Feedback error={error} done={done} />
      <ul className="account-links">
        <li>
          <Link to="/legal/privacy">Privacy Policy</Link>
        </li>
        <li>
          <Link to="/legal/childrens-privacy">Children's Privacy Notice</Link>
        </li>
        <li>
          <Link to="/legal/privacy-choices">Your Privacy Choices</Link>
        </li>
      </ul>
    </Section>
  );
}

// --- Delete account -----------------------------------------------------------------------

function DeleteSection({ account }: { account: AccountDetails }) {
  const { deleteAccount } = useAccount();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const { busy, error, attempt, setError } = useAttempt();
  const checkId = useId();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!understood) {
      setCheckError("Tick the box to confirm you understand this can't be undone.");
      return;
    }
    await attempt(() => deleteAccount(password));
  };

  return (
    <Section id="delete" title="Delete account" className="danger-zone">
      <p>
        Deleting the account cancels your plan and permanently removes your profiles, library, reading progress, bookmarks,
        highlights, notes and logs. It can't be undone.
      </p>
      {account.isDemo ? (
        <p className="field-hint">The demo household can't be deleted; it resets when you refresh the page.</p>
      ) : (
        <button type="button" className="danger-button" onClick={() => setOpen(true)}>
          <Icon name="trash" size={16} /> Delete account
        </button>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        size="sm"
        eyebrow="Delete account"
        title="Delete your LiteraryWorm account?"
        description={<p>Your plan is cancelled first, so you won't be charged again. Then everything is deleted for good.</p>}
      >
        <form noValidate onSubmit={submit} className="delete-form">
          <AccountPasswordField value={password} onChange={setPassword} error={error} />
          <label className="check-row">
            <input
              type="checkbox"
              checked={understood}
              aria-invalid={checkError ? true : undefined}
              aria-describedby={checkError ? checkId : undefined}
              onChange={(e) => {
                setUnderstood(e.target.checked);
                setCheckError(null);
              }}
            />
            <span>I understand my profiles, library, progress and logs will be deleted and can't be recovered.</span>
          </label>
          {checkError && (
            <p className="field-error" id={checkId}>
              <Icon name="alert" size={15} /> {checkError}
            </p>
          )}
          <div className="modal-actions">
            <button type="submit" className="danger-button" disabled={busy || !password}>
              {busy ? "Deleting…" : "Delete my account"}
            </button>
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
              Keep my account
            </button>
          </div>
        </form>
      </Dialog>
    </Section>
  );
}
