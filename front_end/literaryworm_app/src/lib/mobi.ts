import { assembleChapters, CHAPTERS_MAX, EpubError, languageIn, pageText, type ParsedBook, yearIn } from "./epub";
import { tr } from "./i18n";

/**
 * Reads a DRM-free Kindle book (.mobi, .azw3, .azw: a Palm database of HTML records) in the
 * browser and keeps only its text, like lib/epub.ts. Uncompressed and PalmDOC-compressed books
 * are read (what Calibre and most tools write); Amazon's HUFF/CDIC compression and DRM-protected
 * books are refused with a message. Nothing is uploaded from here.
 */

/** Record 0's compression: none, PalmDOC (LZ77), or HUFF/CDIC (not read). */
const NONE = 1;
const PALMDOC = 2;
const HUFF_CDIC = 17480;

/** PalmDOC (LZ77) decompression of one text record. */
export function palmDocDecompress(data: Uint8Array): Uint8Array {
  const out: number[] = [];
  let i = 0;
  while (i < data.length) {
    const c = data[i++];
    if (c === 0 || (c >= 0x09 && c <= 0x7f)) out.push(c);
    else if (c <= 0x08) {
      for (let n = 0; n < c && i < data.length; n++) out.push(data[i++]);
    } else if (c >= 0xc0) {
      out.push(0x20, c ^ 0x80);
    } else {
      // 0x80–0xbf: a back reference, two bytes: 11 bits of distance and 3 of length (+3).
      const pair = (c << 8) | (data[i++] ?? 0);
      const distance = (pair >> 3) & 0x7ff;
      const length = (pair & 0x07) + 3;
      if (distance === 0 || distance > out.length) throw new EpubError(tr("This Kindle book is damaged."));
      for (let n = 0; n < length; n++) out.push(out[out.length - distance]);
    }
  }
  return Uint8Array.from(out);
}

/** How many bytes at the end of a text record are trailing entries (the MOBI header's extra flags). */
export function trailingSize(data: Uint8Array, flags: number): number {
  const entrySize = (end: number) => {
    // A size written backwards: 7 bits a byte, the first byte (from the end) marked by 0x80.
    let result = 0;
    let shift = 0;
    for (let at = end - 1; at >= 0; at--) {
      const v = data[at];
      result |= (v & 0x7f) << shift;
      shift += 7;
      if (v & 0x80 || shift >= 28 || at === 0) break;
    }
    return result;
  };
  let size = 0;
  for (let bits = flags >> 1; bits; bits >>= 1) {
    if (bits & 1) size += entrySize(data.length - size);
  }
  // The lowest bit: multibyte characters cut at the record's end, counted in its last byte.
  if (flags & 1) size += (data[data.length - size - 1] & 0x03) + 1;
  return Math.min(size, data.length);
}

/** The EXTH records: author (100), publishing date (106), title (503), language (524). */
function exth(record0: DataView, start: number): Map<number, string> {
  const found = new Map<number, string>();
  if (start + 12 > record0.byteLength || record0.getUint32(start) !== 0x45585448) return found; // "EXTH"
  const count = record0.getUint32(start + 8);
  const decoder = new TextDecoder();
  let at = start + 12;
  for (let n = 0; n < count && at + 8 <= record0.byteLength; n++) {
    const type = record0.getUint32(at);
    const length = record0.getUint32(at + 4);
    if (length < 8 || at + length > record0.byteLength) break;
    if (!found.has(type)) found.set(type, decoder.decode(new Uint8Array(record0.buffer, record0.byteOffset + at + 8, length - 8)).trim());
    at += length;
  }
  return found;
}

