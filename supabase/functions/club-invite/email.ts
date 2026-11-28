// The club invitation email: who invited them, the club, its book and finish date, and a link
// that joins it. Inline styles only (email clients drop <style> blocks), matching supabase/templates.
// In the inviter's email language (_shared/emailI18n.ts): the invitee has no account to choose one.

import { emailLocale, type EmailLanguage, htmlLang, translator } from "../_shared/emailI18n.ts";

export interface Invitation {
  to: string;
  inviterName: string | null;
  clubName: string;
  bookTitle: string | null;
  finishesOn: string;
  inviteCode: string;
  /** The inviter's email language (account_email_language()). */
  language?: EmailLanguage;
}

export interface InviteEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** One line, so names typed by members can't add lines to the subject. */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** "4 December 2026", from a YYYY-MM-DD date (UTC, so the day doesn't shift). */
export function longDate(isoDay: string, lang: EmailLanguage = "en"): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString(emailLocale(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function inviteEmail(invite: Invitation, site: string): InviteEmail {
  const lang = invite.language ?? "en";
  const t = translator(lang);
  const who = invite.inviterName ? oneLine(invite.inviterName) : t("A LiteraryWorm member");
  const club = oneLine(invite.clubName);
  const link = `${site}/clubs/join/${encodeURIComponent(invite.inviteCode)}`;
  const finish = longDate(invite.finishesOn, lang);

  const subject = t("{who} invited you to {club} on LiteraryWorm", { who, club });
  const lead = invite.bookTitle
    ? t("{who} invited you to join {club}, a book club reading {book} together, finishing by {date}.", { who, club, book: invite.bookTitle, date: finish })
    : t("{who} invited you to join {club}, a book club reading a book together, finishing by {date}.", { who, club, date: finish });
  const how = t(
    "Open the link to join. If you don't have a LiteraryWorm account yet, create one first, then open the link again. You can also join with the code in My Library → Clubs.",
  );
  const hi = t("Hi,");
  const joinLabel = t("Join the club");
  const codeLabel = t("Club code:");
  const why = t(
    "You're getting this because a LiteraryWorm member typed your address to invite you. We don't keep it, and you won't get more emails unless someone invites you again. If you weren't expecting this, ignore it.",
  );
  const heading = t("You're invited to a book club");
  const noButton = t("If the button doesn't work, copy this link into your browser:");

  const text = [
    hi,
    "",
    lead,
    "",
    `${joinLabel}: ${link}`,
    `${codeLabel} ${invite.inviteCode}`,
    "",
    how,
    "",
    why,
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

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
                <p style="margin:0 0 24px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px;background:#a24e2f;">
                      <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(joinLabel)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:#5b5750;">${escapeHtml(how)}</p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#5b5750;">${escapeHtml(codeLabel)} <strong style="color:#1d1c1a;letter-spacing:0.04em;">${escapeHtml(invite.inviteCode)}</strong></p>
                <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#5b5750;">
                  ${escapeHtml(noButton)}<br />
                  <a href="${escapeHtml(link)}" style="color:#a24e2f;word-break:break-all;">${escapeHtml(link)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                ${escapeHtml(why)}<br />
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

  return { to: invite.to, subject, text, html };
}
