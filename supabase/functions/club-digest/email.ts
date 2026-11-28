// The daily book club posts email: per club, which chapters have new posts, how many and who wrote
// them. What they wrote stays in the app (like the browser notification). Inline styles only
// (email clients drop <style> blocks), matching supabase/templates and the other emails. In the
// account's language (_shared/emailI18n.ts); club names, book titles and display names stay as written.

import { CATALOG } from "../_shared/catalog.ts";
import { type EmailLanguage, htmlLang, translator } from "../_shared/emailI18n.ts";

/** New posts about one chapter of one club (a row of claim_club_post_digests()). */
export interface ChapterPosts {
  clubId: string;
  clubName: string;
  /** The club's book: a catalog id. */
  bookId: string;
  /** 0-based, as stored. */
  chapterIndex: number;
  posts: number;
  /** Display names of who wrote them, sorted. */
  authors: string[];
}

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** One club's new posts, chapter by chapter. */
export interface ClubPosts {
  clubId: string;
  clubName: string;
  book: string;
  chapters: { chapter: number; posts: number; authors: string[] }[];
  posts: number;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** "Ada", "Ada and Ben", "Ada, Ben and Cal", "Ada, Ben and 3 others". */
export function names(list: string[], lang: EmailLanguage = "en"): string {
  const t = translator(lang);
  if (list.length <= 1) return list[0] ?? t("A member");
  if (list.length <= 3) return t("{first} and {last}", { first: list.slice(0, -1).join(", "), last: list[list.length - 1] });
  return t("{first} and {n} others", { first: list.slice(0, 2).join(", "), n: list.length - 2 });
}

/** Groups the rows by club (in the order given), chapters in order. */
export function byClub(rows: ChapterPosts[], lang: EmailLanguage = "en"): ClubPosts[] {
  const t = translator(lang);
  const clubs = new Map<string, ClubPosts>();
  for (const r of rows) {
    let club = clubs.get(r.clubId);
    if (!club) {
      club = { clubId: r.clubId, clubName: r.clubName, book: CATALOG[r.bookId]?.title ?? t("your book"), chapters: [], posts: 0 };
      clubs.set(r.clubId, club);
    }
    club.chapters.push({ chapter: r.chapterIndex + 1, posts: r.posts, authors: r.authors });
    club.posts += r.posts;
  }
  for (const club of clubs.values()) club.chapters.sort((a, b) => a.chapter - b.chapter);
  return [...clubs.values()];
}

/** "Chapter 3: 2 posts from Ada and Ben". */
export function chapterLine(c: ClubPosts["chapters"][number], lang: EmailLanguage = "en"): string {
  const t = translator(lang);
  const who = names(c.authors, lang);
  return c.posts === 1
    ? t("Chapter {chapter}: 1 post from {names}", { chapter: c.chapter, names: who })
    : t("Chapter {chapter}: {n} posts from {names}", { chapter: c.chapter, n: c.posts, names: who });
}

export function clubPostsEmail(input: {
  to: string;
  name: string | null;
  rows: ChapterPosts[];
  site: string;
  unsubscribe: string;
  /** The account's email language (account_email_language()). */
  language?: EmailLanguage;
}): Email {
  const lang = input.language ?? "en";
  const t = translator(lang);
  const clubs = byClub(input.rows, lang);
  const total = clubs.reduce((sum, c) => sum + c.posts, 0);
  const subject = clubs.length === 1 ? t("New posts in {club}", { club: clubs[0].clubName }) : t("New posts in {n} of your book clubs", { n: clubs.length });
  const hello = input.name ? t("Hi {name},", { name: input.name }) : t("Hi,");
  const lead =
    total === 1
      ? t("There is 1 new post about chapters you've reached since you last looked.")
      : t("There are {n} new posts about chapters you've reached since you last looked.", { n: total });
  const page = clubs.length === 1 ? `${input.site}/clubs/${clubs[0].clubId}` : `${input.site}/library?view=clubs`;
  const settings = `${input.site}/account#preferences`;
  const hint = t("Posts about chapters you haven't reached yet stay hidden, here and in the app.");
  const why = t("You're getting this because you asked for book club post emails.");
  const stopText = t("Stop them in one click");
  const changeText = t("change your email settings");
  const button = clubs.length === 1 ? t("Open the club") : t("Open your clubs");
  const line = (c: ClubPosts["chapters"][number]) => chapterLine(c, lang);

  const text = [
    hello,
    "",
    lead,
    "",
    ...clubs.flatMap((c) => [`${c.clubName} (${c.book})`, ...c.chapters.map(line), `${input.site}/clubs/${c.clubId}`, ""]),
    hint,
    "",
    `${why} ${t("Stop them in one click: {link}", { link: input.unsubscribe })}`,
    t("Or change your email settings: {link}", { link: settings }),
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const cards = clubs
    .map(
      (c) => `<tr>
                    <td style="padding:14px 0;border-top:1px solid #e0d9cc;${FONT}">
                      <a href="${escapeHtml(`${input.site}/clubs/${c.clubId}`)}" style="font-size:17px;font-weight:700;color:#1d1c1a;text-decoration:none;">${escapeHtml(c.clubName)}</a>
                      <div style="margin-top:2px;font-size:14px;color:#5b5750;">${escapeHtml(c.book)}</div>
                      ${c.chapters.map((ch) => `<div style="margin-top:4px;font-size:15px;line-height:1.55;color:#3d3a35;">${escapeHtml(line(ch))}</div>`).join("\n                      ")}
                    </td>
                  </tr>`,
    )
    .join("\n                  ");

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
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid #e0d9cc;">
                  ${cards}
                </table>
                <p style="margin:20px 0 0;">
                  <a href="${escapeHtml(page)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#a24e2f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(button)}</a>
                </p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.5;color:#5b5750;">${escapeHtml(hint)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                ${escapeHtml(why)} ${t("{unsubscribe} or {change}.", {
                  unsubscribe: `<a href="${escapeHtml(input.unsubscribe)}" style="color:#a24e2f;">${escapeHtml(stopText)}</a>`,
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
