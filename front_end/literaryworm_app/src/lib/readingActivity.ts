import { recordReading } from "./accountApi";

/**
 * Sends a member's reading time to Supabase (record_reading) in whole minutes. Seconds build up
 * per profile and day, with the listening part kept apart for stats; a minute is sent once
 * there's one, and a failed send stays in the buffer for the next try. Time under a minute when
 * the page closes isn't sent.
 */
const buffered = new Map<string, { seconds: number; listened: number }>();
const sending = new Set<string>();

/** Capped at an hour, the most one call may add, so a long outage can't pile up more. */
const CAP = 3600;

export function addReadingSeconds(profileId: string, day: string, seconds: number, listening = false): void {
  const key = `${profileId}|${day}`;
  const now = buffered.get(key) ?? { seconds: 0, listened: 0 };
  const total = Math.min(CAP, now.seconds + seconds);
  buffered.set(key, { seconds: total, listened: Math.min(total, now.listened + (listening ? seconds : 0)) });
  void send(profileId, day, key);
}

async function send(profileId: string, day: string, key: string): Promise<void> {
  const { seconds, listened } = buffered.get(key) ?? { seconds: 0, listened: 0 };
  const minutes = Math.min(60, Math.floor(seconds / 60));
  if (minutes === 0 || sending.has(key)) return;
  // Listening minutes are part of the minutes sent, never more.
  const listenedMinutes = Math.min(minutes, Math.floor(listened / 60));
  sending.add(key);
  buffered.set(key, { seconds: seconds - minutes * 60, listened: listened - listenedMinutes * 60 });
  try {
    await recordReading(profileId, day, minutes, 0, listenedMinutes);
  } catch (err) {
    // Put the minutes back for the next try; goals are worth keeping but never interrupt reading.
    console.error("goals: couldn't save reading time", (err as Error).message);
    const now = buffered.get(key) ?? { seconds: 0, listened: 0 };
    const total = Math.min(CAP, now.seconds + minutes * 60);
    buffered.set(key, { seconds: total, listened: Math.min(total, now.listened + listenedMinutes * 60) });
  } finally {
    sending.delete(key);
  }
}
