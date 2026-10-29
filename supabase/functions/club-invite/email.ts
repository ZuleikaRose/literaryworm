// The club invitation email: who invited them, the club, its book and finish date, and a link
// that joins it. Inline styles only (email clients drop <style> blocks), matching supabase/templates.

export interface Invitation {
  to: string;
  inviterName: string | null;
  clubName: string;
  bookTitle: string | null;
  finishesOn: string;
  inviteCode: string;
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
export function longDate(isoDay: string): string {
  return new Date(`${isoDay}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function inviteEmail(invite: Invitation, site: string): InviteEmail {
  const who = invite.inviterName ? oneLine(invite.inviterName) : "A LiteraryWorm member";
  const club = oneLine(invite.clubName);
  const link = `${site}/clubs/join/${encodeURIComponent(invite.inviteCode)}`;
  const reading = invite.bookTitle ? `reading ${invite.bookTitle} together` : "reading a book together";
  const finish = longDate(invite.finishesOn);

  const subject = `${who} invited you to ${club} on LiteraryWorm`;
  const lead = `${who} invited you to join ${club}, a book club ${reading}, finishing by ${finish}.`;
  const how =
    "Open the link to join. If you don't have a LiteraryWorm account yet, create one first, then open the link again. You can also join with the code in My Library → Clubs.";

  const text = [
    "Hi,",
    "",
    lead,
    "",
    `Join the club: ${link}`,
    `Club code: ${invite.inviteCode}`,
    "",
    how,
    "",
    "You're getting this because a LiteraryWorm member typed your address to invite you. We don't keep it, and you won't get more emails unless someone invites you again. If you weren't expecting this, ignore it.",
    "LiteraryWorm · https://www.literaryworm.com",
  ].join("\n");

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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">You're invited to a book club</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:10px;background:#a24e2f;">
                      <a href="${escapeHtml(link)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Join the club</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:14px;line-height:1.55;color:#5b5750;">${escapeHtml(how)}</p>
                <p style="margin:12px 0 0;font-size:14px;line-height:1.55;color:#5b5750;">Club code: <strong style="color:#1d1c1a;letter-spacing:0.04em;">${escapeHtml(invite.inviteCode)}</strong></p>
                <p style="margin:12px 0 0;font-size:13px;line-height:1.5;color:#5b5750;">
                  If the button doesn't work, copy this link into your browser:<br />
                  <a href="${escapeHtml(link)}" style="color:#a24e2f;word-break:break-all;">${escapeHtml(link)}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                You're getting this because a LiteraryWorm member typed your address to invite you. We don't keep it, and you won't get more emails unless someone invites you again. If you weren't expecting this, ignore it.<br />
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
