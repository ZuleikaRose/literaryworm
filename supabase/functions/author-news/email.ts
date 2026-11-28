// The weekly "new from authors you follow" email: one per account, listing every new book
// found for its profiles since the last one. Inline styles only (email clients drop <style>
// blocks), matching supabase/templates. In the account's language (_shared/emailI18n.ts); titles,
// authors and profile names stay as written.

import { type EmailLanguage, htmlLang, translator } from "../_shared/emailI18n.ts";

export interface NewBook {
  userId: string;
  email: string;
  accountName: string | null;
  profileId: string;
  profileName: string | null;
  volumeId: string;
  title: string;
  author: string;
  published: string;
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
  return flat.length > 60 ? `${flat.slice(0, 59).trimEnd()}…` : flat;
}

/** One entry per book: the same book found for two profiles is listed once, naming both. */
function distinctBooks(books: NewBook[]): { book: NewBook; profiles: string[] }[] {
  const byId = new Map<string, { book: NewBook; profiles: string[] }>();
  for (const b of books) {
    const entry = byId.get(b.volumeId) ?? { book: b, profiles: [] };
    if (b.profileName && !entry.profiles.includes(b.profileName)) entry.profiles.push(b.profileName);
    byId.set(b.volumeId, entry);
  }
  return [...byId.values()];
}

/** The email for one account's new books (all the same userId and address). */
export function authorNewsEmail(books: NewBook[], site: string): Email {
  const first = books[0];
  const lang = first.language ?? "en";
  const t = translator(lang);
  const settings = `${site}/account#preferences`;
  const link = (b: NewBook) => `${site}/books/${encodeURIComponent(b.volumeId)}`;
  const entries = distinctBooks(books);
  // Name the profiles only when the household has more than one with new books here.
  const several = new Set(books.map((b) => b.profileId)).size > 1;
  const joined = (names: string[]) => (names.length > 1 ? t("{list} and {last}", { list: names.slice(0, -1).join(", "), last: names[names.length - 1] }) : names[0]);
  const who = (profiles: string[]) => (several && profiles.length ? ` ${t("(followed by {names})", { names: joined(profiles) })}` : "");
  const by = (author: string) => t("by {author}", { author });

  const subject =
    entries.length === 1
      ? t("New from {author}: {title}", { author: first.author, title: subjectTitle(first.title) })
      : t("{count} new books from authors you follow", { count: entries.length });
  const hello = first.accountName ? t("Hi {name},", { name: first.accountName }) : t("Hi,");
  const lead = entries.length === 1 ? t("An author you follow has a new book out.") : t("Authors you follow have new books out.");
  const inBell = t("They're in the bell in LiteraryWorm too.");
  const why = entries.length === 1 ? t("You're getting this because you follow this author.") : t("You're getting this because you follow these authors.");
  const turnOff = t("Turn these emails off in Account → Preferences:");
  const turnOffLink = t("Turn these emails off");
  const inPreferences = t("in Account → Preferences.");
  const heading = t("New from authors you follow");

  const text = [
    hello,
    "",
    lead,
    "",
    ...entries.map(({ book: b, profiles }) => `- ${b.title} ${by(b.author)}${who(profiles)}: ${link(b)}`),
    "",
    inBell,
    "",
    `${why} ${turnOff} ${settings}`,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

  const rows = entries
    .map(
      ({ book: b, profiles }) => `<tr>
                    <td style="padding:12px 0;border-top:1px solid #e0d9cc;${FONT}">
                      <a href="${escapeHtml(link(b))}" style="font-size:17px;font-weight:700;color:#a24e2f;text-decoration:none;">${escapeHtml(b.title)}</a>
                      <div style="margin-top:2px;font-size:14px;line-height:1.5;color:#5b5750;">${escapeHtml(by(b.author))}${escapeHtml(who(profiles))}</div>
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
                <p style="margin:16px 0 0;font-size:14px;line-height:1.55;color:#5b5750;">${escapeHtml(inBell)}</p>
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
