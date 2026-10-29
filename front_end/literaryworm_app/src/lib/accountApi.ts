import type { AccountReading } from "../store/state";
import type { Collections } from "./collections";
import type {
  AgeRating,
  Account,
  Bookmark,
  CustomList,
  Follow,
  Format,
  Highlight,
  HighlightColor,
  LibraryEntry,
  PlanId,
  PlayerSettings,
  Profile,
  Progress,
  RatingValue,
  Reminder,
  ReadingStatus,
} from "../types";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./backend";
import { defaultPlayerSettings } from "./reading";
import { forgetAllUploadsOffline } from "./uploadCache";
import { loadUploads } from "./uploadsApi";
import { SESSION_STORAGE_KEY, supabase } from "./supabase";

/**
 * Real accounts, through Supabase Auth and the tables' RLS. Every message here is shown to
 * people as is, so it says what happened and what to do, never a raw error.
 */

export class AccountError extends Error {}

const OFFLINE = "We couldn't reach LiteraryWorm. Check your connection and try again.";

function client() {
  if (!supabase) throw new AccountError("Accounts need the LiteraryWorm backend, which isn't set up in this copy of the app.");
  return supabase;
}

/** Turns Supabase Auth errors into plain words. */
function authMessage(error: { message?: string; status?: number; code?: string }): string {
  const text = (error.message ?? "").toLowerCase();
  if (error.code === "email_not_confirmed" || text.includes("email not confirmed"))
    return "Confirm your email first: open the link we sent you, then log in.";
  if (text.includes("invalid login") || error.status === 400)
    return "That email and password don't match an account. Check them and try again, or reset your password.";
  if (error.status === 429 || text.includes("rate limit"))
    return "Too many tries in a short time. Wait a few minutes, then try again.";
  if (text.includes("password")) return "Choose a password of 15 to 64 characters that hasn't appeared in a data breach.";
  if (text.includes("fetch") || text.includes("network")) return OFFLINE;
  return "Something went wrong on our side. Try again in a moment.";
}

/**
 * Set while this tab is signing in or signing up, so the auth listener can tell a fresh
 * sign-in (start at Who's reading?) from a session restored after a refresh (carry on).
 */
let signingInHere = false;

/** True once after a sign-in or sign-up started in this tab. */
export function takeFreshSignIn(): boolean {
  const fresh = signingInHere;
  signingInHere = false;
  return fresh;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  dob: string;
  marketingEmails: boolean;
}

/**
 * Creates the account. The database's sign-up trigger checks the display name, the 18+
 * date of birth and the Terms acceptance again, and creates the public profile.
 */
export async function signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }> {
  signingInHere = true;
  const { data, error } = await client().auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      emailRedirectTo: `${window.location.origin}/signin?confirmed=1`,
      data: {
        display_name: input.name.trim(),
        date_of_birth: input.dob,
        terms_accepted: true,
        marketing_emails: input.marketingEmails,
      },
    },
  });
  if (error || !data.session) signingInHere = false;
  if (error) {
    if ((error.message ?? "").toLowerCase().includes("database error"))
      throw new AccountError("We couldn't create the account. Check your name and date of birth (18 or older), then try again.");
    if (error.status === 422 && (error.message ?? "").toLowerCase().includes("password"))
      throw new AccountError("Choose a password of 15 to 64 characters that hasn't appeared in a data breach.");
    throw new AccountError(authMessage(error));
  }
  return { needsConfirmation: !data.session };
}

export async function signIn(email: string, password: string): Promise<void> {
  signingInHere = true;
  const { error } = await client().auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    signingInHere = false;
    throw new AccountError(authMessage(error));
  }
}

/**
 * Ends the session. If Supabase can't be reached (it still asks the server, even for a
 * local sign-out), the stored session is removed here, so a refresh can't sign the member
 * back in. The server-side session then simply expires.
 */
export async function signOut(): Promise<void> {
  // Uploaded books kept for offline are private: none stay on a shared device.
  await forgetAllUploadsOffline().catch((err: unknown) => console.error("uploads: couldn't clear offline copies at sign-out:", err));
  if (!supabase) return;
  let failed = false;
  try {
    const { error } = await supabase.auth.signOut();
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (!failed) return;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage blocked: nothing was stored to remove.
  }
}

/**
 * Sends a reset link. Supabase answers the same way whether or not the email has an account,
 * so the page still reveals nothing; a failure here means the request itself didn't go through.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  let error: Parameters<typeof authMessage>[0] | null;
  try {
    ({ error } = await client().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    }));
  } catch {
    throw new AccountError(OFFLINE);
  }
  if (!error) return;
  if (error.status === 429) throw new AccountError(authMessage(error));
  throw new AccountError("We couldn't send the reset link just now. Try again in a moment.");
}

export async function setNewPassword(password: string): Promise<void> {
  const { error } = await client().auth.updateUser({ password });
  if (error) throw new AccountError(authMessage(error));
}

/**
 * Checks the account password again (grown-up gates). The same account stays signed in.
 * Resolves false for a wrong password; throws an AccountError when the check couldn't run
 * (offline, rate limited), so the gate can say so instead of "wrong password".
 *
 * Asks Auth directly and drops the session it returns: signing in on the app's client would
 * replace the member's session with a password-only one, undoing two-step sign-in.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!password) return false;
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new AccountError(OFFLINE);
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw new AccountError(OFFLINE);
  }
  if (res.ok) return true;
  // 400 is Supabase's answer for a wrong email or password.
  if (res.status === 400) return false;
  throw new AccountError(authMessage({ status: res.status }));
}

// --- Two-step sign-in (Supabase Auth MFA: an authenticator app's 6-digit codes) ---

/** True when this session has the password but still needs the code from the authenticator app. */
export async function secondStepNeeded(): Promise<boolean> {
  const { data, error } = await client().auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw new AccountError(OFFLINE);
  return data.currentLevel === "aal1" && data.nextLevel === "aal2";
}

