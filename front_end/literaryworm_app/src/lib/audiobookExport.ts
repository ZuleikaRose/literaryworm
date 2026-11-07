/**
 * Download the audiobook (components/VoiceWholeBook.tsx): an upload's natural-voice parts, kept on
 * this device by Voice the whole book, joined in reading order into one MP3 the member saves.
 * MP3 is a run of frames, so parts joined end to end play straight through. Made in the browser
 * from what's already on the device, never uploaded; nothing is voiced for it.
 */

/** Every part's audio in order, or how many aren't on this device yet. */
export async function collectAudiobook(parts: [number, number][], blobOf: (chapter: number, segment: number) => Promise<Blob | null>): Promise<{ blob: Blob | null; missing: number }> {
  const blobs: Blob[] = [];
  let missing = 0;
  for (const [c, s] of parts) {
    const blob = await blobOf(c, s);
    if (blob) blobs.push(blob);
    else missing++;
  }
  return { blob: missing || !blobs.length ? null : new Blob(blobs, { type: "audio/mpeg" }), missing };
}

/** "The Tide Clock" → "the-tide-clock-audiobook.mp3". */
export function audiobookFileName(title: string): string {
  const slug = title.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "book";
  return `${slug}-audiobook.mp3`;
}

/** Saves a file on this device. */
export function saveFile(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
