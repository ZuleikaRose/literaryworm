/**
 * Uploaded books' text (and natural-voice parts) kept on this device once opened, so they also open offline. A cache of
 * its own ("lw-uploads", same-origin keys like /uploads/<id>.json), filled by the app, not the
 * service worker (which never caches Supabase calls). Cleared when a book is deleted and, so a
 * shared device keeps nothing private, at sign-out.
 */
import { voicePartsIn, voicesPrefix } from "./offlineVoices";

const CACHE = "lw-uploads";
const key = (id: string) => `/uploads/${id}.json`;
const available = () => typeof caches !== "undefined";

/** Keeps an upload's chapters on this device. Losing them only means no offline copy. */
export async function keepUploadOffline(id: string, chapters: string[]): Promise<void> {
  if (!available()) return;
  const cache = await caches.open(CACHE);
  await cache.put(key(id), new Response(JSON.stringify({ chapters }), { headers: { "Content-Type": "application/json" } }));
}

/** The chapters kept on this device, or null. */
export async function offlineUploadText(id: string): Promise<string[] | null> {
  if (!available()) return null;
  const hit = await caches.match(key(id), { cacheName: CACHE });
  if (!hit) return null;
  const chapters = ((await hit.json()) as { chapters?: unknown }).chapters;
  return Array.isArray(chapters) && chapters.every((c) => typeof c === "string") ? (chapters as string[]) : null;
}

export async function forgetUploadOffline(id: string): Promise<void> {
  if (!available()) return;
  const cache = await caches.open(CACHE);
  await cache.delete(key(id));
  // And any natural-voice parts kept for it.
  const prefix = `/uploads/${id}/voices/`;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname.startsWith(prefix)) await cache.delete(request);
  }
}

/**
 * Natural-voice parts of an upload kept on this device, so a member can listen without a
 * connection: every part played, and the ones voiced ahead on Wi-Fi. Same cache, same clearing.
 */
const voiceKey = (uploadId: string, voiceId: string, chapter: number, segment: number | string) =>
  `/uploads/${uploadId}/voices/${voiceId}-${chapter}-${segment}.mp3`;

/** Keeps a voiced part (from its signed link) on this device; false when it couldn't. */
export async function keepVoiceOffline(uploadId: string, voiceId: string, chapter: number, segment: number | string, url: string): Promise<boolean> {
  if (!available()) return false;
  const res = await fetch(url);
  if (!res.ok) return false;
  const cache = await caches.open(CACHE);
  await cache.put(voiceKey(uploadId, voiceId, chapter, segment), new Response(await res.blob(), { headers: { "Content-Type": "audio/mpeg" } }));
  return true;
}

export async function hasVoiceOffline(uploadId: string, voiceId: string, chapter: number, segment: number | string): Promise<boolean> {
  if (!available()) return false;
  return Boolean(await caches.match(voiceKey(uploadId, voiceId, chapter, segment), { cacheName: CACHE }));
}

// Links made for kept parts; the oldest are let go so a long listen doesn't hold every part in memory.
const madeLinks: string[] = [];

/** A playable link to a kept part, or null when it isn't on this device. */
export async function offlineVoiceUrl(uploadId: string, voiceId: string, chapter: number, segment: number | string): Promise<string | null> {
  if (!available()) return null;
  const hit = await caches.match(voiceKey(uploadId, voiceId, chapter, segment), { cacheName: CACHE });
  if (!hit) return null;
  const link = URL.createObjectURL(await hit.blob());
  madeLinks.push(link);
  while (madeLinks.length > 6) URL.revokeObjectURL(madeLinks.shift()!);
  return link;
}

/** A kept part's audio, or null when it isn't on this device (for downloading the audiobook). */
export async function offlineVoiceBlob(uploadId: string, voiceId: string, chapter: number, segment: number | string): Promise<Blob | null> {
  if (!available()) return null;
  const hit = await caches.match(voiceKey(uploadId, voiceId, chapter, segment), { cacheName: CACHE });
  return hit ? hit.blob() : null;
}

/** How many of an upload's voiced parts are on this device, and their size (lib/offlineVoices.ts). */
export async function voicesOnDevice(uploadId: string): Promise<{ parts: number; bytes: number }> {
  if (!available()) return { parts: 0, bytes: 0 };
  const cache = await caches.open(CACHE);
  const entries: { path: string; bytes: number }[] = [];
  for (const request of await cache.keys()) {
    const path = new URL(request.url).pathname;
    if (!path.startsWith(voicesPrefix(uploadId))) continue;
    const hit = await cache.match(request);
    entries.push({ path, bytes: hit ? (await hit.blob()).size : 0 });
  }
  return voicePartsIn(entries, uploadId);
}

/** Removes an upload's voiced parts from this device, keeping its text (it can be voiced or played again online). */
export async function forgetVoicesOffline(uploadId: string): Promise<void> {
  if (!available()) return;
  const cache = await caches.open(CACHE);
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname.startsWith(voicesPrefix(uploadId))) await cache.delete(request);
  }
}

/** Removes every upload kept on this device (at sign-out). */
export async function forgetAllUploadsOffline(): Promise<void> {
  if (!available()) return;
  await caches.delete(CACHE);
}