function codeMessage(error: { message?: string; status?: number; code?: string }): string {
  if (error.status === 429) return "Too many tries in a short time. Wait a few minutes, then try again.";
  if (error.code === "mfa_verification_failed" || error.status === 422 || error.status === 400)
    return "That code isn't right. Check the app and enter the newest code.";
  if ((error.message ?? "").toLowerCase().includes("fetch")) return OFFLINE;
  return "We couldn't check the code. Try again in a moment.";
}

async function verifiedFactors() {
  const { data, error } = await client().auth.mfa.listFactors();
  if (error) throw new AccountError("We couldn't check your two-step sign-in. Try again.");
  return data.totp.filter((f) => f.status === "verified");
}

/** Finishes logging in with a code from the authenticator app. */
export async function verifySecondStep(code: string): Promise<void> {
  const [factor] = await verifiedFactors();
  if (!factor) throw new AccountError("Two-step sign-in isn't set up for this account. Log in again.");
  const { error } = await client().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) throw new AccountError(codeMessage(error));
}

/** Whether two-step sign-in is on for this account. */
export async function twoStepIsOn(): Promise<boolean> {
  return (await verifiedFactors()).length > 0;
}

export interface TwoStepSetup {
  factorId: string;
  /** The QR code to scan, as an SVG data URL. */
  qrCode: string;
  /** The same key, for typing into the app by hand. */
  key: string;
}

/** Starts setting up an authenticator app. Nothing changes until finishTwoStep() checks a code from it. */
export async function startTwoStep(): Promise<TwoStepSetup> {
  const db = client();
  // A set-up left unfinished blocks a new one with the same name: clear it first. If that fails,
  // enroll() below fails too and says so.
  const { data: listed, error: listError } = await db.auth.mfa.listFactors();
  if (listError) console.error("two-step: couldn't list factors:", listError.message);
  for (const f of listed?.all ?? []) {
    if (f.factor_type !== "totp" || f.status !== "unverified") continue;
    const { error } = await db.auth.mfa.unenroll({ factorId: f.id });
    if (error) console.error("two-step: couldn't clear an unfinished set-up:", error.message);
  }
  const { data, error } = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator app", issuer: "LiteraryWorm" });
  if (error || !data) throw new AccountError("We couldn't start two-step sign-in. Try again in a moment.");
  return { factorId: data.id, qrCode: data.totp.qr_code, key: data.totp.secret };
}

export async function finishTwoStep(factorId: string, code: string): Promise<void> {
  const { error } = await client().auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw new AccountError(codeMessage(error));
}

/** Drops a set-up that wasn't finished (the next startTwoStep() clears it otherwise). */
export async function cancelTwoStep(factorId: string): Promise<void> {
  const { error } = await client().auth.mfa.unenroll({ factorId });
  if (error) throw new AccountError("We couldn't clear the unfinished set-up.");
}

/** Turns two-step sign-in off after checking a current code from the app. */
export async function turnOffTwoStep(code: string): Promise<void> {
  await verifySecondStep(code);
  for (const f of await verifiedFactors()) {
    const { error } = await client().auth.mfa.unenroll({ factorId: f.id });
    if (error) throw new AccountError("We couldn't turn off two-step sign-in. Try again.");
  }
}

/** The signed-in account: public display name, private details and plan. */
export async function loadAccount(): Promise<Account | null> {
  const db = client();
  const { data: auth } = await db.auth.getUser();
  const user = auth.user;
  if (!user) return null;
  const [profile, details, subscription] = await Promise.all([
    db.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
    db.from("account_private").select("date_of_birth, marketing_emails").eq("user_id", user.id).maybeSingle(),
    db.from("subscriptions").select(SUBSCRIPTION_COLUMNS).eq("user_id", user.id).maybeSingle(),
  ]);
  if (profile.error || details.error || subscription.error) throw new AccountError(OFFLINE);
  return {
    userId: user.id,
    name: profile.data?.display_name ?? "Reader",
    email: user.email ?? "",
    password: "",
    dob: details.data?.date_of_birth ?? "",
    marketingEmails: details.data?.marketing_emails ?? false,
    isDemo: false,
    ...fromSubscription(subscription.data as SubscriptionRow | null),
  };
}

interface SubscriptionRow {
  plan_id: string;
  billing_day: number;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  complimentary: boolean;
  stripe_linked: boolean;
}

const SUBSCRIPTION_COLUMNS = "plan_id, billing_day, status, cancel_at_period_end, current_period_end, complimentary, stripe_linked";

/** The account's plan fields from a subscriptions row (or none yet). */
function fromSubscription(
  row: SubscriptionRow | null,
): Pick<Account, "planId" | "billingDay" | "status" | "endsAt" | "complimentary" | "stripeLinked" | "pastDue"> {
  const status = row?.status;
  return {
    planId: (row?.plan_id as PlanId | undefined) ?? null,
    billingDay: row?.billing_day ?? null,
    status: status === "paused" || status === "cancelled" ? status : "active",
    endsAt: row?.cancel_at_period_end ? row.current_period_end : null,
    complimentary: row?.complimentary ?? false,
    stripeLinked: row?.stripe_linked ?? false,
    pastDue: status === "past_due",
  };
}

