// The weekly Kids reading report: last week's reading for each Kids profile, for the grown-ups
// who turned it on. Inline styles only (email clients drop <style> blocks), matching
// supabase/templates and the What's new email.

import { CATALOG } from "../_shared/catalog.ts";

export interface KidWeek {
  name: string;
  minutes: number;
  listeningMinutes: number;
  /** Days with at least a minute of reading or listening, out of 7. */
  daysRead: number;
  booksFinished: number;
  /** The ids of the books finished: catalog ids or Google Books volume ids. */
  finishedBooks: string[];
  /** The weekly goal a grown-up set, in minutes; none when not set. */
  goalMinutes?: number | null;
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** 0 → "No reading", 45 → "45 min", 125 → "2 h 5 min". */
export function timeRead(minutes: number): string {
  if (minutes <= 0) return "No reading";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "26 October" to "1 November 2026": the week, in words. */
export function weekLabel(from: string, to: string): string {
  const date = (d: string, year: boolean) =>
    new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" }).format(
      new Date(`${d}T00:00:00Z`),
    );
  return `${date(from, false)} to ${date(to, true)}`;
}

/** One line about a profile's week, as plain words. */
export function kidLine(k: KidWeek): string {
  if (k.minutes <= 0) return "No reading or listening this week.";
  const listening = k.listeningMinutes > 0 ? ` (${timeRead(k.listeningMinutes)} of it listening)` : "";
  const days = k.daysRead === 1 ? "1 day" : `${k.daysRead} days`;
  return `${timeRead(k.minutes)} on ${days}${listening}.`;
}

/** Whether the week reached the goal a grown-up set, or null when there's none. */
export function goalLine(k: KidWeek): string | null {
  if (!k.goalMinutes) return null;
  const goal = `Weekly goal: ${timeRead(k.goalMinutes)}`;
  return k.minutes >= k.goalMinutes ? `${goal}. Reached!` : `${goal}. ${timeRead(k.goalMinutes - k.minutes)} short.`;
}

/** The finished books' titles where we know them (our own catalog); others are counted. */
export function finishedLine(k: KidWeek): string | null {
  if (k.booksFinished <= 0) return null;
  const titles = [...new Set(k.finishedBooks)].map((id) => CATALOG[id]?.title).filter((t): t is string => Boolean(t));
  const others = Math.max(k.booksFinished - titles.length, 0);
  const named = titles.join(", ");
  const count = k.booksFinished === 1 ? "1 book" : `${k.booksFinished} books`;
  if (!named) return `Finished ${count}.`;
  return `Finished ${count}: ${named}${others > 0 ? ` and ${others === 1 ? "1 more" : `${others} more`}` : ""}.`;
}

export function kidsReportEmail(input: {
  to: string;
  name: string | null;
  /** The week's first and last days (YYYY-MM-DD). */
  weekFrom: string;
  weekTo: string;
  kids: KidWeek[];
  site: string;
  /** The one-click unsubscribe page for this account and email. */
  unsubscribe: string;
}): Email {
  const when = weekLabel(input.weekFrom, input.weekTo);
  const family = `${input.site}/account#family`;
  const settings = `${input.site}/account#family`;
  const subject = `Your Kids reading report: ${when}`;
  const hello = input.name ? `Hi ${input.name},` : "Hi,";
  const lead = `Here's how ${input.kids.length === 1 ? input.kids[0].name : "your Kids profiles"} read and listened last week.`;

  const text = [
    hello,
    "",
    lead,
    "",
    ...input.kids.flatMap((k) => [k.name, kidLine(k), ...(goalLine(k) ? [goalLine(k)!] : []), ...(finishedLine(k) ? [finishedLine(k)!] : []), ""]),
    `See it in Account → Family: ${family}`,
    "",
    `You're getting this because you turned on the weekly Kids reading report. Unsubscribe in one click: ${input.unsubscribe}`,
    `Or change it in Account → Family: ${settings}`,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const rows = input.kids
    .map((k) => {
      const finished = finishedLine(k);
      const goal = goalLine(k);
      return `<tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;${FONT}">
                      <div style="font-size:17px;font-weight:700;color:#1d1c1a;">${escapeHtml(k.name)}</div>
                      <div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(kidLine(k))}</div>
                      ${goal ? `<div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(goal)}</div>` : ""}
                      ${finished ? `<div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(finished)}</div>` : ""}
                    </td>
                  </tr>`;
    })
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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Kids reading report</h1>
                <p style="margin:0 0 4px;font-size:14px;color:#5b5750;">${escapeHtml(when)}</p>
                <p style="margin:12px 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(family)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">See it in Account</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                You're getting this because you turned on the weekly Kids reading report. <a href="${escapeHtml(input.unsubscribe)}" style="color:#a24e2f;">Unsubscribe in one click</a> or <a href="${escapeHtml(settings)}" style="color:#a24e2f;">change it in Account</a>.<br />
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
