import type { RealtimeChannel } from "@supabase/supabase-js";
import { AccountError, signedInUserId } from "./accountApi";
import { supabase } from "./supabase";

/**
 * Listen along: one club_listening row per club, moved by its host and heard by members
 * through Supabase Realtime (members-only RLS). Every message here is shown to people as is.
 */

function client() {
  if (!supabase) throw new AccountError("Listening along needs the LiteraryWorm backend, which isn't set up in this copy of the app.");
  return supabase;
}

export interface ListenSession {
  clubId: string;
  hostId: string;
  /** Seconds into the book when it was last moved. */
  position: number;
  playing: boolean;
  rate: number;
  /** The database's time of the last move. */
  updatedAt: number;
  /** When this device heard it: the place now is worked out from this, not the database's clock. */
  heardAt: number;
}

/** A session not moved for this long has been left (the host's heartbeat is every 30 seconds). */
export const SESSION_LEFT_MS = 120_000;

type Row = { club_id: string; host_id: string; position_seconds: number; playing: boolean; rate: number; updated_at: string };
const COLUMNS = "club_id, host_id, position_seconds, playing, rate, updated_at";

const toSession = (row: Row, heardAt = Date.now()): ListenSession => ({
  clubId: row.club_id,
  hostId: row.host_id,
  position: row.position_seconds,
  playing: row.playing,
  rate: row.rate,
  updatedAt: Date.parse(row.updated_at),
  heardAt,
});

/** Where the session is now: its place, plus the time since it was heard if it's playing. */
export function livePosition(session: ListenSession, now = Date.now()): number {
  return session.playing ? session.position + ((now - session.heardAt) / 1000) * session.rate : session.position;
}

/** Whether the session has been left (nobody has moved it for two minutes). */
export const isLeft = (session: ListenSession, now = Date.now()) => now - session.updatedAt > SESSION_LEFT_MS;

/** The club's session, or null. On first load the database's time stands in for when it was heard. */
export async function loadSession(clubId: string): Promise<ListenSession | null> {
  const { data, error } = await client().from("club_listening").select(COLUMNS).eq("club_id", clubId).maybeSingle();
  if (error) throw new AccountError("We couldn't check for a listening session. Try again.");
  if (!data) return null;
  const row = data as Row;
  // Clocks differ between devices; never count from a time in this device's future.
  return toSession(row, Math.min(Date.now(), Date.parse(row.updated_at)));
}

/** Starts (or takes over a left) session with this account as its host. */
export async function startSession(clubId: string, place: { position: number; playing: boolean; rate: number }): Promise<void> {
  const db = client();
  const host = await signedInUserId();
  const row = { host_id: host, position_seconds: place.position, playing: place.playing, rate: place.rate };
  const inserted = await db.from("club_listening").insert({ club_id: clubId, ...row });
  if (!inserted.error) return;
  if (inserted.error.code !== "23505") throw new AccountError("We couldn't start the session. Try again.");
  // There's a session already: take it over, which RLS allows only once it's been left.
  const taken = await db.from("club_listening").update(row).eq("club_id", clubId).select("club_id");
  if (taken.error) throw new AccountError("We couldn't start the session. Try again.");
  if (!taken.data.length) throw new AccountError("Someone is already leading a session. Join it instead.");
}

/** Moves the session (the host only). */
export async function moveSession(clubId: string, place: { position: number; playing: boolean; rate: number }): Promise<void> {
  const { error } = await client()
    .from("club_listening")
    .update({ position_seconds: Math.max(0, place.position), playing: place.playing, rate: place.rate })
    .eq("club_id", clubId);
  if (error) throw new AccountError("We couldn't update the session.");
}

/** Ends the session (its host, or the club's owner). */
export async function endSession(clubId: string): Promise<void> {
  const { error } = await client().from("club_listening").delete().eq("club_id", clubId);
  if (error) throw new AccountError("We couldn't end the session. Try again.");
}

/** Calls `onChange` with the club's session as it moves (null once it ends). Returns a function that stops listening. */
export function watchSession(clubId: string, onChange: (session: ListenSession | null) => void): () => void {
  const db = client();
  const channel: RealtimeChannel = db
    // Its own channel each time: the club page, a member following and the host may all watch at
    // once, and channels sharing a name close together.
    .channel(`listening:${clubId}:${crypto.randomUUID()}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "club_listening", filter: `club_id=eq.${clubId}` }, (payload) => {
      if (payload.eventType === "DELETE") onChange(null);
      else onChange(toSession(payload.new as Row));
    })
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

export const myId = signedInUserId;
