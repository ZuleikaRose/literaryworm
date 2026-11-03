import type { Book } from "../types";
import { drawCover, wrapLines } from "./coverArt";
import { dateLocale, tk, tr } from "./i18n";
import type { YearStats } from "./stats";
import { cardTime, loadFonts, palette, type YearCardTheme } from "./yearCard";

/**
 * Year in Review as a story: a few screens, one fact each, sized for Instagram, Facebook and
 * TikTok stories (1080 × 1920). Worked out from the same numbers as My Library → Stats and drawn
 * in the browser; nothing is uploaded. Screens with nothing to say are left out.
 */

export interface StorySlide {
  id: string;
  eyebrow: string;
  /** The big words. */
  big: string;
  /** What the big words mean. */
  line: string;
  /** A smaller line under it, or null. */
  detail: string | null;
  /** Covers to show (the books finished screen). */
  covers: Book[];
}

/** The month's name in the reader's language ("January" in English). */
const monthName = (month: number) => new Date(2000, month, 1).toLocaleDateString(dateLocale(), { month: "long" });
const MOST_ON = [
  tk("Most of all on Sundays."),
  tk("Most of all on Mondays."),
  tk("Most of all on Tuesdays."),
  tk("Most of all on Wednesdays."),
  tk("Most of all on Thursdays."),
  tk("Most of all on Fridays."),
  tk("Most of all on Saturdays."),
];

export function storySlides(name: string, s: YearStats, goal: number | null): StorySlide[] {
  const slides: StorySlide[] = [
    { id: "intro", eyebrow: tr("Year in review"), big: String(s.year), line: tr("{name}'s year in books", { name }), detail: tr("Tap through to see it."), covers: [] },
  ];
  if (s.seconds > 0) {
    // The split only says something when there was both.
    const split = s.read > 0 && s.listened > 0 ? tr("{read} reading · {listened} listening", { read: cardTime(s.read), listened: cardTime(s.listened) }) : null;
    slides.push({ id: "time", eyebrow: tr("Time with books"), big: cardTime(s.seconds), line: tr("of reading and listening"), detail: split, covers: [] });
  }
  if (s.finished > 0) {
    const covers = s.books.flatMap((b) => (b.book ? [b.book] : [])).filter((b, i, all) => all.findIndex((x) => x.id === b.id) === i).slice(0, 3);
    const ofGoal = goal !== null ? (s.finished >= goal ? tr("Goal of {goal} reached.", { goal }) : tr("{left} to go for a goal of {goal}.", { left: goal - s.finished, goal })) : null;
    slides.push({ id: "books", eyebrow: tr("Books finished"), big: String(s.finished), line: tr.plural(s.finished, { one: "book finished", other: "books finished" }), detail: ofGoal, covers });
  }
  if (s.daysRead > 0) {
    slides.push({
      id: "streak",
      eyebrow: tr("Keeping it up"),
      big: String(s.longestStreak),
      line: tr.plural(s.longestStreak, { one: "day in a row, at best", other: "days in a row, at best" }),
      detail: tr.plural(s.daysRead, { one: "{count} day with reading this year.", other: "{count} days with reading this year." }),
      covers: [],
    });
  }
  if (s.genres[0] || s.authors[0]) {
    slides.push({
      id: "favourites",
      eyebrow: tr("Favourites"),
      big: s.genres[0]?.name ?? s.authors[0]!.name,
      line: s.genres[0] ? tr("your top genre") : tr("your top author"),
      detail: s.genres[0] && s.authors[0] ? tr("Top author: {name}", { name: s.authors[0].name }) : null,
      covers: [],
    });
  }
  if (s.busiestMonth !== null) {
    slides.push({
      id: "when",
      eyebrow: tr("When you read"),
      big: monthName(s.busiestMonth),
      line: tr("your busiest month"),
      detail: s.favouriteWeekday !== null ? tr(MOST_ON[s.favouriteWeekday]) : null,
      covers: [],
    });
  }
  slides.push({ id: "outro", eyebrow: tr("Year in review"), big: tr("On to {year}", { year: s.year + 1 }), line: tr("Stories worth staying up for."), detail: "literaryworm.com", covers: [] });
  return slides;
}

