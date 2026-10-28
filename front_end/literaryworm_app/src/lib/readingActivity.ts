import { recordReading } from "./accountApi";

/**
 * Sends a member's reading time to Supabase (record_reading) in whole minutes. Seconds build up
 * per profile and day; a minute is sent once there's one, and a failed send stays in the
 * buffer for the next try. Time under a minute when the page closes isn't sent.
 */
const buffered = new Map<string, number>();
const sending = new Set<string>();

export function addReadingSeconds(profileId: string, day: string, seconds: number): void {
  const key = `${profileId}|${day}`;
  // Capped at an hour, the most one call may add, so a long outage can't pile up more.
  buffered.set(key, Math.min(3600, (buffered.get(key) ?? 0) + seconds));
  void send(profileId, day, key);
}

async function send(profileId: string, day: string, key: string): Promise<void> {
  const seconds = buffered.get(key) ?? 0;
  const minutes = Math.min(60, Math.floor(seconds / 60));
  if (minutes === 0 || sending.has(key)) return;
  sending.add(key);
  buffered.set(key, seconds - minutes * 60);
  try {
    await recordReading(profileId, day, minutes, 0);
  } catch {
    // Put the minutes back for the next try; goals are worth keeping but never interrupt reading.
    buffered.set(key, Math.min(3600, (buffered.get(key) ?? 0) + minutes * 60));
  } finally {
    sending.delete(key);
  }
}
