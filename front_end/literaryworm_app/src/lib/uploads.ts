import { useMemo } from "react";
import { useProfileData } from "../store/context";
import type { Book, UploadedBook } from "../types";
import { fallbackCover } from "./coverFallback";

/**
 * Uploaded books as Books, so the reader, library, progress and highlights treat them like any
 * title. Ebook only (no recording), rated for everyone on the profile that uploaded them, with a
 * drawn cover. Their text is kept in Supabase Storage for members, in this tab for the demo.
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
    formats: ["ebook"],
    ageRating: "all",
    language: "en",
    synopsis: "",
    cover: fallbackCover(upload.id),
    source: "upload",
    chapters: upload.chapterTitles.map((title, i) => ({ title, minutes: Math.max(1, (upload.chapterWords[i] ?? 0) / WORDS_PER_MINUTE) })),
    upload: { path: upload.path },
  };
}

/** The demo's uploaded texts, kept in this tab like the rest of the demo. */
export const tabTexts = new Map<string, string[]>();

/** The active profile's uploaded book with this id, as a Book. */
export function useUploadedBook(id: string | undefined): Book | undefined {
  const { uploads } = useProfileData();
  const upload = isUploadId(id) ? uploads.find((u) => u.id === id) : undefined;
  // The same Book while the upload is unchanged, so the reader doesn't load its text again.
  return useMemo(() => (upload ? uploadToBook(upload) : undefined), [upload]);
}
