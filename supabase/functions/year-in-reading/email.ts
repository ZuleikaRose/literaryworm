// The Year in reading email: the year just ended for every profile in the household, for the
// members who turned it on. Inline styles only (email clients drop <style> blocks), matching
// the Kids reading report. In the account's language (_shared/emailI18n.ts); profile names and
// book titles stay as written.

import { CATALOG } from "../_shared/catalog.ts";
import { emailLocale, type EmailLanguage, htmlLang, translator } from "../_shared/emailI18n.ts";
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
export function timeLine(p: ProfileYear, lang: EmailLanguage = "en"): string {
  const t = translator(lang);
  if (p.minutes <= 0) return t("No reading or listening this year.");
  const time = timeRead(p.minutes, lang);
  const n = p.daysRead;
  if (p.listeningMinutes > 0) {
    const listening = timeRead(p.listeningMinutes, lang);
    return n === 1 ? t("{time} on 1 day ({listening} of it listening).", { time, listening }) : t("{time} on {n} days ({listening} of it listening).", { time, n, listening });
  }
  return n === 1 ? t("{time} on 1 day.", { time }) : t("{time} on {n} days.", { time, n });
}

/** The finished books, catalog titles named (up to TITLES_SHOWN), others counted; null for none. */
export function booksLine(p: ProfileYear, lang: EmailLanguage = "en"): string | null {
  const t = translator(lang);
  if (p.booksFinished <= 0) return null;
  const titles = [...new Set(p.finishedBooks)]
    .map((id) => CATALOG[id]?.title)
    .filter((x): x is string => Boolean(x))
    .slice(0, TITLES_SHOWN);
  const others = Math.max(p.booksFinished - titles.length, 0);
  const n = p.booksFinished;
  const named = titles.join(", ");
  if (!titles.length) return n === 1 ? t("Finished 1 book.") : t("Finished {n} books.", { n });
  if (others === 0) return n === 1 ? t("Finished 1 book: {titles}.", { titles: named }) : t("Finished {n} books: {titles}.", { n, titles: named });
  return others === 1
    ? t("Finished {n} books: {titles} and 1 more.", { n, titles: named })
    : t("Finished {n} books: {titles} and {others} more.", { n, titles: named, others });
}

/** The month's name: English as written here, other languages from Intl. */
function monthName(month: number, lang: EmailLanguage): string {
  if (lang === "en") return MONTHS[month - 1];
  return new Intl.DateTimeFormat(emailLocale(lang), { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2026, month - 1, 15)));
}

/** "Read most in March." or null. */
export function monthLine(p: ProfileYear, lang: EmailLanguage = "en"): string | null {
  const t = translator(lang);
  return p.bestMonth && p.bestMonth >= 1 && p.bestMonth <= 12 && p.minutes > 0 ? t("Read most in {month}.", { month: monthName(p.bestMonth, lang) }) : null;
}

export function yearEmail(input: {
  to: string;
  name: string | null;
  year: number;
  profiles: ProfileYear[];
  site: string;
  /** The one-click unsubscribe page for this account and email. */
  unsubscribe: string;
  /** The account's email language (account_email_language()). */
  language?: EmailLanguage;
}): Email {
  const lang = input.language ?? "en";
  const t = translator(lang);
  const stats = `${input.site}/library?view=stats`;
  const settings = `${input.site}/account#preferences`;
  const year = input.year;
  const subject = t("Your {year} in reading", { year });
  const hello = input.name ? t("Hi {name},", { name: input.name }) : t("Hi,");
  const total = input.profiles.reduce((n, p) => n + p.booksFinished, 0);
  const alone = input.profiles.length === 1;
  const lead =
    total > 0
      ? alone
        ? total === 1
          ? t("In {year} you finished 1 book. Here's the year, profile by profile.", { year })
          : t("In {year} you finished {n} books. Here's the year, profile by profile.", { year, n: total })
        : total === 1
          ? t("In {year} your household finished 1 book. Here's the year, profile by profile.", { year })
          : t("In {year} your household finished {n} books. Here's the year, profile by profile.", { year, n: total })
      : alone
        ? t("Here's how you read and listened in {year}.", { year })
        : t("Here's how your household read and listened in {year}.", { year });
  const why = t("You're getting this because you turned on Year in reading.");
  const unsubscribeText = t("Unsubscribe in one click");
  const changeText = t("change it in Account");
  const button = t("See your stats");
  const lines = (p: ProfileYear) => [timeLine(p, lang), booksLine(p, lang), monthLine(p, lang)].filter((l): l is string => Boolean(l));

  const text = [
    hello,
    "",
    lead,
    "",
    ...input.profiles.flatMap((p) => [p.name, ...lines(p), ""]),
    t("See every day of it in My Library → Stats, where you can share the year as a picture: {link}", { link: stats }),
    "",
    `${why} ${t("Unsubscribe in one click: {link}", { link: input.unsubscribe })}`,
    t("Or change it in Account → Preferences: {link}", { link: settings }),
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
<html ${htmlLang(lang)}>
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
                  <a href="${escapeHtml(stats)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(button)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                ${escapeHtml(why)} ${t("{unsubscribe} or {change}.", {
                  unsubscribe: `<a href="${escapeHtml(input.unsubscribe)}" style="color:#a24e2f;">${escapeHtml(unsubscribeText)}</a>`,
                  change: `<a href="${escapeHtml(settings)}" style="color:#a24e2f;">${escapeHtml(changeText)}</a>`,
                })}<br />
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
