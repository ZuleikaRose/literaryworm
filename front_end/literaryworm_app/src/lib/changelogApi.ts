import { AccountError, signedInUserId } from "./accountApi";
import type { ChangeEntry, ChangeInput } from "./changelog";
import { PUBLISHABLE_KEY, SUPABASE_URL } from "./backend";
import { supabase } from "./supabase";

/**
 * What's new, live from Supabase (changelog_entries: anyone reads; editors, developers and
 * admins add, change and delete). Every message here is shown to people as is.
 */

type Row = { id: string; released_on: string; version: string; kind: ChangeEntry["kind"]; title: string; body: string; major: boolean };

const COLUMNS = "id, released_on, version, kind, title, body, major";
const toEntry = (r: Row): ChangeEntry => ({ id: r.id, releasedOn: r.released_on, version: r.version, kind: r.kind, title: r.title, body: r.body, major: r.major });
const toRow = (e: ChangeInput) => ({ released_on: e.releasedOn, version: e.version.trim(), kind: e.kind, title: e.title.trim(), body: e.body.trim(), major: e.major });

/** Every entry, newest first, or null without a backend. Rejects if they can't load. */
export async function loadChangelog(): Promise<ChangeEntry[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("changelog_entries").select(COLUMNS).order("released_on", { ascending: false }).order("created_at");
  if (error) throw new AccountError("We couldn't load the latest changes.");
  return (data as Row[]).map(toEntry);
}

function client() {
  if (!supabase) throw new AccountError("Writing What's new needs the LiteraryWorm backend.");
  return supabase;
}

const writeError = (error: { code?: string }) =>
  new AccountError(error.code === "42501" ? "Only editors, developers and admins can change What's new." : "We couldn't save the change. Try again.");

export async function addEntry(input: ChangeInput): Promise<ChangeEntry> {
  const created_by = await signedInUserId();
  const { data, error } = await client().from("changelog_entries").insert({ ...toRow(input), created_by }).select(COLUMNS).single();
  if (error) throw writeError(error);
  return toEntry(data as Row);
}

export async function updateEntry(id: string, input: ChangeInput): Promise<ChangeEntry> {
  const { data, error } = await client().from("changelog_entries").update(toRow(input)).eq("id", id).select(COLUMNS).maybeSingle();
  if (error) throw writeError(error);
  if (!data) throw new AccountError("Only editors, developers and admins can change What's new.");
  return toEntry(data as Row);
}

export async function deleteEntry(id: string): Promise<void> {
  const { data, error } = await client().from("changelog_entries").delete().eq("id", id).select("id");
  if (error) throw writeError(error);
  if (!data?.length) throw new AccountError("Only editors, developers and admins can change What's new.");
}

/** The optional emails an unsubscribe link can turn off (the unsubscribe function's lists). */
export type EmailList = "whats-new" | "kids-report";

/** Turns off one optional email for the account a signed link is for (the unsubscribe function). */
export async function unsubscribe(token: string, list: EmailList = "whats-new"): Promise<void> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new AccountError("Unsubscribing needs the LiteraryWorm backend. Turn the email off in Account → Preferences.");
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/unsubscribe`, {
      method: "POST",
      headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ token, list }),
    });
  } catch {
    throw new AccountError("We couldn't reach LiteraryWorm. Check your connection and try again.");
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new AccountError(body?.error?.code === "bad_request" && body.error.message ? body.error.message : "We couldn't unsubscribe you just now. Try again, or turn the email off in Account → Preferences.");
  }
}
