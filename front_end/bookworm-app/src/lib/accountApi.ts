import type { AccountReading } from "../store/state";
import type {
  AgeRating,
  Account,
  Bookmark,
  Format,
  Highlight,
  HighlightColor,
  LibraryEntry,
  PlanId,
  Profile,
  Progress,
  ReadingStatus,
} from "../types";
import { SUPABASE_URL } from "./backend";
import { SESSION_STORAGE_KEY, supabase } from "./supabase";

/**
 * Real accounts, through Supabase Auth and the tables' RLS. Every message here is shown to
 * people as is, so it says what happened and what to do, never a raw error.
 */

export class AccountError extends Error {}

const OFFLINE = "We couldn't reach BookWorm. Check your connection and try again.";

function client() {
  if (!supabase) throw new AccountError("Accounts need the BookWorm backend, which isn't set up in this copy of the app.");
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
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!password) return false;
  let error: Parameters<typeof authMessage>[0] | null;
  try {
    ({ error } = await client().auth.signInWithPassword({ email, password }));
  } catch {
    throw new AccountError(OFFLINE);
  }
  if (!error) return true;
  // 400 is Supabase's answer for a wrong email or password.
  if (error.status === 400 || (error.message ?? "").toLowerCase().includes("invalid login")) return false;
  throw new AccountError(authMessage(error));
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
}

const SUBSCRIPTION_COLUMNS = "plan_id, billing_day, status, cancel_at_period_end, current_period_end";

/** The account's plan fields from a subscriptions row (or none yet). */
function fromSubscription(row: SubscriptionRow | null): Pick<Account, "planId" | "billingDay" | "status" | "endsAt"> {
  const status = row?.status;
  return {
    planId: (row?.plan_id as PlanId | undefined) ?? null,
    billingDay: row?.billing_day ?? null,
    status: status === "paused" || status === "cancelled" ? status : "active",
    endsAt: row?.cancel_at_period_end ? row.current_period_end : null,
  };
}

/**
 * Calls one of BookWorm's Edge Functions as the signed-in member. A refused password comes
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

/** Chooses or changes the plan through the `checkout` Edge Function (subscriptions are server-written). */
export async function choosePlan(planId: PlanId, billingDay: number): Promise<void> {
  await callFunction("checkout", { planId, billingDay, renewalTermsAccepted: true }, "We couldn't save your plan. Try again.");
}

// --- Membership and the account (manage-account function) ------------------

export type MembershipAction = "pause" | "resume" | "cancel" | "restart";

/** Pauses, resumes, cancels or restarts the membership; returns the account's new plan fields. */
export async function changeMembership(action: MembershipAction) {
  const row = await callFunction<SubscriptionRow>("manage-account", { action }, "We couldn't change your membership. Try again.");
  return fromSubscription(row);
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

async function signedInUserId(): Promise<string> {
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
