import type { Book, UploadedBook } from "../types";
import { fallbackCover } from "./coverFallback";

/**
 * Uploaded books as Books (pure, no React or store, so tests and lib/clubs.ts can use it): read
 * in the reader, or listened to in the player with a device voice reading the text (no
 * recording; lib/uploadRecording.ts finds a LibriVox one where the catalog has the title), rated
 * for everyone on the profile that uploaded them, with a drawn cover. lib/uploads.ts re-exports
 * these with the hooks.
 */

/** Average reading speed, for a chapter's length in minutes. */
const WORDS_PER_MINUTE = 230;

export const isUploadId = (id: string | undefined): id is string => Boolean(id && /^u-[0-9a-f]{32}$/.test(id));

/** A new upload's id: "u-" and 32 random hex digits. */
export const newUploadId = () => `u-${crypto.randomUUID().replace(/-/g, "")}`;

export function uploadToBook(upload: UploadedBook): Book {
  const words = Math.max(1, upload.words);
  return {
    id: upload.id,
    title: upload.title,
    author: upload.author || "Unknown author",
    publisher: "Your upload",
    year: new Date(upload.createdAt).getFullYear(),
    genres: ["Your books"],
    rating: 0,
    ratingsCount: 0,
    pages: Math.max(1, Math.round(words / 280)),
    formats: ["ebook", "audiobook"],
    ageRating: "all",
    language: "en",
    synopsis: "",
    cover: fallbackCover(upload.id),
    source: "upload",
    chapters: upload.chapterTitles.map((title, i) => ({ title, minutes: Math.max(1, (upload.chapterWords[i] ?? 0) / WORDS_PER_MINUTE) })),
    upload: { path: upload.path },
  };
}
