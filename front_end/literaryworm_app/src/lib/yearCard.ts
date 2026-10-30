import type { Book } from "../types";
import { drawCover, wrapLines } from "./coverArt";
import type { YearStats } from "./stats";

/**
 * Year in Review as a picture to share: the year's headline numbers, the covers of books
 * finished, and the top genre and author, on a light or dark card. Drawn on a canvas in the
 * browser; nothing is uploaded. 1080 × 1350, like the quote card.
 */

export type YearCardTheme = "light" | "dark";

export const YEAR_CARD_THEMES: { value: YearCardTheme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

const WIDTH = 1080;
const HEIGHT = 1350;
const PAD = 88;
/** Covers along the bottom: as many as fit across. */
export const YEAR_CARD_COVERS = 5;

export interface YearCardFacts {
  title: string;
  /** Four headline numbers, each with what it counts. */
  numbers: { value: string; label: string }[];
  /** The newest books finished that we can draw, newest first. */
  covers: Book[];
  /** "Top genre: Fiction · Top author: Jane Austen", or null with neither. */
  favourites: string | null;
}

/** Whole hours once there are any ("42 h"), else minutes ("35 min"). */
export function cardTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h` : `${minutes} min`;
}

/** What the card says for a profile's year (the same numbers as My Library → Stats). */
export function yearCardFacts(name: string, s: YearStats, goal: number | null): YearCardFacts {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const favourites = [s.genres[0] && `Top genre: ${s.genres[0].name}`, s.authors[0] && `Top author: ${s.authors[0].name}`].filter(Boolean).join(" · ");
  return {
    title: `${name}'s ${s.year} in books`,
    numbers: [
      { value: String(s.finished), label: `${plural(s.finished, "book", "books")} finished${goal !== null ? ` of ${goal}` : ""}` },
      { value: cardTime(s.seconds), label: "reading and listening" },
      { value: String(s.daysRead), label: `${plural(s.daysRead, "day", "days")} with reading` },
      { value: String(s.longestStreak), label: `${plural(s.longestStreak, "day", "days")} in a row, at best` },
    ],
    covers: s.books.flatMap((b) => (b.book ? [b.book] : [])).filter((b, i, all) => all.findIndex((x) => x.id === b.id) === i).slice(0, YEAR_CARD_COVERS),
    favourites: favourites || null,
  };
}

function palette(theme: YearCardTheme) {
  // Canvas colours, not CSS: the card keeps the same look whatever theme the app is in.
  return theme === "light"
    ? { bg: "#f6f1e8", ink: "#1c1a17", muted: "#5d574f", accent: "#a24e2f", panel: "#ebe3d4" }
    : { bg: "#14171a", ink: "#f1ece4", muted: "#a3a7a9", accent: "#e07a52", panel: "#1f2428" };
}

async function loadFonts(): Promise<void> {
  try {
    await Promise.all([document.fonts.load('800 120px "Manrope"'), document.fonts.load('700 56px "Manrope"'), document.fonts.load('500 30px "DM Sans"')]);
  } catch {
    // Offline or blocked: the system fonts named after them in each font list stand in.
  }
}

/** Draws the card and returns its canvas. */
export async function drawYearCard(facts: YearCardFacts, theme: YearCardTheme): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser can't draw the card.");
  const { bg, ink, muted, accent, panel } = palette(theme);

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.arc(WIDTH * 0.9, HEIGHT * 0.06, 380, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Heading.
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = '700 28px "Manrope", system-ui, sans-serif';
  ctx.fillText("YEAR IN REVIEW", PAD, PAD + 20);
  ctx.fillStyle = ink;
  ctx.font = '800 64px "Manrope", system-ui, sans-serif';
  const titleLines = wrapLines(ctx, facts.title, WIDTH - PAD * 2, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, PAD, PAD + 104 + i * 74));
  let y = PAD + 104 + titleLines.length * 74 + 24;

  // Four numbers in two rows of two.
  const gap = 28;
  const boxW = (WIDTH - PAD * 2 - gap) / 2;
  const boxH = 210;
  facts.numbers.forEach((n, i) => {
    const x = PAD + (i % 2) * (boxW + gap);
    const top = y + Math.floor(i / 2) * (boxH + gap);
    ctx.fillStyle = panel;
    ctx.beginPath();
    ctx.roundRect(x, top, boxW, boxH, 24);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.font = '800 92px "Manrope", system-ui, sans-serif';
    ctx.fillText(wrapLines(ctx, n.value, boxW - 64, 1)[0] ?? n.value, x + 32, top + 112);
    ctx.fillStyle = muted;
    ctx.font = '500 30px "DM Sans", system-ui, sans-serif';
    wrapLines(ctx, n.label, boxW - 64, 2).forEach((line, j) => ctx.fillText(line, x + 32, top + 158 + j * 36));
  });
  y += boxH * 2 + gap + 56;

  // Covers of books finished, then the favourites line.
  if (facts.covers.length > 0) {
    const coverGap = 24;
    const coverW = (WIDTH - PAD * 2 - coverGap * (YEAR_CARD_COVERS - 1)) / YEAR_CARD_COVERS;
    const coverH = coverW * 1.5;
    facts.covers.forEach((book, i) => {
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = 20;
      ctx.shadowOffsetY = 6;
      drawCover(ctx, book, PAD + i * (coverW + coverGap), y, coverW, coverH);
      ctx.restore();
    });
    y += coverH + 56;
  }
  if (facts.favourites) {
    ctx.fillStyle = ink;
    ctx.font = '500 32px "DM Sans", system-ui, sans-serif';
    wrapLines(ctx, facts.favourites, WIDTH - PAD * 2, 2).forEach((line, i) => ctx.fillText(line, PAD, y + i * 42));
  }

  ctx.fillStyle = accent;
  ctx.font = '700 28px "Manrope", system-ui, sans-serif';
  ctx.fillText("literaryworm.com", PAD, HEIGHT - PAD + 10);
  return canvas;
}

/** The card as a PNG. */
export async function yearCardBlob(facts: YearCardFacts, theme: YearCardTheme): Promise<Blob> {
  const canvas = await drawYearCard(facts, theme);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("This browser can't make the picture."))), "image/png"),
  );
}

/** "literaryworm-2026-in-books.png". */
export const yearCardFileName = (year: number) => `literaryworm-${year}-in-books.png`;

/** The card's words, for screen readers (its alt text) and for sharing as text. */
export function yearCardText(facts: YearCardFacts): string {
  const numbers = facts.numbers.map((n) => `${n.value} ${n.label}`).join(", ");
  return `${facts.title}: ${numbers}.${facts.favourites ? ` ${facts.favourites}.` : ""}`;
}
