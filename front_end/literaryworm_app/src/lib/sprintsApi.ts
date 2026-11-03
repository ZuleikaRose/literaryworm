import type { RealtimeChannel } from "@supabase/supabase-js";
import { AccountError } from "./accountApi";
import { tr } from "./i18n";
import type { Sprint, SprintReader, SprintScope } from "./sprints";
import { supabase } from "./supabase";

/** Reading sprints for members (migration 6649): read from the tables, written only through their functions. */
function client() {
  if (!supabase) throw new AccountError(tr("Reading sprints need the LiteraryWorm backend, which isn't set up in this copy of the app."));
  return supabase;
}

type SprintRow = { id: string; club_id: string | null; minutes: number; starts_at: string; ends_at: string };
const toSprint = (r: SprintRow): Sprint => ({
  id: r.id,
  clubId: r.club_id,
  minutes: r.minutes,
  startsAt: Date.parse(r.starts_at),
  endsAt: Date.parse(r.ends_at),
});

/** Turns the database's refusals into plain words. */
function problem(message: string | undefined, fallback: string): AccountError {
  const m = message ?? "";
  if (m.includes("already running")) return new AccountError(tr("A sprint is already running here. Join that one."));
  if (m.includes("20 sprints")) return new AccountError(tr("That's 20 sprints today. Try again tomorrow."));
  if (m.includes("has ended")) return new AccountError(tr("This sprint has ended."));
  if (m.includes("profiles")) return new AccountError(tr("Choose one of your profiles that's in use."));
  return new AccountError(fallback);
}

/** The household's or the club's latest sprint, running or not; null when there's none. */
export async function loadLatestSprint(scope: SprintScope, accountId: string): Promise<Sprint | null> {
  let query = client().from("reading_sprints").select("id, club_id, minutes, starts_at, ends_at");
  query = scope.kind === "club" ? query.eq("club_id", scope.clubId) : query.eq("account_id", accountId);
  const { data, error } = await query.order("starts_at", { ascending: false }).limit(1);
  if (error) throw new AccountError(tr("We couldn't load the reading sprint. Try again."));
  return data?.[0] ? toSprint(data[0] as SprintRow) : null;
}

export async function loadSprintReaders(sprintId: string): Promise<SprintReader[]> {
  const { data, error } = await client().rpc("reading_sprint_names", { p_sprint: sprintId });
  if (error) throw new AccountError(tr("We couldn't load who's in the sprint. Try again."));
  return ((data ?? []) as { profile_id: string; name: string; pages_read: number | null; finished: boolean; mine: boolean }[]).map((r) => ({
    profileId: r.profile_id,
    name: r.name,
    pages: r.pages_read,
    finished: r.finished,
    mine: r.mine,
  }));
}

export async function startSprint(scope: SprintScope, profileId: string, minutes: number): Promise<string> {
  const { data, error } = await client().rpc("start_reading_sprint", {
    p_club: scope.kind === "club" ? scope.clubId : null,
    p_profile: profileId,
    p_minutes: minutes,
  });
  if (error) throw problem(error.message, tr("We couldn't start the sprint. Try again."));
  return data as string;
}

export async function joinSprint(sprintId: string, profileId: string): Promise<void> {
  const { error } = await client().rpc("join_reading_sprint", { p_sprint: sprintId, p_profile: profileId });
  if (error) throw problem(error.message, tr("We couldn't join the sprint. Try again."));
}

export async function finishSprint(sprintId: string, profileId: string, pages: number): Promise<void> {
  const { error } = await client().rpc("finish_reading_sprint", { p_sprint: sprintId, p_profile: profileId, p_pages: pages });
  if (error) throw problem(error.message, tr("We couldn't save your pages. Try again."));
}

/**
 * Calls `onChange` when a sprint starts in the household or club, or someone joins or saves their
 * pages. Returns a function that stops listening.
 */
export function watchSprints(scope: SprintScope, accountId: string, onChange: () => void): () => void {
  const db = client();
  const filter = scope.kind === "club" ? `club_id=eq.${scope.clubId}` : `account_id=eq.${accountId}`;
  const channel: RealtimeChannel = db
    // Its own channel each time: channels sharing a name close together.
    .channel(`sprints:${scope.kind === "club" ? scope.clubId : accountId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "reading_sprints", filter }, onChange)
    // RLS keeps this to the readers of sprints this account can see.
    .on("postgres_changes", { event: "*", schema: "public", table: "reading_sprint_readers" }, onChange)
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
