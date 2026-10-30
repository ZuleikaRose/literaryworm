// The email that confirms an account was deleted, sent once the account has gone.
// Inline styles only (email clients drop <style> blocks), matching supabase/templates.

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const FONT = "font-family:'DM Sans',Arial,Helvetica,sans-serif;";
const SUPPORT = "support@literaryworm.com";

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** What the email says the deletion covered, and what it didn't need to. */
const WHAT_WENT = [
  "Your profiles, library, reading progress, bookmarks, highlights and notes",
  "Your logs, ratings, favourites, lists, goals, book clubs and uploaded books",
  "Your membership, which was cancelled first, so nothing more will be charged",
];

export function deletedEmail(to: string, cancelledPlan: boolean): Email {
  const subject = "Your LiteraryWorm account has been deleted";
  const lead = "As you asked, we've deleted your LiteraryWorm account and everything in it. This can't be undone.";
  const items = cancelledPlan ? WHAT_WENT : WHAT_WENT.slice(0, 2);
  const notYou = `If you didn't ask for this, reply to this email or write to ${SUPPORT} straight away.`;
  const billing = "Receipts for past payments stay with Stripe, who handled them, as the law requires.";

  const text = [
    "Hi,",
    "",
    lead,
    "",
    "What we deleted:",
    ...items.map((i) => `- ${i}`),
    "",
    billing,
    "",
    "You're welcome back any time: you can sign up again with this address.",
    "",
    notYou,
    "",
    "This is the last email we'll send to this address unless you sign up again.",
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
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25;">Your account has been deleted</h1>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.55;">Hi,</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.55;">${escapeHtml(lead)}</p>
                <p style="margin:0 0 6px;font-size:16px;line-height:1.55;font-weight:700;">What we deleted</p>
                <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.6;">
                  ${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("\n                  ")}
                </ul>
                <p style="margin:0 0 12px;font-size:14px;line-height:1.55;color:#5b5750;">${escapeHtml(billing)}</p>
                <p style="margin:0 0 12px;font-size:16px;line-height:1.55;">You're welcome back any time: you can sign up again with this address.</p>
                <p style="margin:0;font-size:16px;line-height:1.55;">If you didn't ask for this, reply to this email or write to <a href="mailto:${SUPPORT}" style="color:#a24e2f;">${SUPPORT}</a> straight away.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px;${FONT}font-size:12px;line-height:1.5;color:#5b5750;">
                <hr style="border:0;border-top:1px solid #e0d9cc;margin:0 0 16px;" />
                This is the last email we'll send to this address unless you sign up again.<br />
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

  return { to, subject, text, html };
}