/**
 * Calls one of LiteraryWorm's Edge Functions as the signed-in member. A refused password comes
 * back as "forbidden", which is reported in plain words; other errors use the function's message.
 */
async function callFunction<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<T> {
  const { data } = await client().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new AccountError("Your session has ended. Log in again.");
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AccountError(OFFLINE);
  }
  const payload = (await res.json().catch(() => null)) as ({ error?: { code?: string; message?: string } } & T) | null;
  if (!res.ok) {
    if (payload?.error?.code === "forbidden") throw new AccountError("That isn't the account password.");
    if (res.status === 429) throw new AccountError("Too many tries in a short time. Wait a minute, then try again.");
    throw new AccountError(payload?.error?.message ?? fallback);
  }
  return payload as T;
}

/**
 * Starts or changes the plan through the `checkout` Edge Function (subscriptions are server-written).
 * A new membership returns Stripe Checkout's `url` to send the member to; a member already paying
 * through Stripe changes plan in place and gets no url.
 */
export async function choosePlan(planId: PlanId, billingDay: number, setup = false): Promise<{ url?: string }> {
  return callFunction<{ url?: string }>(
    "checkout",
    { planId, billingDay, renewalTermsAccepted: true, ...(setup ? { setup: true } : {}) },
    "We couldn't start your plan. Try again.",
  );
}

// --- Membership and the account (manage-account function) ------------------

export type MembershipAction = "pause" | "resume" | "cancel" | "restart";

/** Pauses, resumes, cancels or restarts the membership; returns the account's new plan fields. */
export async function changeMembership(action: MembershipAction) {
  const row = await callFunction<SubscriptionRow>("manage-account", { action }, "We couldn't change your membership. Try again.");
  return fromSubscription(row);
}

/** Moves the billing day (1–28); the days until the new date are free. Returns the new plan fields. */
export async function changeBillingDay(billingDay: number) {
  const row = await callFunction<SubscriptionRow>(
    "manage-account",
    { action: "billing_day", billingDay },
    "We couldn't change your billing day. Try again.",
  );
  return fromSubscription(row);
}

/** Stripe's page for adding or changing the card (a Customer Portal link). */
export async function paymentMethodUrl(): Promise<string> {
  const { url } = await callFunction<{ url: string }>(
    "manage-account",
    { action: "payment_method" },
    "We couldn't open the payment page. Try again.",
  );
  return url;
}

/** One charge in the billing history; amounts in cents. */
export interface BillingInvoice {
  date: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "uncollectible";
  /** How much promo codes took off. */
  discount: number;
  /** Stripe's page for the invoice and receipt. */
  url: string | null;
}

/** The promo code on the membership. */
export interface MembershipDiscount {
  code: string | null;
  percentOff: number | null;
  amountOff: number | null;
  currency: string | null;
  duration: "once" | "repeating" | "forever";
  ends: string | null;
}

/** The last 24 charges (newest first) and the promo code on the membership, from Stripe. */
export async function billingHistory(): Promise<{ invoices: BillingInvoice[]; discount: MembershipDiscount | null }> {
  return callFunction("manage-account", { action: "billing_history" }, "We couldn't load your billing history. Try again.");
}

/** Applies a Stripe promotion code to the membership, replacing any it has. */
export async function redeemPromoCode(code: string): Promise<MembershipDiscount> {
  const { discount } = await callFunction<{ discount: MembershipDiscount }>(
    "manage-account",
    { action: "promo_code", code },
    "We couldn't apply that code. Try again.",
  );
  return discount;
}

/** Deletes the account and everything it owns, after the function re-checks the password. */
export async function deleteAccount(password: string): Promise<void> {
  await callFunction("manage-account", { action: "delete", password, confirm: true }, "We couldn't delete the account. Try again.");
}

/** The public display name shown on logs (profiles.display_name, 1–60 characters). */
export async function setDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await client().from("profiles").update({ display_name: name.trim() }).eq("id", userId);
  if (error) throw new AccountError("We couldn't save your display name. Try again.");
}

export async function setMarketingEmails(userId: string, on: boolean): Promise<void> {
  const { error } = await client().from("account_private").update({ marketing_emails: on }).eq("user_id", userId);
  if (error) throw new AccountError("We couldn't save your email preference. Try again.");
}

/** Changes the password after checking the current one. */
export async function changePassword(email: string, current: string, next: string): Promise<void> {
  if (!(await verifyPassword(email, current))) throw new AccountError("Your current password isn't right.");
  await setNewPassword(next);
}

/** The logs this account wrote, for Download my data. */
export async function loadMyLogs(userId: string) {
  const { data, error } = await client()
    .from("logs")
    .select("id, volume_id, body, rating, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new AccountError("We couldn't gather your logs. Try again.");
  return data;
}

// --- Household profiles (reader_profiles, manage-profile function) -----------

interface ProfileRow {
  id: string;
  name: string;
  avatar: number;
  age_rating: AgeRating;
  has_pin: boolean;
  failed_pin_attempts: number;
  locked_until: string | null;
  daily_limit_minutes: number | null;
  favorite_genres: string[];
  kids_consent_at: string | null;
}

const PROFILE_COLUMNS =
  "id, name, avatar, age_rating, has_pin, failed_pin_attempts, locked_until, daily_limit_minutes, favorite_genres, kids_consent_at";

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name,
  avatar: row.avatar,
  ageRating: row.age_rating,
  pin: null,
  hasPin: row.has_pin,
  failedPinAttempts: row.failed_pin_attempts,
  lockedUntil: row.locked_until ? Date.parse(row.locked_until) : null,
  favoriteGenres: row.favorite_genres,
  dailyLimitMinutes: row.daily_limit_minutes,
  kidsConsent: Boolean(row.kids_consent_at),
});

