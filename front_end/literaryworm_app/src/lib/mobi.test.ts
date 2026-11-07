import { describe, expect, it } from "@jest/globals";
import { kindleParts, palmDocDecompress, readKindleBytes, trailingSize } from "./mobi";

const ascii = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)));

/** PalmDOC as a simple encoder would write it: literals, with "a space and a letter" pairs packed. */
function palmDoc(input: string | Uint8Array): Uint8Array {
  const out: number[] = [];
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    const next = bytes[i + 1];
    if (c === 0x20 && next !== undefined && next >= 0x40 && next <= 0x7f) {
      out.push(next ^ 0x80);
      i++;
    } else if (c >= 0x80 || (c >= 0x01 && c <= 0x08)) out.push(1, c);
    else out.push(c);
  }
  return Uint8Array.from(out);
}

/** A Palm database: an EXTH-bearing MOBI record 0 and the text records (each with `trailing` bytes after it). */
function kindleFile({
  text,
  compress = false,
  drm = 0,
  compression,
  trailing = [] as number[],
  flags = 0,
  exth = [] as [number, string][],
}: { text: string; compress?: boolean; drm?: number; compression?: number; trailing?: number[]; flags?: number; exth?: [number, string][] }): Uint8Array {
  const body = new TextEncoder().encode(text);
  // Two text records, to check they're joined in order.
  const half = Math.ceil(body.length / 2);
  const chunks = [body.subarray(0, half), body.subarray(half)].map((c) => {
    const data = compress ? palmDoc(c) : c;
    return Uint8Array.from([...data, ...trailing]);
  });

  const exthRecords = exth.map(([type, value]) => {
    const v = new TextEncoder().encode(value);
    const r = new Uint8Array(8 + v.length);
    const dv = new DataView(r.buffer);
    dv.setUint32(0, type);
    dv.setUint32(4, 8 + v.length);
    r.set(v, 8);
    return r;
  });
  const exthLength = 12 + exthRecords.reduce((n, r) => n + r.length, 0);
  const headerLength = 0xe8; // MOBI header length, so the extra flags at 0xF2 are read.
  const name = ascii("Record Title");
  const r0 = new Uint8Array(16 + headerLength + exthLength + name.length);
  const h = new DataView(r0.buffer);
  h.setUint16(0, compression ?? (compress ? 2 : 1));
  h.setUint32(4, body.length);
  h.setUint16(8, 2);
  h.setUint16(10, 4096);
  h.setUint16(12, drm);
  r0.set(ascii("MOBI"), 16);
  h.setUint32(20, headerLength);
  h.setUint32(28, 65001);
  h.setUint32(84, 16 + headerLength + exthLength);
  h.setUint32(88, name.length);
  h.setUint32(92, 9);
  h.setUint32(128, exth.length ? 0x40 : 0);
  h.setUint16(0xf2, flags);
  const e = 16 + headerLength;
  r0.set(ascii("EXTH"), e);
  h.setUint32(e + 4, exthLength);
  h.setUint32(e + 8, exth.length);
  let at = e + 12;
  for (const r of exthRecords) {
    r0.set(r, at);
    at += r.length;
  }
  r0.set(name, at);

  const records = [r0, ...chunks];
  const start = 78 + records.length * 8 + 2;
  const file = new Uint8Array(start + records.reduce((n, r) => n + r.length, 0));
  const f = new DataView(file.buffer);
  file.set(ascii("BOOKMOBI"), 60);
  f.setUint16(76, records.length);
  let offset = start;
  records.forEach((r, n) => {
    f.setUint32(78 + n * 8, offset);
    file.set(r, offset);
    offset += r.length;
  });
  return file;
}

const HTML = "<html><body><h1>One</h1><p>It was a bright cold day in April.</p><mbp:pagebreak/><h2>Two</h2><p>Café, naïve and déjà vu.</p></body></html>";

describe("Kindle books", () => {
  it("unpacks PalmDOC: literals, space pairs and back references", () => {
    expect(new TextDecoder().decode(palmDocDecompress(palmDoc("Hello world")))).toBe("Hello world");
    // "abcabcabc": the literal "abc", then 6 bytes copied from 3 back.
    const back = Uint8Array.from([...ascii("abc"), 0x80, (3 << 3) | (6 - 3)]);
    expect(new TextDecoder().decode(palmDocDecompress(back))).toBe("abcabcabc");
    expect(() => palmDocDecompress(Uint8Array.from([0x80, 0x08]))).toThrow(/damaged/);
  });

  it("measures the trailing entries the extra flags describe", () => {
    // One entry of 3 bytes (its last byte says 0x83: size 3, marked), and a multibyte count of 2.
    const data = Uint8Array.from([...ascii("text"), 0x01, 9, 9, 0x83]);
    expect(trailingSize(data, 0b10)).toBe(3);
    expect(trailingSize(data, 0b11)).toBe(5);
    expect(trailingSize(ascii("text"), 0)).toBe(0);
  });

  it("reads an uncompressed book with its EXTH title, author, year and language", () => {
    const book = readKindleBytes(kindleFile({ text: HTML, exth: [[503, "The Real Title"], [100, "Ann Writer"], [106, "2019-04-12"], [524, "en-GB"]] }));
    expect([book.title, book.author, book.year, book.language]).toEqual(["The Real Title", "Ann Writer", 2019, "en"]);
    expect(book.html).toBe(HTML);
  });

  it("reads a PalmDOC book, dropping each record's trailing entries", () => {
    const book = readKindleBytes(kindleFile({ text: HTML, compress: true, trailing: [0x07, 0x82], flags: 0b10 }));
    expect(book.html).toBe(HTML);
    // Without EXTH: the record's own full name, and the header's locale.
    expect([book.title, book.author, book.language]).toEqual(["Record Title", "", "en"]);
  });

  it("refuses DRM, HUFF/CDIC and files that aren't Kindle books", () => {
    expect(() => readKindleBytes(kindleFile({ text: HTML, drm: 2 }))).toThrow(/DRM/);
    expect(() => readKindleBytes(kindleFile({ text: HTML, compression: 17480 }))).toThrow(/Calibre/);
    expect(() => readKindleBytes(ascii("PK".padEnd(200, " ")))).toThrow(/isn't a Kindle book/);
  });

  it("handles empty input: nothing to unpack, measure or split, and no book in no bytes", () => {
    expect(palmDocDecompress(new Uint8Array(0))).toEqual(new Uint8Array(0));
    expect(trailingSize(new Uint8Array(0), 0b11)).toBe(0);
    expect(kindleParts("")).toEqual([]);
    expect(kindleParts("   ")).toEqual([]);
    expect(() => readKindleBytes(new Uint8Array(0))).toThrow(/isn't a Kindle book/);
  });

  it("splits the HTML at page breaks and before top-level headings", () => {
    expect(kindleParts(HTML).map((p) => p.slice(0, 8))).toEqual(["<html><b", "<h1>One<", "<h2>Two<"]);
  });
});
