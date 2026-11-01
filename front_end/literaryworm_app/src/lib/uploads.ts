import { useMemo } from "react";
import { useProfileData } from "../store/context";
import type { Book } from "../types";
import { isUploadId, uploadToBook } from "./uploadBook";

export { isUploadId, newUploadId, uploadToBook } from "./uploadBook";

/**
 * Uploaded books as Books, so the reader, library, progress and highlights treat them like any
 * title. Ebook only (no recording), rated for everyone on the profile that uploaded them, with a
 * drawn cover. Their text is kept in Supabase Storage for members, in this tab for the demo.
 */

/** The demo's uploaded texts, kept in this tab like the rest of the demo. */
export const tabTexts = new Map<string, string[]>();

/** The active profile's uploaded book with this id, as a Book. */
export function useUploadedBook(id: string | undefined): Book | undefined {
  const { uploads } = useProfileData();
  const upload = isUploadId(id) ? uploads.find((u) => u.id === id) : undefined;
  // The same Book while the upload is unchanged, so the reader doesn't load its text again.
  return useMemo(() => (upload ? uploadToBook(upload) : undefined), [upload]);
}
