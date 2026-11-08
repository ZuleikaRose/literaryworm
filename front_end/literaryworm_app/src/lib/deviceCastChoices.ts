import { CAST_CHOICES_MAX, CAST_SPEAKER_MAX } from "./naturalVoice";
import { CAST_BOOKS_MAX } from "./castChoices";

/**
 * Who reads whom with a device voice (a classic's own text, or an upload read by the device):
 * the listener's pick of the device's voices for named speakers, per book
 * (PlayerSettings.deviceCastChoices, members' reader_profiles.device_cast_choices, migration 6812).
 * Kept by the voice's name, which reads the same on devices of the same kind; a voice another
 * device doesn't have is dealt out instead (castVoiceFor() in lib/deviceCast.ts).
 */
export type DeviceCastChoices = Record<string, string>;

/** The longest voice name kept (device voice names are short, like "Google UK English Female"). */
export const DEVICE_VOICE_NAME_MAX = 120;

/** One book's choices, checked: lower-case speakers to voice names, at most CAST_CHOICES_MAX. */
export function parseDeviceCastChoices(value: unknown): DeviceCastChoices {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: DeviceCastChoices = {};
  for (const [speaker, name] of Object.entries(value as Record<string, unknown>)) {
    if (Object.keys(out).length >= CAST_CHOICES_MAX) break;
    const key = speaker.trim().toLowerCase();
    if (!key || key.length > CAST_SPEAKER_MAX || typeof name !== "string") continue;
    const voice = name.trim();
    if (voice && voice.length <= DEVICE_VOICE_NAME_MAX) out[key] = voice;
  }
  return out;
}

/** All of a profile's choices with one speaker's device voice set (null to deal it out again). */
export function withDeviceCastChoice(
  all: Record<string, DeviceCastChoices> | undefined,
  bookId: string,
  speaker: string,
  voice: string | null,
): Record<string, DeviceCastChoices> {
  const next = { ...(all ?? {}) };
  const book = { ...(next[bookId] ?? {}) };
  const key = speaker.trim().toLowerCase();
  delete book[key];
  if (voice !== null && Object.keys(book).length < CAST_CHOICES_MAX) book[key] = voice;
  delete next[bookId];
  const parsed = parseDeviceCastChoices(book);
  if (Object.keys(parsed).length) next[bookId] = parsed;
  const ids = Object.keys(next);
  for (const id of ids.slice(0, Math.max(0, ids.length - CAST_BOOKS_MAX))) delete next[id];
  return next;
}

/** Every book's choices read back from the database: valid ones only, the newest CAST_BOOKS_MAX. */
export function parseAllDeviceCastChoices(value: unknown): Record<string, DeviceCastChoices> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, DeviceCastChoices> = {};
  for (const [bookId, choices] of Object.entries(value as Record<string, unknown>).slice(-CAST_BOOKS_MAX)) {
    const parsed = parseDeviceCastChoices(choices);
    if (bookId.length <= 64 && Object.keys(parsed).length) out[bookId] = parsed;
  }
  return out;
}

/** A short, stable key for a book's choices (so the narrator starts again when they change). */
export const deviceCastKey = (choices: DeviceCastChoices | undefined) =>
  Object.keys(choices ?? {})
    .sort()
    .map((k) => `${k}=${choices![k]}`)
    .join(",");
