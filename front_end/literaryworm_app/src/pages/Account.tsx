import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AccountPasswordField } from "../components/AccountPasswordField";
import { BillingHistory } from "../components/BillingHistory";
import { Avatar } from "../components/Avatar";
import { Dialog } from "../components/Dialog";
import { Field } from "../components/Field";
import { PlanUsage } from "../components/PlanUsage";
import { GrownUpDialog } from "../components/GrownUpDialog";
import { InstallApp } from "../components/InstallApp";
import { RedeemGift } from "../components/RedeemGift";
import { TeamAccess } from "../components/TeamAccess";
import { useStaffRoles } from "../lib/useStaffRoles";
import { Icon } from "../components/Icon";
import { PasswordField } from "../components/PasswordField";
import { getBook } from "../data/books";
import { formatPrice, perPeriod, planById, priceFor } from "../data/plans";
import {
  AccountError,
  cancelTwoStep,
  changeBillingDay,
  choosePlan,
  finishTwoStep,
  type MembershipAction,
  paymentMethodUrl,
  startTwoStep,
  turnOffTwoStep,
  type TwoStepSetup,
  twoStepIsOn,
} from "../lib/accountApi";
import { CANCEL_NOTICE_HOURS, cancellationEnd, endDate, longDate, nextBillingDate, ordinal } from "../lib/billing";
import { readingTime } from "../lib/goals";
import { groupKids, kidGroup, type KidWeek, kidWeek, type WeeklyGoal, weeklyGoal } from "../lib/kidsReport";
import { ageRatingDetails, dailyLimitOptions } from "../lib/profiles";
import { today } from "../lib/reading";
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
  ["team", "Team access"],
  ["help", "Help"],
  ["delete", "Delete account"],
] as const;

