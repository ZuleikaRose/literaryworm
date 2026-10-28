import type { Book } from "../types";

/**
 * Books saved on this device for reading and listening offline (public-domain titles only: the
 * Project Gutenberg text, and the LibriVox audio if chosen). They go in the "lw-books" cache,
 * which the service worker (public/sw.js) serves from when there's no connection.
 */

const BOOKS = "lw-books";

/** LibriVox's 64 kbit/s MP3s are about 8 KB a second. */
const AUDIO_BYTES_PER_SECOND = 8_000;

export const offlineSupported = () => typeof caches !== "undefined" && "serviceWorker" in navigator;

const textUrl = (book: Book) => `/texts/${book.id}.json`;
const audioUrls = (book: Book) => book.recording?.tracks.map((t) => t.url) ?? [];

export function audioMegabytes(book: Book): number {
  const seconds = book.recording?.tracks.reduce((sum, t) => sum + t.seconds, 0) ?? 0;
  return Math.round((seconds * AUDIO_BYTES_PER_SECOND) / 1_000_000);
}

export interface OfflineState {
  text: boolean;
  /** Tracks saved, of `tracks`. */
  audio: number;
  tracks: number;
}

export async function offlineState(book: Book): Promise<OfflineState> {
  const tracks = audioUrls(book);
  if (!offlineSupported()) return { text: false, audio: 0, tracks: tracks.length };
  const cache = await caches.open(BOOKS);
  const [text, ...audio] = await Promise.all([cache.match(textUrl(book)), ...tracks.map((url) => cache.match(url))]);
  return { text: Boolean(text), audio: audio.filter(Boolean).length, tracks: tracks.length };
}

export class OfflineError extends Error {}

async function save(cache: Cache, url: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { mode: "cors" });
  } catch {
    throw new OfflineError("We couldn't download that. Check your connection and try again.");
  }
  if (!res.ok) throw new OfflineError("We couldn't download part of this book. Try again later.");
  try {
    await cache.put(url, res);
  } catch {
    throw new OfflineError("This device is out of space for offline books. Remove one, then try again.");
  }
}

/** Saves the text, and the audio when `withAudio`, reporting tracks done. Already-saved parts are skipped. */
export async function saveOffline(book: Book, withAudio: boolean, onProgress?: (done: number, total: number) => void): Promise<void> {
  if (!offlineSupported()) throw new OfflineError("This browser can't keep books for offline use.");
  // Ask the browser not to clear saved books when space runs low (it may say no).
  await navigator.storage?.persist?.().catch(() => false);
  const cache = await caches.open(BOOKS);
  if (!(await cache.match(textUrl(book)))) await save(cache, textUrl(book));
  if (!withAudio) return;
  const urls = audioUrls(book);
  for (const [i, url] of urls.entries()) {
    if (!(await cache.match(url))) await save(cache, url);
    onProgress?.(i + 1, urls.length);
  }
}

export async function removeOffline(book: Book): Promise<void> {
  if (!offlineSupported()) return;
  const cache = await caches.open(BOOKS);
  await Promise.all([textUrl(book), ...audioUrls(book)].map((url) => cache.delete(url)));
}

/** Starts the service worker (production builds only: in development it would cache stale files). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => console.error("offline: service worker failed to start", err));
  });
}
