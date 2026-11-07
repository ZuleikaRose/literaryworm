import { recordBedtime, recordReading } from "./accountApi";

/**
 * Sends a member's reading time to Supabase (record_reading) in whole minutes. Seconds build up
 * per profile, day and book (when the app knows which book is open; the book's place goes too, for
 * the book's statistics), with the listening part kept apart for stats; a minute is sent once
 * there's one, and a failed send stays in the buffer for the next try. Time under a minute when
 * the page closes isn't sent.
 */
type Buffer = { seconds: number; listened: number; profileId: string; day: string; bookId: string | null; fraction: number | null };
const buffered = new Map<string, Buffer>();
const sending = new Set<string>();

/** Capped at an hour, the most one call may add, so a long outage can't pile up more. */
const CAP = 3600;

export function addReadingSeconds(
  profileId: string,
  day: string,
  seconds: number,
  listening = false,
  book: { bookId: string; fraction: number | null } | null = null,
): void {
  const bookId = book?.bookId ?? null;
  const key = `${profileId}|${day}|${bookId ?? ""}`;
  const now = buffered.get(key) ?? { seconds: 0, listened: 0, profileId, day, bookId, fraction: null };
  const total = Math.min(CAP, now.seconds + seconds);
  buffered.set(key, {
    ...now,
    seconds: total,
    listened: Math.min(total, now.listened + (listening ? seconds : 0)),
    fraction: book?.fraction ?? now.fraction,
  });
  void send(key);
}

async function send(key: string): Promise<void> {
  const now = buffered.get(key);
  if (!now) return;
  const minutes = Math.min(60, Math.floor(now.seconds / 60));
  if (minutes === 0 || sending.has(key)) return;
  // Listening minutes are part of the minutes sent, never more.
  const listenedMinutes = Math.min(minutes, Math.floor(now.listened / 60));
  sending.add(key);
  buffered.set(key, { ...now, seconds: now.seconds - minutes * 60, listened: now.listened - listenedMinutes * 60 });
  try {
    await recordReading(now.profileId, now.day, minutes, 0, listenedMinutes, now.bookId ?? undefined, now.fraction);
  } catch (err) {
    // Put the minutes back for the next try; goals are worth keeping but never interrupt reading.
    console.error("goals: couldn't save reading time", (err as Error).message);
    const later = buffered.get(key) ?? now;
    const total = Math.min(CAP, later.seconds + minutes * 60);
    buffered.set(key, { ...later, seconds: total, listened: Math.min(total, later.listened + listenedMinutes * 60) });
  } finally {
    sending.delete(key);
  }
}

/**
 * Kids profiles' bedtime time, sent like reading time (record_bedtime) in whole minutes: minutes
 * in Bedtime listening, and minutes read or listened after bedtime. For the Kids reading report.
 */
const bedtimeBuffered = new Map<string, { profileId: string; day: string; bedtime: number; late: number }>();
const bedtimeSending = new Set<string>();

export function addBedtimeSeconds(profileId: string, day: string, seconds: number, kind: "bedtime" | "late"): void {
  const key = `${profileId}|${day}`;
  const now = bedtimeBuffered.get(key) ?? { profileId, day, bedtime: 0, late: 0 };
  bedtimeBuffered.set(key, { ...now, [kind]: Math.min(CAP, now[kind] + seconds) });
  void sendBedtime(key);
}

async function sendBedtime(key: string): Promise<void> {
  const now = bedtimeBuffered.get(key);
  if (!now || bedtimeSending.has(key)) return;
  const bedtime = Math.min(60, Math.floor(now.bedtime / 60));
  const late = Math.min(60, Math.floor(now.late / 60));
  if (bedtime === 0 && late === 0) return;
  bedtimeSending.add(key);
  bedtimeBuffered.set(key, { ...now, bedtime: now.bedtime - bedtime * 60, late: now.late - late * 60 });
  try {
    await recordBedtime(now.profileId, now.day, bedtime, late);
  } catch (err) {
    console.error("kids report: couldn't save bedtime time", (err as Error).message);
    const later = bedtimeBuffered.get(key) ?? now;
    bedtimeBuffered.set(key, { ...later, bedtime: Math.min(CAP, later.bedtime + bedtime * 60), late: Math.min(CAP, later.late + late * 60) });
  } finally {
    bedtimeSending.delete(key);
  }
}