export default function Account() {
  useTitle("Account");
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [grownUpOk, setGrownUpOk] = useState(false);
  const { account } = useAccount();
  const roles = useStaffRoles();

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
          {SECTIONS.filter(([id]) => id !== "team" || roles.length > 0).map(([id, label]) => (
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
      {roles.length > 0 && (
        <Section id="team" title="Team access" intro="Access to LiteraryWorm beyond being a member.">
          <TeamAccess roles={roles} />
        </Section>
      )}
      <Section id="help" title="Help">
        <ul className="account-links">
          <li>
            <Link to="/whats-new">What's new</Link>
          </li>
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

/** The plan a yearly membership moves to at renewal, while it's still set to renew. */
const yearlySwitch = (account: AccountDetails) =>
  account.billingInterval === "year" && account.switchToMonthly && !account.endsAt ? planById.get(account.switchToMonthly) : undefined;

function PlanSection({ account }: { account: AccountDetails }) {
  const { changeMembership } = useAccount();
  const { busy, error, done, attempt } = useAttempt();
  const [confirming, setConfirming] = useState<MembershipAction | null>(null);
  const { dispatch } = useStore();
  const [newDay, setNewDay] = useState(account.billingDay ?? 1);
  const plan = account.planId ? planById.get(account.planId) : undefined;
  // Real (not demo) accounts are billed through Stripe; one without a card yet adds it through Checkout.
  const billed = Boolean(account.userId) && !account.isDemo;

  const openPaymentPage = () =>
    attempt(async () => {
      window.location.assign(await paymentMethodUrl());
    });
  // A yearly membership moving to monthly billing at renewal, and what it moves to.
  const switchPlan = yearlySwitch(account);
  const keepYearly = () =>
    attempt(async () => {
      await choosePlan(account.planId!, account.billingDay ?? 1, false, "year");
      dispatch({ type: "updateAccount", patch: { switchToMonthly: null } });
    }, "You'll stay on yearly billing. Your membership renews for another year as before.");
  const addPaymentMethod = () =>
    attempt(async () => {
      const { url } = await choosePlan(account.planId!, account.billingDay ?? Math.min(new Date().getDate(), 28), false, account.billingInterval);
      if (url) window.location.assign(url);
    });
  const saveBillingDay = (e: FormEvent) => {
    e.preventDefault();
    void attempt(async () => {
      dispatch({ type: "updateAccount", patch: await changeBillingDay(newDay) });
    }, `Your billing day is now the ${ordinal(newDay)}. The days until your next charge are free.`);
  };
  const yearly = account.billingInterval === "year";
  // During a gift's free months, the first charge is when they end; a year renews on its own date.
  const nextChargeDate = account.giftUntil
    ? new Date(account.giftUntil)
    : yearly && account.renewsAt
      ? new Date(account.renewsAt)
      : account.billingDay
        ? nextBillingDate(account.billingDay)
        : null;
  const nextCharge = account.giftUntil || (yearly && account.renewsAt)
    ? endDate(account.giftUntil ?? account.renewsAt!)
    : nextChargeDate
      ? longDate(nextChargeDate)
      : null;
  const endsOn = account.endsAt ? endDate(account.endsAt) : null;
  // Cancelled with under 48 hours' notice: the next charge still goes through, and the plan ends a period later.
  const chargeBeforeEnd = Boolean(endsOn && nextCharge && endsOn !== nextCharge);
  // What cancelling now would do (the manage-account function applies the same rule).
  const cancelling = nextChargeDate ? cancellationEnd(nextChargeDate, undefined, account.billingInterval) : null;
  const cancelLate = Boolean(cancelling?.late);
  const cancelEnds = cancelling ? longDate(cancelling.ends) : nextCharge;

  const run = async (action: MembershipAction) => {
    setConfirming(null);
    const messages: Record<MembershipAction, string> = {
      pause: "Your membership is paused. Nothing is charged until you resume.",
      resume: "Welcome back. Your membership is active again.",
      cancel: cancelLate
        ? `Your membership is cancelled. The charge on ${nextCharge} still goes through, and you can keep reading until ${cancelEnds}.`
        : `Your membership is cancelled. You can keep reading until ${nextCharge}.`,
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
        {billed && <RedeemGift account={account} />}
      </Section>
    );
  }

  if (account.complimentary) {
    return (
      <Section id="plan" title="Plan and billing" intro="Staff accounts have a complimentary membership while they're on the team. They're never charged.">
        <dl className="account-facts">
          <div>
            <dt>Plan</dt>
            <dd>{plan.name}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="status-pill status-active">Complimentary</span>
            </dd>
          </div>
          <div>
            <dt>Next charge</dt>
            <dd>None. Staff accounts aren't billed.</dd>
          </div>
        </dl>
        <p className="field-hint">When your last staff role is removed, the complimentary membership ends and a plan can be chosen then.</p>
        <PlanUsage planId={plan.id} />
      </Section>
    );
  }

  const price = formatPrice(priceFor(plan, account.billingInterval));
  const statusText = account.pastDue
    ? "Payment failed"
    : account.status === "paused"
      ? "Paused"
      : endsOn
        ? `Cancelled: ends ${endsOn}`
        : account.status === "cancelled"
          ? "Ended"
          : "Active";

  return (
    <Section id="plan" title="Plan and billing" intro="Change, pause or cancel online at any time. No phone call needed.">
      <dl className="account-facts">
        <div>
          <dt>Plan</dt>
          <dd>
            {plan.name} · {price} {perPeriod(account.billingInterval)}
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
                ? chargeBeforeEnd
                  ? `${price} on ${nextCharge}, then the plan ends on ${endsOn}`
                  : "None: the plan ends instead"
                : account.giftUntil
                  ? `None until ${nextCharge}: a gift. Then ${price} if a card is on file; without one, the membership ends that day.`
                  : switchPlan
                    ? `${formatPrice(switchPlan.price)} on ${nextCharge}, the first monthly charge`
                    : `${price} on ${nextCharge}`}
          </dd>
        </div>
        <div>
          <dt>{yearly ? "Billing" : "Billing day"}</dt>
          <dd>
            {switchPlan
              ? `Yearly until ${nextCharge}, then monthly: ${switchPlan.name} at ${formatPrice(switchPlan.price)} a month, on that day each month`
              : yearly
                ? `Yearly, renewing on ${nextCharge ?? "the date your year started"}`
                : `The ${ordinal(account.billingDay ?? 1)} of each month`}
          </dd>
        </div>
      </dl>
      <p className="field-hint cancel-notice">
        Cancel at least {CANCEL_NOTICE_HOURS} hours before your next billing date to stop the next charge. Cancelling later still
        ends your membership, but after one more {yearly ? "year" : "month"}. No refunds.
      </p>
      {!yearly && billed && account.stripeLinked && account.status === "active" && !endsOn && (
        <p className="field-hint">
          <Link to="/plans?billing=yearly">Pay yearly instead</Link>: {formatPrice(plan.yearlyPrice)} a year, so two months are free.
        </p>
      )}
      {switchPlan && (
        <p className="field-hint">
          You chose monthly billing from your renewal date. Changed your mind?{" "}
          <button type="button" className="text-button" disabled={busy} onClick={keepYearly}>
            Keep yearly billing
          </button>
        </p>
      )}
      {yearly && !switchPlan && billed && account.stripeLinked && account.status === "active" && !endsOn && (
        <p className="field-hint">
          <Link to="/plans?billing=monthly">Pay monthly instead</Link> from your renewal date. Nothing changes until then.
        </p>
      )}
      {account.isDemo && <p className="field-hint">The demo can't take payments, so no card is on file.</p>}

      {billed && !account.stripeLinked && (
        <div className="form-alert">
          <Icon name="alert" size={17} />
          <div>
            <p>
              This is a live account: you'll be billed {yearly ? "yearly" : "monthly"} until you cancel. Add a payment method to continue your
              membership.
            </p>
            <button type="button" className="primary-button" disabled={busy} onClick={addPaymentMethod}>
              Add a payment method
            </button>
          </div>
        </div>
      )}
      {billed && account.pastDue && (
        <div className="form-alert">
          <Icon name="alert" size={17} />
          <p>Your last payment didn't go through. Update your payment method to keep reading and listening.</p>
        </div>
      )}

      {billed && account.stripeLinked && account.status === "active" && !endsOn && !account.giftUntil && !yearly && (
        <form className="billing-day-form" onSubmit={saveBillingDay}>
          <div className="field">
            <label className="field-label" htmlFor="new-billing-day">
              Change billing day
            </label>
            <select id="new-billing-day" className="field-input" value={newDay} onChange={(e) => setNewDay(Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  The {ordinal(d)} of each month
                </option>
              ))}
            </select>
            <p className="field-hint">Nothing is charged twice: the days until your new billing day are free.</p>
          </div>
          <button type="submit" className="secondary-button" disabled={busy || newDay === account.billingDay}>
            Save billing day
          </button>
        </form>
      )}

      <div className="account-actions">
        {billed && account.stripeLinked && (
          <button type="button" className="secondary-button" disabled={busy} onClick={openPaymentPage}>
            Update payment method
          </button>
        )}
        <Link className="secondary-button" to="/plans">
          Change plan
        </Link>
        {billed && (
          <Link className="secondary-button" to="/gifts">
            Give a gift
          </Link>
        )}
        {account.status === "paused" ? (
          <button type="button" className="primary-button" disabled={busy} onClick={() => run("resume")}>
            Resume membership
          </button>
        ) : (
          !endsOn && !yearly && (
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

      {billed && <RedeemGift account={account} />}

      <PlanUsage planId={plan.id} />
      {billed && account.stripeLinked && <BillingHistory canRedeem={account.status !== "cancelled"} monthlyPrice={price} interval={account.billingInterval} />}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        size="sm"
        title={confirming === "cancel" ? "Cancel your membership?" : "Pause your membership?"}
        description={
          <p>
            {confirming === "cancel"
              ? cancelLate
                ? `It's less than ${CANCEL_NOTICE_HOURS} hours until your next billing date, so the charge on ${nextCharge} still goes through. You can keep reading and listening until ${cancelEnds}, with no charges after that. No refunds. You can change your mind any time before then.`
                : `You can keep reading and listening until ${nextCharge}, and you won't be charged again. No refunds. You can change your mind any time before then.`
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

      <TwoStepSignIn account={account} />
    </Section>
  );
}

/** Groups the set-up key in fours so it's easier to type into an app. */
const groupKey = (key: string) => key.replace(/(.{4})/g, "$1 ").trim();

function TwoStepSignIn({ account }: { account: AccountDetails }) {
  const { remote } = useAccount();
  const [on, setOn] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setup, setSetup] = useState<TwoStepSetup | null>(null);
  const [setupOpen, setSetupOpen] = useState(false);
  const [offOpen, setOffOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [offCode, setOffCode] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const start = useAttempt();
  const turnOff = useAttempt();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!remote) return;
    let live = true;
    twoStepIsOn().then(
      (value) => live && setOn(value),
      () => live && setLoadError("We couldn't check your two-step sign-in. Refresh the page to try again."),
    );
    return () => {
      live = false;
    };
  }, [remote]);

  if (!remote) {
    return (
      <div className="account-form">
        <h3>Two-step sign-in</h3>
        <p className="field-hint">
          {account.isDemo ? "The demo household can't turn on two-step sign-in." : "Two-step sign-in needs a LiteraryWorm account."}
        </p>
      </div>
    );
  }

  const openSetup = async () => {
    setNotice(null);
    setCode("");
    setCodeError(null);
    setSetupOpen(true);
    await start.attempt(async () => setSetup(await startTwoStep()));
  };

  const closeSetup = () => {
    setSetupOpen(false);
    // An unfinished set-up changes nothing; tidy it away (the next set-up clears it if this fails).
    if (setup) cancelTwoStep(setup.factorId).catch((err: Error) => console.error("two-step:", err.message));
    setSetup(null);
  };

  const confirmCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!setup) return;
    const digits = code.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) {
      setCodeError("Enter the 6-digit code from your authenticator app.");
      codeRef.current?.focus();
      return;
    }
    setCodeError(null);
    const ok = await start.attempt(() => finishTwoStep(setup.factorId, digits));
    if (ok) {
      setSetup(null);
      setSetupOpen(false);
      setOn(true);
      setNotice("Two-step sign-in is on. You'll enter a code from the app each time you log in.");
    } else {
      codeRef.current?.focus();
    }
  };

  const confirmOff = async (e: FormEvent) => {
    e.preventDefault();
    const digits = offCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) {
      turnOff.setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    const ok = await turnOff.attempt(() => turnOffTwoStep(digits));
    if (ok) {
      setOffOpen(false);
      setOffCode("");
      setOn(false);
      setNotice("Two-step sign-in is off. Your password alone logs you in.");
    }
  };

  return (
    <div className="account-form">
      <h3>Two-step sign-in</h3>
      <p className="field-hint">
        After your password, enter a code from an authenticator app on your phone (such as Google Authenticator, Microsoft
        Authenticator or 1Password), so your password alone can't open your account.
      </p>
      {on !== null && (
        <div className="account-fact-row">
          <span>Status</span>
          <strong>{on ? "On" : "Off"}</strong>
        </div>
      )}
      {on === false && (
        <button type="button" className="secondary-button" onClick={openSetup}>
          Turn on two-step sign-in
        </button>
      )}
      {on && (
        <button type="button" className="secondary-button" onClick={() => setOffOpen(true)}>
          Turn off two-step sign-in
        </button>
      )}
      <Feedback error={loadError} done={notice} />

      <Dialog
        open={setupOpen}
        onClose={closeSetup}
        size="sm"
        eyebrow="Two-step sign-in"
        title="Set up your authenticator app"
        description={<p>Scan the QR code with the app, then enter the 6-digit code it shows.</p>}
      >
        {!setup ? (
          start.error ? <Feedback error={start.error} done={null} /> : <p aria-busy="true">Getting your QR code…</p>
        ) : (
          <form noValidate onSubmit={confirmCode} className="two-step-form">
            <img className="two-step-qr" src={setup.qrCode} width={180} height={180} alt="QR code to add LiteraryWorm to your authenticator app" />
            <p className="field-hint">
              Can't scan it? Choose to enter a key in the app, and type: <code className="two-step-key">{groupKey(setup.key)}</code>
            </p>
            <Field
              ref={codeRef}
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              error={codeError ?? start.error}
            />
            <div className="modal-actions">
              <button type="submit" className="primary-button" disabled={start.busy}>
                {start.busy ? "Checking…" : "Turn on"}
              </button>
              <button type="button" className="secondary-button" onClick={closeSetup}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={offOpen}
        onClose={() => {
          setOffOpen(false);
          turnOff.setError(null);
        }}
        size="sm"
        eyebrow="Two-step sign-in"
        title="Turn off two-step sign-in?"
        description={<p>Enter a current code from your authenticator app. Your password alone will then log you in. You can turn it back on at any time.</p>}
      >
        <form noValidate onSubmit={confirmOff} className="two-step-form">
          <Field
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            value={offCode}
            onChange={(e) => {
              setOffCode(e.target.value);
              turnOff.setError(null);
            }}
            error={turnOff.error}
          />
          <div className="modal-actions">
            <button type="submit" className="danger-button" disabled={turnOff.busy}>
              {turnOff.busy ? "Turning off…" : "Turn off"}
            </button>
            <button type="button" className="secondary-button" onClick={() => setOffOpen(false)}>
              Keep it on
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// --- Preferences -------------------------------------------------------------------

function PreferencesSection({ account }: { account: AccountDetails }) {
  const { remote, setMarketingEmails, setReleaseEmails, setAuthorEmails, setUpdateEmails, setClubMeetingEmails } = useAccount();
  const { busy, error, done, attempt } = useAttempt();
  const hintId = useId();
  const releaseHintId = useId();
  const authorHintId = useId();
  const updateHintId = useId();
  const clubHintId = useId();
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
      <label className="switch-row">
        <span>
          <strong>Email me when a book I'm waiting for comes out</strong>
          <small id={releaseHintId}>
            {remote
              ? "For books any profile set Remind me on. It's on Home on the day either way."
              : "The demo doesn't send emails. Members get one on the day, as well as the Home card."}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={releaseHintId}
          checked={account.releaseEmails}
          disabled={busy}
          onChange={(e) => {
            const on = e.target.checked;
            void attempt(
              () => setReleaseEmails(on),
              on ? "We'll email you when a book you're waiting for comes out." : "No more emails about reminded books.",
            );
          }}
        />
      </label>
      <label className="switch-row">
        <span>
          <strong>Email me new books from authors I follow</strong>
          <small id={authorHintId}>
            {remote
              ? "Once a week, when an author any profile follows has a new book. They're in the bell either way."
              : "The demo doesn't send emails. Members get a weekly email of new books from the authors they follow."}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={authorHintId}
          checked={account.authorEmails}
          disabled={busy}
          onChange={(e) => {
            const on = e.target.checked;
            void attempt(
              () => setAuthorEmails(on),
              on ? "We'll email you once a week about new books from authors you follow." : "No more emails about authors you follow.",
            );
          }}
        />
      </label>
      <label className="switch-row">
        <span>
          <strong>Email me a monthly round-up of what's new</strong>
          <small id={updateHintId}>
            {remote ? (
              <>
                The biggest changes to LiteraryWorm, once a month. Everything is on <Link to="/whats-new">What's new</Link> either way.
              </>
            ) : (
              "The demo doesn't send emails. Members can get the biggest changes once a month."
            )}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={updateHintId}
          checked={account.updateEmails}
          disabled={busy}
          onChange={(e) => {
            const on = e.target.checked;
            void attempt(
              () => setUpdateEmails(on),
              on ? "We'll email you the biggest changes once a month." : "No more monthly round-ups.",
            );
          }}
        />
      </label>
      <label className="switch-row">
        <span>
          <strong>Email me the day before a book club meets</strong>
          <small id={clubHintId}>
            {remote
              ? "For meetings in any club you're in, and when one moves or is cancelled. The club page lists them, with Add to calendar."
              : "The demo doesn't send emails. Members get a reminder the day before each club meeting, and an email when one moves or is cancelled."}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={clubHintId}
          checked={account.clubMeetingEmails}
          disabled={busy}
          onChange={(e) => {
            const on = e.target.checked;
            void attempt(
              () => setClubMeetingEmails(on),
              on ? "We'll email you the day before your book clubs meet, and when a meeting changes." : "No more book club meeting emails.",
            );
          }}
        />
      </label>
      <Feedback error={error} done={done} />
      <InstallApp />
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
    <Section id="family" title="Family" intro="Profiles, Kids consent, PIN locks, daily limits and how the Kids profiles are reading.">
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
      <KidsReport />
    </Section>
  );
}

/**
 * The Kids profiles' last 7 days, for the grown-ups: time, days read and books finished, from
 * each profile's reading days. Members can also have it emailed on Monday mornings.
 */
function KidsReport() {
  const { state } = useStore();
  const { account, remote, setKidsReportEmails } = useAccount();
  const { busy, error, done, attempt } = useAttempt();
  const hintId = useId();
  const [day] = useState(() => today());
  const kids = state.profiles.filter((p) => p.ageRating === "kids");
  if (kids.length === 0 || !account) return null;

  // A big household reads in groups (kidGroup()); one group needs no headings.
  const weeks = kids.map((profile) => {
    const days = state.profileData[profile.id]?.readingDays ?? {};
    const week = kidWeek(days, day);
    const goal = weeklyGoal(days, profile.weeklyGoalMinutes, day);
    return { profile, week, goal, group: kidGroup(week.seconds, goal) };
  });
  const groups = groupKids(weeks, (k) => k.group);
  const row = (p: (typeof kids)[number], week: KidWeek, goal: WeeklyGoal | null) => {
    const titles = week.books.map((id) => getBook(id)?.title).filter((t): t is string => Boolean(t));
    return (
      <li key={p.id}>
        <Avatar name={p.name} avatar={p.avatar} size={36} />
        <div>
          <strong>{p.name}</strong>
          {week.seconds < 60 ? (
            <p>No reading or listening yet this week.</p>
          ) : (
            <p>
              {readingTime(week.seconds)} on {week.daysRead === 1 ? "1 day" : `${week.daysRead} days`}
              {week.listened >= 60 && ` (${readingTime(week.listened)} of it listening)`}
            </p>
          )}
          {goal && (
            <p>
              Weekly goal {readingTime(goal.goal * 60)}:{" "}
              {goal.reached ? <strong className="kids-goal-reached">reached</strong> : `${readingTime(goal.left * 60)} to go`}
            </p>
          )}
          {week.finished > 0 && (
            <p>
              Finished {week.finished === 1 ? "1 book" : `${week.finished} books`}
              {titles.length > 0 && `: ${titles.join(", ")}`}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="kids-report" aria-labelledby="kids-report-title">
      <h3 id="kids-report-title">Kids reading this week</h3>
      <p className="field-hint">The last 7 days, today included.</p>
      {groups.length > 1 ? (
        groups.map((g) => (
          <div key={g.id} className="kids-report-group">
            <h4>
              {g.heading} <span className="kids-report-count">({g.kids.length})</span>
            </h4>
            <ul className="kids-report-list">{g.kids.map((k) => row(k.profile, k.week, k.goal))}</ul>
          </div>
        ))
      ) : (
        <ul className="kids-report-list">{weeks.map((k) => row(k.profile, k.week, k.goal))}</ul>
      )}
      <label className="switch-row">
        <span>
          <strong>Email me this every week</strong>
          <small id={hintId}>
            {remote
              ? "On Monday mornings: last week's reading for each Kids profile. Off until you turn it on."
              : "The demo doesn't send emails. Members can get this every Monday morning."}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={hintId}
          checked={account.kidsReportEmails}
          disabled={busy}
          onChange={(e) => {
            const on = e.target.checked;
            void attempt(
              () => setKidsReportEmails(on),
              on ? "We'll email you the Kids reading report every Monday." : "No more weekly Kids reports.",
            );
          }}
        />
      </label>
      <Feedback error={error} done={done} />
    </section>
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
