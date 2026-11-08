/**
 * What of an upload's natural voice is kept on this device (the lw-uploads cache, lib/uploadCache.ts),
 * for *On this device* under Voice the whole book: how many parts and how much space, so a member
 * can check a book is ready before a trip and remove its audio after. Worked out from the cache's
 * own entries; nothing is sent anywhere.
 */

/** The cache path prefix of an upload's voiced parts. */
export const voicesPrefix = (uploadId: string) => `/uploads/${uploadId}/voices/`;

/** Of the cached entries (path and size in bytes), the upload's voiced parts: how many, and their bytes. */
export function voicePartsIn(entries: { path: string; bytes: number }[], uploadId: string): { parts: number; bytes: number } {
  const prefix = voicesPrefix(uploadId);
  let parts = 0;
  let bytes = 0;
  for (const e of entries) {
    if (!e.path.startsWith(prefix) || !e.path.endsWith(".mp3")) continue;
    parts += 1;
    bytes += Math.max(0, e.bytes);
  }
  return { parts, bytes };
}

/** A size in words: "640 KB", "23 MB", "1.2 GB" (1,000-based, as phones show storage). */
export function storageSize(bytes: number): string {
  const b = Math.max(0, bytes);
  if (b < 1_000_000) return `${Math.max(1, Math.round(b / 1000))} KB`;
  if (b < 1_000_000_000) return `${Math.round(b / 1_000_000)} MB`;
  return `${(b / 1_000_000_000).toFixed(1)} GB`;
}