/** The book's HTML split into parts: at page breaks (MOBI) and before top-level headings. */
export function kindleParts(html: string): string[] {
  return html
    .split(/<mbp:pagebreak[^>]*>|(?=<h[12][\s>])/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

/** Reads the Palm database: its records, the book's metadata and the decompressed HTML. */
export function readKindleBytes(bytes: Uint8Array, fileName = ""): { title: string; author: string; year: number | null; language: string | null; html: string } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 78 + 8) throw new EpubError(tr("This file isn't a Kindle book."));
  const kind = new TextDecoder().decode(bytes.subarray(60, 68));
  if (kind !== "BOOKMOBI" && kind !== "TEXtREAd") throw new EpubError(tr("This file isn't a Kindle book."));
  const count = view.getUint16(76);
  const offsets: number[] = [];
  for (let n = 0; n < count; n++) offsets.push(view.getUint32(78 + n * 8));
  const record = (n: number) => bytes.subarray(offsets[n], n + 1 < count ? offsets[n + 1] : bytes.byteLength);
  const r0 = record(0);
  const head = new DataView(r0.buffer, r0.byteOffset, r0.byteLength);

  const compression = head.getUint16(0);
  const textLength = head.getUint32(4);
  const textRecords = head.getUint16(8);
  if (head.getUint16(12) !== 0) throw new EpubError(tr("This Kindle book is protected (DRM), so it can't be read outside the shop's own app."));
  if (compression === HUFF_CDIC) {
    throw new EpubError(tr("This Kindle book is packed in a way LiteraryWorm can't read yet. Convert it to EPUB (Calibre does it for free) and upload that."));
  }
  if (compression !== NONE && compression !== PALMDOC) throw new EpubError(tr("This Kindle book is packed in a way LiteraryWorm can't read yet. Convert it to EPUB (Calibre does it for free) and upload that."));

  let encoding = "windows-1252";
  let flags = 0;
  let title = "";
  let meta = new Map<number, string>();
  let locale = 0;
  const mobi = r0.byteLength >= 24 && head.getUint32(16) === 0x4d4f4249; // "MOBI"
  if (mobi) {
    const headerLength = head.getUint32(20);
    if (head.getUint32(28) === 65001) encoding = "utf-8";
    if (headerLength >= 0xe4 && r0.byteLength >= 0xf4) flags = head.getUint16(0xf2);
    const nameOffset = head.getUint32(84);
    const nameLength = head.getUint32(88);
    if (nameOffset + nameLength <= r0.byteLength) title = new TextDecoder(encoding).decode(r0.subarray(nameOffset, nameOffset + nameLength));
    locale = head.getUint32(92) & 0xff;
    if (head.getUint32(128) & 0x40) meta = exth(head, 16 + headerLength);
  }

  const parts: Uint8Array[] = [];
  for (let n = 1; n <= textRecords && n < count; n++) {
    let data = record(n);
    data = data.subarray(0, data.length - trailingSize(data, flags));
    parts.push(compression === PALMDOC ? palmDocDecompress(data) : data);
  }
  const joined = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    joined.set(p, at);
    at += p.length;
  }
  const html = new TextDecoder(encoding).decode(joined.subarray(0, textLength || joined.length));
  // The MOBI header's locale is a Windows language id: its low byte, for the few languages we name.
  const LOCALES: Record<number, string> = { 9: "en", 12: "fr", 7: "de", 10: "es", 16: "it", 22: "pt", 19: "nl", 17: "ja", 4: "zh", 18: "ko" };
  return {
    title: (meta.get(503) || title || fileName.replace(/\.(mobi|azw3?|prc)$/i, "")).replace(/\s+/g, " ").trim().slice(0, 200),
    author: (meta.get(100) ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    year: yearIn(meta.get(106)),
    language: languageIn(meta.get(524)) ?? LOCALES[locale] ?? null,
    html,
  };
}

export async function readKindle(file: File): Promise<ParsedBook> {
  const book = readKindleBytes(new Uint8Array(await file.arrayBuffer()), file.name);
  const chapters = assembleChapters(kindleParts(book.html).map(pageText));
  if (!chapters.length) throw new EpubError(tr("We couldn't find any text in this Kindle book."));
  if (chapters.length > CHAPTERS_MAX) throw new EpubError(tr("This book has more than {max} parts, more than LiteraryWorm can show.", { max: CHAPTERS_MAX }));
  return { title: book.title, author: book.author, year: book.year, language: book.language, chapters };
}
