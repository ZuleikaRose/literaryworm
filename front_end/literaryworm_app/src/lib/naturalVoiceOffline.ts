import { naturalVoiceUrl } from "./naturalVoiceApi";
import { connectionAllows, type ConnectionInfo } from "./offlineSchedule";
import { voiceSegments } from "./naturalVoice";
import { hasVoiceOffline, keepVoiceOffline, offlineVoiceUrl } from "./uploadCache";

/**
 * Natural voices offline, for members' uploads: every part played is kept on this device (the
 * lw-uploads cache, beside the upload's text), the player plays a kept part from there first, and
 * on Wi-Fi (never with Data Saver) the rest of the playing chapter and the next one are voiced and
 * kept ahead. Parts voiced ahead count towards the month's natural-voice reading like any other.
 */

const log = (what: string) => (err: unknown) => console.error(`natural voices offline: couldn't ${what}:`, err instanceof Error ? err.message : err);

/** A part's link (the kept copy when there is one) and a way to keep one. */
export function memberVoicePart(uploadId: string, voiceId: string) {
  const keep = async (chapter: number, segment: number): Promise<void> => {
    if (await hasVoiceOffline(uploadId, voiceId, chapter, segment)) return;
    const url = await naturalVoiceUrl(uploadId, chapter, segment, voiceId);
    await keepVoiceOffline(uploadId, voiceId, chapter, segment, url);
  };
  const url = async (chapter: number, segment: number): Promise<string> => {
    const kept = await offlineVoiceUrl(uploadId, voiceId, chapter, segment).catch(() => null);
    if (kept) return kept;
    const link = await naturalVoiceUrl(uploadId, chapter, segment, voiceId);
    // Kept in the background; a failure only means no offline copy.
    keepVoiceOffline(uploadId, voiceId, chapter, segment, link).catch(log("keep a part"));
    return link;
  };
  return { url, keep };
}

/** The chapters to keep ahead while `chapter` plays: it and the next (when there is one). */
export function chaptersAhead(chapter: number, total: number): number[] {
  return [chapter, chapter + 1].filter((c) => c >= 0 && c < total);
}

/**
 * Called with the chapter that's playing: keeps its parts and the next chapter's on this device,
 * one at a time, once per chapter, when the connection allows (Wi-Fi, no Data Saver).
 */
export function voiceAhead(chapters: string[], keep: (chapter: number, segment: number) => Promise<void>) {
  const queued = new Set<number>();
  let running = Promise.resolve();
  return (chapter: number) => {
    const connection = (navigator as Navigator & { connection?: ConnectionInfo }).connection;
    if (!navigator.onLine || !connectionAllows(connection, { wifiOnly: true })) return;
    for (const c of chaptersAhead(chapter, chapters.length)) {
      if (queued.has(c)) continue;
      queued.add(c);
      const count = voiceSegments(chapters[c]).length;
      running = running.then(async () => {
        for (let s = 0; s < count; s++) {
          try {
            await keep(c, s);
          } catch (err) {
            // Out of this month's reading, offline, or a refusal: stop keeping ahead for now.
            log("keep a part ahead")(err);
            queued.delete(c);
            return;
          }
        }
      });
    }
  };
}
