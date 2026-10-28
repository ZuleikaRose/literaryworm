import type { RealtimeChannel } from "@supabase/supabase-js";
import { AccountError, signedInUserId } from "./accountApi";
import { supabase } from "./supabase";

/**
 * Listening on another device, for members (listening_devices, playback_handoffs; RLS keeps
 * each account to its own rows). Every open copy of the app is a device while a member is
 * signed in; sending a book to one leaves a handoff there for it to pick up. Every message
 * here is shown to people as is.
 */

function client() {
  if (!supabase) throw new AccountError("Listening on another device needs the LiteraryWorm backend, which isn't set up in this copy of the app.");
  return supabase;
}

export interface ListeningDevice {
  id: string;
  label: string;
  lastSeenAt: number;
}

export interface Handoff {
  id: string;
  profileId: string;
  bookId: string;
  /** Seconds from the start of the book. */
  position: number;
  /** The device it came from, as it was named when sent. */
  fromLabel: string;
  createdAt: number;
}

type DeviceRow = { id: string; label: string; last_seen_at: string };
type HandoffRow = { id: string; profile_id: string; volume_id: string; position_seconds: number; from_label: string; created_at: string };

/** A device counts as open if it checked in within this long (it checks in every minute). */
export const DEVICE_FRESH_MS = 150_000;
/** Handoffs older than this aren't offered: the listener has moved on. */
export const HANDOFF_FRESH_MS = 15 * 60_000;
/** Devices not seen for a day are cleared (with their handoffs) when this device signs in. */
const DEVICE_KEPT_MS = 86_400_000;

const HANDOFF_COLUMNS = "id, profile_id, volume_id, position_seconds, from_label, created_at";

const toHandoff = (row: HandoffRow): Handoff => ({
  id: row.id,
  profileId: row.profile_id,
  bookId: row.volume_id,
  position: row.position_seconds,
  fromLabel: row.from_label,
  createdAt: Date.parse(row.created_at),
});

/** This copy of the app's name for the list: "Chrome on Windows". */
export function deviceLabel(userAgent = navigator.userAgent): string {
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /OPR\//.test(userAgent)
      ? "Opera"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Chrome\//.test(userAgent)
          ? "Chrome"
          : /Safari\//.test(userAgent)
            ? "Safari"
            : "A browser";
  const system = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Mac OS X/.test(userAgent)
            ? "Mac"
            : /CrOS/.test(userAgent)
              ? "Chromebook"
              : /Linux/.test(userAgent)
                ? "Linux"
                : "";
  return system ? `${browser} on ${system}` : browser;
}

/** Adds this device to the account's list, and clears devices that haven't been seen for a day. */
export async function registerDevice(id: string, label: string): Promise<void> {
  const db = client();
  const userId = await signedInUserId();
  const { error } = await db.from("listening_devices").insert({ id, user_id: userId, label });
  // Already there (signed in again in the same visit): checking in is enough.
  if (error && error.code !== "23505") throw new AccountError("We couldn't add this device to your account.");
  if (error) await touchDevice(id);
  await db
    .from("listening_devices")
    .delete()
    .lt("last_seen_at", new Date(Date.now() - DEVICE_KEPT_MS).toISOString())
    .neq("id", id);
}

/** Says this device is still open (the database stamps the time). */
export async function touchDevice(id: string): Promise<void> {
  const { error } = await client().rpc("touch_listening_device", { p_id: id });
  if (error) throw new AccountError("We couldn't reach LiteraryWorm.");
}

/** The account's other open devices, most recently seen first. */
export async function loadDevices(exceptId: string): Promise<ListeningDevice[]> {
  const { data, error } = await client()
    .from("listening_devices")
    .select("id, label, last_seen_at")
    .neq("id", exceptId)
    .gt("last_seen_at", new Date(Date.now() - DEVICE_FRESH_MS).toISOString())
    .order("last_seen_at", { ascending: false });
  if (error) throw new AccountError("We couldn't load your devices. Try again.");
  return (data as DeviceRow[]).map((d) => ({ id: d.id, label: d.label, lastSeenAt: Date.parse(d.last_seen_at) }));
}

/** Leaves a book, at a place, on another of the account's devices for `profileId` to pick up. */
export async function sendHandoff(input: {
  toDeviceId: string;
  profileId: string;
  bookId: string;
  position: number;
  fromLabel: string;
}): Promise<void> {
  const { error } = await client()
    .from("playback_handoffs")
    .insert({
      user_id: await signedInUserId(),
      profile_id: input.profileId,
      volume_id: input.bookId,
      position_seconds: Math.max(0, Math.floor(input.position)),
      from_label: input.fromLabel,
      to_device_id: input.toDeviceId,
    });
  if (error) {
    // The device closed (and was cleared) between listing and sending.
    if (error.code === "23503") throw new AccountError("That device isn't open any more. Choose another.");
    throw new AccountError("We couldn't send the book. Try again.");
  }
}

/** The newest handoff waiting on this device, if any. */
export async function latestHandoff(deviceId: string): Promise<Handoff | null> {
  const { data, error } = await client()
    .from("playback_handoffs")
    .select(HANDOFF_COLUMNS)
    .eq("to_device_id", deviceId)
    .is("claimed_at", null)
    .gt("created_at", new Date(Date.now() - HANDOFF_FRESH_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new AccountError("We couldn't check for books sent here.");
  const row = (data as HandoffRow[])[0];
  return row ? toHandoff(row) : null;
}

/** Marks a handoff picked up or turned down, so it isn't offered again. */
export async function claimHandoff(id: string): Promise<void> {
  const { error } = await client().from("playback_handoffs").update({ claimed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new AccountError("We couldn't reach LiteraryWorm.");
}

/** Calls `onHandoff` as books are sent to this device. Returns a function that stops listening. */
export function watchHandoffs(deviceId: string, onHandoff: (handoff: Handoff) => void): () => void {
  const db = client();
  const channel: RealtimeChannel = db
    .channel(`handoffs:${deviceId}`)
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "playback_handoffs", filter: `to_device_id=eq.${deviceId}` },
      (payload) => onHandoff(toHandoff(payload.new as HandoffRow)),
    )
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}
