// A chapter's text in the pieces a device voice speaks, and the read-along transcripts time.
// Pure (no imports), so tests and lib/alignment.ts can use it without the narrator's dependencies.

/** Long sentences are spoken in parts: some browsers cut off a long utterance. */
const MAX_PART = 220;
const ABBREVIATION = /(?:^|\s)(?:Mr|Mrs|Ms|Dr|St|Mt|Jr|Sr|Messrs|Capt|Col|Gen|Rev|Prof|Lt|Sgt|No)\.\s*$/;

export interface Part {
  text: string;
  /** Characters before it in its chapter. */
  offset: number;
}

/** A chapter's text in the pieces a voice speaks: sentences, long ones split at commas. */
export function speakingParts(text: string): Part[] {
  const split = text.replace(/\s+/g, " ").match(/[^.!?…]+(?:[.!?…]+["”’)]*\s*|$)/g) ?? [];
  // "Mr." and the like end a word, not a sentence: keep them with what follows.
  const sentences: string[] = [];
  for (const piece of split) {
    const previous = sentences[sentences.length - 1];
    if (previous !== undefined && ABBREVIATION.test(previous)) sentences[sentences.length - 1] = previous + piece;
    else sentences.push(piece);
  }
  const parts: Part[] = [];
  let offset = 0;
  for (const sentence of sentences) {
    let rest = sentence;
    while (rest.length > MAX_PART) {
      const cut = Math.max(rest.lastIndexOf(", ", MAX_PART), rest.lastIndexOf("; ", MAX_PART), rest.lastIndexOf(" ", MAX_PART));
      const piece = rest.slice(0, cut > 0 ? cut + 1 : MAX_PART);
      parts.push({ text: piece, offset });
      offset += piece.length;
      rest = rest.slice(piece.length);
    }
    if (rest.trim()) parts.push({ text: rest, offset });
    offset += rest.length;
  }
  return parts;
}