/** The household's profiles, oldest first. A new account gets its first profile here. */
export async function loadProfiles(account: Pick<Account, "name">): Promise<Profile[]> {
  const db = client();
  const { data, error } = await db.from("reader_profiles").select(PROFILE_COLUMNS).order("created_at");
  if (error) throw new AccountError("We couldn't load your profiles. Try again.");
  if (data.length > 0) return (data as ProfileRow[]).map(toProfile);
  const first = await createProfile({ name: account.name.split(/\s+/)[0].slice(0, 20) || "Reader", avatar: 0, ageRating: "all", favoriteGenres: [] });
  return [first];
}

/** Adds an everyday (Teen or All) profile. Kids profiles go through createKidsProfile. */
export async function createProfile(input: Pick<Profile, "name" | "avatar" | "ageRating" | "favoriteGenres">): Promise<Profile> {
  const { data, error } = await client()
    .from("reader_profiles")
    .insert({
      account_id: await signedInUserId(),
      name: input.name.trim(),
      avatar: input.avatar,
      age_rating: input.ageRating,
      favorite_genres: input.favoriteGenres,
    })
    .select(PROFILE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") throw new AccountError("Another profile already uses this name.");
    if (error.code === "23514") throw new AccountError("Your plan doesn't allow another profile. Change plan to add more.");
    throw new AccountError("We couldn't add the profile. Try again.");
  }
  return toProfile(data as ProfileRow);
}

/** Name, avatar and favourite genres: the changes that don't need the account password. */
export async function updateProfileBasics(id: string, patch: Pick<Profile, "name" | "avatar" | "favoriteGenres">): Promise<void> {
  const { error } = await client()
    .from("reader_profiles")
    .update({ name: patch.name.trim(), avatar: patch.avatar, favorite_genres: patch.favoriteGenres })
    .eq("id", id);
  if (error) {
    if (error.code === "23505") throw new AccountError("Another profile already uses this name.");
    throw new AccountError("We couldn't save the profile. Try again.");
  }
}

type ProtectedProfileChange =
  | { action: "create_kids"; name: string; avatar: number; dailyLimitMinutes: number | null; noticeVersion: string }
  | { action: "set_pin"; profileId: string; pin: string | null }
  | { action: "set_daily_limit"; profileId: string; dailyLimitMinutes: number | null }
  | { action: "set_age_rating"; profileId: string; ageRating: AgeRating; noticeVersion?: string }
  | { action: "unlock"; profileId: string }
  | { action: "delete"; profileId: string };

/** Changes a grown-up controls; the manage-profile function re-checks the account password. */
export async function changeProtectedProfile(change: ProtectedProfileChange, password: string): Promise<{ id?: string }> {
  return callFunction("manage-profile", { ...change, password }, "We couldn't save the profile. Try again.");
}

export interface PinCheck {
  ok: boolean;
  attemptsLeft: number;
  lockedUntil: number | null;
}

/** Checks a profile PIN on the server, which counts wrong tries and locks after five. */
export async function verifyProfilePin(profileId: string, pin: string): Promise<PinCheck> {
  const result = await callFunction<{ ok: boolean; attempts_left?: number; locked_until?: string | null }>(
    "manage-profile",
    { action: "verify_pin", profileId, pin },
    "We couldn't check the PIN. Try again.",
  );
  return {
    ok: result.ok,
    attemptsLeft: result.attempts_left ?? 0,
    lockedUntil: result.locked_until ? Date.parse(result.locked_until) : null,
  };
}

// --- Library (library_items: owner-only RLS) ---------------------------------

interface LibraryRow {
  volume_id: string;
  status: ReadingStatus;
  created_at: string;
}

const toEntry = (row: LibraryRow): LibraryEntry => ({
  bookId: row.volume_id,
  status: row.status,
  addedAt: Date.parse(row.created_at),
});

export async function signedInUserId(): Promise<string> {
  const { data } = await client().auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new AccountError("Your session has ended. Log in again.");
  return id;
}

export async function loadLibrary(): Promise<Record<string, LibraryEntry>> {
  const { data, error } = await client().from("library_items").select("volume_id, status, created_at");
  if (error) throw new AccountError("We couldn't load your library. Try again.");
  return Object.fromEntries((data as LibraryRow[]).map((row) => [row.volume_id, toEntry(row)]));
}

export async function addLibraryItem(bookId: string, status: ReadingStatus): Promise<LibraryEntry> {
  const { data, error } = await client()
    .from("library_items")
    .insert({ user_id: await signedInUserId(), volume_id: bookId, status })
    .select("volume_id, status, created_at")
    .single();
  if (error) throw new AccountError("We couldn't add this book to your library. Try again.");
  return toEntry(data as LibraryRow);
}

export async function setLibraryStatus(bookId: string, status: ReadingStatus): Promise<void> {
  const { error } = await client()
    .from("library_items")
    .update({ status })
    .eq("user_id", await signedInUserId())
    .eq("volume_id", bookId);
  if (error) throw new AccountError("We couldn't change the reading status. Try again.");
}

/** Removing a book also deletes your logs about it (the logs' foreign key cascades). */
export async function removeLibraryItem(bookId: string): Promise<void> {
  const { error } = await client()
    .from("library_items")
    .delete()
    .eq("user_id", await signedInUserId())
    .eq("volume_id", bookId);
  if (error) throw new AccountError("We couldn't remove this book. Try again.");
}

