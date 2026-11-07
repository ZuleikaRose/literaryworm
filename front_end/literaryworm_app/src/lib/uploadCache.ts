/**
 * Uploaded books' text (and natural-voice parts) kept on this device once opened, so they also open offline. A cache of
 * its own ("lw-uploads", same-origin keys like /uploads/<id>.json), filled by the app, not the
 * service worker (which never caches Supabase calls). Cleared when a book is deleted and, so a
 * shared device keeps nothing private, at sign-out.
 */
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
const voiceKey = (uploadId: string, voiceId: string, chapter: number, segment: number) =>
  `/uploads/${uploadId}/voices/${voiceId}-${chapter}-${segment}.mp3`;

/** Keeps a voiced part (from its signed link) on this device; false when it couldn't. */
export async function keepVoiceOffline(uploadId: string, voiceId: string, chapter: number, segment: number, url: string): Promise<boolean> {
  if (!available()) return false;
  const res = await fetch(url);
  if (!res.ok) return false;
  const cache = await caches.open(CACHE);
  await cache.put(voiceKey(uploadId, voiceId, chapter, segment), new Response(await res.blob(), { headers: { "Content-Type": "audio/mpeg" } }));
  return true;
}

export async function hasVoiceOffline(uploadId: string, voiceId: string, chapter: number, segment: number): Promise<boolean> {
  if (!available()) return false;
  return Boolean(await caches.match(voiceKey(uploadId, voiceId, chapter, segment), { cacheName: CACHE }));
}

// Links made for kept parts; the oldest are let go so a long listen doesn't hold every part in memory.
const madeLinks: string[] = [];

/** A playable link to a kept part, or null when it isn't on this device. */
export async function offlineVoiceUrl(uploadId: string, voiceId: string, chapter: number, segment: number): Promise<string | null> {
  if (!available()) return null;
  const hit = await caches.match(voiceKey(uploadId, voiceId, chapter, segment), { cacheName: CACHE });
  if (!hit) return null;
  const link = URL.createObjectURL(await hit.blob());
  madeLinks.push(link);
  while (madeLinks.length > 6) URL.revokeObjectURL(madeLinks.shift()!);
  return link;
}

/** Removes every upload kept on this device (at sign-out). */
export async function forgetAllUploadsOffline(): Promise<void> {
  if (!available()) return;
  await caches.delete(CACHE);
}
