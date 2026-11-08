// The Year in reading email: the year just ended for every profile in the household, for the
// members who turned it on. Inline styles only (email clients drop <style> blocks), matching
// the Kids reading report.

import { CATALOG } from "../_shared/catalog.ts";
import { type Email, timeRead } from "../kids-report/email.ts";

export type { Email };

export interface ProfileYear {
  name: string;
  minutes: number;
  listeningMinutes: number;
  /** Days with at least a minute of reading or listening. */
  daysRead: number;
  booksFinished: number;
  /** The ids of the books finished: catalog ids or Google Books volume ids. */
  finishedBooks: string[];
  /** The month (1–12) with the most reading, or null. */
  bestMonth: number | null;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** Titles named in a profile's line; the rest are counted. */
export const TITLES_SHOWN = 5;

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Time and days, as plain words: "12 h 5 min on 48 days (3 h of it listening)." */
export function timeLine(p: ProfileYear): string {
  if (p.minutes <= 0) return "No reading or listening this year.";
  const listening = p.listeningMinutes > 0 ? ` (${timeRead(p.listeningMinutes)} of it listening)` : "";
  const days = p.daysRead === 1 ? "1 day" : `${p.daysRead} days`;
  return `${timeRead(p.minutes)} on ${days}${listening}.`;
}

/** The finished books, catalog titles named (up to TITLES_SHOWN), others counted; null for none. */
export function booksLine(p: ProfileYear): string | null {
  if (p.booksFinished <= 0) return null;
  const titles = [...new Set(p.finishedBooks)]
    .map((id) => CATALOG[id]?.title)
    .filter((t): t is string => Boolean(t))
    .slice(0, TITLES_SHOWN);
  const others = Math.max(p.booksFinished - titles.length, 0);
  const count = p.booksFinished === 1 ? "1 book" : `${p.booksFinished} books`;
  if (!titles.length) return `Finished ${count}.`;
  return `Finished ${count}: ${titles.join(", ")}${others > 0 ? ` and ${others === 1 ? "1 more" : `${others} more`}` : ""}.`;
}

/** "Read most in March." or null. */
export function monthLine(p: ProfileYear): string | null {
  return p.bestMonth && p.bestMonth >= 1 && p.bestMonth <= 12 && p.minutes > 0 ? `Read most in ${MONTHS[p.bestMonth - 1]}.` : null;
}

export function yearEmail(input: {
  to: string;
  name: string | null;
  year: number;
  profiles: ProfileYear[];
  site: string;
  /** The one-click unsubscribe page for this account and email. */
  unsubscribe: string;
}): Email {
  const stats = `${input.site}/library?view=stats`;
  const settings = `${input.site}/account#preferences`;
  const subject = `Your ${input.year} in reading`;
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const total = input.profiles.reduce((n, p) => n + p.booksFinished, 0);
  const household = input.profiles.length === 1 ? "you" : "your household";
  const lead =
    total > 0
      ? `In ${input.year} ${household} finished ${total === 1 ? "1 book" : `${total} books`}. Here's the year, profile by profile.`
      : `Here's how ${household} read and listened in ${input.year}.`;
  const lines = (p: ProfileYear) => [timeLine(p), booksLine(p), monthLine(p)].filter((l): l is string => Boolean(l));

  const text = [
    hello,
    "",
    lead,
    "",
    ...input.profiles.flatMap((p) => [p.name, ...lines(p), ""]),
    `See every day of it in My Library → Stats, where you can share the year as a picture: ${stats}`,
    "",
    `You're getting this because you turned on Year in reading. Unsubscribe in one click: ${input.unsubscribe}`,
    `Or change it in Account → Preferences: ${settings}`,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const rows = input.profiles
    .map(
      (p) => `<tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:17px;font-weight:700;color:#1d1c1a;">${escapeHtml(p.name)}</div>
                      ${lines(p)
                        .map((l) => `<div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(l)}</div>`)
                        .join("\n                      ")}
                    </td>
                  </tr>`,
    )
    .join("\n");

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f1e4cb;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(lead)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1e4cb;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fbf8f2;border:1px solid #e0d9cc;border-radius:14px;">
            <tr>
              <td style="padding:32px 32px 8px;${FONT}font-size:20px;font-weight:700;color:#1d1c1a;">
                Literary<span style="color:#a24e2f;">Worm</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;${FONT}color:#1d1c1a;">
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${escapeHtml(subject)}</h1>
                <p style="margin:12px 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(stats)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">See your stats</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                You're getting this because you turned on Year in reading. <a href="${escapeHtml(input.unsubscribe)}" style="color:#a24e2f;">Unsubscribe in one click</a> or <a href="${escapeHtml(settings)}" style="color:#a24e2f;">change it in Account</a>.<br />
                LiteraryWorm · <a href="https://www.literaryworm.com" style="color:#a24e2f;">www.literaryworm.com</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  return { to: input.to, subject, text, html };
}
