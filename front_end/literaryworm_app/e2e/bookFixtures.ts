/**
 * A tiny PDF and a tiny Kindle book for the smoke tests, built byte by byte: the PDF has one page
 * of text lines per page given (Helvetica, a title and author in its Info), and the Kindle book is
 * an uncompressed MOBI with its title and author in EXTH.
 */

const pdfString = (s: string) => `(${s.replace(/[\\()]/g, (c) => `\\${c}`)})`;

export function tinyPdf(title: string, author: string, pages: string[][]): Buffer {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
  pages.forEach((lines, i) => {
    const content = `BT /F1 12 Tf 14 TL 72 720 Td ${lines.map((l) => `${pdfString(l)} Tj T*`).join(" ")} ET`;
    objects[pageIds[i]] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] = `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`;
  });
  const info = objects.length;
  objects[info] = `<< /Title ${pdfString(title)} /Author ${pdfString(author)} >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = Buffer.byteLength(out, "latin1");
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

export function tinyMobi(title: string, author: string, html: string): Buffer {
  const text = Buffer.from(html, "utf8");
  const exthRecord = (type: number, value: string) => {
    const v = Buffer.from(value, "utf8");
    const r = Buffer.alloc(8 + v.length);
    r.writeUInt32BE(type, 0);
    r.writeUInt32BE(8 + v.length, 4);
    v.copy(r, 8);
    return r;
  };
  const records = [exthRecord(503, title), exthRecord(100, author)];
  const exthLength = 12 + records.reduce((n, r) => n + r.length, 0);
  const headerLength = 0xe8;
  const r0 = Buffer.alloc(16 + headerLength + exthLength);
  r0.writeUInt16BE(1, 0); // no compression
  r0.writeUInt32BE(text.length, 4);
  r0.writeUInt16BE(1, 8); // one text record
  r0.writeUInt16BE(4096, 10);
  r0.write("MOBI", 16, "latin1");
  r0.writeUInt32BE(headerLength, 20);
  r0.writeUInt32BE(65001, 28);
  r0.writeUInt32BE(0x40, 128);
  const e = 16 + headerLength;
  r0.write("EXTH", e, "latin1");
  r0.writeUInt32BE(exthLength, e + 4);
  r0.writeUInt32BE(records.length, e + 8);
  Buffer.concat(records).copy(r0, e + 12);
  const parts = [r0, text];
  const start = 78 + parts.length * 8 + 2;
  const head = Buffer.alloc(start);
  head.write("BOOKMOBI", 60, "latin1");
  head.writeUInt16BE(parts.length, 76);
  let offset = start;
  parts.forEach((p, n) => {
    head.writeUInt32BE(offset, 78 + n * 8);
    offset += p.length;
  });
  return Buffer.concat([head, ...parts]);
}
