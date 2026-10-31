import { AccountError } from "./accountApi";
import { type MaintenanceNotice, type NoticeRow, toNotice } from "./maintenance";
import { supabase } from "./supabase";

/**
 * Maintenance notices, live from Supabase (maintenance_notices): everyone reads the ones showing
 * now; developers and admins read them all and add, change and delete them. The database checks
 * the role and the times; messages here are shown to people as they are.
 */

const COLUMNS = "id, title, message, announce_at, starts_at, ends_at";

/** The notices showing now (RLS keeps the rest back), or none without a backend. Rejects if they can't load. */
export async function loadShowingNotices(): Promise<MaintenanceNotice[]> {
  if (!supabase) return [];
  const now = new Date().toISOString();
  const { data, error } = await supabase.from("maintenance_notices").select(COLUMNS).lte("announce_at", now).gt("ends_at", now).order("starts_at");
  if (error) throw new AccountError("We couldn't check for planned updates.");
  return (data as NoticeRow[]).map(toNotice);
}

function client() {
  if (!supabase) throw new AccountError("Maintenance notices need the LiteraryWorm backend.");
  return supabase;
}

const NOT_ALLOWED = "Only developers and admins can change maintenance notices.";
const writeError = (error: { code?: string }) =>
  new AccountError(error.code === "42501" ? NOT_ALLOWED : error.code === "23514" ? "Check the times: the notice must show before the work starts, and the work must end after it starts." : "We couldn't save the notice. Try again.");

/** Every notice, for staff (others get only the ones showing). */
export async function loadAllNotices(): Promise<MaintenanceNotice[]> {
  const { data, error } = await client().from("maintenance_notices").select(COLUMNS).order("starts_at", { ascending: false });
  if (error) throw new AccountError("We couldn't load the notices. Refresh the page to try again.");
  return (data as NoticeRow[]).map(toNotice);
}

export interface NoticeInput {
  title: string;
  message: string;
  announceAt: number;
  startsAt: number;
  endsAt: number;
}

const toRow = (n: NoticeInput) => ({
  title: n.title.trim(),
  message: n.message.trim(),
  announce_at: new Date(n.announceAt).toISOString(),
  starts_at: new Date(n.startsAt).toISOString(),
  ends_at: new Date(n.endsAt).toISOString(),
});

export async function addNotice(input: NoticeInput): Promise<MaintenanceNotice> {
  const { data, error } = await client().from("maintenance_notices").insert(toRow(input)).select(COLUMNS).single();
  if (error) throw writeError(error);
  return toNotice(data as NoticeRow);
}

export async function updateNotice(id: string, input: NoticeInput): Promise<MaintenanceNotice> {
  const { data, error } = await client().from("maintenance_notices").update(toRow(input)).eq("id", id).select(COLUMNS).maybeSingle();
  if (error) throw writeError(error);
  if (!data) throw new AccountError(NOT_ALLOWED);
  return toNotice(data as NoticeRow);
}

export async function deleteNotice(id: string): Promise<void> {
  const { data, error } = await client().from("maintenance_notices").delete().eq("id", id).select("id");
  if (error) throw writeError(error);
  if (!data?.length) throw new AccountError(NOT_ALLOWED);
}
