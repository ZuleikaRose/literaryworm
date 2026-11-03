import { ReferAFriend } from "../components/ReferAFriend";
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AccountPasswordField } from "../components/AccountPasswordField";
import { BillingHistory } from "../components/BillingHistory";
import { Avatar } from "../components/Avatar";
import { ContentNotes } from "../components/ContentNotes";
import { usesBackend } from "../lib/backend";
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
  addPasskey,
  cancelTwoStep,
  deletePasskey,
  changeBillingDay,
  choosePlan,
  finishTwoStep,
  listPasskeys,
  type MembershipAction,
  PasskeyCodeError,
  passkeyAddNeedsCode,
  paymentMethodUrl,
  renamePasskey,
  startTwoStep,
  turnOffTwoStep,
  type TwoStepSetup,
  twoStepIsOn,
} from "../lib/accountApi";
import { CANCEL_NOTICE_HOURS, cancellationEnd, endDate, longDate, nextBillingDate, ordinal } from "../lib/billing";
import { readingTime } from "../lib/goals";
import { type Passkey, PASSKEY_NAME_MAX, passkeyNameError, passkeysSupported, sortPasskeys } from "../lib/passkeys";
import { groupKids, kidGroup, type KidWeek, kidWeek, type WeeklyGoal, weeklyGoal, quizWeek } from "../lib/kidsReport";
import { ageRatingDetails, dailyLimitOptions } from "../lib/profiles";
import { today } from "../lib/reading";
import { useAccount } from "../lib/useAccount";
import { loadPushKinds, PushError, type PushState, readPushState, savePushKinds, turnOffPush, turnOnPush } from "../lib/push";
import { PUSH_KINDS, type PushKind, toggleKind } from "../lib/pushState";
import { answerable, type WaitingRequest } from "../lib/bookRequests";
import { useBookRequests } from "../lib/useBookRequests";
import { useTitle } from "../lib/useTitle";
import { validateNewPassword } from "../lib/validation";
import { useActiveProfile, useStore } from "../store/context";
import type { Account as AccountDetails } from "../types";
import { rich, tk, tr } from "../lib/i18n";
import { useT } from "../lib/useT";

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
      setError(err instanceof AccountError ? err.message : tr("Something went wrong. Try again."));
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
  ["plan", tk("Plan and billing")],
  ["sign-in", tk("Sign-in")],
  ["preferences", tk("Preferences")],
  ["family", tk("Family")],
  ["privacy", tk("Privacy")],
  ["team", tk("Team access")],
  ["help", tk("Help")],
  ["delete", tk("Delete account")],
] as const;

