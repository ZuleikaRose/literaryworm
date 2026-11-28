import type { Recording } from "../types";

/**
 * Whether the book's LibriVox recording is offered to play, clip, cast, download or credit. A
 * withdrawn recording (`Recording.withdrawn`) keeps the book's chapters and full text, so it stays a
 * classic for reading, natural and device voices, X-Ray and the rest; only the recording itself goes.
 */
export const playsRecording = (book: { recording?: Recording }): boolean => Boolean(book.recording && !book.recording.withdrawn);
