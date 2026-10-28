/**
 * Uploaded books' text kept on this device once opened, so they also open offline. A cache of
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
}

/** Removes every upload kept on this device (at sign-out). */
export async function forgetAllUploadsOffline(): Promise<void> {
  if (!available()) return;
  await caches.delete(CACHE);
}
