// The book-out email: one per account per run, listing every reminded book that's out.
// Inline styles only (email clients drop <style> blocks), matching supabase/templates. In the
// account's language (_shared/emailI18n.ts); titles and authors stay as written.

import { type EmailLanguage, htmlLang, translator } from "../_shared/emailI18n.ts";

export interface DueReminder {
  userId: string;
  email: string;
  accountName: string | null;
  profileId: string;
  profileName: string | null;
  volumeId: string;
  title: string;
  author: string | null;
  releaseDate: string;
  /** The account's email language (account_email_language()); English when absent. */
  language?: EmailLanguage;
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

/** Titles in a subject line: no line breaks, and not so long that clients cut them mid-word. */
function subjectTitle(title: string): string {
  const flat = title.replace(/\s+/g, " ").trim();
  return flat.length > 80 ? `${flat.slice(0, 79).trimEnd()}…` : flat;
}

/** The email for one account's books (all the same userId and address). */
export function releaseEmail(books: DueReminder[], site: string): Email {
  const first = books[0];
  const lang = first.language ?? "en";
  const t = translator(lang);
  const settings = `${site}/account#preferences`;
  const link = (b: DueReminder) => `${site}/books/${encodeURIComponent(b.volumeId)}`;
  // Name the profile only when the household has more than one with reminders here.
  const several = new Set(books.map((b) => b.profileId)).size > 1;
  const who = (b: DueReminder) => (several && b.profileName ? ` ${t("(for {name})", { name: b.profileName })}` : "");
  const by = (author: string) => t("by {author}", { author });

  const subject =
    books.length === 1 ? t("{title} is out now", { title: subjectTitle(first.title) }) : t("{count} books you were waiting for are out now", { count: books.length });
  const hello = first.accountName ? t("Hi {name},", { name: first.accountName }) : t("Hi,");
  const lead = books.length === 1 ? t("A book you asked us to remind you about is out today.") : t("Books you asked us to remind you about are out now.");
  const onHome = t("It's on Home in LiteraryWorm too, until you dismiss it.");
  const why = books.length === 1 ? t("You're getting this because you set Remind me on this book.") : t("You're getting this because you set Remind me on these books.");
  const turnOff = t("Turn these emails off in Account → Preferences:");
  const turnOffLink = t("Turn these emails off");
  const inPreferences = t("in Account → Preferences.");
  const heading = books.length === 1 ? t("It's out now") : t("They're out now");

  const text = [
    hello,
    "",
    lead,
    "",
    ...books.map((b) => `- ${b.title}${b.author ? ` ${by(b.author)}` : ""}${who(b)}: ${link(b)}`),
    "",
    onHome,
    "",
    `${why} ${turnOff} ${settings}`,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const rows = books
    .map(
      (b) => `<tr>
                    <td style="padding:12px 0;border-top:1px solid #e0d9cc;${FONT}">
                      <a href="${escapeHtml(link(b))}" style="font-size:17px;font-weight:700;color:#a24e2f;text-decoration:none;">${escapeHtml(b.title)}</a>
                      <div style="margin-top:2px;font-size:14px;line-height:1.5;color:#5b5750;">${b.author ? escapeHtml(by(b.author)) : "&nbsp;"}${escapeHtml(who(b))}</div>
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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">${escapeHtml(heading)}</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">${escapeHtml(hello)}</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                </table>
                <p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#5b5750;">${escapeHtml(onHome)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                ${escapeHtml(why)} <a href="${escapeHtml(settings)}" style="color:#a24e2f;">${escapeHtml(turnOffLink)}</a> ${escapeHtml(inPreferences)}<br />
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

  return { to: first.email, subject, text, html };
}