export default function Account() {
  const t = useT();
  useTitle(t("Account"));
  const profile = useActiveProfile();
  const navigate = useNavigate();
  const [grownUpOk, setGrownUpOk] = useState(false);
  const { account } = useAccount();
  const roles = useStaffRoles();

  // Kids profiles need the account password before anything here shows.
  if (profile?.ageRating === "kids" && !grownUpOk) {
    return (
      <section className="page account-page">
        <h1>{t("Account")}</h1>
        <p className="account-sub">{t("A grown-up needs to open this page.")}</p>
        <GrownUpDialog open onClose={() => navigate("/browse")} onConfirmed={() => setGrownUpOk(true)} action="open Account" />
      </section>
    );
  }
  if (!account) return null;

  return (
    <div className="page account-page">
      <h1>{t("Account")}</h1>
      <p className="account-sub">
        {account.email}
        {account.isDemo && ` · ${t("Demo household: changes here last until you refresh the page.")}`}
      </p>
      <nav className="account-nav" aria-label={t("Account sections")}>
        <ul>
          {SECTIONS.filter(([id]) => id !== "team" || roles.length > 0).map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`}>{t(label)}</a>
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
        <Section id="team" title={t("Team access")} intro={t("Access to LiteraryWorm beyond being a member.")}>
          <TeamAccess roles={roles} />
        </Section>
      )}
      <Section id="help" title={t("Help")}>
        <ul className="account-links">
          <li>
            <Link to="/whats-new">{t("What's new")}</Link>
          </li>
          <li>
            <Link to="/legal/help">{t("Help Center")}</Link>
          </li>
          <li>
            <Link to="/legal/status">{t("Service status")}</Link>
          </li>
          <li>
            <Link to="/legal/accessibility">{t("Accessibility Policy")}</Link>
          </li>
          <li>
            <Link to="/legal/terms">{t("Terms of Service")}</Link>
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
  const t = useT();
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
    }, t("You'll stay on yearly billing. Your membership renews for another year as before."));
  const addPaymentMethod = () =>
    attempt(async () => {
      const { url } = await choosePlan(account.planId!, account.billingDay ?? Math.min(new Date().getDate(), 28), false, account.billingInterval);
      if (url) window.location.assign(url);
    });
  const saveBillingDay = (e: FormEvent) => {
    e.preventDefault();
    void attempt(async () => {
      dispatch({ type: "updateAccount", patch: await changeBillingDay(newDay) });
    }, t("Your billing day is now the {day}. The days until your next charge are free.", { day: ordinal(newDay) }));
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
      pause: t("Your membership is paused. Nothing is charged until you resume."),
      resume: t("Welcome back. Your membership is active again."),
      cancel: cancelLate
        ? t("Your membership is cancelled. The charge on {date} still goes through, and you can keep reading until {ends}.", { date: nextCharge ?? "", ends: cancelEnds ?? "" })
        : t("Your membership is cancelled. You can keep reading until {date}.", { date: nextCharge ?? "" }),
      restart: t("Your membership will carry on as before."),
    };
    await attempt(() => changeMembership(action), messages[action]);
  };

  if (!plan) {
    return (
      <Section id="plan" title={t("Plan and billing")}>
        <p>{t("You haven't chosen a plan yet.")}</p>
        <Link className="primary-button" to="/plans?setup=1">
          {t("Choose a plan")}
        </Link>
        {billed && <RedeemGift account={account} />}
        {billed && <ReferAFriend />}
      </Section>
    );
  }

  if (account.complimentary) {
    return (
      <Section id="plan" title={t("Plan and billing")} intro={t("Staff accounts have a complimentary membership while they're on the team. They're never charged.")}>
        <dl className="account-facts">
          <div>
            <dt>{t("Plan")}</dt>
            <dd>{plan.name}</dd>
          </div>
          <div>
            <dt>{t("Status")}</dt>
            <dd>
              <span className="status-pill status-active">{t("Complimentary")}</span>
            </dd>
          </div>
          <div>
            <dt>{t("Next charge")}</dt>
            <dd>{t("None. Staff accounts aren't billed.")}</dd>
          </div>
        </dl>
        <p className="field-hint">{t("When your last staff role is removed, the complimentary membership ends and a plan can be chosen then.")}</p>
        <PlanUsage planId={plan.id} />
      </Section>
    );
  }

  const price = formatPrice(priceFor(plan, account.billingInterval));
  const statusText = account.pastDue
    ? t("Payment failed")
    : account.status === "paused"
      ? t("Paused")
      : endsOn
        ? t("Cancelled: ends {date}", { date: endsOn })
        : account.status === "cancelled"
          ? t("Ended")
          : t("Active");

  return (
    <Section id="plan" title={t("Plan and billing")} intro={t("Change, pause or cancel online at any time. No phone call needed.")}>
      <dl className="account-facts">
        <div>
          <dt>{t("Plan")}</dt>
          <dd>
            {plan.name} · {price} {perPeriod(account.billingInterval)}
          </dd>
        </div>
        <div>
          <dt>{t("Status")}</dt>
          <dd>
            <span className={`status-pill status-${account.status === "paused" ? "paused" : endsOn ? "ending" : "active"}`}>{statusText}</span>
          </dd>
        </div>
        <div>
          <dt>{t("Next charge")}</dt>
          <dd>
            {account.status === "paused"
              ? t("None while paused")
              : endsOn
                ? chargeBeforeEnd
                  ? t("{price} on {date}, then the plan ends on {ends}", { price, date: nextCharge ?? "", ends: endsOn })
                  : t("None: the plan ends instead")
                : account.giftUntil
                  ? t("None until {date}: a gift. Then {price} if a card is on file; without one, the membership ends that day.", { date: nextCharge ?? "", price })
                  : switchPlan
                    ? t("{price} on {date}, the first monthly charge", { price: formatPrice(switchPlan.price), date: nextCharge ?? "" })
                    : t("{price} on {date}", { price, date: nextCharge ?? "" })}
          </dd>
        </div>
        <div>
          <dt>{yearly ? t("Billing") : t("Billing day")}</dt>
          <dd>
            {switchPlan
              ? t("Yearly until {date}, then monthly: {plan} at {price} a month, on that day each month", {
                  date: nextCharge ?? "",
                  plan: switchPlan.name,
                  price: formatPrice(switchPlan.price),
                })
              : yearly
                ? t("Yearly, renewing on {date}", { date: nextCharge ?? t("the date your year started") })
                : t("The {day} of each month", { day: ordinal(account.billingDay ?? 1) })}
          </dd>
        </div>
      </dl>
      <p className="field-hint cancel-notice">
        {yearly
          ? t("Cancel at least {hours} hours before your next billing date to stop the next charge. Cancelling later still ends your membership, but after one more year. No refunds.", { hours: CANCEL_NOTICE_HOURS })
          : t("Cancel at least {hours} hours before your next billing date to stop the next charge. Cancelling later still ends your membership, but after one more month. No refunds.", { hours: CANCEL_NOTICE_HOURS })}
      </p>
      {!yearly && billed && account.stripeLinked && account.status === "active" && !endsOn && (
        <p className="field-hint">
          {rich(t("{link}: {price} a year, so two months are free."), {
            link: <Link to="/plans?billing=yearly">{t("Pay yearly instead")}</Link>,
            price: formatPrice(plan.yearlyPrice),
          })}
        </p>
      )}
      {switchPlan && (
        <p className="field-hint">
          {t("You chose monthly billing from your renewal date. Changed your mind?")}{" "}
          <button type="button" className="text-button" disabled={busy} onClick={keepYearly}>
            {t("Keep yearly billing")}
          </button>
        </p>
      )}
      {yearly && !switchPlan && billed && account.stripeLinked && account.status === "active" && !endsOn && (
        <p className="field-hint">
          {rich(t("{link} from your renewal date. Nothing changes until then."), {
            link: <Link to="/plans?billing=monthly">{t("Pay monthly instead")}</Link>,
          })}
        </p>
      )}
      {account.isDemo && <p className="field-hint">{t("The demo can't take payments, so no card is on file.")}</p>}

      {billed && !account.stripeLinked && (
        <div className="form-alert">
          <Icon name="alert" size={17} />
          <div>
            <p>
              {yearly
                ? t("This is a live account: you'll be billed yearly until you cancel. Add a payment method to continue your membership.")
                : t("This is a live account: you'll be billed monthly until you cancel. Add a payment method to continue your membership.")}
            </p>
            <button type="button" className="primary-button" disabled={busy} onClick={addPaymentMethod}>
              {t("Add a payment method")}
            </button>
          </div>
        </div>
      )}
      {billed && account.pastDue && (
        <div className="form-alert">
          <Icon name="alert" size={17} />
          <p>{t("Your last payment didn't go through. Update your payment method to keep reading and listening.")}</p>
        </div>
      )}

      {billed && account.stripeLinked && account.status === "active" && !endsOn && !account.giftUntil && !yearly && (
        <form className="billing-day-form" onSubmit={saveBillingDay}>
          <div className="field">
            <label className="field-label" htmlFor="new-billing-day">
              {t("Change billing day")}
            </label>
            <select id="new-billing-day" className="field-input" value={newDay} onChange={(e) => setNewDay(Number(e.target.value))}>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {t("The {day} of each month", { day: ordinal(d) })}
                </option>
              ))}
            </select>
            <p className="field-hint">{t("Nothing is charged twice: the days until your new billing day are free.")}</p>
          </div>
          <button type="submit" className="secondary-button" disabled={busy || newDay === account.billingDay}>
            {t("Save billing day")}
          </button>
        </form>
      )}

      <div className="account-actions">
        {billed && account.stripeLinked && (
          <button type="button" className="secondary-button" disabled={busy} onClick={openPaymentPage}>
            {t("Update payment method")}
          </button>
        )}
        <Link className="secondary-button" to="/plans">
          {t("Change plan")}
        </Link>
        {billed && (
          <Link className="secondary-button" to="/gifts">
            {t("Give a gift")}
          </Link>
        )}
        {account.status === "paused" ? (
          <button type="button" className="primary-button" disabled={busy} onClick={() => run("resume")}>
            {t("Resume membership")}
          </button>
        ) : (
          !endsOn && !yearly && (
            <button type="button" className="secondary-button" disabled={busy} onClick={() => setConfirming("pause")}>
              {t("Pause membership")}
            </button>
          )
        )}
        {endsOn ? (
          <button type="button" className="primary-button" disabled={busy} onClick={() => run("restart")}>
            {t("Keep my membership")}
          </button>
        ) : (
          account.status !== "paused" && (
            <button type="button" className="ghost-button danger-text" disabled={busy} onClick={() => setConfirming("cancel")}>
              {t("Cancel membership")}
            </button>
          )
        )}
      </div>
      <Feedback error={error} done={done} />

      {billed && <RedeemGift account={account} />}
      {billed && <ReferAFriend />}

      <PlanUsage planId={plan.id} />
      {billed && account.stripeLinked && <BillingHistory canRedeem={account.status !== "cancelled"} monthlyPrice={price} interval={account.billingInterval} />}

      <Dialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        size="sm"
        title={confirming === "cancel" ? t("Cancel your membership?") : t("Pause your membership?")}
        description={
          <p>
            {confirming === "cancel"
              ? cancelLate
                ? t(
                    "It's less than {hours} hours until your next billing date, so the charge on {date} still goes through. You can keep reading and listening until {ends}, with no charges after that. No refunds. You can change your mind any time before then.",
                    { hours: CANCEL_NOTICE_HOURS, date: nextCharge ?? "", ends: cancelEnds ?? "" },
                  )
                : t("You can keep reading and listening until {date}, and you won't be charged again. No refunds. You can change your mind any time before then.", {
                    date: nextCharge ?? "",
                  })
              : t("Reading and listening stop, and nothing is charged until you resume. Your library, profiles and progress stay as they are.")}
          </p>
        }
      >
        <div className="modal-actions">
          <button
            type="button"
            className={confirming === "cancel" ? "danger-button" : "primary-button"}
            onClick={() => confirming && run(confirming)}
          >
            {confirming === "cancel" ? t("Cancel membership") : t("Pause membership")}
          </button>
          <button type="button" className="secondary-button" onClick={() => setConfirming(null)}>
            {confirming === "cancel" ? t("Keep membership") : t("Not now")}
          </button>
        </div>
      </Dialog>
    </Section>
  );
}

// --- Sign-in ---------------------------------------------------------------------

function SignInSection({ account }: { account: AccountDetails }) {
  const t = useT();
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
    const problem = !v ? t("Enter a display name.") : v.length > DISPLAY_NAME_MAX ? t("Use {n} characters or fewer.", { n: DISPLAY_NAME_MAX }) : null;
    setNameError(problem);
    if (problem) return;
    await name.attempt(() => setDisplayName(v), t("Display name saved. New and existing logs show it."));
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateNewPassword(next);
    setNextError(problem);
    if (problem) {
      nextRef.current?.focus();
      return;
    }
    const ok = await password.attempt(() => changePassword(current, next), t("Password changed."));
    if (ok) {
      setCurrent("");
      setNext("");
    }
  };

  return (
    <Section id="sign-in" title={t("Sign-in")}>
      <form className="account-form" noValidate onSubmit={saveName}>
        <Field
          label={t("Display name")}
          hint={t("Shown on your reader logs instead of your email.")}
          maxLength={DISPLAY_NAME_MAX}
          value={displayName}
          onChange={(e) => setName(e.target.value)}
          error={nameError}
          autoComplete="nickname"
        />
        <button type="submit" className="secondary-button" disabled={name.busy || displayName.trim() === account.name}>
          {name.busy ? t("Saving…") : t("Save display name")}
        </button>
        <Feedback error={name.error} done={name.done} />
      </form>

      <div className="account-fact-row">
        <span>{t("Email")}</span>
        <strong>{account.email}</strong>
        <small>{t("Changing your email address isn't available yet.")}</small>
      </div>

      <form className="account-form" noValidate onSubmit={savePassword}>
        <h3>{t("Change password")}</h3>
        <PasswordField label={t("Current password")} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <PasswordField
          ref={nextRef}
          label={t("New password")}
          autoComplete="new-password"
          hint={t("15 to 64 characters. A short phrase works well.")}
          value={next}
          onChange={(e) => {
            setNext(e.target.value);
            setNextError(null);
          }}
          error={nextError}
        />
        <button type="submit" className="secondary-button" disabled={password.busy || !current || !next}>
          {password.busy ? t("Changing…") : t("Change password")}
        </button>
        <Feedback error={password.error} done={password.done} />
      </form>

      <Passkeys account={account} />

      <TwoStepSignIn account={account} />
    </Section>
  );
}

const passkeyDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/**
 * Passkeys: log in with the device itself (Face ID, Touch ID, Windows Hello, a phone's screen lock,
 * a password manager or a security key) instead of the password. Members add, rename and remove them;
 * adding one asks for the account password first.
 */
function Passkeys({ account }: { account: AccountDetails }) {
  const t = useT();
  const { remote } = useAccount();
  const [list, setList] = useState<Passkey[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [password, setPassword] = useState("");
  // After a passkey log-in with two-step sign-in on, adding another asks for the code too.
  const [needsCode, setNeedsCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<Passkey | null>(null);
  const [newName, setNewName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Passkey | null>(null);
  const add = useAttempt();
  const rename = useAttempt();
  const remove = useAttempt();
  const supported = passkeysSupported();

  useEffect(() => {
    if (!remote) return;
    let live = true;
    listPasskeys().then(
      (value) => live && setList(value),
      (err: Error) => live && setLoadError(err.message),
    );
    return () => {
      live = false;
    };
  }, [remote]);

  if (!remote) {
    return (
      <div className="account-form">
        <h3>{t("Passkeys")}</h3>
        <p className="field-hint">{account.isDemo ? t("The demo household can't add passkeys.") : t("Passkeys need a LiteraryWorm account.")}</p>
      </div>
    );
  }

  const confirmAdd = async (e: FormEvent) => {
    e.preventDefault();
    const digits = code.replace(/\s/g, "");
    const missingCode = needsCode && !/^\d{6}$/.test(digits);
    setCodeError(missingCode ? t("Enter the 6-digit code from your authenticator app.") : null);
    if (!password) {
      add.setError(t("Enter your account password."));
      return;
    }
    if (missingCode) return;
    let added: Passkey | null = null;
    const ok = await add.attempt(async () => {
      try {
        added = await addPasskey(account.email, password, needsCode ? digits : undefined);
      } catch (err) {
        if (!(err instanceof PasskeyCodeError)) throw err;
        setCodeError(err.message);
      }
    });
    if (ok && added) {
      const made: Passkey = added;
      setList((current) => sortPasskeys([made, ...(current ?? []).filter((p) => p.id !== made.id)]));
      setAddOpen(false);
      setPassword("");
      setCode("");
      setNeedsCode(false);
      setNotice(t("Passkey added ({name}). Next time, choose Log in with a passkey.", { name: made.name }));
    }
  };

  const confirmRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renaming) return;
    const problem = passkeyNameError(newName);
    setNameError(problem);
    if (problem) return;
    let saved: Passkey | null = null;
    const ok = await rename.attempt(async () => {
      saved = await renamePasskey(renaming.id, newName);
    });
    if (ok && saved) {
      const updated: Passkey = saved;
      setList((current) => (current ?? []).map((p) => (p.id === updated.id ? { ...p, name: updated.name } : p)));
      setRenaming(null);
      setNotice(t("Renamed to {name}.", { name: updated.name }));
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;
    const gone = removing;
    const ok = await remove.attempt(() => deletePasskey(gone.id));
    if (ok) {
      setList((current) => (current ?? []).filter((p) => p.id !== gone.id));
      setRemoving(null);
      setNotice(t("{name} removed. It can't log in to this account any more.", { name: gone.name }));
    }
  };

  return (
    <div className="account-form">
      <h3>{t("Passkeys")}</h3>
      <p className="field-hint">
        {t(
          "Log in with your face, fingerprint, screen lock or a security key instead of typing your password. Your device keeps the passkey; your face and fingerprint never leave it. Your password still works. With two-step sign-in on, a passkey counts as both steps, so you won't be asked for the code.",
        )}
      </p>
      {!supported && <p className="field-hint">{t("This browser can't make passkeys. Try a recent Chrome, Safari, Edge or Firefox.")}</p>}
      {list && list.length > 0 && (
        <ul className="passkey-list" aria-label={t("Your passkeys")}>
          {list.map((p) => (
            <li key={p.id} className="passkey-item">
              <Icon name="key" size={20} />
              <div className="passkey-text">
                <strong>{p.name}</strong>
                <small>
                  {t("Added {date}", { date: passkeyDate(p.createdAt) })}
                  {p.lastUsedAt ? ` · ${t("last used {date}", { date: passkeyDate(p.lastUsedAt) })}` : ` · ${t("not used yet")}`}
                </small>
              </div>
              <div className="passkey-actions">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setRenaming(p);
                    setNewName(p.name);
                    setNameError(null);
                    rename.setError(null);
                  }}
                >
                  {t("Rename")}<span className="visually-hidden"> {p.name}</span>
                </button>
                <button
                  type="button"
                  className="text-button danger-text"
                  onClick={() => {
                    setRemoving(p);
                    remove.setError(null);
                  }}
                >
                  {t("Remove")}<span className="visually-hidden"> {p.name}</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {list && list.length === 0 && <p className="field-hint">{t("No passkeys yet.")}</p>}
      {supported && list && (
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setNotice(null);
            add.setError(null);
            setCode("");
            setCodeError(null);
            // If this can't be checked, the code is asked for anyway when it's needed: adding still works.
            passkeyAddNeedsCode().then(setNeedsCode, () => setNeedsCode(false));
            setAddOpen(true);
          }}
        >
          <Icon name="plus" size={16} /> {t("Add a passkey")}
        </button>
      )}
      <Feedback error={loadError} done={notice} />

      <Dialog
        open={addOpen}
        onClose={() => {
          setAddOpen(false);
          setPassword("");
        }}
        size="sm"
        eyebrow={t("Passkeys")}
        title={t("Add a passkey")}
        description={
          <p>
            {needsCode
              ? t("Enter your account password and a code from your authenticator app. Your browser then asks for your face, fingerprint, screen lock or security key.")
              : t("Enter your account password. Your browser then asks for your face, fingerprint, screen lock or security key.")}
          </p>
        }
      >
        <form noValidate onSubmit={confirmAdd} className="two-step-form">
          <AccountPasswordField
            value={password}
            onChange={(v) => {
              setPassword(v);
              add.setError(null);
            }}
            error={add.error}
          />
          {needsCode && (
            <Field
              label={t("6-digit code")}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              error={codeError}
            />
          )}
          <div className="modal-actions">
            <button type="submit" className="primary-button" disabled={add.busy}>
              {add.busy ? t("Waiting for your device…") : t("Continue")}
            </button>
            <button type="button" className="secondary-button" onClick={() => setAddOpen(false)}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog open={renaming !== null} onClose={() => setRenaming(null)} size="sm" eyebrow={t("Passkeys")} title={t("Rename passkey")}>
        <form noValidate onSubmit={confirmRename} className="two-step-form">
          <Field
            label={t("Name")}
            hint={t("Something that tells you which device it's on, such as Work laptop.")}
            maxLength={PASSKEY_NAME_MAX}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setNameError(null);
            }}
            error={nameError ?? rename.error}
          />
          <div className="modal-actions">
            <button type="submit" className="primary-button" disabled={rename.busy}>
              {rename.busy ? t("Saving…") : t("Save name")}
            </button>
            <button type="button" className="secondary-button" onClick={() => setRenaming(null)}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        size="sm"
        eyebrow={t("Passkeys")}
        title={removing ? t("Remove {name}?", { name: removing.name }) : t("Remove passkey?")}
        description={
          <p>
            {t("It won't log in to this account any more. Your device may still list it; you can delete it there too.")}
            {list && list.length === 1 ? ` ${t("You'll log in with your password.")}` : ""}
          </p>
        }
      >
        <Feedback error={remove.error} done={null} />
        <div className="modal-actions">
          <button type="button" className="danger-button" disabled={remove.busy} onClick={confirmRemove}>
            {remove.busy ? t("Removing…") : t("Remove")}
          </button>
          <button type="button" className="secondary-button" onClick={() => setRemoving(null)}>
            {t("Keep it")}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

/** Groups the set-up key in fours so it's easier to type into an app. */
const groupKey = (key: string) => key.replace(/(.{4})/g, "$1 ").trim();

function TwoStepSignIn({ account }: { account: AccountDetails }) {
  const t = useT();
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
      () => live && setLoadError(tr("We couldn't check your two-step sign-in. Refresh the page to try again.")),
    );
    return () => {
      live = false;
    };
  }, [remote]);

  if (!remote) {
    return (
      <div className="account-form">
        <h3>{t("Two-step sign-in")}</h3>
        <p className="field-hint">
          {account.isDemo ? t("The demo household can't turn on two-step sign-in.") : t("Two-step sign-in needs a LiteraryWorm account.")}
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
      setCodeError(t("Enter the 6-digit code from your authenticator app."));
      codeRef.current?.focus();
      return;
    }
    setCodeError(null);
    const ok = await start.attempt(() => finishTwoStep(setup.factorId, digits));
    if (ok) {
      setSetup(null);
      setSetupOpen(false);
      setOn(true);
      setNotice(t("Two-step sign-in is on. You'll enter a code from the app each time you log in."));
    } else {
      codeRef.current?.focus();
    }
  };

  const confirmOff = async (e: FormEvent) => {
    e.preventDefault();
    const digits = offCode.replace(/\s/g, "");
    if (!/^\d{6}$/.test(digits)) {
      turnOff.setError(t("Enter the 6-digit code from your authenticator app."));
      return;
    }
    const ok = await turnOff.attempt(() => turnOffTwoStep(digits));
    if (ok) {
      setOffOpen(false);
      setOffCode("");
      setOn(false);
      setNotice(t("Two-step sign-in is off. Your password alone logs you in."));
    }
  };

  return (
    <div className="account-form">
      <h3>{t("Two-step sign-in")}</h3>
      <p className="field-hint">
        {t(
          "After your password, enter a code from an authenticator app on your phone (such as Google Authenticator, Microsoft Authenticator or 1Password), so your password alone can't open your account. Logging in with a passkey doesn't need the code.",
        )}
      </p>
      {on !== null && (
        <div className="account-fact-row">
          <span>{t("Status")}</span>
          <strong>{on ? t("On") : t("Off")}</strong>
        </div>
      )}
      {on === false && (
        <button type="button" className="secondary-button" onClick={openSetup}>
          {t("Turn on two-step sign-in")}
        </button>
      )}
      {on && (
        <button type="button" className="secondary-button" onClick={() => setOffOpen(true)}>
          {t("Turn off two-step sign-in")}
        </button>
      )}
      <Feedback error={loadError} done={notice} />

      <Dialog
        open={setupOpen}
        onClose={closeSetup}
        size="sm"
        eyebrow={t("Two-step sign-in")}
        title={t("Set up your authenticator app")}
        description={<p>{t("Scan the QR code with the app, then enter the 6-digit code it shows.")}</p>}
      >
        {!setup ? (
          start.error ? <Feedback error={start.error} done={null} /> : <p aria-busy="true">{t("Getting your QR code…")}</p>
        ) : (
          <form noValidate onSubmit={confirmCode} className="two-step-form">
            <img className="two-step-qr" src={setup.qrCode} width={180} height={180} alt={t("QR code to add LiteraryWorm to your authenticator app")} />
            <p className="field-hint">
              {rich(t("Can't scan it? Choose to enter a key in the app, and type: {key}"), {
                key: <code className="two-step-key">{groupKey(setup.key)}</code>,
              })}
            </p>
            <Field
              ref={codeRef}
              label={t("6-digit code")}
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
                {start.busy ? t("Checking…") : t("Turn on")}
              </button>
              <button type="button" className="secondary-button" onClick={closeSetup}>
                {t("Cancel")}
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
        eyebrow={t("Two-step sign-in")}
        title={t("Turn off two-step sign-in?")}
        description={<p>{t("Enter a current code from your authenticator app. Your password alone will then log you in. You can turn it back on at any time.")}</p>}
      >
        <form noValidate onSubmit={confirmOff} className="two-step-form">
          <Field
            label={t("6-digit code")}
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
              {turnOff.busy ? t("Turning off…") : t("Turn off")}
            </button>
            <button type="button" className="secondary-button" onClick={() => setOffOpen(false)}>
              {t("Keep it on")}
            </button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

// --- Preferences -------------------------------------------------------------------

const PUSH_HINTS: Record<PushState, string> = {
  on: tk("This device gets the notifications chosen below. Turn it off here, or log out."),
  off: tk("Get notifications on this device: a book you're waiting for is out, a club meeting is coming, new club posts, an evening streak nudge and answers to Kids book requests. You choose which."),
  blocked: tk("Your browser is blocking notifications from LiteraryWorm. Allow them in its site settings to turn this on."),
  "install-first": tk("On iPhone and iPad, add LiteraryWorm to your Home Screen (Share, then Add to Home Screen) and open it from there to turn this on."),
  unsupported: tk("This browser can't show notifications from LiteraryWorm. Try the app added to your Home Screen, or another browser."),
};

/** Notifications on this device (Web Push, lib/push.ts): per browser, for members. */
function DeviceNotifications() {
  const t = useT();
  const hintId = useId();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    readPushState().then((s) => live && setState(s), () => live && setState("unsupported"));
    return () => {
      live = false;
    };
  }, []);
  if (state === null) return null;
  const change = async (on: boolean) => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      if (on) await turnOnPush();
      else await turnOffPush();
      setDone(on ? t("Notifications are on for this device.") : t("Notifications are off for this device."));
    } catch (err) {
      setError(err instanceof PushError ? err.message : t("Something went wrong. Try again."));
    } finally {
      setState(await readPushState().catch(() => "unsupported" as const));
      setBusy(false);
    }
  };
  return (
    <>
      <label className="switch-row">
        <span>
          <strong>{t("Notifications on this device")}</strong>
          <small id={hintId}>{t(PUSH_HINTS[state])}</small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={hintId}
          checked={state === "on"}
          disabled={busy || (state !== "on" && state !== "off")}
          onChange={(e) => void change(e.target.checked)}
        />
      </label>
      <Feedback error={error} done={done} />
      {state === "on" && <PushKinds />}
    </>
  );
}

/** Which kinds of notification the account's devices get (account_private.push_kinds). */
function PushKinds() {
  const t = useT();
  const [kinds, setKinds] = useState<PushKind[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    loadPushKinds().then(
      (k) => live && setKinds(k),
      (err: unknown) => live && setError(err instanceof Error ? err.message : tr("We couldn't load which notifications you get.")),
    );
    return () => {
      live = false;
    };
  }, []);
  if (!kinds) return error ? <Feedback error={error} done={null} /> : null;
  return (
    <fieldset className="push-kinds">
      <legend>{t("Notify me when… (on every device with notifications on)")}</legend>
      {PUSH_KINDS.map((k) => (
        <label key={k.id} className="check-row">
          <input
            type="checkbox"
            checked={kinds.includes(k.id)}
            disabled={busy}
            onChange={async (e) => {
              const next = toggleKind(kinds, k.id, e.target.checked);
              setBusy(true);
              setError(null);
              try {
                await savePushKinds(next);
                setKinds(next);
              } catch (err) {
                setError(err instanceof Error ? err.message : t("We couldn't save that. Try again."));
              } finally {
                setBusy(false);
              }
            }}
          />
          <span>{t(k.label)}</span>
        </label>
      ))}
      <Feedback error={error} done={null} />
    </fieldset>
  );
}

function PreferencesSection({ account }: { account: AccountDetails }) {
  const t = useT();
  const { remote, setPublicReader, setMarketingEmails, setReleaseEmails, setAuthorEmails, setUpdateEmails, setClubMeetingEmails, setClubPostEmails } = useAccount();
  const readerHintId = useId();
  const { busy, error, done, attempt } = useAttempt();
  const hintId = useId();
  const releaseHintId = useId();
  const authorHintId = useId();
  const updateHintId = useId();
  const clubHintId = useId();
  const clubPostsHintId = useId();
  return (
    <Section id="preferences" title={t("Preferences")}>
      {remote && (
        <label className="switch-row">
          <span>
            <strong>{t("Let other readers follow me")}</strong>
            <small id={readerHintId}>
              {t(
                "Gives you a reader page with the logs you publish, under your display name, and other members can follow it. Your library, lists and reading stay private. Turning it off removes your followers.",
              )}
            </small>
          </span>
          <input
            type="checkbox"
            role="switch"
            className="switch"
            aria-describedby={readerHintId}
            checked={Boolean(account.publicReader)}
            disabled={busy}
            onChange={(e) => {
              const on = e.target.checked;
              void attempt(() => setPublicReader(on), on ? t("Your reader page is on. Others can follow you.") : t("Your reader page is off, and your followers were removed."));
            }}
          />
        </label>
      )}
      <label className="switch-row">
        <span>
          <strong>{t("Emails about new releases and offers")}</strong>
          <small id={hintId}>{t("Service emails, like receipts and password resets, always arrive.")}</small>
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
            void attempt(() => setMarketingEmails(on), on ? t("You'll get emails about new releases.") : t("No more marketing emails."));
          }}
        />
      </label>
      <label className="switch-row">
        <span>
          <strong>{t("Email me when a book I'm waiting for comes out")}</strong>
          <small id={releaseHintId}>
            {remote
              ? t("For books any profile set Remind me on. It's on Home on the day either way.")
              : t("The demo doesn't send emails. Members get one on the day, as well as the Home card.")}
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
              on ? t("We'll email you when a book you're waiting for comes out.") : t("No more emails about reminded books."),
            );
          }}
        />
      </label>
      {remote && <DeviceNotifications />}
      <label className="switch-row">
        <span>
          <strong>{t("Email me new books from authors I follow")}</strong>
          <small id={authorHintId}>
            {remote
              ? t("Once a week, when an author any profile follows has a new book. They're in the bell either way.")
              : t("The demo doesn't send emails. Members get a weekly email of new books from the authors they follow.")}
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
              on ? t("We'll email you once a week about new books from authors you follow.") : t("No more emails about authors you follow."),
            );
          }}
        />
      </label>
      <label className="switch-row">
        <span>
          <strong>{t("Email me a monthly round-up of what's new")}</strong>
          <small id={updateHintId}>
            {remote ? (
              <>
                {rich(t("The biggest changes to LiteraryWorm, once a month. Everything is on {link} either way."), {
                  link: <Link to="/whats-new">{t("What's new")}</Link>,
                })}
              </>
            ) : (
              t("The demo doesn't send emails. Members can get the biggest changes once a month.")
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
              on ? t("We'll email you the biggest changes once a month.") : t("No more monthly round-ups."),
            );
          }}
        />
      </label>
      <label className="switch-row">
        <span>
          <strong>{t("Email me the day before a book club meets")}</strong>
          <small id={clubHintId}>
            {remote
              ? t("For meetings in any club you're in, and when one moves or is cancelled. The club page lists them, with Add to calendar.")
              : t("The demo doesn't send emails. Members get a reminder the day before each club meeting, and an email when one moves or is cancelled.")}
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
              on ? t("We'll email you the day before your book clubs meet, and when a meeting changes.") : t("No more book club meeting emails."),
            );
          }}
        />
      </label>
      <label className="switch-row">
        <span>
          <strong>{t("Email me new book club posts")}</strong>
          <small id={clubPostsHintId}>
            {remote
              ? t("Once a day, when there are new posts in your clubs with alerts on. Only posts about chapters you've reached, and who wrote them; what they wrote stays in the app.")
              : t("The demo doesn't send emails. Members can get a daily email of new posts in their clubs, about chapters they've reached.")}
          </small>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="switch"
          aria-describedby={clubPostsHintId}
          checked={account.clubPostEmails}
          disabled={busy}
          onChange={(e) => {
            const on = e.target.checked;
            void attempt(
              () => setClubPostEmails(on),
              on ? t("We'll email you new book club posts once a day.") : t("No more book club post emails."),
            );
          }}
        />
      </label>
      <Feedback error={error} done={done} />
      <InstallApp />
      <p className="account-note">
        <Icon name="accessibility" size={18} />{" "}
        {t("Text size, theme, the easier-reading font, contrast and motion are in the accessibility menu at the top of every page.")}
      </p>
    </Section>
  );
}

// --- Family ---------------------------------------------------------------------------

function FamilySection() {
  const t = useT();
  const { state } = useStore();
  const limitLabel = (minutes: number | null) => {
    const label = dailyLimitOptions.find((o) => o.value === minutes)?.label;
    return label ? t(label) : t("{n} minutes", { n: minutes ?? 0 });
  };
  return (
    <Section id="family" title={t("Family")} intro={t("Profiles, Kids consent, PIN locks, daily limits and how the Kids profiles are reading.")}>
      <ul className="family-list">
        {state.profiles.map((p) => (
          <li key={p.id}>
            <Avatar name={p.name} avatar={p.avatar} size={40} />
            <span className="family-name">{p.name}</span>
            <span className="family-chips">
              <span className="chip-tag">{t(ageRatingDetails[p.ageRating].label)}</span>
              {p.hasPin && (
                <span className="chip-tag">
                  <Icon name="lock" size={12} /> {t("PIN")}
                </span>
              )}
              {p.dailyLimitMinutes !== null && (
                <span className="chip-tag">
                  <Icon name="clock" size={12} /> {t("{limit} a day", { limit: limitLabel(p.dailyLimitMinutes) })}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Link className="secondary-button" to="/profiles?manage=1">
        {t("Manage profiles")}
      </Link>
      <BookRequests />
      <KidsReport />
    </Section>
  );
}

/**
 * Books the Kids profiles asked for (lib/bookRequests.ts): waiting ones with Yes and No, which
 * re-check the account password, then the answered ones, which can be changed or cleared.
 */
function BookRequests() {
  const t = useT();
  const { state } = useStore();
  const { answer, remove } = useBookRequests();
  const [asking, setAsking] = useState<{ row: WaitingRequest; approve: boolean } | null>(null);
  const [password, setPassword] = useState("");
  const dialog = useAttempt();
  const list = useAttempt();
  const rows = answerable(state.profiles, state.profileData);
  if (rows.length === 0) return null;
  const waiting = rows.filter((r) => r.request.status === "pending").length;

  const close = () => {
    setAsking(null);
    setPassword("");
    dialog.setError(null);
  };
  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!asking) return;
    const { row, approve } = asking;
    const ok = await dialog.attempt(() => answer(row.profile, row.book.id, approve, password));
    if (ok) {
      close();
      void list.attempt(
        async () => undefined,
        approve
          ? t("{name} can open {title} now.", { name: row.profile.name, title: row.book.title })
          : t("{title} stays off {name}'s shelf.", { title: row.book.title, name: row.profile.name }),
      );
    }
  };

  return (
    <section className="book-requests" aria-labelledby="book-requests-title">
      <h3 id="book-requests-title">{t("Book requests")}</h3>
      <p className="field-hint">
        {waiting > 0 ? `${t.plural(waiting, { one: "{count} request is waiting.", other: "{count} requests are waiting." })} ` : ""}
        {t("A yes opens that one book for that profile; it stays off the shelves otherwise.")}
      </p>
      <ul className="book-request-list">
        {rows.map((row) => (
          <li key={`${row.profile.id}:${row.book.id}`}>
            <Avatar name={row.profile.name} avatar={row.profile.avatar} size={36} />
            <div>
              <strong>
                {rich(t("{name} asked for {title}"), { name: row.profile.name, title: <cite>{row.book.title}</cite> })}
              </strong>
              <p>
                {row.book.author} · {t("rated {rating}", { rating: t(ageRatingDetails[row.book.ageRating].label) })}
                {row.request.status === "approved" ? ` · ${t("You said yes")}` : row.request.status === "declined" ? ` · ${t("You said no")}` : ""}
              </p>
              {usesBackend && <ContentNotes bookId={row.book.id} compact />}
              <div className="book-request-actions">
                {row.request.status !== "approved" && (
                  <button type="button" className="secondary-button" onClick={() => setAsking({ row, approve: true })}>
                    {t("Yes, open it")}
                  </button>
                )}
                {row.request.status === "pending" && (
                  <button type="button" className="text-button" onClick={() => setAsking({ row, approve: false })}>
                    {t("Not this one")}
                  </button>
                )}
                {row.request.status !== "pending" && (
                  <button
                    type="button"
                    className="text-button"
                    disabled={list.busy}
                    onClick={() =>
                      void list.attempt(
                        () => remove(row.profile, row.book.id),
                        row.request.status === "approved"
                          ? t("{title} is off {name}'s shelf again.", { title: row.book.title, name: row.profile.name })
                          : t("Request cleared."),
                      )
                    }
                  >
                    {row.request.status === "approved" ? t("Take back") : t("Clear")}
                  </button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Feedback error={list.error} done={list.done} />

      <Dialog
        open={asking !== null}
        onClose={close}
        size="sm"
        eyebrow={t("Book requests")}
        title={
          asking?.approve
            ? t("Open {title} for {name}?", { title: asking.row.book.title, name: asking.row.profile.name })
            : asking
              ? t("Say no to {title}?", { title: asking.row.book.title })
              : t("Say no to this book?")
        }
        description={<p>{t("Enter the account password, so only a grown-up can answer.")}</p>}
      >
        <form noValidate onSubmit={confirm} className="two-step-form">
          <AccountPasswordField
            value={password}
            onChange={(v) => {
              setPassword(v);
              dialog.setError(null);
            }}
            error={dialog.error}
          />
          <div className="modal-actions">
            <button type="submit" className="primary-button" disabled={dialog.busy || !password}>
              {dialog.busy ? t("Saving…") : asking?.approve ? t("Yes, open it") : t("Say no")}
            </button>
            <button type="button" className="secondary-button" onClick={close}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      </Dialog>
    </section>
  );
}

/**
 * The Kids profiles' last 7 days, for the grown-ups: time, days read and books finished, from
 * each profile's reading days. Members can also have it emailed on Monday mornings.
 */
function KidsReport() {
  const t = useT();
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
    return { profile, week, goal, group: kidGroup(week.seconds, goal), quizzes: quizWeek(state.profileData[profile.id]?.quizResults ?? [], day) };
  });
  const quizzesOf = (id: string) => weeks.find((w) => w.profile.id === id)?.quizzes ?? null;
  const groups = groupKids(weeks, (k) => k.group);
  const row = (p: (typeof kids)[number], week: KidWeek, goal: WeeklyGoal | null) => {
    const titles = week.books.map((id) => getBook(id)?.title).filter((t): t is string => Boolean(t));
    return (
      <li key={p.id}>
        <Avatar name={p.name} avatar={p.avatar} size={36} />
        <div>
          <strong>{p.name}</strong>
          {week.seconds < 60 ? (
            <p>{t("No reading or listening yet this week.")}</p>
          ) : (
            <p>
              {t.plural(week.daysRead, { one: "{time} on {count} day", other: "{time} on {count} days" }, { time: readingTime(week.seconds) })}
              {week.listened >= 60 && ` ${t("({time} of it listening)", { time: readingTime(week.listened) })}`}
            </p>
          )}
          {goal && (
            <p>
              {t("Weekly goal {time}:", { time: readingTime(goal.goal * 60) })}{" "}
              {goal.reached ? <strong className="kids-goal-reached">{t("reached")}</strong> : t("{time} to go", { time: readingTime(goal.left * 60) })}
            </p>
          )}
          {week.finished > 0 && (
            <p>
              {t.plural(week.finished, { one: "Finished {count} book", other: "Finished {count} books" })}
              {titles.length > 0 && `: ${titles.join(", ")}`}
            </p>
          )}
          {quizzesOf(p.id) && (
            <p>
              {t.plural(
                quizzesOf(p.id)!.taken,
                { one: "{count} chapter quiz: {right} of {of} answers right", other: "{count} chapter quizzes: {right} of {of} answers right" },
                { right: quizzesOf(p.id)!.right, of: quizzesOf(p.id)!.of },
              )}
            </p>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="kids-report" aria-labelledby="kids-report-title">
      <h3 id="kids-report-title">{t("Kids reading this week")}</h3>
      <p className="field-hint">{t("The last 7 days, today included.")}</p>
      {groups.length > 1 ? (
        groups.map((g) => (
          <div key={g.id} className="kids-report-group">
            <h4>
              {t(g.heading)} <span className="kids-report-count">({g.kids.length})</span>
            </h4>
            <ul className="kids-report-list">{g.kids.map((k) => row(k.profile, k.week, k.goal))}</ul>
          </div>
        ))
      ) : (
        <ul className="kids-report-list">{weeks.map((k) => row(k.profile, k.week, k.goal))}</ul>
      )}
      <label className="switch-row">
        <span>
          <strong>{t("Email me this every week")}</strong>
          <small id={hintId}>
            {remote
              ? t("On Monday mornings: last week's reading for each Kids profile. Off until you turn it on.")
              : t("The demo doesn't send emails. Members can get this every Monday morning.")}
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
              on ? t("We'll email you the Kids reading report every Monday.") : t("No more weekly Kids reports."),
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
  const t = useT();
  const { downloadData } = useAccount();
  const { busy, error, done, attempt } = useAttempt();
  return (
    <Section id="privacy" title={t("Privacy")} intro={t("Your library, progress and bookmarks are private. Logs you publish are public, with your display name.")}>
      <button type="button" className="secondary-button" disabled={busy} onClick={() => attempt(downloadData, t("Your data file is downloading."))}>
        <Icon name="download" size={17} /> {busy ? t("Gathering your data…") : t("Download my data")}
      </button>
      <p className="field-hint">{t("A JSON file with your account details, profiles, library, reading progress, bookmarks, highlights and notes, and logs.")}</p>
      <Feedback error={error} done={done} />
      <ul className="account-links">
        <li>
          <Link to="/legal/privacy">{t("Privacy Policy")}</Link>
        </li>
        <li>
          <Link to="/legal/childrens-privacy">{t("Children's Privacy Notice")}</Link>
        </li>
        <li>
          <Link to="/legal/privacy-choices">{t("Your Privacy Choices")}</Link>
        </li>
      </ul>
    </Section>
  );
}

// --- Delete account -----------------------------------------------------------------------

function DeleteSection({ account }: { account: AccountDetails }) {
  const t = useT();
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
      setCheckError(t("Tick the box to confirm you understand this can't be undone."));
      return;
    }
    await attempt(() => deleteAccount(password));
  };

  return (
    <Section id="delete" title={t("Delete account")} className="danger-zone">
      <p>
        {t(
          "Deleting the account cancels your plan and permanently removes your profiles, library, reading progress, bookmarks, highlights, notes and logs. It can't be undone.",
        )}
      </p>
      {account.isDemo ? (
        <p className="field-hint">{t("The demo household can't be deleted; it resets when you refresh the page.")}</p>
      ) : (
        <button type="button" className="danger-button" onClick={() => setOpen(true)}>
          <Icon name="trash" size={16} /> {t("Delete account")}
        </button>
      )}

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setError(null);
        }}
        size="sm"
        eyebrow={t("Delete account")}
        title={t("Delete your LiteraryWorm account?")}
        description={<p>{t("Your plan is cancelled first, so you won't be charged again. Then everything is deleted for good.")}</p>}
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
            <span>{t("I understand my profiles, library, progress and logs will be deleted and can't be recovered.")}</span>
          </label>
          {checkError && (
            <p className="field-error" id={checkId}>
              <Icon name="alert" size={15} /> {checkError}
            </p>
          )}
          <div className="modal-actions">
            <button type="submit" className="danger-button" disabled={busy || !password}>
              {busy ? t("Deleting…") : t("Delete my account")}
            </button>
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
              {t("Keep my account")}
            </button>
          </div>
        </form>
      </Dialog>
    </Section>
  );
}
