import type { Badge } from "./achievements";
import type { Streaks } from "./goals";
import { dateLocale, tr } from "./i18n";
import { type Font, MUTED, pdfDocument, pdfString, RUST, textWidth, wrap } from "./notesPdf";

/**
 * Reading certificates for Kids profiles (components/CertificateButton.tsx in Badges): one landscape
 * A4 page to print, for a badge earned or a streak reached, with the reader's name and the day.
 * Drawn in the browser with the notes PDF writer and downloaded, never uploaded. Standard fonts, so
 * text outside Windows-1252 shows as "?" (the six languages fit).
 */

const W = 842;
const H = 595;
const INK = "0.11 0.11 0.10";

/** Streaks worth a certificate, in days. */
export const STREAK_CERTIFICATES = [7, 14, 30, 100, 365];

export interface Achievement {
  id: string;
  /** What was done, for the line under "for". */
  what: string;
  /** When (ms), or null when it's still to come. */
  at: number | null;
}

/** Certificates a profile can print: badges earned, and the streak milestones its longest streak reached. */
export function achievements(list: Badge[], streak: Pick<Streaks, "longest">, now = Date.now()): Achievement[] {
  const out: Achievement[] = list.filter((b) => b.earnedAt !== null).map((b) => ({ id: `badge-${b.id}`, what: tr(b.description), at: b.earnedAt }));
  for (const days of STREAK_CERTIFICATES) {
    if (streak.longest >= days) out.push({ id: `streak-${days}`, what: tr("Reading {n} days in a row", { n: days }), at: now });
  }
  return out;
}

const centred = (text: string, size: number, y: number, font: Font, color = INK) =>
  `${color} rg BT /${font} ${size} Tf ${((W - textWidth(text, size, font)) / 2).toFixed(1)} ${y.toFixed(1)} Td ${pdfString(text)} Tj ET`;

/** The certificate's drawing operators. */
export function certificatePage(name: string, achievement: Achievement, title: string): string {
  const ops: string[] = [];
  // A double border in rust.
  ops.push(`${RUST} RG 6 w 28 28 ${W - 56} ${H - 56} re S`);
  ops.push(`${RUST} RG 1.5 w 44 44 ${W - 88} ${H - 88} re S`);
  ops.push(centred("LiteraryWorm", 14, H - 100, "F2", RUST));
  ops.push(centred(title, 40, H - 170, "F4"));
  ops.push(centred(tr("This certificate is awarded to"), 16, H - 230, "F1", MUTED));
  let y = H - 290;
  for (const line of wrap(name, 36, W - 200, "F2").slice(0, 2)) {
    ops.push(centred(line, 36, y, "F2"));
    y -= 44;
  }
  ops.push(centred(tr("for"), 16, y - 6, "F1", MUTED));
  y -= 46;
  for (const line of wrap(achievement.what, 22, W - 200, "F4").slice(0, 3)) {
    ops.push(centred(line, 22, y, "F4"));
    y -= 30;
  }
  if (achievement.at !== null) {
    const day = new Intl.DateTimeFormat(dateLocale(), { dateStyle: "long" }).format(achievement.at);
    ops.push(centred(day, 13, 92, "F1", MUTED));
  }
  ops.push(`${RUST} rg ${W / 2 - 60} 80 120 1 re f`);
  return ops.join("\n");
}

/** The whole certificate as a PDF file. */
export function certificatePdf(name: string, achievement: Achievement): Uint8Array {
  const title = tr("Well done!");
  return pdfDocument([certificatePage(name, achievement, title)], `${title} ${name}`, W, H);
}

/** A file name such as "mia-certificate-streak-7.pdf". */
export function certificateFileName(name: string, achievement: Achievement): string {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reader";
  return `${slug}-certificate-${achievement.id}.pdf`;
}
