import type { Book, CoverStyle } from "../types";

/**
 * Drawn covers as pictures, for places a CSS cover can't go: the phone's lock screen (Media
 * Session artwork) and shared quote cards. A simpler version of components/Cover.tsx: the
 * palette, the motif's main shape, and the title and author.
 */

type CoverBook = Pick<Book, "cover" | "title" | "author" | "genres">;

/** Wraps `text` to lines no wider than `width`, at most `max` lines (the last ends in "…" if cut). */
export function wrapLines(ctx: CanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === max) break;
  }
  if (line && lines.length < max) lines.push(line);
  const used = lines.join(" ").split(/\s+/).length;
  if (used < text.split(/\s+/).filter(Boolean).length && lines.length) {
    let last = lines[lines.length - 1];
    while (last && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  return lines;
}

function drawMotif(ctx: CanvasRenderingContext2D, cover: CoverStyle, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = cover.accent;
  ctx.strokeStyle = cover.accent;
  ctx.lineWidth = w * 0.035;
  switch (cover.motif) {
    case "sun":
    case "dot-slash":
      ctx.beginPath();
      ctx.arc(x + w * 0.72, y + h * 0.3, w * 0.16, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "rings":
      for (const r of [0.1, 0.18, 0.26]) {
        ctx.beginPath();
        ctx.arc(x + w * 0.7, y + h * 0.3, w * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    case "horizon":
    case "band":
      ctx.fillStyle = cover.bg2 ?? cover.accent;
      ctx.fillRect(x, y + h * 0.38, w, h * 0.16);
      break;
    case "arch":
      ctx.beginPath();
      ctx.arc(x + w * 0.5, y + h * 0.45, w * 0.28, Math.PI, 0);
      ctx.lineTo(x + w * 0.78, y + h * 0.5);
      ctx.lineTo(x + w * 0.22, y + h * 0.5);
      ctx.fill();
      break;
    case "grid":
      for (let i = 1; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(x + (w * i) / 4, y + h * 0.1);
        ctx.lineTo(x + (w * i) / 4, y + h * 0.5);
        ctx.stroke();
      }
      break;
    case "wave":
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const px = x + (w * i) / 40;
        const py = y + h * 0.36 + Math.sin(i / 3) * h * 0.04;
        if (i) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.stroke();
      break;
    default:
      // slash, stripe
      ctx.beginPath();
      ctx.moveTo(x + w * 0.15, y + h * 0.5);
      ctx.lineTo(x + w * 0.85, y + h * 0.12);
      ctx.stroke();
  }
}

/** Draws `book`'s cover in the box at x, y. */
export function drawCover(ctx: CanvasRenderingContext2D, book: CoverBook, x: number, y: number, w: number, h: number) {
  const { cover } = book;
  ctx.save();
  ctx.fillStyle = cover.bg;
  ctx.fillRect(x, y, w, h);
  drawMotif(ctx, cover, x, y, w, h);
  const pad = w * 0.09;
  ctx.fillStyle = cover.ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${Math.round(w * 0.1)}px Manrope, system-ui, sans-serif`;
  const lines = wrapLines(ctx, book.title, w - pad * 2, 3);
  const lineHeight = w * 0.115;
  let ty = y + h - pad - w * 0.1 - (lines.length - 1) * lineHeight;
  for (const line of lines) {
    ctx.fillText(line, x + pad, ty);
    ty += lineHeight;
  }
  ctx.font = `500 ${Math.round(w * 0.055)}px "DM Sans", system-ui, sans-serif`;
  ctx.globalAlpha = 0.85;
  ctx.fillText(wrapLines(ctx, book.author, w - pad * 2, 1)[0] ?? "", x + pad, y + h - pad);
  ctx.restore();
}

const artwork = new Map<string, Promise<string | null>>();

/** A square PNG of the cover (an object URL, kept for the visit), or null if the browser can't draw one. */
export function coverArtUrl(book: CoverBook & { id: string }, size = 512): Promise<string | null> {
  const key = `${book.id}:${size}`;
  const cached = artwork.get(key);
  if (cached) return cached;
  const made = new Promise<string | null>((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(null);
    drawCover(ctx, book, 0, 0, size, size);
    canvas.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/png");
  });
  artwork.set(key, made);
  return made;
}
