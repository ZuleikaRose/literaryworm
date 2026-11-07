import { tr } from "./i18n";

/**
 * Reads an EPUB in the browser and keeps only its text: the title, the author, and each part
 * of the book in reading order (the EPUB's spine) as plain paragraphs. Nothing is uploaded
 * from here; images, styles and scripts are left behind. EPUBs are ZIP files: this reads the
 * ZIP's directory and inflates entries with the browser's DecompressionStream.
 */

export interface ParsedBook {
  title: string;
  author: string;
  /** The year in the EPUB's publication date, when it gives one. */
  year: number | null;
  /** The language it's written in (dc:language), when it says. */
  language: string | null;
  chapters: { title: string; text: string }[];
}

/** The same limits as the database and the bucket. */
export const EPUB_MAX_BYTES = 50 * 1024 * 1024;
export const CHAPTERS_MAX = 500;
export const WORDS_MAX = 5_000_000;
/** A part with less text than this (a cover, a title page) joins the next part. */
const SHORT_PART = 400;

export class EpubError extends Error {}

type Entry = { name: string; method: number; compressed: number; offset: number };

/** The ZIP's files, from its central directory. */
function entries(view: DataView): Map<string, Entry> {
  // The end-of-central-directory record is in the last 64 KB.
  let eocd = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65_557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new EpubError(tr("This file isn't an EPUB (it isn't a ZIP file)."));
  const count = view.getUint16(eocd + 10, true);
  let at = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const files = new Map<string, Entry>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new EpubError(tr("This EPUB is damaged."));
    const method = view.getUint16(at + 10, true);
    const compressed = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const offset = view.getUint32(at + 42, true);
    const name = decoder.decode(new Uint8Array(view.buffer, view.byteOffset + at + 46, nameLength));
    files.set(name, { name, method, compressed, offset });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

async function readText(view: DataView, entry: Entry): Promise<string> {
  const local = entry.offset;
  if (view.getUint32(local, true) !== 0x04034b50) throw new EpubError(tr("This EPUB is damaged."));
  const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
  // A copy, so it's a plain ArrayBuffer view (what Blob takes).
  const data = new Uint8Array(view.buffer.slice(view.byteOffset + start, view.byteOffset + start + entry.compressed) as ArrayBuffer);
  if (entry.method === 0) return new TextDecoder().decode(data);
  if (entry.method !== 8) throw new EpubError(tr("This EPUB is packed in a way LiteraryWorm can't read."));
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** A path inside the EPUB, relative to the file that mentions it. */
function resolve(base: string, href: string): string {
  const parts = (base.includes("/") ? base.slice(0, base.lastIndexOf("/") + 1) : "").concat(decodeURIComponent(href.split("#")[0])).split("/");
  const out: string[] = [];
  for (const p of parts) {
    if (p === "..") out.pop();
    else if (p && p !== ".") out.push(p);
  }
  return out.join("/");
}

const BLOCKS = "p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, dt, dd, td";

/** A page of the book as paragraphs, and its heading if it has one (also used for Kindle books' HTML). */
export function pageText(xhtml: string): { heading: string; paragraphs: string[] } {
  const doc = new DOMParser().parseFromString(xhtml, "application/xhtml+xml");
  const body = doc.querySelector("parsererror") ? new DOMParser().parseFromString(xhtml, "text/html").body : doc.body ?? doc.documentElement;
  body.querySelectorAll("script, style, nav[epub\\:type='toc'], svg").forEach((el) => el.remove());
  const heading = (body.querySelector("h1, h2, h3")?.textContent ?? "").replace(/\s+/g, " ").trim();
  const blocks = [...body.querySelectorAll(BLOCKS)].filter((el) => !el.querySelector(BLOCKS));
  const paragraphs = (blocks.length ? blocks : [body]).map((el) => (el.textContent ?? "").replace(/\s+/g, " ").trim()).filter(Boolean);
  return { heading, paragraphs };
}

const words = (text: string) => (text.match(/\S+/g) ?? []).length;

/**
 * A book's parts (each with its heading and paragraphs, in reading order) as chapters: a short part
 * (a cover, a title page) joins the next one, and each chapter is titled by its heading or "Part n".
 * Shared by EPUBs and Kindle books.
 */
export function assembleChapters(parts: { heading: string; paragraphs: string[] }[]): ParsedBook["chapters"] {
  const chapters: ParsedBook["chapters"] = [];
  let carried: string[] = [];
  let total = 0;
  parts.forEach(({ heading, paragraphs }, i) => {
    const all = [...carried, ...paragraphs];
    const title = heading;
    const text = all.join("\n\n");
    if (text.length < SHORT_PART && i !== parts.length - 1) {
      carried = all;
      return;
    }
    carried = [];
    if (!text) return;
    total += words(text);
    if (total > WORDS_MAX) throw new EpubError(tr("This book is too long for LiteraryWorm (over 5 million words)."));
    chapters.push({ title: title.slice(0, 120) || `Part ${chapters.length + 1}`, text });
  });
  if (carried.length) {
    const text = carried.join("\n\n");
    if (chapters.length) chapters[chapters.length - 1].text += `\n\n${text}`;
    else chapters.push({ title: "Part 1", text });
  }
  return chapters;
}

export async function readEpub(file: File): Promise<ParsedBook> {
  try {
    return await parse(file);
  } catch (err) {
    if (err instanceof EpubError) throw err;
    // Corrupt compressed data, unreadable XML or a file that can't be read: one plain message.
    console.error("epub: couldn't read the file:", err);
    throw new EpubError(tr("This EPUB is damaged or in a form LiteraryWorm can't read. Try another copy."));
  }
}

async function parse(file: File): Promise<ParsedBook> {
  if (file.size > EPUB_MAX_BYTES) throw new EpubError(tr("That file is over 50 MB. Choose a smaller EPUB."));
  if (typeof DecompressionStream === "undefined") throw new EpubError(tr("This browser can't open EPUBs. Try a recent Chrome, Edge, Firefox or Safari."));
  const view = new DataView(await file.arrayBuffer());
  const files = entries(view);
  const read = (path: string) => {
    const entry = files.get(path);
    if (!entry) throw new EpubError(tr("This EPUB is missing a part it needs."));
    return readText(view, entry);
  };

  const container = new DOMParser().parseFromString(await read("META-INF/container.xml"), "application/xml");
  const opfPath = container.querySelector("rootfile")?.getAttribute("full-path");
  if (!opfPath) throw new EpubError(tr("This EPUB is missing its table of contents."));
  const opf = new DOMParser().parseFromString(await read(opfPath), "application/xml");
  const meta = (name: string) => (opf.getElementsByTagName(`dc:${name}`)[0]?.textContent ?? "").replace(/\s+/g, " ").trim();
  // DRM-protected books keep their text encrypted.
  if (files.has("META-INF/encryption.xml") && /EncryptedData/.test(await read("META-INF/encryption.xml"))) {
    throw new EpubError(tr("This EPUB is protected (DRM), so it can't be read outside the shop's own app."));
  }

  const manifest = new Map<string, string>();
  for (const item of opf.getElementsByTagName("item")) {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, resolve(opfPath, href));
  }
  const spine = [...opf.getElementsByTagName("itemref")].filter((r) => r.getAttribute("linear") !== "no").map((r) => manifest.get(r.getAttribute("idref") ?? ""));

  const parts: { heading: string; paragraphs: string[] }[] = [];
  for (const path of spine) {
    if (!path || !files.has(path)) continue;
    parts.push(pageText(await read(path)));
  }
  const chapters = assembleChapters(parts);
  if (!chapters.length) throw new EpubError(tr("We couldn't find any text in this EPUB."));
  if (chapters.length > CHAPTERS_MAX) throw new EpubError(tr("This EPUB has more than {max} parts, more than LiteraryWorm can show.", { max: CHAPTERS_MAX }));

  return {
    title: (meta("title") || file.name.replace(/\.epub$/i, "")).slice(0, 200),
    author: meta("creator").slice(0, 200),
    year: epubYear(opf),
    language: epubLanguage(opf),
    chapters,
  };
}

/**
 * The language the EPUB says it's written in (dc:language, "fr-FR" or "fre"), as the two or three
 * lowercase letters before any region, or null when it doesn't say.
 */
export function epubLanguage(opf: Document): string | null {
  return languageIn(opf.getElementsByTagName("dc:language")[0]?.textContent);
}

/** A dc:language value as the database keeps it: "fr-FR" → "fr", "ger" → "de", "Klingon" → null. */
export function languageIn(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(code) ? (BIBLIOGRAPHIC[code] ?? code) : null;
}

// Three-letter codes some EPUBs use, for the languages natural voices read.
const BIBLIOGRAPHIC: Record<string, string> = {
  eng: "en", fre: "fr", fra: "fr", ger: "de", deu: "de", spa: "es", ita: "it", por: "pt", dut: "nl", nld: "nl",
  jpn: "ja", chi: "zh", zho: "zh", cmn: "zh", kor: "ko", hin: "hi", ara: "ar", pol: "pl", rus: "ru", tur: "tr",
  swe: "sv", ukr: "uk", tgl: "tl", fil: "tl",
};

export const countWords = words;

/**
 * The year the EPUB says it was published: a dc:date marked as the publication (EPUB 2's
 * opf:event), else the first dc:date (EPUB 3 keeps changes in dcterms:modified instead).
 */
export function epubYear(opf: Document): number | null {
  const dates = [...opf.getElementsByTagName("dc:date")];
  const event = (d: Element) => (d.getAttribute("opf:event") ?? d.getAttribute("event") ?? "").toLowerCase();
  const chosen = dates.find((d) => /publication/.test(event(d))) ?? dates.find((d) => !/modification/.test(event(d)));
  return yearIn(chosen?.textContent);
}

/** The four-digit year a date starts with ("2019-05-02", "2019"), within what the database keeps. */
export function yearIn(date: string | null | undefined): number | null {
  const match = date?.trim().match(/^(\d{4})/);
  const year = match ? Number(match[1]) : NaN;
  return year >= 1 && year <= 9999 ? year : null;
}