/** A screen's words, for its alt text and for sharing as text. */
export function slideText(slide: StorySlide): string {
  const sentence = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);
  return [sentence(`${slide.eyebrow}: ${slide.big} ${slide.line}`), slide.detail && sentence(slide.detail)].filter(Boolean).join(" ");
}

export const STORY_WIDTH = 1080;
export const STORY_HEIGHT = 1920;
const PAD = 96;

/** Draws one screen; the top and bottom 250px stay free of words, where apps put their buttons. */
export async function drawSlide(slide: StorySlide, theme: YearCardTheme, index: number, count: number): Promise<HTMLCanvasElement> {
  await loadFonts();
  const canvas = document.createElement("canvas");
  canvas.width = STORY_WIDTH;
  canvas.height = STORY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(tr("This browser can't draw the story."));
  const { bg, ink, muted, accent, panel } = palette(theme);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, STORY_WIDTH, STORY_HEIGHT);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.14;
  ctx.beginPath();
  ctx.arc(STORY_WIDTH * 0.85, STORY_HEIGHT * 0.2, 460, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Progress marks along the top, like a story.
  const gap = 10;
  const markW = (STORY_WIDTH - PAD * 2 - gap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = i <= index ? accent : panel;
    ctx.beginPath();
    ctx.roundRect(PAD + i * (markW + gap), 170, markW, 8, 4);
    ctx.fill();
  }

  let y = 520;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = accent;
  ctx.font = '700 34px "Manrope", system-ui, sans-serif';
  ctx.fillText(slide.eyebrow.toUpperCase(), PAD, y);
  y += 40;
  ctx.fillStyle = ink;
  let size = 220;
  ctx.font = `800 ${size}px "Manrope", system-ui, sans-serif`;
  while (size > 96 && ctx.measureText(slide.big).width > STORY_WIDTH - PAD * 2) {
    size -= 12;
    ctx.font = `800 ${size}px "Manrope", system-ui, sans-serif`;
  }
  const bigLines = wrapLines(ctx, slide.big, STORY_WIDTH - PAD * 2, 2);
  bigLines.forEach((line) => {
    y += size * 0.95;
    ctx.fillText(line, PAD, y);
  });
  y += 80;
  ctx.font = '700 60px "Manrope", system-ui, sans-serif';
  wrapLines(ctx, slide.line, STORY_WIDTH - PAD * 2, 3).forEach((line) => {
    ctx.fillText(line, PAD, y);
    y += 72;
  });
  if (slide.detail) {
    y += 20;
    ctx.fillStyle = muted;
    ctx.font = '500 40px "DM Sans", system-ui, sans-serif';
    wrapLines(ctx, slide.detail, STORY_WIDTH - PAD * 2, 3).forEach((line) => {
      ctx.fillText(line, PAD, y);
      y += 52;
    });
  }
  if (slide.covers.length) {
    // One row of up to three, in the space under the words and above the footer.
    const covers = slide.covers.slice(0, 3);
    const coverGap = 28;
    const top = y + 40;
    const bottom = STORY_HEIGHT - 340;
    let coverW = (STORY_WIDTH - PAD * 2 - coverGap * 2) / 3;
    let coverH = coverW * 1.5;
    if (top + coverH > bottom) {
      coverH = Math.max(0, bottom - top);
      coverW = coverH / 1.5;
    }
    if (coverH >= 120) {
      covers.forEach((book, i) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 8;
        drawCover(ctx, book, PAD + i * (coverW + coverGap), top, coverW, coverH);
        ctx.restore();
      });
    }
  }
  ctx.fillStyle = accent;
  ctx.font = '700 32px "Manrope", system-ui, sans-serif';
  ctx.fillText("literaryworm.com", PAD, STORY_HEIGHT - 260);
  return canvas;
}

export async function slideBlob(slide: StorySlide, theme: YearCardTheme, index: number, count: number): Promise<Blob> {
  const canvas = await drawSlide(slide, theme, index, count);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(tr("This browser can't make the picture.")))), "image/png"));
}

export const slideFileName = (year: number, slide: StorySlide) => `literaryworm-${year}-story-${slide.id}.png`;