// --- Logs (public read, own writes) ------------------------------------------

export async function addLog(bookId: string, body: string, rating: number | null): Promise<void> {
  const { error } = await client()
    .from("logs")
    .insert({ user_id: await signedInUserId(), volume_id: bookId, body: body.trim(), rating });
  if (error) {
    // 23503: the composite foreign key, so the book isn't in the writer's library.
    if (error.code === "23503") throw new AccountError("Add this book to your library before writing a log about it.");
    throw new AccountError("We couldn't publish your log. Try again.");
  }
}

export async function updateLog(id: string, body: string, rating: number | null): Promise<void> {
  const { error } = await client()
    .from("logs")
    .update({ body: body.trim(), rating })
    .eq("id", id)
    .eq("user_id", await signedInUserId());
  if (error) throw new AccountError("We couldn't save your changes. Try again.");
}

export async function deleteLog(id: string): Promise<void> {
  const { error } = await client().from("logs").delete().eq("id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError("We couldn't delete your log. Try again.");
}

// --- Reading progress, bookmarks and highlights (owner-only RLS) ---------------

interface ProgressRow {
  volume_id: string;
  format: Format;
  chapter_index: number;
  position: number | string;
  finished: boolean;
  updated_at: string;
}

interface BookmarkRow {
  id: string;
  volume_id: string;
  format: Format;
  chapter_index: number;
  position: number | string;
  label: string;
  created_at: string;
}

const toProgress = (row: ProgressRow): Progress => ({
  bookId: row.volume_id,
  format: row.format,
  chapterIndex: row.chapter_index,
  fraction: Number(row.position),
  finished: row.finished,
  updatedAt: Date.parse(row.updated_at),
});

const toBookmark = (row: BookmarkRow): Bookmark => ({
  id: row.id,
  bookId: row.volume_id,
  format: row.format,
  chapterIndex: row.chapter_index,
  fraction: Number(row.position),
  label: row.label,
  createdAt: Date.parse(row.created_at),
});

interface HighlightRow {
  id: string;
  volume_id: string;
  chapter_index: number;
  page: number;
  start_offset: number;
  end_offset: number;
  quote: string;
  color: HighlightColor;
  note: string | null;
  created_at: string;
}

const toHighlight = (row: HighlightRow): Highlight => ({
  id: row.id,
  bookId: row.volume_id,
  chapterIndex: row.chapter_index,
  page: row.page,
  start: row.start_offset,
  end: row.end_offset,
  quote: row.quote,
  color: row.color,
  note: row.note,
  createdAt: Date.parse(row.created_at),
});

const PROGRESS_COLUMNS = "volume_id, format, chapter_index, position, finished, updated_at";
const HIGHLIGHT_COLUMNS = "id, volume_id, chapter_index, page, start_offset, end_offset, quote, color, note, created_at";
const BOOKMARK_COLUMNS = "id, volume_id, format, chapter_index, position, label, created_at";

/** The column's numeric(5,4): four decimal places, 0 to 1. */
const toPosition = (fraction: number) => Math.round(Math.min(1, Math.max(0, fraction)) * 10_000) / 10_000;

export async function loadReading(): Promise<AccountReading> {
  const db = client();
  const [progress, bookmarks, highlights] = await Promise.all([
    db.from("reading_progress").select(PROGRESS_COLUMNS),
    db.from("bookmarks").select(BOOKMARK_COLUMNS).order("created_at"),
    db.from("highlights").select(HIGHLIGHT_COLUMNS).order("created_at"),
  ]);
  if (progress.error || bookmarks.error || highlights.error) {
    throw new AccountError("We couldn't load your reading progress. Try again.");
  }
  return {
    progress: Object.fromEntries((progress.data as ProgressRow[]).map((row) => [row.volume_id, toProgress(row)])),
    bookmarks: (bookmarks.data as BookmarkRow[]).map(toBookmark),
    highlights: (highlights.data as HighlightRow[]).map(toHighlight),
  };
}

/**
 * Saves where the account stopped in a book. The book must already be in the library (the
 * table's foreign key). Updates the row, or creates it the first time.
 */
export async function saveProgress(progress: Progress): Promise<void> {
  const db = client();
  const userId = await signedInUserId();
  const fields = {
    format: progress.format,
    chapter_index: progress.chapterIndex,
    position: toPosition(progress.fraction),
    finished: progress.finished,
  };
  const failed = new AccountError("We couldn't save your place. We'll try again as you read.");
  try {
    const updated = await db
      .from("reading_progress")
      .update(fields)
      .eq("user_id", userId)
      .eq("volume_id", progress.bookId)
      .select("volume_id");
    if (updated.error) throw failed;
    if (updated.data.length > 0) return;
    const inserted = await db.from("reading_progress").insert({ user_id: userId, volume_id: progress.bookId, ...fields });
    if (inserted.error) throw failed;
  } catch (err) {
    throw err instanceof AccountError ? err : failed;
  }
}

export async function addBookmark(bookmark: Omit<Bookmark, "id" | "createdAt">): Promise<Bookmark> {
  const { data, error } = await client()
    .from("bookmarks")
    .insert({
      user_id: await signedInUserId(),
      volume_id: bookmark.bookId,
      format: bookmark.format,
      chapter_index: bookmark.chapterIndex,
      position: toPosition(bookmark.fraction),
      label: bookmark.label.trim(),
    })
    .select(BOOKMARK_COLUMNS)
    .single();
  if (error) throw new AccountError("We couldn't add the bookmark. Try again.");
  return toBookmark(data as BookmarkRow);
}

export async function removeBookmark(id: string): Promise<void> {
  const { error } = await client().from("bookmarks").delete().eq("id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError("We couldn't remove the bookmark. Try again.");
}

/** Saves a highlight (the book must be in the library) and returns it as stored. */
export async function addHighlight(highlight: Omit<Highlight, "id" | "createdAt">): Promise<Highlight> {
  const { data, error } = await client()
    .from("highlights")
    .insert({
      user_id: await signedInUserId(),
      volume_id: highlight.bookId,
      chapter_index: highlight.chapterIndex,
      page: highlight.page,
      start_offset: highlight.start,
      end_offset: highlight.end,
      quote: highlight.quote,
      color: highlight.color,
      note: highlight.note,
    })
    .select(HIGHLIGHT_COLUMNS)
    .single();
  if (error) throw new AccountError("We couldn't save the highlight. Try again.");
  return toHighlight(data as HighlightRow);
}

/** Changes a highlight's colour or note (the passage itself is fixed). */
export async function updateHighlight(id: string, patch: Partial<Pick<Highlight, "color" | "note">>): Promise<void> {
  const { error } = await client().from("highlights").update(patch).eq("id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError(patch.note !== undefined ? "We couldn't save the note. Try again." : "We couldn't change the colour. Try again.");
}

export async function removeHighlight(id: string): Promise<void> {
  const { error } = await client().from("highlights").delete().eq("id", id).eq("user_id", await signedInUserId());
  if (error) throw new AccountError("We couldn't remove the highlight. Try again.");
}

// --- Favourites, ratings, custom lists and recent searches (per profile, owner-only RLS) ---

type DbRating = "not_for_me" | "like" | "love";
const toDbRating = (r: RatingValue): DbRating => (r === "not-for-me" ? "not_for_me" : r);
const fromDbRating = (r: DbRating): RatingValue => (r === "not_for_me" ? "not-for-me" : r);

interface ListRow {
  id: string;
  profile_id: string;
  name: string;
  description: string;
  share_slug: string | null;
}

interface ReminderRow {
  profile_id: string;
  volume_id: string;
  title: string;
  author: string | null;
  release_date: string;
}

const LIST_COLUMNS = "id, profile_id, name, description, share_slug";

const emptyCollections = (): Collections => ({
  favorites: [],
  ratings: {},
  customLists: [],
  recentSearches: [],
  readingGoals: {},
  readingDays: {},
  player: defaultPlayerSettings,
  uploads: [],
  follows: [],
  reminders: [],
});

/** Every profile's favourites, ratings, lists (in order, with their books) and recent searches, keyed by profile id. */
export async function loadCollections(): Promise<Record<string, Collections>> {
  const db = client();
  const [profiles, favorites, ratings, lists, items, follows, reminders] = await Promise.all([
    db.from("reader_profiles").select("id, recent_searches"),
    db.from("favorites").select("profile_id, volume_id").order("created_at"),
    db.from("book_ratings").select("profile_id, volume_id, rating"),
    db.from("custom_lists").select(LIST_COLUMNS).order("position").order("created_at"),
    db.from("custom_list_items").select("list_id, volume_id").order("added_at"),
    db.from("follows").select("profile_id, kind, name").order("created_at"),
    db.from("release_reminders").select("profile_id, volume_id, title, author, release_date").order("release_date"),
  ]);
  if (profiles.error || favorites.error || ratings.error || lists.error || items.error || follows.error || reminders.error) {
    throw new AccountError("We couldn't load your lists and ratings. Try again.");
  }
  const byProfile: Record<string, Collections> = {};
  const of = (id: string) => (byProfile[id] ??= emptyCollections());
  for (const p of profiles.data as { id: string; recent_searches: string[] }[]) of(p.id).recentSearches = p.recent_searches;
  for (const f of favorites.data as { profile_id: string; volume_id: string }[]) of(f.profile_id).favorites.push(f.volume_id);
  for (const f of follows.data as ({ profile_id: string } & Follow)[]) of(f.profile_id).follows.push({ kind: f.kind, name: f.name });
  for (const r of reminders.data as ReminderRow[]) {
    of(r.profile_id).reminders.push({ bookId: r.volume_id, title: r.title, author: r.author, releaseDate: r.release_date });
  }
  for (const r of ratings.data as { profile_id: string; volume_id: string; rating: DbRating }[]) {
    of(r.profile_id).ratings[r.volume_id] = fromDbRating(r.rating);
  }
  const books = new Map<string, string[]>();
  for (const i of items.data as { list_id: string; volume_id: string }[]) books.set(i.list_id, [...(books.get(i.list_id) ?? []), i.volume_id]);
  for (const l of lists.data as ListRow[]) {
    of(l.profile_id).customLists.push({ id: l.id, name: l.name, description: l.description, bookIds: books.get(l.id) ?? [], shareSlug: l.share_slug });
  }
  for (const [id, player] of Object.entries(await loadPlayerSettings())) of(id).player = player;
  const { goals, days, finished } = await loadGoals();
  for (const g of goals) of(g.profile_id).readingGoals[g.year] = g.books;
  for (const d of days) {
    of(d.profile_id).readingDays[d.day] = { seconds: d.minutes * 60, finished: d.books_finished, listened: d.listening_minutes * 60 };
  }
  for (const f of finished) {
    const day = of(f.profile_id).readingDays[f.finished_on] ?? { seconds: 0, finished: 0 };
    of(f.profile_id).readingDays[f.finished_on] = { ...day, books: [...(day.books ?? []), f.volume_id] };
  }
  for (const u of await loadUploads()) of(u.profileId).uploads.push(u.book);
  return byProfile;
}

type PlayerRow = {
  id: string;
  playback_speed: number;
  player_volume: number;
  player_muted: boolean;
  skip_back_seconds: number;
  skip_forward_seconds: number;
  auto_skip_intro: boolean;
  auto_skip_outro: boolean;
};

/** Every profile's player settings. Like goals, an extra: if they can't load, the player uses its defaults. */
async function loadPlayerSettings(): Promise<Record<string, PlayerSettings>> {
  const { data, error } = await client()
    .from("reader_profiles")
    .select("id, playback_speed, player_volume, player_muted, skip_back_seconds, skip_forward_seconds, auto_skip_intro, auto_skip_outro");
  if (error) {
    console.error("player settings: couldn't load", error.message);
    return {};
  }
  return Object.fromEntries(
    (data as PlayerRow[]).map((r) => [
      r.id,
      {
        speed: Number(r.playback_speed),
        volume: r.player_volume,
        muted: r.player_muted,
        skipBack: r.skip_back_seconds,
        skipForward: r.skip_forward_seconds,
        autoSkipIntro: r.auto_skip_intro,
        autoSkipOutro: r.auto_skip_outro,
      },
    ]),
  );
}

/** Saves a profile's player settings (all of them: the latest wins). */
export async function savePlayerSettings(profileId: string, player: PlayerSettings): Promise<void> {
  const { error } = await client()
    .from("reader_profiles")
    .update({
      playback_speed: player.speed,
      player_volume: Math.round(player.volume),
      player_muted: player.muted,
      skip_back_seconds: player.skipBack,
      skip_forward_seconds: player.skipForward,
      auto_skip_intro: player.autoSkipIntro,
      auto_skip_outro: player.autoSkipOutro,
    })
    .eq("id", profileId);
  if (error) throw new AccountError("We couldn't save your player settings.");
}

type GoalRow = { profile_id: string; year: number; books: number };
type DayRow = { profile_id: string; day: string; minutes: number; books_finished: number; listening_minutes: number };
type FinishedRow = { profile_id: string; volume_id: string; finished_on: string };

/** How far back reading days load: this year and all of last year, for goals, streaks and Year in Review. */
const loadFrom = () => `${new Date().getFullYear() - 1}-01-01`;

/**
 * Every profile's goals and recent reading days. Goals and streaks are extras: if they can't load,
 * the account still opens without them (they show as empty) rather than failing to sign in.
 */
async function loadGoals(): Promise<{ goals: GoalRow[]; days: DayRow[]; finished: FinishedRow[] }> {
  const db = client();
  const from = loadFrom();
  const [goals, days, finished] = await Promise.all([
    db.from("reading_goals").select("profile_id, year, books"),
    db.from("reading_days").select("profile_id, day, minutes, books_finished, listening_minutes").gte("day", from),
    db.from("finished_books").select("profile_id, volume_id, finished_on").gte("finished_on", from),
  ]);
  if (goals.error || days.error) {
    console.error("goals: couldn't load", goals.error?.message ?? days.error?.message);
    return { goals: [], days: [], finished: [] };
  }
  // Which books were finished is only for Year in Review: without it, the counts still show.
  if (finished.error) console.error("goals: couldn't load finished books", finished.error.message);
  return { goals: goals.data as GoalRow[], days: days.data as DayRow[], finished: finished.error ? [] : (finished.data as FinishedRow[]) };
}

/** Sets a profile's goal for a year, or clears it (null). */
export async function setReadingGoal(profileId: string, year: number, books: number | null): Promise<void> {
  const db = client();
  const failed = new AccountError("We couldn't save your goal. Try again.");
  if (books === null) {
    const { error } = await db.from("reading_goals").delete().eq("profile_id", profileId).eq("year", year);
    if (error) throw failed;
    return;
  }
  const { error } = await db
    .from("reading_goals")
    .upsert({ profile_id: profileId, user_id: await signedInUserId(), year, books }, { onConflict: "profile_id,user_id,year" });
  if (error) throw failed;
}

/**
 * Adds minutes read or listened (up to 60, of which `listening` were listening) and a finished
 * book (0 or 1, which book if known) to a profile's day.
 */
export async function recordReading(profileId: string, day: string, minutes: number, finished: number, listening = 0, bookId?: string): Promise<void> {
  const { error } = await client().rpc("record_reading", {
    p_profile_id: profileId,
    p_day: day,
    p_minutes: minutes,
    p_finished: finished,
    p_listening_minutes: listening,
    p_volume_id: bookId ?? null,
  });
  if (error) throw new AccountError("We couldn't save today's reading time.");
}

export async function addFavorite(profileId: string, bookId: string): Promise<void> {
  const { error } = await client().from("favorites").insert({ profile_id: profileId, user_id: await signedInUserId(), volume_id: bookId });
  // Already a favourite (another tab): nothing to do.
  if (error && error.code !== "23505") throw new AccountError("We couldn't add it to your favorites. Try again.");
}

export async function addReminder(profileId: string, r: Reminder): Promise<void> {
  const { error } = await client().from("release_reminders").insert({
    profile_id: profileId,
    user_id: await signedInUserId(),
    volume_id: r.bookId,
    title: r.title,
    author: r.author,
    release_date: r.releaseDate,
  });
  // Already set (another tab): nothing to do.
  if (error && error.code !== "23505") {
    const message = error.message.includes("up to 100")
      ? "A profile can have up to 100 reminders. Remove one first."
      : error.message.includes("already out")
        ? "That book is already out, so there's nothing to remind you about."
        : "We couldn't set the reminder. Try again.";
    throw new AccountError(message);
  }
}

export async function removeReminder(profileId: string, bookId: string): Promise<void> {
  const { error } = await client().from("release_reminders").delete().eq("profile_id", profileId).eq("volume_id", bookId);
  if (error) throw new AccountError("We couldn't remove the reminder. Try again.");
}

export async function follow(profileId: string, { kind, name }: Follow): Promise<void> {
  const { error } = await client().from("follows").insert({ profile_id: profileId, user_id: await signedInUserId(), kind, name });
  // Already followed (another tab): nothing to do.
  if (error && error.code !== "23505") {
    throw new AccountError(
      error.message.includes("up to 200") ? "A profile can follow up to 200 authors and narrators." : "We couldn't follow them. Try again.",
    );
  }
}

export async function unfollow(profileId: string, { kind, name }: Follow): Promise<void> {
  const { error } = await client().from("follows").delete().eq("profile_id", profileId).eq("kind", kind).eq("name", name);
  if (error) throw new AccountError("We couldn't unfollow them. Try again.");
}

export async function removeFavorite(profileId: string, bookId: string): Promise<void> {
  const { error } = await client().from("favorites").delete().eq("profile_id", profileId).eq("volume_id", bookId);
  if (error) throw new AccountError("We couldn't remove it from your favorites. Try again.");
}

/** Saves a profile's rating of a book, or clears it (null). */
export async function setRating(profileId: string, bookId: string, rating: RatingValue | null): Promise<void> {
  const db = client();
  const failed = new AccountError("We couldn't save your rating. Try again.");
  if (rating === null) {
    const { error } = await db.from("book_ratings").delete().eq("profile_id", profileId).eq("volume_id", bookId);
    if (error) throw failed;
    return;
  }
  // Update first (the browser may change only the rating), then add the row the first time.
  const updated = await db
    .from("book_ratings")
    .update({ rating: toDbRating(rating) })
    .eq("profile_id", profileId)
    .eq("volume_id", bookId)
    .select("volume_id");
  if (updated.error) throw failed;
  if (updated.data.length > 0) return;
  const { error } = await db
    .from("book_ratings")
    .insert({ profile_id: profileId, user_id: await signedInUserId(), volume_id: bookId, rating: toDbRating(rating) });
  if (error) throw failed;
}

/** Turns the database's list errors into plain words. */
function listError(error: { code?: string; message?: string }, fallback: string): AccountError {
  if (error.code === "23505") return new AccountError("You already have a list with this name.");
  if (error.message?.includes("up to 50 lists")) return new AccountError("A profile can have up to 50 lists. Delete one to make room.");
  if (error.message?.includes("up to 200 books")) return new AccountError("A list can hold up to 200 books.");
  if (error.message?.includes("Kids profiles")) return new AccountError("Kids profiles can't share lists.");
  return new AccountError(fallback);
}

export async function createList(profileId: string, name: string, description: string, position: number): Promise<CustomList> {
  const { data, error } = await client()
    .from("custom_lists")
    .insert({ profile_id: profileId, user_id: await signedInUserId(), name: name.trim(), description: description.trim(), position })
    .select(LIST_COLUMNS)
    .single();
  if (error) throw listError(error, "We couldn't create the list. Try again.");
  const row = data as ListRow;
  return { id: row.id, name: row.name, description: row.description, bookIds: [], shareSlug: row.share_slug };
}

export async function updateList(id: string, name: string, description: string): Promise<void> {
  const { error } = await client().from("custom_lists").update({ name: name.trim(), description: description.trim() }).eq("id", id);
  if (error) throw listError(error, "We couldn't save the list. Try again.");
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await client().from("custom_lists").delete().eq("id", id);
  if (error) throw new AccountError("We couldn't delete the list. Try again.");
}

/** Saves the lists' order: each list's position is its place in `ids`. */
export async function setListOrder(ids: string[]): Promise<void> {
  const db = client();
  const results = await Promise.all(ids.map((id, position) => db.from("custom_lists").update({ position }).eq("id", id)));
  if (results.some((r) => r.error)) throw new AccountError("We couldn't save the new order. Try again.");
}

export async function addListBook(listId: string, bookId: string): Promise<void> {
  const { error } = await client().from("custom_list_items").insert({ list_id: listId, user_id: await signedInUserId(), volume_id: bookId });
  if (error && error.code !== "23505") throw listError(error, "We couldn't add the book to the list. Try again.");
}

export async function removeListBook(listId: string, bookId: string): Promise<void> {
  const { error } = await client().from("custom_list_items").delete().eq("list_id", listId).eq("volume_id", bookId);
  if (error) throw new AccountError("We couldn't remove the book from the list. Try again.");
}

/** Shares a list under `slug`, or stops sharing it (null): the old link stops working at once. */
export async function setListShare(id: string, slug: string | null): Promise<void> {
  const { error } = await client().from("custom_lists").update({ share_slug: slug }).eq("id", id);
  if (error) throw listError(error, slug ? "We couldn't share the list. Try again." : "We couldn't stop sharing the list. Try again.");
}

export async function saveRecentSearches(profileId: string, searches: string[]): Promise<void> {
  const { error } = await client().from("reader_profiles").update({ recent_searches: searches }).eq("id", profileId);
  if (error) throw new AccountError("We couldn't save your recent searches.");
}
